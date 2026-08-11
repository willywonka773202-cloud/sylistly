-- Sylistly schema · 0005 durable catalog lifecycle
--
-- Additive, staged foundation for canonical product identity, explicit lifecycle
-- transitions, variant stock, resumable pipeline execution, review, alerts, and
-- audit history. This migration deliberately does not claim that legacy rows
-- have fresh verification evidence. Existing rows retain their historical
-- `published` serving state for compatibility/audit, but public RLS and the
-- safe serving view withhold them until fresh positive verification exists.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- ===== phase 1: additive product lifecycle fields =====

alter table products
  add column if not exists lifecycle_state text,
  add column if not exists canonical_product_id text,
  add column if not exists source_system text,
  add column if not exists source_product_id text,
  add column if not exists original_price_cents integer,
  add column if not exists verified_price_cents integer,
  add column if not exists verified_currency text,
  add column if not exists normalized_at timestamptz,
  add column if not exists deduplicated_at timestamptz,
  add column if not exists enriched_at timestamptz,
  add column if not exists image_ready_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists price_verified_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists moderation_status text,
  add column if not exists moderation_notes text,
  add column if not exists lifecycle_reason_code text,
  add column if not exists lifecycle_failure_code text,
  add column if not exists lifecycle_failure_detail text,
  add column if not exists lifecycle_failure_metadata jsonb default '{}'::jsonb,
  add column if not exists lifecycle_audit_metadata jsonb default '{}'::jsonb,
  add column if not exists lifecycle_transition_metadata jsonb default '{}'::jsonb,
  add column if not exists lifecycle_updated_at timestamptz,
  add column if not exists lifecycle_actor_type text,
  add column if not exists lifecycle_actor_id text,
  add column if not exists last_transition_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_lifecycle_state_valid'
  ) then
    alter table products
      add constraint products_lifecycle_state_valid
      check (
        lifecycle_state in (
          'discovered', 'normalized', 'deduplicated', 'enriched',
          'image_ready', 'verified', 'approved', 'published',
          'retired', 'quarantined', 'rejected'
        )
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_moderation_status_valid'
  ) then
    alter table products
      add constraint products_moderation_status_valid
      check (
        moderation_status in (
          'pending', 'auto_approved', 'approved', 'changes_requested',
          'quarantined', 'rejected', 'legacy_review_required', 'not_required'
        )
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_lifecycle_actor_type_valid'
  ) then
    alter table products
      add constraint products_lifecycle_actor_type_valid
      check (lifecycle_actor_type in ('system', 'operator', 'source', 'migration'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_original_price_nonnegative'
  ) then
    alter table products
      add constraint products_original_price_nonnegative
      check (original_price_cents is null or original_price_cents >= 0)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_verified_price_nonnegative'
  ) then
    alter table products
      add constraint products_verified_price_nonnegative
      check (verified_price_cents is null or verified_price_cents >= 0)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_comparison_price_order_valid'
  ) then
    alter table products
      add constraint products_comparison_price_order_valid
      check (
        original_price_cents is null
        or verified_price_cents is null
        or original_price_cents >= verified_price_cents
      )
      not valid;
  end if;
end $$;

-- Preserve the historical serving-state label without fabricating verification.
-- The strict policy/view below withholds these rows; the audit flag and
-- moderation status make them an explicit review queue.
update products
set
  lifecycle_state = coalesce(lifecycle_state, 'published'),
  canonical_product_id = coalesce(canonical_product_id, id),
  source_system = coalesce(nullif(source_system, ''), 'legacy_import'),
  source_product_id = coalesce(nullif(source_product_id, ''), id),
  moderation_status = coalesce(moderation_status, 'legacy_review_required'),
  lifecycle_reason_code = coalesce(lifecycle_reason_code, 'legacy_surface_backfill'),
  lifecycle_failure_metadata = coalesce(lifecycle_failure_metadata, '{}'::jsonb),
  lifecycle_audit_metadata = coalesce(lifecycle_audit_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'migration', '0005_catalog_lifecycle',
      'legacyPublishedStatePreserved', true,
      'verificationEvidenceBackfilled', false,
      'publicServingEligible', false
    ),
  lifecycle_transition_metadata = coalesce(lifecycle_transition_metadata, '{}'::jsonb),
  lifecycle_updated_at = coalesce(lifecycle_updated_at, now()),
  lifecycle_actor_type = coalesce(lifecycle_actor_type, 'migration'),
  lifecycle_actor_id = coalesce(lifecycle_actor_id, '0005_catalog_lifecycle'),
  last_transition_key = coalesce(last_transition_key, '0005-legacy:' || id)
where lifecycle_state is null
   or canonical_product_id is null
   or source_system is null
   or source_product_id is null
   or moderation_status is null
   or lifecycle_updated_at is null
   or lifecycle_actor_type is null
   or last_transition_key is null;

alter table products validate constraint products_lifecycle_state_valid;
alter table products validate constraint products_moderation_status_valid;
alter table products validate constraint products_lifecycle_actor_type_valid;
alter table products validate constraint products_original_price_nonnegative;
alter table products validate constraint products_verified_price_nonnegative;
alter table products validate constraint products_comparison_price_order_valid;

alter table products
  alter column lifecycle_state set default 'discovered',
  alter column lifecycle_state set not null,
  alter column canonical_product_id set not null,
  alter column source_system set not null,
  alter column source_product_id set not null,
  alter column moderation_status set default 'pending',
  alter column moderation_status set not null,
  alter column lifecycle_failure_metadata set default '{}'::jsonb,
  alter column lifecycle_failure_metadata set not null,
  alter column lifecycle_audit_metadata set default '{}'::jsonb,
  alter column lifecycle_audit_metadata set not null,
  alter column lifecycle_transition_metadata set default '{}'::jsonb,
  alter column lifecycle_transition_metadata set not null,
  alter column lifecycle_updated_at set default now(),
  alter column lifecycle_updated_at set not null,
  alter column lifecycle_actor_type set default 'system',
  alter column lifecycle_actor_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_canonical_product_fk'
  ) then
    alter table products
      add constraint products_canonical_product_fk
      foreign key (canonical_product_id) references products(id)
      on delete no action
      deferrable initially deferred
      not valid;
  end if;
end $$;

alter table products validate constraint products_canonical_product_fk;

create unique index if not exists products_source_identity_unique
  on products(source_system, source_product_id);
create index if not exists products_canonical_product
  on products(canonical_product_id);
create index if not exists products_lifecycle_queue
  on products(lifecycle_state, lifecycle_updated_at);
create index if not exists products_moderation_queue
  on products(moderation_status, lifecycle_updated_at);
create index if not exists products_verification_age
  on products(verified_at, price_verified_at, last_checked_at);

-- A historical `published` state is not itself serving proof. Direct public
-- reads require current positive link, price, stock, trust, and timestamp
-- evidence. Service-role readers bypass RLS and must use the safe view below.
drop policy if exists "products public read trusted" on products;
create policy "products public read published" on products for select
  using (
    lifecycle_state = 'published'
    and trusted is true
    and in_stock is true
    and link_health_status = 'available'
    and verified_price_cents is not null
    and verified_currency is not null
    and price_cents = verified_price_cents
    and upper(currency) = upper(verified_currency)
    and verified_at >= now() - interval '24 hours'
    and price_verified_at >= now() - interval '24 hours'
    and last_checked_at >= now() - interval '24 hours'
    and verified_at <= now() + interval '5 minutes'
    and price_verified_at <= now() + interval '5 minutes'
    and last_checked_at <= now() + interval '5 minutes'
  );

create or replace view catalog_published_products
with (security_invoker = true)
as
select *
from products
where lifecycle_state = 'published'
  and trusted is true
  and in_stock is true
  and link_health_status = 'available'
  and verified_price_cents is not null
  and verified_currency is not null
  and price_cents = verified_price_cents
  and upper(currency) = upper(verified_currency)
  and verified_at >= now() - interval '24 hours'
  and price_verified_at >= now() - interval '24 hours'
  and last_checked_at >= now() - interval '24 hours'
  and verified_at <= now() + interval '5 minutes'
  and price_verified_at <= now() + interval '5 minutes'
  and last_checked_at <= now() + interval '5 minutes';

-- ===== phase 2: source provenance and variant/size inventory =====

create table if not exists catalog_product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  source_system text not null,
  source_product_id text not null,
  source_variant_family_id text,
  source_url text,
  canonical_url text,
  retailer text,
  raw_payload jsonb default '{}'::jsonb not null,
  policy_metadata jsonb default '{}'::jsonb not null,
  discovered_at timestamptz default now() not null,
  normalized_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint catalog_product_sources_identity_unique
    unique (source_system, source_product_id)
);

insert into catalog_product_sources (
  product_id,
  source_system,
  source_product_id,
  source_url,
  canonical_url,
  retailer,
  raw_payload,
  policy_metadata,
  discovered_at,
  last_seen_at
)
select
  id,
  source_system,
  source_product_id,
  coalesce(product_url, retailer_url),
  coalesce(product_url, retailer_url),
  retailer,
  '{}'::jsonb,
  jsonb_build_object('legacyBackfill', true, 'requiresSourcePolicyReview', true),
  lifecycle_updated_at,
  lifecycle_updated_at
from products
on conflict (source_system, source_product_id) do nothing;

create index if not exists catalog_product_sources_product
  on catalog_product_sources(product_id);
create index if not exists catalog_product_sources_last_seen
  on catalog_product_sources(last_seen_at);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  source_system text not null,
  source_variant_id text,
  sku text,
  title text,
  size_label text,
  normalized_size text,
  color_label text,
  option_values jsonb default '{}'::jsonb not null,
  stock_status text default 'unknown' not null,
  stock_quantity integer,
  current_price_cents integer,
  original_price_cents integer,
  verified_price_cents integer,
  currency text default 'USD' not null,
  exact_product_url text,
  availability_verified_at timestamptz,
  price_verified_at timestamptz,
  source_updated_at timestamptz,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint product_variants_stock_status_valid
    check (stock_status in ('available', 'out_of_stock', 'preorder', 'backorder', 'unknown')),
  constraint product_variants_stock_quantity_nonnegative
    check (stock_quantity is null or stock_quantity >= 0),
  constraint product_variants_current_price_nonnegative
    check (current_price_cents is null or current_price_cents >= 0),
  constraint product_variants_original_price_nonnegative
    check (original_price_cents is null or original_price_cents >= 0),
  constraint product_variants_verified_price_nonnegative
    check (verified_price_cents is null or verified_price_cents >= 0)
);

