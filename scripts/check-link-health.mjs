#!/usr/bin/env node
/**
 * Live-retailer link health sweep. Checks every direct-link catalog product
 * (Shopify stores via the free /products/X.js JSON, everything else via GET)
 * and rewrites data/catalog-health.json, whose `unavailable` ids are gated out
 * of every surface by isCleanClientCatalogProduct (lib/client-catalog.ts).
 * Also patches priceCents in data/client-catalog.json when the live Shopify
 * price drifted more than 2% / $1.
 *
 * Run: npm run health:sweep   (network; ~3 min; safe to re-run anytime)
 * ponytail: sequential-ish sweep w/ 10 workers, no retries — good enough nightly;
 * add retry/backoff if `blocked` counts climb.
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

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));

const isValid = (u) => { try { return new URL(u).protocol.startsWith('http'); } catch { return false; } };
const isDirect = (p) => isValid(p.productUrl) && !new URL(p.productUrl).host.includes('google.');
const items = catalog.filter(isDirect).map((p) => ({ id: p.id, url: p.productUrl.replace(/\?.*$/, ''), price: p.priceCents }));

function fetchUrl(u, depth = 0) {
  return new Promise((resolve) => {
    if (depth > 4) return resolve({ code: 599 });
    const mod = u.startsWith('https') ? https : http;
    const req = mod.get(u, { headers: { 'user-agent': UA, accept: '*/*' }, timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchUrl(new URL(res.headers.location, u).toString(), depth + 1));
      }
      let body = '';
      res.on('data', (d) => { if (body.length < 400000) body += d; });
      res.on('end', () => resolve({ code: res.statusCode, body }));
    }).on('error', () => resolve({ code: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ code: 0 }); });
  });
}

async function check(item) {
  if (/\/products\//.test(item.url)) { // Shopify: free structured price + availability
    const r = await fetchUrl(item.url + '.js');
    if (r.code === 200 && r.body) {
      try {
        const j = JSON.parse(r.body);
        return { id: item.id, status: j.available ? 'ok' : 'soldout', livePrice: j.price, catPrice: item.price };
      } catch { /* fall through to HTML check */ }
    }
    if (r.code === 404) return { id: item.id, status: 'dead' };
    if (r.code === 403 || r.code === 429) return { id: item.id, status: 'blocked' };
  }
  const r = await fetchUrl(item.url);
  if (r.code === 404 || r.code === 410) return { id: item.id, status: 'dead' };
  if (r.code === 403 || r.code === 429) return { id: item.id, status: 'blocked' };
  if (r.code !== 200) return { id: item.id, status: `error${r.code}` };
  if (/OutOfStock|sold[ -]?out|"available":\s*false/i.test(r.body || '')) return { id: item.id, status: 'soldout' };
  return { id: item.id, status: 'ok' };
}

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

const tally = {};
for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
console.log('sweep:', JSON.stringify(tally));

// blocked/error are UNKNOWN, not unavailable — never gate on them.
const unavailable = results.filter((r) => r.status === 'dead' || r.status === 'soldout').map((r) => r.id).sort();
writeFileSync(HEALTH_PATH, JSON.stringify({
  generatedAt: new Date().toISOString(),
  checked: results.length,
  note: 'regenerate with: npm run health:sweep',
  unavailable,
}, null, 1) + '\n');
console.log(`gated ${unavailable.length} dead/sold-out ids -> data/catalog-health.json`);

const drifted = new Map(results
  .filter((r) => r.status === 'ok' && r.livePrice && r.catPrice && Math.abs(r.livePrice - r.catPrice) > Math.max(100, r.catPrice * 0.02))
  .map((r) => [r.id, r.livePrice]));
if (drifted.size) {
  for (const p of catalog) if (drifted.has(p.id)) p.priceCents = drifted.get(p.id);
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 1) + '\n');
  console.log(`patched ${drifted.size} drifted prices -> data/client-catalog.json`);
}
