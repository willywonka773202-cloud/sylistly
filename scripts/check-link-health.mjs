#!/usr/bin/env node
/**
 * Live-retailer link health sweep.
 *
 * Backward compatibility: data/catalog-health.json still exposes generatedAt,
 * checked, and unavailable. Schema v2 additionally records a typed, timestamped
 * outcome per product plus explicit coverage metrics for the 24-hour SLA.
 *
 * Run: npm run health:sweep (network; safe to re-run anytime)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'client-catalog.json');
const HEALTH_PATH = path.join(ROOT, 'data', 'catalog-health.json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function validHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isExactPdpUrl(value) {
  if (!validHttpUrl(value)) return false;
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = parsed.pathname.toLowerCase();
  const isNordstromProductPath =
    (hostname === 'nordstrom.com' || hostname === 'nordstromrack.com')
    && /^\/s\/[^/]+\/\d+/.test(pathname);

  if (!pathname || pathname === '/') return false;
  if (hostname.includes('google.')) return false;
  if (parsed.hash.toLowerCase().includes('oshopproduct')) return false;
  if (pathname.includes('/search') || (pathname.includes('/s/') && !isNordstromProductPath) || pathname.includes('search-result')) return false;
  return !['q', 'query', 'search', 'searchTerm', 'text', 'keyword']
    .some((key) => parsed.searchParams.has(key));
}

function directProductUrl(product) {
  const value = [product.productUrl, product.retailerUrl].find(validHttpUrl);
  if (!validHttpUrl(value)) return null;
  const parsed = new URL(value);
  if (parsed.hostname.toLowerCase().includes('google.')) return null;
  parsed.hash = '';
  // Remove tracking without deleting functional PDP keys such as pid/style/sku.
  for (const key of [...parsed.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith('utm_')
      || ['affid', 'affiliate', 'clickid', 'fbclid', 'gclid', 'irclickid', 'ref', 'referrer'].includes(key.toLowerCase())
    ) {
      parsed.searchParams.delete(key);
    }
  }
  return parsed.toString();
}

export function buildHealthSnapshot(catalog, items, results, startedAt, generatedAt = new Date().toISOString()) {
  const checkedIds = new Set(results.map((result) => result.id));
  const publishableCandidates = items.filter((item) => item.exactPdp && item.trusted !== false && item.inStock !== false);
  const publishableCandidateIds = new Set(publishableCandidates.map((item) => item.id));
  const generatedMs = Date.parse(generatedAt);
  const freshPublishableChecks = results.filter((result) => {
    if (!publishableCandidateIds.has(result.id)) return false;
    const checkedMs = Date.parse(result.checkedAt);
    return Number.isFinite(checkedMs)
      && Number.isFinite(generatedMs)
      && generatedMs - checkedMs >= -MAX_FUTURE_SKEW_MS
      && generatedMs - checkedMs <= FRESH_WINDOW_MS;
  });
  const freshAvailablePublishableChecks = freshPublishableChecks
    .filter((result) => result.outcome === 'available');
  const checkedPublishable = publishableCandidates.filter((item) => checkedIds.has(item.id)).length;
  const pct = (numerator, denominator) => denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
  const statusCounts = {};
  for (const result of results) statusCounts[result.outcome] = (statusCounts[result.outcome] || 0) + 1;
  const unavailable = results
    .filter((result) => result.outcome === 'dead' || result.outcome === 'sold_out')
    .map((result) => result.id)
    .sort();
  const products = Object.fromEntries(
    [...results]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((result) => [result.id, result]),
  );
  // Candidate-review coverage is intentionally broader than the serving set:
  // it shows how much structurally plausible inventory has current positive
  // evidence. The served/published set is the fresh-positive subset, so its
  // own 24-hour coverage is 100% by construction (or 0% when empty). A generic
  // 200, bot block, or error remains review work and is never served.
  const candidateReviewCoveragePct = pct(
    freshAvailablePublishableChecks.length,
    publishableCandidates.length,
  );
  const servedPublishedProducts = freshAvailablePublishableChecks.length;
  const servedFreshCoveragePct = servedPublishedProducts > 0 ? 100 : 0;

  return {
    schemaVersion: 2,
    generatedAt,
    startedAt,
    checked: results.length,
    eligible: items.length,
    note: 'regenerate with: npm run health:sweep',
    coverage: {
      targetFreshCoveragePct: 95,
      catalogProducts: catalog.length,
      directLinkProducts: items.length,
      exactPdpProducts: items.filter((item) => item.exactPdp).length,
      candidateProducts: catalog.length,
      reviewCandidates: publishableCandidates.length,
      candidateFreshAvailable: freshAvailablePublishableChecks.length,
      candidateReviewCoveragePct,
      targetCandidateReviewCoveragePct: 95,
      meetsCandidateReviewCoverageTarget: candidateReviewCoveragePct >= 95,
      servedPublishedProducts,
      servedFreshCoveragePct,
      targetServedFreshCoveragePct: 95,
      meetsServedFreshCoverageTarget: servedPublishedProducts > 0 && servedFreshCoveragePct >= 95,
      withheldCandidateProducts: Math.max(0, catalog.length - servedPublishedProducts),
      retiredProducts: unavailable.length,
      // Backward-compatible aliases. These describe candidate review coverage,
      // not the strict served/published set; new consumers must use the explicit
      // fields above.
      publishableCandidates: publishableCandidates.length,
      checkedProducts: results.length,
      checkedDirectPct: pct(results.length, items.length),
      checkedPublishableCandidates: checkedPublishable,
      freshCheckedPublishableCandidates: freshPublishableChecks.length,
      freshAvailablePublishableCandidates: freshAvailablePublishableChecks.length,
      freshCoveragePct: candidateReviewCoveragePct,
      meetsFreshCoverageTarget: candidateReviewCoveragePct >= 95,
      statusCounts,
    },
    unavailable,
    products,
  };
}

function fetchUrl(url, depth = 0) {
  return new Promise((resolve) => {
    if (depth > 4) {
      resolve({ code: 0, body: '', error: 'redirect_limit', finalUrl: url });
      return;
    }
    const requestModule = url.startsWith('https') ? https : http;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const request = requestModule.get(
      url,
      { headers: { 'user-agent': UA, accept: '*/*' }, timeout: 20_000 },
      (response) => {
        const code = response.statusCode || 0;
        if (code >= 300 && code < 400 && response.headers.location) {
          response.resume();
          const redirectUrl = new URL(response.headers.location, url).toString();
          fetchUrl(redirectUrl, depth + 1).then(finish);
          return;
        }
        let body = '';
        response.on('data', (chunk) => {
          if (body.length < 400_000) body += chunk;
        });
        response.on('end', () => finish({ code, body, finalUrl: url }));
      },
    );
    request.on('error', (error) => finish({ code: 0, body: '', error: error.code || 'network', finalUrl: url }));
    request.on('timeout', () => {
      request.destroy();
      finish({ code: 0, body: '', error: 'timeout', finalUrl: url });
    });
  });
}

