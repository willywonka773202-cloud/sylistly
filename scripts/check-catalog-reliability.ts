/** Focused checks for the catalog publishability boundary and health schema. */
import { readFileSync } from 'node:fs';
import {
  DEFAULT_LINK_FRESHNESS_MS,
  evaluateProductPublishability,
  type CatalogHealthSnapshot,
} from '../lib/catalog-publishability';
import {
  catalogOpsAuthConfigured,
  catalogOpsTokenMatches,
  createCatalogOpsSession,
  hasCatalogOpsAccess,
  verifyCatalogOpsSession,
} from '../lib/catalog-ops-auth';
import { evaluateCatalogPipeline } from '../lib/catalog-pipeline-guard';
import { getCatalogOpsStatus, sanitizeCatalogOpsMessage } from '../lib/catalog-ops-status';
import {
  CATALOG_LIFECYCLE_STATES,
  catalogLifecycleTransitionKey,
  classifyCatalogLifecycleReplay,
  isCatalogLifecycleState,
  isCatalogLifecycleTransitionAllowed,
  validateCatalogLifecycleTransition,
  type CatalogLifecycleEvidence,
  type CatalogLifecycleTransitionRequest,
} from '../lib/catalog-lifecycle';
import { rowForProduct } from '../lib/catalog-upsert';
import type { Product } from '../lib/types';
import { VERIFICATION_MAX_FUTURE_SKEW_MS } from '../lib/verification-freshness';
import { buildHealthSnapshot, classifyHtmlOutcome, isExactPdpUrl } from './check-link-health.mjs';

let failures = 0;
function check(label: string, condition: boolean): void {
  if (condition) console.log(`PASS ${label}`);
  else {
    console.error(`FAIL ${label}`);
    failures += 1;
  }
}

const product = (extra: Partial<Product> = {}): Product => ({
  id: 'test-product',
  brand: 'Test Brand',
  name: 'Test Shirt',
  category: 'top',
  priceCents: 5_000,
  currency: 'USD',
  retailer: 'Test Shop',
  retailerUrl: 'https://shop.example.com/products/test-shirt',
  productUrl: 'https://shop.example.com/products/test-shirt',
  imageUrl: 'https://cdn.example.com/test-shirt.jpg',
  trusted: true,
  inStock: true,
  ...extra,
});

const NOW = Date.parse('2026-08-10T18:00:00.000Z');
const freshHealth = (outcome: 'available' | 'reachable' | 'sold_out' | 'dead' | 'blocked' | 'error' = 'available'): CatalogHealthSnapshot => ({
  schemaVersion: 2,
  generatedAt: '2026-08-10T18:00:00.000Z',
  checked: 1,
  unavailable: outcome === 'sold_out' || outcome === 'dead' ? ['test-product'] : [],
  products: {
    'test-product': {
      outcome,
      checkedAt: '2026-08-10T17:30:00.000Z',
      exactPdp: true,
      httpStatus: outcome === 'dead' ? 404 : 200,
    },
  },
});

console.log('Catalog reliability checks');
console.log('==========================');

