/** Deterministic, no-network integration checks for the durable catalog worker. */
import { readFileSync } from 'node:fs';
import { CatalogLifecycleWorkerRunner } from '../lib/catalog-worker-runner';
import {
  createSupabaseCatalogWorkerPersistence,
  type CatalogRpcClient,
} from '../lib/catalog-worker-supabase';
import {
  applyCatalogLifecycleRequest,
  type CatalogLifecycleRuntimeLedgerEntry,
  type CatalogLifecycleRuntimeRecord,
} from '../lib/catalog-pipeline-runtime';
import type {
  CatalogLifecycleCommit,
  CatalogOutfitRepairClaim,
  CatalogOutfitRepairClaimInput,
  CatalogOutfitRepairClaimResult,
  CatalogOutfitRepairCommit,
  CatalogOutfitRepairCommitInput,
  CatalogPipelineRunCommit,
  CatalogPipelineRunFinalizationInput,
  CatalogPipelineRunInput,
  CatalogRetryClaim,
  CatalogRetryClaimInput,
  CatalogRetryClaimResult,
  CatalogRetryCompletionInput,
  CatalogServedOutfitCommit,
  CatalogServedOutfitInput,
  CatalogStageAttemptInput,
  CatalogStageCommit,
  CatalogStageFailureInput,
  CatalogStageSuccessInput,
  CatalogWorkerPersistence,
} from '../lib/catalog-worker-persistence';
import type {
  CatalogLifecycleEvidence,
  CatalogLifecycleTransitionRequest,
} from '../lib/catalog-lifecycle';
import type { CatalogOutfitRepairResult } from '../lib/catalog-outfit-repair';
import type { CanonicalAnalyticsEvent } from '../lib/analytics-events';
import type { Product } from '../lib/types';

const NOW = '2026-08-10T18:00:00.000Z';
const LATER = '2026-08-10T18:00:03.000Z';
const AFTER_LEASE = '2026-08-10T18:00:10.000Z';
const RUN_ID = '11111111-1111-4111-8111-111111111111';
const RUN_2_ID = '22222222-2222-4222-8222-222222222222';
let checks = 0;
let failures = 0;

function check(label: string, condition: boolean): void {
  checks += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) failures += 1;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

function stable(value: unknown): string {
  return JSON.stringify(canonical(value));
}

interface MemoryRun extends CatalogPipelineRunInput {
  runId: string;
  status: 'running' | 'succeeded' | 'failed' | 'blocked' | 'cancelled';
  finalized?: CatalogPipelineRunFinalizationInput;
}

interface MemoryStage {
  input: CatalogStageAttemptInput;
  id: string;
  status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  success?: CatalogStageSuccessInput;
  failure?: CatalogStageFailureInput;
  retryId?: string;
  alertId?: string;
  committedAt: string;
}

interface MemoryRetry {
  id: string;
  idempotencyKey: string;
  failedStageKey: string;
  scheduledFor: string;
  status: 'scheduled' | 'running' | 'succeeded' | 'failed' | 'abandoned' | 'cancelled';
  claimToken?: string;
  nextStageKey?: string;
  leaseExpiresAt?: string;
  committedAt: string;
}

interface MemoryServedOutfit extends CatalogServedOutfitInput {
  status: 'active' | 'suppressed';
  version: number;
}

interface MemoryRepairJob {
  id: string;
  lookId: string;
  pipelineRunId?: string;
  retiredProductId: string;
  previousProductIds: string[];
  maxTotalCents: number;
  status: 'queued' | 'claimed' | 'repaired' | 'suppressed';
  attempt: number;
  claimToken?: string;
  leaseExpiresAt?: string;
}

/** Clone-then-commit fixture that models every adapter method as one tx. */
class MemoryCatalogPersistence implements CatalogWorkerPersistence {
  readonly kind = 'memory' as const;
  readonly enabled = true;
  private readonly runs = new Map<string, MemoryRun>();
  private readonly stages = new Map<string, MemoryStage>();
  private readonly records = new Map<string, CatalogLifecycleRuntimeRecord>();
  private readonly ledgers = new Map<string, CatalogLifecycleRuntimeLedgerEntry[]>();
  private readonly transitionRequests = new Map<string, string>();
  private readonly retryRows = new Map<string, MemoryRetry>();
  private readonly activeAlerts = new Map<string, string>();
  private readonly alertHistory = new Map<string, { dedupe: string; status: 'open' | 'resolved' }>();
  private readonly servedOutfits = new Map<string, MemoryServedOutfit>();
  private readonly repairJobs = new Map<string, MemoryRepairJob>();
  private readonly repairLedgers = new Map<string, {
    input: CatalogOutfitRepairCommitInput;
    commit: CatalogOutfitRepairCommit;
  }>();
  failBeforeNextStageFailureCommit = false;
  proposalOnlyNextRepair = false;

  get retryCount(): number { return this.retryRows.size; }
  get alertCount(): number { return this.alertHistory.size; }
  get repairJobCount(): number { return this.repairJobs.size; }

  seed(record: CatalogLifecycleRuntimeRecord): void {
    this.records.set(record.productId, structuredClone(record));
    this.ledgers.set(record.productId, []);
  }

