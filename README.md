# Sylistly — Next.js scaffold

Production starter for the Sylistly app (AI-powered outfit builder). Pairs with `SYLISTLY_MASTER_PROMPT.md`.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS
- Supabase (auth + Postgres)
- Anthropic Claude (query parsing + re-ranking)
- SearchAPI Google Shopping (real product search)
- Skimlinks (auto-affiliate wrapping)
- PostHog (analytics)

## Quick start

```bash
# 1. install
pnpm install        # or npm / yarn / bun

# 2. env
cp .env.example .env.local
# fill in keys — see §Environment below

# 3. database
# In Supabase SQL editor, run the migration:
#   supabase/migrations/0001_initial.sql

# 4. dev
pnpm dev
# open http://localhost:3000
```

## Environment

Needed for full functionality. Without them, `/api/search` falls back to the mock product database (see `lib/mock-products.ts`), so you can still build and test UX.

## Build a Real Photo Catalog

To replace placeholder catalog art with real retailer thumbnails, build the local photo-backed catalog:

```bash
npm run catalog:build
```

Useful filters:

```bash
CATALOG_BRAND_FILTER=nike npm run catalog:build
CATALOG_CATEGORY_FILTER=shoes npm run catalog:build
CATALOG_MAX_TASKS=10 npm run catalog:build
```

This writes real product records into [`data/photo-catalog.json`](/Users/willlambert/Documents/Codex/2026-04-22-how-do-i-connect-my-github/sylistly/data/photo-catalog.json). Once populated, `/api/search` prefers that photo-backed catalog before the starter placeholder catalog.

The importer now rotates through a saved queue cursor in [`data/catalog-build-state.json`](/Users/willlambert/Documents/Codex/2026-04-22-how-do-i-connect-my-github/sylistly/data/catalog-build-state.json), so repeated runs keep working through different brand/category queries instead of starting from the top every time.

```
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
SEARCHAPI_KEY=

# Recommended
SKIMLINKS_PUBLISHER_ID=
RAKUTEN_AFFILIATE_ID=
NEXT_PUBLIC_POSTHOG_KEY=

# Phase 2
FASHN_API_KEY=
STRIPE_SECRET_KEY=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
```

Get keys:

- **Anthropic:** https://console.anthropic.com
- **SearchAPI:** https://www.searchapi.io
- **Supabase:** https://supabase.com (free tier)
- **Skimlinks:** https://skimlinks.com (auto-affiliates any outbound link)
- **Rakuten:** https://rakutenadvertising.com

## Architecture

```
 user query ─► /api/search
                 │
                 ▼
             Claude (parse intent)
                 │
                 ▼
             SearchAPI Google Shopping
                 │
                 ▼
             dedupe + trust-filter
                 │
                 ▼
             Claude (re-rank top 6)
                 │
                 ▼
             affiliate-wrap URLs
                 │
                 ▼
             6 products ─► UI
```

## Directory

```
app/
  layout.tsx             global chrome
  page.tsx               builder (home)
  discover/page.tsx      curated fits
  saved/page.tsx         user's saved looks
  profile/page.tsx       style profile
  fit/[id]/page.tsx      public shareable fit
  api/
    search/route.ts      Claude + SearchAPI
    fit/route.ts         create fit
    fit/[id]/route.ts    read / share fit
    shop-all/route.ts    wrap + return all buy links
    tryon/route.ts       (phase 2) FASHN try-on
components/
  Mannequin.tsx
  SearchSheet.tsx
  SlotList.tsx
  ProductCard.tsx
  Toast.tsx
  BottomNav.tsx
lib/
  supabase.ts            server + browser clients
  claude.ts              Anthropic SDK wrapper
  serpapi.ts             shopping search
  affiliate.ts           Skimlinks/Rakuten URL wrapping
  products.ts            DB queries
  types.ts               shared types
  mock-products.ts       fallback dataset for local dev
store/
  fit.ts                 Zustand store for current fit
supabase/
  migrations/
    0001_initial.sql     schema from MASTER_PROMPT §8
```

## Deploy

- **Vercel** (recommended): `vercel` in the project root. Set env vars in project settings. The Claude + SearchAPI routes run on Node runtime (not Edge — AWS SDK compatibility).
- **Netlify**: works with `@netlify/plugin-nextjs`.

## Phase plan

See `SYLISTLY_MASTER_PROMPT.md` §20. This scaffold ships Phase 1: search, build, save. Phase 2 (try-on, creator share) adds `app/api/tryon` and `app/fit/[id]/share`.

## License

Proprietary. All product imagery remains the property of its respective retailer; see master prompt §15 for legal posture.
