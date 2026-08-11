import { createClient } from '@supabase/supabase-js';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog.ts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = ALL_CATALOG_PRODUCTS.map((product) => ({
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
  metadata: product.metadata ?? {},
}));

const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Failed to seed brand catalog:', error.message);
  process.exit(1);
}

console.log(`Seeded ${rows.length} runtime catalog products into Supabase.`);
