import { createHash } from 'node:crypto';
import {
  analyticsEventProperties,
  type CanonicalAnalyticsEvent,
} from './analytics-events';
import type { CatalogLifecycleTransitionRequest } from './catalog-lifecycle';
import type { CatalogOutfitRepairResult } from './catalog-outfit-repair';
import type { CatalogLifecycleRuntimeResult } from './catalog-pipeline-runtime';
import type { CatalogPipelineDecision } from './catalog-pipeline-guard';
import { captureServerAnalytics } from './server-analytics';

/**
 * A deliberately small, allowlisted payload for catalog job analytics. Raw
 * source rows, retailer URLs, credentials, and failure messages never enter
 * this boundary.
 */
export interface CatalogJobAnalyticsEvent {
  event: CanonicalAnalyticsEvent;
  distinctId: string;
  properties: Record<string, unknown>;
}

export type CatalogAnalyticsCapture = (
  event: CanonicalAnalyticsEvent,
  distinctId: string,
  properties: Record<string, unknown>,
) => Promise<unknown>;

const PIPELINE_FAILURE_CODES = new Set([
  'candidate_nonempty',
  'shrink_guard',
  'served_nonempty',
  'served_subset',
  'served_integrity',
  'typed_health',
  'served_freshness',
  'served_shrink_guard',
  'source_failures',
  'runner_exception',
  'verification_failed',
]);
const PIPELINE_STAGES = new Set([
  'baseline',
  'candidate',
  'health',
  'repair',
  'guard',
  'verify',
  'publish',
]);

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function safeEntityId(value: string, kind: 'product' | 'look'): string {
  const normalized = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(normalized)
    ? normalized
    : `${kind}-${digest(normalized)}`;
}

function safePipelineRunId(value: string): string {
  const normalized = value.trim();
  if (
    /^github-\d+-\d+$/.test(normalized)
    || /^local-\d+$/.test(normalized)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  ) return normalized;
  return `run-${digest(normalized)}`;
}

function safePipelineStage(value: string | undefined): string {
  return value && PIPELINE_STAGES.has(value) ? value : 'guard';
}

function safePipelineFailureCode(value: string): string {
  return PIPELINE_FAILURE_CODES.has(value) ? value : 'runner_exception';
}

function envelope(
  event: CanonicalAnalyticsEvent,
  distinctId: string,
  properties: Record<string, unknown>,
): CatalogJobAnalyticsEvent {
  return {
    event,
    distinctId,
    properties: analyticsEventProperties({ event }, properties),
  };
}

const LIFECYCLE_EVENTS: Readonly<Partial<Record<
  CatalogLifecycleTransitionRequest['toState'],
  CanonicalAnalyticsEvent
>>> = {
  verified: 'catalog_product_verified',
  published: 'catalog_product_published',
  retired: 'catalog_product_retired',
};

/**
 * Build analytics only from a newly committed lifecycle ledger edge. The
 * explicit commit acknowledgement prevents a health snapshot or candidate
 * build from masquerading as durable publication/retirement state. Replays
 * and idempotent no-ops never emit a second event.
 */
export function catalogLifecycleAnalyticsEvent(input: {
  request: CatalogLifecycleTransitionRequest;
  result: CatalogLifecycleRuntimeResult;
  durableLedgerCommitted: boolean;
}): CatalogJobAnalyticsEvent | null {
  const { request, result } = input;
  const event = LIFECYCLE_EVENTS[request.toState];
  const ledgerContainsEdge = result.ledger.some((entry) => (
    entry.idempotencyKey === request.idempotencyKey
    && entry.productId === request.productId
    && entry.fromState === request.fromState
    && entry.toState === request.toState
  ));
  if (!input.durableLedgerCommitted || !event || result.outcome !== 'applied' || !ledgerContainsEdge) {
    return null;
  }

  const productId = safeEntityId(request.productId, 'product');

  return envelope(event, `catalog-product:${productId}`, {
    $insert_id: `catalog-lifecycle-${digest(request.idempotencyKey)}`,
    surface: 'catalog-lifecycle',
    source: 'product_lifecycle_events',
    product_id: productId,
    from_state: request.fromState,
    to_state: request.toState,
    actor_type: request.actorType,
    outcome: result.outcome,
    occurred_at: request.now,
  });
}

