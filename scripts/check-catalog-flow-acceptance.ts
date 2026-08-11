/**
 * Deterministic controlled catalog-flow acceptance test.
 *
 * No network, database, git, or deployment writes occur. The fixture traverses
 * the production lifecycle validator, strict publishability predicate, bounded
 * retry planner, replay ledger, retirement edge, and complete-outfit repair
 * boundary using an explicit frozen clock.
 */
import {
  catalogLifecycleTransitionKey,
  type CatalogLifecycleEvidence,
  type CatalogLifecycleState,
  type CatalogLifecycleTransitionRequest,
} from '../lib/catalog-lifecycle';
import {
  applyCatalogLifecycleRequest,
  classifyCatalogRetryReplay,
  planCatalogStageRetry,
  type CatalogLifecycleRuntimeLedgerEntry,
  type CatalogLifecycleRuntimeRecord,
  type CatalogRetryIdentity,
} from '../lib/catalog-pipeline-runtime';
import { repairOrSuppressCatalogOutfit } from '../lib/catalog-outfit-repair';
import {
  evaluateProductPublishability,
  type CatalogHealthSnapshot,
} from '../lib/catalog-publishability';
import type { Category, Product } from '../lib/types';

const RUN_ID = 'acceptance-run-001';
const NOW = '2026-08-10T18:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const CHECKED_AT = '2026-08-10T17:40:00.000Z';
const REQUIRED_PATH: CatalogLifecycleState[] = [
  'discovered',
  'normalized',
  'deduplicated',
  'enriched',
  'image_ready',
  'verified',
  'approved',
  'published',
];

let failures = 0;
function check(label: string, condition: boolean): void {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) failures += 1;
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || key.toLowerCase() === 'ref') url.searchParams.delete(key);
  }
  return url.toString();
}

function fixtureProduct(
  id: string,
  category: Category,
  priceCents: number,
  extra: Partial<Product> = {},
): Product {
  return {
    id,
    brand: 'Acceptance Atelier',
    name: `${category} fixture`,
    category,
    priceCents,
    currency: 'USD',
    retailer: 'Acceptance Shop',
    retailerUrl: `https://shop.example.com/products/${id}`,
    productUrl: `https://shop.example.com/products/${id}`,
    imageUrl: `https://cdn.example.com/${id}.jpg`,
    imageTransparentUrl: `/assets/cutouts/${id}.png`,
    imageStatus: 'cutout-ready',
    trusted: true,
    inStock: true,
    ...extra,
  };
}

function healthSnapshot(
  products: readonly Product[],
  outcomes: Partial<Record<string, 'available' | 'sold_out'>> = {},
): CatalogHealthSnapshot {
  const records = Object.fromEntries(products.map((product) => {
    const outcome = outcomes[product.id] || 'available';
    return [product.id, {
      outcome,
      checkedAt: CHECKED_AT,
      exactPdp: true,
      httpStatus: 200,
      catalogPriceCents: product.priceCents,
      livePriceCents: product.priceCents,
      url: product.productUrl,
    }];
  }));
  return {
    schemaVersion: 2,
    generatedAt: NOW,
    checked: products.length,
    unavailable: products.filter((product) => outcomes[product.id] === 'sold_out').map((product) => product.id),
    products: records,
  };
}

console.log('Controlled catalog flow acceptance');
console.log('==================================');

// Discovery fixture intentionally contains whitespace/tracking and a duplicate
// source row. Normalization removes presentation noise; dedupe resolves both
// source rows to one canonical product identity.
const discovered = {
  sourceSystem: 'fixture_feed',
  sourceProductId: 'source-top-001',
  brand: ' Acceptance Atelier ',
  title: '  Draped fixture top  ',
  url: 'https://shop.example.com/products/acceptance-top?utm_source=fixture&ref=test',
};
const normalizedUrl = canonicalUrl(discovered.url);
const duplicateSourceUrl = canonicalUrl('https://shop.example.com/products/acceptance-top?utm_campaign=duplicate');
const candidate = fixtureProduct('acceptance-top', 'top', 7_500, {
  brand: discovered.brand.trim(),
  name: discovered.title.trim().replace(/\s+/g, ' '),
  retailerUrl: normalizedUrl,
  productUrl: normalizedUrl,
  colors: ['black'],
  vibes: ['clean', 'night'],
});
const verificationHealth = healthSnapshot([candidate]);

