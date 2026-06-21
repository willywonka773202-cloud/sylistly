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
# In Supabase SQL editor, run the migrations in order:
#   supabase/migrations/0001_initial.sql
#   supabase/migrations/0002_products_catalog_expansion.sql
#
# Then seed the current runtime catalog:
#   npm run seed:catalog

# 4. dev
pnpm dev
# open http://localhost:3000
```

## Quality gate

One command runs the full gate (also enforced in CI on every push/PR via
`.github/workflows/verify.yml` — needs no secrets):

```bash
npm run verify   # typecheck + lint + unit tests + route/integrity smoke
```

Individually:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run test:units     # pure-logic unit checks: XP levels, bundle pricing, affiliate wrap, rarity tiers
npm run smoke:routes   # routes exist + honesty/revenue/foundation invariants
SMOKE_BASE_URL=https://www.sylistly.com npm run smoke:routes  # + live HTTP check of prod
```

These lock in the honest-app invariants — no fake discounts (verified-only deals),
affiliate-wrapped shop links, XP-from-real-actions, the iOS one-swipe touch-pager,
canonical `www` host, no fake-social copy — so they can't silently regress.

## Environment

Needed for full live functionality. Without paid search keys, `/api/search` still works from the local Sylistly catalog, so the core builder can run without API cost.

## Free Catalog Mode

The app now defaults to a database-first search path so it can run without paid search calls:

- `data/photo-catalog.json` is checked first when you have real product photos imported.
- If that file is empty, `/api/search` falls back to the starter brand catalog in `lib/brand-catalog.ts`.
- The selected style frame is sent with every search, so menswear, womenswear, and neutral searches return different query bias.
- Product buttons open the clean retailer URL directly. Affiliate wrapping can still be layered back in later, but the UI no longer prefers confusing wrapper links.

Set `SEARCH_MODE=hybrid` only when you intentionally want live SearchAPI fallback. Leave it unset or set `SEARCH_MODE=catalog-only` for the low-cost public version.

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

This writes real product records into [`data/photo-catalog.json`](/Users/willlambert/Documents/GitHub/sylistly/data/photo-catalog.json). Once populated, `/api/search` prefers that photo-backed catalog before the starter merchant catalog.

The importer now rotates through a saved queue cursor in [`data/catalog-build-state.json`](data/catalog-build-state.json), so repeated runs keep working through different brand/category queries instead of starting from the top every time.

## New Drop Catalog Refresh

The drop catalog pulls current products from configured brand collection feeds in [`data/drop-sources.json`](/Users/willlambert/Documents/GitHub/sylistly/data/drop-sources.json), stores them in [`data/drop-catalog.json`](/Users/willlambert/Documents/GitHub/sylistly/data/drop-catalog.json), and marks new items as `imageStatus=needs-cutout` until transparent PNGs are reviewed.

```bash
# Preview new drops without writing files
npm run catalog:ingest-drops

# Write data/drop-catalog.json, then rebuild the client transparent catalog
npm run catalog:refresh

# Also upsert newly ingested products into Supabase
npm run catalog:ingest-drops -- --apply --supabase
```

After ingesting drops, run the cutout pipeline before expecting them to show in the transparent outfit builder:

```bash
npx jiti scripts/prepare-cutout-candidates.ts
python3 scripts/generate-cutouts-local.py --apply
npx jiti scripts/register-cutouts.ts --apply
npm run catalog:client
```

`/api/catalog-refresh` is protected by `Authorization: Bearer $CATALOG_REFRESH_TOKEN` or `Authorization: Bearer $CRON_SECRET`. `vercel.json` schedules it daily at 10:00 UTC, and it requires `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`. Set `CATALOG_REFRESH_SEARCHAPI=1` and `SEARCHAPI_KEY` only when you want scheduled SearchAPI-backed sources in addition to free brand feeds.

