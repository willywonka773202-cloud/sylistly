/**
 * Pure catalog lifecycle contract shared by ingestion, review, and release
 * workers. No function in this module reads the clock, environment, database,
 * or network; callers must pass all evidence explicitly.
 */

import { verificationAgeMs } from './verification-freshness';

export const CATALOG_LIFECYCLE_STATES = [
  'discovered',
  'normalized',
  'deduplicated',
  'enriched',
  'image_ready',
  'verified',
  'approved',
  'published',
  'retired',
  'quarantined',
  'rejected',
] as const;

export type CatalogLifecycleState = typeof CATALOG_LIFECYCLE_STATES[number];

export type CatalogLifecycleActorType = 'system' | 'operator' | 'source' | 'migration';

export type CatalogModerationStatus =
  | 'pending'
  | 'auto_approved'
  | 'approved'
  | 'changes_requested'
  | 'quarantined'
  | 'rejected'
  | 'legacy_review_required'
  | 'not_required';

export interface CatalogLifecycleEvidence {
  sourceSystem?: string | null;
  sourceProductId?: string | null;
  canonicalProductId?: string | null;
  normalizedAt?: string | null;
  deduplicatedAt?: string | null;
  enrichedAt?: string | null;
  imageReadyAt?: string | null;
  verifiedAt?: string | null;
  priceVerifiedAt?: string | null;
  lastCheckedAt?: string | null;
  catalogPriceCents?: number | null;
  verifiedPriceCents?: number | null;
  originalPriceCents?: number | null;
  currency?: string | null;
  verifiedCurrency?: string | null;
  linkHealthStatus?: string | null;
  inStock?: boolean | null;
  trusted?: boolean | null;
  moderationStatus?: CatalogModerationStatus | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  retiredAt?: string | null;
  reasonCode?: string | null;
  failureCode?: string | null;
}

export interface CatalogLifecycleTransitionRequest {
  productId: string;
  fromState: CatalogLifecycleState;
  toState: CatalogLifecycleState;
  idempotencyKey: string;
  previousTransitionKey?: string | null;
  actorType: CatalogLifecycleActorType;
  now: string;
  maxVerificationAgeMs?: number;
  evidence: CatalogLifecycleEvidence;
}

export type CatalogLifecycleTransitionErrorCode =
  | 'invalid_transition'
  | 'missing_product_id'
  | 'missing_transition_key'
  | 'transition_key_reused'
  | 'invalid_now'
  | 'missing_source_identity'
  | 'missing_canonical_id'
  | 'missing_stage_timestamp'
  | 'missing_verification'
  | 'stale_verification'
  | 'price_mismatch'
  | 'comparison_price_invalid'
  | 'currency_mismatch'
  | 'missing_approval'
  | 'missing_publication_timestamp'
  | 'missing_retirement_timestamp'
  | 'missing_reason';

export interface CatalogLifecycleTransitionError {
  code: CatalogLifecycleTransitionErrorCode;
  message: string;
}

export interface CatalogLifecycleTransitionValidation {
  ok: boolean;
  idempotent: boolean;
  errors: CatalogLifecycleTransitionError[];
}

export interface CatalogLifecycleLedgerIdentity {
  idempotencyKey: string;
  productId: string;
  fromState: CatalogLifecycleState;
  toState: CatalogLifecycleState;
}

export type CatalogLifecycleReplay =
  | { kind: 'new' }
  | { kind: 'replay'; existing: CatalogLifecycleLedgerIdentity }
  | { kind: 'conflict'; existing: CatalogLifecycleLedgerIdentity };

export const DEFAULT_CATALOG_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000;

const NEXT_STATES: Readonly<Record<CatalogLifecycleState, readonly CatalogLifecycleState[]>> = {
  discovered: ['normalized', 'quarantined', 'rejected'],
  normalized: ['deduplicated', 'quarantined', 'rejected'],
  deduplicated: ['enriched', 'quarantined', 'rejected'],
  enriched: ['image_ready', 'quarantined', 'rejected'],
  image_ready: ['verified', 'quarantined', 'rejected'],
  verified: ['approved', 'quarantined', 'rejected'],
  approved: ['published', 'quarantined', 'rejected'],
  published: ['retired', 'quarantined', 'rejected'],
  retired: ['discovered'],
  quarantined: ['discovered', 'retired', 'rejected'],
  rejected: ['discovered'],
};

