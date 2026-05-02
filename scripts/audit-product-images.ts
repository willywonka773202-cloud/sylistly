import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { hasUsableImageUrl } from '../lib/product-image-quality';
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
};
const bySource = new Map<string, number>();
const byCategory = new Map<string, { total: number; bad: number }>();

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
}

console.log('Product image audit');
console.log(`Total products: ${totals.total}`);
console.log(`Missing imageUrl: ${totals.missing}`);
console.log(`Unusable static imageUrl: ${totals.unusable}`);
console.log(`Suspicious imageUrl: ${totals.suspicious}`);

console.log('\nBad image URLs by source');
for (const [source, count] of Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`- ${source}: ${count}`);
}

console.log('\nWeakest image coverage by category');
for (const [category, counts] of Array.from(byCategory.entries()).sort((a, b) => (b[1].bad / b[1].total) - (a[1].bad / a[1].total))) {
  const rate = counts.total ? Math.round((counts.bad / counts.total) * 100) : 0;
  console.log(`- ${category}: ${counts.bad}/${counts.total} bad (${rate}%)`);
}
