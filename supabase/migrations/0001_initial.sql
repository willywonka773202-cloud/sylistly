-- Sylistly schema · 0001 initial
-- Paste this into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ===== profiles =====
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  skin_tone text default '#c9a98a',
  body_type text default 'androgynous',
  sizes jsonb default '{}'::jsonb,
  style_prefs jsonb default '{}'::jsonb,
  is_creator boolean default false,
  created_at timestamptz default now()
);

-- ===== products =====
create table if not exists products (
  id text primary key,
  brand text not null,
  name text not null,
  category text not null,
  price_cents int not null,
  currency text default 'USD',
  retailer text not null,
  retailer_url text not null,
  affiliate_url text,
  image_url text not null,
  image_original_url text,
  in_stock boolean default true,
  last_checked_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);
create index if not exists products_category_brand on products(category, brand);
create index if not exists products_retailer on products(retailer);

-- ===== fits =====
create table if not exists fits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  title text,
  vibe text,
  items jsonb not null,
  total_cents int not null,
  cover_url text,
  is_public boolean default false,
  created_at timestamptz default now()
);
create index if not exists fits_owner on fits(owner_id);
create index if not exists fits_public on fits(is_public) where is_public = true;

-- ===== fit_shares =====
create table if not exists fit_shares (
  id text primary key,
  fit_id uuid references fits(id) on delete cascade,
  creator_id uuid references profiles(id),
  clicks int default 0,
  purchases int default 0,
  revenue_cents int default 0,
  created_at timestamptz default now()
);

-- ===== clicks (affiliate tracking) =====
create table if not exists clicks (
  id bigint generated always as identity primary key,
  fit_share_id text references fit_shares(id),
  product_id text references products(id),
  user_id uuid,
  clicked_at timestamptz default now(),
  converted boolean default false,
  commission_cents int default 0
);
create index if not exists clicks_product on clicks(product_id);
create index if not exists clicks_share on clicks(fit_share_id);

-- ===== search_cache =====
create table if not exists search_cache (
  query_hash text primary key,
  query text not null,
  category text,
  results jsonb not null,
  created_at timestamptz default now()
);

-- ===== RLS =====
alter table profiles enable row level security;
alter table fits enable row level security;
alter table fit_shares enable row level security;

-- Profiles: users see/edit own; anyone can read handle of creators for share pages
create policy "profiles own read" on profiles for select
  using (auth.uid() = id or is_creator = true);
create policy "profiles own update" on profiles for update using (auth.uid() = id);
create policy "profiles own insert" on profiles for insert with check (auth.uid() = id);

-- Fits: owner or public
create policy "fits owner read" on fits for select
  using (auth.uid() = owner_id or is_public = true or owner_id is null);
create policy "fits owner insert" on fits for insert
  with check (auth.uid() = owner_id or owner_id is null);
create policy "fits owner update" on fits for update using (auth.uid() = owner_id);
create policy "fits owner delete" on fits for delete using (auth.uid() = owner_id);

-- Fit shares: readable by anyone, writable only by creator
create policy "shares public read" on fit_shares for select using (true);
create policy "shares creator write" on fit_shares for insert
  with check (auth.uid() = creator_id);

-- products + clicks + search_cache are service-role only (no public read policy)

-- ===== trigger: auto-create profile =====
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