check(
  'exact, trusted, in-stock PDP with a fresh available check publishes',
  evaluateProductPublishability(product(), {
    health: freshHealth(),
    freshnessPolicy: 'require-fresh',
    now: NOW,
  }).publishable,
);
check(
  'search/category URL is rejected as not an exact PDP',
  evaluateProductPublishability(product({
    productUrl: 'https://shop.example.com/search?q=shirt',
    retailerUrl: 'https://shop.example.com/search?q=shirt',
  })).failures.includes('not_exact_pdp'),
);
check(
  'explicitly untrusted product is rejected',
  evaluateProductPublishability(product({ trusted: false })).failures.includes('untrusted'),
);
check(
  'explicitly out-of-stock product is rejected',
  evaluateProductPublishability(product({ inStock: false })).failures.includes('out_of_stock'),
);
check(
  'legacy unavailable id remains a hard failure',
  evaluateProductPublishability(product(), { health: { unavailable: ['test-product'] } })
    .failures.includes('known_unavailable'),
);
check(
  'missing health evidence warns but preserves backward-compatible publication',
  (() => {
    const result = evaluateProductPublishability(product());
    return result.publishable && result.warnings.includes('health_missing');
  })(),
);
check(
  'strict release policy rejects missing health evidence',
  !evaluateProductPublishability(product(), { freshnessPolicy: 'require-fresh', now: NOW }).publishable,
);
check(
  'fresh product-embedded database evidence satisfies the same strict boundary',
  evaluateProductPublishability(product({
    availabilityState: 'available',
    lastVerifiedAt: '2026-08-10T17:30:00.000Z',
  }), { freshnessPolicy: 'require-fresh', now: NOW }).publishable,
);
check(
  'stale product-embedded evidence fails closed',
  !evaluateProductPublishability(product({
    availabilityState: 'available',
    lastVerifiedAt: new Date(NOW - DEFAULT_LINK_FRESHNESS_MS - 1).toISOString(),
  }), { freshnessPolicy: 'require-fresh', now: NOW }).publishable,
);
check(
  'strict release policy rejects a stale availability check',
  (() => {
    const health = freshHealth();
    health.products!['test-product'].checkedAt = new Date(NOW - DEFAULT_LINK_FRESHNESS_MS - 1).toISOString();
    const result = evaluateProductPublishability(product(), {
      health,
      freshnessPolicy: 'require-fresh',
      now: NOW,
    });
    return !result.publishable && result.failures.includes('health_stale');
  })(),
);
check(
  'strict release policy rejects materially future-dated availability evidence',
  (() => {
    const health = freshHealth();
    health.products!['test-product'].checkedAt = new Date(
      NOW + VERIFICATION_MAX_FUTURE_SKEW_MS + 1,
    ).toISOString();
    const result = evaluateProductPublishability(product(), {
      health,
      freshnessPolicy: 'require-fresh',
      now: NOW,
    });
    return !result.publishable
      && result.failures.includes('health_stale')
      && result.evidence.ageMs === null;
  })(),
);
check(
  'strict release policy tolerates bounded producer clock skew',
  (() => {
    const health = freshHealth();
    health.products!['test-product'].checkedAt = new Date(
      NOW + VERIFICATION_MAX_FUTURE_SKEW_MS,
    ).toISOString();
    return evaluateProductPublishability(product(), {
      health,
      freshnessPolicy: 'require-fresh',
      now: NOW,
    }).publishable;
  })(),
);
check(
  'fresh blocked check is unverified under strict release policy',
  evaluateProductPublishability(product(), {
    health: freshHealth('blocked'),
    freshnessPolicy: 'require-fresh',
    now: NOW,
  }).failures.includes('health_unverified'),
);
check(
  'generic reachable 200 is unverified under strict release policy',
  evaluateProductPublishability(product(), {
    health: freshHealth('reachable'),
    freshnessPolicy: 'require-fresh',
    now: NOW,
  }).failures.includes('health_unverified'),
);
check(
  'a fresh check of a non-PDP URL cannot satisfy strict freshness',
  (() => {
    const health = freshHealth();
    health.products!['test-product'].exactPdp = false;
    return evaluateProductPublishability(product(), {
      health,
      freshnessPolicy: 'require-fresh',
      now: NOW,
    }).failures.includes('health_unverified');
  })(),
);
check(
  'fresh sold-out outcome is rejected even without strict freshness',
  evaluateProductPublishability(product(), { health: freshHealth('sold_out'), now: NOW })
    .failures.includes('known_unavailable'),
);
check(
  'ingestion upsert does not forge last_checked_at evidence',
  !Object.hasOwn(rowForProduct(product()), 'last_checked_at'),
);

check('link checker recognizes a product PDP', isExactPdpUrl('https://shop.example.com/products/test-shirt'));
check('link checker rejects a retailer homepage', !isExactPdpUrl('https://shop.example.com/'));
check('link checker rejects a search URL', !isExactPdpUrl('https://shop.example.com/search?q=shirt'));
check('generic HTTP 200 HTML remains stock-unknown/reachable', classifyHtmlOutcome('<html><h1>Test Shirt</h1></html>') === 'reachable');
check('structured schema.org InStock evidence verifies available', classifyHtmlOutcome('{"availability":"https://schema.org/InStock"}') === 'available');
check('structured schema.org OutOfStock evidence verifies sold out', classifyHtmlOutcome('{"availability":"https://schema.org/OutOfStock"}') === 'sold_out');