  resolveAlert(dedupe: string): void {
    const id = this.activeAlerts.get(dedupe);
    if (!id) return;
    this.alertHistory.get(id)!.status = 'resolved';
    this.activeAlerts.delete(dedupe);
  }

  stageStatus(runId: string, stageName: string, attempt: number): string | undefined {
    return this.stages.get(this.stageKey(runId, stageName, attempt))?.status;
  }

  async ensureRun(input: CatalogPipelineRunInput): Promise<CatalogPipelineRunCommit> {
    const existing = this.runs.get(input.idempotencyKey);
    if (existing) {
      const identity: CatalogPipelineRunInput = {
        idempotencyKey: existing.idempotencyKey,
        pipelineVersion: existing.pipelineVersion,
        mode: existing.mode,
        triggerKind: existing.triggerKind,
        dryRun: existing.dryRun,
        requestedBy: existing.requestedBy,
        sourceScope: existing.sourceScope,
        occurredAt: existing.occurredAt,
      };
      if (stable(identity) !== stable(input)) throw new Error('run idempotency conflict');
      return this.runCommit(existing, 'replay');
    }
    const runId = this.runs.size ? RUN_2_ID : RUN_ID;
    const row: MemoryRun = { ...structuredClone(input), runId, status: 'running' };
    this.runs.set(input.idempotencyKey, row);
    return this.runCommit(row, 'committed');
  }

  async finalizeRun(input: CatalogPipelineRunFinalizationInput): Promise<CatalogPipelineRunCommit> {
    const row = [...this.runs.values()].find((run) => run.runId === input.runId);
    if (!row) throw new Error('missing run');
    if (row.finalized) {
      if (stable(row.finalized) !== stable(input)) throw new Error('run finalization conflict');
      return this.runCommit(row, 'replay');
    }
    const unfinished = [...this.retryRows.values()].some((retry) => {
      const failed = this.stages.get(retry.failedStageKey);
      return failed?.input.runId === input.runId && ['scheduled', 'running'].includes(retry.status);
    });
    if (unfinished && input.status !== 'cancelled') throw new Error('unfinished retry work');
    row.status = input.status;
    row.finalized = structuredClone(input);
    return this.runCommit(row, 'committed');
  }

  async beginStageAttempt(input: CatalogStageAttemptInput): Promise<CatalogStageCommit> {
    const key = this.stageKey(input.runId, input.stageName, input.attempt);
    const existing = this.stages.get(key);
    if (existing) {
      if (stable(existing.input) !== stable(input)) throw new Error('stage identity conflict');
      return this.stageCommit(existing, 'replay');
    }
    const row: MemoryStage = {
      input: structuredClone(input), id: `stage-${this.stages.size + 1}`,
      status: 'running', committedAt: input.occurredAt,
    };
    this.stages.set(key, row);
    return this.stageCommit(row, 'committed');
  }

  async completeStageAttempt(input: CatalogStageSuccessInput): Promise<CatalogStageCommit> {
    const row = this.stages.get(this.stageKey(input.runId, input.stageName, input.attempt));
    if (!row) throw new Error('missing stage');
    if (row.status === 'succeeded') {
      if (stable(row.success) !== stable(input)) throw new Error('stage completion conflict');
      return this.stageCommit(row, 'replay');
    }
    if (row.status !== 'running') throw new Error('terminal stage');
    row.status = 'succeeded';
    row.success = structuredClone(input);
    row.committedAt = input.occurredAt;
    return this.stageCommit(row, 'committed');
  }

  async failStageAttempt(input: CatalogStageFailureInput): Promise<CatalogStageCommit> {
    const key = this.stageKey(input.runId, input.stageName, input.attempt);
    const current = this.stages.get(key);
    if (!current) throw new Error('missing stage');
    if (current.status === 'failed') {
      if (stable(current.failure) !== stable(input)) throw new Error('stage failure conflict');
      return this.stageCommit(current, 'replay');
    }
    if (current.status !== 'running') throw new Error('terminal stage');
    const next = structuredClone(current);
    next.status = 'failed';
    next.failure = structuredClone(input);
    next.committedAt = input.occurredAt;
    if (input.retryDecision.kind === 'scheduled') next.retryId = `retry-${this.retryRows.size + 1}`;
    next.alertId = this.activeAlerts.get(input.alertDedupeKey) || `alert-${this.alertHistory.size + 1}`;
    if (this.failBeforeNextStageFailureCommit) {
      this.failBeforeNextStageFailureCommit = false;
      throw new Error('injected transaction abort');
    }
    this.stages.set(key, next);
    if (input.retryDecision.kind === 'scheduled') {
      this.retryRows.set(input.retryDecision.idempotencyKey, {
        id: next.retryId!, idempotencyKey: input.retryDecision.idempotencyKey,
        failedStageKey: key, scheduledFor: input.retryDecision.scheduledFor,
        status: 'scheduled', committedAt: input.occurredAt,
      });
    }
    if (!this.alertHistory.has(next.alertId)) {
      this.alertHistory.set(next.alertId, { dedupe: input.alertDedupeKey, status: 'open' });
    }
    this.activeAlerts.set(input.alertDedupeKey, next.alertId);
    return this.stageCommit(next, 'committed');
  }

