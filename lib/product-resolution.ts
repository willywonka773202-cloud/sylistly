import { createClient } from '@supabase/supabase-js';
import clientCatalogData from '../data/client-catalog.json';
import type { Product } from './types';

export type ProductResolutionSource = 'static' | 'supabase';

export interface ResolvedProduct {
  product: Product;
  source: ProductResolutionSource;
}

const STATIC_PRODUCTS = clientCatalogData as Product[];
const STATIC_BY_ID = new Map(STATIC_PRODUCTS.map((product) => [product.id, product]));

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    brand: String(row.brand || 'Unknown'),
    name: String(row.name || 'Product'),
    category: row.category as Product['category'],
    priceCents: Number(row.price_cents || 0),
    originalPriceCents: typeof row.original_price_cents === 'number' ? row.original_price_cents : undefined,
    currency: String(row.currency || 'USD'),
    retailer: String(row.retailer || 'Retailer'),
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
    inStock: typeof row.in_stock === 'boolean' ? row.in_stock : undefined,
    trusted: typeof row.trusted === 'boolean' ? row.trusted : undefined,
    availabilityState: typeof row.link_health_status === 'string'
      ? row.link_health_status as Product['availabilityState']
      : undefined,
    lastVerifiedAt: typeof row.last_checked_at === 'string' ? row.last_checked_at : undefined,
    availableSizes: Array.isArray(row.available_sizes) ? row.available_sizes as string[] : undefined,
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

function databaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(1_200) }),
    },
  });
}

export async function resolveProductsByIds(ids: string[]): Promise<ResolvedProduct[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 32);
  const resolved = new Map<string, ResolvedProduct>();
  for (const id of uniqueIds) {
    const staticProduct = STATIC_BY_ID.get(id);
    if (staticProduct) resolved.set(id, { product: staticProduct, source: 'static' });
  }

  const missing = uniqueIds.filter((id) => !resolved.has(id));
  const client = missing.length ? databaseClient() : null;
  if (client) {
    try {
      // Migration 0005 exposes a fail-closed serving view for service-role
      // readers (service roles bypass RLS). Fall back only for pre-migration
      // environments; outbound callers still apply the shared strict gate.
      let { data, error } = await client.from('catalog_published_products').select('*').in('id', missing);
      if (error) {
        ({ data, error } = await client.from('products').select('*').in('id', missing));
      }
      if (!error) {
        for (const row of data || []) {
          const product = rowToProduct(row as Record<string, unknown>);
          resolved.set(product.id, { product, source: 'supabase' });
        }
      }
    } catch {
      // Static products still resolve when the optional database is unavailable.
    }
  }

  return uniqueIds.flatMap((id) => {
    const item = resolved.get(id);
    return item ? [item] : [];
  });
}

export async function resolveProductById(id: string): Promise<ResolvedProduct | null> {
  return (await resolveProductsByIds([id]))[0] || null;
}