/** Emit only a completed repair, with the stable look and resulting products. */
export function catalogOutfitRepairAnalyticsEvent(input: {
  lookId: string;
  result: CatalogOutfitRepairResult;
  pipelineRunId?: string;
}): CatalogJobAnalyticsEvent | null {
  const rawLookId = input.lookId.trim();
  if (!rawLookId || input.result.status !== 'repaired') return null;
  const lookId = safeEntityId(rawLookId, 'look');

  const productIds = Object.values(input.result.items)
    .map((product) => product?.id)
    .filter((id): id is string => Boolean(id))
    .map((id) => safeEntityId(id, 'product'))
    .sort();
  if (!productIds.length) return null;

  const removedProductIds = [
    ...input.result.replacements.map((replacement) => replacement.removedProductId),
    ...input.result.removedOptionalProductIds,
  ].filter((id): id is string => Boolean(id))
    .map((id) => safeEntityId(id, 'product'))
    .sort();
  const replacementProductIds = input.result.replacements
    .map((replacement) => replacement.replacementProductId)
    .map((id) => safeEntityId(id, 'product'))
    .sort();
  const pipelineRunId = input.pipelineRunId
    ? safePipelineRunId(input.pipelineRunId)
    : undefined;

  return envelope('catalog_outfit_repaired', `catalog-look:${lookId}`, {
    $insert_id: `catalog-repair-${digest(JSON.stringify([
      pipelineRunId || '',
      lookId,
      productIds,
      removedProductIds,
      replacementProductIds,
    ]))}`,
    surface: 'catalog-repair',
    source: 'catalog_outfit_repair',
    look_id: lookId,
    product_ids: productIds,
    removed_product_ids: removedProductIds,
    replacement_product_ids: replacementProductIds,
    replacement_count: input.result.replacements.length,
    removed_optional_count: input.result.removedOptionalProductIds.length,
    ...(pipelineRunId ? { pipeline_run_id: pipelineRunId } : {}),
    outcome: input.result.status,
  });
}

/** Derive one safe failure event from a blocked release-gate decision. */
export function catalogPipelineFailureAnalyticsEvent(input: {
  decision: CatalogPipelineDecision;
  pipelineRunId: string;
  stage?: string;
}): CatalogJobAnalyticsEvent | null {
  const rawPipelineRunId = input.pipelineRunId.trim();
  if (input.decision.eligible || !input.decision.failures.length || !rawPipelineRunId) return null;

  const pipelineRunId = safePipelineRunId(rawPipelineRunId);
  const stage = safePipelineStage(input.stage);
  const errorCodes = [...new Set(input.decision.failures
    .map((failure) => safePipelineFailureCode(failure.code)))].sort();
  return envelope('catalog_pipeline_failed', `catalog-pipeline:${pipelineRunId}`, {
    $insert_id: `catalog-pipeline-${digest(JSON.stringify([pipelineRunId, stage, errorCodes]))}`,
    surface: 'catalog-pipeline',
    source: 'catalog_ops_guard',
    pipeline_run_id: pipelineRunId,
    stage,
    error_code: errorCodes[0] || 'pipeline_blocked',
    error_codes: errorCodes,
    failure_count: input.decision.failures.length,
    failed_gate_count: input.decision.gates.filter((gate) => !gate.passed).length,
    mode: input.decision.mode,
    decision: input.decision.decision,
    occurred_at: input.decision.generatedAt,
  });
}

