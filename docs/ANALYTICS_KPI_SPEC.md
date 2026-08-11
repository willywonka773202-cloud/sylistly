# Sylistly analytics and KPI specification

Status: implemented event/KPI contract; dashboard publication remains gated by
the validation and known gaps below. PostHog collection is active
only when `NEXT_PUBLIC_POSTHOG_KEY` is configured. Retailer redirect rows are
written only when Supabase service credentials are configured and migration
`0004_click_attribution.sql` has been applied. Missing configuration produces
`N/A`, never a zero.

## Decision and identity model

The weekly product review should answer one question: are people receiving
complete, buyable looks they value enough to save, remix, and shop without
losing trust?

- `anonymous_id` is an opaque first-party browser ID persisted in local storage.
- `anonymous_session_id` is an opaque session ID persisted in session storage.
- PostHog's own anonymous distinct ID remains the event identity. The two
  Sylistly IDs are registered as event properties so PostHog and the click
  ledger can be reconciled. Sylistly does not add email, IP address, or another
  direct identifier as event properties; infrastructure providers may still
  process ordinary request metadata under their own settings.
- `identifyAnalyticsUser` is called only after a real account exists. Sign-out
  must call `resetAnalytics` to prevent identity leakage across users.
- A local-data reset clears PostHog plus the Sylistly browser/session IDs and
  does not recreate them until a later measured action or page load.
- `session_started` fires once per browser session and includes
  `is_returning`. Anonymous person profiles are disabled; PostHog creates a
  person profile only after identification.

## Canonical funnel events

All names are lower snake case and carry `schema_version`, `surface`,
`anonymous_id`, and `anonymous_session_id` when available. Entity properties
use `look_id`, `product_id`, `category`, `vibe`, `source`, `budget`,
`price_cents`, and `fully_buyable`. Existing call sites are normalized by
`lib/analytics.ts`; the original name is retained as `legacy_event` during the
compatibility period.

`lib/analytics-events.ts` also attaches `event_contract_issues` when a known
event is missing KPI-critical properties. Events are never thrown away or
allowed to block shopping; the dashboard must show this field as a data-quality
guardrail. CamelCase compatibility keys are converted to their canonical
snake_case key rather than emitted as duplicate dimensions.

| Stage | Event | Required product properties |
|---|---|---|
| Session | `session_started` | `is_returning` |
| Onboarding | `onboarding_started`, `onboarding_step_completed`, `onboarding_completed` | step or resulting preference fields where applicable |
| Activation | `first_useful_look_viewed` | `look_id`, `time_to_first_useful_look_ms`, `fully_buyable` |
| Recommendation | `look_impression` | `look_id`, `vibe`, `pieces`, `total_cents`, `source`, `budget`, `fully_buyable` |
| Intent | `look_saved`, `look_passed`, `look_shared`, `look_remixed` | `look_id`, `vibe`, `pieces`, `source` |
| Replacement | `piece_replacement_started`, `piece_replacement_completed`, `piece_replacement_failed` | `look_id`, `product_id`, `category`; failures add `error_code` |
| Commerce | `product_viewed`, `shop_sheet_viewed`, `retailer_click_started` | `product_id`, `product_ids`, or `look_id`, `surface`; click adds retailer and price when known |
| Redirect | `affiliate_redirect_succeeded`, `affiliate_redirect_failed` | `product_id`, `look_id`, `surface`, `campaign`; success adds destination host/network, failure adds `error_code` |
| Account | `account_created` | acquisition surface only; never email |
| Search | `search_performed`, `search_empty_results`, `catalog_filter_changed`, `catalog_filters_cleared` | query/filter state, `result_count`, `surface` |
| Daily Drop | `daily_drop_viewed`, `daily_drop_opened`, `daily_drop_shopped`, `reward_opened` | `crate_id`; shopping/reward adds `look_id`, shopping adds `product_ids` |
| Catalog | `catalog_product_verified`, `catalog_product_published`, `catalog_product_retired`, `catalog_outfit_repaired`, `catalog_pipeline_failed` | product/look/run ID, stage, source, outcome or failure code as applicable |
| Performance | `web_vital_measured` | metric, value, rating, device type, viewport width, route path |

The redirect endpoint also writes `clicks.external_product_id`, `look_id`,
`surface`, `campaign`, requested `sub_id`, exact `network_sub_id`, session/anonymous IDs, destination host,
affiliate network, and redirect status. The affiliate network receives a
bounded compound custom token containing product/look/surface/campaign/sub-ID;
it never receives the anonymous or session IDs.

## Dashboard: Product & Commerce — weekly, UTC

Use a PostHog dashboard with Supabase/catalog cards alongside it. Default
filters: production hostname, bot/internal traffic excluded, last 8 complete
weeks. Break down all funnel cards by `device_type`, new/returning session,
budget tier, and surface where sample size permits.

### Primary KPIs

1. **Save rate** — distinct `(identity, look_id)` `look_saved` events divided
   by distinct `(identity, look_id)` `look_impression` events. Report 7-day
   rolling and weekly cohorts. Guardrail: exclude events missing `look_id`
   rather than silently treating them as one look.
2. **Shop CTR** — distinct `(identity, look_id)`
   `retailer_click_started` events divided by distinct `(identity, look_id)`
   `look_impression` events. Show `shop_sheet_viewed / look_impression` as the
   intent step and click-ledger success rate as the technical step.
3. **D1 / D7 retention** — percentage of first-seen identities with a
   `session_started` on the next UTC calendar day / seventh UTC calendar day.
   Report anonymous and identified cohorts separately; do not merge devices
   unless an identified account permits it.
