# Controlled catalog-flow acceptance

Run:

```bash
npm run test:catalog-flow
npm run test:catalog-worker
```

The command is deterministic and local. It does not call a retailer, database,
Git provider, or deployment service and does not rewrite catalog artifacts.
The frozen fixture clock is `2026-08-10T18:00:00.000Z`.

## Proven contract

The harness sends one normalized exact-PDP fixture through the production
lifecycle validator in this order:

```text
discovered → normalized → deduplicated → enriched → image_ready
  → verified → approved → published
```

Every edge uses a stable operation key and the same timestamped positive price,
link, stock, trust, moderation, and publication evidence required by migration
`0005_catalog_lifecycle.sql`. Before verification and after publication, the
fixture also passes `evaluateProductPublishability` with strict 24-hour
freshness, explicit stock, and explicit trust enabled.

The same completed operations are delivered again. The transition ledger
classifies each as a replay without adding an event or changing state. A
retryable retailer timeout schedules deterministic attempt two; exponential
delay is capped; the final allowed attempt returns `exhausted` rather than
scheduling unbounded work; and policy failures are terminal immediately.

Finally, the published top receives fresh `sold_out` evidence. Strict serving
withholds it and the lifecycle records `published → retired` with reason
`retailer_sold_out`. A complete top/bottom/shoes fixture is then repaired with a
fresh same-category top under the whole-look budget. Re-running without a valid
replacement suppresses the outfit instead of leaking an incomplete or
unavailable look.

## Runtime helpers

- `lib/catalog-pipeline-runtime.ts` applies lifecycle requests replay-safely and
  plans bounded durable retry rows without performing persistence or sleeping.
- `lib/catalog-outfit-repair.ts` repairs required outfit categories using the
  strict catalog publishability predicate, or returns an explicit suppression.
- `lib/catalog-job-analytics.ts` maps only applied, post-commit lifecycle edges,
  completed repairs, and blocked pipeline decisions to the canonical catalog
  analytics taxonomy. It excludes raw rows, URLs, freeform evidence/messages,
  and credentials.
- `lib/catalog-worker-persistence.ts` defines the injectable transaction
  contract. `lib/catalog-worker-supabase.ts` maps each boundary to one
  service-role-only PostgreSQL RPC and returns an explicit disabled adapter
  without constructing a client when credentials are absent.
- `lib/catalog-worker-runner.ts` validates transitions with the strict shared
  contract, plans bounded retries, and emits analytics only after a matching
  committed (not replayed) ledger acknowledgement.
- `scripts/check-catalog-flow-acceptance.ts` is the controlled acceptance
  scenario and prints its transition/retry/repair evidence summary.
- `scripts/check-catalog-worker-persistence.ts` proves transaction-abort,
  replay, retirement/repair-resume, missing-credential, and RPC-mapping behavior
  with injected in-memory/fake adapters and no network or database connection.
- `scripts/check-catalog-analytics.ts` proves canonical properties, lifecycle
  replay/no-op suppression, repair attribution, failure redaction, capture
  failure isolation, and no network call when analytics is unconfigured.

Migration `0005` contains the matching atomic worker RPCs and immutable
`catalog_outfit_repairs` ledger. This closes the repository implementation gap,
but does not claim deployment: the migration was not applied to a live
Supabase project and no service-role credentials were available in this run.
