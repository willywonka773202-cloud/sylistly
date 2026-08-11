import {
  classifyCatalogLifecycleReplay,
  validateCatalogLifecycleTransition,
  type CatalogLifecycleEvidence,
  type CatalogLifecycleLedgerIdentity,
  type CatalogLifecycleState,
  type CatalogLifecycleTransitionRequest,
} from './catalog-lifecycle';

/**
 * Small pure worker-side primitives for applying lifecycle edges and planning
 * durable retries. Persistence adapters can write the returned records to the
 * tables introduced by migration 0005; this module never reads a clock,
 * database, environment variable, or network resource itself.
 */

export interface CatalogLifecycleRuntimeRecord {
  productId: string;
  state: CatalogLifecycleState;
  evidence: CatalogLifecycleEvidence;
  lastTransitionKey?: string | null;
}

export interface CatalogLifecycleRuntimeLedgerEntry extends CatalogLifecycleLedgerIdentity {
  occurredAt: string;
}

export interface CatalogLifecycleRuntimeResult {
  outcome: 'applied' | 'replay' | 'noop';
  record: CatalogLifecycleRuntimeRecord;
  ledger: CatalogLifecycleRuntimeLedgerEntry[];
}

/**
 * Apply one lifecycle request against an in-memory record/ledger using the
 * exact validator used by production workers. Checking the ledger before the
 * current state is deliberate: a redelivered completed operation is a replay,
 * even though the product has already advanced beyond `fromState`.
 */
export function applyCatalogLifecycleRequest(
  record: CatalogLifecycleRuntimeRecord,
  ledger: readonly CatalogLifecycleRuntimeLedgerEntry[],
  request: CatalogLifecycleTransitionRequest,
): CatalogLifecycleRuntimeResult {
  const requested: CatalogLifecycleLedgerIdentity = {
    idempotencyKey: request.idempotencyKey,
    productId: request.productId,
    fromState: request.fromState,
    toState: request.toState,
  };
  const existing = ledger.find((entry) => entry.idempotencyKey === request.idempotencyKey);
  const replay = classifyCatalogLifecycleReplay(existing, requested);

  if (replay.kind === 'conflict') {
    throw new Error(`Catalog lifecycle idempotency conflict for ${request.idempotencyKey}.`);
  }
  if (replay.kind === 'replay') {
    return { outcome: 'replay', record, ledger: [...ledger] };
  }
  if (request.productId !== record.productId) {
    throw new Error(`Lifecycle request product ${request.productId} does not match ${record.productId}.`);
  }
  if (request.fromState !== record.state) {
    throw new Error(`Lifecycle state mismatch: record is ${record.state}, request starts at ${request.fromState}.`);
  }

  const validation = validateCatalogLifecycleTransition(request);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => `${error.code}: ${error.message}`).join('; '));
  }
  if (validation.idempotent) {
    return { outcome: 'noop', record, ledger: [...ledger] };
  }

  return {
    outcome: 'applied',
    record: {
      productId: record.productId,
      state: request.toState,
      evidence: { ...record.evidence, ...request.evidence },
      lastTransitionKey: request.idempotencyKey,
    },
    ledger: [
      ...ledger,
      {
        ...requested,
        occurredAt: request.now,
      },
    ],
  };
}

export interface CatalogRetryPolicy {
  /** Includes the first attempt. A value of 3 permits two scheduled retries. */
  maxAttempts: number;
  baseDelayMs: number;
  multiplier: number;
  maxDelayMs: number;
}

export const DEFAULT_CATALOG_RETRY_POLICY: Readonly<CatalogRetryPolicy> = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  multiplier: 2,
  maxDelayMs: 30_000,
};

export interface CatalogRetryIdentity {
  idempotencyKey: string;
  runId: string;
  stageName: string;
  retryNumber: number;
}

export type CatalogRetryReplay =
  | { kind: 'new' }
  | { kind: 'replay'; existing: CatalogRetryIdentity }
  | { kind: 'conflict'; existing: CatalogRetryIdentity };

