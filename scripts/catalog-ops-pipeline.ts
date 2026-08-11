/**
 * Read-only catalog pipeline decision/orchestration plan.
 *
 * The default invocation performs no network calls, catalog writes, git
 * operations, or deploys. It reads current static evidence and explains whether
 * a workspace candidate is blocked, candidate-ready, or release-eligible.
 * `canPublish` is only true when both --release and --verification-passed are
 * explicit; the GitHub workflow independently checks that output before any
 * commit/push/deploy step.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  catalogPipelineAnalyticsRunId,
  emitCatalogPipelineFailureAnalytics,
  emitCatalogPipelineRuntimeFailureAnalytics,
  type CatalogAnalyticsCapture,
} from '../lib/catalog-job-analytics';
import { evaluateCatalogPipeline } from '../lib/catalog-pipeline-guard';
import { getCatalogOpsStatus } from '../lib/catalog-ops-status';

interface Flags {
  baselineCount: number | null;
  baselineServedCount: number | null;
  candidateCount: number | null;
  maximumShrinkPct: number;
  maximumServedShrinkPct: number;
  mode: 'candidate-only' | 'release';
  verificationPassed: boolean;
  json: boolean;
  failOnBlock: boolean;
  reportPath: string;
  githubOutputPath: string;
  now: Date;
}

const ROOT = process.cwd();
const ALLOWED_REPORT_PATH = resolve(ROOT, 'data/catalog/reports/catalog-ops-run.json');

function numericFlag(value: string, fallback: number | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function parseCatalogOpsFlags(argv: string[]): Flags {
  const flags: Flags = {
    baselineCount: null,
    baselineServedCount: null,
    candidateCount: null,
    maximumShrinkPct: 10,
    maximumServedShrinkPct: 10,
    mode: 'candidate-only',
    verificationPassed: false,
    json: false,
    failOnBlock: false,
    reportPath: '',
    githubOutputPath: '',
    now: new Date(),
  };
  for (const arg of argv) {
    if (arg === '--release') flags.mode = 'release';
    else if (arg === '--candidate-only') flags.mode = 'candidate-only';
    else if (arg === '--verification-passed') flags.verificationPassed = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--fail-on-block') flags.failOnBlock = true;
    else if (arg.startsWith('--baseline-count=')) flags.baselineCount = numericFlag(arg.slice(17), flags.baselineCount);
    else if (arg.startsWith('--baseline-served-count=')) flags.baselineServedCount = numericFlag(arg.slice(24), flags.baselineServedCount);
    else if (arg.startsWith('--candidate-count=')) flags.candidateCount = numericFlag(arg.slice(18), flags.candidateCount);
    else if (arg.startsWith('--maximum-shrink-pct=')) flags.maximumShrinkPct = numericFlag(arg.slice(21), 10) ?? 10;
    else if (arg.startsWith('--maximum-served-shrink-pct=')) flags.maximumServedShrinkPct = numericFlag(arg.slice(28), 10) ?? 10;
    else if (arg.startsWith('--write-report=')) flags.reportPath = arg.slice(15).trim();
    else if (arg.startsWith('--github-output=')) flags.githubOutputPath = arg.slice(16).trim();
    else if (arg.startsWith('--now=')) {
      const parsed = new Date(arg.slice(6));
      if (Number.isFinite(parsed.getTime())) flags.now = parsed;
    }
  }
  return flags;
}

function writeReport(path: string, payload: unknown): void {
  const target = resolve(ROOT, path);
  if (target !== ALLOWED_REPORT_PATH) {
    throw new Error('Catalog ops reports may only be written to data/catalog/reports/catalog-ops-run.json.');
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeGithubOutput(path: string, decision: ReturnType<typeof evaluateCatalogPipeline>): void {
  appendFileSync(path, [
    `decision=${decision.decision}`,
    `eligible=${decision.eligible}`,
    `release_eligible=${decision.releaseEligible}`,
    `can_publish=${decision.canPublish}`,
    `candidate_count=${decision.shrinkGuard.candidateCount}`,
    `minimum_allowed_count=${decision.shrinkGuard.minimumAllowedCount}`,
    `served_count=${decision.servingShrinkGuard.candidateCount}`,
    `minimum_served_count=${decision.servingShrinkGuard.minimumAllowedCount}`,
  ].join('\n') + '\n', 'utf8');
}

/** Shared by the CLI and focused tests so baseline probes cannot emit. */
export async function emitCatalogGuardFailureAnalytics(input: {
  decision: ReturnType<typeof evaluateCatalogPipeline>;
  guardBoundary: boolean;
  githubRunId?: string;
  githubRunAttempt?: string;
  capture?: CatalogAnalyticsCapture;
}): Promise<boolean> {
  if (!input.guardBoundary || input.decision.eligible) return false;
  return emitCatalogPipelineFailureAnalytics({
    decision: input.decision,
    pipelineRunId: catalogPipelineAnalyticsRunId({
      generatedAt: input.decision.generatedAt,
      githubRunId: input.githubRunId,
      githubRunAttempt: input.githubRunAttempt,
    }),
    stage: 'guard',
  }, input.capture);
}