create unique index if not exists product_variants_source_identity_unique
  on product_variants(product_id, source_system, source_variant_id)
  where source_variant_id is not null;
create unique index if not exists product_variants_sku_unique
  on product_variants(product_id, source_system, sku)
  where sku is not null;
create index if not exists product_variants_size_stock
  on product_variants(product_id, normalized_size, stock_status);
create index if not exists product_variants_verification_age
  on product_variants(availability_verified_at, price_verified_at);

-- ===== phase 3: pipeline run, stage, and retry ledger =====

create table if not exists catalog_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  pipeline_version text not null,
  mode text default 'candidate_only' not null,
  trigger_kind text not null,
  status text default 'queued' not null,
  dry_run boolean default true not null,
  requested_by text,
  source_scope text[] default '{}'::text[] not null,
  baseline_count integer,
  candidate_count integer,
  approved_count integer,
  published_count integer,
  retired_count integer,
  failure_count integer default 0 not null,
  estimated_cost_cents integer default 0 not null,
  actual_cost_cents integer default 0 not null,
  config jsonb default '{}'::jsonb not null,
  evidence jsonb default '{}'::jsonb not null,
  failure_code text,
  failure_detail text,
  created_at timestamptz default now() not null,
  started_at timestamptz,
  completed_at timestamptz,
  constraint catalog_pipeline_runs_mode_valid
    check (mode in ('candidate_only', 'release')),
  constraint catalog_pipeline_runs_trigger_valid
    check (trigger_kind in ('scheduled', 'manual', 'retry', 'backfill', 'health_repair')),
  constraint catalog_pipeline_runs_status_valid
    check (status in ('queued', 'running', 'succeeded', 'failed', 'blocked', 'cancelled')),
  constraint catalog_pipeline_runs_counts_nonnegative
    check (
      coalesce(baseline_count, 0) >= 0
      and coalesce(candidate_count, 0) >= 0
      and coalesce(approved_count, 0) >= 0
      and coalesce(published_count, 0) >= 0
      and coalesce(retired_count, 0) >= 0
      and failure_count >= 0
      and estimated_cost_cents >= 0
      and actual_cost_cents >= 0
    )
);

create table if not exists catalog_pipeline_stage_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references catalog_pipeline_runs(id) on delete cascade,
  stage_name text not null,
  attempt integer default 1 not null,
  status text default 'pending' not null,
  input_count integer,
  output_count integer,
  rejected_count integer default 0 not null,
  retryable boolean default false not null,
  failure_code text,
  failure_detail text,
  evidence jsonb default '{}'::jsonb not null,
  metrics jsonb default '{}'::jsonb not null,
  estimated_cost_cents integer default 0 not null,
  actual_cost_cents integer default 0 not null,
  created_at timestamptz default now() not null,
  started_at timestamptz,
  completed_at timestamptz,
  constraint catalog_pipeline_stage_runs_identity_unique
    unique (run_id, stage_name, attempt),
  constraint catalog_pipeline_stage_runs_attempt_positive check (attempt > 0),
  constraint catalog_pipeline_stage_runs_status_valid
    check (status in ('pending', 'running', 'succeeded', 'failed', 'blocked', 'skipped', 'cancelled')),
  constraint catalog_pipeline_stage_runs_counts_nonnegative
    check (
      coalesce(input_count, 0) >= 0
      and coalesce(output_count, 0) >= 0
      and rejected_count >= 0
      and estimated_cost_cents >= 0
      and actual_cost_cents >= 0
    )
);

create table if not exists catalog_pipeline_retries (
  id uuid primary key default gen_random_uuid(),
  stage_run_id uuid not null references catalog_pipeline_stage_runs(id) on delete cascade,
  retry_number integer not null,
  idempotency_key text not null unique,
  status text default 'scheduled' not null,
  failure_class text,
  failure_code text,
  delay_ms integer default 0 not null,
  scheduled_for timestamptz not null,
  claim_token uuid,
  claimed_by text,
  lease_expires_at timestamptz,
  next_stage_run_id uuid references catalog_pipeline_stage_runs(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  error_metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  constraint catalog_pipeline_retries_identity_unique
    unique (stage_run_id, retry_number),
  constraint catalog_pipeline_retries_number_positive check (retry_number > 0),
  constraint catalog_pipeline_retries_delay_nonnegative check (delay_ms >= 0),
  constraint catalog_pipeline_retries_status_valid
    check (status in ('scheduled', 'running', 'succeeded', 'failed', 'abandoned', 'cancelled')),
  constraint catalog_pipeline_retries_claim_shape_valid
    check (
      status <> 'running'
      or (
        claim_token is not null
        and nullif(claimed_by, '') is not null
        and lease_expires_at is not null
        and next_stage_run_id is not null
      )
    )
);

create index if not exists catalog_pipeline_runs_status_created
  on catalog_pipeline_runs(status, created_at desc);
create index if not exists catalog_pipeline_stage_runs_run_status
  on catalog_pipeline_stage_runs(run_id, status, stage_name);
create index if not exists catalog_pipeline_retries_due
  on catalog_pipeline_retries(status, scheduled_for);

-- ===== phase 4: review decisions, audit events, and actionable alerts =====

create table if not exists catalog_review_decisions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  product_id text not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  pipeline_run_id uuid references catalog_pipeline_runs(id) on delete set null,
  decision text not null,
  previous_state text,
  resulting_state text,
  reviewer_type text not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_label text,
  reason_code text not null,
  notes text,
  evidence jsonb default '{}'::jsonb not null,
  decided_at timestamptz default now() not null,
  constraint catalog_review_decisions_decision_valid
    check (decision in ('approve', 'reject', 'quarantine', 'retire', 'request_changes', 'release')),
  constraint catalog_review_decisions_reviewer_type_valid
    check (reviewer_type in ('human', 'policy', 'system')),
  constraint catalog_review_decisions_previous_state_valid
    check (
      previous_state is null or previous_state in (
        'discovered', 'normalized', 'deduplicated', 'enriched',
        'image_ready', 'verified', 'approved', 'published',
        'retired', 'quarantined', 'rejected'
      )
    ),
  constraint catalog_review_decisions_resulting_state_valid
    check (
      resulting_state is null or resulting_state in (
        'discovered', 'normalized', 'deduplicated', 'enriched',
        'image_ready', 'verified', 'approved', 'published',
        'retired', 'quarantined', 'rejected'
      )
    )
);

create table if not exists product_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  product_id text not null references products(id) on delete cascade,
  pipeline_run_id uuid references catalog_pipeline_runs(id) on delete set null,
  review_decision_id uuid references catalog_review_decisions(id) on delete set null,
  from_state text,
  to_state text not null,
  actor_type text not null,
  actor_id text,
  reason_code text,
  failure_code text,
  failure_detail text,
  evidence jsonb default '{}'::jsonb not null,
  occurred_at timestamptz default now() not null,
  constraint product_lifecycle_events_actor_type_valid
    check (actor_type in ('system', 'operator', 'source', 'migration')),
  constraint product_lifecycle_events_from_state_valid
    check (
      from_state is null or from_state in (
        'discovered', 'normalized', 'deduplicated', 'enriched',
        'image_ready', 'verified', 'approved', 'published',
        'retired', 'quarantined', 'rejected'
      )
    ),
  constraint product_lifecycle_events_to_state_valid
    check (
      to_state in (
        'discovered', 'normalized', 'deduplicated', 'enriched',
        'image_ready', 'verified', 'approved', 'published',
        'retired', 'quarantined', 'rejected'
      )
    )
);

create table if not exists catalog_alerts (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  alert_type text not null,
  severity text not null,
  status text default 'open' not null,
  product_id text references products(id) on delete set null,
  pipeline_run_id uuid references catalog_pipeline_runs(id) on delete set null,
  stage_run_id uuid references catalog_pipeline_stage_runs(id) on delete set null,
  source_system text,
  title text not null,
  detail text,
  occurrence_count integer default 1 not null,
  threshold_metadata jsonb default '{}'::jsonb not null,
  evidence jsonb default '{}'::jsonb not null,
  first_seen_at timestamptz default now() not null,
  last_seen_at timestamptz default now() not null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  constraint catalog_alerts_type_valid
    check (
      alert_type in (
        'pipeline_failure', 'stale_health', 'catalog_shrink', 'broken_link_spike',
        'affiliate_wrap_failure', 'source_degradation', 'retry_exhausted',
        'price_anomaly', 'review_backlog', 'outfit_repair_required'
      )
    ),
  constraint catalog_alerts_severity_valid
    check (severity in ('info', 'warning', 'critical')),
  constraint catalog_alerts_status_valid
    check (status in ('open', 'acknowledged', 'resolved', 'suppressed')),
  constraint catalog_alerts_occurrence_positive check (occurrence_count > 0)
);

-- Immutable association keeps a stage failure replayable even after its alert
-- is resolved or a later attempt reuses the same active alert dedupe key.
create table if not exists catalog_stage_failure_events (
  id uuid primary key default gen_random_uuid(),
  stage_run_id uuid not null unique references catalog_pipeline_stage_runs(id) on delete cascade,
  retry_id uuid references catalog_pipeline_retries(id) on delete set null,
  alert_id uuid not null references catalog_alerts(id) on delete restrict,
  failure_code text not null,
  retryable boolean not null,
  committed_at timestamptz default now() not null
);

-- Authoritative served outfit state. Repair analytics are forbidden unless a
-- repair transaction updates this row and appends its immutable ledger edge.
create table if not exists catalog_served_outfits (
  look_id text primary key,
  product_ids text[] not null,
  status text default 'active' not null,
  max_total_cents integer not null,
  source_version text not null,
  version integer default 1 not null,
  last_repair_key text unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint catalog_served_outfits_status_valid check (status in ('active', 'suppressed')),
  constraint catalog_served_outfits_shape_valid check (
    cardinality(product_ids) >= 3
    and max_total_cents >= 0
    and version > 0
    and nullif(source_version, '') is not null
  )
);