const SOURCE_REQUIRED = new Set<CatalogLifecycleState>([
  'normalized', 'deduplicated', 'enriched', 'image_ready', 'verified', 'approved', 'published',
]);
const CANONICAL_REQUIRED = new Set<CatalogLifecycleState>([
  'deduplicated', 'enriched', 'image_ready', 'verified', 'approved', 'published',
]);
const VERIFIED_REQUIRED = new Set<CatalogLifecycleState>(['verified', 'approved', 'published']);
const APPROVED_REQUIRED = new Set<CatalogLifecycleState>(['approved', 'published']);

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parsedTime(value: string | null | undefined): number | null {
  if (!hasText(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameLedgerIdentity(
  left: CatalogLifecycleLedgerIdentity,
  right: CatalogLifecycleLedgerIdentity,
): boolean {
  return left.idempotencyKey === right.idempotencyKey
    && left.productId === right.productId
    && left.fromState === right.fromState
    && left.toState === right.toState;
}

export function isCatalogLifecycleState(value: unknown): value is CatalogLifecycleState {
  return typeof value === 'string'
    && (CATALOG_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export function allowedCatalogLifecycleTargets(
  state: CatalogLifecycleState,
): readonly CatalogLifecycleState[] {
  return NEXT_STATES[state];
}

export function isCatalogLifecycleTransitionAllowed(
  fromState: CatalogLifecycleState,
  toState: CatalogLifecycleState,
): boolean {
  return fromState === toState || NEXT_STATES[fromState].includes(toState);
}

/**
 * Stable key for a caller-owned operation. Retrying the same operation produces
 * the same key; a new operation id is required for a genuinely new transition.
 */
export function catalogLifecycleTransitionKey(input: {
  operationId: string;
  productId: string;
  fromState: CatalogLifecycleState;
  toState: CatalogLifecycleState;
}): string {
  return [
    'catalog-lifecycle-v1',
    input.operationId,
    input.productId,
    input.fromState,
    input.toState,
  ].map((part) => encodeURIComponent(part.trim())).join(':');
}

/**
 * Compares a requested transition with the row already stored under its unique
 * idempotency key. Identical evidence is a replay; key reuse for a different
 * product or edge is a conflict and must fail closed.
 */
export function classifyCatalogLifecycleReplay(
  existing: CatalogLifecycleLedgerIdentity | null | undefined,
  requested: CatalogLifecycleLedgerIdentity,
): CatalogLifecycleReplay {
  if (!existing) return { kind: 'new' };
  return sameLedgerIdentity(existing, requested)
    ? { kind: 'replay', existing }
    : { kind: 'conflict', existing };
}

function stageTimestamp(
  state: CatalogLifecycleState,
  evidence: CatalogLifecycleEvidence,
): string | null | undefined {
  if (state === 'normalized') return evidence.normalizedAt;
  if (state === 'deduplicated') return evidence.deduplicatedAt;
  if (state === 'enriched') return evidence.enrichedAt;
  if (state === 'image_ready') return evidence.imageReadyAt;
  return null;
}

/** Validate one transition against the same invariants enforced by migration 0005. */
export function validateCatalogLifecycleTransition(
  request: CatalogLifecycleTransitionRequest,
): CatalogLifecycleTransitionValidation {
  const errors: CatalogLifecycleTransitionError[] = [];
  const idempotent = request.fromState === request.toState;

  if (!hasText(request.productId)) {
    errors.push({ code: 'missing_product_id', message: 'A stable product id is required.' });
  }

  if (idempotent) return { ok: errors.length === 0, idempotent: true, errors };

  if (!isCatalogLifecycleTransitionAllowed(request.fromState, request.toState)) {
    errors.push({
      code: 'invalid_transition',
      message: `Lifecycle transition ${request.fromState} -> ${request.toState} is not allowed.`,
    });
  }
  if (!hasText(request.idempotencyKey)) {
    errors.push({ code: 'missing_transition_key', message: 'A transition idempotency key is required.' });
  } else if (request.idempotencyKey === request.previousTransitionKey) {
    errors.push({
      code: 'transition_key_reused',
      message: 'A completed transition key cannot identify a different state change.',
    });
  }

  const now = parsedTime(request.now);
  if (now === null) {
    errors.push({ code: 'invalid_now', message: 'An explicit valid ISO timestamp is required.' });
  }

  const evidence = request.evidence;
  if (
    SOURCE_REQUIRED.has(request.toState)
    && (!hasText(evidence.sourceSystem) || !hasText(evidence.sourceProductId))
  ) {
    errors.push({
      code: 'missing_source_identity',
      message: `${request.toState} requires stable source system and source product ids.`,
    });
  }
  if (CANONICAL_REQUIRED.has(request.toState) && !hasText(evidence.canonicalProductId)) {
    errors.push({
      code: 'missing_canonical_id',
      message: `${request.toState} requires a stable canonical product id.`,
    });
  }

  const requiredStageTime = stageTimestamp(request.toState, evidence);
  if (
    ['normalized', 'deduplicated', 'enriched', 'image_ready'].includes(request.toState)
    && parsedTime(requiredStageTime) === null
  ) {
    errors.push({
      code: 'missing_stage_timestamp',
      message: `${request.toState} requires its completed-at timestamp.`,
    });
  }

  if (VERIFIED_REQUIRED.has(request.toState)) {
    const verifiedAt = parsedTime(evidence.verifiedAt);
    const priceVerifiedAt = parsedTime(evidence.priceVerifiedAt);
    const lastCheckedAt = parsedTime(evidence.lastCheckedAt);
    const hasPositiveEvidence = verifiedAt !== null
      && priceVerifiedAt !== null
      && lastCheckedAt !== null
      && Number.isInteger(evidence.verifiedPriceCents)
      && Number(evidence.verifiedPriceCents) >= 0
      && evidence.linkHealthStatus === 'available'
      && evidence.inStock === true
      && evidence.trusted === true;
    if (!hasPositiveEvidence) {
      errors.push({
        code: 'missing_verification',
        message: `${request.toState} requires timestamped positive price, link, stock, and trust evidence.`,
      });
    } else if (now !== null) {
      const maximumAge = Number.isFinite(request.maxVerificationAgeMs)
        ? Math.max(0, Number(request.maxVerificationAgeMs))
        : DEFAULT_CATALOG_VERIFICATION_AGE_MS;
      const verificationAges = [
        verificationAgeMs(evidence.verifiedAt, now),
        verificationAgeMs(evidence.priceVerifiedAt, now),
        verificationAgeMs(evidence.lastCheckedAt, now),
      ];
      if (verificationAges.some((age) => age === null || age > maximumAge)) {
        errors.push({
          code: 'stale_verification',
          message: `${request.toState} requires verification evidence inside the freshness window and bounded clock skew.`,
        });
      }
    }

    if (
      Number.isInteger(evidence.catalogPriceCents)
      && Number.isInteger(evidence.verifiedPriceCents)
      && evidence.catalogPriceCents !== evidence.verifiedPriceCents
    ) {
      errors.push({
        code: 'price_mismatch',
        message: 'The display/current price must match the positively verified price.',
      });
    }
    if (
      Number.isInteger(evidence.originalPriceCents)
      && Number.isInteger(evidence.verifiedPriceCents)
      && Number(evidence.originalPriceCents) < Number(evidence.verifiedPriceCents)
    ) {
      errors.push({
        code: 'comparison_price_invalid',
        message: 'An original/comparison price cannot be lower than the verified current price.',
      });
    }
    if (
      hasText(evidence.currency)
      && hasText(evidence.verifiedCurrency)
      && evidence.currency.toUpperCase() !== evidence.verifiedCurrency.toUpperCase()
    ) {
      errors.push({
        code: 'currency_mismatch',
        message: 'The display currency must match the verified currency.',
      });
    }
  }

  if (
    APPROVED_REQUIRED.has(request.toState)
    && (
      parsedTime(evidence.approvedAt) === null
      || !['approved', 'auto_approved'].includes(evidence.moderationStatus || '')
    )
  ) {
    errors.push({
      code: 'missing_approval',
      message: `${request.toState} requires a timestamped human or policy approval.`,
    });
  }
  if (request.toState === 'published' && parsedTime(evidence.publishedAt) === null) {
    errors.push({
      code: 'missing_publication_timestamp',
      message: 'Published products require a publication timestamp.',
    });
  }
  if (request.toState === 'retired' && parsedTime(evidence.retiredAt) === null) {
    errors.push({
      code: 'missing_retirement_timestamp',
      message: 'Retired products require a retirement timestamp.',
    });
  }
  if (
    ['retired', 'quarantined', 'rejected'].includes(request.toState)
    && !hasText(evidence.reasonCode)
    && !hasText(evidence.failureCode)
  ) {
    errors.push({
      code: 'missing_reason',
      message: `${request.toState} transitions require a reason or failure code.`,
    });
  }

  return { ok: errors.length === 0, idempotent: false, errors };
}
