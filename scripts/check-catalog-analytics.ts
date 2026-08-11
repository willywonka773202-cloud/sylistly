/** Focused, network-free checks for catalog job/lifecycle analytics. */
import { readFileSync } from 'node:fs';
import {
  catalogLifecycleAnalyticsEvent,
  catalogOutfitRepairAnalyticsEvent,
  catalogPipelineAnalyticsRunId,
  catalogPipelineFailureAnalyticsEvent,
  catalogPipelineRuntimeFailureAnalyticsEvent,
  emitCommittedCatalogLifecycleAnalytics,
  emitCatalogJobAnalytics,
  type CatalogJobAnalyticsEvent,
} from '../lib/catalog-job-analytics';
import { emitCatalogGuardFailureAnalytics } from './catalog-ops-pipeline';
import {
  isCanonicalAnalyticsEvent,
} from '../lib/analytics-events';
import type {
  CatalogLifecycleEvidence,
  CatalogLifecycleState,
  CatalogLifecycleTransitionRequest,
} from '../lib/catalog-lifecycle';
import type { CatalogOutfitRepairResult } from '../lib/catalog-outfit-repair';
import { evaluateCatalogPipeline } from '../lib/catalog-pipeline-guard';
import {
  applyCatalogLifecycleRequest,
  type CatalogLifecycleRuntimeRecord,
} from '../lib/catalog-pipeline-runtime';
import type { Product } from '../lib/types';

let failures = 0;
let checks = 0;
function check(label: string, condition: boolean): void {
  checks += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) failures += 1;
}

