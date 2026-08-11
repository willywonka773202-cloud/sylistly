# Catalog publish and health automation

Catalog automation keeps candidate/review data separate from the strict
served/published set. The daily schedule runs the complete guarded release
loop, while manual dispatches remain candidate-only unless the operator selects
`release=true`. Scheduled and manually authorized releases must pass every
strict serving, shrink, source, full repository verification, build, and
performance gate before commit, push, or deploy becomes reachable.

## Pipeline

| Stage | Evidence or command | Mutation boundary |
|---|---|---|
| Baseline | candidate count plus prior strict served count | read-only |
| Candidate | `node scripts/auto-expand.mjs` | workspace files only |
| Health | `npm run health:sweep` | workspace health/catalog evidence only |
| Repair | `npm run library:generate` and `npm run drop:library` | workspace recommendation indexes only |
| Guard | `npx jiti scripts/catalog-ops-pipeline.ts` | read-only by default |
| Verify | `npm run verify`, `npm run build`, `npm run test:performance` | read-only build/test outputs |
| Publish | commit/push/deploy | verified daily schedule or explicit manual release only |

Migration `0005_catalog_lifecycle.sql` adds the durable database ledger behind
this candidate-first boundary. Its state path is:

```text
discovered → normalized → deduplicated → enriched → image_ready
  → verified → approved → published → retired
```

Any active state before retirement may fail into `quarantined` or `rejected`.
Quarantined, rejected, or retired products can only re-enter through
`discovered`, so recovery reruns the evidence-producing stages instead of
restoring a stale publication directly.

The schema stores one row per pipeline run, one row per stage attempt, and one
row per scheduled retry. Run and retry idempotency keys are unique. Product
state changes are guarded in Postgres and appended to
`product_lifecycle_events`; `lib/catalog-lifecycle.ts` provides the matching
pure validation and replay/conflict classifier for workers.

The migration is intentionally not applied by repository tests. The injectable
worker and Supabase adapter exist in `lib/catalog-worker-*.ts`, while
`scripts/catalog-ops-pipeline.ts` remains a read-only release decision over
static/current evidence. Until an environment applies `0005` and supplies the
service-role configuration, the adapter returns an explicit disabled result
without constructing a client or making a network call.

`lib/catalog-job-analytics.ts` is the post-commit measurement adapter for that
worker. It emits verification, publication, or retirement only when the
Supabase persistence adapter returns a matching newly committed
`product_lifecycle_events` edge. The runner—not an arbitrary caller-owned
boolean—owns that acknowledgement. Replays, idempotent no-ops, candidate
snapshots, and uncommitted
edges emit nothing. The same helper records completed look repairs with stable
look/product IDs. Report-writing guard runs emit `catalog_pipeline_failed` when
blocked, unexpected runner exceptions use a bounded fallback code, and the
workflow records repository-verification failure through the same canonical
event; baseline probes do not. Capture is best effort and is a no-op when the
public analytics ingestion key is absent. The static decision runner does not
call lifecycle/repair emitters; the durable worker does so only after RPC
commit. This is tested repository wiring, not claimed live coverage while the
migration and credentials are absent.

The decision model blocks a release when any of these is false:

- candidate inventory is non-empty;
- candidate count is within the maximum shrink boundary (10% by default);
- the strict served/published subset is non-empty and remains inside its own
  maximum shrink boundary;
- every row in that served subset passes exact-PDP, explicit trust/stock, and
  fresh-positive availability gates;
- schema-v2 per-product health evidence exists;
- at least 95% of the served/published set has a fresh positive `available`
  result within 24 hours (100% by construction in the static serving adapter);
  and
- no source stage failed.

Candidate review coverage is reported separately. For example, the current 239
strict served rows out of 328 structurally reviewable rows is a 72.9%
review-throughput warning, not permission to fail or weaken the 239-row serving boundary. Rows
without complete evidence remain withheld for review or retirement.

At the durable write boundary, an `approved → published` transition also
requires current display price/currency to equal the verified price/currency,
positive `available` link evidence, explicit in-stock/trust values, approval
metadata, and verification timestamps inside 24 hours. Original/comparison
price is optional and cannot be lower than the verified current price.

A generic HTTP 200 is `reachable`, not `available`, and never counts toward the
95% numerator. Blocked/error/reachable results remain review work.

## Durable retries and alerts

