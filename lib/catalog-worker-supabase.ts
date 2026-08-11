import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  isCatalogLifecycleState,
  type CatalogLifecycleEvidence,
} from './catalog-lifecycle';
import type {
  CatalogLifecycleCommit,
  CatalogOutfitRepairCommit,
  CatalogOutfitRepairCommitInput,
  CatalogOutfitRepairClaimResult,
  CatalogPipelineRunCommit,
  CatalogPipelineRunFinalizationInput,
  CatalogPipelineRunInput,
  CatalogRetryClaimResult,
  CatalogRetryCompletionInput,
  CatalogServedOutfitCommit,
  CatalogServedOutfitInput,
  CatalogStageAttemptInput,
  CatalogStageCommit,
  CatalogStageFailureInput,
  CatalogStageSuccessInput,
  CatalogWorkerPersistence,
} from './catalog-worker-persistence';
import { createDisabledCatalogWorkerPersistence } from './catalog-worker-persistence';

interface CatalogRpcError {
  code?: string;
}

export interface CatalogRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: CatalogRpcError | null }>;
}

export interface SupabaseCatalogWorkerOptions {
  url?: string;
  serviceRoleKey?: string;
  /** Injected by deterministic tests; production callers should omit it. */
  client?: CatalogRpcClient;
}

type JsonRecord = Record<string, unknown>;

class CatalogPersistenceError extends Error {
  constructor(operation: string, code?: string) {
    super(`Catalog persistence operation ${operation} failed${code ? ` (${code})` : ''}.`);
    this.name = 'CatalogPersistenceError';
  }
}

function asRecord(value: unknown, operation: string): JsonRecord {
  const unwrapped = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) {
    throw new CatalogPersistenceError(operation, 'invalid_response');
  }
  return unwrapped as JsonRecord;
}

function requiredString(value: unknown, operation: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CatalogPersistenceError(operation, `missing_${field}`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function requiredPositiveInteger(value: unknown, operation: string, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new CatalogPersistenceError(operation, `invalid_${field}`);
  }
  return value;
}

function requiredNonnegativeInteger(value: unknown, operation: string, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new CatalogPersistenceError(operation, `invalid_${field}`);
  }
  return value;
}

function requiredBoolean(value: unknown, operation: string, field: string): boolean {
  if (typeof value !== 'boolean') throw new CatalogPersistenceError(operation, `invalid_${field}`);
  return value;
}

function requiredStringArray(value: unknown, operation: string, field: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.trim())) {
    throw new CatalogPersistenceError(operation, `invalid_${field}`);
  }
  return value;
}

function persistenceOutcome(
  value: unknown,
  operation: string,
  options: readonly string[],
): string {
  const outcome = requiredString(value, operation, 'outcome');
  if (!options.includes(outcome)) throw new CatalogPersistenceError(operation, 'invalid_outcome');
  return outcome;
}

function evidenceRow(evidence: CatalogLifecycleEvidence): JsonRecord {
  return {
    source_system: evidence.sourceSystem,
    source_product_id: evidence.sourceProductId,
    canonical_product_id: evidence.canonicalProductId,
    normalized_at: evidence.normalizedAt,
    deduplicated_at: evidence.deduplicatedAt,
    enriched_at: evidence.enrichedAt,
    image_ready_at: evidence.imageReadyAt,
    verified_at: evidence.verifiedAt,
    price_verified_at: evidence.priceVerifiedAt,
    last_checked_at: evidence.lastCheckedAt,
    price_cents: evidence.catalogPriceCents,
    verified_price_cents: evidence.verifiedPriceCents,
    original_price_cents: evidence.originalPriceCents,
    currency: evidence.currency,
    verified_currency: evidence.verifiedCurrency,
    link_health_status: evidence.linkHealthStatus,
    in_stock: evidence.inStock,
    trusted: evidence.trusted,
    moderation_status: evidence.moderationStatus,
    approved_at: evidence.approvedAt,
    published_at: evidence.publishedAt,
    retired_at: evidence.retiredAt,
    lifecycle_reason_code: evidence.reasonCode,
    lifecycle_failure_code: evidence.failureCode,
  };
}

