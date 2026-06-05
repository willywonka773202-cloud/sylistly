import searchApiQualityCatalogData from '../data/searchapi-quality-catalog.json';
import { presentationScore } from './presentation-score';
import type { Product, SearchIntent } from './types';

type PersistedSearchApiQualityProduct = Product & {
  metadata?: Product['metadata'] & {
    source?: 'searchapi_quality_catalog';
    queryId?: string;
    qualityScore?: number;
    detailReady?: boolean;
    offerCount?: number;
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

function metadataList(product: Product, key: string): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export const SEARCHAPI_QUALITY_PRODUCTS: Product[] = (searchApiQualityCatalogData as PersistedSearchApiQualityProduct[]).map(
  (product) => ({
    ...product,
    metadata: {
      source: 'searchapi_quality_catalog',
      ...(product.metadata || {}),
    },
  }),
);

function searchApiQualityScore(product: Product, intent: SearchIntent, rawQuery: string): number {
  const haystack = normalize([
    product.brand,
    product.name,
    product.retailer,
    product.category,
    product.sourceQuery,
    ...(product.colors || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
    ...metadataList(product, 'keywords'),
  ].join(' '));

  const queryTerms = new Set<string>([
    ...tokenize(rawQuery),
    ...(intent.brand || []).flatMap(tokenize),
    ...(intent.color || []).flatMap(tokenize),
    ...(intent.style || []).flatMap(tokenize),
    ...(intent.keywords || []).flatMap(tokenize),
  ]);

  let score = product.trusted === false ? 0 : 12;
  score += presentationScore(product, intent);
  if (product.productUrl) score += 16;
  if (product.metadata?.detailReady) score += 18;
  if (product.priceCents > 0) score += 6;
  if (typeof product.metadata?.qualityScore === 'number') score += Math.round(product.metadata.qualityScore * 12);

  if (intent.priceMax && product.priceCents > intent.priceMax * 100) score -= 18;
  if (intent.priceMin && product.priceCents < intent.priceMin * 100) score -= 8;

  for (const term of queryTerms) {
    if (!term) continue;
    if (normalize(product.brand).includes(term)) score += 14;
    if (normalize(product.name).includes(term)) score += 12;
    else if (haystack.includes(term)) score += 7;
  }

  return score;
}

export function searchSearchApiQualityCatalog(
  intent: SearchIntent,
  rawQuery: string,
  limit = 24,
): Product[] {
  const pool = SEARCHAPI_QUALITY_PRODUCTS.filter((product) => product.category === intent.category);
  if (!pool.length) return [];

  const scored = pool
    .filter((product) => !intent.priceMax || product.priceCents <= intent.priceMax * 100)
    .filter((product) => !intent.priceMin || product.priceCents >= intent.priceMin * 100)
    .map((product) => ({
      product,
      score: searchApiQualityScore(product, intent, rawQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit).map((entry) => entry.product);
}
