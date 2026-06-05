import { createClient } from '@supabase/supabase-js';
import type { Product } from './types';

export function hasSupabaseServiceCatalog(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function rowForProduct(product: Product) {
  return {
    id: product.id,
    brand: product.brand,
    name: product.name,
    category: product.category,
    price_cents: product.priceCents,
    currency: product.currency,
    retailer: product.retailer,
    retailer_url: product.retailerUrl,
    affiliate_url: product.affiliateUrl ?? null,
    image_url: product.imageUrl,
    image_transparent_url: product.imageTransparentUrl ?? null,
    image_cutout_url: product.imageCutoutUrl ?? null,
    image_source: product.imageSource ?? null,
    image_status: product.imageStatus ?? null,
    image_quality_flags: product.imageQualityFlags ?? [],
    image_updated_at: product.imageUpdatedAt ?? null,
    image_review_notes: product.imageReviewNotes ?? null,
    image_original_url: product.imageOriginalUrl ?? null,
    in_stock: product.inStock ?? true,
    trusted: product.trusted ?? true,
    vibes: product.vibes ?? [],
    occasions: product.occasions ?? [],
    colors: product.colors ?? [],
    gender: product.gender ?? [],
    search_terms: product.searchTerms ?? [],
    product_url: product.productUrl ?? null,
    google_shopping_url: product.googleShoppingUrl ?? null,
    fallback_url: product.fallbackUrl ?? null,
    image_quality: product.imageQuality ?? null,
    popularity_score: product.popularityScore ?? null,
    last_checked_at: new Date().toISOString(),
    metadata: product.metadata ?? {},
  };
}

export async function upsertProductsToSupabase(products: Product[]): Promise<number> {
  if (!products.length) return 0;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to upsert catalog products.');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from('products').upsert(products.map(rowForProduct), { onConflict: 'id' });
  if (error) throw new Error(error.message);

  return products.length;
}