function definedJson(input: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null));
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry)]));
  }
  return value;
}

function lifecycleRequestFingerprint(input: {
  request: Parameters<CatalogWorkerPersistence['applyLifecycleTransition']>[0];
  pipelineRunId?: string;
}): string {
  return createHash('sha256').update(JSON.stringify(canonicalJson({
    productId: input.request.productId,
    fromState: input.request.fromState,
    toState: input.request.toState,
    idempotencyKey: input.request.idempotencyKey,
    previousTransitionKey: input.request.previousTransitionKey || null,
    actorType: input.request.actorType,
    pipelineRunId: input.pipelineRunId || null,
    requestedAt: input.request.now,
    evidence: definedJson(evidenceRow(input.request.evidence)),
  }))).digest('hex');
}

function durableLifecycleEvidence(value: unknown, operation: string): CatalogLifecycleEvidence {
  const row = asRecord(value, operation);
  return {
    sourceSystem: optionalString(row.sourceSystem),
    sourceProductId: optionalString(row.sourceProductId),
    canonicalProductId: optionalString(row.canonicalProductId),
    normalizedAt: optionalString(row.normalizedAt),
    deduplicatedAt: optionalString(row.deduplicatedAt),
    enrichedAt: optionalString(row.enrichedAt),
    imageReadyAt: optionalString(row.imageReadyAt),
    verifiedAt: optionalString(row.verifiedAt),
    priceVerifiedAt: optionalString(row.priceVerifiedAt),
    lastCheckedAt: optionalString(row.lastCheckedAt),
    catalogPriceCents: typeof row.catalogPriceCents === 'number' ? row.catalogPriceCents : undefined,
    verifiedPriceCents: typeof row.verifiedPriceCents === 'number' ? row.verifiedPriceCents : undefined,
    originalPriceCents: typeof row.originalPriceCents === 'number' ? row.originalPriceCents : undefined,
    currency: optionalString(row.currency),
    verifiedCurrency: optionalString(row.verifiedCurrency),
    linkHealthStatus: optionalString(row.linkHealthStatus),
    inStock: typeof row.inStock === 'boolean' ? row.inStock : undefined,
    trusted: typeof row.trusted === 'boolean' ? row.trusted : undefined,
    moderationStatus: optionalString(row.moderationStatus) as CatalogLifecycleEvidence['moderationStatus'],
    approvedAt: optionalString(row.approvedAt),
    publishedAt: optionalString(row.publishedAt),
    retiredAt: optionalString(row.retiredAt),
    reasonCode: optionalString(row.reasonCode),
    failureCode: optionalString(row.failureCode),
  };
}

async function callRpc(
  client: CatalogRpcClient,
  operation: string,
  args: JsonRecord,
): Promise<JsonRecord> {
  const { data, error } = await client.rpc(operation, args);
  if (error) throw new CatalogPersistenceError(operation, error.code);
  return asRecord(data, operation);
}

/**
 * Build the service-role adapter. Without both credentials this returns an
 * explicit disabled adapter and does not construct a client or touch network.
 */