/** A bounded fallback for runner exceptions that occur before a gate exists. */
export function catalogPipelineRuntimeFailureAnalyticsEvent(input: {
  pipelineRunId: string;
  occurredAt: string;
  stage?: string;
  errorCode?: 'runner_exception' | 'verification_failed';
}): CatalogJobAnalyticsEvent | null {
  const rawPipelineRunId = input.pipelineRunId.trim();
  if (!rawPipelineRunId) return null;
  const pipelineRunId = safePipelineRunId(rawPipelineRunId);
  const stage = safePipelineStage(input.stage);
  const errorCode = input.errorCode || 'runner_exception';
  return envelope('catalog_pipeline_failed', `catalog-pipeline:${pipelineRunId}`, {
    $insert_id: `catalog-pipeline-${digest(JSON.stringify([
      pipelineRunId,
      stage,
      errorCode,
    ]))}`,
    surface: 'catalog-pipeline',
    source: 'catalog_ops_runner',
    pipeline_run_id: pipelineRunId,
    stage,
    error_code: errorCode,
    error_codes: [errorCode],
    failure_count: 1,
    occurred_at: input.occurredAt,
  });
}

/**
 * Stable, non-secret run identity. GitHub run/attempt values are numeric; local
 * dry runs fall back to the explicit decision timestamp.
 */
export function catalogPipelineAnalyticsRunId(input: {
  generatedAt: string;
  githubRunId?: string;
  githubRunAttempt?: string;
}): string {
  const runId = /^\d+$/.test(input.githubRunId || '') ? input.githubRunId : '';
  const attempt = /^\d+$/.test(input.githubRunAttempt || '') ? input.githubRunAttempt : '1';
  if (runId) return `github-${runId}-${attempt}`;

  const generatedMs = Date.parse(input.generatedAt);
  return `local-${Number.isFinite(generatedMs) ? generatedMs : 'unknown'}`;
}

/**
 * Best-effort by construction: the default server capture is a no-op without
 * a PostHog public ingestion key, and analytics failures never escape a job.
 */
export async function emitCatalogJobAnalytics(
  event: CatalogJobAnalyticsEvent | null,
  capture: CatalogAnalyticsCapture = captureServerAnalytics,
): Promise<boolean> {
  if (!event) return false;
  try {
    await capture(event.event, event.distinctId, event.properties);
    return true;
  } catch {
    return false;
  }
}

/** One-call post-commit boundary for a durable lifecycle worker. */
export async function emitCommittedCatalogLifecycleAnalytics(
  input: Parameters<typeof catalogLifecycleAnalyticsEvent>[0],
  capture: CatalogAnalyticsCapture = captureServerAnalytics,
): Promise<boolean> {
  return emitCatalogJobAnalytics(catalogLifecycleAnalyticsEvent(input), capture);
}

/** One-call boundary for a persisted outfit-repair worker. */
export async function emitCatalogOutfitRepairAnalytics(
  input: Parameters<typeof catalogOutfitRepairAnalyticsEvent>[0],
  capture: CatalogAnalyticsCapture = captureServerAnalytics,
): Promise<boolean> {
  return emitCatalogJobAnalytics(catalogOutfitRepairAnalyticsEvent(input), capture);
}

/** One-call boundary for the catalog release guard. */
export async function emitCatalogPipelineFailureAnalytics(
  input: Parameters<typeof catalogPipelineFailureAnalyticsEvent>[0],
  capture: CatalogAnalyticsCapture = captureServerAnalytics,
): Promise<boolean> {
  return emitCatalogJobAnalytics(catalogPipelineFailureAnalyticsEvent(input), capture);
}

/** One-call fallback for pre-decision catalog runner exceptions. */
export async function emitCatalogPipelineRuntimeFailureAnalytics(
  input: Parameters<typeof catalogPipelineRuntimeFailureAnalyticsEvent>[0],
  capture: CatalogAnalyticsCapture = captureServerAnalytics,
): Promise<boolean> {
  return emitCatalogJobAnalytics(catalogPipelineRuntimeFailureAnalyticsEvent(input), capture);
}
