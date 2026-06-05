import dropCatalogData from '../data/drop-catalog.json';
import type { Product, SearchIntent } from './types';
import { presentationScore } from './presentation-score';

type PersistedDropCatalogProduct = Product & {
  metadata?: Product['metadata'] & {
    source?: 'drop_catalog';
    colors?: string[];
    styles?: string[];
    vibes?: string[];
    keywords?: string[];
  };
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export const DROP_CATALOG_PRODUCTS: Product[] = (dropCatalogData as PersistedDropCatalogProduct[]).map(
  (product) => ({
    ...product,
    metadata: {
      source: 'drop_catalog',
      ...(product.metadata || {}),
    },
  }),
);

function dropCatalogScore(product: Product, intent: SearchIntent, rawQuery: string): number {
  const haystack = normalize([
    product.brand,
    product.name,
    product.retailer,
    ...(product.colors || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
    ...(Array.isArray(product.metadata?.keywords) ? product.metadata.keywords as string[] : []),
  ].join(' '));

  const queryTerms = new Set<string>([
    ...tokenize(rawQuery),
    ...(intent.brand || []).flatMap(tokenize),
    ...(intent.color || []).flatMap(tokenize),
    ...(intent.style || []).flatMap(tokenize),
    ...(intent.keywords || []).flatMap(tokenize),
  ]);

  let score = product.trusted === false ? 0 : 10;
  score += presentationScore(product, intent);
  if (product.imageTransparentUrl || product.imageCutoutUrl) score += 12;
  if (product.productUrl || product.retailerUrl) score += 8;

  if (intent.priceMax && product.priceCents > intent.priceMax * 100) score -= 12;
  if (intent.priceMin && product.priceCents < intent.priceMin * 100) score -= 6;

  for (const term of queryTerms) {
    if (!term) continue;
    if (normalize(product.brand).includes(term)) score += 12;
    if (normalize(product.name).includes(term)) score += 10;
    else if (haystack.includes(term)) score += 6;
  }

  return score;
}

export function searchDropCatalog(
  intent: SearchIntent,
  rawQuery: string,
  limit = 10,
): Product[] {
  const pool = DROP_CATALOG_PRODUCTS.filter((product) => product.category === intent.category);
  if (!pool.length) return [];

  const scored = pool
    .filter((product) => !intent.priceMax || product.priceCents <= intent.priceMax * 100)
    .filter((product) => !intent.priceMin || product.priceCents >= intent.priceMin * 100)
    .map((product) => ({
      product,
      score: dropCatalogScore(product, intent, rawQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit).map((entry) => entry.product);
}