let evidence: CatalogLifecycleEvidence = {
  sourceSystem: discovered.sourceSystem,
  sourceProductId: discovered.sourceProductId,
};
let record: CatalogLifecycleRuntimeRecord = {
  productId: candidate.id,
  state: 'discovered',
  evidence,
};
let ledger: CatalogLifecycleRuntimeLedgerEntry[] = [];
const visited: CatalogLifecycleState[] = ['discovered'];
const completedRequests: CatalogLifecycleTransitionRequest[] = [];
let replayCount = 0;

function advance(
  toState: CatalogLifecycleState,
  evidencePatch: CatalogLifecycleEvidence,
  at: string,
): void {
  const fromState = record.state;
  evidence = { ...evidence, ...evidencePatch };
  const request: CatalogLifecycleTransitionRequest = {
    productId: record.productId,
    fromState,
    toState,
    idempotencyKey: catalogLifecycleTransitionKey({
      operationId: `${RUN_ID}:${toState}`,
      productId: record.productId,
      fromState,
      toState,
    }),
    previousTransitionKey: record.lastTransitionKey,
    actorType: 'system',
    now: at,
    evidence,
  };
  const applied = applyCatalogLifecycleRequest(record, ledger, request);
  record = applied.record;
  ledger = applied.ledger;
  completedRequests.push(request);
  visited.push(toState);

  const replayed = applyCatalogLifecycleRequest(record, ledger, request);
  if (replayed.outcome === 'replay') replayCount += 1;
}

advance('normalized', { normalizedAt: '2026-08-10T17:01:00.000Z' }, '2026-08-10T17:01:00.000Z');
advance('deduplicated', {
  canonicalProductId: candidate.id,
  deduplicatedAt: '2026-08-10T17:03:00.000Z',
}, '2026-08-10T17:03:00.000Z');
advance('enriched', { enrichedAt: '2026-08-10T17:05:00.000Z' }, '2026-08-10T17:05:00.000Z');
advance('image_ready', { imageReadyAt: '2026-08-10T17:10:00.000Z' }, '2026-08-10T17:10:00.000Z');

const firstVerificationRetry = planCatalogStageRetry({
  runId: RUN_ID,
  stageName: 'verify',
  failedAttempt: 1,
  failureCode: 'retailer_timeout',
  retryable: true,
  now: '2026-08-10T17:20:00.000Z',
  policy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 2_000 },
});
const repeatedVerificationRetry = planCatalogStageRetry({
  runId: RUN_ID,
  stageName: 'verify',
  failedAttempt: 1,
  failureCode: 'retailer_timeout',
  retryable: true,
  now: '2026-08-10T17:20:00.000Z',
  policy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 2_000 },
});

const strictBeforeVerified = evaluateProductPublishability(candidate, {
  health: verificationHealth,
  freshnessPolicy: 'require-fresh',
  requireExplicitStock: true,
  requireExplicitTrust: true,
  now: NOW_MS,
});
check('strict publication evidence is positive before verified transition', strictBeforeVerified.publishable);
advance('verified', {
  verifiedAt: CHECKED_AT,
  priceVerifiedAt: CHECKED_AT,
  lastCheckedAt: CHECKED_AT,
  catalogPriceCents: candidate.priceCents,
  verifiedPriceCents: candidate.priceCents,
  currency: candidate.currency,
  verifiedCurrency: candidate.currency,
  linkHealthStatus: 'available',
  inStock: true,
  trusted: true,
}, '2026-08-10T17:41:00.000Z');
advance('approved', {
  moderationStatus: 'auto_approved',
  approvedAt: '2026-08-10T17:45:00.000Z',
}, '2026-08-10T17:45:00.000Z');
advance('published', { publishedAt: '2026-08-10T17:50:00.000Z' }, '2026-08-10T17:50:00.000Z');

