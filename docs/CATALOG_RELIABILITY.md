# Catalog reliability boundary

Sylistly now has one server/build-safe publishability predicate in
`lib/catalog-publishability.ts`. A product is never publishable when it:

- does not own an exact retailer product-detail URL;
- is explicitly untrusted;
- is explicitly out of stock; or
- has a known `dead` or `sold_out` link-health outcome (including the legacy
  `unavailable` list).

Trust or stock fields that are absent remain warnings for backward
compatibility. Callers can require explicit values for a release gate.

## Freshness policy

Freshness is based only on a timestamped per-product retailer-link check.
Discovery, ingestion, image processing, catalog builds, and search caching are
not availability verification.

Primary runtime shopping routes use `freshnessPolicy: 'require-fresh'`: stale,
missing, blocked, reachable-only, or error health evidence is withheld rather
than presented as buyable. Catalog build artifacts may retain unresolved rows
for review, but the served/published adapter filters them at the boundary.

`/api/search`, `/api/editorial-look`, `/api/look`, `/api/out`, and
`/api/shop-all` enforce the strict boundary. The look endpoint also refuses to
return a partial AI look unless top, bottom, and shoes all survive the gate.

## Link-health snapshot v2

Run the network sweep with:

```bash
npm run health:sweep
```

`data/catalog-health.json` keeps the legacy `generatedAt`, `checked`, and
`unavailable` fields. Schema v2 adds:

- `products[productId]`: `outcome`, `checkedAt`, checked URL, HTTP status,
  exact-PDP classification, and optional live/catalog price evidence;
- `coverage`: explicit candidate, structurally reviewable, strict
  served/published, withheld, and retired counts;
- `candidateReviewCoveragePct` against the review-throughput target, counting
  only fresh positive evidence across structurally reviewable candidates;
- `servedFreshCoveragePct` against the 95% / 24-hour serving target. This is
  100% by construction whenever the non-empty strict served set exists;
- backward-compatible `freshCoveragePct` fields, which retain their legacy
  candidate-review meaning and must not be labelled published freshness; and
- typed outcome counts for `available`, `reachable`, `sold_out`, `dead`,
  `blocked`, and `error`.

`reachable` means the PDP returned HTTP 200 without strong structured stock
evidence. Reachable, blocked, and error outcomes are unverified and never enter
the strict served/published set. Dead and sold-out outcomes continue to
populate the backward-compatible `unavailable` array.

## Database semantics

Migration `0003_catalog_link_health.sql` removes the misleading default from
`products.last_checked_at`, clears legacy timestamps that lack a typed result,
and adds typed status/HTTP/URL evidence columns. Ingestion, seed, and search
cache writes no longer touch `last_checked_at`.

Migration `0005_catalog_lifecycle.sql` is the additive durable lifecycle
foundation. It is staged in source control but is not applied by repository
tests or local development. It adds:

- explicit `discovered → normalized → deduplicated → enriched → image_ready →
  verified → approved → published → retired` state, plus `quarantined` and
  `rejected` branches;
- stable canonical and primary-source identity, plus a multi-source provenance
  table;
- separate source/original, current, and positively verified price evidence;
- stage, price, availability, approval, publication, and retirement timestamps;
- moderation, reason, failure, transition, and append-only audit metadata;
- product variants with normalized size and typed stock state;
- durable pipeline-run, stage-attempt, and retry ledgers;
- idempotent review decisions and lifecycle events;
- deduplicated actionable alert records;
- an immutable repaired/suppressed outfit-state ledger; and
- service-role-only atomic RPCs for run, stage, retry/alert, lifecycle, and
  outfit-repair commits.

The database guard and `lib/catalog-lifecycle.ts` enforce the same transition
graph. Every real state change needs a new idempotency key. Retrying an already
applied edge is a replay without a second audit row; a same-state request is a
no-op; reusing a key for a different product or transition fails closed.
Entering `verified`, `approved`, or `published` requires positive
price/link/stock/trust evidence no older than 24 hours. Rows remain hidden by
RLS until they are both `published` and backed by that fresh positive evidence.

### Safe legacy backfill

The migration does not rewrite historical timestamps or prices into
verification proof. Rows already served before the migration retain
`lifecycle_state = published` as a historical compatibility/audit state and
receive:

- `canonical_product_id = products.id`;
- an explicit `legacy_import` source identity;
- `moderation_status = legacy_review_required`; and
- one `legacy_surface_backfill` lifecycle event whose evidence says
  `verificationEvidenceBackfilled: false` and `publicServingEligible: false`.

`original_price_cents`, `verified_price_cents`, `verified_at`, and
`price_verified_at` remain null. The current price is not copied into an
“original” field because that would create an unsupported comparison-price
claim.

