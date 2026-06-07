# HANDOFF - sylistly

<!-- State header: keep these 6 lines accurate. Both Claude and Codex read this first. Whoever acts next checks the other's last build before building. -->
- **Version:** 0.1.0
- **Turn:** Codex
- **Last build by:** Claude
- **Status:** needs-review
- **Updated:** 2026-06-07
- **Next:** SHIPPED onboarding (+ auto-generated first fit), chunk-loading hardening, dev-jargon copy cleanup, and a global route transition — all live on www.sylistly.com. Codex: review the onboarding flow (components/Onboarding.tsx + app/page.tsx), the builder auto-gen effect (app/build/page.tsx), and app/template.tsx. Open backlog: editorial AI photo built but gated on Gemini billing (free tier = $0 image quota — paid key or swap to Replicate/FLUX); dedup analyzeOutfit/CATEGORY_LABELS, dual-ALL_CATALOG_PRODUCTS rename, NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID to monetize, trim ~14.5MB committed data/catalog scratch.

---

## Log (newest first)

### 2026-06-07 — Claude Code — build (UI polish round)
- Onboarding "wow": the builder now AUTO-GENERATES the first fit on the onboarding hand-off (`app/build/page.tsx` effect — fires once when `source=onboarding`, gated on the picked vibe being applied so there's no default-vibe race). New users land on a finished, vibe-matched look instead of an empty board. Verified: `?vibe=street&frame=fem&source=onboarding` auto-composes a full streetwear fit ($743, street vibe).
- Global ROUTE TRANSITION: new `app/template.tsx` wraps every route in a subtle opacity fade-in (`.sy-route-enter`, 200ms, prefers-reduced-motion-safe). Opacity-only on purpose — a transform would establish a containing block and break every `fixed` element (bottom nav, modals, onboarding). Smoother navigation app-wide.
- Competitor framing: researched Fits (fits-app.com) — clean/minimal/light, drag-and-drop, "accessible not luxury." We lean INTO our distinctive editorial-dark identity + the AI-composed-from-real-pieces wow rather than copying their look; polishing motion to match their smoothness.
- verified: `npx tsc --noEmit` clean; `npm run build` exit 0 (template.tsx clean across all 26 routes); onboarding auto-gen confirmed rendering a real fit in dev.
- next: Codex reviews onboarding auto-gen + route transition; further polish candidates — bottom-nav active-state, fit-reveal animation, press-state audit.

### 2026-06-07 — Claude Code — build
- Built first-run ONBOARDING (was on the backlog): `components/Onboarding.tsx` — a 2-step welcome → frame (Womenswear/Menswear/Everything) + vibe picker. Shown once to genuinely new users on home (`app/page.tsx`, gated by `localStorage sylistly.onboarded.v1` + a fresh-state check: no saved fits, empty wardrobe). Completing sets profile `bodyType`+`vibe` and routes to `/build?vibe=&frame=` pre-configured. Verified live on prod (welcome screen renders).
- Hardened CHUNK LOADING (the long-noted headless ChunkLoadError, now also real-user-safe): `app/error.tsx` auto-reloads once on a ChunkLoadError (10s timestamp guard against loops; "Try again" hard-reloads for chunk errors) — seamlessly recovers the stale-chunk-after-deploy case for real users. Gated the always-mounted dynamic modals so their chunks leave the initial critical path: FitViewer + CheckoutSheet in `app/feed` (mount only when `whyPost`/`checkoutProducts` set), `app/profile` (`resolvedActivePost`/`checkoutProducts`), CheckoutSheet in `app/saved`. All three already `return null` when closed, so behavior is identical — pure win.
- COPY POLISH (found via a full prod screenshot audit of every screen): removed developer jargon from user-facing copy — `app/wardrobe` empty-state + gap line ("/feed"/"/build" raw paths → "the Feed"/"Builder"); `app/discover` rail ("Transparent-ready pieces" / "Registered cutout assets … verify the real transparent image pipeline" / "Cutout assets" badge → "Ready to style" / "Clean studio cutouts that drop straight into any look you build" / "Studio-ready") and the discovery-engine blurb ("Rails use catalog-backed feed products … local closet/wishlist state" → "Every piece here is real and shoppable — drawn from your feed, your closet, and the live catalog"); `app/stylist` starter-fit subtitle ("Real cutouts" → "Real, shoppable pieces"). catalog-lab jargon left as-is (dev-only, 404s in prod).
- verified: `npx tsc --noEmit` clean; `npm run build` exit 0; DEPLOYED to www.sylistly.com (deploy exit 0). Prod home shows onboarding; `/feed` + `/profile` 200; prod `/feed` console now clean across 4 repeated headless loads (the intermittent ChunkLoadError is gone). Full prod screen audit (home/build/feed/stylist/profile/saved/wardrobe/discover/swipe) all render correctly.
- next: Codex reviews onboarding UX + lazy-modal gating; possible follow-up — auto-generate the first fit on the onboarding→builder handoff (currently lands pre-configured and the user taps Build, intentionally avoiding a vibe-state race).

### 2026-06-06 — Claude Code — build
- Fixed outfit-collage layering (hat always on top; cohesive flat lay z-order) and rebuilt the AI to read the WHOLE eligible catalog (getFullSlotInventory, 32/slot) + fill every requested slot (hat no longer missing).
- Added AI cost guardrails: lib/ai-budget.ts (kill switch AI_ENABLED, daily cap AI_DAILY_USD_CAP, usage recording ~$0.015/generation) + lib/rate-limit.ts (per-IP), wired into /api/look, /api/stylist, /api/search; search moved Sonnet→Haiku. GET /api/stylist reports live budget.
- Builder board polish: borderless filled cells, bigger pieces, faint empty slots.
- DEPLOYED to production (www.sylistly.com) via `vercel --prod`. Fixed the 250MB serverless-function blowup by excluding public/assets/cutouts from output file tracing (next.config.js). Set non-secret cost knobs in prod env.
- next: Codex reviews; user adds ANTHROPIC_API_KEY to prod for AI outfits; recompress cutouts; optional Upstash-backed global cap.

### 2026-06-05 - Claude Code - build+check
- CHECKED Codex's pending transparent-cutout slice: typecheck/lint/build pass, directionally right. Committed it as the overhaul baseline (incl. all previously-untracked build-critical files) and deleted the stray `pages/_document.tsx`.
- BUILT a full overhaul (own branch `overhaul/ai-redesign`):
  - REAL AI OUTFIT COMPOSER (the "outfits aren't good" fix): `lib/stylist/outfit-composer.ts` + `getOutfitCandidateShortlists` in `lib/catalog.ts`. Deterministic engine is now a retriever; Claude assembles the whole look (forced tool output) over per-slot shortlists with inferred color + 1-5 formality + the user profile, optimizing color harmony/formality/silhouette/vibe/budget. `/api/look` calls it (maxDuration 20), returns stylingNotes+palette+reasons; deterministic fallback on no-key/timeout. Builder shows a "Syli's take" card. Verified live across clean/gym/office/street.
  - CATALOG 2x: generated ~375 isnet-general-use cutouts (`scripts/expand-cutouts-batch.sh`), raised CLIENT_CATALOG_LIMIT 240->560. client-catalog 217->436 (tops 22->72, shoes 36->84, bottoms 42->136).
  - REDESIGN "Editorial Noir": unified the dual-pink into one accent token, new type scale + radii/shadows (tailwind.config.ts), reworked globals.css (.sy-* + .sy-studio + .sy-rule), new BottomNav (honest active states, Closet owns Saved), bold home, profile identity fix (no hardcoded "Will Lambert"), wardrobe placeholder removal.
  - PERF: composer ~8s->~6s (haiku + dedup retriever via collectPools); builder -300 lines dead JSX; feed quality-verdict cache + simplified scroll reset; stylist model bumped to claude-sonnet-4-6.
- verified: `npx tsc --noEmit` clean throughout; FitViewer dynamic chunk serves 200 (the headless ChunkLoadError is a virtual-time artifact); production `npm run build` <see latest>.
- next: Codex reviews; candidate follow-ups — feed seeded with AI looks, prompt-caching once @anthropic-ai/sdk is bumped, recover the ~135 rejected cutouts, code-split the builder further.

### 2026-06-04T17:00:52-05:00 - Codex - build
- reviewed current feed/catalog behavior: client catalog had enough transparent products but first slices and seeds were brand/product skewed; feed rendered only two posts initially
- changed `scripts/build-client-catalog.ts`, `data/client-catalog.json`, and `data/catalog/reports/client-catalog-build-report.json` to emit a category- and brand-balanced client catalog order
- changed `lib/client-catalog.ts`, `store/social-feed.ts`, and `app/build/page.tsx` to strengthen shoe/brand diversity, generate first-screen feed seeds from transparent catalog picks, and refresh persisted feed version to v19
- changed `app/feed/page.tsx` to render 8 posts initially, use the FITS-style flatlay transparent canvas, and clean up contrast for the light feed UI
- verified with `npm run catalog:client`, direct catalog/seed probes, `npm run typecheck`, `npm run lint`, `npm run build`, and in-app browser checks for `/feed` and `/build`
- next: Claude should review the visual tradeoffs and confirm the feed first screen feels sufficiently varied on a clean localStorage profile

### 2026-06-04T00:00:00-05:00 - Codex - build
- initialized missing handoff baton
- next: finish current catalog/feed/UI improvement slice, then leave for Claude to review
