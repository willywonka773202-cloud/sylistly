import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import clientCatalogData from '../data/client-catalog.json';
import dropCatalogData from '../data/drop-catalog.json';
import dropSourcesData from '../data/drop-sources.json';
import generatedCatalogData from '../data/generated-catalog.json';
import photoCatalogData from '../data/photo-catalog.json';
import searchApiCatalogData from '../data/searchapi-quality-catalog.json';
import catalogHealthData from '../data/catalog-health.json';
import clientBuildReportData from '../data/catalog/reports/client-catalog-build-report.json';
import dropIngestReportData from '../data/catalog/reports/drop-ingest-report.json';
import searchApiReportData from '../data/catalog/reports/searchapi-live-report.json';
import {
  DEFAULT_LINK_FRESHNESS_MS,
  evaluateProductPublishability,
  type CatalogHealthSnapshot,
  type LinkHealthOutcome,
} from './catalog-publishability';
import {
  evaluateCatalogShrinkGuard,
  type CatalogShrinkGuard,
} from './catalog-pipeline-guard';
import type { Product } from './types';

export type CatalogOpsSeverity = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface CatalogOpsQueueItem {
  id: string;
  brand: string;
  name: string;
  category: string;
  reason: string;
  outcome?: LinkHealthOutcome | 'legacy_unavailable';
  checkedAt?: string | null;
}

export interface CatalogOpsQueue {
  id: 'stale' | 'unavailable' | 'broken' | 'review';
  label: string;
  count: number;
  severity: CatalogOpsSeverity;
  items: CatalogOpsQueueItem[];
}

export interface CatalogOpsSourceStatus {
  id: string;
  label: string;
  type: string;
  status: CatalogOpsSeverity;
  runStatus: string;
  lastRunAt: string | null;
  ageHours: number | null;
  found: number;
  accepted: number;
  detail: string;
}

export interface CatalogOpsStatus {
  schemaVersion: 2;
  generatedAt: string;
  dataMode: 'static-fallback' | 'static-snapshot';
  overall: CatalogOpsSeverity;
  stages: Array<{
    id: string;
    label: string;
    count: number;
    status: CatalogOpsSeverity;
    detail: string;
  }>;
  health: {
    snapshotSchemaVersion: number;
    generatedAt: string | null;
    ageHours: number | null;
    checkedProducts: number;
    exactPdpCandidates: number;
    candidateProducts: number;
    reviewCandidates: number;
    candidateFreshChecked: number;
    candidateFreshAvailable: number;
    candidateReviewCoveragePct: number;
    targetCandidateReviewCoveragePct: number;
    meetsCandidateReviewCoverageTarget: boolean;
    servedPublishedProducts: number;
    servedStrictPublishableProducts: number;
    servedFreshCoveragePct: number;
    targetServedFreshCoveragePct: number;
    meetsServedFreshCoverageTarget: boolean;
    withheldCandidateProducts: number;
    retiredProducts: number;
    outcomes: Record<string, number>;
  };
  shrinkGuard: CatalogShrinkGuard;
  servingShrinkGuard: CatalogShrinkGuard;
  queues: CatalogOpsQueue[];
  sources: CatalogOpsSourceStatus[];
  lastRun: {
    status: 'never' | 'candidate' | 'success' | 'failed';
    at: string | null;
    mode: string;
    detail: string;
    lastFailure: string | null;
  };
  caveats: string[];
}

interface OpsRunReport {
  generatedAt?: string;
  mode?: string;
  decision?: string;
  canPublish?: boolean;
  failures?: Array<{ code?: string; message?: string }>;
  evidence?: {
    servedPublishedProducts?: number;
  };
}

interface DropReportRow {
  id?: string;
  type?: string;
  status?: string;
  productsFound?: number;
  productsAccepted?: number;
  error?: string;
}

const QUEUE_LIMIT = 24;
const STALE_REPORT_MS = 7 * 24 * 60 * 60 * 1000;

function products(value: unknown): Product[] {
  if (Array.isArray(value)) return value as Product[];
  if (value && typeof value === 'object' && Array.isArray((value as { products?: unknown }).products)) {
    return (value as { products: Product[] }).products;
  }
  return [];
}

function dateAgeHours(value: unknown, nowMs: number): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Number((Math.max(0, nowMs - parsed) / (60 * 60 * 1000)).toFixed(1));
}