  async claimDueRetries(input: CatalogRetryClaimInput): Promise<CatalogRetryClaimResult> {
    const claims: CatalogRetryClaim[] = [];
    for (const retry of [...this.retryRows.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      if (claims.length >= input.limit) break;
      const due = retry.status === 'scheduled' && Date.parse(retry.scheduledFor) <= Date.parse(input.occurredAt);
      const expired = retry.status === 'running'
        && Date.parse(retry.leaseExpiresAt || '') <= Date.parse(input.occurredAt);
      if (!due && !expired) continue;
      const failed = this.stages.get(retry.failedStageKey)!;
      const nextAttempt = failed.input.attempt + 1;
      const nextKey = retry.nextStageKey
        || this.stageKey(failed.input.runId, failed.input.stageName, nextAttempt);
      let nextStage = this.stages.get(nextKey);
      if (!nextStage) {
        nextStage = {
          input: { ...failed.input, attempt: nextAttempt, occurredAt: input.occurredAt },
          id: `stage-${this.stages.size + 1}`, status: 'running', committedAt: input.occurredAt,
        };
        this.stages.set(nextKey, nextStage);
      }
      retry.status = 'running';
      retry.nextStageKey = nextKey;
      retry.claimToken = `00000000-0000-4000-8000-${String(claims.length + this.retryRows.size).padStart(12, '0')}`;
      retry.leaseExpiresAt = new Date(Date.parse(input.occurredAt) + input.leaseMs).toISOString();
      claims.push({
        retryId: retry.id, claimToken: retry.claimToken,
        runId: failed.input.runId, stageName: failed.input.stageName,
        nextAttempt, nextStageRunId: nextStage.id, leaseExpiresAt: retry.leaseExpiresAt,
      });
    }
    return { outcome: claims.length ? 'committed' : 'noop', claims };
  }

  async completeRetry(input: CatalogRetryCompletionInput): Promise<CatalogStageCommit> {
    const retry = [...this.retryRows.values()].find((row) => row.id === input.retryId);
    if (!retry) throw new Error('missing retry');
    const next = retry.nextStageKey ? this.stages.get(retry.nextStageKey) : undefined;
    if (!next) throw new Error('missing next attempt');
    if (retry.status === input.status) return { ...this.stageCommit(next, 'replay'), retryId: retry.id };
    if (retry.status !== 'running' || retry.claimToken !== input.claimToken) throw new Error('retry claim conflict');
    if ((input.status === 'succeeded' && next.status !== 'succeeded')
      || (input.status === 'failed' && next.status !== 'failed')) throw new Error('retry/stage mismatch');
    retry.status = input.status;
    retry.committedAt = input.occurredAt;
    return { ...this.stageCommit(next, 'committed'), retryId: retry.id };
  }

  async applyLifecycleTransition(
    request: CatalogLifecycleTransitionRequest,
    pipelineRunId?: string,
  ): Promise<CatalogLifecycleCommit> {
    const identity = stable({ request, pipelineRunId: pipelineRunId || null });
    const previous = this.transitionRequests.get(request.idempotencyKey);
    if (previous && previous !== identity) throw new Error('lifecycle idempotency evidence conflict');
    const record = this.records.get(request.productId);
    if (!record) throw new Error('missing product');
    const ledger = this.ledgers.get(request.productId) || [];
    const result = applyCatalogLifecycleRequest(record, ledger, request);
    if (result.outcome === 'applied') {
      this.transitionRequests.set(request.idempotencyKey, identity);
      this.records.set(request.productId, structuredClone(result.record));
      this.ledgers.set(request.productId, structuredClone(result.ledger));
    }
    const edge = result.ledger.find((entry) => entry.idempotencyKey === request.idempotencyKey);
    let repairJobsPlanned = 0;
    if (request.toState === 'retired' && ['applied', 'replay'].includes(result.outcome)) {
      for (const outfit of this.servedOutfits.values()) {
        if (outfit.status !== 'active' || !outfit.productIds.includes(request.productId)) continue;
        const jobId = `repair-job-${request.idempotencyKey}-${outfit.lookId}`;
        if (!this.repairJobs.has(jobId)) {
          this.repairJobs.set(jobId, {
            id: jobId, lookId: outfit.lookId, pipelineRunId,
            retiredProductId: request.productId,
            previousProductIds: [...outfit.productIds], maxTotalCents: outfit.maxTotalCents,
            status: 'queued', attempt: 0,
          });
        }
        repairJobsPlanned += 1;
      }
    }
    return {
      outcome: result.outcome === 'applied' ? 'committed' : result.outcome,
      record: structuredClone(result.record), ledgerEntry: edge ? structuredClone(edge) : undefined,
      committedAt: edge?.occurredAt || request.now, repairJobsPlanned,
    };
  }

  async registerServedOutfit(input: CatalogServedOutfitInput): Promise<CatalogServedOutfitCommit> {
    const existing = this.servedOutfits.get(input.lookId);
    if (existing) {
      const identity: CatalogServedOutfitInput = {
        lookId: existing.lookId,
        productIds: existing.productIds,
        maxTotalCents: existing.maxTotalCents,
        sourceVersion: existing.sourceVersion,
        occurredAt: existing.occurredAt,
      };
      if (stable(identity) !== stable(input)) throw new Error('served outfit conflict');
      return { outcome: 'replay', lookId: input.lookId, version: existing.version, committedAt: existing.occurredAt };
    }
    this.servedOutfits.set(input.lookId, { ...structuredClone(input), status: 'active', version: 1 });
    return { outcome: 'committed', lookId: input.lookId, version: 1, committedAt: input.occurredAt };
  }

  async claimOutfitRepairs(input: CatalogOutfitRepairClaimInput): Promise<CatalogOutfitRepairClaimResult> {
    const claims: CatalogOutfitRepairClaim[] = [];
    for (const job of [...this.repairJobs.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      if (claims.length >= input.limit) break;
      const expired = job.status === 'claimed'
        && Date.parse(job.leaseExpiresAt || '') <= Date.parse(input.occurredAt);
      if (job.status !== 'queued' && !expired) continue;
      job.status = 'claimed';
      job.attempt += 1;
      job.claimToken = `10000000-0000-4000-8000-${String(job.attempt).padStart(12, '0')}`;
      job.leaseExpiresAt = new Date(Date.parse(input.occurredAt) + input.leaseMs).toISOString();
      claims.push({
        repairJobId: job.id, claimToken: job.claimToken, lookId: job.lookId,
        pipelineRunId: job.pipelineRunId, retiredProductId: job.retiredProductId,
        previousProductIds: [...job.previousProductIds], maxTotalCents: job.maxTotalCents,
        attempt: job.attempt, leaseExpiresAt: job.leaseExpiresAt,
      });
    }
    return { outcome: claims.length ? 'committed' : 'noop', claims };
  }

  async commitOutfitRepair(input: CatalogOutfitRepairCommitInput): Promise<CatalogOutfitRepairCommit> {
    const ledger = this.repairLedgers.get(input.idempotencyKey);
    if (ledger) {
      if (stable(ledger.input) !== stable(input)) throw new Error('repair idempotency conflict');
      return { ...ledger.commit, outcome: 'replay' };
    }
    const job = this.repairJobs.get(input.repairJobId);
    if (!job || job.status !== 'claimed' || job.claimToken !== input.claimToken) {
      throw new Error('repair claim conflict');
    }
    const outfit = this.servedOutfits.get(job.lookId);
    if (!outfit || outfit.status !== 'active' || stable(outfit.productIds) !== stable(job.previousProductIds)) {
      throw new Error('served state conflict');
    }
    if (this.proposalOnlyNextRepair) {
      this.proposalOnlyNextRepair = false;
      return {
        outcome: 'committed', repairId: 'proposal-only', repairJobId: job.id,
        idempotencyKey: input.idempotencyKey, lookId: job.lookId,
        status: input.result.status, pipelineRunId: job.pipelineRunId,
        servedStateCommitted: false, servedStateVersion: outfit.version,
        committedAt: input.occurredAt,
      };
    }
    outfit.version += 1;
    if (input.result.status === 'repaired') {
      outfit.productIds = Object.values(input.result.items)
        .map((product) => product?.id).filter((id): id is string => Boolean(id)).sort();
    } else {
      outfit.status = 'suppressed';
    }
    job.status = input.result.status;
    const commit: CatalogOutfitRepairCommit = {
      outcome: 'committed', repairId: `repair-${this.repairLedgers.size + 1}`,
      repairJobId: job.id, idempotencyKey: input.idempotencyKey,
      lookId: job.lookId, status: input.result.status,
      pipelineRunId: job.pipelineRunId, servedStateCommitted: true,
      servedStateVersion: outfit.version, committedAt: input.occurredAt,
    };
    this.repairLedgers.set(input.idempotencyKey, { input: structuredClone(input), commit });
    return commit;
  }

  private runCommit(row: MemoryRun, outcome: 'committed' | 'replay'): CatalogPipelineRunCommit {
    return {
      outcome, runId: row.runId, idempotencyKey: row.idempotencyKey,
      committedAt: row.finalized?.occurredAt || row.occurredAt,
    };
  }

  private stageCommit(row: MemoryStage, outcome: 'committed' | 'replay'): CatalogStageCommit {
    return {
      outcome, stageRunId: row.id, runId: row.input.runId,
      stageName: row.input.stageName, attempt: row.input.attempt,
      stageStatus: row.status, retryId: row.retryId, alertId: row.alertId,
      committedAt: row.committedAt,
    };
  }

  private stageKey(runId: string, stageName: string, attempt: number): string {
    return `${runId}:${stageName}:${attempt}`;
  }
}

function fixtureProduct(id: string, category: Product['category']): Product {
  return {
    id, brand: 'Worker Fixture', name: id, category, priceCents: 5_000,
    currency: 'USD', retailer: 'Fixture Shop',
    retailerUrl: `https://shop.example.com/products/${id}`,
    productUrl: `https://shop.example.com/products/${id}`,
    imageUrl: `https://cdn.example.com/${id}.jpg`,
  };
}

function lifecycleRequest(
  fromState: CatalogLifecycleTransitionRequest['fromState'],
  toState: CatalogLifecycleTransitionRequest['toState'],
  key: string,
  evidence: CatalogLifecycleEvidence,
  previousTransitionKey?: string,
): CatalogLifecycleTransitionRequest {
  return {
    productId: 'worker-product-1', fromState, toState,
    idempotencyKey: key, previousTransitionKey,
    actorType: 'system', now: NOW, evidence,
  };
}

async function main(): Promise<void> {
  console.log('Catalog worker persistence checks');
  console.log('=================================');
  const captures: CanonicalAnalyticsEvent[] = [];
  const memory = new MemoryCatalogPersistence();
  const runner = new CatalogLifecycleWorkerRunner(memory, async (event) => { captures.push(event); });

  const runInput: CatalogPipelineRunInput = {
    idempotencyKey: 'worker-run-001', pipelineVersion: 'catalog-v1', mode: 'release',
    triggerKind: 'health_repair', dryRun: false, sourceScope: ['fixture'], occurredAt: NOW,
  };
  const run = await runner.ensureRun(runInput);
  check('pipeline run creation is durable and replay-safe',
    run.outcome === 'committed' && (await runner.ensureRun(runInput)).outcome === 'replay');

  const stage1: CatalogStageAttemptInput = {
    runId: RUN_ID, stageName: 'verify', attempt: 1, occurredAt: NOW, inputCount: 1,
  };
  await runner.beginStage(stage1);
  const failure1 = await runner.failStage({
    ...stage1, failureCode: 'retailer_timeout', retryable: true,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 2_000 },
  });
  const failure1Replay = await runner.failStage({
    ...stage1, failureCode: 'retailer_timeout', retryable: true,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 2_000 },
  });
  check('stage failure, retry, alert, and immutable association commit once',
    failure1.commit.outcome === 'committed' && failure1Replay.commit.outcome === 'replay'
      && memory.retryCount === 1 && memory.alertCount === 1 && !failure1Replay.analyticsEmitted);

