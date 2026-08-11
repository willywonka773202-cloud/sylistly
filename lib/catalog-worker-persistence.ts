import type {
  CatalogLifecycleRuntimeLedgerEntry,
  CatalogLifecycleRuntimeRecord,
  CatalogRetryDecision,
} from './catalog-pipeline-runtime';
import type { CatalogLifecycleTransitionRequest } from './catalog-lifecycle';
import type { CatalogOutfitRepairResult } from './catalog-outfit-repair';

/**
 * The worker never infers a database commit from an HTTP 200 or a caller-owned
 * boolean. Every mutation crosses this boundary and receives an explicit,
 * replay-aware acknowledgement from the durable adapter.
 */
export type CatalogPersistenceOutcome = 'committed' | 'replay' | 'noop' | 'disabled';

export interface CatalogPipelineRunInput {
  idempotencyKey: string;
  pipelineVersion: string;
  mode: 'candidate_only' | 'release';
  triggerKind: 'scheduled' | 'manual' | 'retry' | 'backfill' | 'health_repair';
  dryRun: boolean;
  requestedBy?: string;
  sourceScope?: readonly string[];
  occurredAt: string;
}

export interface CatalogPipelineRunCommit {
  outcome: Exclude<CatalogPersistenceOutcome, 'noop'>;
  runId?: string;
  idempotencyKey?: string;
  committedAt?: string;
}

export interface CatalogPipelineRunFinalizationInput {
  runId: string;
  status: 'succeeded' | 'failed' | 'blocked' | 'cancelled';
  occurredAt: string;
  candidateCount?: number;
  approvedCount?: number;
  publishedCount?: number;
  retiredCount?: number;
}

export interface CatalogStageAttemptInput {
  runId: string;
  stageName: string;
  attempt: number;
  occurredAt: string;
  inputCount?: number;
  estimatedCostCents?: number;
}

export interface CatalogStageSuccessInput extends CatalogStageAttemptInput {
  outputCount: number;
  rejectedCount?: number;
  actualCostCents?: number;
}

export interface CatalogStageFailureInput extends CatalogStageAttemptInput {
  failureCode: string;
  retryDecision: CatalogRetryDecision;
  alertType: 'pipeline_failure' | 'retry_exhausted';
  alertSeverity: 'warning' | 'critical';
  alertDedupeKey: string;
}

export interface CatalogStageCommit {
  outcome: CatalogPersistenceOutcome;
  stageRunId?: string;
  runId?: string;
  stageName?: string;
  attempt?: number;
  stageStatus?: 'pending' | 'running' | 'succeeded' | 'failed' | 'blocked' | 'skipped' | 'cancelled';
  committedAt?: string;
  retryId?: string;
  alertId?: string;
}

export interface CatalogLifecycleCommit {
  outcome: CatalogPersistenceOutcome;
  record?: CatalogLifecycleRuntimeRecord;
  ledgerEntry?: CatalogLifecycleRuntimeLedgerEntry;
  committedAt?: string;
  repairJobsPlanned?: number;
}

type CatalogOutfitRepairOrUnchanged = Extract<
  CatalogOutfitRepairResult,
  { status: 'unchanged' | 'repaired' }
>;
export type PersistableCatalogOutfitRepair =
  | (CatalogOutfitRepairOrUnchanged & { status: 'repaired' })
  | Extract<CatalogOutfitRepairResult, { status: 'suppressed' }>;

export interface CatalogOutfitRepairCommitInput {
  idempotencyKey: string;
  repairJobId: string;
  claimToken: string;
  result: PersistableCatalogOutfitRepair;
  occurredAt: string;
}

export interface CatalogOutfitRepairCommit {
  outcome: Exclude<CatalogPersistenceOutcome, 'noop'>;
  repairId?: string;
  idempotencyKey?: string;
  repairJobId?: string;
  lookId?: string;
  status?: 'repaired' | 'suppressed';
  pipelineRunId?: string;
  servedStateCommitted?: boolean;
  servedStateVersion?: number;
  committedAt?: string;
}

export interface CatalogServedOutfitInput {
  lookId: string;
  productIds: readonly string[];
  maxTotalCents: number;
  sourceVersion: string;
  occurredAt: string;
}

export interface CatalogServedOutfitCommit {
  outcome: Exclude<CatalogPersistenceOutcome, 'noop'>;
  lookId?: string;
  version?: number;
  committedAt?: string;
}

export interface CatalogOutfitRepairClaimInput {
  workerId: string;
  limit: number;
  leaseMs: number;
  occurredAt: string;
}