const snapshot = buildHealthSnapshot(
  [product(), product({ id: 'search-result', productUrl: 'https://shop.example.com/search?q=shirt' })],
  [
    { id: 'test-product', exactPdp: true, trusted: true, inStock: true },
    { id: 'search-result', exactPdp: false, trusted: true, inStock: true },
  ],
  [
    {
      id: 'test-product',
      outcome: 'available',
      checkedAt: '2026-08-10T17:30:00.000Z',
      exactPdp: true,
      httpStatus: 200,
      url: 'https://shop.example.com/products/test-shirt',
    },
    {
      id: 'search-result',
      outcome: 'dead',
      checkedAt: '2026-08-10T17:31:00.000Z',
      exactPdp: false,
      httpStatus: 404,
      url: 'https://shop.example.com/search',
    },
  ],
  '2026-08-10T17:00:00.000Z',
  '2026-08-10T18:00:00.000Z',
);

check('health snapshot remains backward compatible', snapshot.checked === 2 && Array.isArray(snapshot.unavailable));
check('health snapshot stores typed per-product evidence', snapshot.products['test-product'].outcome === 'available');
check('health snapshot reports exact-PDP and fresh coverage', snapshot.coverage.exactPdpProducts === 1 && snapshot.coverage.freshCoveragePct === 100);
check(
  'health snapshot distinguishes candidate review from the strict served set',
  snapshot.coverage.reviewCandidates === 1
    && snapshot.coverage.candidateReviewCoveragePct === 100
    && snapshot.coverage.servedPublishedProducts === 1
    && snapshot.coverage.servedFreshCoveragePct === 100,
);
check('health snapshot gates dead outcomes', snapshot.unavailable.includes('search-result'));
const emptySnapshot = buildHealthSnapshot([], [], [], '2026-08-10T17:00:00.000Z', '2026-08-10T18:00:00.000Z');
check('empty inventory cannot falsely pass the 95% freshness target',
  emptySnapshot.coverage.meetsFreshCoverageTarget === false
    && emptySnapshot.coverage.meetsServedFreshCoverageTarget === false);
const reachableSnapshot = buildHealthSnapshot(
  [product()],
  [{ id: 'test-product', exactPdp: true, trusted: true, inStock: true }],
  [{
    id: 'test-product',
    outcome: 'reachable',
    checkedAt: '2026-08-10T17:30:00.000Z',
    exactPdp: true,
    httpStatus: 200,
    url: 'https://shop.example.com/products/test-shirt',
  }],
  '2026-08-10T17:00:00.000Z',
  '2026-08-10T18:00:00.000Z',
);
check(
  'reachable 200 is checked but contributes zero candidate-positive or served coverage',
  reachableSnapshot.coverage.freshCheckedPublishableCandidates === 1
    && reachableSnapshot.coverage.freshAvailablePublishableCandidates === 0
    && reachableSnapshot.coverage.freshCoveragePct === 0
    && reachableSnapshot.coverage.servedPublishedProducts === 0
    && reachableSnapshot.coverage.servedFreshCoveragePct === 0,
);

