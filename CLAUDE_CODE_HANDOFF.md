# Claude Code Handoff For Sylistly

This file is the clean handoff for continuing Sylistly in Claude Code.

## Source Of Truth

Use this folder as the only source of truth:

- `/Users/willlambert/Documents/Codex/2026-04-21-files-mentioned-by-the-user-faac6441/sylistly-nextjs`

Do not merge or reuse the divergent earlier prototype:

- `/Users/willlambert/Documents/Sylistly`

That older folder has drift we do not want to carry forward.

## Files To Upload To Claude Code

Upload these files and folders:

1. The full project folder:
   - `/Users/willlambert/Documents/Codex/2026-04-21-files-mentioned-by-the-user-faac6441/sylistly-nextjs`
2. The prior Codex handoff:
   - `/Users/willlambert/Library/Application Support/Claude/local-agent-mode-sessions/37eb60af-411a-4a7c-8d4a-1cdd659b2a7d/44c00edc-a395-4cfa-871f-ec6f250d651f/local_2f503246-b73b-410f-98cb-2e0964a2056c/outputs/CODEX_HANDOFF.md`
3. The original master product/design prompt:
   - `/Users/willlambert/Library/Application Support/Claude/local-agent-mode-sessions/37eb60af-411a-4a7c-8d4a-1cdd659b2a7d/44c00edc-a395-4cfa-871f-ec6f250d651f/local_2f503246-b73b-410f-98cb-2e0964a2056c/outputs/SYLISTLY_MASTER_PROMPT.md`
4. The visual HTML prototype:
   - `/Users/willlambert/Library/Application Support/Claude/local-agent-mode-sessions/37eb60af-411a-4a7c-8d4a-1cdd659b2a7d/44c00edc-a395-4cfa-871f-ec6f250d651f/local_2f503246-b73b-410f-98cb-2e0964a2056c/outputs/sylistly.html`
5. Optional but useful visual reference video:
   - `/Users/willlambert/Downloads/FAAC6441-6A69-43A9-8AFB-F1825E896B10.mov`

Do not upload `.env.local` if you do not want secrets copied around. Just tell Claude Code the env vars exist locally or will be added locally.

## Local Env Vars

These are the important env vars for full production behavior:

- `SERPAPI_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional affiliate vars:

- `RAKUTEN_AFFILIATE_ID`
- `SKIMLINKS_PUBLISHER_ID`

## Current Project State

This is what has already been done in Codex:

- `sylistly-nextjs` was established as the only real scaffold/source of truth.
- Search API was partially upgraded to use real SerpAPI shopping results and direct retailer links.
- Search was changed away from firing on every keystroke and now runs manually.
- Search cards were redesigned to show clearer name, price, retailer, and selection flow on mobile.
- Discover, Saved, and Profile were changed from 404 routes into placeholder screens.
- Explicit demo mode was added for development because SerpAPI hit `429` rate limits during verification.
- Demo mode is manually available from the search sheet and clearly labeled as demo data.
- Broken demo-image paths were replaced with inline SVG demo art and image fallbacks.
- Product card links were changed away from popup-style opening.
- `Shop full look` was changed from opening blocked popups into a link-list style flow in the builder.
- Typecheck was passing at the last verification point.

## Important Reality Check

The app is still not finished or polished enough.

The user feedback is essentially:

- search does not feel as fast and clean as the video
- shopping is the core value and still does not feel solid enough
- the app still feels unfinished overall
- the builder flow should feel smooth, intentional, visual, and mobile-native

## Known Important Files Already Touched

- `app/api/search/route.ts`
- `lib/serpapi.ts`
- `lib/claude.ts`
- `lib/mock-products.ts`
- `lib/supabase.ts`
- `components/SearchSheet.tsx`
- `components/ProductCard.tsx`
- `components/SlotList.tsx`
- `components/Mannequin.tsx`
- `components/BottomNav.tsx`
- `app/page.tsx`
- `app/discover/page.tsx`
- `app/saved/page.tsx`
- `app/profile/page.tsx`

## Biggest Known Problems / Gaps

These are the main issues Claude Code should treat as real product gaps, not just code cleanup:

1. The core builder-search-shop flow still does not feel production-ready.
2. Live search can be rate-limited by SerpAPI, so the fallback/development path must remain clean and explicit.
3. Shopping flow still needs stronger architecture and polish.
4. Saved flow is not truly finished.
5. The placeholder screens stop the app from breaking, but they are not finished product surfaces.
6. The app needs a stronger visual and interaction match to `sylistly.html` and the reference video.
7. Mobile UX still needs refinement so the app feels like a fashion product, not a developer prototype.

## Specific Notes From This Codex Session

### Search

- Real search worked and returned real product names, prices, and retailer URLs.
- Direct retailer-link resolution was improved.
- Search latency improved for some queries after trimming the heaviest lookup path.
- A full test sweep triggered SerpAPI `429` rate limiting.
- When rate-limited, the API now returns a clear error and indicates demo mode is available in development.

### Demo Mode

- Demo mode is development-only and explicit.
- It can be triggered manually in the search sheet.
- Demo results are labeled so they are not confused with live search.
- Demo products now use inline SVG image data so demo search no longer depends on a missing `/public/mock` folder.

### Shopping

- Product cards now have a direct `View item` action that navigates instead of trying to open blocked popups.
- `Shop full look` was changed to show a list of item links in-app because popup-style multi-open behavior was poor in the in-app browser.
- This area likely still needs deeper design and architecture work.

### Saved / Supabase

- Save/auth/storage are still not fully production-complete.
- Some server flows still depend on Supabase configuration and product persistence.
- If Supabase env vars are absent, those flows need either graceful degradation or completion.

## Exact Prompt To Paste Into Claude Code

```text
Use /Users/willlambert/Documents/Codex/2026-04-21-files-mentioned-by-the-user-faac6441/sylistly-nextjs as the only source of truth.