async function check(item) {
  const base = {
    id: item.id,
    checkedAt: new Date().toISOString(),
    url: item.url,
    exactPdp: item.exactPdp,
    catalogPriceCents: item.price,
  };

  if (/\/products\//.test(item.url)) {
    const shopifyUrl = item.url.endsWith('.js') ? item.url : `${item.url.replace(/\/$/, '')}.js`;
    const response = await fetchUrl(shopifyUrl);
    if (response.code === 200 && response.body) {
      try {
        const payload = JSON.parse(response.body);
        // Only a real boolean is product-level stock evidence. Some non-Shopify
        // endpoints also return JSON from `.js`; absence of `available` must not
        // be misclassified as sold out.
        if (typeof payload.available === 'boolean') {
          const livePriceCents = Number(payload.price);
          return {
            ...base,
            outcome: payload.available ? 'available' : 'sold_out',
            httpStatus: 200,
            ...(Number.isFinite(livePriceCents) ? { livePriceCents } : {}),
            detail: 'shopify_product_json',
          };
        }
      } catch {
        // A non-Shopify retailer may also use /products/. Verify its HTML below.
      }
    }
  }

  const response = await fetchUrl(item.url);
  if (response.code === 404 || response.code === 410) {
    return { ...base, outcome: 'dead', httpStatus: response.code };
  }
  if (response.code === 403 || response.code === 429) {
    return { ...base, outcome: 'blocked', httpStatus: response.code, detail: `http_${response.code}` };
  }
  if (response.code !== 200) {
    return {
      ...base,
      outcome: 'error',
      httpStatus: response.code || null,
      detail: response.error || `http_${response.code}`,
    };
  }
  const htmlOutcome = classifyHtmlOutcome(response.body || '');
  return {
    ...base,
    outcome: htmlOutcome,
    httpStatus: 200,
    detail: htmlOutcome === 'reachable' ? 'http_200_stock_unknown' : 'structured_html_stock_signal',
  };
}