// Internal ops access never puts the token in a URL/browser-readable session.
const authEnv = {
  CATALOG_OPS_TOKEN: 'test-operator-token-at-least-24-characters',
  CATALOG_OPS_SESSION_SECRET: 'test-session-signing-secret-at-least-32-characters',
};
const authNow = new Date('2026-08-10T18:00:00.000Z');
const session = createCatalogOpsSession(authEnv, authNow);
check('catalog ops auth requires a sufficiently strong configured token', catalogOpsAuthConfigured(authEnv));
check('catalog ops access fails closed when the server token is missing', !catalogOpsAuthConfigured({}) && !hasCatalogOpsAccess({}, {}, authNow));
check('catalog ops token uses exact constant-time comparison semantics', catalogOpsTokenMatches(authEnv.CATALOG_OPS_TOKEN, authEnv) && !catalogOpsTokenMatches(`${authEnv.CATALOG_OPS_TOKEN}x`, authEnv));
check('catalog ops signed session verifies inside its TTL', Boolean(session && verifyCatalogOpsSession(session, authEnv, new Date(authNow.getTime() + 60_000))));
check('catalog ops signed session expires after eight hours', Boolean(session && !verifyCatalogOpsSession(session, authEnv, new Date(authNow.getTime() + 9 * 60 * 60 * 1000))));
check('catalog ops signed session rejects tampering', Boolean(session && !verifyCatalogOpsSession(`${session}x`, authEnv, authNow)));
check('catalog ops API bearer authorization is supported without URL secrets', hasCatalogOpsAccess({ authorization: `Bearer ${authEnv.CATALOG_OPS_TOKEN}` }, authEnv, authNow));

const healthyPipelineInput = {
  baselineCount: 900,
  baselineServedCount: 360,
  candidateCount: 920,
  candidateReviewCount: 600,
  servedCount: 370,
  servedStrictlyPublishableCount: 370,
  healthSchemaVersion: 2,
  candidateReviewCoveragePct: 61.7,
  targetCandidateReviewCoveragePct: 95,
  servedFreshCoveragePct: 100,
  targetServedFreshCoveragePct: 95,
  sourceFailureCount: 0,
  maximumShrinkPct: 10,
  now: authNow,
} as const;
const candidateDecision = evaluateCatalogPipeline({ ...healthyPipelineInput, mode: 'candidate-only', verificationPassed: true });
check('candidate-only pipeline can be ready but never publish', candidateDecision.decision === 'candidate-ready' && candidateDecision.eligible && !candidateDecision.canPublish);
const unverifiedRelease = evaluateCatalogPipeline({ ...healthyPipelineInput, mode: 'release', verificationPassed: false });
check('release request cannot publish before verification', unverifiedRelease.decision === 'release-eligible' && !unverifiedRelease.canPublish);
const verifiedRelease = evaluateCatalogPipeline({ ...healthyPipelineInput, mode: 'release', verificationPassed: true });
check('explicit verified release can cross the publish boundary', verifiedRelease.decision === 'publishable' && verifiedRelease.canPublish);
check(
  'shrink guard blocks a catastrophic candidate reduction',
  evaluateCatalogPipeline({ ...healthyPipelineInput, candidateCount: 700, candidateReviewCount: 600 }).failures.some((failure) => failure.code === 'shrink_guard'),
);
check(
  'served-set shrink blocks a catastrophic strict inventory reduction',
  evaluateCatalogPipeline({ ...healthyPipelineInput, servedCount: 100, servedStrictlyPublishableCount: 100 }).failures.some((failure) => failure.code === 'served_shrink_guard'),
);
check(
  'reachable-only served coverage cannot pass the release gate',
  evaluateCatalogPipeline({ ...healthyPipelineInput, servedFreshCoveragePct: 0 }).failures.some((failure) => failure.code === 'served_freshness'),
);
check(
  'partial candidate review does not block a wholly strict served subset',
  (() => {
    const decision = evaluateCatalogPipeline({
      ...healthyPipelineInput,
      baselineCount: 905,
      candidateCount: 905,
      baselineServedCount: 238,
      candidateReviewCount: 367,
      servedCount: 238,
      servedStrictlyPublishableCount: 238,
      candidateReviewCoveragePct: 64.9,
      servedFreshCoveragePct: 100,
      mode: 'release',
      verificationPassed: true,
    });
    return decision.canPublish
      && decision.warnings.some((warning) => warning.code === 'candidate_review_coverage')
      && !decision.failures.some((failure) => failure.code === 'served_integrity');
  })(),
);
check(
  'pipeline decision is idempotent for the same evidence and time',
  JSON.stringify(evaluateCatalogPipeline({ ...healthyPipelineInput, mode: 'candidate-only' }))
    === JSON.stringify(evaluateCatalogPipeline({ ...healthyPipelineInput, mode: 'candidate-only' })),
);