Historical `published` rows cannot leak through anonymous/public Supabase RLS:
the policy requires fresh positive `available` link evidence, verified current
price/currency equal to the display values, explicit stock/trust, and all three
verification timestamps inside 24 hours. `catalog_published_products` repeats
the same predicate as the required serving view for service-role readers, which
bypass RLS. A service-role route that queries `products` directly is privileged
and can bypass this safety boundary; release/serving code must query the view or
apply the same strict predicate.

A post-migration verifier should process the legacy queue in bounded batches.
Positive checks can fill verification fields and record a review decision
without changing the historical state. Failed checks must transition the row
to `quarantined` or `retired` with a fresh transition key and reason. The rows
and their working source data are preserved, but unproven rows are withheld
until verified.

Before applying, take a database backup and record these baselines:

```sql
select count(*) as products_before from products;
select count(*) filter (where trusted is true and in_stock is not false)
  as previously_public_before
from products;
```

Apply migrations in numeric order during a quiet window. Migration `0005` uses
a five-second lock timeout so it fails instead of waiting indefinitely. After
applying, verify the staged result before enabling any new lifecycle writer:

```sql
select lifecycle_state, moderation_status, count(*)
from products
group by lifecycle_state, moderation_status
order by lifecycle_state, moderation_status;

select count(*) as missing_canonical_or_source
from products
where canonical_product_id is null
   or source_system is null
   or source_product_id is null;

select count(*) as legacy_review_queue
from products
where moderation_status = 'legacy_review_required';

select count(*) as falsely_backfilled_verification
from products
where lifecycle_audit_metadata ->> 'migration' = '0005_catalog_lifecycle'
  and (verified_at is not null or price_verified_at is not null);
```

Expected results are: no missing identity, the legacy queue equals the existing
product population on first application, and zero falsely backfilled
verification rows. The safe serving view may initially be empty; that is an
honest result, not permission to weaken the predicate. Backfill positive
evidence in bounded batches before switching a production service-role reader
to the view. Only then enable `CatalogLifecycleWorkerRunner` with the
service-role adapter. Without `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, that adapter is explicitly disabled, constructs no
Supabase client, performs no mutation, and emits no lifecycle/repair analytics.

### Rollback boundary

Supabase migrations are forward-only by default, so rollback is an operator
procedure, not an automatic down migration. If `0005` fails before commit, the
transaction leaves the old schema in place. If it commits but no lifecycle
writer has run, rollback is:

1. stop catalog schedulers and lifecycle writers;
2. export the twelve new operational tables and the new `products` columns;
3. drop `catalog_published_products` and restore the former `products public
   read trusted` policy before removing the lifecycle column;
4. drop `products_lifecycle_audit` and `products_lifecycle_guard`, then the two
   lifecycle functions;
5. revoke/drop the six `catalog_worker_*` RPCs, then drop outfit repairs,
   alerts, events, decisions, retry, stage, run, variant, and source tables in
   dependency order; and
6. drop the `0005` indexes/constraints and added product columns in reverse.

If any new product or state transition has been written, do not perform that
destructive rollback. Keep the additive schema, disable new writers, restore
the last known serving query, and reconcile/export the event ledger first.
Dropping the lifecycle columns at that point would erase source identity,
review decisions, retry history, and audit evidence.

## Operator checks

```bash
npm run test:catalog-reliability
npm run test:catalog-worker
npm run health:sweep
node -e "const h=require('./data/catalog-health.json'); console.log(h.coverage)"
npm run verify
```

Release jobs already use strict freshness for the served subset. Candidate
review coverage below 95% is an operator warning and backlog signal; it never
causes unresolved candidates to enter the served set. Strict mode intentionally
rejects missing, stale, reachable-only, blocked, and error evidence.

## Internal operations

The protected `/catalog-ops` route and `/api/catalog-ops/status` expose a shared
typed snapshot with separate candidate/review/served/withheld/retired counts,
exact-PDP and freshness coverage, stale/unavailable/broken/review queues,
per-source health, last run/failure, and independent candidate/served shrink
guards. They use current local/static evidence when a live Supabase catalog is
unavailable and say so visibly.

Access requires a long `CATALOG_OPS_TOKEN` through a Bearer header or the
HTTP-only signed session issued by `/catalog-ops/login`. The token is never sent
in the URL or persisted in client-accessible storage.

`scripts/catalog-ops-pipeline.ts` is read-only by default and produces an
idempotent decision for the same evidence/time. Candidate-only decisions can
never publish. Release mode gates the strict served subset, not every unresolved
candidate, and still cannot publish until verification is explicitly recorded
as passed. See `AUTOMATION.md` and `docs/CATALOG_FLOW_ACCEPTANCE.md` for the
workflow and deterministic acceptance boundaries.
