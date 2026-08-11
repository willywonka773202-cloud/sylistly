#!/usr/bin/env node
/**
 * Independent, offline acceptance check for data/outfit-library.json.
 *
 * It deliberately re-derives link quality, health freshness, completeness,
 * signatures, duplicates, and whole-look totals instead of trusting the
 * generator's report. No network calls are made.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const library = JSON.parse(readFileSync(join(ROOT, 'data/outfit-library.json'), 'utf8'));
const report = JSON.parse(readFileSync(join(ROOT, 'data/outfit-library-report.json'), 'utf8'));
const catalogPayload = JSON.parse(readFileSync(join(ROOT, 'data/client-catalog.json'), 'utf8'));
const health = JSON.parse(readFileSync(join(ROOT, 'data/catalog-health.json'), 'utf8'));
const catalog = Array.isArray(catalogPayload)
  ? catalogPayload
  : catalogPayload.products || Object.values(catalogPayload)[0];

const REQUIRED = ['top', 'bottom', 'shoes'];
const EXPECTED_VIBES = ['clean', 'street', 'office', 'date', 'gym', 'cozy', 'vacation', 'preppy', 'night', 'edgy'];
const EXPECTED_FRAMES = ['androgynous', 'fem', 'masc'];
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const TARGET_UNIQUE_SIGNATURES = 24_000;
const TARGET_PER_COMBO = 800;
const errors = [];

function searchOrAggregator(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase();
    const params = parsed.searchParams;
    const hash = parsed.hash.toLowerCase();
    const nordstromPdp = (hostname === 'nordstrom.com' || hostname === 'nordstromrack.com')
      && /^\/s\/[^/]+\/\d+/.test(pathname);
    if (hostname.includes('google.') && (pathname.includes('/search') || pathname.includes('/shopping'))) return true;
    if (hash.includes('oshopproduct')) return true;
    if (pathname.includes('/search') || (pathname.includes('/s/') && !nordstromPdp) || pathname.includes('search-result')) return true;
    return params.has('q') || params.has('query') || params.has('search')
      || params.has('searchTerm') || params.has('text') || params.has('keyword');
  } catch {
    return true;
  }
}

function hasExactPdp(product) {
  const raw = [product?.productUrl, product?.retailerUrl]
    .find((value) => typeof value === 'string' && value.trim());
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol)
      && Boolean(parsed.pathname && parsed.pathname !== '/')
      && !searchOrAggregator(raw);
  } catch {
    return false;
  }
}

const now = Date.now();
const generatedMs = Date.parse(health.generatedAt || '');
const healthAgeMs = now - generatedMs;
if (health.schemaVersion < 2 || !health.products) errors.push('catalog health is not schema v2');
if (!Number.isFinite(generatedMs) || healthAgeMs < -MAX_FUTURE_SKEW_MS || healthAgeMs > MAX_AGE_MS) {
  errors.push('catalog health artifact is not fresh within 24 hours');
}
if (library.schemaVersion !== 2) errors.push(`unexpected library schemaVersion ${library.schemaVersion}`);
if (library.verifiedAt !== health.generatedAt) errors.push('library verifiedAt does not match catalog health generatedAt');
if (library.maxHealthAgeHours !== 24) errors.push('library does not declare the 24-hour health SLA');
if (!Array.isArray(library.slots) || !Array.isArray(library.ids) || !library.looks) {
  errors.push('library shape is invalid');
}

const catalogById = new Map(catalog.map((product) => [product.id, product]));
function strictProduct(id) {
  const product = catalogById.get(id);
  const record = health.products?.[id];
  const checkedMs = Date.parse(record?.checkedAt || '');
  const ageMs = now - checkedMs;
  return product
    && product.imageTransparentUrl
    && product.category
    && product.trusted !== false
    && product.inStock !== false
    && Number.isFinite(product.priceCents)
    && product.priceCents > 0
    && record?.outcome === 'available'
    && record.exactPdp === true
    && Number.isFinite(checkedMs)
    && ageMs >= -MAX_FUTURE_SKEW_MS
    && ageMs <= MAX_AGE_MS
    && hasExactPdp(product)
    ? product
    : null;
}

for (const id of library.ids || []) {
  if (!strictProduct(id)) errors.push(`interned product is not strict-publishable: ${id}`);
}

const signatures = new Set();
let duplicateCount = 0;
let totalRows = 0;
let totalPieces = 0;
const totalPrices = [];
const budgetBands = { lte250: 0, gt250_lte500: 0, gt500_lte1000: 0, gt1000: 0 };
const combinationCounts = {};

for (const vibe of EXPECTED_VIBES) {
  for (const frame of EXPECTED_FRAMES) {
    const rows = library.looks?.[vibe]?.[frame] || [];
    const combo = `${vibe}:${frame}`;
    combinationCounts[combo] = rows.length;
    if (rows.length !== TARGET_PER_COMBO) {
      errors.push(`${combo} has ${rows.length} rows; target is ${TARGET_PER_COMBO}`);
    }
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      totalRows += 1;
      if (!Array.isArray(row)) {
        errors.push(`${combo}[${rowIndex}] is not an array`);
        continue;
      }
      const items = {};
      let totalCents = 0;
      for (let slotIndex = 0; slotIndex < library.slots.length; slotIndex += 1) {
        const productIndex = row[slotIndex];
        if (productIndex == null || productIndex === -1) continue;
        if (!Number.isInteger(productIndex) || productIndex < 0 || productIndex >= library.ids.length) {
          errors.push(`${combo}[${rowIndex}] has invalid product index ${productIndex}`);
          continue;
        }
        const slot = library.slots[slotIndex];
        const id = library.ids[productIndex];
        const product = strictProduct(id);
        if (!product) {
          errors.push(`${combo}[${rowIndex}] includes unverified ${id}`);
          continue;
        }
        if (product.category !== slot) {
          errors.push(`${combo}[${rowIndex}] assigns ${product.category} product ${id} to ${slot}`);
        }
        items[slot] = id;
        totalPieces += 1;
        totalCents += product.priceCents;
      }
      const missing = REQUIRED.filter((slot) => !items[slot]);
      if (missing.length) errors.push(`${combo}[${rowIndex}] is missing ${missing.join(',')}`);
      const signature = Object.entries(items).sort().map(([slot, id]) => `${slot}:${id}`).join('|');
      if (signatures.has(signature)) duplicateCount += 1;
      signatures.add(signature);
      totalPrices.push(totalCents);
      if (totalCents <= 25_000) budgetBands.lte250 += 1;
      else if (totalCents <= 50_000) budgetBands.gt250_lte500 += 1;
      else if (totalCents <= 100_000) budgetBands.gt500_lte1000 += 1;
      else budgetBands.gt1000 += 1;
    }
  }
}

if (totalRows !== TARGET_UNIQUE_SIGNATURES) errors.push(`row count ${totalRows} does not equal ${TARGET_UNIQUE_SIGNATURES}`);
if (signatures.size < TARGET_UNIQUE_SIGNATURES) errors.push(`unique signatures ${signatures.size} below ${TARGET_UNIQUE_SIGNATURES}`);
if (duplicateCount !== 0) errors.push(`duplicate signatures ${duplicateCount} must be zero`);

if (report.sourceHealthGeneratedAt !== health.generatedAt) errors.push('report health timestamp mismatch');
if (report.acceptance?.totalRows !== totalRows) errors.push('report row count mismatch');
if (report.acceptance?.uniqueSignatures !== signatures.size) errors.push('report unique-signature count mismatch');
if (report.acceptance?.duplicateSignatures !== duplicateCount) errors.push('report duplicate count mismatch');
if (JSON.stringify(report.budgetBands) !== JSON.stringify(budgetBands)) errors.push('report budget-band counts mismatch');
if (report.compactArtifactBytes !== statSync(join(ROOT, 'data/outfit-library.json')).size) errors.push('report artifact byte size mismatch');

totalPrices.sort((left, right) => left - right);
const min = totalPrices[0] || 0;
const max = totalPrices.at(-1) || 0;
const avg = Math.round(totalPrices.reduce((sum, value) => sum + value, 0) / (totalPrices.length || 1));
console.log(`Outfit library: ${totalRows} rows · ${signatures.size} unique signatures · ${duplicateCount} duplicates`);
console.log(`Strict pieces checked: ${totalPieces} · artifact: ${statSync(join(ROOT, 'data/outfit-library.json')).size.toLocaleString()} bytes`);
console.log(`Budget bands: ${JSON.stringify(budgetBands)} · totals ${min}-${max} cents (avg ${avg})`);

if (errors.length) {
  console.error(`\nFAIL (${errors.length} issues)`);
  for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
  process.exit(1);
}
console.log('PASS — 24k distinct complete looks; every piece has an exact PDP and fresh positive <=24h evidence.');