// Durable product lifecycle transitions are pure, ordered, and replay-safe.
const transitionEvidence: CatalogLifecycleEvidence = {
  sourceSystem: 'retailer_feed',
  sourceProductId: 'retailer-123',
  canonicalProductId: 'canonical-123',
  normalizedAt: '2026-08-10T16:00:00.000Z',
  deduplicatedAt: '2026-08-10T16:05:00.000Z',
  enrichedAt: '2026-08-10T16:10:00.000Z',
  imageReadyAt: '2026-08-10T16:15:00.000Z',
  verifiedAt: '2026-08-10T17:30:00.000Z',
  priceVerifiedAt: '2026-08-10T17:30:00.000Z',
  lastCheckedAt: '2026-08-10T17:30:00.000Z',
  catalogPriceCents: 5_000,
  verifiedPriceCents: 5_000,
  currency: 'USD',
  verifiedCurrency: 'USD',
  linkHealthStatus: 'available',
  inStock: true,
  trusted: true,
  moderationStatus: 'approved',
  approvedAt: '2026-08-10T17:40:00.000Z',
  publishedAt: '2026-08-10T17:45:00.000Z',
};
const transitionRequest = (
  fromState: CatalogLifecycleTransitionRequest['fromState'],
  toState: CatalogLifecycleTransitionRequest['toState'],
  evidence: CatalogLifecycleEvidence = transitionEvidence,
): CatalogLifecycleTransitionRequest => ({
  productId: 'canonical-123',
  fromState,
  toState,
  idempotencyKey: `test:${fromState}:${toState}`,
  actorType: 'system',
  now: '2026-08-10T18:00:00.000Z',
  evidence,
});