```
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
CATALOG_REFRESH_TOKEN=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
OLLAMA_API_KEY=
OLLAMA_DEFAULT_MODEL=gpt-oss:120b
OLLAMA_API_BASE_URL=https://ollama.com/api
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

The scroll serves **pre-generated, coordinated outfits** from the local catalog
(no per-view LLM/search call), and every shop link is affiliate-wrapped.

```
 client catalog (transparent cutouts) ─► outfit library / ai-look library
                                              │  (coordinated, date-seeded looks)
                                              ▼
   SCROLL  ── WornFlatlay collage (vitrine plate)
       │         │
       │         └─ lock a piece ─► restyle the rest around it
       ▼
   DROP   ── date-seeded crate ─► reveal a look ─► bundle deal (verified-only)
       │
       ▼
   SHOP   ── wrapAffiliate(productUrl)  (Skimlinks / Rakuten) ─► retailer
                 │
   engagement ──┴─ real actions ─► XP · levels · quests · streak · vault  (localStorage, honest)
```

The catalog itself is built/refreshed offline (SearchAPI Google Shopping + a
cutout pipeline → `data/*.json`); `/api/search` powers Browse and falls back to
the local catalog when no paid key is set. See the catalog sections above.

## Directory

The app is a full-screen **outfit scroll** + a **Daily Drop crate**, not a search
box. The five tabs (BottomNav): Scroll (`/`), Remix (`/build`), Drop (`/drop`,
centre), Saved (`/saved`), You (`/profile`).

```
app/
  layout.tsx             global chrome (fonts, metadata, BottomNav)
  page.tsx               the SCROLL — full-screen outfit feed (home); lock a piece → restyle
  drop/page.tsx          the DAILY DROP — 3D crate shop: crates, streak, vault, XP, quests
  build/page.tsx         REMIX — the outfit builder
  browse/page.tsx        BROWSE — searchable catalog grid; tap to lock into the scroll
  saved/page.tsx         Saved fits + pieces
  profile/page.tsx       YOU — style settings + the collection card (level/streak/vault)
  checkout/page.tsx      "Shop the look" — gathers affiliate-wrapped retailer links
  look/[id]/             shareable look page + dynamic OG image
  style/[id]/            shareable style-identity page + dynamic OG image
  error.tsx / not-found.tsx / opengraph-image.tsx / robots.ts / sitemap.ts / manifest.ts
  api/                   search · look · fit · image (cutout proxy + SSRF guard) · shop-all · catalog-*
components/
  WornFlatlay.tsx        the worn outfit collage plate (vitrine depth + sway)
  OutfitBoard.tsx        outfit-card renderers (feed + saved)
  DailyDrop.tsx          the crate: 3D intro → reel → reveal → shop the bundle
  three/                 CrateScene.tsx + Crate3D.tsx (lazy WebGL 3D crate)
  BottomNav.tsx          5-tab floating nav (spring sliding glow-lamp)
  AmbientField.tsx · AnimatedNumber.tsx · Reveal.tsx · ProductImage.tsx
  PiecePeek.tsx · CheckoutSheet.tsx · Onboarding.tsx · PlaceholderScreen.tsx · SearchSheet.tsx
lib/
  visual-capability.ts   SSR-safe heavy-visuals gate (reduced-motion / WebGL / low-power)
  look-rarity.ts         honest rarity tiers (everyday/standout/showpiece/heat)
  drop-vault.ts          streak (+ one freeze) + the collection vault
  stylist-xp.ts          XP, levels, daily quests (from real actions only)
  bundle-deals.ts        honest retailer offers (verified-only)
  affiliate.ts           Skimlinks/Rakuten URL wrapping
  product-links.ts · checkout.ts · feedback.ts · analytics.ts · types.ts
store/                   Zustand stores (fit, saved-fits, wardrobe, profile)
scripts/
  check-route-smoke.ts   route + honesty/revenue/foundation smoke (npm run smoke:routes)
  check-lib-units.ts     pure-logic unit tests (npm run test:units)
```

## Deploy

- **Vercel** (recommended): `vercel` in the project root. Set env vars in project settings. The Claude + SearchAPI routes run on Node runtime (not Edge — AWS SDK compatibility).
- **Netlify**: works with `@netlify/plugin-nextjs`.

## Phase plan

See `SYLISTLY_MASTER_PROMPT.md` §20. This scaffold ships Phase 1: search, build, save. Phase 2 (try-on, creator share) adds `app/api/tryon` and `app/fit/[id]/share`.

## License

Proprietary. All product imagery remains the property of its respective retailer; see master prompt §15 for legal posture.
