import { searchBrandCatalog } from '../lib/brand-catalog';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { parseSearchIntentHeuristic } from '../lib/claude';
import { searchPhotoCatalog } from '../lib/photo-catalog';
import {
  filterRenderableProducts,
  hasCategoryTitleMismatch,
  hasUsableImageUrl,
  isBlockedProductImage,
  productImageQualityScore,
  searchResultQualityScore,
  sortSearchResultProducts,
} from '../lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

const SUSPICIOUS_TERMS = [
  'placeholder',
  'fallback',
  'blank',
  'transparent',
  'spacer',
  'pixel',
  'loading',
  'skeleton',
  'no-image',
  'coming-soon',
  'default',
];

function isCategory(value: string | undefined): value is Category {
  return Boolean(value && CATEGORY_ORDER.includes(value as Category));
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const deduped: Product[] = [];
  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    deduped.push(product);
  }
  return deduped;
}

function isSuspiciousImageUrl(imageUrl?: string): boolean {
  const normalized = String(imageUrl || '').toLowerCase();
  return !normalized
    || normalized.startsWith('data:')
    || normalized.endsWith('.svg')
    || SUSPICIOUS_TERMS.some((term) => normalized.includes(term));
}

function hostOf(url?: string): string {
  if (!url) return 'missing';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'invalid';
  }
}

const [queryArg, categoryArg] = process.argv.slice(2);
const query = (queryArg || '').trim();
const forcedCategory = isCategory(categoryArg) ? categoryArg : undefined;
const intent = parseSearchIntentHeuristic(query, forcedCategory);
const category = forcedCategory || intent.category;

const searchedCandidates = dedupeProducts([
  ...searchPhotoCatalog(intent, query, 100),
  ...searchBrandCatalog(intent, query, 100),
]);
const fallbackCategoryPool = ALL_CATALOG_PRODUCTS.filter((product) => product.category === category);
const rawCandidates = searchedCandidates.length ? searchedCandidates : fallbackCategoryPool;
const categoryFiltered = rawCandidates.filter((product) => product.category === category);
const staticImageFiltered = filterRenderableProducts(categoryFiltered);
const rankedImageFiltered = sortSearchResultProducts(categoryFiltered, query, category);
const badStatic = categoryFiltered.filter((product) => !hasUsableImageUrl(product.imageUrl));
const suspicious = categoryFiltered.filter((product) => isSuspiciousImageUrl(product.imageUrl));
const blocked = categoryFiltered.filter(isBlockedProductImage);
const categoryMismatches = categoryFiltered.filter(hasCategoryTitleMismatch);
const marketplaceResults = categoryFiltered.filter((product) => /poshmark|ebay|etsy|depop|mercari|grailed|thredup|vestiaire/i.test([
  product.brand,
  product.retailer,
  product.name,
  product.productUrl,
  product.retailerUrl,
  product.googleShoppingUrl,
  product.fallbackUrl,
].filter(Boolean).join(' ')));
const badBySource = new Map<string, number>();

for (const product of badStatic) {
  const host = hostOf(product.imageUrl);
  badBySource.set(host, (badBySource.get(host) || 0) + 1);
}

console.log('Local catalog search audit');
console.log(`Query: ${query || '(blank)'}`);
console.log(`Category: ${category}`);
console.log(`Raw candidates count: ${rawCandidates.length}`);
console.log(`After category filter count: ${categoryFiltered.length}`);
console.log(`After static image filter count: ${staticImageFiltered.length}`);
console.log(`After quality-ranked image filter count: ${rankedImageFiltered.length}`);
console.log(`Suspicious/bad image count: ${suspicious.length}/${categoryFiltered.length}`);
console.log(`Blocked image/product count: ${blocked.length}/${categoryFiltered.length}`);
console.log(`Category mismatch warnings: ${categoryMismatches.length}/${categoryFiltered.length}`);
console.log(`Marketplace/reseller candidates: ${marketplaceResults.length}/${categoryFiltered.length}`);

if (badBySource.size) {
  console.log('\nBad static image URLs by source');
  for (const [source, count] of Array.from(badBySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`- ${source}: ${count}`);
  }
}

console.log('\nTop image-backed candidates');
for (const product of rankedImageFiltered.slice(0, 10)) {
  const score = productImageQualityScore(product);
  const searchScore = searchResultQualityScore(product, query, category);
  const marketplace = marketplaceResults.some((entry) => entry.id === product.id) ? ' marketplace-penalty' : '';
  console.log(`- score=${score} searchScore=${searchScore}${marketplace} | ${product.brand} | ${product.name} | ${product.category} | ${product.imageUrl}`);
}

if (categoryMismatches.length) {
  console.log('\nCategory/title mismatch samples');
  for (const product of categoryMismatches.slice(0, 8)) {
    console.log(`- ${product.category} | ${product.brand} | ${product.name}`);
  }
}

if (!rankedImageFiltered.length) {
  console.log('\nNo static image-backed candidates found. The UI should show the clean empty state.');
}