check(
  'lifecycle exposes the exact durable state vocabulary',
  CATALOG_LIFECYCLE_STATES.join('>')
    === 'discovered>normalized>deduplicated>enriched>image_ready>verified>approved>published>retired>quarantined>rejected'
    && isCatalogLifecycleState('image_ready')
    && !isCatalogLifecycleState('image-ready'),
);
check(
  'ordered lifecycle edges are accepted',
  [
    ['discovered', 'normalized'],
    ['normalized', 'deduplicated'],
    ['deduplicated', 'enriched'],
    ['enriched', 'image_ready'],
    ['image_ready', 'verified'],
    ['verified', 'approved'],
    ['approved', 'published'],
    ['published', 'retired'],
  ].every(([from, to]) => isCatalogLifecycleTransitionAllowed(
    from as CatalogLifecycleTransitionRequest['fromState'],
    to as CatalogLifecycleTransitionRequest['toState'],
  )),
);
check(
  'lifecycle cannot skip from discovery to publication',
  validateCatalogLifecycleTransition(transitionRequest('discovered', 'published'))
    .errors.some((error) => error.code === 'invalid_transition'),
);
check(
  'normalization requires source identity and stage timestamp',
  (() => {
    const result = validateCatalogLifecycleTransition(transitionRequest('discovered', 'normalized', {}));
    return ['missing_source_identity', 'missing_stage_timestamp'].every((code) => (
      result.errors.some((error) => error.code === code)
    ));
  })(),
);
check(
  'fresh positive evidence permits image-ready to verified',
  validateCatalogLifecycleTransition(transitionRequest('image_ready', 'verified')).ok,
);
check(
  'stale evidence cannot become verified',
  validateCatalogLifecycleTransition(transitionRequest('image_ready', 'verified', {
    ...transitionEvidence,
    verifiedAt: '2026-08-08T17:30:00.000Z',
    priceVerifiedAt: '2026-08-08T17:30:00.000Z',
    lastCheckedAt: '2026-08-08T17:30:00.000Z',
  })).errors.some((error) => error.code === 'stale_verification'),
);
check(
  'materially future-dated evidence cannot become verified',
  (() => {
    const futureTimestamp = new Date(NOW + VERIFICATION_MAX_FUTURE_SKEW_MS + 1).toISOString();
    return validateCatalogLifecycleTransition(transitionRequest('image_ready', 'verified', {
      ...transitionEvidence,
      verifiedAt: futureTimestamp,
      priceVerifiedAt: futureTimestamp,
      lastCheckedAt: futureTimestamp,
    })).errors.some((error) => error.code === 'stale_verification');
  })(),
);
check(
  'lifecycle verification tolerates bounded producer clock skew',
  (() => {
    const futureTimestamp = new Date(NOW + VERIFICATION_MAX_FUTURE_SKEW_MS).toISOString();
    return validateCatalogLifecycleTransition(transitionRequest('image_ready', 'verified', {
      ...transitionEvidence,
      verifiedAt: futureTimestamp,
      priceVerifiedAt: futureTimestamp,
      lastCheckedAt: futureTimestamp,
    })).ok;
  })(),
);
check(
  'display price cannot diverge from verified price',
  validateCatalogLifecycleTransition(transitionRequest('image_ready', 'verified', {
    ...transitionEvidence,
    catalogPriceCents: 4_999,
  })).errors.some((error) => error.code === 'price_mismatch'),
);
check(
  'publication requires explicit moderation and publication time',
  (() => {
    const result = validateCatalogLifecycleTransition(transitionRequest('approved', 'published', {
      ...transitionEvidence,
      moderationStatus: 'pending',
      publishedAt: null,
    }));
    return result.errors.some((error) => error.code === 'missing_approval')
      && result.errors.some((error) => error.code === 'missing_publication_timestamp');
  })(),
);
check(
  'quarantine requires an auditable reason',
  validateCatalogLifecycleTransition(transitionRequest('published', 'quarantined'))
    .errors.some((error) => error.code === 'missing_reason'),
);
check(
  'an already-applied state request is an idempotent no-op',
  (() => {
    const result = validateCatalogLifecycleTransition({
      ...transitionRequest('published', 'published', {}),
      idempotencyKey: '',
    });
    return result.ok && result.idempotent && result.errors.length === 0;
  })(),
);
const stableTransitionKey = catalogLifecycleTransitionKey({
  operationId: 'run-42:stage-verified',
  productId: 'canonical-123',
  fromState: 'image_ready',
  toState: 'verified',
});
check(
  'transition key generation is deterministic and delimiter-safe',
  stableTransitionKey === catalogLifecycleTransitionKey({
    operationId: 'run-42:stage-verified',
    productId: 'canonical-123',
    fromState: 'image_ready',
    toState: 'verified',
  }) && stableTransitionKey.includes('run-42%3Astage-verified'),
);
const requestedLedgerIdentity = {
  idempotencyKey: stableTransitionKey,
  productId: 'canonical-123',
  fromState: 'image_ready',
  toState: 'verified',
} as const;
check(
  'identical transition-key retries classify as replay',
  classifyCatalogLifecycleReplay(requestedLedgerIdentity, requestedLedgerIdentity).kind === 'replay',
);
check(
  'transition-key reuse for another edge classifies as conflict',
  classifyCatalogLifecycleReplay(
    { ...requestedLedgerIdentity, toState: 'verified' },
    { ...requestedLedgerIdentity, toState: 'approved' },
  ).kind === 'conflict',
);
const lifecycleMigrationSource = readFileSync('supabase/migrations/0005_catalog_lifecycle.sql', 'utf8');
check(
  'lifecycle migration contains durable variant, run, stage, retry, review, audit, and alert ledgers',
  [
    'product_variants',
    'catalog_pipeline_runs',
    'catalog_pipeline_stage_runs',
    'catalog_pipeline_retries',
    'catalog_review_decisions',
    'product_lifecycle_events',
    'catalog_alerts',
  ].every((table) => lifecycleMigrationSource.includes(`create table if not exists ${table}`)),
);
check(
  'lifecycle migration gates every serving reader to fresh positive evidence',
  lifecycleMigrationSource.includes("lifecycle_state = 'published'")
    && lifecycleMigrationSource.includes('products public read published')
    && lifecycleMigrationSource.includes('catalog_published_products')
    && lifecycleMigrationSource.includes("link_health_status = 'available'")
    && lifecycleMigrationSource.includes("verified_at >= now() - interval '24 hours'")
    && lifecycleMigrationSource.includes("price_verified_at >= now() - interval '24 hours'")
    && lifecycleMigrationSource.includes("verified_at <= now() + interval '5 minutes'")
    && lifecycleMigrationSource.includes("price_verified_at <= now() + interval '5 minutes'")
    && lifecycleMigrationSource.includes("last_checked_at <= now() + interval '5 minutes'"),
);
check(
  'legacy backfill never invents an original or verified price',
  !lifecycleMigrationSource.includes('original_price_cents = coalesce(original_price_cents, price_cents)')
    && lifecycleMigrationSource.includes("'verificationEvidenceBackfilled', false"),
);

