import photoCatalogData from '@/data/photo-catalog.json';
import type { Category, Product, SearchIntent } from './types';
import { presentationScore } from './presentation-score';

type PersistedCatalogProduct = Product & {
  metadata?: Product['metadata'] & {
    source?: 'photo_catalog';
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

export const PHOTO_CATALOG_PRODUCTS: Product[] = (photoCatalogData as PersistedCatalogProduct[]).map(
  (product) => ({
    ...product,
    metadata: {
      source: 'photo_catalog',
      ...(product.metadata || {}),
    },
  }),
);

function photoCatalogScore(product: Product, intent: SearchIntent, rawQuery: string): number {
  const haystack = normalize([
    product.brand,
    product.name,
    product.retailer,
    ...(Array.isArray(product.metadata?.colors) ? (product.metadata.colors as string[]) : []),
    ...(Array.isArray(product.metadata?.styles) ? (product.metadata.styles as string[]) : []),
    ...(Array.isArray(product.metadata?.vibes) ? (product.metadata.vibes as string[]) : []),
    ...(Array.isArray(product.metadata?.keywords) ? (product.metadata.keywords as string[]) : []),
  ].join(' '));

  const queryTerms = new Set<string>([
    ...tokenize(rawQuery),
    ...(intent.brand || []).flatMap(tokenize),
    ...(intent.color || []).flatMap(tokenize),
    ...(intent.style || []).flatMap(tokenize),
    ...(intent.keywords || []).flatMap(tokenize),
  ]);

  let score = product.trusted === false ? 0 : 8;
  score += presentationScore(product, intent);

  if (intent.priceMax && product.priceCents > intent.priceMax * 100) score -= 12;
  if (intent.priceMin && product.priceCents < intent.priceMin * 100) score -= 6;

  for (const term of queryTerms) {
    if (!term) continue;
    if (normalize(product.brand).includes(term)) score += 12;
    if (normalize(product.name).includes(term)) score += 10;
    else if (haystack.includes(term)) score += 6;
  }

  if ((intent.brand || []).some((brand) => normalize(product.brand) === normalize(brand))) {
    score += 20;
  }

  if ((intent.color || []).some((color) => haystack.includes(normalize(color)))) {
    score += 8;
  }

  if ((intent.style || []).some((style) => haystack.includes(normalize(style)))) {
    score += 8;
  }

  return score;
}

export function searchPhotoCatalog(
  intent: SearchIntent,
  rawQuery: string,
  limit = 10,
): Product[] {
  const pool = PHOTO_CATALOG_PRODUCTS.filter((product) => product.category === intent.category);
  if (!pool.length) return [];

  const scored = pool
    .map((product) => ({
      product,
      score: photoCatalogScore(product, intent, rawQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (!scored.length) return [];

  return scored.slice(0, limit).map((entry) => entry.product);
}