Workers should claim a queued stage attempt, write its evidence/counters, and
finish it in one transaction. A retry creates a ledger row with a deterministic
idempotency key, incremented retry number, explicit `scheduled_for`, and bounded
backoff. A duplicate delivery with the same run/stage/retry key is a replay,
not another attempt. Reusing that key for different work is a conflict.

When retry policy is exhausted, write the terminal stage failure and upsert an
active deduplicated alert. The alert vocabulary covers pipeline failure, stale
health, catalog shrinkage, broken-link spikes, affiliate wrapping, source
degradation, retry exhaustion, price anomalies, review backlog, and outfits
that need repair. Resolving an alert preserves it; a later recurrence can open
a new record.

No worker may infer a successful lifecycle stage from ingestion time, HTTP 200
alone, image completion, or a previously served state. Evidence timestamps are
stage-specific. The `last_checked_at` and price-verification fields can only be
written by the corresponding verification operation.

## Safe local use

Dry-run decision only (no network or writes):

```bash
npx jiti scripts/catalog-ops-pipeline.ts
```

Controlled end-to-end acceptance (pure fixtures, no network or writes):

```bash
npm run test:catalog-flow
```

This proves ordered discovery-to-publication transitions, exact replay
idempotency, bounded/capped retries, sold-out retirement, and complete-outfit
repair-or-suppression using the same lifecycle and strict publishability
predicates as the release boundary.

Durable worker transaction/replay acceptance (injected adapters, no network or
database writes):

```bash
npm run test:catalog-worker
```

This proves atomic stage failure + retry + alert behavior, aborted-transaction
rollback, committed-edge-only analytics, retirement/repair resume, every
Supabase RPC mapping, and the missing-credential disabled boundary.

Focused catalog analytics contract (injected capture; no network or writes):

```bash
npm run test:catalog-analytics
```

Generate and verify a candidate locally. This may rewrite candidate data in the
working tree, but never commits or deploys:

```bash
npm run auto:ship
```

An explicitly authorized local release is:

```bash
CATALOG_RELEASE=1 npm run auto:ship
```

Even with that flag, a failed source, health, shrink, publishability, typecheck,
lint, unit, smoke, or build gate stops before commit/deploy. Catalog expansion
errors are fatal unless `CATALOG_ALLOW_GROWTH_FAILURE=1` is deliberately set for
a non-release diagnostic run.

## GitHub Actions

`.github/workflows/auto-expand.yml` has one global concurrency group, so two
catalog runs cannot overlap. Daily scheduled runs execute the complete
candidate, health, repair, guard, verification, publish, and deployment loop
and upload seven-day evidence artifacts. The publish boundary remains
unreachable unless every gate reports `can_publish=true`. Manual dispatch with
`release=false` is the candidate-only dry-run equivalent.

A scheduled run, or a manual **Catalog publish and health pipeline** dispatch
with `release=true`, follows this release path:

1. records the immutable baseline;
2. builds and checks a workspace candidate;
3. evaluates preliminary guards;
4. runs `npm run verify`, the production build, and route bundle budgets only
   for an eligible candidate;
5. reruns the decision with verified evidence; and
6. commits/pushes/deploys only when `can_publish=true`.

Failed and candidate-only runs still preserve their evidence artifact, but the
commit and deploy steps are unreachable. `SEARCHAPI_KEY` enables discovery;
`VERCEL_TOKEN` enables the final CLI deployment after a verified release. No
scheduled workflow was dispatched as part of the implementation. After the same
verify/build/performance gates passed locally, commit `8922ed5` was pushed and
manually deployed to the production `www.sylistly.com` alias with explicit user
authorization.

The repository does not currently contain a CI-safe cutout provider credential
or configured live worker. New discoveries without an already reviewed transparent
asset remain in the candidate/review set and cannot reach `image_ready` or the
served set. This is an explicit external integration gap, not a relaxed gate;
the controlled acceptance harness covers the worker contract until the adapter
is enabled against an applied migration.

## Operator surface

`/catalog-ops` is an internal dashboard backed by local/static evidence when
Supabase is unavailable. `/api/catalog-ops/status` returns the same typed status
for operator tooling. Both require either:

- an `Authorization: Bearer …` value matching `CATALOG_OPS_TOKEN`; or
- the HTTP-only eight-hour session created by the dashboard login.

Configure a random token of at least 24 characters and, preferably, a separate
session-signing secret:

```bash
CATALOG_OPS_TOKEN=replace-with-a-long-random-secret
CATALOG_OPS_SESSION_SECRET=replace-with-another-long-random-secret
```

Secrets are never placed in URLs, client JavaScript, or browser storage.