-- Retirement queues repair work from authoritative served state in the same
-- transaction as the lifecycle edge. Claims are leased and restart-resumable.
create table if not exists catalog_outfit_repair_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  retirement_transition_key text not null references product_lifecycle_events(idempotency_key) on delete restrict,
  look_id text not null references catalog_served_outfits(look_id) on delete cascade,
  pipeline_run_id uuid references catalog_pipeline_runs(id) on delete set null,
  retired_product_id text not null references products(id) on delete restrict,
  previous_product_ids text[] not null,
  max_total_cents integer not null,
  status text default 'queued' not null,
  attempt_count integer default 0 not null,
  claim_token uuid,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint catalog_outfit_repair_jobs_transition_look_unique
    unique (retirement_transition_key, look_id),
  constraint catalog_outfit_repair_jobs_status_valid
    check (status in ('queued', 'claimed', 'repaired', 'suppressed', 'failed', 'cancelled')),
  constraint catalog_outfit_repair_jobs_counts_valid
    check (attempt_count >= 0 and max_total_cents >= 0),
  constraint catalog_outfit_repair_jobs_claim_shape_valid
    check (
      status <> 'claimed'
      or (
        claim_token is not null
        and nullif(claimed_by, '') is not null
        and claimed_at is not null
        and lease_expires_at is not null
      )
    )
);

-- Durable post-repair state and audit. The served-state update, this insert,
-- and job completion are one transaction in catalog_worker_commit_outfit_repair.
create table if not exists catalog_outfit_repairs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  repair_job_id uuid not null unique references catalog_outfit_repair_jobs(id) on delete restrict,
  look_id text not null,
  pipeline_run_id uuid references catalog_pipeline_runs(id) on delete set null,
  retired_product_id text references products(id) on delete set null,
  status text not null,
  previous_product_ids text[] default '{}'::text[] not null,
  resulting_product_ids text[] default '{}'::text[] not null,
  replacements jsonb default '[]'::jsonb not null,
  removed_optional_product_ids text[] default '{}'::text[] not null,
  suppression_reason text,
  total_cents integer,
  served_state_version integer not null,
  committed_at timestamptz default now() not null,
  constraint catalog_outfit_repairs_status_valid
    check (status in ('repaired', 'suppressed')),
  constraint catalog_outfit_repairs_total_nonnegative
    check (total_cents is null or total_cents >= 0),
  constraint catalog_outfit_repairs_version_positive
    check (served_state_version > 0),
  constraint catalog_outfit_repairs_shape_valid
    check (
      (status = 'repaired'
        and cardinality(resulting_product_ids) >= 3
        and total_cents is not null
        and suppression_reason is null)
      or
      (status = 'suppressed'
        and cardinality(resulting_product_ids) = 0
        and total_cents is null
        and nullif(suppression_reason, '') is not null)
    )
);

create index if not exists catalog_review_decisions_product_time
  on catalog_review_decisions(product_id, decided_at desc);
create index if not exists product_lifecycle_events_product_time
  on product_lifecycle_events(product_id, occurred_at desc);
create index if not exists product_lifecycle_events_run
  on product_lifecycle_events(pipeline_run_id, occurred_at desc);
create unique index if not exists catalog_alerts_active_dedupe
  on catalog_alerts(dedupe_key)
  where status in ('open', 'acknowledged');
create index if not exists catalog_alerts_queue
  on catalog_alerts(status, severity, last_seen_at desc);
create index if not exists catalog_stage_failure_events_alert
  on catalog_stage_failure_events(alert_id, committed_at desc);
create index if not exists catalog_served_outfits_product_ids
  on catalog_served_outfits using gin(product_ids);
create index if not exists catalog_outfit_repair_jobs_claim
  on catalog_outfit_repair_jobs(status, lease_expires_at, created_at);
create index if not exists catalog_outfit_repair_jobs_retired_product
  on catalog_outfit_repair_jobs(retired_product_id, status);
create index if not exists catalog_outfit_repairs_look_time
  on catalog_outfit_repairs(look_id, committed_at desc);
create index if not exists catalog_outfit_repairs_run
  on catalog_outfit_repairs(pipeline_run_id, committed_at desc);

-- Existing records receive one explicit migration event. It records serving
-- continuity, not verification, approval, or price evidence.
insert into product_lifecycle_events (
  idempotency_key,
  product_id,
  from_state,
  to_state,
  actor_type,
  actor_id,
  reason_code,
  evidence,
  occurred_at
)
select
  '0005-legacy:' || id,
  id,
  null,
  lifecycle_state,
  'migration',
  '0005_catalog_lifecycle',
  'legacy_surface_backfill',
  jsonb_build_object(
    'legacyPublishedStatePreserved', lifecycle_state = 'published',
    'verificationEvidenceBackfilled', false,
    'publicServingEligible', false,
    'moderationStatus', moderation_status
  ),
  lifecycle_updated_at
from products
on conflict (idempotency_key) do nothing;

-- ===== phase 5: database-enforced transition and audit boundary =====

create or replace function catalog_lifecycle_transition_allowed(
  from_state text,
  to_state text
) returns boolean
language sql
immutable
as $$
  select case
    when from_state = to_state then true
    when to_state in ('quarantined', 'rejected')
      and from_state not in ('retired', 'rejected') then true
    when from_state = 'discovered' then to_state = 'normalized'
    when from_state = 'normalized' then to_state = 'deduplicated'
    when from_state = 'deduplicated' then to_state = 'enriched'
    when from_state = 'enriched' then to_state = 'image_ready'
    when from_state = 'image_ready' then to_state = 'verified'
    when from_state = 'verified' then to_state = 'approved'
    when from_state = 'approved' then to_state = 'published'
    when from_state = 'published' then to_state in ('retired', 'quarantined')
    when from_state = 'quarantined' then to_state in ('discovered', 'retired', 'rejected')
    when from_state = 'retired' then to_state = 'discovered'
    when from_state = 'rejected' then to_state = 'discovered'
    else false
  end;
$$;

create or replace function enforce_product_lifecycle_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.lifecycle_state := coalesce(new.lifecycle_state, 'discovered');
    new.canonical_product_id := coalesce(new.canonical_product_id, new.id);
    new.source_system := coalesce(nullif(new.source_system, ''), 'legacy_import');
    new.source_product_id := coalesce(nullif(new.source_product_id, ''), new.id);
    new.moderation_status := coalesce(new.moderation_status, 'pending');
    new.lifecycle_updated_at := coalesce(new.lifecycle_updated_at, now());
    new.lifecycle_actor_type := coalesce(new.lifecycle_actor_type, 'system');
    return new;
  end if;

  if new.lifecycle_state is not distinct from old.lifecycle_state then
    return new;
  end if;

  if not catalog_lifecycle_transition_allowed(old.lifecycle_state, new.lifecycle_state) then
    raise exception 'invalid catalog lifecycle transition: % -> %',
      old.lifecycle_state, new.lifecycle_state
      using errcode = '23514';
  end if;

  if nullif(new.last_transition_key, '') is null
     or new.last_transition_key is not distinct from old.last_transition_key then
    raise exception 'a fresh last_transition_key is required for lifecycle transitions'
      using errcode = '23514';
  end if;

  if new.lifecycle_state in (
    'normalized', 'deduplicated', 'enriched', 'image_ready',
    'verified', 'approved', 'published'
  ) and (
    nullif(new.source_system, '') is null
    or nullif(new.source_product_id, '') is null
  ) then
    raise exception 'source_system and source_product_id are required by normalized state'
      using errcode = '23514';
  end if;

  if new.lifecycle_state in (
    'deduplicated', 'enriched', 'image_ready', 'verified', 'approved', 'published'
  ) and new.canonical_product_id is null then
    raise exception 'canonical_product_id is required by deduplicated state'
      using errcode = '23514';
  end if;

  if new.lifecycle_state = 'normalized' and new.normalized_at is null then
    raise exception 'normalized_at is required for normalized state' using errcode = '23514';
  end if;
  if new.lifecycle_state = 'deduplicated' and new.deduplicated_at is null then
    raise exception 'deduplicated_at is required for deduplicated state' using errcode = '23514';
  end if;
  if new.lifecycle_state = 'enriched' and new.enriched_at is null then
    raise exception 'enriched_at is required for enriched state' using errcode = '23514';
  end if;
  if new.lifecycle_state = 'image_ready' and new.image_ready_at is null then
    raise exception 'image_ready_at is required for image_ready state' using errcode = '23514';
  end if;

  if new.lifecycle_state in ('verified', 'approved', 'published') and (
    new.verified_at is null
    or new.price_verified_at is null
    or new.verified_price_cents is null
    or new.verified_currency is null
    or new.price_cents is distinct from new.verified_price_cents
    or upper(new.currency) is distinct from upper(new.verified_currency)
    or new.link_health_status is distinct from 'available'
    or new.last_checked_at is null
    or new.in_stock is distinct from true
    or new.trusted is distinct from true
  ) then
    raise exception 'verified state requires positive timestamped price, link, stock, and trust evidence'
      using errcode = '23514';
  end if;

  if new.lifecycle_state in ('verified', 'approved', 'published') and (
    new.verified_at < now() - interval '24 hours'
    or new.price_verified_at < now() - interval '24 hours'
    or new.last_checked_at < now() - interval '24 hours'
    or new.verified_at > now() + interval '5 minutes'
    or new.price_verified_at > now() + interval '5 minutes'
    or new.last_checked_at > now() + interval '5 minutes'
  ) then
    raise exception 'verified state requires evidence no older than 24 hours and no more than 5 minutes future-dated'
      using errcode = '23514';
  end if;

  if new.lifecycle_state in ('approved', 'published') and (
    new.approved_at is null
    or new.moderation_status not in ('approved', 'auto_approved')
  ) then
    raise exception 'approved state requires approval time and moderation decision'
      using errcode = '23514';
  end if;

  if new.lifecycle_state = 'published' and new.published_at is null then
    raise exception 'published_at is required for published state' using errcode = '23514';
  end if;

  if new.lifecycle_state = 'retired' and new.retired_at is null then
    raise exception 'retired_at is required for retired state' using errcode = '23514';
  end if;

  if new.lifecycle_state in ('retired', 'quarantined', 'rejected') and (
    nullif(new.lifecycle_reason_code, '') is null
    and nullif(new.lifecycle_failure_code, '') is null
  ) then
    raise exception 'terminal and quarantine transitions require a reason or failure code'
      using errcode = '23514';
  end if;

  new.lifecycle_updated_at := now();
  return new;
