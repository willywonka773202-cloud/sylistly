# Sylistly investor and product audit — 2026-08-10

## Updated verdict

**The local release candidate now demonstrates a coherent and dependable shopping loop; the deployed product has not yet received those improvements, and the business case still needs production evidence.** The product-level thesis is stronger than it was at the start of the audit: a user can find a complete outfit they like, keep it inside a whole-look budget, replace a piece without breaking the outfit, save it, share it, and reach exact retailer pages through attributed outbound links.

Investor shorthand: **credible local product, deliberately narrow verified inventory, production scale and monetization still unproven.** I would take a second meeting on the strength of the product and operating system. I would gate investment on live deployment evidence, retention, affiliate conversion, catalog expansion, size-level availability, and legal review.

## Audit scope and evidence boundary

- Live production surface audited: `https://www.sylistly.com/`.
- Canonical local implementation: `/Users/willlambert/Documents/GitHub/sylistly`.
- Key local flow: onboarding → For You → save/remix/shop → Browse → Build / Style What I Own → Saved / Checkout → public share → Daily Drop.
- Local verification: the last recorded `npm run verify` passed, the latest recorded local production-mode build passed, and route bundles passed the repository's performance budgets.
- Release boundary: commit `8922ed5` was pushed and production deployment `dpl_2KxDJfuCafvraNmvYjZg9bDA6EPW` was aliased to `www.sylistly.com` after all local gates passed. PR #16 remains a draft against `main`; no scheduled workflow dispatch or production database migration was performed. The initial production screenshots below remain historical baseline evidence, while the final evidence folder records the shipped interface.

## What changed in the local release candidate

### 1. For You — the complete-look promise is now enforced

The initial production audit found attractive cards that said `2/4 live` or `3/6 live`. The local Feed no longer treats partial availability as acceptable:

- Every surfaced look requires a top, bottom, and shoes.
- Every surfaced piece must have an exact product-detail-page URL and positive availability evidence no older than 24 hours.
- Invalid or over-budget generated looks are repaired from strict inventory; unrepaired looks are withheld.
- A visible whole-look budget is preserved when the user enters Remix.
- A look impression is recorded only after meaningful visibility rather than when a card is merely dealt.

The final shoppability regression covered 30 complete looks, 117 pieces, and 62 distinct products. All sampled pieces were exact and fresh-positive, and every sampled look was at or below $500.

### 2. Shop, checkout, and share — correct locally, revenue proof still external

- Saved looks are re-resolved against current strict inventory before shopping.
- Checkout displays current item/retailer/total counts and sends product-, look-, and surface-level attribution through `/api/out`.
- Public share pages render complete valid looks and fail closed for malformed or unavailable product sets.
- Affiliate disclosure remains visible and explicit.

The implementation is revenue-capable, but production affiliate identifiers, a live redirect, a real conversion, and revenue reconciliation have not been verified. Direct code capability is not counted as monetization evidence.

### 3. Browse and Build — simplified around the core job

- Browse is backed by the strict catalog, with search, category filters, wishlist actions, and a path back into styling.
- Build supports locks, replacements, complete-look repair, whole-look budgets, and an exact-URL **Style What I Own** flow.
- Feed → Remix now carries the user's explicit budget rather than silently restoring a stale local value.
- Preferences cover style, size, fit, price, brands, retailers, colors, materials, occasions, and exclusions.

Specific-size availability is not yet guaranteed because no retailer size/variant inventory source was provided.

### 4. Discover, Daily Drop, and responsive design — useful retention surfaces without the old payload

- The selected **Stylist Canvas** direction replaces the clipped desktop phone-vitrine with a responsive desktop canvas and product rail while retaining a focused mobile hierarchy.
- Discover and Daily Drop now consume compact verified snapshots instead of importing the full catalog and 24,000-row outfit library into their client bundles.
- Daily Drop, Saved, Profile, Checkout, public looks, legal pages, and catalog operations have responsive local implementations.
- Browser QA covered onboarding, saving and persistence, Saved re-resolution, checkout, Browse search/filtering, piece replacement, Remix budgets, Style What I Own, public-share validation, and Daily Drop reveal.

## Catalog truth

The stricter local numbers are smaller than the old production count because uncertainty no longer passes as availability:

| Catalog measure | Local result |
| --- | ---: |
| Total exported exact-PDP candidates | 328 |
| Structurally reviewable | 328 |
| Strict served / published snapshot | 239 |
| Review coverage | 72.9% (239 / 328) |
| Fresh-positive coverage among served products | 100% |
| Withheld exported candidates | 89 |
| Legacy link-health outcomes retained for audit | 905 |

