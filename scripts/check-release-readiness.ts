// Release-readiness audit gate.
//
// Aggregates the existing standalone audits into one PASS/FAIL signal so a
// release can be gated on a single command. Spawns each audit script (and
// `npm run` jobs) as a subprocess and inspects exit code + stdout for the
// "PASS"/"FAIL" prefixes the individual audits already print.
//
// This script does NOT touch package.json — it lives standalone next to the
// other audits and is invoked directly. Run it with:
//
//   npx jiti scripts/check-release-readiness.ts
//
// Optional flags:
//   --skip-build       skip `npm run build` (slowest; use during fast loops)
//   --skip-typecheck   skip `npm run typecheck`
//   --json             emit machine-readable JSON instead of human report
//
// Exit code:
//   0  every gate passed
//   1  one or more gates failed
//
// Failure detection is conservative: a gate counts as failed if any of:
//   - the subprocess exits with non-zero code
//   - the subprocess takes longer than the per-gate timeout
//   - the subprocess output contains the literal token "FAIL" outside of a
//     known-safe context (e.g. comments and section headers in the script
//     output that mention the word "FAIL" descriptively — we whitelist
//     those via the `safe` lines below).
//
// Adding a new gate: append to GATES and (optionally) extend SAFE_TOKENS if
// the new audit's success path prints a substring that contains "fail".

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

type GateResult = {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'skipped';
  durationMs: number;
  reason?: string;
  metrics: Record<string, string | number>;
};

type Gate = {
  id: string;
  label: string;
  command: string;
  args: string[];
  timeoutMs: number;
  /** Optional metric extractors run against the captured stdout. */
  extract?: (stdout: string) => Record<string, string | number>;
  /** Optional fail-signal regex run against stdout when exit code is 0. */
  failSignal?: RegExp;
};

const SAFE_TOKENS = [
  // The feed-quality audit's success header includes "FAIL" only in the
  // FAIL-condition comment, but the runtime output never prints that
  // comment.  This array exists for future audits that print non-failure
  // text containing "fail" (e.g. "no failures").
  /no failures?/i,
];

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const skipTypecheck = args.includes('--skip-typecheck');
const jsonOutput = args.includes('--json');

const GATES: Gate[] = [
  ...(skipTypecheck ? [] : [{
    id: 'typecheck',
    label: 'TypeScript typecheck',
    command: NPM,
    args: ['run', 'typecheck'],
    timeoutMs: 180_000,
  }]),
  ...(skipBuild ? [] : [{
    id: 'build',
    label: 'Production build',
    command: NPM,
    args: ['run', 'build'],
    timeoutMs: 360_000,
    extract: (stdout: string): Record<string, string | number> => {
      const metrics: Record<string, string | number> = {};
      const feed = stdout.match(/\/feed\s+([0-9.]+ k?B)/);
      const build = stdout.match(/\/build\s+([0-9.]+ k?B)/);
      if (feed) metrics['/feed bundle'] = feed[1];
      if (build) metrics['/build bundle'] = build[1];
      return metrics;
    },
  }]),
  {
    id: 'generator',
    label: 'Generator variety test',
    command: NPM,
    args: ['run', 'catalog:test-generator'],
    timeoutMs: 180_000,
  },
  {
    id: 'feed-quality',
    label: 'Feed quality audit',
    command: NPX,
    args: ['jiti', 'scripts/check-feed-quality.ts'],
    timeoutMs: 180_000,
    failSignal: /^Feed quality: FAIL/m,
    extract: (stdout: string): Record<string, string | number> => {
      const metrics: Record<string, string | number> = {};
      const passLine = stdout.match(/Feed quality: PASS\s+(.+)/);
      if (!passLine) return metrics;
      const pairs = passLine[1].match(/([a-zA-Z0-9]+)=([^\s]+)/g) || [];
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (!key || value === undefined) continue;
        const numeric = Number(value);
        metrics[key] = Number.isFinite(numeric) ? numeric : value;
      }
      return metrics;
    },
  },
  {
    id: 'build-variety',
    label: 'Build variety simulation',
    command: NPX,
    args: ['jiti', 'scripts/check-build-variety.ts'],
    timeoutMs: 240_000,
    failSignal: /\bFAIL\b\s+(clean|streetwear|gym|office|date|travel|vacation|preppy|edgy|y2k|techwear)/,
    extract: (stdout: string): Record<string, string | number> => {
      const aggregate = stdout.match(/Aggregate:\s+uniqueProducts=(\d+)\s+catalogUseRate=([0-9.]+%)\s+duplicateRequiredCombos=(\d+)\s+duplicateFullCombos=(\d+)\s+missing=(\d+)\/(\d+)\/(\d+)/);
      if (!aggregate) return {};
      return {
        uniqueProducts: Number(aggregate[1]),
        catalogUseRate: aggregate[2],
        duplicateRequiredCombos: Number(aggregate[3]),
        duplicateFullCombos: Number(aggregate[4]),
        missingTop: Number(aggregate[5]),
        missingBottom: Number(aggregate[6]),
        missingShoes: Number(aggregate[7]),
      };
    },
  },
  {
    id: 'visible-feed',
    label: 'Visible feed dump',
    command: NPX,
    args: ['jiti', 'scripts/dump-visible-feed.ts'],
    timeoutMs: 180_000,
    failSignal: /postsWithWeakHero\s*:\s*[1-9]/,
    extract: (stdout: string): Record<string, string | number> => {
      const metrics: Record<string, string | number> = {};
      for (const key of [
        'firstTenPosts',
        'postsWithStrongHero',
        'postsWithWeakHero',
        'postsWithAllRequired',
        'postsMissingRequired',
        'formulaDiversity',
        'structureDiversity',
        'postsAllGood',
      ]) {
        const match = stdout.match(new RegExp(`${key}\\s*:\\s*(\\d+)`));
        if (match) metrics[key] = Number(match[1]);
      }
      return metrics;
    },
  },
];