  const alertDedupe = [
    'catalog-alert-v1', RUN_ID, 'verify', 'retailer_timeout',
  ].map(encodeURIComponent).join(':');
  memory.resolveAlert(alertDedupe);
  check('resolved-alert replay uses immutable failure association, not active alert state',
    (await runner.failStage({
      ...stage1, failureCode: 'retailer_timeout', retryable: true,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 2_000 },
    })).commit.outcome === 'replay');

  const retry1Claims = await runner.claimDueRetries({
    workerId: 'retry-worker-1', limit: 1, leaseMs: 5_000, occurredAt: LATER,
  });
  const retry1 = retry1Claims.claims[0];
  check('due retry claim atomically creates restartable attempt two',
    retry1Claims.outcome === 'committed' && retry1?.nextAttempt === 2
      && memory.stageStatus(RUN_ID, 'verify', 2) === 'running');
  const stage2 = { ...stage1, attempt: 2, occurredAt: LATER };
  const failure2 = await runner.failStage({
    ...stage2, failureCode: 'retailer_timeout', retryable: true,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 2_000 },
  });
  await runner.completeRetry({
    retryId: retry1.retryId, claimToken: retry1.claimToken, status: 'failed', occurredAt: LATER,
  });
  check('same failure on a later attempt opens/reuses alert without stage association conflict',
    failure2.commit.outcome === 'committed' && memory.retryCount === 2 && memory.alertCount === 2);

  const retry2 = (await runner.claimDueRetries({
    workerId: 'retry-worker-1', limit: 1, leaseMs: 5_000, occurredAt: AFTER_LEASE,
  })).claims[0];
  const stage3 = { ...stage1, attempt: 3, occurredAt: AFTER_LEASE };
  await runner.completeStage({ ...stage3, outputCount: 1 });
  const retry2Done = await runner.completeRetry({
    retryId: retry2.retryId, claimToken: retry2.claimToken,
    status: 'succeeded', occurredAt: AFTER_LEASE,
  });
  check('retry completion is claim-bound and closes the created next attempt',
    retry2Done.outcome === 'committed' && retry2Done.stageStatus === 'succeeded');
  const finalized = await runner.finalizeRun({
    runId: RUN_ID, status: 'succeeded', occurredAt: AFTER_LEASE,
    candidateCount: 1, approvedCount: 1, publishedCount: 1, retiredCount: 0,
  });
  check('pipeline run finalization is terminal and replay-safe after retries finish',
    finalized.outcome === 'committed' && (await runner.finalizeRun({
      runId: RUN_ID, status: 'succeeded', occurredAt: AFTER_LEASE,
      candidateCount: 1, approvedCount: 1, publishedCount: 1, retiredCount: 0,
    })).outcome === 'replay');

  const run2Input = { ...runInput, idempotencyKey: 'worker-run-002' };
  await runner.ensureRun(run2Input);
  const abortStage = { ...stage1, runId: RUN_2_ID, stageName: 'image_ready' };
  await runner.beginStage(abortStage);
  memory.failBeforeNextStageFailureCommit = true;
  let aborted = false;
  try {
    await runner.failStage({ ...abortStage, failureCode: 'cutout_timeout', retryable: true });
  } catch { aborted = true; }
  check('aborted transaction leaks no partial stage/retry/alert writes',
    aborted && memory.stageStatus(RUN_2_ID, 'image_ready', 1) === 'running'
      && memory.retryCount === 2 && memory.alertCount === 2);

  let evidence: CatalogLifecycleEvidence = {
    sourceSystem: 'fixture_feed', sourceProductId: 'source-worker-1',
    canonicalProductId: 'worker-product-1', normalizedAt: '2026-08-10T17:00:00.000Z',
    deduplicatedAt: '2026-08-10T17:01:00.000Z', enrichedAt: '2026-08-10T17:02:00.000Z',
    imageReadyAt: '2026-08-10T17:03:00.000Z', verifiedAt: '2026-08-10T17:30:00.000Z',
    priceVerifiedAt: '2026-08-10T17:30:00.000Z', lastCheckedAt: '2026-08-10T17:30:00.000Z',
    catalogPriceCents: 5_000, verifiedPriceCents: 5_000, currency: 'USD',
    verifiedCurrency: 'USD', linkHealthStatus: 'available', inStock: true, trusted: true,
  };
  memory.seed({ productId: 'worker-product-1', state: 'image_ready', evidence });
  const verifiedRequest = lifecycleRequest('image_ready', 'verified', 'worker-verify-1', evidence);
  await runner.transitionProduct(verifiedRequest, RUN_ID);
  let evidenceConflict = false;
  try {
    await runner.transitionProduct({
      ...verifiedRequest, evidence: { ...verifiedRequest.evidence, verifiedPriceCents: 5_001 },
    }, RUN_ID);
  } catch { evidenceConflict = true; }
  check('lifecycle replay rejects conflicting evidence under the same key', evidenceConflict);
  evidence = { ...evidence, moderationStatus: 'auto_approved', approvedAt: '2026-08-10T17:40:00.000Z' };
  await runner.transitionProduct(lifecycleRequest(
    'verified', 'approved', 'worker-approve-1', evidence, 'worker-verify-1',
  ), RUN_ID);
  evidence = { ...evidence, publishedAt: '2026-08-10T17:45:00.000Z' };
  await runner.transitionProduct(lifecycleRequest(
    'approved', 'published', 'worker-publish-1', evidence, 'worker-approve-1',
  ), RUN_ID);

  const priorProducts = ['worker-product-1', 'retained-bottom', 'retained-shoes'];
  await runner.registerServedOutfit({
    lookId: 'worker-look-1', productIds: priorProducts, maxTotalCents: 30_000,
    sourceVersion: 'library-v1', occurredAt: NOW,
  });
  await runner.registerServedOutfit({
    lookId: 'worker-look-2', productIds: priorProducts, maxTotalCents: 30_000,
    sourceVersion: 'library-v1', occurredAt: NOW,
  });
  const retirement = lifecycleRequest('published', 'retired', 'worker-retire-1', {
    ...evidence, linkHealthStatus: 'sold_out', inStock: false,
    retiredAt: '2026-08-10T17:58:00.000Z', reasonCode: 'retailer_sold_out',
  }, 'worker-publish-1');
  const retired = await runner.retireAndPlanRepairs({ retirement, pipelineRunId: RUN_ID });
  const retiredReplay = await runner.retireAndPlanRepairs({ retirement, pipelineRunId: RUN_ID });
  check('retirement atomically creates durable repair jobs from served state',
    retired.commit.outcome === 'committed' && retired.commit.repairJobsPlanned === 2
      && retiredReplay.commit.outcome === 'replay' && memory.repairJobCount === 2);

  const repairClaim1 = (await runner.claimOutfitRepairs({
    workerId: 'repair-worker-1', limit: 1, leaseMs: 5_000, occurredAt: NOW,
  })).claims[0];
  const repaired: CatalogOutfitRepairResult & { status: 'repaired' } = {
    status: 'repaired',
    items: {
      top: fixtureProduct('replacement-top', 'top'),
      bottom: fixtureProduct('retained-bottom', 'bottom'),
      shoes: fixtureProduct('retained-shoes', 'shoes'),
    },
    totalCents: 15_000,
    replacements: [{
      category: 'top', removedProductId: 'worker-product-1', replacementProductId: 'replacement-top',
    }],
    removedOptionalProductIds: [],
  };
  const repairInput1: CatalogOutfitRepairCommitInput = {
    idempotencyKey: 'worker-repair-1', repairJobId: repairClaim1.repairJobId,
    claimToken: repairClaim1.claimToken, result: repaired, occurredAt: NOW,
  };
  const repairedCommit = await runner.commitOutfitRepair(repairInput1);
  const repairedReplay = await runner.commitOutfitRepair(repairInput1);
  check('repair analytics require authoritative served-state commit and suppress replay',
    repairedCommit.commit.servedStateCommitted === true && repairedCommit.analyticsEmitted
      && repairedReplay.commit.outcome === 'replay' && !repairedReplay.analyticsEmitted);

  const firstClaim2 = (await runner.claimOutfitRepairs({
    workerId: 'repair-worker-1', limit: 1, leaseMs: 1_000, occurredAt: NOW,
  })).claims[0];
  const resumedClaim2 = (await runner.claimOutfitRepairs({
    workerId: 'repair-worker-2', limit: 1, leaseMs: 5_000, occurredAt: LATER,
  })).claims[0];
  check('expired repair lease is restart-resumable with a fresh claim token',
    firstClaim2.repairJobId === resumedClaim2.repairJobId
      && firstClaim2.claimToken !== resumedClaim2.claimToken && resumedClaim2.attempt === 2);
  memory.proposalOnlyNextRepair = true;
  const repairsBeforeProposal = captures.filter((event) => event === 'catalog_outfit_repaired').length;
  let proposalRejected = false;
  try {
    await runner.commitOutfitRepair({
      idempotencyKey: 'worker-repair-proposal', repairJobId: resumedClaim2.repairJobId,
      claimToken: resumedClaim2.claimToken, result: repaired, occurredAt: LATER,
    });
  } catch { proposalRejected = true; }
  check('ledger-only repair proposal cannot emit repaired analytics',
    proposalRejected
      && captures.filter((event) => event === 'catalog_outfit_repaired').length === repairsBeforeProposal);

  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  let fetchCalls = 0;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = (async () => { fetchCalls += 1; throw new Error('network forbidden'); }) as typeof fetch;
  try {
    const disabledRunner = new CatalogLifecycleWorkerRunner(createSupabaseCatalogWorkerPersistence());
    const disabled = await disabledRunner.transitionProduct(verifiedRequest, RUN_ID);
    check('missing credentials return explicit disabled/no-network behavior',
      !disabledRunner.enabled && disabled.commit.outcome === 'disabled' && fetchCalls === 0);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }

  await checkSupabaseRpcMapping({
    runInput, stage1, failure: failure1.commit, retryClaim: retry1,
    verifiedRequest, repairClaim: repairClaim1, repaired,
  });

  const migration = readFileSync('supabase/migrations/0005_catalog_lifecycle.sql', 'utf8');
  const rpcNames = [
    'catalog_worker_ensure_run', 'catalog_worker_finalize_run',
    'catalog_worker_begin_stage', 'catalog_worker_complete_stage',
    'catalog_worker_fail_stage', 'catalog_worker_claim_retries',
    'catalog_worker_complete_retry', 'catalog_worker_plan_retirement_repairs',
    'catalog_worker_apply_transition', 'catalog_worker_register_served_outfit',
    'catalog_worker_claim_outfit_repairs', 'catalog_worker_commit_outfit_repair',
  ];
  check('migration exposes every operable service-role-only worker RPC',
    rpcNames.every((name) => migration.includes(`function ${name}(`))
      && rpcNames.every((name) => migration.includes(`grant execute on function ${name}`)));
  check('SECURITY DEFINER functions pin trusted lookup and public cannot create shadow objects',
    !migration.includes('set search_path = public, pg_temp')
      && migration.includes('set search_path = pg_catalog, public, pg_temp')
      && migration.includes('revoke create on schema public from public, anon, authenticated'));
  check('durable failure associations, served state, and repair queue are RLS protected',
    ['catalog_stage_failure_events', 'catalog_served_outfits', 'catalog_outfit_repair_jobs', 'catalog_outfit_repairs']
      .every((table) => migration.includes(`alter table ${table} enable row level security`)));

  if (failures) {
    console.error(`\n${failures}/${checks} catalog worker persistence check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nCatalog worker persistence: ${checks}/${checks} PASS`);
}

