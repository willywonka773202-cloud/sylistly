export interface CatalogShrinkGuard {
  baselineCount: number;
  candidateCount: number;
  maximumShrinkPct: number;
  minimumAllowedCount: number;
  delta: number;
  deltaPct: number;
  passes: boolean;
}

export interface CatalogPipelineInput {
  baselineCount: number;
  candidateCount: number;
  /** Structurally plausible rows still awaiting or carrying fresh evidence. */
  candidateReviewCount?: number;
  /** Strict fresh-positive rows that will actually be served/published. */
  servedCount?: number;
  servedStrictlyPublishableCount?: number;
  baselineServedCount?: number;
  healthSchemaVersion: number;
  candidateReviewCoveragePct?: number;
  targetCandidateReviewCoveragePct?: number;
  servedFreshCoveragePct?: number;
  targetServedFreshCoveragePct?: number;
  /** @deprecated compatibility aliases for pre-v2 callers. */
  structurallyPublishableCount?: number;
  freshCoveragePct?: number;
  targetFreshCoveragePct?: number;
  sourceFailureCount?: number;
  maximumShrinkPct?: number;
  maximumServedShrinkPct?: number;
  mode?: 'candidate-only' | 'release';
  verificationPassed?: boolean;
  now?: Date;
}

export interface CatalogPipelineGate {
  code: string;
  label: string;
  passed: boolean;
  actual: number | string | boolean;
  expected: number | string | boolean;
  message: string;
}

export interface CatalogPipelineDecision {
  schemaVersion: 2;
  generatedAt: string;
  mode: 'candidate-only' | 'release';
  decision: 'blocked' | 'candidate-ready' | 'release-eligible' | 'publishable';
  eligible: boolean;
  releaseEligible: boolean;
  canPublish: boolean;
  shrinkGuard: CatalogShrinkGuard;
  servingShrinkGuard: CatalogShrinkGuard;
  gates: CatalogPipelineGate[];
  failures: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  stages: Array<{
    id: string;
    label: string;
    mode: 'read-only' | 'workspace-candidate' | 'external';
    command: string;
    publishBoundary: boolean;
  }>;
}

export function evaluateCatalogShrinkGuard(
  baselineCount: number,
  candidateCount: number,
  maximumShrinkPct = 10,
): CatalogShrinkGuard {
  const baseline = Math.max(0, Math.floor(Number(baselineCount) || 0));
  const candidate = Math.max(0, Math.floor(Number(candidateCount) || 0));
  const maxShrink = Math.min(100, Math.max(0, Number(maximumShrinkPct) || 0));
  const minimumAllowedCount = baseline === 0 ? 0 : Math.ceil(baseline * (1 - maxShrink / 100));
  const delta = candidate - baseline;
  const deltaPct = baseline ? Number(((delta / baseline) * 100).toFixed(1)) : 0;
  return {
    baselineCount: baseline,
    candidateCount: candidate,
    maximumShrinkPct: maxShrink,
    minimumAllowedCount,
    delta,
    deltaPct,
    passes: candidate >= minimumAllowedCount,
  };
}

