# Sylistly full-product build goal

Paste everything inside the code block into `/goal`.

```text
Rebuild and harden Sylistly into a polished, genuinely useful, investment-ready fashion discovery and shopping product. Continue until the product, catalog, automation, and verification requirements below are met and evidenced. Do not stop at mockups, plans, partial wiring, or a prettier landing page.

CANONICAL SCOPE

- Work only in the canonical production repository: /Users/willlambert/Documents/GitHub/sylistly
- The live product to audit and match is https://www.sylistly.com/ (including its authenticated and public routes), not the retired prototype at /Users/willlambert/Documents/Sylistly.
- Read these first: README.md, package.json, vercel.json, .github/workflows/auto-expand.yml, docs/INVESTOR_PRODUCT_AUDIT_2026-08-10.md, and all catalog/outfit generation, availability, affiliate, Supabase, image-processing, analytics, and recommendation code.
- Inspect git status, the active branch, its relationship to origin/main, and existing local changes before editing. Preserve all unrelated work. Do not reset, overwrite, or discard user changes.
- Re-audit the live production site and compare it with the local implementation before making design decisions. Treat production behavior and real source data as evidence; do not infer that code paths are active merely because they exist.
- Work locally through implementation and verification. Do not push, merge, promote, or deploy without explicit user authorization. If deployment is later authorized, deploy only after all gates below pass and keep a safe rollback path.

PRODUCT NORTH STAR

Sylistly's primary promise is:

“Show me a complete outfit I genuinely like, within my budget, that I can buy right now—and let me replace any piece without breaking the look.”

Every product and visual decision should strengthen that promise. The app should feel editorial, premium, fast, and trustworthy—not like a generic SaaS dashboard, a cluttered game UI, or an affiliate-link directory.

SUCCESS OUTCOMES

1. A first-time visitor can express taste, size/fit constraints, budget, and shopping preferences, then reach useful complete looks quickly.
2. Every primary outfit shown as shoppable is complete and currently buyable, or missing pieces are automatically replaced before it is shown.
3. Each product has a real, exact product link; current price, retailer, image, stock/availability state, and last-verification timestamp; and an affiliate-wrapped outbound URL when production affiliate configuration is enabled.
4. A user can save, dislike, shop, share, remix, and replace one piece while preserving budget and visual compatibility.
5. Mobile feels exceptional, and desktop is a true desktop experience rather than a clipped phone shell.
6. The catalog can grow continuously through an observable, idempotent, quality-controlled pipeline instead of manual JSON editing.
7. The build is measurable: analytics, catalog health, conversion events, performance budgets, and operational alerts are wired and documented.

PHASE 1 — BASELINE AND EVIDENCE

- Capture current mobile and desktop screenshots for the key flows and document the most serious usability, trust, conversion, responsiveness, and accessibility failures.
- Establish baselines for: published/live products, unavailable products, unique complete outfits, fully buyable-look rate, links verified within 24 hours, broken-link rate, missing metadata, duplicate rate, image/cutout quality, route bundle sizes, and core page performance.
- Trace the real data flow from discovery through publish and from product record through feed card and outbound retailer click. Identify dead code, inactive configuration, static build bottlenecks, and automation that is defined but not actually scheduled.
- Do not fabricate metrics. If a measurement cannot be obtained, add the instrumentation or validation required to obtain it.

PHASE 2 — VISUAL SYSTEM AND EXPERIENCE REDESIGN

Create a cohesive visual target before broad UI implementation. Produce exactly three clearly different design directions grounded in the existing Sylistly identity, evaluate them against premium feel, legibility, shoppability, responsiveness, speed, and distinctiveness, then choose and document the strongest direction. The user authorizes you to select the strongest direction and continue without pausing unless a genuinely material business decision cannot be inferred.

Preserve and elevate Sylistly's recognizable noir/champagne/hot-pink identity, strong product cutouts, editorial voice, and fashion-first character. Refine the system so the hot pink is an intentional action/accent color rather than constant visual noise. Establish and consistently apply:

- typography hierarchy and readable text sizes;
- color tokens with accessible contrast;
- spacing, radii, borders, shadows, surfaces, and depth;
- product imagery and cutout standards;
- button, chip, badge, card, sheet, dialog, navigation, empty, loading, error, and success states;
- restrained motion with reduced-motion support;
- a responsive grid and breakpoint system for compact mobile through wide desktop.

Redesign and implement all primary experiences as one coherent product:

- first-run value proposition and style onboarding;
- For You / Looks feed (rename or clarify “Map” so the core product is immediately understandable);
- Discover and search;
- Browse/catalog with meaningful filters and sorting;
- outfit detail and shop flow;
- Remix / outfit builder;
- Saved looks and saved pieces;
- Daily Drop, quests, rewards, and vault, only where they strengthen shopping and retention;
- profile, preferences, account, privacy, and notification settings;
- shareable public look pages;
- internal catalog operations/health dashboard.

Mobile requirements:

- Optimize for 390x844 and nearby modern phone sizes, including safe areas.
- Keep primary actions thumb-reachable, targets at least 44x44 CSS pixels, sheets/dialogs fully usable, and content free of horizontal clipping.
- Reduce each feed card to the information needed for a decision: the look, total/current price, buyability, key match reason, save/dislike, shop, and remix. Move secondary metadata into progressive disclosure.
- Load the first useful look quickly; onboarding should demonstrate value before demanding an account.

Desktop requirements:

- Build a true responsive desktop layout at 1440x900 and wider: navigation/sidebar, central discovery canvas, and useful contextual panel or multi-column catalog where appropriate.
- Never center a fixed-width phone shell as the desktop product.
- Dialogs, sheets, imagery, filters, and navigation must remain entirely inside the viewport with no clipped right edge or hidden controls.

Accessibility requirements:

- Target WCAG 2.2 AA for contrast, semantic structure, keyboard navigation, visible focus, dialogs/focus trapping, labels, alternative text, status announcements, and reduced motion.
- Test the core flow with keyboard-only navigation and at least one screen-reader-oriented DOM/ARIA audit.

PHASE 3 — REAL USER VALUE

Implement or complete these capabilities end to end using real data and persistent state:

- Budget-first shopping: onboarding budget range, editable default budget, quick budget chips, and clear handling of sale/current versus original price. Do not present very expensive default looks to a budget-conscious new user.
- Size and fit: sizes, fit preference, body/frame inputs already supported by the model, and filtering that avoids presenting obviously unavailable sizes when size data exists.
- Preference controls: brands, retailers, categories, colors, materials where known, exclusions, price tolerance, occasion, and style goals. Ask only for information that materially improves results.
- Taste learning: make like/save/dislike/pass/remix/shop signals update future rankings. Show concise, credible reasons for recommendations without pretending certainty.
- Complete-look guarantee: do not show a primary shoppable look with unavailable pieces. Repair it automatically using compatible, in-stock substitutes within the user's budget and constraints; otherwise withhold it from the primary feed.
- Piece replacement: replace any item by category while preserving visual compatibility, availability, size when known, and total budget. Explain price changes clearly.
- “Style what I own”: allow a user to provide a product URL and, if feasible with the existing stack, a photo; normalize it into a temporary or saved piece and build compatible buyable looks around it. Never pretend image understanding succeeded when it did not.
- Saved state: saved looks, saved pieces, history, preference changes, and remix results must survive refresh. Support local-first value and make account creation optional until cross-device persistence, alerts, or another clear benefit is requested.
- Search/discovery: support useful text search, category, brand, retailer, price, color, availability, and sort controls with fast empty/loading/error states.
- Shopping: show an honest itemized list, exact retailer destination, current verification time, unavailable substitutions, and total. If multi-retailer checkout cannot actually be completed in-app, call the action “Shop items” or similarly honest language, not “Checkout.”
- Trust and safety: never invent availability, sale prices, discounts, ratings, reviews, demand, scarcity, social proof, or sustainability claims. Label sponsored/affiliate relationships clearly and provide working privacy, terms, affiliate disclosure, account deletion, and data-control paths appropriate to the product.

PHASE 4 — CATALOG, LINKS, OUTFITS, AND AUTOMATION

Replace the fragmented/static catalog path with one reliable source of truth and an explicit publish lifecycle:

discovered → normalized → deduplicated → enriched → image-ready → link/price/stock verified → approved → published → retired

Design and implement the storage, jobs, APIs, and compatibility layer needed so the current app can migrate safely without losing working records. Use the existing Supabase/Vercel infrastructure where configured; do not print secrets or invent credentials.

Each publishable product must have, at minimum:

- stable canonical ID and source ID;
- normalized brand, title, category/subcategory, colors, and useful style tags;
- retailer and exact product URL, not a search page or homepage;
- current price, optional original price only when verified, currency, and timestamp;
- availability state, stock/size data where the source provides it, and last checked timestamp;
- primary image, processed cutout/image state, source attribution, and quality/confidence flags;
- affiliate eligibility and wrapped URL behavior where configuration exists;
- moderation/review status, failure reason, and audit history.

Build the largest useful catalog, not the largest pile of unverified rows:

- Ingest from compliant, permitted sources already present in the codebase: retailer/affiliate feeds, APIs, sitemaps, structured product pages, Shopify endpoints, SearchAPI results, and existing staged candidates. Respect source terms, robots/policies, rate limits, and affiliate rules.
- Process every existing staged candidate through normalization, deduplication, enrichment, image/cutout processing, validation, and publish or explicit rejection.
- Add pluggable source adapters and retailer normalization so new sources can be added without rewriting the pipeline.
- Deduplicate by canonical URL, retailer/source IDs, image/hash, normalized brand/title, and variant relationships.
- Make jobs idempotent, resumable, retryable with backoff, concurrency-limited, budget-capped, and safe to dry-run.
- Run availability, price, and destination-link health checks daily; retire or quarantine failures and repair affected outfits automatically.
- Generate cutouts asynchronously, reject low-quality results, retain original images, and expose a review queue for ambiguous cases.
- Auto-approve only high-confidence records. Route uncertainty, policy issues, image defects, and suspicious pricing to a human-review queue.
- Create an internal operations view showing stage counts, throughput, age, source health, failures, retries, cost, review queue, broken links, stale prices, unavailable products, and outfits requiring repair.
- Add actionable alerts for pipeline failure, stale health checks, sudden catalog shrinkage, broken-link spikes, affiliate-wrap failures, and source degradation.

Fix the currently incomplete automation chain so scheduled discovery actually results in approved products becoming visible in the app without manual JSON editing or a forgotten local scheduler. Ensure scheduled workflows exist on the branch that actually runs them. The complete path must cover discovery, validation, cutout/image work, approval policy, publication, recommendation/outfit index updates, cache invalidation or rebuild where truly necessary, health reporting, and rollback.

Catalog and outfit acceptance targets:

- Preserve all currently valid live products; never inflate counts with unverified candidates.
- Publish at least 1,000 live, exact-linked, image-ready, recently verified products if the available compliant sources and existing credentials can supply them. If external credentials are the only blocker, complete and test the full pipeline with available sources, document the exact missing external dependency, and do not fake the count.
- Expand the unique validated complete-look pool to at least 2x its measured starting diversity across frames, vibes, categories, budgets, occasions, brands, and retailers. Measure true diversity and duplicate rate rather than merely multiplying permutations.
- Maintain a 100% buyable rate for looks in the primary feed at render time; unavailable pieces must trigger substitution or suppression.
- Keep at least 95% of published product links verified within the preceding 24 hours and expose the exceptions operationally.
- Validate outbound redirect destinations and affiliate wrapping in a safe test mode. Preserve clear source URLs internally for debugging and compliance.

PHASE 5 — ANALYTICS, QUALITY, AND PERFORMANCE

Instrument the full funnel with a consistent anonymous/user/session identity model and documented event names:

- onboarding start/completion and time to first useful look;
- look impression, like, dislike/pass, save, share, remix, and piece replacement;
- product/shop-sheet view and retailer click;
- affiliate redirect success/failure;
- search/filter usage and empty results;
- account creation and return sessions;
- Daily Drop/reward engagement;
- catalog publication, verification, retirement, repair, and pipeline failures.

Create a concise KPI definition document and, using the existing analytics stack, a queryable dashboard or documented dashboard specification for: D1/D7 retention, weekly looks viewed, save rate, remix rate, shop CTR, affiliate conversion when available, fully buyable-look rate, 24-hour link verification coverage, automated products published per week, review rate, pipeline failure rate, and performance by device.

Performance requirements:

- Remove or lazy-load nonessential heavy code, especially 3D, large static catalog payloads, and below-the-fold modules.
- Paginate/virtualize large product grids and optimize responsive images.
- Target a production build First Load JS of no more than 350 kB for the primary feed and no more than 400 kB for Browse, Discover, Build/Remix, and Saved; no route may exceed 450 kB without a documented, measured exception and a deferred-loading strategy.
- Eliminate unexplained static-generation timeouts/retries and obvious hydration, console, or network errors.
- Verify usable loading states under slow network and graceful behavior when recommendations, catalog, auth, analytics, or affiliate services fail.

ENGINEERING AND VERIFICATION RULES

- Keep the existing application working throughout the migration. Prefer staged schema changes and adapters over a destructive rewrite.
- Use typed boundaries and validation for external data. Never let malformed catalog records silently publish.
- Add unit, integration, and browser tests proportional to risk. At minimum cover: catalog state transitions; normalization and dedupe; price/availability freshness; affiliate wrapping; complete-look enforcement; automatic substitution; budget constraints; preference persistence; remix/replacement; pipeline idempotence/retries; and access control for internal operations routes.
- Run existing verification and build commands, including `npm run verify` and `npm run build`, and fix regressions rather than weakening checks.
- Run browser QA against a production-like local build at 390x844 and 1440x900 for onboarding → first look → save → remix/replace → shop items, plus Browse/search/filter, Saved persistence, Daily Drop, Profile/preferences, public share, and catalog-operations flows.
- Record screenshots of the finished key screens at both breakpoints and compare them with the baseline.
- Check keyboard navigation, focus behavior, dialogs, empty/error/loading states, direct deep links, refresh persistence, console errors, failed network calls, and horizontal overflow.
- Test automation in dry-run and controlled live modes. Demonstrate that one new candidate can traverse the full pipeline and appear in the user-facing catalog, and that an unavailable item triggers product retirement and outfit repair.
- Keep a progress log with completed work, evidence, decisions, migrations, commands, before/after metrics, and remaining risks. Update the investor/product audit with the final state.

DEFINITION OF DONE

Do not declare this goal complete until all of the following are true and evidenced:

- The redesigned mobile and desktop experiences are implemented across all primary routes, visually coherent, responsive, accessible, and materially more premium and understandable.
- A new user can reach a useful complete look quickly, control budget/fit/preferences, save it, replace a piece, and reach exact retailer pages without broken or misleading states.
- Every primary-feed outfit is 100% buyable at render time or automatically repaired/suppressed.
- Affiliate wrapping and click attribution are verified when the required production configuration exists; missing external configuration is explicitly identified without exposing secrets.
- The catalog uses the explicit publish lifecycle, all existing staged candidates have an outcome, scheduled jobs form a complete publish-and-health loop, and the operator dashboard makes failures visible and actionable.
- Catalog freshness, link health, automation throughput, outfit diversity, and product/business funnel events are measurable.
- The catalog/outfit acceptance targets above are met, or a truly external credential/source limitation is documented after all safe in-scope alternatives are exhausted.
- `npm run verify`, `npm run build`, relevant automated tests, and mobile/desktop browser verification pass.
- Performance budgets are met or any exception is narrowly documented with measured evidence and deferred loading.
- No fake products, links, prices, discounts, availability, reviews, scarcity, or social proof were introduced.
- The implementation, migrations, automation operations, environment-variable names, rollback steps, and remaining business/legal dependencies are documented.
- No push, merge, or production deployment has occurred without explicit user authorization.

At each meaningful checkpoint, report what changed, what was verified, current before/after metrics, and the next highest-leverage work. Make reasonable product and engineering decisions independently and keep working. Pause only when a missing choice or external authorization would materially change the product or cause an irreversible/external action.
```
