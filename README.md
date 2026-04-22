# Sylistly — Next.js scaffold

Production starter for the Sylistly app (AI-powered outfit builder). Pairs with `SYLISTLY_MASTER_PROMPT.md`.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS
- Supabase (auth + Postgres)
- Anthropic Claude (query parsing + re-ranking)
- SerpAPI Google Shopping (real product search)
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

```
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
SERPAPI_KEY=

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
- **SerpAPI:** https://serpapi.com (100 free searches/mo)
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
             SerpAPI Google Shopping
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
    search/route.ts      Claude + SerpAPI
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

- **Vercel** (recommended): `vercel` in the project root. Set env vars in project settings. The Claude + SerpAPI routes run on Node runtime (not Edge — AWS SDK compatibility).
- **Netlify**: works with `@netlify/plugin-nextjs`.

## Phase plan

See `SYLISTLY_MASTER_PROMPT.md` §20. This scaffold ships Phase 1: search, build, save. Phase 2 (try-on, creator share) adds `app/api/tryon` and `app/fit/[id]/share`.

## License

Proprietary. All product imagery remains the property of its respective retailer; see master prompt §15 for legal posture.