async function main(): Promise<void> {
  const flags = parseCatalogOpsFlags(process.argv.slice(2));
  const status = getCatalogOpsStatus({ now: flags.now });
  const decision = evaluateCatalogPipeline({
    baselineCount: flags.baselineCount ?? status.shrinkGuard.baselineCount,
    candidateCount: flags.candidateCount ?? status.shrinkGuard.candidateCount,
    candidateReviewCount: status.health.reviewCandidates,
    servedCount: status.health.servedPublishedProducts,
    servedStrictlyPublishableCount: status.health.servedStrictPublishableProducts,
    baselineServedCount: flags.baselineServedCount ?? status.servingShrinkGuard.baselineCount,
    healthSchemaVersion: status.health.snapshotSchemaVersion,
    candidateReviewCoveragePct: status.health.candidateReviewCoveragePct,
    targetCandidateReviewCoveragePct: status.health.targetCandidateReviewCoveragePct,
    servedFreshCoveragePct: status.health.servedFreshCoveragePct,
    targetServedFreshCoveragePct: status.health.targetServedFreshCoveragePct,
    sourceFailureCount: status.sources.filter((source) => source.runStatus === 'failed').length,
    maximumShrinkPct: flags.maximumShrinkPct,
    maximumServedShrinkPct: flags.maximumServedShrinkPct,
    mode: flags.mode,
    verificationPassed: flags.verificationPassed,
    now: flags.now,
  });

  const payload = {
    ...decision,
    evidence: {
      dataMode: status.dataMode,
      healthGeneratedAt: status.health.generatedAt,
      healthAgeHours: status.health.ageHours,
      candidateProducts: status.health.candidateProducts,
      reviewCandidates: status.health.reviewCandidates,
      candidateFreshAvailable: status.health.candidateFreshAvailable,
      candidateReviewCoveragePct: status.health.candidateReviewCoveragePct,
      servedPublishedProducts: status.health.servedPublishedProducts,
      servedFreshCoveragePct: status.health.servedFreshCoveragePct,
      withheldCandidateProducts: status.health.withheldCandidateProducts,
      retiredProducts: status.health.retiredProducts,
      lastRun: status.lastRun,
    },
  };
  if (flags.reportPath) writeReport(flags.reportPath, payload);
  if (flags.githubOutputPath) writeGithubOutput(flags.githubOutputPath, decision);

  // A report-writing/fail-on-block invocation is the real guard boundary. The
  // baseline JSON probe intentionally does not emit a pipeline failure.
  await emitCatalogGuardFailureAnalytics({
    decision,
    guardBoundary: Boolean(flags.reportPath || flags.failOnBlock),
    githubRunId: process.env.GITHUB_RUN_ID,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
  });

  if (flags.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log('Catalog operations dry-run');
    console.log('==========================');
    console.log(`Mode: ${decision.mode}`);
    console.log(`Decision: ${decision.decision}`);
    console.log(`Inventory: ${decision.shrinkGuard.candidateCount} candidate / ${decision.shrinkGuard.baselineCount} baseline (minimum ${decision.shrinkGuard.minimumAllowedCount})`);
    console.log(`Serving: ${decision.servingShrinkGuard.candidateCount} strict / ${decision.servingShrinkGuard.baselineCount} baseline (minimum ${decision.servingShrinkGuard.minimumAllowedCount})`);
    for (const gate of decision.gates) {
      console.log(`${gate.passed ? 'PASS' : 'BLOCK'} ${gate.label}: ${gate.message}`);
    }
    for (const warning of decision.warnings) console.log(`WARN ${warning.message}`);
    console.log('\nPlan (not executed)');
    for (const stage of decision.stages) console.log(`- ${stage.label}: ${stage.command}`);
    console.log(`\nPublish allowed: ${decision.canPublish ? 'yes' : 'no'}`);
  }

  if (flags.failOnBlock && !decision.eligible) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('catalog-ops-pipeline.ts')) {
  void main().catch(async () => {
    const occurredAt = new Date().toISOString();
    await emitCatalogPipelineRuntimeFailureAnalytics({
      pipelineRunId: catalogPipelineAnalyticsRunId({
        generatedAt: occurredAt,
        githubRunId: process.env.GITHUB_RUN_ID,
        githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
      }),
      occurredAt,
      stage: 'guard',
    });
    console.error('Catalog pipeline failed unexpectedly.');
    process.exitCode = 1;
  });
}