export interface CatalogOutfitRepairClaim {
  repairJobId: string;
  claimToken: string;
  lookId: string;
  pipelineRunId?: string;
  retiredProductId: string;
  previousProductIds: string[];
  maxTotalCents: number;
  attempt: number;
  leaseExpiresAt: string;
}

export interface CatalogOutfitRepairClaimResult {
  outcome: 'committed' | 'noop' | 'disabled';
  claims: CatalogOutfitRepairClaim[];
}

export interface CatalogRetryClaimInput {
  workerId: string;
  limit: number;
  leaseMs: number;
  occurredAt: string;
}

export interface CatalogRetryClaim {
  retryId: string;
  claimToken: string;
  runId: string;
  stageName: string;
  nextAttempt: number;
  nextStageRunId: string;
  leaseExpiresAt: string;
}

export interface CatalogRetryClaimResult {
  outcome: 'committed' | 'noop' | 'disabled';
  claims: CatalogRetryClaim[];
}

export interface CatalogRetryCompletionInput {
  retryId: string;
  claimToken: string;
  status: 'succeeded' | 'failed' | 'abandoned' | 'cancelled';
  occurredAt: string;
}

/**
 * Adapter contract implemented by Supabase in production and by an in-memory
 * transaction fixture in integration tests. Each method represents one
 * database transaction, never a sequence of loosely related writes.
 */
export interface CatalogWorkerPersistence {
  readonly kind: 'supabase' | 'disabled' | 'memory';
  readonly enabled: boolean;
  ensureRun(input: CatalogPipelineRunInput): Promise<CatalogPipelineRunCommit>;
  finalizeRun(input: CatalogPipelineRunFinalizationInput): Promise<CatalogPipelineRunCommit>;
  beginStageAttempt(input: CatalogStageAttemptInput): Promise<CatalogStageCommit>;
  completeStageAttempt(input: CatalogStageSuccessInput): Promise<CatalogStageCommit>;
  failStageAttempt(input: CatalogStageFailureInput): Promise<CatalogStageCommit>;
  applyLifecycleTransition(
    request: CatalogLifecycleTransitionRequest,
    pipelineRunId?: string,
  ): Promise<CatalogLifecycleCommit>;
  claimDueRetries(input: CatalogRetryClaimInput): Promise<CatalogRetryClaimResult>;
  completeRetry(input: CatalogRetryCompletionInput): Promise<CatalogStageCommit>;
  registerServedOutfit(input: CatalogServedOutfitInput): Promise<CatalogServedOutfitCommit>;
  claimOutfitRepairs(input: CatalogOutfitRepairClaimInput): Promise<CatalogOutfitRepairClaimResult>;
  commitOutfitRepair(input: CatalogOutfitRepairCommitInput): Promise<CatalogOutfitRepairCommit>;
}

const DISABLED_RUN: CatalogPipelineRunCommit = { outcome: 'disabled' };
const DISABLED_STAGE: CatalogStageCommit = { outcome: 'disabled' };
const DISABLED_LIFECYCLE: CatalogLifecycleCommit = { outcome: 'disabled' };
const DISABLED_REPAIR: CatalogOutfitRepairCommit = { outcome: 'disabled' };
const DISABLED_RETRY_CLAIMS: CatalogRetryClaimResult = { outcome: 'disabled', claims: [] };
const DISABLED_REPAIR_CLAIMS: CatalogOutfitRepairClaimResult = { outcome: 'disabled', claims: [] };
const DISABLED_OUTFIT: CatalogServedOutfitCommit = { outcome: 'disabled' };

/** Explicit fail-closed adapter used when service-role configuration is absent. */
export function createDisabledCatalogWorkerPersistence(): CatalogWorkerPersistence {
  return {
    kind: 'disabled',
    enabled: false,
    async ensureRun() { return DISABLED_RUN; },
    async finalizeRun() { return DISABLED_RUN; },
    async beginStageAttempt() { return DISABLED_STAGE; },
    async completeStageAttempt() { return DISABLED_STAGE; },
    async failStageAttempt() { return DISABLED_STAGE; },
    async applyLifecycleTransition() { return DISABLED_LIFECYCLE; },
    async claimDueRetries() { return DISABLED_RETRY_CLAIMS; },
    async completeRetry() { return DISABLED_STAGE; },
    async registerServedOutfit() { return DISABLED_OUTFIT; },
    async claimOutfitRepairs() { return DISABLED_REPAIR_CLAIMS; },
    async commitOutfitRepair() { return DISABLED_REPAIR; },
  };
}