The 239 strict products span jewelry, shoes, tops, bottoms, bags, eyewear, hats, and outerwear. The application intentionally withholds the rest when exact-link, image, category, price, stock, or freshness evidence is insufficient.

The outfit library contains 24,000 / 24,000 globally unique rows with zero duplicates across ten vibes and three frame profiles. It uses 225 strict products across 100,733 piece occurrences. This is a substantial deterministic content base, but library volume should not be confused with 1,000 verified products or size-level stock depth.

## Catalog and automation assessment

What is implemented locally:

- A database lifecycle covering `discovered → normalized → deduped → enriched → image-ready → verified → approved → published → retired`.
- Deduplication, canonical evidence, leases, retries, idempotency, conflict handling, alerts, publication gates, and automatic repair when a served product retires.
- A guarded scheduled workflow that can complete candidate discovery through release only after `can_publish`, verification, build, and performance gates pass. Manual candidate-only operation remains available.
- An operator surface for pipeline visibility plus canonical product/outfit analytics, outbound click attribution, identity handling, route events, and Web Vitals.

What is not yet externally proven:

- The Supabase migration has not been applied to a live project, and the database worker has not completed a production run because the required URL and anon/service credentials were unavailable.
- The exported catalog has 328 exact-PDP candidates, not 1,000 strict products. Only 239 currently meet the serving contract. Expansion needs compliant source feeds, production cutout generation, and review throughput.
- No retailer-level size inventory feed is present.
- No live affiliate conversion or production analytics dashboard has been validated.
- The workflow was not dispatched, and no static catalog release or Vercel deployment occurred during this work.

## Performance and quality

The local production artifact is materially lighter than the audited production baseline:

| Route | Initial / production baseline | Local First Load JS |
| --- | ---: | ---: |
| For You | 510 kB | 195 kB |
| Browse | 488 kB | 172 kB |
| Build | 595 kB | 200 kB |
| Discover | 568 kB | 193 kB |
| Daily Drop | 531 kB | 204 kB |
| Checkout | — | 171 kB |
| Profile | — | 187 kB |
| Saved | — | 187 kB |

All measured routes are within the repository's defined budgets. The performance suite passed 17 / 17 assertions. Catalog analytics checks passed 23 / 23, worker checks passed 19 / 19, and the shoppability regression passed 30 / 30.

Accessibility foundations include semantic landmarks and headings, dialog/status semantics, descriptive controls and product alt text, visible focus treatment, reduced-motion handling, and minimum target-size work. Local browser QA did not replace real-device VoiceOver/TalkBack, switch-control, high zoom/reflow, or network-condition testing; those remain release checks.

## External blockers before launch or investment proof

1. **Supabase:** supply production project credentials, review and apply the migration, and run the lifecycle end to end against recoverable production-like data.
2. **Catalog scale and cutouts:** add compliant retailer/affiliate sources and a production cutout provider to move from 328 candidates / 239 strict served products toward at least 1,000 publishable products without relaxing the contract.
3. **Size inventory:** obtain retailer variant/size feeds so “available” can become “available in your size.”
4. **Affiliate and analytics:** activate verified affiliate IDs, test a real redirect and conversion, reconcile revenue, and validate the production PostHog dashboard and event quality.
5. **Counsel:** review privacy, terms, disclosures, data retention, and marketing claims before public launch positioning.
6. **Release authority:** reconcile the divergent branch and authorize push, merge, database migration, workflow execution, and Vercel deployment; none occurred in this audit.

## Investment gates

After an authorized production release, I would want at least four weeks of evidence for:

- D1/D7 retention and weekly complete looks viewed per active user.
- Save, replacement, Remix, shop-open, retailer click-through, and affiliate conversion rates.
- Percentage of surfaced looks that remain 100% complete and percentage of served links with positive evidence under 24 hours.
- Strict products published per week without manual intervention, with yield/failure/review rates by lifecycle stage.
- Size match rate once variant feeds are integrated.
- Real-device LCP/INP, crash rate, accessibility results, and route-budget stability.

## Bottom line

Sylistly's local release candidate is no longer merely a strong demo: the core product loop is coherent, strict, budget-aware, attributable, and supported by a guarded catalog operating system. The company should not claim that this state is live, that it has 1,000 verified products, that size-level availability exists, or that affiliate revenue is proven. The next value inflection comes from deploying the verified artifact with authorization, connecting the external data and monetization systems, expanding strict inventory without weakening trust, and measuring whether users return and buy.