/** Pure release-decision model. It never runs commands or mutates data. */
export function evaluateCatalogPipeline(input: CatalogPipelineInput): CatalogPipelineDecision {
  const mode = input.mode === 'release' ? 'release' : 'candidate-only';
  const targetServedFreshCoveragePct = Number.isFinite(input.targetServedFreshCoveragePct)
    ? Math.min(100, Math.max(0, Number(input.targetServedFreshCoveragePct)))
    : Number.isFinite(input.targetFreshCoveragePct)
      ? Math.min(100, Math.max(0, Number(input.targetFreshCoveragePct)))
      : 95;
  const targetCandidateReviewCoveragePct = Number.isFinite(input.targetCandidateReviewCoveragePct)
    ? Math.min(100, Math.max(0, Number(input.targetCandidateReviewCoveragePct))) : 95;
  const candidateReviewCount = Math.max(0, Math.floor(Number(
    input.candidateReviewCount ?? input.structurallyPublishableCount,
  ) || 0));
  const servedCount = Math.max(0, Math.floor(Number(
    input.servedCount ?? input.structurallyPublishableCount,
  ) || 0));
  const servedStrictlyPublishableCount = Math.max(0, Math.floor(Number(
    input.servedStrictlyPublishableCount ?? input.servedCount ?? input.structurallyPublishableCount,
  ) || 0));
  const servedFreshCoveragePct = Number.isFinite(input.servedFreshCoveragePct)
    ? Math.min(100, Math.max(0, Number(input.servedFreshCoveragePct)))
    : Number.isFinite(input.freshCoveragePct)
      ? Math.min(100, Math.max(0, Number(input.freshCoveragePct)))
      : 0;
  const candidateReviewCoveragePct = Number.isFinite(input.candidateReviewCoveragePct)
    ? Math.min(100, Math.max(0, Number(input.candidateReviewCoveragePct)))
    : candidateReviewCount
      ? Number(((servedCount / candidateReviewCount) * 100).toFixed(1))
      : 0;
  const shrinkGuard = evaluateCatalogShrinkGuard(
    input.baselineCount,
    input.candidateCount,
    input.maximumShrinkPct,
  );
  const servingShrinkGuard = evaluateCatalogShrinkGuard(
    input.baselineServedCount ?? servedCount,
    servedCount,
    input.maximumServedShrinkPct ?? input.maximumShrinkPct,
  );
  const sourceFailureCount = Math.max(0, Math.floor(Number(input.sourceFailureCount) || 0));
  const gates: CatalogPipelineGate[] = [
    {
      code: 'candidate_nonempty',
      label: 'Candidate inventory exists',
      passed: input.candidateCount > 0,
      actual: input.candidateCount,
      expected: '> 0',
      message: input.candidateCount > 0 ? 'Candidate inventory is non-empty.' : 'Candidate inventory is empty.',
    },
    {
      code: 'shrink_guard',
      label: 'Inventory shrink guard',
      passed: shrinkGuard.passes,
      actual: shrinkGuard.candidateCount,
      expected: `>= ${shrinkGuard.minimumAllowedCount}`,
      message: shrinkGuard.passes
        ? `Candidate is within the ${shrinkGuard.maximumShrinkPct}% shrink boundary.`
        : `Candidate has ${shrinkGuard.candidateCount} rows; minimum allowed is ${shrinkGuard.minimumAllowedCount}.`,
    },
    {
      code: 'served_nonempty',
      label: 'Served inventory exists',
      passed: servedCount > 0,
      actual: servedCount,
      expected: '> 0',
      message: servedCount > 0
        ? `${servedCount} strict fresh-positive products are eligible to serve.`
        : 'The strict served/published set is empty.',
    },
    {
      code: 'served_subset',
      label: 'Served rows belong to the reviewed candidate set',
      passed: servedCount <= candidateReviewCount && candidateReviewCount <= input.candidateCount,
      actual: `${servedCount}/${candidateReviewCount}/${input.candidateCount}`,
      expected: 'served <= review <= candidate',
      message: `${servedCount} served, ${candidateReviewCount} structurally reviewable, ${input.candidateCount} total candidates.`,
    },
    {
      code: 'served_integrity',
      label: 'Every served row passes strict publication invariants',
      passed: servedCount > 0 && servedStrictlyPublishableCount === servedCount,
      actual: servedStrictlyPublishableCount,
      expected: servedCount,
      message: `${servedStrictlyPublishableCount}/${servedCount} served rows pass exact-PDP, trust, stock, and fresh-positive evidence gates.`,
    },
    {
      code: 'typed_health',
      label: 'Typed per-product health evidence',
      passed: input.healthSchemaVersion >= 2,
      actual: input.healthSchemaVersion,
      expected: '>= 2',
      message: input.healthSchemaVersion >= 2
        ? 'Schema-v2 link-health evidence is present.'
        : 'Legacy health evidence cannot prove per-product freshness.',
    },
    {
      code: 'served_freshness',
      label: 'Served-set freshness coverage',
      passed: servedCount > 0 && servedFreshCoveragePct >= targetServedFreshCoveragePct,
      actual: Number(servedFreshCoveragePct.toFixed(1)),
      expected: `>= ${targetServedFreshCoveragePct}%`,
      message: `${servedFreshCoveragePct.toFixed(1)}% of the served/published set has fresh positive evidence.`,
    },
    {
      code: 'served_shrink_guard',
      label: 'Served inventory shrink guard',
      passed: servingShrinkGuard.passes,
      actual: servingShrinkGuard.candidateCount,
      expected: `>= ${servingShrinkGuard.minimumAllowedCount}`,
      message: servingShrinkGuard.passes
        ? `Served inventory is within the ${servingShrinkGuard.maximumShrinkPct}% shrink boundary.`
        : `Served inventory has ${servingShrinkGuard.candidateCount} rows; minimum allowed is ${servingShrinkGuard.minimumAllowedCount}.`,
    },
    {
      code: 'source_failures',
      label: 'No source-stage failures',
      passed: sourceFailureCount === 0,
      actual: sourceFailureCount,
      expected: 0,
      message: sourceFailureCount ? `${sourceFailureCount} source stage(s) failed.` : 'No source stage reported failure.',
    },
  ];
  const failures = gates.filter((gate) => !gate.passed).map((gate) => ({ code: gate.code, message: gate.message }));
  const warnings: Array<{ code: string; message: string }> = [];
  if (candidateReviewCount < input.candidateCount) {
    warnings.push({
      code: 'candidate_review_queue',
      message: `${input.candidateCount - candidateReviewCount} candidate rows remain rejected, retired, or structurally unresolved and are withheld from serving.`,
    });
  }
  if (candidateReviewCoveragePct < targetCandidateReviewCoveragePct) {
    warnings.push({
      code: 'candidate_review_coverage',
      message: `${candidateReviewCoveragePct.toFixed(1)}% of structurally reviewable candidates have fresh positive evidence; target ${targetCandidateReviewCoveragePct}%. This is review throughput, not served-set freshness.`,
    });
  }
  const eligible = failures.length === 0;
  const releaseEligible = eligible && mode === 'release';
  const canPublish = releaseEligible && input.verificationPassed === true;
  const decision = !eligible
    ? 'blocked'
    : canPublish ? 'publishable'
    : releaseEligible ? 'release-eligible'
    : 'candidate-ready';

  return {
    schemaVersion: 2,
    generatedAt: (input.now || new Date()).toISOString(),
    mode,
    decision,
    eligible,
    releaseEligible,
    canPublish,
    shrinkGuard,
    servingShrinkGuard,
    gates,
    failures,
    warnings,
    stages: [
      { id: 'baseline', label: 'Read baseline and static evidence', mode: 'read-only', command: 'catalog ops status', publishBoundary: false },
      { id: 'candidate', label: 'Generate workspace candidate', mode: 'workspace-candidate', command: 'node scripts/auto-expand.mjs', publishBoundary: false },
      { id: 'health', label: 'Verify retailer links', mode: 'workspace-candidate', command: 'npm run health:sweep', publishBoundary: false },
      { id: 'repair', label: 'Repair outfit and Daily Drop indexes from fresh health', mode: 'workspace-candidate', command: 'npm run library:generate && npm run drop:library', publishBoundary: false },
      { id: 'guard', label: 'Classify candidate/review/served sets and evaluate strict serving gates', mode: 'read-only', command: 'npx jiti scripts/catalog-ops-pipeline.ts', publishBoundary: false },
      { id: 'verify', label: 'Run repository verification', mode: 'read-only', command: 'npm run verify', publishBoundary: false },
      { id: 'publish', label: 'Commit, push, and deploy', mode: 'external', command: 'workflow-only after publishable decision', publishBoundary: true },
    ],
  };
}
