# Sylistly — AI Outfit Builder

AI-powered outfit builder (search, mannequin, feed, discover, saved, profile) with real product shopping.

## Personalized for Will (July 2026)

- **Profile defaults** tuned for gym-bro / athletic / SoCal / SDSU (bodyType `masc`, vibes `gym athletic casual socal college`, brands Nike · Gymshark · Vuori · Uniqlo · Adidas, mid budget).
- **New `/wardrobe` (Closet) page** — interactive Priority 1 SDSU college starter checklist with owned toggles, prices, buy links, and notes. Data lives in `data/college-wardrobe.ts`.
- **Profile** has a prominent “My College Wardrobe” card linking to the closet.
- Bottom nav includes both **Closet** and **Saved**.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript + Tailwind CSS
- Supabase (auth + Postgres)
- Anthropic Claude (query parsing + re-ranking)
- SearchAPI / shopping search
- Skimlinks / affiliate wrapping
- PostHog (analytics)
- Zustand stores

## Quick start

```bash
pnpm install
cp .env.example .env.local   # fill keys
# run Supabase migration if needed: supabase/migrations/0001_initial.sql
pnpm dev
# http://localhost:3000
```

## Environment

Required for full live search:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `SEARCHAPI_KEY` (or equivalent)

Without keys, search falls back to mock/demo data (explicitly labeled in UI where possible).

Optional: Skimlinks/Rakuten, PostHog, Phase-2 try-on keys.

## Key routes

- `/build` — outfit builder + search
- `/wardrobe` — personal SDSU college closet checklist
- `/feed`, `/swipe`, `/discover`, `/saved`, `/profile`

## Remaining improvements (tracked as issues)

- Search reliability under rate limits + clearer demo/live distinction
- Stronger “shop full look” flow
- Phase 2 virtual try-on
- Further Discover curation for gym/SDSU vibes
- Image quality & catalog health polish

## License

Proprietary. Product imagery belongs to respective retailers.