end;
$$;

create or replace function audit_product_lifecycle_transition()
returns trigger
language plpgsql
as $$
begin
  if new.lifecycle_state is not distinct from old.lifecycle_state then
    return new;
  end if;

  insert into product_lifecycle_events (
    idempotency_key,
    product_id,
    from_state,
    to_state,
    actor_type,
    actor_id,
    reason_code,
    failure_code,
    failure_detail,
    evidence,
    occurred_at
  ) values (
    new.last_transition_key,
    new.id,
    old.lifecycle_state,
    new.lifecycle_state,
    new.lifecycle_actor_type,
    new.lifecycle_actor_id,
    new.lifecycle_reason_code,
    new.lifecycle_failure_code,
    new.lifecycle_failure_detail,
    coalesce(new.lifecycle_transition_metadata, '{}'::jsonb),
    new.lifecycle_updated_at
  );

  return new;
end;
$$;

drop trigger if exists products_lifecycle_guard on products;
create trigger products_lifecycle_guard
  before insert or update of lifecycle_state on products
  for each row execute function enforce_product_lifecycle_transition();

drop trigger if exists products_lifecycle_audit on products;
create trigger products_lifecycle_audit
  after update of lifecycle_state on products
  for each row execute function audit_product_lifecycle_transition();

-- ===== phase 6: atomic service-role worker RPC boundary =====
--
-- PostgREST does not expose a client-side multi-statement transaction. These
-- narrowly scoped functions keep each run/stage/retry/alert/lifecycle/repair
-- acknowledgement inside one PostgreSQL transaction. They return explicit
-- committed/replay outcomes so callers cannot mistake a successful HTTP call
-- for a newly committed ledger edge.

revoke create on schema public from public, anon, authenticated;

create or replace function catalog_worker_ensure_run(
  p_idempotency_key text,
  p_pipeline_version text,
  p_mode text,
  p_trigger_kind text,
  p_dry_run boolean,
  p_requested_by text,
  p_source_scope text[],
  p_occurred_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  inserted catalog_pipeline_runs%rowtype;
  existing catalog_pipeline_runs%rowtype;
begin
  if nullif(trim(p_idempotency_key), '') is null
     or nullif(trim(p_pipeline_version), '') is null
     or p_occurred_at is null then
    raise exception 'catalog run identity and explicit time are required' using errcode = '22023';
  end if;

  insert into catalog_pipeline_runs (
    idempotency_key, pipeline_version, mode, trigger_kind, status, dry_run,
    requested_by, source_scope, created_at, started_at
  ) values (
    p_idempotency_key, p_pipeline_version, p_mode, p_trigger_kind, 'running',
    p_dry_run, p_requested_by, coalesce(p_source_scope, '{}'::text[]),
    p_occurred_at, p_occurred_at
  )
  on conflict (idempotency_key) do nothing
  returning * into inserted;

  if inserted.id is not null then
    return jsonb_build_object(
      'outcome', 'committed',
      'run_id', inserted.id,
      'idempotency_key', inserted.idempotency_key,
      'committed_at', inserted.created_at
    );
  end if;

  select * into existing
  from catalog_pipeline_runs
  where idempotency_key = p_idempotency_key
  for update;

  if existing.pipeline_version is distinct from p_pipeline_version
     or existing.mode is distinct from p_mode
     or existing.trigger_kind is distinct from p_trigger_kind
     or existing.dry_run is distinct from p_dry_run
     or existing.requested_by is distinct from p_requested_by
     or existing.source_scope is distinct from coalesce(p_source_scope, '{}'::text[]) then
    raise exception 'catalog run idempotency key reused with conflicting identity'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'outcome', 'replay',
    'run_id', existing.id,
    'idempotency_key', existing.idempotency_key,
    'committed_at', existing.created_at
  );
end;
$$;

create or replace function catalog_worker_begin_stage(
  p_run_id uuid,
  p_stage_name text,
  p_attempt integer,
  p_occurred_at timestamptz,
  p_input_count integer,
  p_estimated_cost_cents integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  inserted catalog_pipeline_stage_runs%rowtype;
  existing catalog_pipeline_stage_runs%rowtype;
begin
  if nullif(trim(p_stage_name), '') is null
     or p_attempt < 1
     or p_occurred_at is null
     or coalesce(p_input_count, 0) < 0
     or coalesce(p_estimated_cost_cents, 0) < 0 then
    raise exception 'invalid catalog stage attempt' using errcode = '22023';
  end if;

  insert into catalog_pipeline_stage_runs (
    run_id, stage_name, attempt, status, input_count,
    estimated_cost_cents, created_at, started_at
  ) values (
    p_run_id, p_stage_name, p_attempt, 'running', p_input_count,
    coalesce(p_estimated_cost_cents, 0), p_occurred_at, p_occurred_at
  )
  on conflict (run_id, stage_name, attempt) do nothing
  returning * into inserted;

  if inserted.id is not null then
    return jsonb_build_object(
      'outcome', 'committed',
      'stage_run_id', inserted.id,
      'run_id', inserted.run_id,
      'stage_name', inserted.stage_name,
      'attempt', inserted.attempt,
      'stage_status', inserted.status,
      'committed_at', inserted.created_at
    );
  end if;

  select * into existing
  from catalog_pipeline_stage_runs
  where run_id = p_run_id and stage_name = p_stage_name and attempt = p_attempt
  for update;

  if existing.input_count is distinct from p_input_count
     or existing.estimated_cost_cents is distinct from coalesce(p_estimated_cost_cents, 0) then
    raise exception 'catalog stage attempt replay conflicts with committed input'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'outcome', 'replay',
    'stage_run_id', existing.id,
    'run_id', existing.run_id,
    'stage_name', existing.stage_name,
    'attempt', existing.attempt,
    'stage_status', existing.status,
    'committed_at', coalesce(existing.completed_at, existing.started_at, existing.created_at)
  );
end;
$$;

