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
      image_original_url: p.imageOriginalUrl,
      in_stock: p.inStock ?? true,
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
    imageOriginalUrl: r.image_original_url as string | undefined,
    inStock: r.in_stock as boolean | undefined,
    metadata: (r.metadata as Record<string, unknown>) || {},
  };
}