Important constraints:
- Do not merge anything from /Users/willlambert/Documents/Sylistly. That folder is a divergent early prototype and should be ignored.
- Use the uploaded CODEX_HANDOFF.md, SYLISTLY_MASTER_PROMPT.md, sylistly.html, and optional video as product/design context.
- Keep the app aligned with the visual feel and interaction quality of sylistly.html and the video.
- Do not commit secrets or ask me to paste secrets into chat. Assume env vars are set locally.

Current status from Codex:
- Search API was partially upgraded to use real SerpAPI shopping results and direct retailer links.
- Search hit SerpAPI 429 rate limits during testing, so a development-only explicit demo mode was added.
- Demo mode is now manually available from the search sheet and returns local sample products.
- Search cards were redesigned to show name, price, retailer, and a clearer mobile layout.
- Discover, Saved, and Profile were turned from 404s into placeholder pages.
- Shop full look was changed away from popup-style opening and now shows a link list modal because popup behavior was bad in the in-app browser.
- Demo images were broken because /mock assets did not exist; that was replaced with inline SVG placeholder/product art and image fallbacks.
- Typecheck was passing at the last verification point.
- The app is still incomplete and not polished enough. The user’s feedback is that the app “overall doesn’t work,” search does not feel as fast/clean as the reference, shopping is not the core polished flow yet, and the app still feels unfinished.

Known important files already touched:
- app/api/search/route.ts
- lib/serpapi.ts
- lib/claude.ts
- lib/mock-products.ts
- lib/supabase.ts
- components/SearchSheet.tsx
- components/ProductCard.tsx
- components/SlotList.tsx
- components/Mannequin.tsx
- app/page.tsx
- components/BottomNav.tsx
- app/discover/page.tsx
- app/saved/page.tsx
- app/profile/page.tsx

What I want you to do:
1. Audit the app against the uploaded handoff/prototype/video and identify the biggest gaps in product behavior, UX, and architecture.
2. Make the builder flow genuinely usable end-to-end.
3. Prioritize the core path:
   - search for items
   - see attractive cards with images, names, prices, retailers
   - add items to outfit
   - shop each item / shop full look
4. If live search is rate-limited or incomplete, keep a clean demo/development fallback, but make it obvious in the UI when results are demo data.
5. Finish or improve any broken foundations:
   - stale placeholder screens
   - missing saved flow
   - bad shopping flow
   - missing state handling
   - broken or awkward mobile interactions
   - poor image fallbacks
6. Preserve the strongest current work:
   - source of truth is sylistly-nextjs
   - manual search flow instead of searching on every keystroke
   - cleaner product cards
   - explicit rate-limit messaging
7. Do not stop at analysis. Implement fixes directly.
8. Keep the app runnable locally with npm run dev.
9. Verify your changes by actually running the app and testing the core flow.
10. At the end, give me:
   - what you changed
   - what still is not finished
   - which env vars are still needed for full production behavior

Specific product goals:
- The app should feel fast, intentional, and polished on mobile.
- Search should feel clean and visual, not like a debug tool.
- The shopping action is the core value and must feel reliable.
- Demo mode is acceptable for development, but the UI must clearly distinguish demo vs live.
- Avoid broken routes, dead buttons, vague errors, and blank image states.

Please start by:
- reading the uploaded handoff/prototype files
- auditing the current codebase
- making a concrete implementation plan
- then executing it end-to-end
```

## Shorter Prompt Option

```text
Finish the Sylistly app in /Users/willlambert/Documents/Codex/2026-04-21-files-mentioned-by-the-user-faac6441/sylistly-nextjs using the uploaded handoff docs, sylistly.html, and video as reference. Do not use /Users/willlambert/Documents/Sylistly. Focus on the builder/search/shop flow, polish mobile UX, keep demo mode explicit for rate-limited live search, and implement fixes directly instead of just planning.
```

## Important Things To Tell Claude Code

- The main live-testing blocker is SerpAPI rate limiting, not only code quality.
- Demo mode exists intentionally and should remain explicit.
- The shopping flow is central and should be treated as the highest-priority product path.
- Saved/auth/profile/discover should not break the app, but the builder path matters most.
- Browser-persisted local state may still contain stale older items from previous runs.
- If broken old mock thumbnails appear after reload, clearing local fit state may help.

## Recommended Ask From Claude Code

Ask Claude Code to do all of this, not just review:

1. Read the uploaded product/design context.
2. Audit the current implementation.
3. Make a concrete execution plan.
4. Implement improvements directly.
5. Run the app.
6. Test the core builder-search-shop flow.
7. Report what is fixed, what remains, and any env dependencies.