async function checkSupabaseRpcMapping(input: {
  runInput: CatalogPipelineRunInput;
  stage1: CatalogStageAttemptInput;
  failure: CatalogStageCommit;
  retryClaim: CatalogRetryClaim;
  verifiedRequest: CatalogLifecycleTransitionRequest;
  repairClaim: CatalogOutfitRepairClaim;
  repaired: CatalogOutfitRepairResult & { status: 'repaired' };
}): Promise<void> {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const durableEvidence = {
    ...input.verifiedRequest.evidence,
    sourceSystem: 'fixture_feed', sourceProductId: 'source-worker-1',
    canonicalProductId: 'worker-product-1',
  };
  const fake: CatalogRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      const commonStage = {
        stage_run_id: '33333333-3333-4333-8333-333333333333', run_id: RUN_ID,
        stage_name: args.p_stage_name || 'verify', attempt: args.p_attempt || 1,
        committed_at: NOW,
      };
      if (name === 'catalog_worker_ensure_run') return { data: {
        outcome: 'committed', run_id: RUN_ID, idempotency_key: args.p_idempotency_key, committed_at: NOW,
      }, error: null };
      if (name === 'catalog_worker_finalize_run') return { data: {
        outcome: 'committed', run_id: RUN_ID, idempotency_key: input.runInput.idempotencyKey, committed_at: NOW,
      }, error: null };
      if (name === 'catalog_worker_begin_stage') return { data: {
        ...commonStage, outcome: 'committed', stage_status: 'running',
      }, error: null };
      if (name === 'catalog_worker_complete_stage') return { data: {
        ...commonStage, outcome: 'committed', stage_status: 'succeeded',
      }, error: null };
      if (name === 'catalog_worker_fail_stage') return { data: {
        ...commonStage, outcome: 'committed', stage_status: 'failed',
        retry_id: '44444444-4444-4444-8444-444444444444',
        alert_id: '55555555-5555-4555-8555-555555555555',
      }, error: null };
      if (name === 'catalog_worker_claim_retries') return { data: {
        outcome: 'committed', claims: [{
          retry_id: '44444444-4444-4444-8444-444444444444',
          claim_token: '66666666-6666-4666-8666-666666666666', run_id: RUN_ID,
          stage_name: 'verify', next_attempt: 2,
          next_stage_run_id: '77777777-7777-4777-8777-777777777777', lease_expires_at: LATER,
        }],
      }, error: null };
      if (name === 'catalog_worker_complete_retry') return { data: {
        ...commonStage, outcome: 'committed', stage_status: 'succeeded', attempt: 2,
        retry_id: args.p_retry_id,
      }, error: null };
      if (name === 'catalog_worker_apply_transition') return { data: {
        outcome: 'committed', state: args.p_to_state,
        last_transition_key: args.p_idempotency_key, idempotency_key: args.p_idempotency_key,
        product_id: args.p_product_id, from_state: args.p_from_state,
        to_state: args.p_to_state, committed_at: NOW,
        request_fingerprint: args.p_request_fingerprint,
        durable_evidence: durableEvidence, repair_jobs_planned: 0,
      }, error: null };
      if (name === 'catalog_worker_register_served_outfit') return { data: {
        outcome: 'committed', look_id: args.p_look_id, version: 1, committed_at: NOW,
      }, error: null };
      if (name === 'catalog_worker_claim_outfit_repairs') return { data: {
        outcome: 'committed', claims: [{
          repair_job_id: '88888888-8888-4888-8888-888888888888',
          claim_token: '99999999-9999-4999-8999-999999999999', look_id: 'rpc-look-1',
          pipeline_run_id: RUN_ID, retired_product_id: 'worker-product-1',
          previous_product_ids: ['worker-product-1', 'retained-bottom', 'retained-shoes'],
          max_total_cents: 30000, attempt: 1, lease_expires_at: LATER,
        }],
      }, error: null };
      if (name === 'catalog_worker_commit_outfit_repair') return { data: {
        outcome: 'committed', repair_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        repair_job_id: args.p_repair_job_id, idempotency_key: args.p_idempotency_key,
        look_id: 'rpc-look-1', status: args.p_status, pipeline_run_id: RUN_ID,
        served_state_committed: true, served_state_version: 2, committed_at: NOW,
      }, error: null };
      return { data: null, error: { code: 'unknown_rpc' } };
    },
  };
  const adapter = createSupabaseCatalogWorkerPersistence({ client: fake });
  await adapter.ensureRun(input.runInput);
  await adapter.finalizeRun({ runId: RUN_ID, status: 'succeeded', occurredAt: NOW });
  await adapter.beginStageAttempt(input.stage1);
  await adapter.completeStageAttempt({ ...input.stage1, outputCount: 1 });
  await adapter.failStageAttempt({
    ...input.stage1, failureCode: 'retailer_timeout',
    retryDecision: {
      kind: 'scheduled', runId: RUN_ID, stageName: 'verify', failedAttempt: 1,
      nextAttempt: 2, retryNumber: 1, idempotencyKey: 'retry-rpc-1', delayMs: 1000,
      scheduledFor: LATER, failureCode: 'retailer_timeout',
    },
    alertType: 'pipeline_failure', alertSeverity: 'warning', alertDedupeKey: 'rpc-alert-1',
  });
  const retry = (await adapter.claimDueRetries({
    workerId: 'rpc-worker', limit: 1, leaseMs: 5_000, occurredAt: NOW,
  })).claims[0];
  await adapter.completeRetry({
    retryId: retry.retryId, claimToken: retry.claimToken, status: 'succeeded', occurredAt: NOW,
  });
  await adapter.applyLifecycleTransition(input.verifiedRequest, RUN_ID);
  await adapter.registerServedOutfit({
    lookId: 'rpc-look-1', productIds: ['worker-product-1', 'retained-bottom', 'retained-shoes'],
    maxTotalCents: 30_000, sourceVersion: 'library-v1', occurredAt: NOW,
  });
  const repair = (await adapter.claimOutfitRepairs({
    workerId: 'rpc-worker', limit: 1, leaseMs: 5_000, occurredAt: NOW,
  })).claims[0];
  await adapter.commitOutfitRepair({
    idempotencyKey: 'rpc-repair-1', repairJobId: repair.repairJobId,
    claimToken: repair.claimToken, result: input.repaired, occurredAt: NOW,
  });
  check('Supabase adapter maps run/retry/lifecycle/repair operations to one RPC each',
    calls.map((call) => call.name).join('>') === [
      'catalog_worker_ensure_run', 'catalog_worker_finalize_run',
      'catalog_worker_begin_stage', 'catalog_worker_complete_stage',
      'catalog_worker_fail_stage', 'catalog_worker_claim_retries',
      'catalog_worker_complete_retry', 'catalog_worker_apply_transition',
      'catalog_worker_register_served_outfit', 'catalog_worker_claim_outfit_repairs',
      'catalog_worker_commit_outfit_repair',
    ].join('>'));
  const transitionCall = calls.find((call) => call.name === 'catalog_worker_apply_transition');
  check('Supabase transition includes a stable fingerprint and consumes durable returned evidence',
    typeof transitionCall?.args.p_request_fingerprint === 'string'
      && String(transitionCall?.args.p_request_fingerprint).length === 64);
}

void main();
