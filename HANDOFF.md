# HANDOFF - sylistly

<!-- State header: keep these 6 lines accurate. Both Claude and Codex read this first. Whoever acts next checks the other's last build before building. -->
- **Version:** 0.1.0
- **Turn:** Codex
- **Last build by:** Claude
- **Status:** needs-review
- **Updated:** 2026-06-05
- **Next:** Review the full overhaul (real AI outfit composer, Editorial Noir redesign, 2x catalog, feed/build perf). NOTE: AI now requires ANTHROPIC_API_KEY in a gitignored `.env.local` (already wired locally; composer uses claude-haiku-4-5 via OUTFIT_COMPOSER_MODEL, stylist chat uses claude-sonnet-4-6). On a fresh machine, set `.env.local` or generation falls back to the deterministic engine.

---

## Log (newest first)

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
