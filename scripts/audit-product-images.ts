import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { productGenderTags } from '../lib/frame-inference';
import {
  hasCategoryTitleMismatch,
  hasUsableImageUrl,
  isBlockedProductImage,
  productImageQualityScore,
} from '../lib/product-image-quality';
import type { Product } from '../lib/types';

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

function hostOf(url?: string): string {
  if (!url) return 'missing';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'invalid';
  }
}

function isSuspicious(product: Product): boolean {
  const imageUrl = String(product.imageUrl || '').toLowerCase();
  return SUSPICIOUS_TERMS.some((term) => imageUrl.includes(term))
    || imageUrl.startsWith('data:')
    || imageUrl.endsWith('.svg');
}

const totals = {
  total: ALL_CATALOG_PRODUCTS.length,
  missing: 0,
  unusable: 0,
  suspicious: 0,
  blocked: 0,
  categoryMismatch: 0,
  missingGender: 0,
  lowScore: 0,
};
const bySource = new Map<string, number>();
const byCategory = new Map<string, { total: number; bad: number }>();
const byRetailer = new Map<string, { total: number; bad: number; lowScore: number }>();
const imageUrls = new Map<string, Product[]>();

for (const product of ALL_CATALOG_PRODUCTS) {
  const category = byCategory.get(product.category) || { total: 0, bad: 0 };
  category.total += 1;
  byCategory.set(product.category, category);

  if (!product.imageUrl) totals.missing += 1;
  if (!hasUsableImageUrl(product.imageUrl)) {
    totals.unusable += 1;
    category.bad += 1;
    const host = hostOf(product.imageUrl);
    bySource.set(host, (bySource.get(host) || 0) + 1);
  }
  if (isSuspicious(product)) totals.suspicious += 1;
  if (isBlockedProductImage(product)) totals.blocked += 1;
  if (hasCategoryTitleMismatch(product)) totals.categoryMismatch += 1;
  if (!productGenderTags(product).length) totals.missingGender += 1;
  if (productImageQualityScore(product) < 0) totals.lowScore += 1;

  const retailer = product.retailer || product.brand || 'unknown';
  const retailerCounts = byRetailer.get(retailer) || { total: 0, bad: 0, lowScore: 0 };
  retailerCounts.total += 1;
  if (!hasUsableImageUrl(product.imageUrl) || isBlockedProductImage(product)) retailerCounts.bad += 1;
  if (productImageQualityScore(product) < 0) retailerCounts.lowScore += 1;
  byRetailer.set(retailer, retailerCounts);

  if (product.imageUrl) {
    const list = imageUrls.get(product.imageUrl) || [];
    list.push(product);
    imageUrls.set(product.imageUrl, list);
  }
}

console.log('Product image audit');
console.log(`Total products: ${totals.total}`);
console.log(`Missing imageUrl: ${totals.missing}`);
console.log(`Unusable static imageUrl: ${totals.unusable}`);
console.log(`Suspicious imageUrl: ${totals.suspicious}`);
console.log(`Blocked image/product patterns: ${totals.blocked}`);
console.log(`Category/title mismatches: ${totals.categoryMismatch}`);
console.log(`Products with missing inferred gender/frame: ${totals.missingGender}`);
console.log(`Products with negative quality score: ${totals.lowScore}`);

console.log('\nBad image URLs by source');
for (const [source, count] of Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`- ${source}: ${count}`);
}

console.log('\nWeakest image coverage by category');
for (const [category, counts] of Array.from(byCategory.entries()).sort((a, b) => (b[1].bad / b[1].total) - (a[1].bad / a[1].total))) {
  const rate = counts.total ? Math.round((counts.bad / counts.total) * 100) : 0;
  console.log(`- ${category}: ${counts.bad}/${counts.total} bad (${rate}%)`);
}

const repeatedImages = Array.from(imageUrls.entries())
  .filter(([, products]) => products.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log('\nRepeated image URLs');
console.log(`Repeated image URL groups: ${repeatedImages.length}`);
for (const [url, products] of repeatedImages.slice(0, 8)) {
  console.log(`- ${products.length} uses | ${url.slice(0, 96)}${url.length > 96 ? '...' : ''}`);
  for (const product of products.slice(0, 3)) {
    console.log(`  - ${product.category} | ${product.brand} | ${product.name}`);
  }
}

console.log('\nRetailers/sources with weakest image quality');
for (const [retailer, counts] of Array.from(byRetailer.entries())
  .filter(([, counts]) => counts.bad || counts.lowScore)
  .sort((a, b) => (b[1].bad + b[1].lowScore) - (a[1].bad + a[1].lowScore))
  .slice(0, 12)) {
  console.log(`- ${retailer}: bad=${counts.bad}/${counts.total}, lowScore=${counts.lowScore}`);
}
