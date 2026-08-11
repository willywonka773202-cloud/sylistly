/** Best-effort workflow hook for a failed catalog workflow stage. */
import {
  catalogPipelineAnalyticsRunId,
  emitCatalogPipelineRuntimeFailureAnalytics,
} from '../lib/catalog-job-analytics';

async function main(): Promise<void> {
  const occurredAt = new Date().toISOString();
  const stage = process.env.CATALOG_PIPELINE_STAGE || 'verify';
  const errorCode = stage === 'verify' ? 'verification_failed' : 'runner_exception';
  await emitCatalogPipelineRuntimeFailureAnalytics({
    pipelineRunId: catalogPipelineAnalyticsRunId({
      generatedAt: occurredAt,
      githubRunId: process.env.GITHUB_RUN_ID,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
    }),
    occurredAt,
    stage,
    errorCode,
  });
}

void main();
