import {
  emitCatalogOutfitRepairAnalytics,
  emitCatalogPipelineRuntimeFailureAnalytics,
  emitCommittedCatalogLifecycleAnalytics,
  type CatalogAnalyticsCapture,
} from './catalog-job-analytics';
import {
  validateCatalogLifecycleTransition,
  type CatalogLifecycleTransitionRequest,
} from './catalog-lifecycle';
import {
  planCatalogStageRetry,
  type CatalogRetryDecision,
  type CatalogRetryPolicy,
} from './catalog-pipeline-runtime';
import type {
  CatalogLifecycleCommit,
  CatalogOutfitRepairCommit,
  CatalogOutfitRepairCommitInput,
  CatalogOutfitRepairClaimInput,
  CatalogOutfitRepairClaimResult,
  CatalogPipelineRunCommit,
  CatalogPipelineRunFinalizationInput,
  CatalogPipelineRunInput,
  CatalogRetryClaimInput,
  CatalogRetryClaimResult,
  CatalogRetryCompletionInput,
  CatalogServedOutfitCommit,
  CatalogServedOutfitInput,
  CatalogStageAttemptInput,
  CatalogStageCommit,
  CatalogStageSuccessInput,
  CatalogWorkerPersistence,
} from './catalog-worker-persistence';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const SAFE_FAILURE_CODE = /^[a-z][a-z0-9_]{0,63}$/;

export interface CatalogLifecycleWorkerResult {
  commit: CatalogLifecycleCommit;
  analyticsEmitted: boolean;
}

export interface CatalogOutfitRepairWorkerResult {
  commit: CatalogOutfitRepairCommit;
  analyticsEmitted: boolean;
}

export interface CatalogStageFailureWorkerResult {
  commit: CatalogStageCommit;
  retryDecision: CatalogRetryDecision;
  analyticsEmitted: boolean;
}

function requireSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value)) throw new Error(`${label} must be a stable, bounded identifier.`);
}

function requireTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid ISO timestamp.`);
}

function assertStageIdentity(
  commit: CatalogStageCommit,
  input: CatalogStageAttemptInput,
): void {
  if (commit.outcome === 'disabled') return;
  if (
    commit.runId !== input.runId
    || commit.stageName !== input.stageName
    || commit.attempt !== input.attempt
  ) {
    throw new Error('Catalog stage persistence acknowledgement did not match the requested attempt.');
  }
}

/**
 * Worker coordinator for durable pipeline boundaries. It owns validation and
 * post-commit analytics; adapters own transactions and replay classification.
 */
export class CatalogLifecycleWorkerRunner {
  constructor(
    private readonly persistence: CatalogWorkerPersistence,
    private readonly analyticsCapture?: CatalogAnalyticsCapture,
  ) {}

  get enabled(): boolean {
    return this.persistence.enabled;
  }

  async ensureRun(input: CatalogPipelineRunInput): Promise<CatalogPipelineRunCommit> {
    requireSafeId(input.idempotencyKey, 'Pipeline run idempotency key');
    requireSafeId(input.pipelineVersion, 'Pipeline version');
    requireTimestamp(input.occurredAt, 'Pipeline run time');
    const commit = await this.persistence.ensureRun(input);
    if (commit.outcome !== 'disabled' && commit.idempotencyKey !== input.idempotencyKey) {
      throw new Error('Catalog run persistence acknowledgement did not match the requested run.');
    }
    return commit;
  }

  async finalizeRun(input: CatalogPipelineRunFinalizationInput): Promise<CatalogPipelineRunCommit> {
    requireSafeId(input.runId, 'Pipeline run id');
    requireTimestamp(input.occurredAt, 'Pipeline run completion time');
    const commit = await this.persistence.finalizeRun(input);
    if (commit.outcome !== 'disabled' && commit.runId !== input.runId) {
      throw new Error('Catalog run finalization acknowledgement did not match the requested run.');
    }
    return commit;
  }

  async beginStage(input: CatalogStageAttemptInput): Promise<CatalogStageCommit> {
    this.validateStage(input);
    const commit = await this.persistence.beginStageAttempt(input);
    assertStageIdentity(commit, input);
    return commit;
  }

  async completeStage(input: CatalogStageSuccessInput): Promise<CatalogStageCommit> {
    this.validateStage(input);
    if (!Number.isInteger(input.outputCount) || input.outputCount < 0) {
      throw new Error('Catalog stage output count must be a nonnegative integer.');
    }
    const commit = await this.persistence.completeStageAttempt(input);
    assertStageIdentity(commit, input);
    return commit;
  }

  async failStage(input: {
    runId: string;
    stageName: string;
    attempt: number;
    occurredAt: string;
    failureCode: string;
    retryable: boolean;
    retryPolicy?: Partial<CatalogRetryPolicy>;
  }): Promise<CatalogStageFailureWorkerResult> {
    this.validateStage(input);
    if (!SAFE_FAILURE_CODE.test(input.failureCode)) {
      throw new Error('Catalog stage failure code must be a bounded machine-readable code.');
    }
    const retryDecision = planCatalogStageRetry({
      runId: input.runId,
      stageName: input.stageName,
      failedAttempt: input.attempt,
      failureCode: input.failureCode,
      retryable: input.retryable,
      now: input.occurredAt,
      policy: input.retryPolicy,
    });
    const exhausted = retryDecision.kind !== 'scheduled';
    const commit = await this.persistence.failStageAttempt({
      ...input,
      retryDecision,
      alertType: exhausted ? 'retry_exhausted' : 'pipeline_failure',
      alertSeverity: exhausted ? 'critical' : 'warning',
      alertDedupeKey: [
        'catalog-alert-v1',
        input.runId,
        input.stageName,
        input.failureCode,
      ].map(encodeURIComponent).join(':'),
    });
    assertStageIdentity(commit, input);

    let analyticsEmitted = false;
    if (commit.outcome === 'committed') {
      const analyticsInput = {
        pipelineRunId: input.runId,
        occurredAt: commit.committedAt || input.occurredAt,
        stage: input.stageName,
        errorCode: input.stageName === 'verify'
          ? 'verification_failed' as const
          : 'runner_exception' as const,
      };
      analyticsEmitted = this.analyticsCapture
        ? await emitCatalogPipelineRuntimeFailureAnalytics(analyticsInput, this.analyticsCapture)
        : await emitCatalogPipelineRuntimeFailureAnalytics(analyticsInput);
    }
    return { commit, retryDecision, analyticsEmitted };
  }

  async claimDueRetries(input: CatalogRetryClaimInput): Promise<CatalogRetryClaimResult> {
    this.validateClaim(input.workerId, input.limit, input.leaseMs, input.occurredAt, 'retry');
    return this.persistence.claimDueRetries(input);
  }

  async completeRetry(input: CatalogRetryCompletionInput): Promise<CatalogStageCommit> {
    requireSafeId(input.retryId, 'Retry id');
    requireSafeId(input.claimToken, 'Retry claim token');
    requireTimestamp(input.occurredAt, 'Retry completion time');
    const commit = await this.persistence.completeRetry(input);
    if (commit.outcome !== 'disabled' && commit.retryId !== input.retryId) {
      throw new Error('Retry completion acknowledgement did not match the claimed retry.');
    }
    return commit;
  }

  async transitionProduct(
    request: CatalogLifecycleTransitionRequest,
    pipelineRunId?: string,
  ): Promise<CatalogLifecycleWorkerResult> {
    const validation = validateCatalogLifecycleTransition(request);
    if (!validation.ok) {
      throw new Error(validation.errors.map((error) => `${error.code}: ${error.message}`).join('; '));
    }
    if (pipelineRunId) requireSafeId(pipelineRunId, 'Pipeline run id');
    const commit = await this.persistence.applyLifecycleTransition(request, pipelineRunId);
    let analyticsEmitted = false;

    if (commit.outcome === 'committed') {
      const ledger = commit.ledgerEntry;
      const record = commit.record;
      if (
        !ledger
        || !record
        || ledger.idempotencyKey !== request.idempotencyKey
        || ledger.productId !== request.productId
        || ledger.fromState !== request.fromState
        || ledger.toState !== request.toState
        || record.state !== request.toState
        || record.lastTransitionKey !== request.idempotencyKey
      ) {
        throw new Error('Committed catalog lifecycle acknowledgement did not contain the requested ledger edge.');
      }
      const durableValidation = validateCatalogLifecycleTransition({
        ...request,
        now: ledger.occurredAt,
        evidence: record.evidence,
      });
      if (!durableValidation.ok) {
        throw new Error('Committed catalog lifecycle row did not return valid durable evidence.');
      }
      const analyticsInput = {
        request: { ...request, now: ledger.occurredAt },
        result: {
          outcome: 'applied' as const,
          record,
          ledger: [ledger],
        },
        durableLedgerCommitted: true,
      };
      analyticsEmitted = this.analyticsCapture
        ? await emitCommittedCatalogLifecycleAnalytics(analyticsInput, this.analyticsCapture)
        : await emitCommittedCatalogLifecycleAnalytics(analyticsInput);
    }

    return { commit, analyticsEmitted };
  }

  async commitOutfitRepair(
    input: CatalogOutfitRepairCommitInput,
  ): Promise<CatalogOutfitRepairWorkerResult> {
    requireSafeId(input.idempotencyKey, 'Outfit repair idempotency key');
    requireSafeId(input.repairJobId, 'Outfit repair job id');
    requireSafeId(input.claimToken, 'Outfit repair claim token');
    requireTimestamp(input.occurredAt, 'Outfit repair time');
    if (String(input.result.status) === 'unchanged') {
      throw new Error('Unchanged outfits do not create durable repair ledger edges.');
    }

    const commit = await this.persistence.commitOutfitRepair(input);
    let analyticsEmitted = false;
    if (commit.outcome === 'committed') {
      if (
        commit.idempotencyKey !== input.idempotencyKey
        || commit.repairJobId !== input.repairJobId
        || commit.status !== input.result.status
        || commit.servedStateCommitted !== true
        || !commit.lookId
      ) {
        throw new Error('Outfit repair did not commit matching authoritative served state.');
      }
      if (input.result.status === 'repaired') {
        const analyticsInput = {
          lookId: commit.lookId,
          result: input.result,
          pipelineRunId: commit.pipelineRunId,
        };
        analyticsEmitted = this.analyticsCapture
          ? await emitCatalogOutfitRepairAnalytics(analyticsInput, this.analyticsCapture)
          : await emitCatalogOutfitRepairAnalytics(analyticsInput);
      }
    }
    return { commit, analyticsEmitted };
  }

  async registerServedOutfit(input: CatalogServedOutfitInput): Promise<CatalogServedOutfitCommit> {
    requireSafeId(input.lookId, 'Outfit look id');
    requireSafeId(input.sourceVersion, 'Outfit source version');
    requireTimestamp(input.occurredAt, 'Outfit registration time');
    if (input.productIds.length < 3 || !Number.isInteger(input.maxTotalCents) || input.maxTotalCents < 0) {
      throw new Error('Served outfits require at least three products and a nonnegative budget.');
    }
    const commit = await this.persistence.registerServedOutfit(input);
    if (commit.outcome !== 'disabled' && commit.lookId !== input.lookId) {
      throw new Error('Served outfit acknowledgement did not match the registered look.');
    }
    return commit;
  }

  async claimOutfitRepairs(input: CatalogOutfitRepairClaimInput): Promise<CatalogOutfitRepairClaimResult> {
    this.validateClaim(input.workerId, input.limit, input.leaseMs, input.occurredAt, 'repair');
    return this.persistence.claimOutfitRepairs(input);
  }

  /**
   * Retirement is committed first. A replayed retirement may still resume
   * missing repair ledgers, while a disabled/no-op transition never mutates
   * outfits or emits analytics.
   */
  async retireAndPlanRepairs(input: {
    retirement: CatalogLifecycleTransitionRequest;
    pipelineRunId?: string;
  }): Promise<CatalogLifecycleWorkerResult> {
    if (input.retirement.toState !== 'retired') {
      throw new Error('retireAndPlanRepairs requires a transition ending in retired.');
    }
    return this.transitionProduct(input.retirement, input.pipelineRunId);
  }

  private validateStage(input: CatalogStageAttemptInput): void {
    requireSafeId(input.runId, 'Pipeline run id');
    requireSafeId(input.stageName, 'Pipeline stage');
    requireTimestamp(input.occurredAt, 'Pipeline stage time');
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new Error('Catalog stage attempt must be a positive integer.');
    }
  }

  private validateClaim(
    workerId: string,
    limit: number,
    leaseMs: number,
    occurredAt: string,
    kind: string,
  ): void {
    requireSafeId(workerId, `${kind} worker id`);
    requireTimestamp(occurredAt, `${kind} claim time`);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error(`${kind} claim limit must be between 1 and 100.`);
    }
    if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 3_600_000) {
      throw new Error(`${kind} claim lease must be between one second and one hour.`);
    }
  }
}
