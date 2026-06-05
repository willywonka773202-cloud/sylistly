import { supabaseService } from './supabase';
import type { Product } from './types';

/** Upsert products returned by a search so we have a persistent record. */
export async function cacheProducts(products: Product[]) {
  if (!products.length) return;
  const sb = supabaseService();
  await sb.from('products').upsert(
    products.map((p) => ({
      id: p.id,
      brand: p.brand,
      name: p.name,
      category: p.category,
      price_cents: p.priceCents,
      currency: p.currency,
      retailer: p.retailer,
      retailer_url: p.retailerUrl,
      affiliate_url: p.affiliateUrl,
      image_url: p.imageUrl,
      image_transparent_url: p.imageTransparentUrl,
      image_cutout_url: p.imageCutoutUrl,
      image_source: p.imageSource,
      image_status: p.imageStatus,
      image_quality_flags: p.imageQualityFlags,
      image_updated_at: p.imageUpdatedAt,
      image_review_notes: p.imageReviewNotes,
      image_original_url: p.imageOriginalUrl,
      in_stock: p.inStock ?? true,
      trusted: p.trusted ?? true,
      vibes: p.vibes ?? [],
      occasions: p.occasions ?? [],
      colors: p.colors ?? [],
      gender: p.gender ?? [],
      search_terms: p.searchTerms ?? [],
      product_url: p.productUrl,
      google_shopping_url: p.googleShoppingUrl,
      fallback_url: p.fallbackUrl,
      image_quality: p.imageQuality,
      popularity_score: p.popularityScore,
      last_checked_at: new Date().toISOString(),
      metadata: p.metadata ?? {},
    })),
    { onConflict: 'id' },
  );
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const sb = supabaseService();
  const { data } = await sb.from('products').select('*').in('id', ids);
  return (data || []).map(rowToProduct);
}

function rowToProduct(r: Record<string, unknown>): Product {
  return {
    id: r.id as string,
    brand: r.brand as string,
    name: r.name as string,
    category: r.category as Product['category'],
    priceCents: r.price_cents as number,
    currency: (r.currency as string) || 'USD',
    retailer: r.retailer as string,
    retailerUrl: r.retailer_url as string,
    affiliateUrl: r.affiliate_url as string | undefined,
    imageUrl: r.image_url as string,
    imageTransparentUrl: r.image_transparent_url as string | undefined,
    imageCutoutUrl: r.image_cutout_url as string | undefined,
    imageSource: r.image_source as Product['imageSource'],
    imageStatus: r.image_status as Product['imageStatus'],
    imageQualityFlags: Array.isArray(r.image_quality_flags) ? r.image_quality_flags as string[] : undefined,
    imageUpdatedAt: r.image_updated_at as string | undefined,
    imageReviewNotes: r.image_review_notes as string | undefined,
    imageOriginalUrl: r.image_original_url as string | undefined,
    inStock: r.in_stock as boolean | undefined,
    trusted: r.trusted as boolean | undefined,
    vibes: Array.isArray(r.vibes) ? r.vibes as string[] : undefined,
    occasions: Array.isArray(r.occasions) ? r.occasions as string[] : undefined,
    colors: Array.isArray(r.colors) ? r.colors as string[] : undefined,
    gender: Array.isArray(r.gender) ? r.gender as Product['gender'] : undefined,
    searchTerms: Array.isArray(r.search_terms) ? r.search_terms as string[] : undefined,
    productUrl: r.product_url as string | undefined,
    googleShoppingUrl: r.google_shopping_url as string | undefined,
    fallbackUrl: r.fallback_url as string | undefined,
    imageQuality: r.image_quality as Product['imageQuality'],
    popularityScore: r.popularity_score as number | undefined,
    metadata: (r.metadata as Record<string, unknown>) || {},
  };
}
