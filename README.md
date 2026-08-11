# Sylistly

Sylistly is a local-first fashion discovery and shopping product built around one
promise: a complete outfit within the shopper's budget, made only from pieces
with fresh positive availability evidence and exact retailer product pages.
Every primary look can be saved, remixed, shared, shopped item by item, or have
one piece replaced without weakening the complete-look or budget invariant.

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
# 1. install from the committed lockfile
npm ci

# 2. env
cp .env.example .env.local
# fill in keys — see §Environment below

# 3. database
# In Supabase SQL editor, take a backup, then run migrations in order:
#   supabase/migrations/0001_initial.sql
#   supabase/migrations/0002_products_catalog_expansion.sql
#   supabase/migrations/0003_catalog_link_health.sql
#   supabase/migrations/0004_click_attribution.sql
#   supabase/migrations/0005_catalog_lifecycle.sql
# Read docs/CATALOG_RELIABILITY.md before applying 0005 or enabling a writer.
#
# Then seed the current runtime catalog:
#   npm run seed:catalog

# 4. dev
npm run dev
# open http://localhost:3000
```

## Quality gate

One command runs the full gate (also enforced in CI on every push/PR via
`.github/workflows/verify.yml` — needs no secrets):

```bash
npm run verify   # typecheck, lint, unit/integration contracts, data gates, smoke
```

Individually:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run test:units     # core deterministic product and freshness contracts
npm run test:catalog-reliability
npm run test:catalog-flow
npm run test:catalog-analytics
npm run test:style-owned
npm run test:attribution
npm run test:outfit-library
npm run test:performance:unit
npm run smoke:routes   # routes exist + honesty/revenue/foundation invariants
SMOKE_BASE_URL=https://www.sylistly.com npm run smoke:routes  # + live HTTP check of prod
```

These lock in the honest-app invariants — no fake discounts (verified-only deals),
affiliate-wrapped shop links, XP-from-real-actions, the iOS one-swipe touch-pager,
canonical `www` host, no fake-social copy — so they can't silently regress.

## Environment

Needed for full live functionality. Without paid search keys, `/api/search` still works from the local Sylistly catalog, so the core builder can run without API cost.

The Remix “Style what I own” product-URL path does not need a paid API. It first matches exact links in the published catalog, then may verify structured Product data from an existing catalog retailer. Optional `STYLE_FROM_URL_TIMEOUT_MS` and `STYLE_FROM_URL_MAX_HTML_BYTES` values only tighten or relax the bounded verifier within its documented clamps; see [`docs/STYLE_WHAT_I_OWN.md`](docs/STYLE_WHAT_I_OWN.md). Photo import is intentionally not exposed because the current stack cannot verify image understanding reliably.

## Catalog and search modes

The product works without paid search calls. Runtime surfaces resolve through a
shared strict publishability boundary: exact HTTPS PDP, reviewed imagery,
explicit trust/stock, and a positive retailer check no older than 24 hours.
Unresolved, reachable-only, blocked, stale, dead, and sold-out rows remain in
candidate/review evidence but are not presented as buyable.

`/api/search` uses the configured Supabase catalog when available and falls back
to the same strict local artifact. Set `SEARCH_MODE=hybrid` only when intentionally
enabling SearchAPI discovery; catalog-only is the safe default. All commerce
buttons use the first-party `/api/out` redirect, which re-resolves the product,
validates the exact destination, records click attribution, and applies an
affiliate network wrapper only when a real production identifier is configured.

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

`/api/catalog-refresh` is a protected, manual Supabase staging endpoint. It requires `Authorization: Bearer $CATALOG_REFRESH_TOKEN` (or `$CRON_SECRET`), `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. It is deliberately not a Vercel cron: that route stops at `needs-cutout` and cannot publish user-visible inventory. The canonical scheduled path is `.github/workflows/auto-expand.yml`: daily runs execute the complete guarded release loop, while a manual dispatch with `release=false` remains candidate-only. A scheduled run, or a manual dispatch with `release=true`, may commit, push, and deploy only after the strict publishability, repository verification, production build, and performance gates all pass. The scheduled workflow was not dispatched during this implementation; after the full local gates passed, commit `8922ed5` was pushed and manually deployed to the production `www.sylistly.com` alias with explicit user authorization. Set `CATALOG_REFRESH_SEARCHAPI=1` and `SEARCHAPI_KEY` only when intentionally running the staging endpoint with SearchAPI-backed sources in addition to free brand feeds.

`.env.example` is the canonical, non-secret environment contract. The core
strict local experience needs no paid search or AI call. Supabase service-role
values enable lifecycle/catalog persistence; `CATALOG_OPS_TOKEN` and
`CATALOG_OPS_SESSION_SECRET` protect the operator surface; affiliate IDs enable
network wrapping; and the PostHog key/host enable best-effort funnel and pipeline
analytics. Keep `NEXT_PUBLIC_ENABLE_LIVE_AI_LOOKS=0` until its model/key has been
verified. Never put service-role, refresh, operator, or affiliate credentials in
`NEXT_PUBLIC_*` variables.

Get keys:

- **Anthropic:** https://console.anthropic.com
- **SearchAPI:** https://www.searchapi.io
- **Supabase:** https://supabase.com (free tier)
- **Skimlinks:** https://skimlinks.com (auto-affiliates any outbound link)
- **Rakuten:** https://rakutenadvertising.com

## Architecture

The For You feed serves **pre-generated, coordinated outfits** from the strict
published subset (no per-view LLM/search dependency). Optional remote styling
can enhance a look, but the deterministic engine, budget cap, fresh availability,
and complete top/bottom/shoes guarantee remain authoritative.

```
 discovery/candidates ─► lifecycle + review ─► fresh strict published subset
                                                    │
                           outfit library (24k unique validated looks)
                                      │             │
                                      ▼             ▼
                             FOR YOU / REMIX     DAILY DROP
                                      │             │
                                      └──────┬──────┘
                                             ▼
                    /api/out validation + click ledger + optional affiliate
                                             │
                                             ▼
                                      exact retailer PDP
```

Migration `0005_catalog_lifecycle.sql` is the additive durable source-of-truth
foundation. The repository's static compatibility artifacts remain fail-closed
while the migration is unapplied or service-role configuration is absent. See
`docs/CATALOG_RELIABILITY.md`, `docs/CATALOG_FLOW_ACCEPTANCE.md`, and
`AUTOMATION.md` for serving, worker, retry, review, release, and rollback rules.

## Directory

The primary mobile navigation is For You (`/`), Remix (`/build`), Drop (`/drop`),
Saved (`/saved`), and You (`/profile`). Browse and Discover provide catalog and
editorial entry points; wide routes use desktop grids/rails rather than a fixed
phone shell.

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

## Product status and evidence

See `docs/FULL_PRODUCT_BUILD_PROGRESS.md` for the current before/after evidence,
`docs/ANALYTICS_KPI_SPEC.md` for metric definitions, and
`docs/INVESTOR_PRODUCT_AUDIT_2026-08-10.md` for the product-readiness assessment.
Virtual try-on, retailer checkout, photo understanding, account sync, and
affiliate conversion reporting are not claimed unless their external services
are actually configured and verified.

## License

Proprietary. All product imagery remains the property of its respective retailer; see master prompt §15 for legal posture.