export type CatalogRetryDecision =
  | {
      kind: 'scheduled';
      runId: string;
      stageName: string;
      failedAttempt: number;
      nextAttempt: number;
      retryNumber: number;
      idempotencyKey: string;
      delayMs: number;
      scheduledFor: string;
      failureCode: string;
    }
  | {
      kind: 'exhausted' | 'terminal';
      runId: string;
      stageName: string;
      attemptsUsed: number;
      maxAttempts: number;
      failureCode: string;
    };

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function nonnegativeInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function normalizedRetryPolicy(policy: Partial<CatalogRetryPolicy> | undefined): CatalogRetryPolicy {
  const maxAttempts = positiveInteger(policy?.maxAttempts ?? NaN, DEFAULT_CATALOG_RETRY_POLICY.maxAttempts);
  const baseDelayMs = nonnegativeInteger(policy?.baseDelayMs ?? NaN, DEFAULT_CATALOG_RETRY_POLICY.baseDelayMs);
  const multiplier = Number.isFinite(policy?.multiplier) && Number(policy?.multiplier) >= 1
    ? Number(policy?.multiplier)
    : DEFAULT_CATALOG_RETRY_POLICY.multiplier;
  const maxDelayMs = Math.max(
    baseDelayMs,
    nonnegativeInteger(policy?.maxDelayMs ?? NaN, DEFAULT_CATALOG_RETRY_POLICY.maxDelayMs),
  );
  return { maxAttempts, baseDelayMs, multiplier, maxDelayMs };
}

export function catalogPipelineRetryKey(input: {
  runId: string;
  stageName: string;
  retryNumber: number;
}): string {
  if (!input.runId.trim() || !input.stageName.trim() || !Number.isInteger(input.retryNumber) || input.retryNumber < 1) {
    throw new Error('Catalog retry identity requires a run, stage, and positive retry number.');
  }
  return ['catalog-retry-v1', input.runId, input.stageName, String(input.retryNumber)]
    .map((part) => encodeURIComponent(part.trim()))
    .join(':');
}

export function classifyCatalogRetryReplay(
  existing: CatalogRetryIdentity | null | undefined,
  requested: CatalogRetryIdentity,
): CatalogRetryReplay {
  if (!existing) return { kind: 'new' };
  return existing.idempotencyKey === requested.idempotencyKey
    && existing.runId === requested.runId
    && existing.stageName === requested.stageName
    && existing.retryNumber === requested.retryNumber
    ? { kind: 'replay', existing }
    : { kind: 'conflict', existing };
}

/**
 * Plan (but do not wait for or persist) the next durable retry. The returned
 * key, delay, and timestamp are deterministic for the same explicit inputs.
 */
export function planCatalogStageRetry(input: {
  runId: string;
  stageName: string;
  failedAttempt: number;
  failureCode: string;
  retryable: boolean;
  now: string;
  policy?: Partial<CatalogRetryPolicy>;
}): CatalogRetryDecision {
  if (!input.runId.trim() || !input.stageName.trim() || !input.failureCode.trim()) {
    throw new Error('Catalog retry planning requires run, stage, and failure identities.');
  }
  if (!Number.isInteger(input.failedAttempt) || input.failedAttempt < 1) {
    throw new Error('Catalog retry planning requires a positive failed-attempt number.');
  }
  const failedAttempt = input.failedAttempt;
  const policy = normalizedRetryPolicy(input.policy);
  if (!input.retryable) {
    return {
      kind: 'terminal',
      runId: input.runId,
      stageName: input.stageName,
      attemptsUsed: failedAttempt,
      maxAttempts: policy.maxAttempts,
      failureCode: input.failureCode,
    };
  }
  if (failedAttempt >= policy.maxAttempts) {
    return {
      kind: 'exhausted',
      runId: input.runId,
      stageName: input.stageName,
      attemptsUsed: failedAttempt,
      maxAttempts: policy.maxAttempts,
      failureCode: input.failureCode,
    };
  }

  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('Catalog retry planning requires a valid explicit ISO timestamp.');
  const retryNumber = failedAttempt;
  const delayMs = Math.min(
    policy.maxDelayMs,
    Math.round(policy.baseDelayMs * (policy.multiplier ** Math.max(0, retryNumber - 1))),
  );
  return {
    kind: 'scheduled',
    runId: input.runId,
    stageName: input.stageName,
    failedAttempt,
    nextAttempt: failedAttempt + 1,
    retryNumber,
    idempotencyKey: catalogPipelineRetryKey({
      runId: input.runId,
      stageName: input.stageName,
      retryNumber,
    }),
    delayMs,
    scheduledFor: new Date(nowMs + delayMs).toISOString(),
    failureCode: input.failureCode,
  };
}
