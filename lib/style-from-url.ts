import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { isIP } from 'node:net';
import clientCatalogData from '../data/client-catalog.json';
import catalogHealthData from '../data/catalog-health.json';
import {
  evaluateProductPublishability,
  type CatalogHealthSnapshot,
} from './catalog-publishability';
import {
  STYLE_OWNED_METADATA_KEY,
  isVerifiedStyleOwnedProduct,
  type StyleOwnedVerification,
} from './style-owned-product';
import { isEditorialCutoutProduct } from './product-image-quality';
import type { Category, Product } from './types';
import {
  STYLE_FROM_URL_MAX_URL_LENGTH,
  StyleFromUrlError,
  canonicalStyleUrlKey,
  categoryFromStructuredValue,
  isPrivateOrReservedAddress,
  looksLikeExactStyleProductPage,
  normalizeHttpsStyleUrl,
  normalizeRetailerHost,
  normalizeStyleProductUrl,
  priceCentsFromStructuredValue,
  sameStyleProductPath,
  structuredAvailabilityIsInStock,
  styleFromUrlError,
  type StyleFromUrlErrorCode,
} from './style-from-url-policy';

export {
  StyleFromUrlError,
  canonicalStyleUrlKey,
  isPrivateOrReservedAddress,
  normalizeRetailerHost,
  normalizeStyleProductUrl,
};
export type { StyleFromUrlErrorCode };

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 2;
const DEFAULT_TIMEOUT_MS = 4_500;
const DEFAULT_MAX_HTML_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VERIFICATION_FUTURE_SKEW_MS = 5 * 60 * 1000;

function boundedEnvNumber(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback;
}

