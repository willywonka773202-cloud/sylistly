import { NextResponse } from 'next/server';
import { getPublishedCatalogProducts } from '@/lib/catalog-query';
import type { Category, Product } from '@/lib/types';

const CATEGORY_SET = new Set<Category>([
  'hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry',
]);
const MAX_PAGE_SIZE = 48;
const MAX_ID_LOOKUP = 64;

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function searchableText(product: Product): string {
  return normalized([
    product.brand,
    product.name,
    product.category,
    product.retailer,
    ...(product.colors || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
  ].join(' '));
}

function matchesQuery(product: Product, query: string): boolean {
  const terms = normalized(query).split(' ').filter(Boolean);
  if (!terms.length) return true;
  const haystack = searchableText(product);
  return terms.every((term) => haystack.includes(term));
}

function productTimestamp(product: Product): number {
  const metadata = product.metadata as Record<string, unknown> | undefined;
  const raw = metadata?.discoveredAt || metadata?.publishedAt || product.imageUpdatedAt;
  return typeof raw === 'string' ? Date.parse(raw) || 0 : 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedIds = Array.from(new Set(
    (searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && id.length <= 180),
  )).slice(0, MAX_ID_LOOKUP);
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const category = CATEGORY_SET.has(categoryParam as Category) ? categoryParam as Category : null;
  const brand = normalized(searchParams.get('brand') || '');
  const retailer = normalized(searchParams.get('retailer') || '');
  const color = normalized(searchParams.get('color') || '');
  const maxPriceCents = Math.max(0, Number.parseInt(searchParams.get('maxPriceCents') || '0', 10) || 0);
  const minPriceCents = Math.max(0, Number.parseInt(searchParams.get('minPriceCents') || '0', 10) || 0);
  const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(searchParams.get('limit') || String(MAX_PAGE_SIZE), 10) || MAX_PAGE_SIZE),
  );
  const sort = searchParams.get('sort') || 'featured';

  const publishedProducts = getPublishedCatalogProducts();
  if (requestedIds.length) {
    const byId = new Map(publishedProducts.map((product) => [product.id, product]));
    const matched = requestedIds.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    });
    return NextResponse.json(
      { products: matched, total: matched.length, nextOffset: null },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  let products = publishedProducts.filter((product) => {
    if (category && product.category !== category) return false;
    if (brand && normalized(product.brand) !== brand) return false;
    if (retailer && normalized(product.retailer) !== retailer) return false;
    if (color && !(product.colors || []).some((entry) => normalized(entry) === color)) return false;
    if (minPriceCents && product.priceCents < minPriceCents) return false;
    if (maxPriceCents && product.priceCents > maxPriceCents) return false;
    return matchesQuery(product, query);
  });

  if (sort === 'price-asc') {
    products = products.sort((a, b) => a.priceCents - b.priceCents || a.id.localeCompare(b.id));
  } else if (sort === 'price-desc') {
    products = products.sort((a, b) => b.priceCents - a.priceCents || a.id.localeCompare(b.id));
  } else if (sort === 'newest') {
    products = products.sort((a, b) => productTimestamp(b) - productTimestamp(a) || a.id.localeCompare(b.id));
  }

  const page = products.slice(offset, offset + limit);
  return NextResponse.json(
    {
      products: page,
      total: products.length,
      nextOffset: offset + page.length < products.length ? offset + page.length : null,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    },
  );
}