check('normalization produces a clean exact PDP URL', normalizedUrl === 'https://shop.example.com/products/acceptance-top');
check('dedupe resolves tracked duplicate rows to one canonical URL', normalizedUrl === duplicateSourceUrl);
check('candidate traverses every required publish lifecycle state in order', visited.join('>') === REQUIRED_PATH.join('>'));
check('every transition replay is an idempotent ledger replay', replayCount === REQUIRED_PATH.length - 1 && ledger.length === REQUIRED_PATH.length - 1);
check(
  'replaying the completed run causes no additional state or ledger mutation',
  completedRequests.every((request) => applyCatalogLifecycleRequest(record, ledger, request).outcome === 'replay')
    && record.state === 'published',
);
check('published product still passes the strict serving predicate', evaluateProductPublishability(candidate, {
  health: verificationHealth,
  freshnessPolicy: 'require-fresh',
  requireExplicitStock: true,
  requireExplicitTrust: true,
  now: NOW_MS,
}).publishable);

if (firstVerificationRetry.kind !== 'scheduled' || repeatedVerificationRetry.kind !== 'scheduled') {
  check('retryable first failure schedules a retry', false);
} else {
  const retryIdentity: CatalogRetryIdentity = {
    idempotencyKey: firstVerificationRetry.idempotencyKey,
    runId: firstVerificationRetry.runId,
    stageName: firstVerificationRetry.stageName,
    retryNumber: firstVerificationRetry.retryNumber,
  };
  const repeatedIdentity: CatalogRetryIdentity = {
    idempotencyKey: repeatedVerificationRetry.idempotencyKey,
    runId: repeatedVerificationRetry.runId,
    stageName: repeatedVerificationRetry.stageName,
    retryNumber: repeatedVerificationRetry.retryNumber,
  };
  check('retryable first failure schedules bounded attempt two', firstVerificationRetry.nextAttempt === 2 && firstVerificationRetry.delayMs === 1_000);
  check('duplicate retry delivery is deterministic and classifies as replay',
    JSON.stringify(firstVerificationRetry) === JSON.stringify(repeatedVerificationRetry)
      && classifyCatalogRetryReplay(retryIdentity, repeatedIdentity).kind === 'replay');
}

const secondFailure = planCatalogStageRetry({
  runId: 'acceptance-exhaustion-run',
  stageName: 'image_ready',
  failedAttempt: 2,
  failureCode: 'cutout_provider_timeout',
  retryable: true,
  now: '2026-08-10T17:20:00.000Z',
  policy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 1_500 },
});
const exhausted = planCatalogStageRetry({
  runId: 'acceptance-exhaustion-run',
  stageName: 'image_ready',
  failedAttempt: 3,
  failureCode: 'cutout_provider_timeout',
  retryable: true,
  now: '2026-08-10T17:20:00.000Z',
  policy: { maxAttempts: 3, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 1_500 },
});
check('retry backoff is capped and never schedules beyond max attempts',
  secondFailure.kind === 'scheduled' && secondFailure.delayMs === 1_500
    && exhausted.kind === 'exhausted' && exhausted.attemptsUsed === 3);
check('non-retryable failures are terminal immediately', planCatalogStageRetry({
  runId: RUN_ID,
  stageName: 'approve',
  failedAttempt: 1,
  failureCode: 'policy_rejected',
  retryable: false,
  now: NOW,
}).kind === 'terminal');
check('malformed retry identities fail closed instead of creating duplicate attempt one', (() => {
  try {
    planCatalogStageRetry({
      runId: RUN_ID,
      stageName: 'verify',
      failedAttempt: 0,
      failureCode: 'retailer_timeout',
      retryable: true,
      now: NOW,
    });
    return false;
  } catch {
    return true;
  }
})());

