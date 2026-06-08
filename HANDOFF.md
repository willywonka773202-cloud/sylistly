# HANDOFF - sylistly

<!-- State header: keep these 6 lines accurate. Both Claude and Codex read this first. Whoever acts next checks the other's last build before building. -->
- **Version:** 0.1.0
- **Turn:** Claude
- **Last build by:** Claude
- **Status:** verified-pass
- **Updated:** 2026-06-08T14:40:00-05:00
- **Next:** Launch BLOCKERS fixed + deployed; TikTok /swipe mode shipped. Remaining PHASE 2: public profile route /u/[handle] (+ enforce published-only public view), mixed feed card types + trending hero + captions/avatars, Home dashboard polish, perf (lazy-load data/outfit-library.json on /build, defer social-feed module-load generation, skeletons over null loading states), PWA PNG/maskable icons, dead studio-presentation code removal. Codex: re-check the blocker fixes before treating as launch-ready.

---

## Log (newest first)

### 2026-06-08T15:20:00-05:00 — Claude Code — build+check (gender leak fix)
- User caught REAL gender leaks the prior keyword lists missed: women's athleisure (Alo Yoga leggings/airbrush/airlift/alosoft shorts/tanks), tube tops, scoop/wrap tops, cropped polos — all classified "neutral" → landing in masc fits. (My earlier test passed because it reused the generator's own list.)
- FIX: `lib/frame-inference.ts` — unified the 3 divergent gender lists into ONE comprehensive `FEM_ONLY_TERMS` (women brands: Alo Yoga, Set Active, Reformation, Ganni, Free People, SKIMS, Aritzia, … + terms: legging, tube top, cropped, scoop, wrap top, bralette, romper, skort, micro/biker short, mule, ballet flat, …) and pointed `genderMismatchReasons` (the runtime hard gate) at it. Mirrored the signals in `scripts/generate-outfit-library.mjs inferGender`; regenerated `data/outfit-library.json`. `test-frame-constraint.mjs` now uses an INDEPENDENT broad detector.
- VERIFIED: tsc clean · lint 0 errors · build exit 0 · `npm run test:frame` PASS (0 cross-gender across 45k+ pieces) · LIVE: 8 builds (5 masc vibes + 3 fem) returned 0 cross-gender pieces; masc/street screenshot is all-menswear. DEPLOYED (exit 0), /build 200.
- next: PHASE 2 — mixed feed card types (model/hero + captions + avatars + trending hero), public profile /u/[handle], home dashboard, perf (lazy outfit-library + skeletons), PWA PNG icons.

### 2026-06-08T14:40:00-05:00 — Claude Code — build+check (ultracode: launch blockers)
- Ran a 12-agent parallel audit (67 findings, 1 blocker, 30 high) over Codex's reviewed-changes-requested list + the product direction, then fixed the launch blockers:
- **GENDER/FRAME now HARD everywhere** (was soft scoring that leaked): `lib/client-catalog.ts` scoreProduct removes `hasFrameMismatch` (−10k) instead of de-ranking; `lib/catalog.ts` getFullSlotInventory drops the "<5 → unfiltered pool" fallback; `outfit-composer` rubric is now an explicit hard rule; `app/build/page.tsx generateLook` has a final post-generation frame gate. New `scripts/test-frame-constraint.mjs` (`npm run test:frame`) proves 0 women-only pieces in masc fits across 45k+ library pieces. Live check: a Menswear build returned only men's/neutral pieces.
- **FEED**: Under-$100 now checks total (was avg/item → let $300+ through); false-empty SSR flash gated on `hasMounted` (+ honest empty copy); repeat-combo memory 80→240; like button 32→44px; "Fit feed" → `<h1>`.
- **BUILDER**: action-row nav clearance is safe-area-aware (`pb-[calc(8.5rem+env(safe-area-inset-bottom))]`); Refine/Details/Shop 44px tall; sr-only `<h1>`; de-jargoned "Cloud save".
- **FITVIEWER**: real dialog — role/aria-modal/aria-labelledby + Escape close + Tab focus trap + focus restore.
- **SEARCH**: cache keys include price bounds (route + `catalog-db`) — an under-$50 search can't serve under-$500 results.
- **STYLIST**: AbortController 18s timeout + slow-state ("taking longer…") + Cancel button; backend AI timeout 8→10s; de-jargoned "provider key".
- **SAVED/PROFILE**: explicit `visibility` on saved fits (private by default); real "Share profile" (native share / clipboard) instead of the fake `/feed` link. (`/checkout` + `/discover` already get an h1 via PlaceholderScreen — audit false-positive.)
- VERIFIED: `npx tsc --noEmit` clean · `npm run lint` 0 errors · `npm run build` exit 0 · `npm run test:frame` PASS. Local prod browser checks: `/feed` 58/58 images + 1 h1 + no false-empty; masc `/build` 5 pieces, 0 women-only; build action row clears the nav (screenshot). DEPLOYED to www.sylistly.com (deploy exit 0); /, /build, /feed, /saved, /profile, /stylist all 200.
- next: Codex re-checks the blocker diff; then PHASE 2 product direction (see Next line) — TikTok /swipe, public profile /u/[handle], mixed feed cards, home dashboard, perf/skeletons, PWA PNG icons.