const REQUEST_TIMEOUT_MS = boundedEnvNumber('STYLE_FROM_URL_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, 1_000, 10_000);
const MAX_HTML_BYTES = boundedEnvNumber(
  'STYLE_FROM_URL_MAX_HTML_BYTES',
  DEFAULT_MAX_HTML_BYTES,
  64 * 1024,
  1024 * 1024,
);

function error(code: StyleFromUrlErrorCode, status: number, message: string): never {
  return styleFromUrlError(code, status, message);
}

function catalogProductHasExactUrl(product: Product): boolean {
  return [product.productUrl, product.retailerUrl].some((candidate) => {
    if (!candidate) return false;
    try {
      return looksLikeExactStyleProductPage(normalizeHttpsStyleUrl(candidate));
    } catch {
      return false;
    }
  });
}

/**
 * Turn a reviewed catalog row into a currently serveable Style What I Own
 * match. Availability is evaluated at call time rather than module load so a
 * warm server instance cannot keep accepting a row after its 24-hour evidence
 * expires.
 */
export function verifiedStyleCatalogProduct(
  product: Product,
  health: CatalogHealthSnapshot,
  now = Date.now(),
): Product | null {
  if (!isEditorialCutoutProduct(product) || !catalogProductHasExactUrl(product)) {
    return null;
  }
  const evaluation = evaluateProductPublishability(product, {
    health,
    freshnessPolicy: 'require-fresh',
    now,
  });
  if (
    !evaluation.publishable
    || evaluation.evidence.health !== 'available'
    || !evaluation.evidence.checkedAt
  ) {
    return null;
  }
  const checkedAtMs = Date.parse(evaluation.evidence.checkedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs - now > MAX_VERIFICATION_FUTURE_SKEW_MS) return null;
  return {
    ...product,
    inStock: true,
    availabilityState: 'in_stock',
    lastVerifiedAt: evaluation.evidence.checkedAt,
  };
}

const CATALOG_HEALTH = catalogHealthData as CatalogHealthSnapshot;
const CATALOG_CANDIDATES = (clientCatalogData as Product[]).filter((product) =>
  isEditorialCutoutProduct(product)
  && catalogProductHasExactUrl(product),
);
const CATALOG_URL_INDEX = new Map<string, Product[]>();
const RETAILER_PRODUCTS_BY_HOST = new Map<string, Product[]>();
const IMAGE_PRODUCTS_BY_HOST = new Map<string, Product[]>();

function addHostCandidate(index: Map<string, Product[]>, host: string, product: Product): void {
  const current = index.get(host) || [];
  if (!current.some((candidate) => candidate.id === product.id)) current.push(product);
  index.set(host, current);
}

for (const product of CATALOG_CANDIDATES) {
  for (const candidate of [product.productUrl, product.retailerUrl]) {
    if (!candidate) continue;
    try {
      const parsed = normalizeHttpsStyleUrl(candidate);
      if (!looksLikeExactStyleProductPage(parsed)) continue;
      const host = normalizeRetailerHost(parsed.hostname);
      addHostCandidate(RETAILER_PRODUCTS_BY_HOST, host, product);
      const key = canonicalStyleUrlKey(parsed.toString());
      const indexed = CATALOG_URL_INDEX.get(key) || [];
      if (!indexed.some((candidateProduct) => candidateProduct.id === product.id)) indexed.push(product);
      CATALOG_URL_INDEX.set(key, indexed);
    } catch {
      // Generated catalog data is not allowed to weaken the request boundary.
    }
  }
  for (const candidate of [product.imageUrl, product.imageTransparentUrl, product.imageCutoutUrl]) {
    if (!candidate?.startsWith('https://')) continue;
    try {
      addHostCandidate(IMAGE_PRODUCTS_BY_HOST, normalizeRetailerHost(new URL(candidate).hostname), product);
    } catch {
      // Ignore malformed catalog image metadata.
    }
  }
}

function hasCurrentCandidate(index: Map<string, Product[]>, hostname: string, now = Date.now()): boolean {
  return Boolean(index.get(normalizeRetailerHost(hostname))?.some((product) =>
    verifiedStyleCatalogProduct(product, CATALOG_HEALTH, now),
  ));
}

export function isAllowedStyleRetailerHost(hostname: string, now = Date.now()): boolean {
  return hasCurrentCandidate(RETAILER_PRODUCTS_BY_HOST, hostname, now);
}

function isAllowedStyleImageHost(hostname: string, now = Date.now()): boolean {
  return hasCurrentCandidate(IMAGE_PRODUCTS_BY_HOST, hostname, now)
    || isAllowedStyleRetailerHost(hostname, now);
}

function retailerLabelForHost(hostname: string, now = Date.now()): string | null {
  const products = RETAILER_PRODUCTS_BY_HOST.get(normalizeRetailerHost(hostname)) || [];
  for (const product of products) {
    if (verifiedStyleCatalogProduct(product, CATALOG_HEALTH, now) && product.retailer?.trim()) {
      return product.retailer.trim();
    }
  }
  return null;
}

export function findCatalogProductByStyleUrl(input: string, now = Date.now()): Product | null {
  try {
    const candidates = CATALOG_URL_INDEX.get(canonicalStyleUrlKey(input)) || [];
    for (const product of candidates) {
      const verified = verifiedStyleCatalogProduct(product, CATALOG_HEALTH, now);
      if (verified) return verified;
    }
    return null;
  } catch {
    return null;
  }
}

function stableOwnedProductId(canonicalUrl: string): string {
  return `owned-${createHash('sha256').update(canonicalStyleUrlKey(canonicalUrl)).digest('hex').slice(0, 20)}`;
}

/** Convert a strict, fresh-positive catalog match into the same persisted
 * already-owned boundary used for unknown structured products. The catalog ID
 * remains in verification metadata for audit/re-resolution, while shopping
 * surfaces see only the stable `owned-*` anchor and therefore omit its CTA. */
export function styleOwnedProductFromCatalogMatch(
  catalogProduct: Product,
  canonicalUrlInput: string,
): (Product & { productUrl: string; retailerUrl: string }) | null {
  let canonicalUrl: string;
  let retailerHost: string;
  try {
    canonicalUrl = normalizeStyleProductUrl(canonicalUrlInput);
    retailerHost = normalizeRetailerHost(new URL(canonicalUrl).hostname);
  } catch {
    return null;
  }
  const canonicalKey = canonicalStyleUrlKey(canonicalUrl);
  const exactCatalogUrlMatch = [catalogProduct.productUrl, catalogProduct.retailerUrl].some((candidate) => {
    if (!candidate) return false;
    try {
      return canonicalStyleUrlKey(candidate) === canonicalKey;
    } catch {
      return false;
    }
  });
  if (
    !catalogProduct.lastVerifiedAt
    || !catalogProductHasExactUrl(catalogProduct)
    || !exactCatalogUrlMatch
  ) {
    return null;
  }
  const verification: StyleOwnedVerification = {
    version: 1,
    verified: true,
    source: 'catalog-match',
    sourceCatalogProductId: catalogProduct.id,
    canonicalUrl,
    retailerHost,
    availability: 'InStock',
    imageVerified: true,
    verifiedAt: catalogProduct.lastVerifiedAt,
  };
  const ownedProduct: Product & { productUrl: string; retailerUrl: string } = {
    ...catalogProduct,
    id: stableOwnedProductId(canonicalUrl),
    productUrl: canonicalUrl,
    retailerUrl: canonicalUrl,
    metadata: {
      ...catalogProduct.metadata,
      source: 'style_from_url',
      [STYLE_OWNED_METADATA_KEY]: verification,
    },
  };
  return isVerifiedStyleOwnedProduct(ownedProduct) ? ownedProduct : null;
}

function validateAllowedUrl(input: string | URL, kind: 'product' | 'image'): URL {
  const parsed = normalizeHttpsStyleUrl(input.toString());
  const host = normalizeRetailerHost(parsed.hostname);
  const hostAllowed = kind === 'product'
    ? isAllowedStyleRetailerHost(host)
    : isAllowedStyleImageHost(host);
  if (!hostAllowed) {
    return error(
      kind === 'product' ? 'retailer_not_supported' : 'image_unverified',
      422,
      kind === 'product'
        ? 'That retailer is not supported yet. Try an exact product page from a retailer already shown in Sylistly.'
        : 'The retailer image could not be verified safely.',
    );
  }
  if (kind === 'product' && !looksLikeExactStyleProductPage(parsed)) {
    return error('exact_url_unverified', 422, 'Paste an exact product page, not a homepage, search, sale, or collection page.');
  }
  if (isIP(parsed.hostname) && isPrivateOrReservedAddress(parsed.hostname)) {
    return error('unsafe_destination', 400, 'That destination is not a public retailer host.');
  }
  return parsed;
}

export function validateStyleProductUrl(input: string): URL {
  return validateAllowedUrl(input, 'product');
}

interface SafeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  if (isIP(hostname)) {
    if (isPrivateOrReservedAddress(hostname)) {
      return error('unsafe_destination', 400, 'That destination is not a public retailer host.');
    }
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new StyleFromUrlError('upstream_timeout', 504, 'The retailer took too long to verify. Try again.')),
          REQUEST_TIMEOUT_MS,
        );
      }),
    ]);
    if (!records.length || records.some((record) => isPrivateOrReservedAddress(record.address))) {
      return error('unsafe_destination', 400, 'That destination did not resolve to a public retailer address.');
    }
    const selected = records.find((record) => record.family === 4) || records[0];
    return { address: selected.address, family: selected.family as 4 | 6 };
  } catch (cause) {
    if (cause instanceof StyleFromUrlError) throw cause;
    return error('upstream_unavailable', 502, 'The retailer could not be reached safely. Try again later.');
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function requestPinned(
  url: URL,
  options: { method: 'GET' | 'HEAD'; maxBytes: number; headerOnly?: boolean; imageRange?: boolean },
): Promise<SafeResponse> {
  const resolved = await resolvePublicAddress(url.hostname);
  const pinnedLookup = ((
    _hostname: string,
    lookupOptions: unknown,
    callback: (...args: unknown[]) => void,
  ) => {
    const wantsAll = Boolean(lookupOptions && typeof lookupOptions === 'object' && 'all' in lookupOptions && lookupOptions.all);
    if (wantsAll) {
      callback(null, [{ address: resolved.address, family: resolved.family }]);
      return;
    }
    callback(null, resolved.address, resolved.family);
  }) as RequestOptions['lookup'];

  return new Promise<SafeResponse>((resolve, reject) => {
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | null = null;
    const clearDeadline = () => {
      if (deadline) clearTimeout(deadline);
      deadline = null;
    };
    const finish = (result: SafeResponse) => {
      if (settled) return;
      settled = true;
      clearDeadline();
      resolve(result);
    };
    const fail = (cause: unknown) => {
      if (settled) return;
      settled = true;
      clearDeadline();
      reject(cause);
    };
    const request = httpsRequest(url, {
      method: options.method,
      agent: false,
      lookup: pinnedLookup,
      servername: url.hostname,
      headers: {
        accept: options.headerOnly
          ? 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1'
          : 'text/html,application/xhtml+xml;q=0.9',
        'accept-encoding': 'identity',
        'cache-control': 'no-cache',
        ...(options.imageRange ? { range: 'bytes=0-2047' } : {}),
        'user-agent': 'SylistlyProductVerifier/1.0 (+https://www.sylistly.com)',
      },
    }, (response) => {
      const headers = Object.fromEntries(
        Object.entries(response.headers).flatMap(([key, value]) => {
          if (Array.isArray(value)) return [[key.toLowerCase(), value.join(', ')]];
          return typeof value === 'string' ? [[key.toLowerCase(), value]] : [];
        }),
      );
      const status = response.statusCode || 0;
      if (REDIRECT_STATUSES.has(status)) {
        finish({ status, headers, body: '' });
        response.destroy();
        return;
      }
      const declaredLength = Number(headers['content-length'] || 0);
      if (declaredLength > options.maxBytes) {
        response.destroy();
        fail(new StyleFromUrlError('response_too_large', 413, 'The retailer response is too large to verify safely.'));
        return;
      }
      if (options.headerOnly) {
        finish({ status, headers, body: '' });
        response.destroy();
        return;
      }

      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buffer.byteLength;
        if (received > options.maxBytes) {
          response.destroy();
          fail(new StyleFromUrlError('response_too_large', 413, 'The retailer response is too large to verify safely.'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => finish({ status, headers, body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', fail);
    });

    // `request.setTimeout` is an inactivity timer. Keep a separate absolute
    // deadline so a server cannot hold the verifier open by trickling bytes.
    deadline = setTimeout(() => {
      request.destroy(new StyleFromUrlError('upstream_timeout', 504, 'The retailer took too long to verify. Try again.'));
    }, REQUEST_TIMEOUT_MS);
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new StyleFromUrlError('upstream_timeout', 504, 'The retailer took too long to verify. Try again.'));
    });
    request.on('error', (cause) => {
      if (cause instanceof StyleFromUrlError) fail(cause);
      else fail(new StyleFromUrlError('upstream_unavailable', 502, 'The retailer could not be reached safely. Try again later.'));
    });
    request.end();
  });
}

async function requestWithRedirects(
  input: URL,
  kind: 'product' | 'image',
  options: { method: 'GET' | 'HEAD'; maxBytes: number; headerOnly?: boolean; imageRange?: boolean },
): Promise<{ response: SafeResponse; finalUrl: URL }> {
  let current = validateAllowedUrl(input, kind);
  const visited = new Set<string>();
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const key = current.toString();
    if (visited.has(key)) {
      return error('upstream_unavailable', 502, 'The retailer returned an unsafe redirect loop.');
    }
    visited.add(key);
    const response = await requestPinned(current, options);
    if (!REDIRECT_STATUSES.has(response.status)) return { response, finalUrl: current };
    const location = response.headers.location;
    if (!location || redirectCount === MAX_REDIRECTS) {
      return error('upstream_unavailable', 502, 'The retailer redirected too many times to verify safely.');
    }
    current = validateAllowedUrl(normalizeHttpsStyleUrl(location, current), kind);
  }
  return error('upstream_unavailable', 502, 'The retailer could not be verified.');
}

async function fetchProductHtml(input: URL): Promise<{ html: string; finalUrl: URL }> {
  const { response, finalUrl } = await requestWithRedirects(input, 'product', {
    method: 'GET',
    maxBytes: MAX_HTML_BYTES,
  });
  if (response.status < 200 || response.status >= 300) {
    return error('upstream_unavailable', 502, 'The retailer product page could not be opened.');
  }
  const contentType = response.headers['content-type']?.toLowerCase() || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return error('unsupported_response', 422, 'That link did not return a retailer product page.');
  }
  return { html: response.body, finalUrl };
}

async function verifyImage(input: URL): Promise<URL> {
  let result = await requestWithRedirects(input, 'image', {
    method: 'HEAD',
    maxBytes: MAX_IMAGE_BYTES,
    headerOnly: true,
  });
  if (result.response.status === 405 || result.response.status === 501) {
    result = await requestWithRedirects(input, 'image', {
      method: 'GET',
      maxBytes: MAX_IMAGE_BYTES,
      headerOnly: true,
      imageRange: true,
    });
  }
  if (result.response.status < 200 || result.response.status >= 300) {
    return error('image_unverified', 422, 'The product image could not be verified.');
  }
  const contentType = result.response.headers['content-type']?.toLowerCase() || '';
  if (!/^image\/(avif|gif|jpeg|jpg|png|webp)(?:;|$)/.test(contentType)) {
    return error('image_unverified', 422, 'The structured product image was not a supported image.');
  }
  return result.finalUrl;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (isRecord(value)) {
    for (const key of ['name', 'value', 'url', 'contentUrl', '@id']) {
      if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
  }
  return null;
}

function schemaTypeIncludes(value: unknown, expected: string): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some((entry) => typeof entry === 'string' && entry.split(/[\/#]/).pop()?.toLowerCase() === expected.toLowerCase());
}

function collectProductNodes(value: unknown, output: Record<string, unknown>[], depth = 0): void {
  if (depth > 4 || output.length >= 64) return;
  if (Array.isArray(value)) {
    for (const entry of value) collectProductNodes(entry, output, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  if (schemaTypeIncludes(value['@type'], 'Product')) output.push(value);
  for (const key of ['@graph', 'mainEntity', 'hasVariant']) {
    if (value[key]) collectProductNodes(value[key], output, depth + 1);
  }
}

function extractJsonLdProducts(html: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  let scriptCount = 0;
  while ((match = scriptPattern.exec(html)) && scriptCount < 32) {
    scriptCount += 1;
    if (!/\btype\s*=\s*(?:["']\s*application\/ld\+json(?:\s*;[^"']*)?\s*["']|application\/ld\+json\b)/i.test(match[1])) continue;
    const source = match[2].trim().replace(/^\uFEFF/, '');
    if (!source || source.length > 160 * 1024) continue;
    try {
      collectProductNodes(JSON.parse(source), products);
    } catch {
      // Malformed or non-JSON scripts are ignored; never eval or scrape prose.
    }
  }
  return products;
}

function structuredCategoryValues(node: Record<string, unknown>): string[] {
  const output: string[] = [];
  for (const value of [node.category, node.productCategory, node.productType]) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      const text = readText(entry);
      if (text) output.push(text);
    }
  }
  const additional = Array.isArray(node.additionalProperty) ? node.additionalProperty : [node.additionalProperty];
  for (const entry of additional) {
    if (!isRecord(entry)) continue;
    const name = readText(entry.name)?.toLowerCase();
    if (name !== 'category' && name !== 'product category' && name !== 'product type') continue;
    const value = readText(entry.value);
    if (value) output.push(value);
  }
  return output;
}

interface VerifiedOffer {
  priceCents: number;
  currency: 'USD';
  url: string | null;
  seller: string | null;
}

function verifiedOfferFromNode(node: Record<string, unknown>): VerifiedOffer {
  const rawOffers = Array.isArray(node.offers) ? node.offers : [node.offers];
  const available: VerifiedOffer[] = [];
  for (const raw of rawOffers) {
    if (!isRecord(raw)) continue;
    const priceSpec = isRecord(raw.priceSpecification) ? raw.priceSpecification : {};
    const priceCents = priceCentsFromStructuredValue(raw.price ?? priceSpec.price);
    const currency = readText(raw.priceCurrency ?? priceSpec.priceCurrency)?.toUpperCase();
    if (!structuredAvailabilityIsInStock(raw.availability ?? node.availability)) continue;
    if (currency !== 'USD') {
      if (priceCents) return error('currency_unsupported', 422, 'Only explicitly USD-priced items can be styled right now.');
      continue;
    }
    if (!priceCents) continue;
    available.push({
      priceCents,
      currency: 'USD',
      url: readText(raw.url),
      seller: readText(raw.seller),
    });
  }
  if (!available.length) {
    const hasOfferRecord = rawOffers.some(isRecord);
    const hasExplicitAvailability = node.availability != null
      || rawOffers.some((raw) => isRecord(raw) && raw.availability != null);
    const hasExplicitInStock = rawOffers.some((raw) =>
      isRecord(raw) && structuredAvailabilityIsInStock(raw.availability ?? node.availability),
    ) || (!hasOfferRecord && structuredAvailabilityIsInStock(node.availability));
    const missingAvailability = !hasExplicitAvailability || !hasExplicitInStock;
    return error(
      missingAvailability ? 'availability_unverified' : 'price_unverified',
      422,
      missingAvailability
        ? 'The retailer did not explicitly confirm this item is in stock.'
        : 'A current USD price could not be verified from the retailer’s structured product data.',
    );
  }
  const prices = new Set(available.map((offer) => offer.priceCents));
  if (prices.size !== 1) {
    return error('price_unverified', 422, 'This page has multiple variant prices, so an exact current price could not be verified.');
  }
  return available[0];
}

function structuredImageUrl(node: Record<string, unknown>, base: URL): URL {
  const rawImages = Array.isArray(node.image) ? node.image : [node.image];
  for (const raw of rawImages) {
    const candidate = isRecord(raw)
      ? readText(raw.contentUrl) || readText(raw.url) || readText(raw['@id'])
      : readText(raw);
    if (!candidate) continue;
    try {
      return validateAllowedUrl(normalizeHttpsStyleUrl(candidate, base), 'image');
    } catch {
      // Try another explicitly structured image, if present.
    }
  }
  return error('image_unverified', 422, 'No supported product image was present in the retailer’s structured product data.');
}

export interface ParsedStructuredProduct {
  name: string;
  brand: string;
  category: Category;
  priceCents: number;
  currency: 'USD';
  canonicalUrl: URL;
  imageUrl: URL;
  retailer: string;
}

export function parseStructuredProduct(html: string, pageUrlInput: string): ParsedStructuredProduct {
  const pageUrl = validateAllowedUrl(pageUrlInput, 'product');
  const nodes = extractJsonLdProducts(html);
  if (!nodes.length) {
    return error('structured_product_missing', 422, 'No structured Product data was found on that page. Try another exact retailer product link.');
  }

  let lastError: StyleFromUrlError | null = null;
  for (const node of nodes) {
    try {
      const offer = verifiedOfferFromNode(node);
      const rawCanonical = readText(node.url)
        || offer.url
        || (isRecord(node.mainEntityOfPage) ? readText(node.mainEntityOfPage) : null);
      if (!rawCanonical) {
        return error('exact_url_unverified', 422, 'The structured product data did not include an exact canonical product URL.');
      }
      const canonicalUrl = validateAllowedUrl(normalizeHttpsStyleUrl(rawCanonical, pageUrl), 'product');
      if (!sameStyleProductPath(canonicalUrl, pageUrl)) {
        return error('exact_url_unverified', 422, 'The structured product URL did not match the page you pasted.');
      }
      const name = readText(node.name);
      if (!name || name.length < 2 || name.length > 220) {
        return error('name_unverified', 422, 'The retailer did not provide a verifiable product name.');
      }
      const brand = readText(node.brand);
      if (!brand || brand.length < 2 || brand.length > 120) {
        return error('brand_unverified', 422, 'The retailer did not provide a verifiable brand.');
      }
      const categoryMatches = Array.from(new Set(structuredCategoryValues(node).map(categoryFromStructuredValue).filter((value): value is Category => Boolean(value))));
      if (categoryMatches.length !== 1) {
        return error('category_unverified', 422, 'The retailer did not provide one clear supported clothing category.');
      }
      const retailerHost = normalizeRetailerHost(canonicalUrl.hostname);
      // The site host is the retailer identity. A page-controlled Offer seller
      // may be a marketplace merchant and must not override the reviewed label.
      const retailer = retailerLabelForHost(retailerHost);
      if (!retailer) {
        return error('retailer_not_supported', 422, 'The retailer identity could not be verified from the existing catalog.');
      }
      return {
        name,
        brand,
        category: categoryMatches[0],
        priceCents: offer.priceCents,
        currency: offer.currency,
        canonicalUrl,
        imageUrl: structuredImageUrl(node, pageUrl),
        retailer,
      };
    } catch (cause) {
      if (cause instanceof StyleFromUrlError) lastError = cause;
    }
  }
  throw lastError || new StyleFromUrlError('structured_product_missing', 422, 'A complete structured Product record could not be verified.');
}

export interface StyleFromUrlResult {
  source: 'catalog' | 'structured-product';
  product: Product;
  canonicalUrl: string;
}

export async function resolveStyleFromUrl(input: string): Promise<StyleFromUrlResult> {
  const normalizedInput = normalizeStyleProductUrl(input);
  const catalogProduct = findCatalogProductByStyleUrl(normalizedInput);
  if (catalogProduct) {
    const ownedProduct = styleOwnedProductFromCatalogMatch(catalogProduct, normalizedInput);
    if (!ownedProduct) {
      return error('structured_product_missing', 422, 'That catalog match could not be verified as an owned item right now.');
    }
    return {
      source: 'catalog',
      product: ownedProduct,
      canonicalUrl: ownedProduct.productUrl,
    };
  }

  const requestedUrl = validateStyleProductUrl(normalizedInput);
  const { html, finalUrl } = await fetchProductHtml(requestedUrl);
  const parsed = parseStructuredProduct(html, finalUrl.toString());
  const imageUrl = await verifyImage(parsed.imageUrl);
  const canonicalUrl = parsed.canonicalUrl.toString();
  const verifiedAt = new Date().toISOString();
  const verification: StyleOwnedVerification = {
    version: 1,
    verified: true,
    source: 'structured-product',
    canonicalUrl,
    retailerHost: normalizeRetailerHost(parsed.canonicalUrl.hostname),
    availability: 'InStock',
    imageVerified: true,
    verifiedAt,
  };
  const product: Product = {
    id: stableOwnedProductId(canonicalUrl),
    brand: parsed.brand,
    name: parsed.name,
    category: parsed.category,
    priceCents: parsed.priceCents,
    currency: parsed.currency,
    retailer: parsed.retailer,
    retailerUrl: canonicalUrl,
    productUrl: canonicalUrl,
    imageUrl: imageUrl.toString(),
    imageSource: 'merchant',
    imageStatus: 'original',
    imageQuality: 'ok',
    inStock: true,
    trusted: true,
    availabilityState: 'in_stock',
    lastVerifiedAt: verifiedAt,
    metadata: {
      source: 'style_from_url',
      [STYLE_OWNED_METADATA_KEY]: verification,
    },
  };
  return { source: 'structured-product', product, canonicalUrl };
}

export const STYLE_FROM_URL_LIMITS = Object.freeze({
  maxUrlLength: STYLE_FROM_URL_MAX_URL_LENGTH,
  maxRedirects: MAX_REDIRECTS,
  maxHtmlBytes: MAX_HTML_BYTES,
  timeoutMs: REQUEST_TIMEOUT_MS,
});