function outcomeOf(value: unknown): LinkHealthOutcome | null {
  if (value === 'available' || value === 'reachable' || value === 'sold_out' || value === 'dead' || value === 'blocked' || value === 'error') {
    return value;
  }
  if (value === 'ok') return 'available';
  if (value === 'soldout') return 'sold_out';
  if (typeof value === 'string' && value.startsWith('error')) return 'error';
  return null;
}

/** Keep operator status useful without reflecting provider payloads, URLs with
 * query secrets, bearer values, or stack-sized error messages. */
export function sanitizeCatalogOpsMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value
    .replace(/https?:\/\/[^\s]+/gi, '[url redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/\b((?:api[_-]?key|token|secret))\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function productSummary(
  product: Product | undefined,
  id: string,
  reason: string,
  outcome?: CatalogOpsQueueItem['outcome'],
  checkedAt?: string | null,
): CatalogOpsQueueItem {
  return {
    id,
    brand: product?.brand || 'Unknown',
    name: product?.name || id,
    category: product?.category || 'unknown',
    reason,
    outcome,
    checkedAt,
  };
}

function dedupeProducts(groups: Product[][]): Product[] {
  const byId = new Map<string, Product>();
  for (const group of groups) {
    for (const product of group) {
      if (product?.id && !byId.has(product.id)) byId.set(product.id, product);
    }
  }
  return [...byId.values()];
}