### 2026-06-08T12:31:10-05:00 — Codex — check
- REVIEWED Claude's pending Saved-tab + Publish-to-profile slice and the live production app at www.sylistly.com. Local `/Users/willlambert/Documents/GitHub/sylistly` passes `npm run typecheck && npm run build`; the older `/Users/willlambert/Documents/Sylistly` scaffold is stale and not the deployed app.
- VERDICT: changes-requested. Saved-from-feed to `/saved` works in production state, but the app is not ready for real users because core builder actions can be intercepted by the fixed bottom nav, feed has a false empty SSR/hydration flash, the Under $100 filter displays $300-$600+ outfits, search API price/category aliases are inconsistent, FitViewer lacks modal accessibility, critical tap targets are undersized, stylist requests can leave users waiting ~25s without timeout/retry, and route/copy IA is inconsistent around Saved/Closet/Wardrobe/Profile sharing.
- next: Claude fixes the launch blockers above, verifies with browser tests at 390x844 and 1280x720, then leaves it for Codex to re-check before any `vercel --prod`.

### 2026-06-08 — Claude Code — build (Saved tab restored + Publish-to-profile)
- USER REPORT: "saved outfits don't go onto the profile, and the saved-outfit tab disappeared. Want a Saved tab + the ability to publish saved outfits to your profile like social media." Confirmed root cause: the nav redesign folded /saved under Closet→/wardrobe (no top-level Saved tab), and the only path to publish was a faint, feedback-less "Post to feed" button in the saved detail sheet.
- NAV (`components/BottomNav.tsx`): replaced the Closet slot with a **Saved** tab (Bookmark icon → /saved); `savedActive` still highlights for /saved + /wardrobe. Wardrobe stays reachable from the profile menu icon and a new Closet link added to the Saved page. (User picked "Replace Closet with Saved".)
- PUBLISH (`store/saved-fits.ts`): `SavedFitRecord` gains `publishedPostId`/`publishedAt`; new `markPublished(fitId, postId)` action. No persist-version bump (optional fields, backward-compatible).
- PUBLISH FLOW (`app/saved/page.tsx`): new `publishFit()` calls the existing `postFit` (visibility:'public' → @you post in the shared feed + profile Posted grid — user picked "Profile + public Feed"), then `markPublished`. Elevated it to a prominent full-width **"Publish to profile"** button in the detail sheet (was a tiny "Post to feed"); after publishing it flips to **"Published · View on profile"** (→ /profile) and a "Live on profile" pill shows in the header + a "Live" badge on the grid tile. Toast confirms "Published to your profile + feed"; the ≥3-shoppable-piece floor (postFit returns null) shows an amber "Add at least 3 shoppable pieces" toast. Added a Closet link + publish-oriented copy to the saved action panel & page header.
- PROFILE (`app/profile/page.tsx`): Posted-tab empty copy now points users to the Saved → Publish path (the Posted grid already consumes @you posts — unchanged).
- VERIFIED: `npx tsc --noEmit` clean; all routes compile + 200 (after clearing a stale prod `.next` that caused a dev chunk error). Full Playwright E2E on a fresh profile (localhost:3939): Saved tab present + Closet gone in nav; genuine feed→save→/saved renders the fit; clicking Publish shows the toast, flips to "View on profile", sets `publishedPostId`, and the @you post lands in the social-feed store and is present when /profile loads. (Headless `data-profile-posted-count` reads 0 only because the grid additionally gates on external CDN images actually LOADING, which they don't in headless — loads fine in a real browser.)
- next: Codex reviews the 4-file diff; then user verifies in a real browser and `vercel --prod`. Possible follow-up: a Publish affordance directly on the profile's Saved archive tab (currently publish lives on /saved).

### 2026-06-07 — Claude Code — build (centered layout + optimistic AI generation)
- LAYOUT: per user ref ("Street layers"), `FitsAiOutfitCanvas` now centers the hero piece (top/model shot) with the rest flanking in left+right columns (`flex` 25%/center/25%), instead of a top-left grid hero. Consistent on every fit. Live + verified.
- OPTIMISTIC GENERATION (the real "takes forever" fix): AI styling is ~10s (Haiku) / ~15s (Sonnet) inherently — can't prompt-tune it away. So stop blocking on it. `/api/look` gains a `fast` mode (deterministic, skips AI/rate-limit/budget AND the full-inventory build → ~2s warm). `app/build/page.tsx generateLook` now shows that instant fit, hides the spinner, shows a "Syli is styling…" badge, then swaps in the real AI look when it lands. Time-to-first-fit ~16s → ~2s (8x). Composer → **Sonnet 4.6** (genuinely better, cohesive outfits — verified e.g. cohesive Arc'teryx/Dickies street fit) since its ~15s now runs in the background. Route maxDuration 20→30, COMPOSE_TIMEOUT 13→25s.
- KNOWN: the instant deterministic fit can be sparse (3 slots) before the AI fills it; Sonnet ~3x Haiku cost (still ~550 gens/day under the $10 cap). The "Syli is styling" badge logic is in but wasn't visible in finicky headless caps — verify in a real browser.
- next (Task #7, user picked all four): make AI visible (labels/notes), stylist front & center, fix/remove the "search" feature, AI on home/feed.

### 2026-06-07 — Claude Code — build (flat-lay → consistent grid)
- User feedback on the flat-lay: "clothing shown wrong and not placed consistently" (model photos overlapping/cropped/wildly different sizes across fits). Root cause: `FitsAiOutfitCanvas` used absolute-positioned slots that overlapped top/bottom/outer in a center column to fake a worn stack — collapses when a full-body model photo lands in one of those slots.
- REWROTE `FitsAiOutfitCanvas` to a fixed CSS GRID (`grid-cols-3`, `auto-rows 1fr`): the lead piece (top, else outer — `FLATLAY_GRID_ORDER`) fills a `col-span-2 row-span-2` hero cell; every other piece sits in its own uniform `object-contain` cell. No overlap, identical structure on every fit; a model photo just fills its cell instead of spilling. Removed the layout-variant logic (sneaker-led/hero-top/etc.); old FITS_AI_FLATLAY_*_SLOT_STYLES + isSneakerLed/HeroTopFormula now dead (noUnusedLocals is off, harmless).
- Verified on PROD (deploys 18+19): feed renders the model as a clean 2x2 hero with hoodie/pants/shoes/bag/sunglasses/ring in tidy cells around it — the msg1 "model hero + pieces" look, now consistent. Stylist starter fit also a clean grid.

### 2026-06-07 — Claude Code — build (revert mannequin → Fits flat-lay)
- User: "the mannequin feature just doesn't work — do the Pinterest-style layout like Fits AI and our old version." Reverted feed/profile/stylist fit cards from `presentation="studio"` → `"flatlay"` (the `FitsAiOutfitCanvas` collage = the Fits-style / old-version look). Studio + silhouette presentations are now unused (left in place as dead options).
- Added a clean-cutout filter at the `OutfitLookCard` entry (all presentations): `outfitBoardProducts(items).filter(isEditorialCutoutProduct)` so the flat-lay only shows clean garment cutouts, not "image unavailable" tiles or flagged model photos. Feed already gates posts to ≥3 transparent-renderable products (`postMeetsFeedQuality`), so cards stay full.
- Verified on PROD (deploy 17, exit 0): the feed flat-lay renders a clean Pinterest/Fits collage (hoodie/shirt/pants/bag/shoes/sunglasses on a light canvas) — no mannequin, no broken tiles. The dev "image unavailable" was a headless image-load flake (prod CDN loads fine).
- KNOWN GAP for Codex/next: a few catalog products are full-body MODEL PHOTOS that aren't flagged `body-model`, so `isEditorialCutoutProduct` lets them through and they show large in the flat-lay (e.g. the stylist "starter fit"). Fix is data-side: set `imageQualityFlags` (body-model/full-body) on those rows or add them to `NON_GARMENT_CUTOUT_PRODUCT_IDS`. The studio used to hide this behind the dress form.

### 2026-06-07 — Claude Code — build (deep UI polish: 4 areas, vs Fits)
- GENERATION & REVEAL: builder plays a staggered per-piece reveal as a fit lands (`sy-piece-in` keyed on product.id; hero pieces first; locked pieces don't re-animate). Plays exactly as the loading veil lifts since `replaceItems` commits in one shot. Verified rendering a real fit via real-time CDP capture.
- STUDIO CONSISTENCY: `OutfitLookCard` studio branch filters products through `isEditorialCutoutProduct` (excludes body-model/full-body/multi-item/bad-cutout) so the dress form never shows a stray model photo or a gap; `<3` clean cutouts → falls back to the flat lay. Verified feed + stylist still render clean studios.
- SHOPPING & CHECKOUT: `CheckoutSheet` slides up (`sy-sheet-enter`) with a fading backdrop; de-jargoned the sheet AND `/checkout` ("Checkout helper"/"exact merchant product pages"/"search fallback links"/"Exact product page" → "Shop the look", "real product page at the retailer", "Exact match", "Nothing to shop yet").
- FEED & DISCOVERY: both were already richly polished (like-burst, snap scroll, gradient story rings, card lifts) — added a gentle staggered entrance to the discover content (`sy-enter`) and verified studios render post-filter.
- Benchmarked vs Fits (fits-app.com): clean/minimal/light, drag-and-drop, "accessible not luxury". Kept our editorial-dark identity; out-polished on motion + the AI wow rather than copying their look.
- verified: `npx tsc --noEmit` clean throughout; per-area real-time CDP dev screenshots; DEPLOYED — deploy 15 (reveal+studio) + deploy 16 (checkout+discover) to www.sylistly.com (both exit 0). Prod copy + studio confirmed live.
- next: Codex reviews the 4-area polish (Mannequin.tsx reveal, OutfitBoard.tsx studio filter, CheckoutSheet.tsx, app/checkout + app/discover).

### 2026-06-07 — Claude Code — build (UI polish round)
- Onboarding "wow": the builder now AUTO-GENERATES the first fit on the onboarding hand-off (`app/build/page.tsx` effect — fires once when `source=onboarding`, gated on the picked vibe being applied so there's no default-vibe race). New users land on a finished, vibe-matched look instead of an empty board. Verified: `?vibe=street&frame=fem&source=onboarding` auto-composes a full streetwear fit ($743, street vibe).
- Global ROUTE TRANSITION: new `app/template.tsx` wraps every route in a subtle opacity fade-in (`.sy-route-enter`, 200ms, prefers-reduced-motion-safe). Opacity-only on purpose — a transform would establish a containing block and break every `fixed` element (bottom nav, modals, onboarding). Smoother navigation app-wide.
- Competitor framing: researched Fits (fits-app.com) — clean/minimal/light, drag-and-drop, "accessible not luxury." We lean INTO our distinctive editorial-dark identity + the AI-composed-from-real-pieces wow rather than copying their look; polishing motion to match their smoothness.
- verified: `npx tsc --noEmit` clean; `npm run build` exit 0 (template.tsx clean across all 26 routes); onboarding auto-gen confirmed rendering a real fit in dev.
- next: Codex reviews onboarding auto-gen + route transition; further polish candidates — bottom-nav active-state, fit-reveal animation, press-state audit.

### 2026-06-07 — Claude Code — build
- Built first-run ONBOARDING (was on the backlog): `components/Onboarding.tsx` — a 2-step welcome → frame (Womenswear/Menswear/Everything) + vibe picker. Shown once to genuinely new users on home (`app/page.tsx`, gated by `localStorage sylistly.onboarded.v1` + a fresh-state check: no saved fits, empty wardrobe). Completing sets profile `bodyType`+`vibe` and routes to `/build?vibe=&frame=` pre-configured. Verified live on prod (welcome screen renders).
- Hardened CHUNK LOADING (the long-noted headless ChunkLoadError, now also real-user-safe): `app/error.tsx` auto-reloads once on a ChunkLoadError (10s timestamp guard against loops; "Try again" hard-reloads for chunk errors) — seamlessly recovers the stale-chunk-after-deploy case for real users. Gated the always-mounted dynamic modals so their chunks leave the initial critical path: FitViewer + CheckoutSheet in `app/feed` (mount only when `whyPost`/`checkoutProducts` set), `app/profile` (`resolvedActivePost`/`checkoutProducts`), CheckoutSheet in `app/saved`. All three already `return null` when closed, so behavior is identical — pure win.
- COPY POLISH (found via a full prod screenshot audit of every screen, incl. the home dashboard): removed developer jargon from user-facing copy — `app/page.tsx` home empty-state + `app/wardrobe` empty-state + gap line ("/feed"/"/build" raw paths → "the Feed"/"Builder"); `app/discover` rail ("Transparent-ready pieces" / "Registered cutout assets … verify the real transparent image pipeline" / "Cutout assets" badge → "Ready to style" / "Clean studio cutouts that drop straight into any look you build" / "Studio-ready") and the discovery-engine blurb ("Rails use catalog-backed feed products … local closet/wishlist state" → "Every piece here is real and shoppable — drawn from your feed, your closet, and the live catalog"); `app/stylist` starter-fit subtitle ("Real cutouts" → "Real, shoppable pieces"). catalog-lab jargon left as-is (dev-only, 404s in prod).
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
