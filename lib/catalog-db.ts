import { createClient } from '@supabase/supabase-js';
import type { Product, SearchIntent } from '@/lib/types';

const DB_CATALOG_TTL_MS = 5 * 60 * 1000;
const dbCatalogCache = new Map<string, { expiresAt: number; products: Product[] }>();

function getSupabaseCatalogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasDatabaseCatalog(): boolean {
  return Boolean(getSupabaseCatalogClient());
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    brand: String(row.brand || 'Unknown'),
    name: String(row.name || 'Product'),
    category: row.category as Product['category'],
    priceCents: Number(row.price_cents || 0),
    currency: String(row.currency || 'USD'),
    retailer: String(row.retailer || 'Catalog'),
    retailerUrl: String(row.retailer_url || row.product_url || ''),
    affiliateUrl: typeof row.affiliate_url === 'string' ? row.affiliate_url : undefined,
    imageUrl: String(row.image_url || ''),
    imageTransparentUrl: typeof row.image_transparent_url === 'string' ? row.image_transparent_url : undefined,
    imageCutoutUrl: typeof row.image_cutout_url === 'string' ? row.image_cutout_url : undefined,
    imageSource: row.image_source as Product['imageSource'],
    imageStatus: row.image_status as Product['imageStatus'],
    imageQualityFlags: Array.isArray(row.image_quality_flags) ? row.image_quality_flags as string[] : undefined,
    imageUpdatedAt: typeof row.image_updated_at === 'string' ? row.image_updated_at : undefined,
    imageReviewNotes: typeof row.image_review_notes === 'string' ? row.image_review_notes : undefined,
    imageOriginalUrl: typeof row.image_original_url === 'string' ? row.image_original_url : undefined,
    inStock: typeof row.in_stock === 'boolean' ? row.in_stock : true,
    trusted: typeof row.trusted === 'boolean' ? row.trusted : true,
    vibes: Array.isArray(row.vibes) ? row.vibes as string[] : undefined,
    occasions: Array.isArray(row.occasions) ? row.occasions as string[] : undefined,
    colors: Array.isArray(row.colors) ? row.colors as string[] : undefined,
    gender: Array.isArray(row.gender) ? row.gender as Product['gender'] : undefined,
    searchTerms: Array.isArray(row.search_terms) ? row.search_terms as string[] : undefined,
    productUrl: typeof row.product_url === 'string' ? row.product_url : undefined,
    googleShoppingUrl: typeof row.google_shopping_url === 'string' ? row.google_shopping_url : undefined,
    fallbackUrl: typeof row.fallback_url === 'string' ? row.fallback_url : undefined,
    imageQuality: row.image_quality as Product['imageQuality'],
    popularityScore: typeof row.popularity_score === 'number' ? row.popularity_score : undefined,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenScore(product: Product, tokens: string[]): number {
  if (!tokens.length) return 1;
  const haystack = normalizeText([
    product.brand,
    product.name,
    product.category,
    product.retailer,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.colors || []),
    ...(product.searchTerms || []),
  ].join(' '));
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export async function searchDatabaseCatalog(
  intent: SearchIntent,
  query: string,
  limit = 80,
): Promise<Product[]> {
  const client = getSupabaseCatalogClient();
  if (!client) return [];

  const cacheKey = `${intent.category}:${query.toLowerCase()}:${limit}`;
  const cached = dbCatalogCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.products;
  if (cached) dbCatalogCache.delete(cacheKey);

  try {
    let request = client
      .from('products')
      .select('*')
      .eq('category', intent.category)
      .limit(Math.min(Math.max(limit * 3, 60), 300));

    if (intent.priceMin) request = request.gte('price_cents', Math.round(intent.priceMin * 100));
    if (intent.priceMax) request = request.lte('price_cents', Math.round(intent.priceMax * 100));

    const { data, error } = await request;
    if (error) {
      console.warn('[catalog-db] query failed: %s', error.message);
      return [];
    }

    const tokens = normalizeText(query)
      .split(/\s+/)
      .filter((token) => token.length > 1);
    const brandTerms = new Set((intent.brand || []).map(normalizeText));
    const colorTerms = new Set((intent.color || []).map(normalizeText));
    const products = (data || [])
      .map((row) => rowToProduct(row as Record<string, unknown>))
      .map((product) => {
        const base = tokenScore(product, tokens);
        const brandBoost = brandTerms.has(normalizeText(product.brand)) ? 12 : 0;
        const colorBoost = (product.colors || []).some((color) => colorTerms.has(normalizeText(color))) ? 4 : 0;
        const transparentBoost = product.imageTransparentUrl || product.imageCutoutUrl ? 8 : 0;
        const popularityBoost = product.popularityScore || 0;
        return { product, score: base + brandBoost + colorBoost + transparentBoost + popularityBoost };
      })
      .filter(({ score }) => tokens.length === 0 || score > 0)
      .sort((left, right) => right.score - left.score)
      .map(({ product }) => product)
      .slice(0, limit);

    dbCatalogCache.set(cacheKey, {
      expiresAt: Date.now() + DB_CATALOG_TTL_MS,
      products,
    });
    return products;
  } catch (error) {
    console.warn('[catalog-db] unavailable: %s', error instanceof Error ? error.message : String(error));
    return [];
  }
}