export function createSupabaseCatalogWorkerPersistence(
  options: SupabaseCatalogWorkerOptions = {},
): CatalogWorkerPersistence {
  const url = options.url?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = options.serviceRoleKey?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!options.client && (!url || !serviceRoleKey)) {
    return createDisabledCatalogWorkerPersistence();
  }

  const client = options.client || createClient(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as CatalogRpcClient;

  return {
    kind: 'supabase',
    enabled: true,

    async ensureRun(input: CatalogPipelineRunInput): Promise<CatalogPipelineRunCommit> {
      const operation = 'catalog_worker_ensure_run';
      const row = await callRpc(client, operation, {
        p_idempotency_key: input.idempotencyKey,
        p_pipeline_version: input.pipelineVersion,
        p_mode: input.mode,
        p_trigger_kind: input.triggerKind,
        p_dry_run: input.dryRun,
        p_requested_by: input.requestedBy || null,
        p_source_scope: [...(input.sourceScope || [])],
        p_occurred_at: input.occurredAt,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        runId: requiredString(row.run_id, operation, 'run_id'),
        idempotencyKey: requiredString(row.idempotency_key, operation, 'idempotency_key'),
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },

    async finalizeRun(input: CatalogPipelineRunFinalizationInput): Promise<CatalogPipelineRunCommit> {
      const operation = 'catalog_worker_finalize_run';
      const row = await callRpc(client, operation, {
        p_run_id: input.runId,
        p_status: input.status,
        p_occurred_at: input.occurredAt,
        p_candidate_count: input.candidateCount ?? null,
        p_approved_count: input.approvedCount ?? null,
        p_published_count: input.publishedCount ?? null,
        p_retired_count: input.retiredCount ?? null,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        runId: requiredString(row.run_id, operation, 'run_id'),
        idempotencyKey: requiredString(row.idempotency_key, operation, 'idempotency_key'),
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },

    async beginStageAttempt(input: CatalogStageAttemptInput): Promise<CatalogStageCommit> {
      const operation = 'catalog_worker_begin_stage';
      const row = await callRpc(client, operation, {
        p_run_id: input.runId,
        p_stage_name: input.stageName,
        p_attempt: input.attempt,
        p_occurred_at: input.occurredAt,
        p_input_count: input.inputCount ?? null,
        p_estimated_cost_cents: input.estimatedCostCents ?? 0,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        stageRunId: requiredString(row.stage_run_id, operation, 'stage_run_id'),
        runId: requiredString(row.run_id, operation, 'run_id'),
        stageName: requiredString(row.stage_name, operation, 'stage_name'),
        attempt: requiredPositiveInteger(row.attempt, operation, 'attempt'),
        stageStatus: requiredString(row.stage_status, operation, 'stage_status') as 'running',
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },

    async completeStageAttempt(input: CatalogStageSuccessInput): Promise<CatalogStageCommit> {
      const operation = 'catalog_worker_complete_stage';
      const row = await callRpc(client, operation, {
        p_run_id: input.runId,
        p_stage_name: input.stageName,
        p_attempt: input.attempt,
        p_occurred_at: input.occurredAt,
        p_output_count: input.outputCount,
        p_rejected_count: input.rejectedCount ?? 0,
        p_actual_cost_cents: input.actualCostCents ?? 0,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        stageRunId: requiredString(row.stage_run_id, operation, 'stage_run_id'),
        runId: requiredString(row.run_id, operation, 'run_id'),
        stageName: requiredString(row.stage_name, operation, 'stage_name'),
        attempt: requiredPositiveInteger(row.attempt, operation, 'attempt'),
        stageStatus: requiredString(row.stage_status, operation, 'stage_status') as 'succeeded',
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },

    async failStageAttempt(input: CatalogStageFailureInput): Promise<CatalogStageCommit> {
      const operation = 'catalog_worker_fail_stage';
      const retry = input.retryDecision.kind === 'scheduled' ? {
        retry_number: input.retryDecision.retryNumber,
        idempotency_key: input.retryDecision.idempotencyKey,
        delay_ms: input.retryDecision.delayMs,
        scheduled_for: input.retryDecision.scheduledFor,
      } : null;
      const row = await callRpc(client, operation, {
        p_run_id: input.runId,
        p_stage_name: input.stageName,
        p_attempt: input.attempt,
        p_occurred_at: input.occurredAt,
        p_failure_code: input.failureCode,
        p_retryable: input.retryDecision.kind === 'scheduled',
        p_retry: retry,
        p_alert_type: input.alertType,
        p_alert_severity: input.alertSeverity,
        p_alert_dedupe_key: input.alertDedupeKey,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        stageRunId: requiredString(row.stage_run_id, operation, 'stage_run_id'),
        runId: requiredString(row.run_id, operation, 'run_id'),
        stageName: requiredString(row.stage_name, operation, 'stage_name'),
        attempt: requiredPositiveInteger(row.attempt, operation, 'attempt'),
        stageStatus: requiredString(row.stage_status, operation, 'stage_status') as 'failed',
        retryId: optionalString(row.retry_id),
        alertId: requiredString(row.alert_id, operation, 'alert_id'),
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },

    async claimDueRetries(input): Promise<CatalogRetryClaimResult> {
      const operation = 'catalog_worker_claim_retries';
      const row = await callRpc(client, operation, {
        p_worker_id: input.workerId,
        p_limit: input.limit,
        p_lease_ms: input.leaseMs,
        p_occurred_at: input.occurredAt,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'noop']);
      if (!Array.isArray(row.claims)) throw new CatalogPersistenceError(operation, 'invalid_claims');
      return {
        outcome: outcome as 'committed' | 'noop',
        claims: row.claims.map((value) => {
          const claim = asRecord(value, operation);
          return {
            retryId: requiredString(claim.retry_id, operation, 'retry_id'),
            claimToken: requiredString(claim.claim_token, operation, 'claim_token'),
            runId: requiredString(claim.run_id, operation, 'run_id'),
            stageName: requiredString(claim.stage_name, operation, 'stage_name'),
            nextAttempt: requiredPositiveInteger(claim.next_attempt, operation, 'next_attempt'),
            nextStageRunId: requiredString(claim.next_stage_run_id, operation, 'next_stage_run_id'),
            leaseExpiresAt: requiredString(claim.lease_expires_at, operation, 'lease_expires_at'),
          };
        }),
      };
    },

    async completeRetry(input: CatalogRetryCompletionInput): Promise<CatalogStageCommit> {
      const operation = 'catalog_worker_complete_retry';
      const row = await callRpc(client, operation, {
        p_retry_id: input.retryId,
        p_claim_token: input.claimToken,
        p_status: input.status,
        p_occurred_at: input.occurredAt,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        stageRunId: requiredString(row.stage_run_id, operation, 'stage_run_id'),
        runId: requiredString(row.run_id, operation, 'run_id'),
        stageName: requiredString(row.stage_name, operation, 'stage_name'),
        attempt: requiredPositiveInteger(row.attempt, operation, 'attempt'),
        stageStatus: requiredString(row.stage_status, operation, 'stage_status') as CatalogStageCommit['stageStatus'],
        retryId: requiredString(row.retry_id, operation, 'retry_id'),
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },

    async applyLifecycleTransition(request, pipelineRunId): Promise<CatalogLifecycleCommit> {
      const operation = 'catalog_worker_apply_transition';
      const requestFingerprint = lifecycleRequestFingerprint({ request, pipelineRunId });
      const row = await callRpc(client, operation, {
        p_product_id: request.productId,
        p_from_state: request.fromState,
        p_to_state: request.toState,
        p_idempotency_key: request.idempotencyKey,
        p_previous_transition_key: request.previousTransitionKey || null,
        p_actor_type: request.actorType,
        p_actor_id: null,
        p_pipeline_run_id: pipelineRunId || null,
        p_evidence: definedJson(evidenceRow(request.evidence)),
        p_occurred_at: request.now,
        p_request_fingerprint: requestFingerprint,
      });
      const rpcOutcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay', 'noop']);
      const outcome = rpcOutcome as 'committed' | 'replay' | 'noop';
      const state = requiredString(row.state, operation, 'state');
      if (!isCatalogLifecycleState(state)) {
        throw new CatalogPersistenceError(operation, 'invalid_state');
      }
      const committedAt = requiredString(row.committed_at, operation, 'committed_at');
      if (requiredString(row.request_fingerprint, operation, 'request_fingerprint') !== requestFingerprint) {
        throw new CatalogPersistenceError(operation, 'fingerprint_mismatch');
      }
      const ledgerEntry = outcome === 'noop' ? undefined : {
        idempotencyKey: requiredString(row.idempotency_key, operation, 'idempotency_key'),
        productId: requiredString(row.product_id, operation, 'product_id'),
        fromState: requiredString(row.from_state, operation, 'from_state') as typeof request.fromState,
        toState: requiredString(row.to_state, operation, 'to_state') as typeof request.toState,
        occurredAt: committedAt,
      };
      return {
        outcome,
        record: {
          productId: request.productId,
          state,
          evidence: durableLifecycleEvidence(row.durable_evidence, operation),
          lastTransitionKey: optionalString(row.last_transition_key),
        },
        ledgerEntry,
        committedAt,
        repairJobsPlanned: typeof row.repair_jobs_planned === 'number'
          ? row.repair_jobs_planned
          : 0,
      };
    },

    async registerServedOutfit(input: CatalogServedOutfitInput): Promise<CatalogServedOutfitCommit> {
      const operation = 'catalog_worker_register_served_outfit';
      const row = await callRpc(client, operation, {
        p_look_id: input.lookId,
        p_product_ids: [...input.productIds],
        p_max_total_cents: input.maxTotalCents,
        p_source_version: input.sourceVersion,
        p_occurred_at: input.occurredAt,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        lookId: requiredString(row.look_id, operation, 'look_id'),
        version: requiredPositiveInteger(row.version, operation, 'version'),
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },

    async claimOutfitRepairs(input): Promise<CatalogOutfitRepairClaimResult> {
      const operation = 'catalog_worker_claim_outfit_repairs';
      const row = await callRpc(client, operation, {
        p_worker_id: input.workerId,
        p_limit: input.limit,
        p_lease_ms: input.leaseMs,
        p_occurred_at: input.occurredAt,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'noop']);
      if (!Array.isArray(row.claims)) throw new CatalogPersistenceError(operation, 'invalid_claims');
      return {
        outcome: outcome as 'committed' | 'noop',
        claims: row.claims.map((value) => {
          const claim = asRecord(value, operation);
          return {
            repairJobId: requiredString(claim.repair_job_id, operation, 'repair_job_id'),
            claimToken: requiredString(claim.claim_token, operation, 'claim_token'),
            lookId: requiredString(claim.look_id, operation, 'look_id'),
            pipelineRunId: optionalString(claim.pipeline_run_id),
            retiredProductId: requiredString(claim.retired_product_id, operation, 'retired_product_id'),
            previousProductIds: requiredStringArray(claim.previous_product_ids, operation, 'previous_product_ids'),
            maxTotalCents: requiredNonnegativeInteger(
              claim.max_total_cents, operation, 'max_total_cents',
            ),
            attempt: requiredPositiveInteger(claim.attempt, operation, 'attempt'),
            leaseExpiresAt: requiredString(claim.lease_expires_at, operation, 'lease_expires_at'),
          };
        }),
      };
    },

    async commitOutfitRepair(input: CatalogOutfitRepairCommitInput): Promise<CatalogOutfitRepairCommit> {
      const operation = 'catalog_worker_commit_outfit_repair';
      const result = input.result;
      const resultingProductIds = result.status === 'repaired'
        ? Object.values(result.items).map((product) => product?.id).filter((id): id is string => Boolean(id)).sort()
        : [];
      const row = await callRpc(client, operation, {
        p_idempotency_key: input.idempotencyKey,
        p_repair_job_id: input.repairJobId,
        p_claim_token: input.claimToken,
        p_status: result.status,
        p_resulting_product_ids: resultingProductIds,
        p_replacements: result.status === 'repaired' ? result.replacements : [],
        p_removed_optional_product_ids: result.removedOptionalProductIds,
        p_suppression_reason: result.status === 'suppressed' ? result.reason : null,
        p_total_cents: result.status === 'repaired' ? result.totalCents : null,
        p_occurred_at: input.occurredAt,
      });
      const outcome = persistenceOutcome(row.outcome, operation, ['committed', 'replay']);
      return {
        outcome: outcome as 'committed' | 'replay',
        repairId: requiredString(row.repair_id, operation, 'repair_id'),
        idempotencyKey: requiredString(row.idempotency_key, operation, 'idempotency_key'),
        repairJobId: requiredString(row.repair_job_id, operation, 'repair_job_id'),
        lookId: requiredString(row.look_id, operation, 'look_id'),
        status: requiredString(row.status, operation, 'status') as 'repaired' | 'suppressed',
        pipelineRunId: optionalString(row.pipeline_run_id),
        servedStateCommitted: requiredBoolean(row.served_state_committed, operation, 'served_state_committed'),
        servedStateVersion: requiredPositiveInteger(row.served_state_version, operation, 'served_state_version'),
        committedAt: requiredString(row.committed_at, operation, 'committed_at'),
      };
    },
  };
}
