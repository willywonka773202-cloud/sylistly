import { createClient } from '@supabase/supabase-js';
import { BRAND_CATALOG_PRODUCTS } from '../lib/brand-catalog.ts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = BRAND_CATALOG_PRODUCTS.map((product) => ({
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
  image_original_url: product.imageOriginalUrl ?? null,
  in_stock: product.inStock ?? true,
  last_checked_at: new Date().toISOString(),
  metadata: product.metadata ?? {},
}));

const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Failed to seed brand catalog:', error.message);
  process.exit(1);
}

console.log(`Seeded ${rows.length} starter products into Supabase.`);