create or replace function catalog_worker_complete_stage(
  p_run_id uuid,
  p_stage_name text,
  p_attempt integer,
  p_occurred_at timestamptz,
  p_output_count integer,
  p_rejected_count integer,
  p_actual_cost_cents integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  stage_row catalog_pipeline_stage_runs%rowtype;
  was_replay boolean := false;
begin
  if p_output_count < 0 or p_rejected_count < 0 or p_actual_cost_cents < 0
     or p_occurred_at is null then
    raise exception 'invalid catalog stage completion' using errcode = '22023';
  end if;

  select * into stage_row
  from catalog_pipeline_stage_runs
  where run_id = p_run_id and stage_name = p_stage_name and attempt = p_attempt
  for update;
  if not found then
    raise exception 'catalog stage attempt does not exist' using errcode = 'P0002';
  end if;

  if stage_row.status = 'succeeded' then
    if stage_row.output_count is distinct from p_output_count
       or stage_row.rejected_count is distinct from p_rejected_count
       or stage_row.actual_cost_cents is distinct from p_actual_cost_cents then
      raise exception 'catalog stage completion replay conflicts with committed output'
        using errcode = '23505';
    end if;
    was_replay := true;
  elsif stage_row.status not in ('pending', 'running') then
    raise exception 'terminal catalog stage cannot be completed' using errcode = '23514';
  else
    update catalog_pipeline_stage_runs
    set status = 'succeeded',
        output_count = p_output_count,
        rejected_count = p_rejected_count,
        actual_cost_cents = p_actual_cost_cents,
        completed_at = p_occurred_at
    where id = stage_row.id
    returning * into stage_row;

    update catalog_pipeline_runs
    set actual_cost_cents = actual_cost_cents + p_actual_cost_cents
    where id = p_run_id;
  end if;

  return jsonb_build_object(
    'outcome', case when was_replay then 'replay' else 'committed' end,
    'stage_run_id', stage_row.id,
    'run_id', stage_row.run_id,
    'stage_name', stage_row.stage_name,
    'attempt', stage_row.attempt,
    'stage_status', stage_row.status,
    'committed_at', coalesce(stage_row.completed_at, p_occurred_at)
  );
end;
$$;

create or replace function catalog_worker_fail_stage(
  p_run_id uuid,
  p_stage_name text,
  p_attempt integer,
  p_occurred_at timestamptz,
  p_failure_code text,
  p_retryable boolean,
  p_retry jsonb,
  p_alert_type text,
  p_alert_severity text,
  p_alert_dedupe_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  stage_row catalog_pipeline_stage_runs%rowtype;
  retry_row catalog_pipeline_retries%rowtype;
  alert_row catalog_alerts%rowtype;
  failure_event catalog_stage_failure_events%rowtype;
  expected_retry_number integer;
  expected_retry_key text;
begin
  if nullif(trim(p_failure_code), '') is null
     or nullif(trim(p_alert_dedupe_key), '') is null
     or p_occurred_at is null then
    raise exception 'catalog stage failure requires bounded identities and time'
      using errcode = '22023';
  end if;

  select * into stage_row
  from catalog_pipeline_stage_runs
  where run_id = p_run_id and stage_name = p_stage_name and attempt = p_attempt
  for update;
  if not found then
    raise exception 'catalog stage attempt does not exist' using errcode = 'P0002';
  end if;

  if p_retry is not null then
    expected_retry_number := (p_retry ->> 'retry_number')::integer;
    expected_retry_key := p_retry ->> 'idempotency_key';
    if expected_retry_number < 1
       or nullif(trim(expected_retry_key), '') is null
       or (p_retry ->> 'delay_ms')::integer < 0
       or (p_retry ->> 'scheduled_for')::timestamptz is null then
      raise exception 'invalid durable catalog retry' using errcode = '22023';
    end if;
  elsif p_retryable then
    raise exception 'retryable stage failure requires a durable retry payload'
      using errcode = '22023';
  end if;

  if stage_row.status = 'failed' then
    if stage_row.failure_code is distinct from p_failure_code
       or stage_row.retryable is distinct from p_retryable then
      raise exception 'catalog stage failure replay conflicts with committed failure'
        using errcode = '23505';
    end if;
    select * into failure_event
    from catalog_stage_failure_events
    where stage_run_id = stage_row.id;
    if not found then
      raise exception 'replayed catalog failure is missing its immutable association'
        using errcode = '23514';
    end if;
    select * into alert_row from catalog_alerts where id = failure_event.alert_id;
    if not found
       or alert_row.dedupe_key is distinct from p_alert_dedupe_key
       or alert_row.alert_type is distinct from p_alert_type then
      raise exception 'replayed catalog failure alert identity conflicts'
        using errcode = '23505';
    end if;
    if failure_event.retry_id is not null then
      select * into retry_row from catalog_pipeline_retries where id = failure_event.retry_id;
    end if;
    if (p_retry is null) is distinct from (failure_event.retry_id is null)
       or (p_retry is not null and (
         retry_row.idempotency_key is distinct from expected_retry_key
         or retry_row.retry_number is distinct from expected_retry_number
         or retry_row.delay_ms is distinct from (p_retry ->> 'delay_ms')::integer
         or retry_row.scheduled_for is distinct from (p_retry ->> 'scheduled_for')::timestamptz
       )) then
      raise exception 'replayed catalog failure retry identity conflicts'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'outcome', 'replay',
      'stage_run_id', stage_row.id,
      'run_id', stage_row.run_id,
      'stage_name', stage_row.stage_name,
      'attempt', stage_row.attempt,
      'stage_status', stage_row.status,
      'retry_id', failure_event.retry_id,
      'alert_id', failure_event.alert_id,
      'committed_at', failure_event.committed_at
    );
  elsif stage_row.status not in ('pending', 'running') then
    raise exception 'terminal catalog stage cannot be failed' using errcode = '23514';
  else
    update catalog_pipeline_stage_runs
    set status = 'failed',
        retryable = p_retryable,
        failure_code = p_failure_code,
        failure_detail = null,
        completed_at = p_occurred_at
    where id = stage_row.id
    returning * into stage_row;

    update catalog_pipeline_runs
    set failure_count = failure_count + 1,
        failure_code = case when p_retry is null then p_failure_code else failure_code end
    where id = p_run_id;
  end if;

  if p_retry is not null then
    insert into catalog_pipeline_retries (
      stage_run_id, retry_number, idempotency_key, status, failure_class,
      failure_code, delay_ms, scheduled_for, error_metadata, created_at
    ) values (
      stage_row.id, expected_retry_number, expected_retry_key, 'scheduled',
      'stage_failure', p_failure_code, (p_retry ->> 'delay_ms')::integer,
      (p_retry ->> 'scheduled_for')::timestamptz,
      jsonb_build_object('source', 'catalog_worker_fail_stage'), p_occurred_at
    )
    on conflict (idempotency_key) do nothing
    returning * into retry_row;

    if retry_row.id is null then
      select * into retry_row
      from catalog_pipeline_retries
      where idempotency_key = expected_retry_key
      for update;
      if retry_row.stage_run_id is distinct from stage_row.id
         or retry_row.retry_number is distinct from expected_retry_number
         or retry_row.failure_code is distinct from p_failure_code
         or retry_row.delay_ms is distinct from (p_retry ->> 'delay_ms')::integer
         or retry_row.scheduled_for is distinct from (p_retry ->> 'scheduled_for')::timestamptz then
        raise exception 'catalog retry idempotency key reused with conflicting identity'
          using errcode = '23505';
      end if;
    end if;
  end if;

  select * into alert_row
  from catalog_alerts
  where dedupe_key = p_alert_dedupe_key
    and status in ('open', 'acknowledged')
  for update;

  if alert_row.id is not null then
    if alert_row.alert_type is distinct from p_alert_type
       or alert_row.pipeline_run_id is distinct from p_run_id then
      raise exception 'active catalog alert dedupe key conflicts with failure identity'
        using errcode = '23505';
    end if;
    update catalog_alerts
    set occurrence_count = occurrence_count + 1,
        severity = p_alert_severity,
        stage_run_id = stage_row.id,
        last_seen_at = p_occurred_at,
        evidence = jsonb_build_object('failureCode', p_failure_code)
    where id = alert_row.id
    returning * into alert_row;
  else
    insert into catalog_alerts (
      dedupe_key, alert_type, severity, status, pipeline_run_id, stage_run_id,
      title, detail, evidence, first_seen_at, last_seen_at
    ) values (
      p_alert_dedupe_key, p_alert_type, p_alert_severity, 'open', p_run_id,
      stage_row.id, 'Catalog stage failed', null,
      jsonb_build_object('failureCode', p_failure_code), p_occurred_at, p_occurred_at
    )
    returning * into alert_row;
  end if;

  insert into catalog_stage_failure_events (
    stage_run_id, retry_id, alert_id, failure_code, retryable, committed_at
  ) values (
    stage_row.id, retry_row.id, alert_row.id, p_failure_code, p_retryable, p_occurred_at
  ) returning * into failure_event;

  return jsonb_build_object(
    'outcome', 'committed',
    'stage_run_id', stage_row.id,
    'run_id', stage_row.run_id,
    'stage_name', stage_row.stage_name,
    'attempt', stage_row.attempt,
    'stage_status', stage_row.status,
    'retry_id', retry_row.id,
    'alert_id', alert_row.id,
    'committed_at', failure_event.committed_at
  );
end;
$$;

create or replace function catalog_worker_claim_retries(
  p_worker_id text,
  p_limit integer,
  p_lease_ms integer,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  retry_row catalog_pipeline_retries%rowtype;
  failed_stage catalog_pipeline_stage_runs%rowtype;
  next_stage catalog_pipeline_stage_runs%rowtype;
  new_claim_token uuid;
  lease_until timestamptz;
  claims jsonb := '[]'::jsonb;
begin
  if nullif(trim(p_worker_id), '') is null
     or p_limit < 1 or p_limit > 100
     or p_lease_ms < 1000 or p_lease_ms > 3600000
     or p_occurred_at is null then
    raise exception 'invalid retry claim request' using errcode = '22023';
  end if;
  lease_until := p_occurred_at + (p_lease_ms * interval '1 millisecond');

  for retry_row in
    select *
    from catalog_pipeline_retries
    where (
      (status = 'scheduled' and scheduled_for <= p_occurred_at)
      or (status = 'running' and lease_expires_at <= p_occurred_at)
    )
    order by scheduled_for, created_at, id
    limit p_limit
    for update skip locked
  loop
    select * into failed_stage
    from catalog_pipeline_stage_runs
    where id = retry_row.stage_run_id;
    if not found then
      raise exception 'retry references missing failed stage' using errcode = '23503';
    end if;

    if retry_row.next_stage_run_id is null then
      insert into catalog_pipeline_stage_runs (
        run_id, stage_name, attempt, status, input_count, estimated_cost_cents,
        created_at, started_at
      ) values (
        failed_stage.run_id, failed_stage.stage_name, failed_stage.attempt + 1,
        'running', failed_stage.input_count, failed_stage.estimated_cost_cents,
        p_occurred_at, p_occurred_at
      ) returning * into next_stage;
    else
      select * into next_stage
      from catalog_pipeline_stage_runs
      where id = retry_row.next_stage_run_id
      for update;
      if next_stage.status not in ('pending', 'running') then
        continue;
      end if;
      update catalog_pipeline_stage_runs
      set status = 'running', started_at = coalesce(started_at, p_occurred_at)
      where id = next_stage.id
      returning * into next_stage;
    end if;

    new_claim_token := gen_random_uuid();
    update catalog_pipeline_retries
    set status = 'running',
        claim_token = new_claim_token,
        claimed_by = p_worker_id,
        lease_expires_at = lease_until,
        next_stage_run_id = next_stage.id,
        started_at = coalesce(started_at, p_occurred_at)
    where id = retry_row.id
    returning * into retry_row;

    claims := claims || jsonb_build_array(jsonb_build_object(
      'retry_id', retry_row.id,
      'claim_token', retry_row.claim_token,
      'run_id', next_stage.run_id,
      'stage_name', next_stage.stage_name,
      'next_attempt', next_stage.attempt,
      'next_stage_run_id', next_stage.id,
      'lease_expires_at', retry_row.lease_expires_at
    ));
  end loop;

  return jsonb_build_object(
    'outcome', case when jsonb_array_length(claims) > 0 then 'committed' else 'noop' end,
    'claims', claims
  );
end;
$$;

create or replace function catalog_worker_complete_retry(
  p_retry_id uuid,
  p_claim_token uuid,
  p_status text,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  retry_row catalog_pipeline_retries%rowtype;
  next_stage catalog_pipeline_stage_runs%rowtype;
  was_replay boolean := false;
begin
  if p_status not in ('succeeded', 'failed', 'abandoned', 'cancelled')
     or p_occurred_at is null then
    raise exception 'invalid retry completion request' using errcode = '22023';
  end if;
  select * into retry_row
  from catalog_pipeline_retries
  where id = p_retry_id
  for update;
  if not found then
    raise exception 'retry does not exist' using errcode = 'P0002';
  end if;
  if retry_row.status = p_status then
    if retry_row.claim_token is distinct from p_claim_token then
      raise exception 'retry completion token conflicts with committed completion'
        using errcode = '23505';
    end if;
    was_replay := true;
  elsif retry_row.status <> 'running'
     or retry_row.claim_token is distinct from p_claim_token then
    raise exception 'retry is not owned by this claim' using errcode = '40001';
  else
    select * into next_stage
    from catalog_pipeline_stage_runs
    where id = retry_row.next_stage_run_id
    for update;
    if not found then
      raise exception 'claimed retry is missing its next stage attempt' using errcode = '23514';
    end if;
    if (p_status = 'succeeded' and next_stage.status <> 'succeeded')
       or (p_status = 'failed' and next_stage.status <> 'failed') then
      raise exception 'retry completion must match next stage terminal state'
        using errcode = '23514';
    end if;
    if p_status in ('abandoned', 'cancelled') and next_stage.status in ('pending', 'running') then
      update catalog_pipeline_stage_runs
      set status = 'cancelled', completed_at = p_occurred_at
      where id = next_stage.id
      returning * into next_stage;
    end if;
    update catalog_pipeline_retries
    set status = p_status, completed_at = p_occurred_at
    where id = retry_row.id
    returning * into retry_row;
  end if;
  if next_stage.id is null then
    select * into next_stage from catalog_pipeline_stage_runs where id = retry_row.next_stage_run_id;
  end if;
  return jsonb_build_object(
    'outcome', case when was_replay then 'replay' else 'committed' end,
    'stage_run_id', next_stage.id,
    'run_id', next_stage.run_id,
    'stage_name', next_stage.stage_name,
    'attempt', next_stage.attempt,
    'stage_status', next_stage.status,
    'retry_id', retry_row.id,
    'committed_at', retry_row.completed_at
  );
end;
$$;

create or replace function catalog_worker_finalize_run(
  p_run_id uuid,
  p_status text,
  p_occurred_at timestamptz,
  p_candidate_count integer,
  p_approved_count integer,
  p_published_count integer,
  p_retired_count integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  run_row catalog_pipeline_runs%rowtype;
  was_replay boolean := false;
begin
  if p_status not in ('succeeded', 'failed', 'blocked', 'cancelled')
     or p_occurred_at is null
     or coalesce(p_candidate_count, 0) < 0
     or coalesce(p_approved_count, 0) < 0
     or coalesce(p_published_count, 0) < 0
     or coalesce(p_retired_count, 0) < 0 then
    raise exception 'invalid pipeline run finalization' using errcode = '22023';
  end if;
  select * into run_row from catalog_pipeline_runs where id = p_run_id for update;
  if not found then
    raise exception 'pipeline run does not exist' using errcode = 'P0002';
  end if;
  if run_row.status = p_status and run_row.completed_at is not null then
    if run_row.candidate_count is distinct from coalesce(p_candidate_count, run_row.candidate_count)
       or run_row.approved_count is distinct from coalesce(p_approved_count, run_row.approved_count)
       or run_row.published_count is distinct from coalesce(p_published_count, run_row.published_count)
       or run_row.retired_count is distinct from coalesce(p_retired_count, run_row.retired_count) then
      raise exception 'pipeline run finalization replay conflicts with committed counts'
        using errcode = '23505';
    end if;
    was_replay := true;
  else
    if run_row.status not in ('queued', 'running') then
      raise exception 'pipeline run is already terminal' using errcode = '23514';
    end if;
    if p_status = 'cancelled' then
      update catalog_pipeline_retries
      set status = 'cancelled', completed_at = p_occurred_at
      where stage_run_id in (select id from catalog_pipeline_stage_runs where run_id = p_run_id)
        and status in ('scheduled', 'running');
      update catalog_pipeline_stage_runs
      set status = 'cancelled', completed_at = p_occurred_at
      where run_id = p_run_id and status in ('pending', 'running');
    elsif exists (
      select 1 from catalog_pipeline_retries
      where stage_run_id in (select id from catalog_pipeline_stage_runs where run_id = p_run_id)
        and status in ('scheduled', 'running')
    ) then
      raise exception 'pipeline run has unfinished retry work' using errcode = '23514';
    end if;
    if p_status = 'succeeded' and exists (
      select 1
      from (
        select distinct on (stage_name) stage_name, status
        from catalog_pipeline_stage_runs
        where run_id = p_run_id
        order by stage_name, attempt desc
      ) latest
      where latest.status not in ('succeeded', 'skipped')
    ) then
      raise exception 'successful pipeline run has unfinished or failed latest stages'
        using errcode = '23514';
    end if;
    update catalog_pipeline_runs
    set status = p_status,
        candidate_count = coalesce(p_candidate_count, candidate_count),
        approved_count = coalesce(p_approved_count, approved_count),
        published_count = coalesce(p_published_count, published_count),
        retired_count = coalesce(p_retired_count, retired_count),
        completed_at = p_occurred_at
    where id = p_run_id
    returning * into run_row;
  end if;
  return jsonb_build_object(
    'outcome', case when was_replay then 'replay' else 'committed' end,
    'run_id', run_row.id,
    'idempotency_key', run_row.idempotency_key,
    'committed_at', run_row.completed_at
  );
end;
$$;

create or replace function catalog_worker_product_evidence(p_product products)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'sourceSystem', p_product.source_system,
    'sourceProductId', p_product.source_product_id,
    'canonicalProductId', p_product.canonical_product_id,
    'normalizedAt', p_product.normalized_at,
    'deduplicatedAt', p_product.deduplicated_at,
    'enrichedAt', p_product.enriched_at,
    'imageReadyAt', p_product.image_ready_at,
    'verifiedAt', p_product.verified_at,
    'priceVerifiedAt', p_product.price_verified_at,
    'lastCheckedAt', p_product.last_checked_at,
    'catalogPriceCents', p_product.price_cents,
    'verifiedPriceCents', p_product.verified_price_cents,
    'originalPriceCents', p_product.original_price_cents,
    'currency', p_product.currency,
    'verifiedCurrency', p_product.verified_currency,
    'linkHealthStatus', p_product.link_health_status,
    'inStock', p_product.in_stock,
    'trusted', p_product.trusted,
    'moderationStatus', p_product.moderation_status,
    'approvedAt', p_product.approved_at,
    'publishedAt', p_product.published_at,
    'retiredAt', p_product.retired_at,
    'reasonCode', p_product.lifecycle_reason_code,
    'failureCode', p_product.lifecycle_failure_code
  ));
$$;

create or replace function catalog_worker_plan_retirement_repairs(
  p_retirement_transition_key text,
  p_product_id text,
  p_pipeline_run_id uuid,
  p_occurred_at timestamptz
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  planned_count integer;
begin
  if not exists (
    select 1 from product_lifecycle_events
    where idempotency_key = p_retirement_transition_key
      and product_id = p_product_id
      and to_state = 'retired'
      and pipeline_run_id is not distinct from p_pipeline_run_id
  ) then
    raise exception 'repair planning requires a committed matching retirement edge'
      using errcode = '23514';
  end if;
  insert into catalog_outfit_repair_jobs (
    idempotency_key, retirement_transition_key, look_id, pipeline_run_id,
    retired_product_id, previous_product_ids, max_total_cents, status,
    created_at, updated_at
  )
  select
    'catalog-repair-plan-v1:' || p_retirement_transition_key || ':' || outfit.look_id,
    p_retirement_transition_key,
    outfit.look_id,
    p_pipeline_run_id,
    p_product_id,
    outfit.product_ids,
    outfit.max_total_cents,
    'queued',
    p_occurred_at,
    p_occurred_at
  from catalog_served_outfits outfit
  where outfit.status = 'active'
    and p_product_id = any(outfit.product_ids)
  on conflict (retirement_transition_key, look_id) do nothing;

  select count(*)::integer into planned_count
  from catalog_outfit_repair_jobs
  where retirement_transition_key = p_retirement_transition_key;
  return planned_count;
end;
$$;

create or replace function catalog_worker_apply_transition(
  p_product_id text,
  p_from_state text,
  p_to_state text,
  p_idempotency_key text,
  p_previous_transition_key text,
  p_actor_type text,
  p_actor_id text,
  p_pipeline_run_id uuid,
  p_evidence jsonb,
  p_occurred_at timestamptz,
  p_request_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  product_row products%rowtype;
  event_row product_lifecycle_events%rowtype;
  terminal_transition boolean;
  planned_repairs integer := 0;
begin
  if nullif(trim(p_product_id), '') is null
     or nullif(trim(p_idempotency_key), '') is null
     or p_request_fingerprint !~ '^[0-9a-f]{64}$'
     or p_occurred_at is null
     or not catalog_lifecycle_transition_allowed(p_from_state, p_to_state) then
    raise exception 'invalid catalog lifecycle worker request' using errcode = '22023';
  end if;

  select * into event_row
  from product_lifecycle_events
  where idempotency_key = p_idempotency_key;
  if found then
    if event_row.product_id is distinct from p_product_id
       or event_row.from_state is distinct from p_from_state
       or event_row.to_state is distinct from p_to_state
       or event_row.actor_type is distinct from p_actor_type
       or event_row.actor_id is distinct from p_actor_id
       or event_row.pipeline_run_id is distinct from p_pipeline_run_id
       or (event_row.evidence ->> 'requestFingerprint') is distinct from p_request_fingerprint
       or (event_row.evidence ->> 'requestedAt')::timestamptz is distinct from p_occurred_at
       or (event_row.evidence ->> 'previousTransitionKey') is distinct from p_previous_transition_key then
      raise exception 'catalog lifecycle idempotency key reused with conflicting edge'
        using errcode = '23505';
    end if;
    select * into product_row from products where id = p_product_id;
    if not found then
      raise exception 'catalog lifecycle product does not exist' using errcode = 'P0002';
    end if;
    if p_to_state = 'retired' then
      planned_repairs := catalog_worker_plan_retirement_repairs(
        p_idempotency_key, p_product_id, p_pipeline_run_id, event_row.occurred_at
      );
    end if;
    return jsonb_build_object(
      'outcome', 'replay',
      'state', product_row.lifecycle_state,
      'last_transition_key', product_row.last_transition_key,
      'idempotency_key', event_row.idempotency_key,
      'product_id', event_row.product_id,
      'from_state', event_row.from_state,
      'to_state', event_row.to_state,
      'committed_at', event_row.occurred_at,
      'request_fingerprint', p_request_fingerprint,
      'durable_evidence', catalog_worker_product_evidence(product_row),
      'repair_jobs_planned', planned_repairs
    );
  end if;

  select * into product_row
  from products
  where id = p_product_id
  for update;
  if not found then
    raise exception 'catalog lifecycle product does not exist' using errcode = 'P0002';
  end if;

  -- A concurrent first delivery may have committed while this request waited
  -- on the product lock. Re-check the unique ledger before inspecting state.
  select * into event_row
  from product_lifecycle_events
  where idempotency_key = p_idempotency_key;
  if found then
    if event_row.product_id is distinct from p_product_id
       or event_row.from_state is distinct from p_from_state
       or event_row.to_state is distinct from p_to_state
       or event_row.actor_type is distinct from p_actor_type
       or event_row.actor_id is distinct from p_actor_id
       or event_row.pipeline_run_id is distinct from p_pipeline_run_id
       or (event_row.evidence ->> 'requestFingerprint') is distinct from p_request_fingerprint
       or (event_row.evidence ->> 'requestedAt')::timestamptz is distinct from p_occurred_at
       or (event_row.evidence ->> 'previousTransitionKey') is distinct from p_previous_transition_key then
      raise exception 'catalog lifecycle idempotency key reused with conflicting edge'
        using errcode = '23505';
    end if;
    if p_to_state = 'retired' then
      planned_repairs := catalog_worker_plan_retirement_repairs(
        p_idempotency_key, p_product_id, p_pipeline_run_id, event_row.occurred_at
      );
    end if;
    return jsonb_build_object(
      'outcome', 'replay',
      'state', product_row.lifecycle_state,
      'last_transition_key', product_row.last_transition_key,
      'idempotency_key', event_row.idempotency_key,
      'product_id', event_row.product_id,
      'from_state', event_row.from_state,
      'to_state', event_row.to_state,
      'committed_at', event_row.occurred_at,
      'request_fingerprint', p_request_fingerprint,
      'durable_evidence', catalog_worker_product_evidence(product_row),
      'repair_jobs_planned', planned_repairs
    );
  end if;

  if product_row.lifecycle_state is distinct from p_from_state then
    raise exception 'catalog lifecycle state does not match requested edge'
      using errcode = '40001';
  end if;
  if p_previous_transition_key is not null
     and product_row.last_transition_key is distinct from p_previous_transition_key then
    raise exception 'catalog lifecycle predecessor key does not match current row'
      using errcode = '40001';
  end if;

  if p_from_state = p_to_state then
    return jsonb_build_object(
      'outcome', 'noop',
      'state', product_row.lifecycle_state,
      'last_transition_key', product_row.last_transition_key,
      'committed_at', product_row.lifecycle_updated_at,
      'request_fingerprint', p_request_fingerprint,
      'durable_evidence', catalog_worker_product_evidence(product_row),
      'repair_jobs_planned', 0
    );
  end if;

  terminal_transition := p_to_state in ('retired', 'quarantined', 'rejected');
  update products
  set source_system = coalesce(nullif(p_evidence ->> 'source_system', ''), source_system),
      source_product_id = coalesce(nullif(p_evidence ->> 'source_product_id', ''), source_product_id),
      canonical_product_id = coalesce(nullif(p_evidence ->> 'canonical_product_id', ''), canonical_product_id),
      normalized_at = coalesce((p_evidence ->> 'normalized_at')::timestamptz, normalized_at),
      deduplicated_at = coalesce((p_evidence ->> 'deduplicated_at')::timestamptz, deduplicated_at),
      enriched_at = coalesce((p_evidence ->> 'enriched_at')::timestamptz, enriched_at),
      image_ready_at = coalesce((p_evidence ->> 'image_ready_at')::timestamptz, image_ready_at),
      verified_at = coalesce((p_evidence ->> 'verified_at')::timestamptz, verified_at),
      price_verified_at = coalesce((p_evidence ->> 'price_verified_at')::timestamptz, price_verified_at),
      last_checked_at = coalesce((p_evidence ->> 'last_checked_at')::timestamptz, last_checked_at),
      price_cents = coalesce((p_evidence ->> 'price_cents')::integer, price_cents),
      verified_price_cents = coalesce((p_evidence ->> 'verified_price_cents')::integer, verified_price_cents),
      original_price_cents = coalesce((p_evidence ->> 'original_price_cents')::integer, original_price_cents),
      currency = coalesce(nullif(p_evidence ->> 'currency', ''), currency),
      verified_currency = coalesce(nullif(p_evidence ->> 'verified_currency', ''), verified_currency),
      link_health_status = coalesce(nullif(p_evidence ->> 'link_health_status', ''), link_health_status),
      in_stock = coalesce((p_evidence ->> 'in_stock')::boolean, in_stock),
      trusted = coalesce((p_evidence ->> 'trusted')::boolean, trusted),
      moderation_status = coalesce(nullif(p_evidence ->> 'moderation_status', ''), moderation_status),
      approved_at = coalesce((p_evidence ->> 'approved_at')::timestamptz, approved_at),
      published_at = coalesce((p_evidence ->> 'published_at')::timestamptz, published_at),
      retired_at = coalesce((p_evidence ->> 'retired_at')::timestamptz, retired_at),
      lifecycle_reason_code = case when terminal_transition
        then nullif(p_evidence ->> 'lifecycle_reason_code', '') else null end,
      lifecycle_failure_code = case when terminal_transition
        then nullif(p_evidence ->> 'lifecycle_failure_code', '') else null end,
      lifecycle_failure_detail = null,
      lifecycle_transition_metadata = jsonb_strip_nulls(jsonb_build_object(
        'worker', 'catalog_worker_apply_transition',
        'pipelineRunId', p_pipeline_run_id,
        'requestFingerprint', p_request_fingerprint,
        'requestedAt', p_occurred_at,
        'previousTransitionKey', p_previous_transition_key
      )),
      lifecycle_actor_type = p_actor_type,
      lifecycle_actor_id = p_actor_id,
      last_transition_key = p_idempotency_key,
      lifecycle_state = p_to_state
  where id = p_product_id
  returning * into product_row;

  select * into event_row
  from product_lifecycle_events
  where idempotency_key = p_idempotency_key;
  if not found then
    raise exception 'catalog lifecycle trigger did not commit an audit edge'
      using errcode = '23514';
  end if;

  if p_pipeline_run_id is not null then
    update product_lifecycle_events
    set pipeline_run_id = p_pipeline_run_id
    where id = event_row.id
    returning * into event_row;
  end if;

  if p_to_state = 'retired' then
    planned_repairs := catalog_worker_plan_retirement_repairs(
      p_idempotency_key, p_product_id, p_pipeline_run_id, event_row.occurred_at
    );
  end if;

  return jsonb_build_object(
    'outcome', 'committed',
    'state', product_row.lifecycle_state,
    'last_transition_key', product_row.last_transition_key,
    'idempotency_key', event_row.idempotency_key,
    'product_id', event_row.product_id,
    'from_state', event_row.from_state,
    'to_state', event_row.to_state,
    'committed_at', event_row.occurred_at,
    'request_fingerprint', p_request_fingerprint,
    'durable_evidence', catalog_worker_product_evidence(product_row),
    'repair_jobs_planned', planned_repairs
  );
end;
$$;

create or replace function catalog_worker_register_served_outfit(
  p_look_id text,
  p_product_ids text[],
  p_max_total_cents integer,
  p_source_version text,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  outfit_row catalog_served_outfits%rowtype;
begin
  if nullif(trim(p_look_id), '') is null
     or nullif(trim(p_source_version), '') is null
     or cardinality(p_product_ids) < 3
     or p_max_total_cents < 0
     or p_occurred_at is null then
    raise exception 'invalid served outfit registration' using errcode = '22023';
  end if;
  select * into outfit_row from catalog_served_outfits where look_id = p_look_id for update;
  if found then
    if outfit_row.source_version = p_source_version
       and outfit_row.product_ids = p_product_ids
       and outfit_row.max_total_cents = p_max_total_cents
       and outfit_row.status = 'active' then
      return jsonb_build_object('outcome', 'replay', 'look_id', outfit_row.look_id,
        'version', outfit_row.version, 'committed_at', outfit_row.updated_at);
    end if;
    raise exception 'served outfit identity already exists with conflicting state'
      using errcode = '23505';
  end if;
  insert into catalog_served_outfits (
    look_id, product_ids, status, max_total_cents, source_version, created_at, updated_at
  ) values (
    p_look_id, p_product_ids, 'active', p_max_total_cents, p_source_version,
    p_occurred_at, p_occurred_at
  ) returning * into outfit_row;
  return jsonb_build_object('outcome', 'committed', 'look_id', outfit_row.look_id,
    'version', outfit_row.version, 'committed_at', outfit_row.updated_at);
end;
$$;

create or replace function catalog_worker_claim_outfit_repairs(
  p_worker_id text,
  p_limit integer,
  p_lease_ms integer,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  claims jsonb;
begin
  if nullif(trim(p_worker_id), '') is null
     or p_limit < 1 or p_limit > 100
     or p_lease_ms < 1000 or p_lease_ms > 3600000
     or p_occurred_at is null then
    raise exception 'invalid outfit repair claim request' using errcode = '22023';
  end if;
  with selected as (
    select id
    from catalog_outfit_repair_jobs
    where status = 'queued'
       or (status = 'claimed' and lease_expires_at <= p_occurred_at)
    order by created_at, id
    limit p_limit
    for update skip locked
  ), claimed as (
    update catalog_outfit_repair_jobs job
    set status = 'claimed',
        attempt_count = attempt_count + 1,
        claim_token = gen_random_uuid(),
        claimed_by = p_worker_id,
        claimed_at = p_occurred_at,
        lease_expires_at = p_occurred_at + (p_lease_ms * interval '1 millisecond'),
        updated_at = p_occurred_at
    from selected
    where job.id = selected.id
    returning job.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'repair_job_id', claimed.id,
    'claim_token', claimed.claim_token,
    'look_id', claimed.look_id,
    'pipeline_run_id', claimed.pipeline_run_id,
    'retired_product_id', claimed.retired_product_id,
    'previous_product_ids', claimed.previous_product_ids,
    'max_total_cents', claimed.max_total_cents,
    'attempt', claimed.attempt_count,
    'lease_expires_at', claimed.lease_expires_at
  ) order by claimed.created_at, claimed.id), '[]'::jsonb)
  into claims from claimed;
  return jsonb_build_object(
    'outcome', case when jsonb_array_length(claims) > 0 then 'committed' else 'noop' end,
    'claims', claims
  );
end;
$$;

create or replace function catalog_worker_commit_outfit_repair(
  p_idempotency_key text,
  p_repair_job_id uuid,
  p_claim_token uuid,
  p_status text,
  p_resulting_product_ids text[],
  p_replacements jsonb,
  p_removed_optional_product_ids text[],
  p_suppression_reason text,
  p_total_cents integer,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  job_row catalog_outfit_repair_jobs%rowtype;
  outfit_row catalog_served_outfits%rowtype;
  inserted catalog_outfit_repairs%rowtype;
  existing catalog_outfit_repairs%rowtype;
  resulting_ids text[] := coalesce(p_resulting_product_ids, '{}'::text[]);
  removed_ids text[] := coalesce(p_removed_optional_product_ids, '{}'::text[]);
  replacement_rows jsonb := coalesce(p_replacements, '[]'::jsonb);
  next_version integer;
begin
  if nullif(trim(p_idempotency_key), '') is null
     or p_occurred_at is null
     or p_status not in ('repaired', 'suppressed')
     or jsonb_typeof(replacement_rows) is distinct from 'array' then
    raise exception 'invalid outfit repair commit' using errcode = '22023';
  end if;

  select * into existing
  from catalog_outfit_repairs
  where idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing.repair_job_id is distinct from p_repair_job_id
       or existing.status is distinct from p_status
       or existing.resulting_product_ids is distinct from resulting_ids
       or existing.replacements is distinct from replacement_rows
       or existing.removed_optional_product_ids is distinct from removed_ids
       or existing.suppression_reason is distinct from p_suppression_reason
       or existing.total_cents is distinct from p_total_cents then
      raise exception 'outfit repair idempotency key reused with conflicting result'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'outcome', 'replay', 'repair_id', existing.id,
      'repair_job_id', existing.repair_job_id,
      'idempotency_key', existing.idempotency_key,
      'look_id', existing.look_id, 'status', existing.status,
      'pipeline_run_id', existing.pipeline_run_id,
      'served_state_committed', true,
      'served_state_version', existing.served_state_version,
      'committed_at', existing.committed_at
    );
  end if;

  select * into job_row
  from catalog_outfit_repair_jobs
  where id = p_repair_job_id
  for update;
  if not found then
    raise exception 'outfit repair job does not exist' using errcode = 'P0002';
  end if;
  if job_row.status <> 'claimed'
     or job_row.claim_token is distinct from p_claim_token
     or job_row.lease_expires_at < p_occurred_at then
    raise exception 'outfit repair job is not owned by this live claim'
      using errcode = '40001';
  end if;
  select * into outfit_row
  from catalog_served_outfits
  where look_id = job_row.look_id
  for update;
  if not found or outfit_row.status <> 'active'
     or outfit_row.product_ids is distinct from job_row.previous_product_ids then
    raise exception 'outfit repair claim no longer matches authoritative served state'
      using errcode = '40001';
  end if;
  if cardinality(resulting_ids) is distinct from (
      select count(distinct product_id)::integer from unnest(resulting_ids) as product_id
    ) then
    raise exception 'outfit repair product identities must be unique' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(resulting_ids) requested(product_id)
    left join products on products.id = requested.product_id
    where products.id is null
  ) then
    raise exception 'outfit repair references an unknown catalog product' using errcode = '23503';
  end if;
  if p_status = 'repaired' and (
    cardinality(resulting_ids) < 3 or jsonb_array_length(replacement_rows) = 0
    or p_total_cents is null or p_total_cents < 0
    or p_total_cents > job_row.max_total_cents or p_suppression_reason is not null
  ) then
    raise exception 'repaired outfit violates completeness or budget contract' using errcode = '22023';
  end if;
  if p_status = 'suppressed' and (
    cardinality(resulting_ids) <> 0 or nullif(trim(p_suppression_reason), '') is null
    or p_total_cents is not null
  ) then
    raise exception 'suppressed outfit requires a reason and no resulting composition'
      using errcode = '22023';
  end if;

  next_version := outfit_row.version + 1;
  update catalog_served_outfits
  set product_ids = case when p_status = 'repaired' then resulting_ids else product_ids end,
      status = case when p_status = 'repaired' then 'active' else 'suppressed' end,
      version = next_version,
      last_repair_key = p_idempotency_key,
      updated_at = p_occurred_at
  where look_id = outfit_row.look_id;

  insert into catalog_outfit_repairs (
    idempotency_key, repair_job_id, look_id, pipeline_run_id,
    retired_product_id, status, previous_product_ids, resulting_product_ids,
    replacements, removed_optional_product_ids, suppression_reason, total_cents,
    served_state_version, committed_at
  ) values (
    p_idempotency_key, job_row.id, job_row.look_id, job_row.pipeline_run_id,
    job_row.retired_product_id, p_status, job_row.previous_product_ids,
    resulting_ids, replacement_rows, removed_ids, p_suppression_reason,
    p_total_cents, next_version, p_occurred_at
  ) returning * into inserted;

  update catalog_outfit_repair_jobs
  set status = p_status, completed_at = p_occurred_at, updated_at = p_occurred_at
  where id = job_row.id;

  return jsonb_build_object(
    'outcome', 'committed', 'repair_id', inserted.id,
    'repair_job_id', inserted.repair_job_id,
    'idempotency_key', inserted.idempotency_key,
    'look_id', inserted.look_id, 'status', inserted.status,
    'pipeline_run_id', inserted.pipeline_run_id,
    'served_state_committed', true,
    'served_state_version', inserted.served_state_version,
    'committed_at', inserted.committed_at
  );
end;
$$;

revoke all on function catalog_worker_ensure_run(text, text, text, text, boolean, text, text[], timestamptz)
  from public, anon, authenticated;
revoke all on function catalog_worker_begin_stage(uuid, text, integer, timestamptz, integer, integer)
  from public, anon, authenticated;
revoke all on function catalog_worker_complete_stage(uuid, text, integer, timestamptz, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function catalog_worker_fail_stage(uuid, text, integer, timestamptz, text, boolean, jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function catalog_worker_claim_retries(text, integer, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function catalog_worker_complete_retry(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function catalog_worker_finalize_run(uuid, text, timestamptz, integer, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function catalog_worker_product_evidence(products)
  from public, anon, authenticated;
revoke all on function catalog_worker_plan_retirement_repairs(text, text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function catalog_worker_apply_transition(text, text, text, text, text, text, text, uuid, jsonb, timestamptz, text)
  from public, anon, authenticated;
revoke all on function catalog_worker_register_served_outfit(text, text[], integer, text, timestamptz)
  from public, anon, authenticated;
revoke all on function catalog_worker_claim_outfit_repairs(text, integer, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function catalog_worker_commit_outfit_repair(text, uuid, uuid, text, text[], jsonb, text[], text, integer, timestamptz)
  from public, anon, authenticated;

grant execute on function catalog_worker_ensure_run(text, text, text, text, boolean, text, text[], timestamptz)
  to service_role;
grant execute on function catalog_worker_begin_stage(uuid, text, integer, timestamptz, integer, integer)
  to service_role;
grant execute on function catalog_worker_complete_stage(uuid, text, integer, timestamptz, integer, integer, integer)
  to service_role;
grant execute on function catalog_worker_fail_stage(uuid, text, integer, timestamptz, text, boolean, jsonb, text, text, text)
  to service_role;
grant execute on function catalog_worker_claim_retries(text, integer, integer, timestamptz)
  to service_role;
grant execute on function catalog_worker_complete_retry(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function catalog_worker_finalize_run(uuid, text, timestamptz, integer, integer, integer, integer)
  to service_role;
grant execute on function catalog_worker_plan_retirement_repairs(text, text, uuid, timestamptz)
  to service_role;
grant execute on function catalog_worker_apply_transition(text, text, text, text, text, text, text, uuid, jsonb, timestamptz, text)
  to service_role;
grant execute on function catalog_worker_register_served_outfit(text, text[], integer, text, timestamptz)
  to service_role;
grant execute on function catalog_worker_claim_outfit_repairs(text, integer, integer, timestamptz)
  to service_role;
grant execute on function catalog_worker_commit_outfit_repair(text, uuid, uuid, text, text[], jsonb, text[], text, integer, timestamptz)
  to service_role;

-- New operational tables are service-role only. Application/public access must
-- go through an authenticated server boundary with an explicit purpose.
alter table catalog_product_sources enable row level security;
alter table product_variants enable row level security;
alter table catalog_pipeline_runs enable row level security;
alter table catalog_pipeline_stage_runs enable row level security;
alter table catalog_pipeline_retries enable row level security;
alter table catalog_review_decisions enable row level security;
alter table product_lifecycle_events enable row level security;
alter table catalog_alerts enable row level security;
alter table catalog_stage_failure_events enable row level security;
alter table catalog_served_outfits enable row level security;
alter table catalog_outfit_repair_jobs enable row level security;
alter table catalog_outfit_repairs enable row level security;

comment on column products.lifecycle_state is
  'Explicit product lifecycle state. image_ready corresponds to the product-goal label image-ready.';
comment on column products.canonical_product_id is
  'Stable canonical product id; duplicates point at the retained products.id.';
comment on column products.source_product_id is
  'Stable id supplied by source_system. Legacy compatibility writes fall back to products.id and remain reviewable.';
comment on column products.original_price_cents is
  'Optional source-provided comparison price. Legacy current price is never copied here; display only after price verification.';
comment on column products.verified_price_cents is
  'Current price observed by a real verification. Use with verified_currency and price_verified_at.';
comment on column products.verified_at is
  'Successful aggregate product verification time; never an ingestion or image-processing timestamp.';
comment on table product_lifecycle_events is
  'Append-only transition audit. Unique idempotency_key makes retries replay-safe and conflicting reuse fail closed.';
comment on table catalog_pipeline_retries is
  'Durable retry schedule/attempt ledger; delay_ms and scheduled_for are evidence, not an in-process timer.';
comment on table catalog_alerts is
  'Actionable catalog alerts. Active dedupe prevents alert storms while resolved incidents may recur as new rows.';
comment on table catalog_outfit_repairs is
  'Immutable, replay-safe ledger of committed repaired or suppressed outfit state; analytics may emit only after a new row commits.';
comment on view catalog_published_products is
  'Safe serving boundary for all readers, including service-role workers: fresh positive link, price, stock, and trust evidence only.';

reset statement_timeout;
reset lock_timeout;