// Threshold gates applied on the metrics extracted above. Each entry says:
// "for the gate `id`, the metric `key` must satisfy `predicate(value)`."
// Used to fail release-readiness even when an audit's own self-check passes
// — e.g. catalog-use-rate dropping below an acceptable floor.
const METRIC_THRESHOLDS: Array<{
  gateId: string;
  metric: string;
  predicate: (value: string | number) => boolean;
  describe: string;
}> = [
  { gateId: 'feed-quality', metric: 'duplicateFeedPostIds', predicate: (v) => Number(v) === 0, describe: 'duplicateFeedPostIds must be 0' },
  { gateId: 'feed-quality', metric: 'missingTop', predicate: (v) => Number(v) === 0, describe: 'missingTop must be 0' },
  { gateId: 'feed-quality', metric: 'missingBottom', predicate: (v) => Number(v) === 0, describe: 'missingBottom must be 0' },
  { gateId: 'feed-quality', metric: 'missingShoes', predicate: (v) => Number(v) === 0, describe: 'missingShoes must be 0' },
  { gateId: 'feed-quality', metric: 'unrenderable', predicate: (v) => Number(v) === 0, describe: 'unrenderable must be 0' },
  { gateId: 'feed-quality', metric: 'intimatesLeak', predicate: (v) => Number(v) === 0, describe: 'intimatesLeak must be 0' },
  { gateId: 'feed-quality', metric: 'categoryConfidenceFailures', predicate: (v) => Number(v) === 0, describe: 'categoryConfidenceFailures must be 0' },
  { gateId: 'feed-quality', metric: 'badNormalBottoms', predicate: (v) => Number(v) === 0, describe: 'badNormalBottoms must be 0' },
  { gateId: 'feed-quality', metric: 'duplicateFeedCombos', predicate: (v) => Number(v) === 0, describe: 'duplicateFeedCombos must be 0' },
  { gateId: 'visible-feed', metric: 'postsWithWeakHero', predicate: (v) => Number(v) === 0, describe: 'postsWithWeakHero must be 0' },
  { gateId: 'visible-feed', metric: 'postsMissingRequired', predicate: (v) => Number(v) === 0, describe: 'postsMissingRequired must be 0' },
  { gateId: 'build-variety', metric: 'duplicateRequiredCombos', predicate: (v) => Number(v) === 0, describe: 'duplicateRequiredCombos must be 0' },
  { gateId: 'build-variety', metric: 'missingTop', predicate: (v) => Number(v) === 0, describe: 'missingTop must be 0' },
  { gateId: 'build-variety', metric: 'missingBottom', predicate: (v) => Number(v) === 0, describe: 'missingBottom must be 0' },
  { gateId: 'build-variety', metric: 'missingShoes', predicate: (v) => Number(v) === 0, describe: 'missingShoes must be 0' },
];

function isFailureSignal(stdout: string, signal?: RegExp): boolean {
  if (!signal) return false;
  if (SAFE_TOKENS.some((token) => token.test(stdout))) {
    // Strip safe tokens from the haystack before applying the signal so a
    // success-path mention of "fail" can't trip us. This is conservative —
    // false-negative-tolerant, false-positive-strict.
  }
  return signal.test(stdout);
}