4. **Time to first useful look** — p50 and p75
   `time_to_first_useful_look_ms` on the first session event where a complete,
   fully buyable look is at least 62% visible. Break down completed onboarding
   versus skip and device. Exclude duplicate activation events in the same
   `anonymous_session_id` and surface contract violations separately.

### Drivers and guardrails

| Metric | Exact definition | Source | Decision it supports |
|---|---|---|---|
| Weekly looks viewed | Median distinct `look_id` impressions per weekly active identity; total distinct impressions is a companion volume card | PostHog | Whether inventory/recommendations sustain exploration |
| Search empty-result rate | `search_empty_results` / `search_performed`, split by query versus filters and device | PostHog | Missing inventory, synonyms, or overly narrow facets |
| Daily Drop open rate | Sessions with `daily_drop_opened` / sessions with `daily_drop_viewed`; reward engagement is reported separately from `reward_opened` | PostHog | Whether the retention mechanic creates shopping intent |
| Remix rate | Distinct saved-or-impressed looks remixed / distinct impressed looks | PostHog | Whether control increases value beyond passive browsing |
| Fully buyable-look rate | Impressions where `fully_buyable = true` / all look impressions | PostHog | Trust guardrail; investigate any result below 100% |
| Affiliate redirect success | Successful redirect rows / all redirect attempts | Supabase `clicks` | Detect invalid destinations or service degradation |
| Affiliate conversion | Network-reported conversions joined on `network_sub_id` / successful redirects | Affiliate report/postback + `clicks` | Revenue quality; display `N/A` until a network conversion feed exists |
| 24-hour link verification coverage | Exact-PDP publishable candidates with typed checks newer than 24h / all exact-PDP publishable candidates | `data/catalog-health.json` or persisted health snapshot | Launch freshness target: at least 95% |
| Automated products published/week | Distinct products transitioning into `published` from an automated run in the week | Catalog run/state-transition ledger | Whether automation is adding usable selection; `N/A` until transitions are persisted |
| Review rate | Reviewed catalog candidates / candidates entering review in the week | Catalog state-transition ledger | Manual-review load and pipeline bottlenecks |
| Pipeline failure rate | Failed terminal runs / all terminal automated runs, by source and stage | Catalog run ledger / operator API | Alert on any sustained rise; never infer from missing runs |
| Performance by device | p75 LCP, INP, CLS and TTFB by mobile/tablet/desktop and route | PostHog `web_vital_measured` | Enforce route budgets and target regressions |

## Required dashboard cards and alerts

1. D1 and D7 retention trends with new/returning and device breakdowns.
2. Weekly looks viewed, save rate, remix rate, shop-sheet rate, and shop CTR.
3. Funnel: `look_impression` → `look_saved` → `look_remixed` →
   `shop_sheet_viewed` → `retailer_click_started` →
   `affiliate_redirect_succeeded`.
4. Fully buyable-look rate plus missing-ID event-quality counts.
5. Time-to-first-useful-look p50/p75, search usage/empty-result rate, Daily Drop
   open/shop rate, and reward engagement.
6. Link-verification coverage, published/week, review rate, pipeline failures,
   and catalog size by publishability state. Source durable lifecycle facts from
   migration `0005_catalog_lifecycle.sql` tables, not client event counts.
7. Web-vital p75 table by route and device.

Alert when affiliate redirect success falls below 99% over 30 minutes with at
least 20 attempts, fully buyable-look rate falls below 100% with at least 50
impressions, 24-hour verification coverage falls below 95%, a scheduled
pipeline run is missing/failed, or a p75 Core Web Vital moves from good to
needs-improvement. Thresholds are operational starting points, not fabricated
baselines; reset them only after four representative production weeks.

## Validation and known gaps

- Use PostHog live events to confirm each canonical event and required property
  before publishing the dashboard.
- Reconcile daily `retailer_click_started` counts with click-ledger success and
  failure rows; large divergence indicates blocked client analytics or a broken
  redirect surface, not automatically lost clicks.
- Affiliate conversion is intentionally unavailable until a permitted network
  report or postback is connected.
- Durable lifecycle storage exists in `catalog_pipeline_runs`,
  `catalog_pipeline_stage_runs`, `catalog_pipeline_retries`,
  `catalog_review_decisions`, `product_lifecycle_events`, and
  `catalog_alerts`, with repair state in `catalog_outfit_repairs`, after
  migration `0005_catalog_lifecycle.sql`. Dashboard cards remain `N/A` until
  that migration is applied and real runs write those rows.
- Browse emits `search_performed`, filter changes, and zero-result outcomes with
  a stable surface plus result count. Validate those canonical events in the
  configured PostHog project before publishing a search-adoption or empty-rate
  card; source wiring alone is not production event delivery evidence.
- Catalog lifecycle emission is implemented at the post-ledger boundary in
  `lib/catalog-job-analytics.ts`: only a newly applied, durably committed
  `product_lifecycle_events` edge may emit verification, publication, or
  retirement. Replay/no-op/uncommitted edges are suppressed. Completed repairs
  require stable look and resulting product IDs, and blocked report-writing
  guard, unexpected runner, and repository-verification failures emit bounded
  failure-code payloads. `lib/catalog-worker-runner.ts` owns the post-commit
  check, and its injectable Supabase adapter maps each mutation to one atomic
  service-role RPC. This local repository still has no configured live writer,
  so lifecycle and repair dashboard cards remain `N/A` until migration `0005`
  is applied, service-role configuration enables the adapter, real runs write
  ledgers, and live events are validated in PostHog.
- `account_created` remains intentionally dormant while the product is
  local-first and has no account-creation flow.
- No production metric values are asserted in this document.