// The product becomes unavailable after publication. The same strict boundary
// withholds it, the lifecycle records a reasoned retirement, and a complete
// outfit is repaired from fresh same-category inventory or suppressed.
const bottom = fixtureProduct('acceptance-bottom', 'bottom', 8_000);
const shoes = fixtureProduct('acceptance-shoes', 'shoes', 9_000);
const replacementTop = fixtureProduct('acceptance-top-replacement', 'top', 8_500, {
  colors: ['black'],
  vibes: ['clean', 'night'],
});
const unavailableHealth = healthSnapshot(
  [candidate, bottom, shoes, replacementTop],
  { [candidate.id]: 'sold_out' },
);
const unavailableEvaluation = evaluateProductPublishability(candidate, {
  health: unavailableHealth,
  freshnessPolicy: 'require-fresh',
  requireExplicitStock: true,
  requireExplicitTrust: true,
  now: NOW_MS,
});
check('fresh sold-out evidence removes the published product from serving',
  !unavailableEvaluation.publishable && unavailableEvaluation.failures.includes('known_unavailable'));

advance('retired', {
  linkHealthStatus: 'sold_out',
  inStock: false,
  retiredAt: '2026-08-10T17:58:00.000Z',
  reasonCode: 'retailer_sold_out',
}, '2026-08-10T17:58:00.000Z');
check('unavailable published product reaches a reasoned retired state',
  record.state === 'retired' && record.evidence.reasonCode === 'retailer_sold_out');

const affectedOutfit: Partial<Record<Category, Product>> = {
  top: candidate,
  bottom,
  shoes,
};
const repaired = repairOrSuppressCatalogOutfit({
  items: affectedOutfit,
  candidateProducts: [candidate, bottom, shoes, replacementTop],
  health: unavailableHealth,
  now: NOW_MS,
  maxTotalCents: 30_000,
  retiredProductIds: new Set([candidate.id]),
  compatibilityScore: (product) => product.colors?.includes('black') ? 10 : 0,
});
check('affected complete outfit is repaired with a fresh same-category product',
  repaired.status === 'repaired'
    && repaired.items.top?.id === replacementTop.id
    && repaired.totalCents <= 30_000
    && repaired.replacements[0]?.removedProductId === candidate.id);
check('repaired outfit contains only strict fresh-positive products', repaired.status === 'repaired'
  && Object.values(repaired.items).every((product) => evaluateProductPublishability(product, {
    health: unavailableHealth,
    freshnessPolicy: 'require-fresh',
    requireExplicitStock: true,
    requireExplicitTrust: true,
    now: NOW_MS,
  }).publishable));

const suppressed = repairOrSuppressCatalogOutfit({
  items: affectedOutfit,
  candidateProducts: [candidate, bottom, shoes],
  health: unavailableHealth,
  now: NOW_MS,
  maxTotalCents: 30_000,
  retiredProductIds: new Set([candidate.id]),
});
check('affected complete outfit is suppressed when no verified repair exists',
  suppressed.status === 'suppressed'
    && suppressed.reason === 'missing_verified_replacement'
    && suppressed.missingCategories.includes('top'));

console.log('\nEvidence summary');
console.log(JSON.stringify({
  lifecyclePath: visited,
  transitionLedgerEntries: ledger.length,
  transitionReplays: replayCount,
  retry: firstVerificationRetry,
  retryExhaustion: exhausted,
  retiredState: record.state,
  repairedOutfit: repaired.status === 'repaired'
    ? { replacements: repaired.replacements, totalCents: repaired.totalCents }
    : repaired,
  suppressionFallback: suppressed.status,
}, null, 2));

if (failures) {
  console.error(`\n${failures} controlled catalog-flow acceptance check(s) failed.`);
  process.exit(1);
}
console.log('\nControlled catalog flow: PASS');
