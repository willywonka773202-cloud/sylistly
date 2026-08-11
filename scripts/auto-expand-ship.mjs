/**
 * Local catalog candidate orchestrator.
 *
 * Default behavior is candidate-only: generate workspace data, collect typed
 * health evidence, evaluate guards, and verify. It never commits or deploys.
 * Set CATALOG_RELEASE=1 for an explicitly authorized release; even then the
 * final decision must be publishable after verification.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sh = (command) => execSync(command, { stdio: 'inherit' });
const out = (command) => execSync(command, { encoding: 'utf8' }).trim();
const releaseRequested = process.env.CATALOG_RELEASE === '1';
const reportPath = 'data/catalog/reports/catalog-ops-run.json';
const dataFiles = [
  'data/client-catalog.json',
  'data/outfit-library.json',
  'data/outfit-library-report.json',
  'data/generated-catalog.json',
  'data/photo-catalog.json',
  'data/drop-look-library.json',
  'data/catalog-health.json',
  'data/catalog/reports/client-catalog-build-report.json',
  reportPath,
];

function catalogCount() {
  const raw = JSON.parse(readFileSync('data/client-catalog.json', 'utf8'));
  return Array.isArray(raw) ? raw.length : (raw.products || []).length;
}

function currentServedCount() {
  const status = JSON.parse(out('npx jiti scripts/catalog-ops-pipeline.ts --candidate-only --json'));
  return Number(status?.evidence?.servedPublishedProducts || 0);
}

function previousServedCount(fallback) {
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const value = Number(report?.evidence?.servedPublishedProducts);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

const baselineCount = catalogCount();
const baselineServedCount = previousServedCount(currentServedCount());
const mode = releaseRequested ? '--release' : '--candidate-only';

console.log(`Catalog automation mode: ${releaseRequested ? 'explicit release' : 'candidate-only'}`);
sh('node scripts/auto-expand.mjs');
sh('npm run health:sweep');
sh('npm run library:generate');
sh('npm run drop:library');
sh(`npx jiti scripts/catalog-ops-pipeline.ts --baseline-count=${baselineCount} --baseline-served-count=${baselineServedCount} ${mode} --write-report=${reportPath} --fail-on-block`);
sh('npm run verify');
sh('npm run build');
sh('npm run test:performance');
sh(`npx jiti scripts/catalog-ops-pipeline.ts --baseline-count=${baselineCount} --baseline-served-count=${baselineServedCount} ${mode} --verification-passed --write-report=${reportPath} --fail-on-block`);

const decision = JSON.parse(readFileSync(reportPath, 'utf8'));
if (!releaseRequested) {
  console.log('\nCandidate verified locally. No commit, push, or deploy was attempted.');
  process.exit(0);
}
if (decision.canPublish !== true) {
  throw new Error(`Release blocked by catalog pipeline decision: ${decision.decision || 'unknown'}`);
}

const dirty = out(`git status --porcelain ${dataFiles.join(' ')}`);
if (!dirty) {
  console.log('\nNo verified catalog changes to release.');
  process.exit(0);
}

sh(`git add ${dataFiles.join(' ')}`);
sh('git commit -m "catalog: publish verified automated refresh"');
console.log('\nVerified release committed. Deploying only because CATALOG_RELEASE=1 was explicit.');
sh('npx vercel --prod --yes');
console.log('\nCatalog release complete.');