function optionalJson<T>(rootDir: string, relativePath: string): T | null {
  const path = join(rootDir, relativePath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function sourceSeverity(runStatus: string, ageHours: number | null): CatalogOpsSeverity {
  if (runStatus === 'failed') return 'critical';
  if (runStatus === 'ok' && ageHours !== null && ageHours * 60 * 60 * 1000 <= STALE_REPORT_MS) return 'healthy';
  if (runStatus === 'ok' || runStatus === 'skipped') return 'warning';
  return 'unknown';
}

export function getCatalogOpsStatus({
  now = new Date(),
  rootDir = process.cwd(),
  env = process.env,
}: {
  now?: Date;
  rootDir?: string;
  env?: Readonly<Record<string, string | undefined>>;
} = {}): CatalogOpsStatus {
  const nowMs = now.getTime();
  const client = products(clientCatalogData);
  const discovered = dedupeProducts([
    products(generatedCatalogData),
    products(photoCatalogData),
    products(dropCatalogData),
    products(searchApiCatalogData),
  ]);
  const unifiedById = new Map([...discovered, ...client].map((product) => [product.id, product]));
  const health = catalogHealthData as unknown as CatalogHealthSnapshot;
  const healthRecords = health.products || {};
  const unavailableIds = new Set(health.unavailable || []);
  const outcomes: Record<string, number> = {};
  for (const raw of Object.values(healthRecords)) {
    const outcome = outcomeOf(raw.outcome ?? raw.status);
    if (outcome) outcomes[outcome] = (outcomes[outcome] || 0) + 1;
  }

  const structuralEvaluations = client.map((product) => ({
    product,
    evaluation: evaluateProductPublishability(product, {
      health,
      freshnessPolicy: 'allow-unknown',
      now,
    }),
  }));
  // Review candidacy is structural and intentionally ignores link-health
  // outcome. A sold-out/dead result is an explicit review outcome (retire), not
  // a reason to erase the row from the review denominator after the fact.
  const reviewEvaluations = client.map((product) => ({
    product,
    evaluation: evaluateProductPublishability(product, {
      freshnessPolicy: 'allow-unknown',
      now,
    }),
  }));
  const strictEvaluations = client.map((product) => ({
    product,
    evaluation: evaluateProductPublishability(product, {
      health,
      freshnessPolicy: 'require-fresh',
      now,
    }),
  }));
  const exactPdpCandidates = structuralEvaluations.filter(({ evaluation }) => evaluation.evidence.exactPdp).length;
  const reviewCandidates = reviewEvaluations.filter(({ evaluation }) => evaluation.publishable).length;
  const servedEvaluations = strictEvaluations.filter(({ evaluation }) => (
    evaluation.publishable && evaluation.evidence.health === 'available'
  ));
  const servedPublishedProducts = servedEvaluations.length;
  const candidateFreshChecked = strictEvaluations.filter(({ evaluation }) => (
    evaluation.evidence.checkedAt && evaluation.evidence.fresh
  )).length;
  const coverageFromSnapshot = health.coverage || {};
  const targetCandidateReviewCoveragePct = typeof coverageFromSnapshot.targetCandidateReviewCoveragePct === 'number'
    ? coverageFromSnapshot.targetCandidateReviewCoveragePct
    : typeof coverageFromSnapshot.targetFreshCoveragePct === 'number'
      ? coverageFromSnapshot.targetFreshCoveragePct
      : 95;
  const targetServedFreshCoveragePct = typeof coverageFromSnapshot.targetServedFreshCoveragePct === 'number'
    ? coverageFromSnapshot.targetServedFreshCoveragePct : 95;
  const candidateReviewCoveragePct = reviewCandidates
    ? Number(((servedPublishedProducts / reviewCandidates) * 100).toFixed(1)) : 0;
  const servedFreshCoveragePct = servedPublishedProducts > 0 ? 100 : 0;
  const withheldCandidateProducts = Math.max(0, client.length - servedPublishedProducts);
  const retiredProducts = structuralEvaluations.filter(({ evaluation }) => (
    evaluation.failures.includes('known_unavailable') || evaluation.failures.includes('out_of_stock')
  )).length;
  const healthAgeHours = dateAgeHours(health.generatedAt, nowMs);

  const staleItems: CatalogOpsQueueItem[] = [];
  const unavailableItems: CatalogOpsQueueItem[] = [];
  const brokenItems: CatalogOpsQueueItem[] = [];
  const reviewItems: CatalogOpsQueueItem[] = [];
  let staleCount = 0;
  let unavailableCount = 0;
  let brokenCount = 0;
  let reviewCount = 0;

  for (const { product, evaluation } of structuralEvaluations) {
    const freshnessWarning = evaluation.warnings.find((warning) => (
      warning === 'health_missing' || warning === 'health_stale' || warning === 'health_unverified'
    ));
    if (freshnessWarning) {
      staleCount += 1;
      if (staleItems.length < QUEUE_LIMIT) {
        staleItems.push(productSummary(
          product,
          product.id,
          freshnessWarning.replaceAll('_', ' '),
          evaluation.evidence.health === 'missing' ? undefined : evaluation.evidence.health,
          evaluation.evidence.checkedAt,
        ));
      }
    }
    if (evaluation.failures.includes('known_unavailable') || evaluation.failures.includes('out_of_stock')) {
      unavailableCount += 1;
      if (unavailableItems.length < QUEUE_LIMIT) {
        unavailableItems.push(productSummary(
          product,
          product.id,
          evaluation.failures.includes('out_of_stock') ? 'catalog marked out of stock' : 'link health marked unavailable',
          unavailableIds.has(product.id)
            ? 'legacy_unavailable'
            : evaluation.evidence.health === 'missing' ? undefined : evaluation.evidence.health,
          evaluation.evidence.checkedAt,
        ));
      }
    }
    const reviewReason = [...evaluation.failures, ...evaluation.warnings].find((failure) => (
      failure === 'not_exact_pdp' || failure === 'untrusted' || failure === 'trust_unknown' || failure === 'stock_unknown'
    ));
    if (reviewReason || evaluation.evidence.health === 'reachable' || evaluation.evidence.health === 'blocked') {
      reviewCount += 1;
      if (reviewItems.length < QUEUE_LIMIT) {
        reviewItems.push(productSummary(
          product,
          product.id,
          (reviewReason || `${evaluation.evidence.health} requires stock review`).replaceAll('_', ' '),
          evaluation.evidence.health === 'missing' ? undefined : evaluation.evidence.health,
          evaluation.evidence.checkedAt,
        ));
      }
    }
  }

  for (const [id, raw] of Object.entries(healthRecords)) {
    const outcome = outcomeOf(raw.outcome ?? raw.status);
    if (outcome !== 'dead' && outcome !== 'error') continue;
    brokenCount += 1;
    if (brokenItems.length < QUEUE_LIMIT) {
      brokenItems.push(productSummary(
        unifiedById.get(id),
        id,
        outcome === 'dead' ? 'retailer returned a dead PDP' : 'link check failed',
        outcome,
        raw.checkedAt || null,
      ));
    }
  }

  const cutoutReady = discovered.filter((product) => Boolean(product.imageTransparentUrl || product.imageCutoutUrl)).length;
  const needsCutoutProducts = discovered.filter((product) => !product.imageTransparentUrl && !product.imageCutoutUrl);
  reviewCount += needsCutoutProducts.length;
  for (const product of needsCutoutProducts.slice(0, Math.max(0, QUEUE_LIMIT - reviewItems.length))) {
    reviewItems.push(productSummary(product, product.id, 'needs reviewed transparent cutout'));
  }

  const buildReport = clientBuildReportData as unknown as {
    generatedAt?: string;
    emittedProducts?: number;
    runtimeProducts?: number;
  };
  const buildBaseline = Number(buildReport.emittedProducts || client.length);
  const shrinkGuard = evaluateCatalogShrinkGuard(buildBaseline, client.length);
  const opsRun = optionalJson<OpsRunReport>(rootDir, 'data/catalog/reports/catalog-ops-run.json');
  const previousServedCount = Number(opsRun?.evidence?.servedPublishedProducts);
  const servingShrinkGuard = evaluateCatalogShrinkGuard(
    Number.isFinite(previousServedCount) ? previousServedCount : servedPublishedProducts,
    servedPublishedProducts,
  );
  const dropReport = dropIngestReportData as unknown as {
    generatedAt?: string;
    mode?: string;
    reports?: DropReportRow[];
    addedProducts?: number;
    mergedProducts?: number;
  };
  const sourceConfig = dropSourcesData as unknown as {
    sources?: Array<{ id: string; retailer?: string; type?: string }>;
  };
  const reportBySource = new Map((dropReport.reports || []).map((row) => [row.id || '', row]));
  const sources: CatalogOpsSourceStatus[] = (sourceConfig.sources || []).map((source) => {
    const report = reportBySource.get(source.id);
    const runStatus = report?.status || 'never';
    const ageHours = dateAgeHours(dropReport.generatedAt, nowMs);
    return {
      id: source.id,
      label: source.retailer || source.id,
      type: source.type || report?.type || 'unknown',
      status: sourceSeverity(runStatus, ageHours),
      runStatus,
      lastRunAt: dropReport.generatedAt || null,
      ageHours,
      found: Number(report?.productsFound || 0),
      accepted: Number(report?.productsAccepted || 0),
      detail: sanitizeCatalogOpsMessage(
        report?.error,
        runStatus === 'skipped' ? 'not selected in the latest bounded source run' : 'latest static ingest evidence',
      ),
    };
  });

  const searchApiReport = searchApiReportData as unknown as {
    generatedAt?: string;
    recommendation?: string;
    recommendationReason?: string;
    candidatesFound?: number;
    highOrMediumCandidates?: number;
  };
  sources.push({
    id: 'searchapi-live',
    label: 'SearchAPI live discovery',
    type: 'searchapi',
    status: searchApiReport.recommendation === 'adjust' ? 'critical' : 'warning',
    runStatus: searchApiReport.recommendation || 'unknown',
    lastRunAt: searchApiReport.generatedAt || null,
    ageHours: dateAgeHours(searchApiReport.generatedAt, nowMs),
    found: Number(searchApiReport.candidatesFound || 0),
    accepted: Number(searchApiReport.highOrMediumCandidates || 0),
    detail: sanitizeCatalogOpsMessage(searchApiReport.recommendationReason, 'static discovery report'),
  });

  const lastFailure = opsRun?.failures?.find((failure) => failure.message || failure.code);
  const fallbackFailure = searchApiReport.recommendation === 'adjust'
    ? searchApiReport.recommendationReason || 'SearchAPI discovery requires adjustment.'
    : null;
  const opsFailureText = lastFailure?.message || lastFailure?.code || fallbackFailure;
  const lastRun = opsRun
    ? {
        status: opsRun.canPublish ? 'success' as const : opsRun.decision === 'blocked' ? 'failed' as const : 'candidate' as const,
        at: opsRun.generatedAt || null,
        mode: opsRun.mode || 'unknown',
        detail: opsRun.decision || 'catalog ops report',
        lastFailure: opsFailureText ? sanitizeCatalogOpsMessage(opsFailureText, 'Pipeline failure details unavailable.') : null,
      }
    : {
        status: 'candidate' as const,
        at: dropReport.generatedAt || null,
        mode: dropReport.mode || 'dry-run',
        detail: `${Number(dropReport.addedProducts || 0)} added; ${Number(dropReport.mergedProducts || 0)} merged in latest static ingest report`,
        lastFailure: fallbackFailure ? sanitizeCatalogOpsMessage(fallbackFailure, 'Discovery source requires review.') : null,
      };

  const meetsCandidateReviewCoverageTarget = candidateReviewCoveragePct >= targetCandidateReviewCoveragePct;
  const meetsServedFreshCoverageTarget = servedPublishedProducts > 0
    && servedFreshCoveragePct >= targetServedFreshCoveragePct;
  const queues: CatalogOpsQueue[] = [
    { id: 'stale', label: 'Stale or unverified', count: staleCount, severity: staleCount ? 'critical' : 'healthy', items: staleItems },
    { id: 'unavailable', label: 'Unavailable', count: unavailableCount, severity: unavailableCount ? 'warning' : 'healthy', items: unavailableItems },
    { id: 'broken', label: 'Broken checks', count: brokenCount, severity: brokenCount ? 'critical' : 'healthy', items: brokenItems },
    { id: 'review', label: 'Manual review', count: reviewCount, severity: reviewCount ? 'warning' : 'healthy', items: reviewItems },
  ];
  const overall: CatalogOpsSeverity = !meetsServedFreshCoverageTarget
    || !shrinkGuard.passes
    || !servingShrinkGuard.passes
    || lastRun.status === 'failed'
    ? 'critical'
    : !meetsCandidateReviewCoverageTarget || queues.some((queue) => queue.severity === 'warning')
      ? 'warning'
      : 'healthy';

  return {
    schemaVersion: 2,
    generatedAt: now.toISOString(),
    dataMode: env.NEXT_PUBLIC_SUPABASE_URL ? 'static-snapshot' : 'static-fallback',
    overall,
    stages: [
      { id: 'discovered', label: 'Discovered inventory', count: discovered.length, status: discovered.length ? 'healthy' : 'critical', detail: 'Unique local products across generated, photo, drop, and quality imports.' },
      { id: 'cutout', label: 'Cutout-ready', count: cutoutReady, status: cutoutReady ? 'warning' : 'critical', detail: 'Discovered products with a registered transparent/cutout asset.' },
      { id: 'candidate', label: 'Candidate inventory', count: client.length, status: shrinkGuard.passes ? 'healthy' : 'critical', detail: 'All client-catalog rows retained for review or serving classification.' },
      { id: 'review', label: 'Structurally reviewable', count: reviewCandidates, status: reviewCandidates ? 'warning' : 'critical', detail: 'Exact PDP, acceptable trust/stock, and not known unavailable; fresh evidence may still be missing.' },
      { id: 'served', label: 'Served / published', count: servedPublishedProducts, status: meetsServedFreshCoverageTarget ? 'healthy' : 'critical', detail: 'Strict fresh-positive subset visible to shopping surfaces.' },
      { id: 'withheld', label: 'Withheld for review', count: withheldCandidateProducts, status: withheldCandidateProducts ? 'warning' : 'healthy', detail: 'Candidates withheld from serving until every strict evidence invariant passes.' },
      { id: 'retired', label: 'Unavailable / retired', count: retiredProducts, status: retiredProducts ? 'warning' : 'healthy', detail: 'Known sold-out, dead, or explicitly out-of-stock rows excluded from serving.' },
    ],
    health: {
      snapshotSchemaVersion: Number(health.schemaVersion || 1),
      generatedAt: health.generatedAt || null,
      ageHours: healthAgeHours,
      checkedProducts: Number(health.checked || Object.keys(healthRecords).length),
      exactPdpCandidates,
      candidateProducts: client.length,
      reviewCandidates,
      candidateFreshChecked,
      candidateFreshAvailable: servedPublishedProducts,
      candidateReviewCoveragePct,
      targetCandidateReviewCoveragePct,
      meetsCandidateReviewCoverageTarget,
      servedPublishedProducts,
      servedStrictPublishableProducts: servedEvaluations.length,
      servedFreshCoveragePct,
      targetServedFreshCoveragePct,
      meetsServedFreshCoverageTarget,
      withheldCandidateProducts,
      retiredProducts,
      outcomes,
    },
    shrinkGuard,
    servingShrinkGuard,
    queues,
    sources,
    lastRun,
    caveats: [
      'Static evidence is authoritative for this view when Supabase is unavailable; no live database mutation is performed.',
      health.schemaVersion === 2
        ? 'Schema-v2 health evidence is present.'
        : 'Legacy health evidence has no per-product timestamps/outcomes, so fresh verified coverage is intentionally 0%.',
      'Generic HTTP 200 is reachable/stock-unknown and cannot satisfy the availability SLA.',
      'Candidate review coverage is a warning metric; only the strict fresh-positive served subset crosses the publication boundary.',
      'Served freshness is measured over the served/published set and is 100% by construction whenever that set is non-empty.',
      `Health freshness window is ${DEFAULT_LINK_FRESHNESS_MS / (60 * 60 * 1000)} hours.`,
    ],
  };
}