/** Classify only strong product-level stock evidence. Generic HTTP 200 means the
 * URL is reachable, not that the product can be bought. */
export function classifyHtmlOutcome(body) {
  const html = String(body || '');
  const soldOutSignal = [
    /"availability"\s*:\s*"https?:\/\/schema\.org\/(?:OutOfStock|SoldOut|Discontinued)"/i,
    /(?:content|href)=["']https?:\/\/schema\.org\/(?:OutOfStock|SoldOut|Discontinued)["']/i,
    /property=["']product:availability["'][^>]*content=["'](?:out of stock|sold out|unavailable)["']/i,
    /content=["'](?:out of stock|sold out|unavailable)["'][^>]*property=["']product:availability["']/i,
  ].some((pattern) => pattern.test(html));
  if (soldOutSignal) return 'sold_out';

  const inStockSignal = [
    /"availability"\s*:\s*"https?:\/\/schema\.org\/InStock"/i,
    /(?:content|href)=["']https?:\/\/schema\.org\/InStock["']/i,
    /property=["']product:availability["'][^>]*content=["']in stock["']/i,
    /content=["']in stock["'][^>]*property=["']product:availability["']/i,
  ].some((pattern) => pattern.test(html));
  return inStockSignal ? 'available' : 'reachable';
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const items = catalog
    .map((product) => {
      const url = directProductUrl(product);
      return url ? {
        id: product.id,
        url,
        price: product.priceCents,
        exactPdp: isExactPdpUrl([product.productUrl, product.retailerUrl].find(validHttpUrl)),
        trusted: product.trusted,
        inStock: product.inStock,
      } : null;
    })
    .filter(Boolean);
  const startedAt = new Date().toISOString();
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      results.push(await check(item));
      if (results.length % 50 === 0) console.error(`  ${results.length}/${items.length}`);
    }
  }

  await Promise.all(Array.from({ length: 10 }, worker));

  const snapshot = buildHealthSnapshot(catalog, items, results, startedAt);
  console.log('sweep:', JSON.stringify(snapshot.coverage.statusCounts));
  writeFileSync(HEALTH_PATH, `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(`gated ${snapshot.unavailable.length} dead/sold-out ids -> data/catalog-health.json`);
  console.log(
    `candidate review coverage ${snapshot.coverage.candidateReviewCoveragePct}% `
    + `(${snapshot.coverage.candidateFreshAvailable}/${snapshot.coverage.reviewCandidates} fresh available); `
    + `served freshness ${snapshot.coverage.servedFreshCoveragePct}% `
    + `(${snapshot.coverage.servedPublishedProducts} strict products)`,
  );

  const drifted = new Map(results
    .filter((result) => (
      result.outcome === 'available'
      && result.livePriceCents
      && result.catalogPriceCents
      && Math.abs(result.livePriceCents - result.catalogPriceCents) > Math.max(100, result.catalogPriceCents * 0.02)
    ))
    .map((result) => [result.id, result.livePriceCents]));
  if (drifted.size) {
    for (const product of catalog) {
      if (drifted.has(product.id)) product.priceCents = drifted.get(product.id);
    }
    writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 1)}\n`);
    console.log(`patched ${drifted.size} drifted prices -> data/client-catalog.json`);
  }
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
