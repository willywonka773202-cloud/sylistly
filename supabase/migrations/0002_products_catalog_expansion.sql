-- Sylistly schema · 0002 product catalog expansion
-- Adds the richer product fields used by the transparent-cutout catalog,
-- Syli recommendations, and database-first search.

alter table products
  add column if not exists image_transparent_url text,
  add column if not exists image_cutout_url text,
  add column if not exists image_source text,
  add column if not exists image_status text default 'original',
  add column if not exists image_quality_flags text[] default '{}'::text[],
  add column if not exists image_updated_at timestamptz,
  add column if not exists image_review_notes text,
  add column if not exists trusted boolean default true,
  add column if not exists vibes text[] default '{}'::text[],
  add column if not exists occasions text[] default '{}'::text[],
  add column if not exists colors text[] default '{}'::text[],
  add column if not exists gender text[] default '{}'::text[],
  add column if not exists search_terms text[] default '{}'::text[],
  add column if not exists product_url text,
  add column if not exists google_shopping_url text,
  add column if not exists fallback_url text,
  add column if not exists image_quality text,
  add column if not exists popularity_score numeric default 0;

update products
set
  image_status = coalesce(image_status, 'original'),
  image_quality_flags = coalesce(image_quality_flags, '{}'::text[]),
  trusted = coalesce(trusted, true),
  vibes = coalesce(vibes, '{}'::text[]),
  occasions = coalesce(occasions, '{}'::text[]),
  colors = coalesce(colors, '{}'::text[]),
  gender = coalesce(gender, '{}'::text[]),
  search_terms = coalesce(search_terms, '{}'::text[]),
  popularity_score = coalesce(popularity_score, 0);

alter table products
  alter column image_status set default 'original',
  alter column image_quality_flags set default '{}'::text[],
  alter column trusted set default true,
  alter column vibes set default '{}'::text[],
  alter column occasions set default '{}'::text[],
  alter column colors set default '{}'::text[],
  alter column gender set default '{}'::text[],
  alter column search_terms set default '{}'::text[],
  alter column popularity_score set default 0;

create index if not exists products_category_price on products(category, price_cents);
create index if not exists products_trusted_stock on products(trusted, in_stock);
create index if not exists products_image_status on products(image_status);
create index if not exists products_popularity on products(popularity_score desc);
create index if not exists products_brand_lower on products((lower(brand)));
create index if not exists products_name_lower on products((lower(name)));
create index if not exists products_vibes_gin on products using gin(vibes);
create index if not exists products_occasions_gin on products using gin(occasions);
create index if not exists products_colors_gin on products using gin(colors);
create index if not exists products_gender_gin on products using gin(gender);
create index if not exists products_search_terms_gin on products using gin(search_terms);

alter table products enable row level security;

drop policy if exists "products public read trusted" on products;
create policy "products public read trusted" on products for select
  using (trusted is true and in_stock is not false);