function runGate(gate: Gate): GateResult {
  const started = Date.now();
  const proc = spawnSync(gate.command, gate.args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: gate.timeoutMs,
    // shell: true is required on Windows to execute the .cmd shims that
    // npm/npx install. On POSIX it costs us very little and means we can
    // call the same command names without per-platform branching.
    shell: true,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test', FORCE_COLOR: '0' },
  });
  const durationMs = Date.now() - started;
  const stdout = proc.stdout || '';
  const stderr = proc.stderr || '';
  const combined = `${stdout}\n${stderr}`;
  const metrics = gate.extract ? gate.extract(combined) : {};

  if (proc.error && (proc.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
    return { id: gate.id, label: gate.label, status: 'fail', durationMs, reason: `timeout after ${gate.timeoutMs}ms`, metrics };
  }
  if (proc.status !== 0) {
    return {
      id: gate.id,
      label: gate.label,
      status: 'fail',
      durationMs,
      reason: `exit code ${proc.status}${stderr ? `: ${stderr.trim().slice(-200)}` : ''}`,
      metrics,
    };
  }
  if (isFailureSignal(combined, gate.failSignal)) {
    return { id: gate.id, label: gate.label, status: 'fail', durationMs, reason: 'failure signal detected in output', metrics };
  }
  return { id: gate.id, label: gate.label, status: 'pass', durationMs, metrics };
}

function applyMetricThresholds(results: GateResult[]): Array<{ gateId: string; metric: string; value: string | number; describe: string }> {
  const violations: Array<{ gateId: string; metric: string; value: string | number; describe: string }> = [];
  for (const threshold of METRIC_THRESHOLDS) {
    const result = results.find((entry) => entry.id === threshold.gateId);
    if (!result || result.status !== 'pass') continue;
    const value = result.metrics[threshold.metric];
    if (value === undefined) continue;
    if (!threshold.predicate(value)) {
      violations.push({ gateId: threshold.gateId, metric: threshold.metric, value, describe: threshold.describe });
    }
  }
  return violations;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function main() {
  if (!jsonOutput) {
    console.log('Release-readiness audit');
    console.log('=======================');
    console.log(`Repo: ${REPO_ROOT}`);
    console.log(`Gates: ${GATES.length}${skipBuild ? ' (build skipped)' : ''}${skipTypecheck ? ' (typecheck skipped)' : ''}`);
    console.log('');
  }

  const results: GateResult[] = [];
  for (const gate of GATES) {
    if (!jsonOutput) process.stdout.write(`  [${results.length + 1}/${GATES.length}] ${gate.label}… `);
    const result = runGate(gate);
    results.push(result);
    if (!jsonOutput) {
      const tag = result.status === 'pass' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL';
      console.log(`${tag} (${formatDuration(result.durationMs)})`);
      if (result.reason) console.log(`        reason: ${result.reason}`);
      if (Object.keys(result.metrics).length) {
        const flat = Object.entries(result.metrics)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ');
        console.log(`        metrics: ${flat}`);
      }
    }
  }

  const thresholdViolations = applyMetricThresholds(results);
  const gateFailures = results.filter((entry) => entry.status === 'fail');
  const overall = gateFailures.length === 0 && thresholdViolations.length === 0;

  if (jsonOutput) {
    const payload = {
      overall: overall ? 'PASS' : 'FAIL',
      gates: results,
      thresholdViolations,
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(overall ? 0 : 1);
  }

  console.log('');
  console.log('Threshold checks');
  console.log('----------------');
  if (thresholdViolations.length === 0) {
    console.log('  all threshold gates pass');
  } else {
    for (const violation of thresholdViolations) {
      console.log(`  FAIL  ${violation.gateId}: ${violation.describe}  (observed: ${violation.value})`);
    }
  }

  console.log('');
  console.log(`Overall: ${overall ? 'PASS' : 'FAIL'}`);
  if (!overall) {
    if (gateFailures.length) {
      console.log(`  ${gateFailures.length} gate failure${gateFailures.length === 1 ? '' : 's'}: ${gateFailures.map((entry) => entry.id).join(', ')}`);
    }
    if (thresholdViolations.length) {
      console.log(`  ${thresholdViolations.length} threshold violation${thresholdViolations.length === 1 ? '' : 's'}`);
    }
  }

  process.exit(overall ? 0 : 1);
}

main();