const opsStatus = getCatalogOpsStatus({ now: authNow, env: {} });
check('catalog ops status uses static fallback when Supabase is unavailable', opsStatus.dataMode === 'static-fallback');
check('catalog ops status exposes explicit candidate/review/served/withheld/retired sets', ['discovered', 'cutout', 'candidate', 'review', 'served', 'withheld', 'retired'].every((id) => opsStatus.stages.some((stage) => stage.id === id)));
check('catalog ops status exposes all operator queues', ['stale', 'unavailable', 'broken', 'review'].every((id) => opsStatus.queues.some((queue) => queue.id === id)));
check('catalog ops status never serves more products than it reviews', opsStatus.health.servedPublishedProducts <= opsStatus.health.reviewCandidates);
check('catalog ops served set is entirely strict or empty', opsStatus.health.servedPublishedProducts === 0 || (opsStatus.health.servedStrictPublishableProducts === opsStatus.health.servedPublishedProducts && opsStatus.health.servedFreshCoveragePct === 100));
check('catalog ops status exposes source evidence and both shrink guards', opsStatus.sources.length > 0 && Number.isFinite(opsStatus.shrinkGuard.minimumAllowedCount) && Number.isFinite(opsStatus.servingShrinkGuard.minimumAllowedCount));
const sanitizedOpsError = sanitizeCatalogOpsMessage(
  'Search failed at https://example.com?q=secret API_KEY=abc123 Bearer token-value sk-secretvalue',
  'fallback',
);
check(
  'catalog ops status redacts raw URLs and credentials',
  !sanitizedOpsError.includes('example.com')
    && !sanitizedOpsError.includes('abc123')
    && !sanitizedOpsError.includes('token-value')
    && !sanitizedOpsError.includes('sk-secretvalue'),
);
const statusRouteSource = readFileSync('app/api/catalog-ops/status/route.ts', 'utf8');
const sessionRouteSource = readFileSync('app/api/catalog-ops/session/route.ts', 'utf8');
const robotsSource = readFileSync('app/robots.ts', 'utf8');
const automationWorkflowSource = readFileSync('.github/workflows/auto-expand.yml', 'utf8');
check('catalog ops status API is private/no-store and checks configured auth', statusRouteSource.includes('private, no-store') && statusRouteSource.includes('catalogOpsAuthConfigured'));
check('catalog ops session API is private/no-store and HTTP-only', sessionRouteSource.includes('private, no-store') && sessionRouteSource.includes('httpOnly: true'));
check('catalog ops routes are explicitly disallowed from robots', robotsSource.includes("'/catalog-ops'"));
check(
  'scheduled automation enters the same gated release path instead of remaining candidate-only',
  automationWorkflowSource.includes("cron: '17 9 * * *'")
    && automationWorkflowSource.includes("github.event_name == 'schedule'")
    && automationWorkflowSource.includes('--baseline-served-count=')
    && automationWorkflowSource.indexOf('npm run health:sweep') < automationWorkflowSource.indexOf('npm run library:generate')
    && automationWorkflowSource.indexOf('npm run library:generate') < automationWorkflowSource.indexOf('Evaluate candidate gates')
    && automationWorkflowSource.includes("if: steps.final.outputs.can_publish == 'true'"),
);

if (failures) {
  console.error(`\n${failures} catalog reliability check(s) failed.`);
  process.exit(1);
}

console.log('\nOverall: PASS');