const NOW = '2026-08-10T18:00:00.000Z';
const evidence: CatalogLifecycleEvidence = {
  sourceSystem: 'fixture_feed secret-source-system-must-not-emit',
  sourceProductId: 'raw-source-row-must-not-emit',
  canonicalProductId: 'catalog-product-1',
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

function transition(
  fromState: CatalogLifecycleState,
  toState: CatalogLifecycleState,
  evidencePatch: CatalogLifecycleEvidence = {},
): {
  request: CatalogLifecycleTransitionRequest;
  result: ReturnType<typeof applyCatalogLifecycleRequest>;
} {
  const request: CatalogLifecycleTransitionRequest = {
    productId: 'catalog-product-1',
    fromState,
    toState,
    idempotencyKey: `fixture:${fromState}:${toState}`,
    actorType: 'system',
    now: NOW,
    evidence: { ...evidence, ...evidencePatch },
  };
  const record: CatalogLifecycleRuntimeRecord = {
    productId: request.productId,
    state: fromState,
    evidence: request.evidence,
  };
  return { request, result: applyCatalogLifecycleRequest(record, [], request) };
}

function contractClean(event: CatalogJobAnalyticsEvent | null): boolean {
  return Boolean(
    event
    && isCanonicalAnalyticsEvent(event.event)
    && event.properties.surface !== 'unknown'
    && !('event_contract_issues' in event.properties),
  );
}

async function main(): Promise<void> {
  console.log('Catalog analytics checks');
  console.log('========================');

  const verified = transition('image_ready', 'verified');
  const verifiedEvent = catalogLifecycleAnalyticsEvent({
    ...verified,
    durableLedgerCommitted: true,
  });
  check('applied verified ledger edge emits the canonical product event',
    verifiedEvent?.event === 'catalog_product_verified' && contractClean(verifiedEvent));
  check('lifecycle event carries product id, state edge, and surface',
    verifiedEvent?.properties.product_id === 'catalog-product-1'
      && verifiedEvent.properties.from_state === 'image_ready'
      && verifiedEvent.properties.to_state === 'verified'
      && verifiedEvent.properties.surface === 'catalog-lifecycle');
  check('raw source-row identity is excluded from analytics payloads',
    !JSON.stringify(verifiedEvent).includes('raw-source-row-must-not-emit')
      && !JSON.stringify(verifiedEvent).includes('secret-source-system-must-not-emit'));
  check('lifecycle insert id is stable without exposing the ledger key',
    typeof verifiedEvent?.properties.$insert_id === 'string'
      && !JSON.stringify(verifiedEvent).includes(verified.request.idempotencyKey)
      && verifiedEvent?.properties.$insert_id === catalogLifecycleAnalyticsEvent({
        ...verified,
        durableLedgerCommitted: true,
      })?.properties.$insert_id);
  check('an uncommitted edge cannot claim durable lifecycle analytics',
    catalogLifecycleAnalyticsEvent({ ...verified, durableLedgerCommitted: false }) === null);

  const replay = applyCatalogLifecycleRequest(verified.result.record, verified.result.ledger, verified.request);
  check('a durable ledger replay never emits a duplicate verification event',
    replay.outcome === 'replay'
      && catalogLifecycleAnalyticsEvent({
        request: verified.request,
        result: replay,
        durableLedgerCommitted: true,
      }) === null);

  const noopRequest: CatalogLifecycleTransitionRequest = {
    ...verified.request,
    fromState: 'verified',
    toState: 'verified',
    idempotencyKey: 'fixture:verified:verified',
  };
  const noop = applyCatalogLifecycleRequest(verified.result.record, verified.result.ledger, noopRequest);
  check('an idempotent lifecycle no-op never emits', noop.outcome === 'noop'
    && catalogLifecycleAnalyticsEvent({
      request: noopRequest,
      result: noop,
      durableLedgerCommitted: true,
    }) === null);

  const published = transition('approved', 'published');
  const retired = transition('published', 'retired', {
    retiredAt: NOW,
    reasonCode: 'retailer_sold_out secret-reason-must-not-emit',
  });
  const publishedEvent = catalogLifecycleAnalyticsEvent({ ...published, durableLedgerCommitted: true });
  const retiredEvent = catalogLifecycleAnalyticsEvent({ ...retired, durableLedgerCommitted: true });
  check('publication and retirement map to canonical lifecycle events',
    publishedEvent?.event === 'catalog_product_published'
      && retiredEvent?.event === 'catalog_product_retired'
      && contractClean(publishedEvent)
      && contractClean(retiredEvent));
  check('freeform lifecycle evidence is excluded from retirement analytics',
    !JSON.stringify(retiredEvent).includes('secret-reason-must-not-emit'));

  const product = (id: string, category: Product['category']): Product => ({
    id,
    brand: 'Fixture',
    name: id,
    category,
    priceCents: 5_000,
    currency: 'USD',
    retailer: 'Fixture Shop',
    retailerUrl: `https://shop.example.com/products/${id}`,
    productUrl: `https://shop.example.com/products/${id}`,
    imageUrl: `https://cdn.example.com/${id}.jpg`,
  });
  const repaired: CatalogOutfitRepairResult = {
    status: 'repaired',
    items: {
      top: product('replacement-top', 'top'),
      bottom: product('retained-bottom', 'bottom'),
      shoes: product('retained-shoes', 'shoes'),
    },
    totalCents: 15_000,
    replacements: [{
      category: 'top',
      removedProductId: 'retired-top',
      replacementProductId: 'replacement-top',
    }],
    removedOptionalProductIds: ['retired-bag'],
  };
  const repairEvent = catalogOutfitRepairAnalyticsEvent({
    lookId: 'library-look-1',
    result: repaired,
    pipelineRunId: 'pipeline-1',
  });
  check('completed repair emits stable look and resulting product ids',
    repairEvent?.event === 'catalog_outfit_repaired'
      && repairEvent.properties.look_id === 'library-look-1'
      && Array.isArray(repairEvent.properties.product_ids)
      && repairEvent.properties.product_ids.length === 3
      && contractClean(repairEvent));
  check('repair analytics expose only bounded replacement identity fields',
    JSON.stringify(repairEvent).includes('replacement-top')
      && JSON.stringify(repairEvent).includes('retired-top')
      && !JSON.stringify(repairEvent).includes('shop.example.com'));
  check('unchanged or suppressed outfits never claim a repair event',
    catalogOutfitRepairAnalyticsEvent({
      lookId: 'library-look-2',
      result: { ...repaired, status: 'unchanged' },
    }) === null
      && catalogOutfitRepairAnalyticsEvent({
        lookId: 'library-look-3',
        result: {
          status: 'suppressed',
          reason: 'missing_verified_replacement',
          missingCategories: ['top'],
          removedOptionalProductIds: [],
        },
      }) === null);

  const blockedDecision = evaluateCatalogPipeline({
    baselineCount: 100,
    baselineServedCount: 80,
    candidateCount: 0,
    candidateReviewCount: 0,
    servedCount: 0,
    servedStrictlyPublishableCount: 0,
    healthSchemaVersion: 2,
    servedFreshCoveragePct: 0,
    mode: 'release',
    verificationPassed: false,
    now: new Date(NOW),
  });
  blockedDecision.failures[0].message = 'secret failure detail must not emit';
  const failureEvent = catalogPipelineFailureAnalyticsEvent({
    decision: blockedDecision,
    pipelineRunId: 'github-123-1',
    stage: 'guard',
  });
  check('blocked pipeline emits canonical run, stage, and error-code properties',
    failureEvent?.event === 'catalog_pipeline_failed'
      && failureEvent.properties.pipeline_run_id === 'github-123-1'
      && failureEvent.properties.stage === 'guard'
      && typeof failureEvent.properties.error_code === 'string'
      && contractClean(failureEvent));
  check('pipeline failure messages are excluded from analytics',
    !JSON.stringify(failureEvent).includes('secret failure detail'));
  const runtimeFailureEvent = catalogPipelineRuntimeFailureAnalyticsEvent({
    pipelineRunId: 'secret-run-id-must-not-emit',
    stage: 'not-a-real-stage',
    occurredAt: NOW,
  });
  check('runner exceptions hash unsafe run ids and restrict stage/error codes',
    contractClean(runtimeFailureEvent)
      && runtimeFailureEvent?.properties.stage === 'guard'
      && runtimeFailureEvent.properties.error_code === 'runner_exception'
      && !JSON.stringify(runtimeFailureEvent).includes('secret-run-id-must-not-emit'));
  const verificationFailureEvent = catalogPipelineRuntimeFailureAnalyticsEvent({
    pipelineRunId: 'github-123-1',
    stage: 'verify',
    errorCode: 'verification_failed',
    occurredAt: NOW,
  });
  check('verification-stage failures use the same canonical bounded payload',
    contractClean(verificationFailureEvent)
      && verificationFailureEvent?.properties.stage === 'verify'
      && verificationFailureEvent.properties.error_code === 'verification_failed');

  const healthyDecision = evaluateCatalogPipeline({
    baselineCount: 100,
    baselineServedCount: 80,
    candidateCount: 100,
    candidateReviewCount: 80,
    servedCount: 80,
    servedStrictlyPublishableCount: 80,
    healthSchemaVersion: 2,
    servedFreshCoveragePct: 100,
    mode: 'release',
    verificationPassed: true,
    now: new Date(NOW),
  });
  check('eligible pipeline does not emit a failure event',
    catalogPipelineFailureAnalyticsEvent({
      decision: healthyDecision,
      pipelineRunId: 'github-123-1',
    }) === null);

  let boundaryCaptures = 0;
  const boundaryCapture = async (): Promise<void> => {
    boundaryCaptures += 1;
  };
  const baselineEmission = await emitCatalogGuardFailureAnalytics({
    decision: blockedDecision,
    guardBoundary: false,
    githubRunId: '123',
    githubRunAttempt: '1',
    capture: boundaryCapture,
  });
  const guardEmission = await emitCatalogGuardFailureAnalytics({
    decision: blockedDecision,
    guardBoundary: true,
    githubRunId: '123',
    githubRunAttempt: '1',
    capture: boundaryCapture,
  });
  check('actual runner boundary skips baseline and captures one blocked guard',
    !baselineEmission && guardEmission && boundaryCaptures === 1);
  const workflowSource = readFileSync('.github/workflows/auto-expand.yml', 'utf8');
  check('workflow failure boundaries invoke the no-op-safe stage hook',
    workflowSource.includes('steps.verify.outcome == \'failure\'')
      && workflowSource.includes("steps.expand.outcome == 'failure'")
      && workflowSource.includes("steps.deploy.outcome == 'failure'")
      && workflowSource.includes('CATALOG_PIPELINE_STAGE')
      && workflowSource.match(/scripts\/emit-catalog-verification-failure\.ts/g)?.length === 3);
  check('run identities accept numeric GitHub metadata and reject arbitrary text',
    catalogPipelineAnalyticsRunId({
      generatedAt: NOW,
      githubRunId: '123',
      githubRunAttempt: '2',
    }) === 'github-123-2'
      && catalogPipelineAnalyticsRunId({
        generatedAt: NOW,
        githubRunId: 'do-not-echo-this',
      }) === `local-${Date.parse(NOW)}`);

  const captures: CatalogJobAnalyticsEvent[] = [];
  check('post-commit lifecycle boundary sends the exact allowlisted envelope',
    await emitCommittedCatalogLifecycleAnalytics({
      ...verified,
      durableLedgerCommitted: true,
    }, async (event, distinctId, properties) => {
      captures.push({ event, distinctId, properties });
    })
      && captures.length === 1
      && captures[0].event === 'catalog_product_verified');
  check('capture failures are swallowed and cannot fail a catalog job',
    await emitCatalogJobAnalytics(verifiedEvent, async () => {
      throw new Error('analytics unavailable');
    }) === false);

  const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('network must not be called');
  }) as typeof fetch;
  try {
    await emitCatalogJobAnalytics(verifiedEvent);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
  }
  check('default server emission is a true no-op without analytics config', fetchCalls === 0);

  if (failures) {
    console.error(`\n${failures}/${checks} catalog analytics check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nCatalog analytics: ${checks}/${checks} PASS`);
}

void main();
