#!/usr/bin/env node

/**
 * Enforce Sylistly's production First Load JS budgets from Next.js artifacts.
 *
 * The calculation mirrors Next 15's build summary: normalize App Router page
 * entries, keep only their initial `.js` assets, gzip every distinct asset at
 * level 9, and sum the compressed bytes once per route. Dynamic-import chunks
 * are absent from the page entry and therefore (correctly) remain deferred.
 *
 * A BUILD_ID is mandatory so a partial `next dev` directory can never pass as
 * production evidence. Run after `npm run build` via `npm run test:performance`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY_PATH = resolve(SCRIPT_DIR, 'performance-budgets.json');
const DEFAULT_DIST_PATH = resolve(process.cwd(), '.next');

export const REQUIRED_ROUTE_CEILINGS_KB = Object.freeze({
  '/': 350,
  '/browse': 400,
  '/discover': 400,
  '/build': 400,
  '/saved': 400,
});

export const DEFAULT_ROUTE_CEILING_KB = 450;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path, label) {
  invariant(existsSync(path), `${label} is missing: ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isGroupSegment(segment) {
  return segment.startsWith('(') && segment.endsWith(')');
}

/** Match Next's normalizeAppPath behavior for manifest entry names. */
export function normalizeAppRoute(entry) {
  const segments = entry.split('/');
  const normalized = segments.reduce((pathname, segment, index) => {
    if (!segment || isGroupSegment(segment) || segment.startsWith('@')) return pathname;
    if ((segment === 'page' || segment === 'route') && index === segments.length - 1) return pathname;
    return `${pathname}/${segment}`;
  }, '');
  return normalized || '/';
}

export function validateBudgetPolicy(policy) {
  invariant(policy && typeof policy === 'object' && !Array.isArray(policy), 'Performance policy must be an object');
  invariant(policy.kilobyteBytes === 1000, 'Performance policy must define 1 kB as exactly 1000 bytes');
  invariant(
    Number.isFinite(policy.defaultMaxKb) && policy.defaultMaxKb > 0,
    'Performance policy defaultMaxKb must be a positive number',
  );
  invariant(
    policy.defaultMaxKb <= DEFAULT_ROUTE_CEILING_KB,
    `Performance policy cannot weaken the ${DEFAULT_ROUTE_CEILING_KB} kB all-route ceiling`,
  );
  invariant(policy.routeMaxKb && typeof policy.routeMaxKb === 'object', 'Performance policy routeMaxKb must be an object');

  for (const [route, ceilingKb] of Object.entries(REQUIRED_ROUTE_CEILINGS_KB)) {
    const configuredKb = policy.routeMaxKb[route];
    invariant(Number.isFinite(configuredKb) && configuredKb > 0, `Performance policy is missing a positive budget for ${route}`);
    invariant(configuredKb <= ceilingKb, `Performance policy cannot weaken ${route} above ${ceilingKb} kB`);
  }

  const exceptions = policy.exceptions ?? {};
  invariant(typeof exceptions === 'object' && !Array.isArray(exceptions), 'Performance policy exceptions must be an object');
  for (const [route, exception] of Object.entries(exceptions)) {
    invariant(route.startsWith('/'), `Performance exception route must be absolute: ${route}`);
    invariant(exception && typeof exception === 'object', `Performance exception for ${route} must be an object`);
    const ordinaryLimitKb = policy.routeMaxKb[route] ?? policy.defaultMaxKb;
    invariant(
      Number.isFinite(exception.maxKb) && exception.maxKb > ordinaryLimitKb,
      `Performance exception for ${route} must set maxKb above its ordinary ${ordinaryLimitKb} kB budget`,
    );
    for (const field of ['reason', 'measuredEvidence', 'deferredStrategy']) {
      invariant(
        typeof exception[field] === 'string' && exception[field].trim().length >= 20,
        `Performance exception for ${route} needs a specific ${field} (at least 20 characters)`,
      );
    }
  }

  return policy;
}

function safeAssetPath(distPath, asset) {
  invariant(typeof asset === 'string' && asset.length > 0, 'Build manifest contains an invalid asset path');
  const absolute = resolve(distPath, asset);
  const fromDist = relative(distPath, absolute);
  invariant(!isAbsolute(fromDist) && fromDist !== '..' && !fromDist.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`), `Build asset escapes dist directory: ${asset}`);
  return absolute;
}

function normalizePageAssets(appBuildManifest) {
  invariant(appBuildManifest?.pages && typeof appBuildManifest.pages === 'object', 'app-build-manifest.json has no pages map');
  return Object.entries(appBuildManifest.pages).reduce((normalized, [entry, assets]) => {
    invariant(Array.isArray(assets), `App build manifest entry ${entry} is not an asset list`);
    normalized[normalizeAppRoute(entry)] = assets;
    return normalized;
  }, {});
}

function discoverPageRoutes(appPathsManifest, normalizedAssets) {
  invariant(appPathsManifest && typeof appPathsManifest === 'object' && !Array.isArray(appPathsManifest), 'app-paths-manifest.json must be an object');
  const pageEntries = Object.keys(appPathsManifest).filter((entry) => entry === '/page' || entry.endsWith('/page'));
  invariant(pageEntries.length > 0, 'Production app paths manifest contains no page routes');

  const routes = [...new Set(pageEntries.map(normalizeAppRoute))]
    .filter((route) => !route.startsWith('/api/'))
    .sort((a, b) => routeSortKey(a).localeCompare(routeSortKey(b)));

  for (const route of routes) {
    invariant(Array.isArray(normalizedAssets[route]), `No initial asset entry found for App Router page ${route}`);
  }
  return routes;
}

function routeSortKey(route) {
  const priority = ['/', '/browse', '/discover', '/build', '/saved'].indexOf(route);
  return priority === -1 ? `9:${route}` : `0:${String(priority).padStart(2, '0')}`;
}

/** Load and measure a completed Next production build. */
export function measureProductionRouteBundles(distPath) {
  const resolvedDist = resolve(distPath);
  const buildIdPath = resolve(resolvedDist, 'BUILD_ID');
  invariant(
    existsSync(buildIdPath),
    `No production BUILD_ID found in ${resolvedDist}. Run \`npm run build\` before the performance check; \`next dev\` artifacts are rejected.`,
  );
  const buildId = readFileSync(buildIdPath, 'utf8').trim();
  invariant(buildId.length > 0, `Production BUILD_ID is empty: ${buildIdPath}`);

  // build-manifest is required even though this App Router project resolves its
  // route entries through app-build-manifest. Requiring both catches partial or
  // interrupted build directories before they can be treated as evidence.
  const buildManifest = readJson(resolve(resolvedDist, 'build-manifest.json'), 'Next build manifest');
  invariant(buildManifest?.pages && typeof buildManifest.pages === 'object', 'build-manifest.json has no pages map');
  const appBuildManifest = readJson(resolve(resolvedDist, 'app-build-manifest.json'), 'Next app build manifest');
  const appPathsManifest = readJson(resolve(resolvedDist, 'server/app-paths-manifest.json'), 'Next app paths manifest');

  const normalizedAssets = normalizePageAssets(appBuildManifest);
  const routes = discoverPageRoutes(appPathsManifest, normalizedAssets);
  const assetMetrics = new Map();

  function measureAsset(asset) {
    if (assetMetrics.has(asset)) return assetMetrics.get(asset);
    const absolute = safeAssetPath(resolvedDist, asset);
    invariant(existsSync(absolute), `Build manifest references a missing asset: ${asset}`);
    const source = readFileSync(absolute);
    const metrics = {
      asset,
      rawBytes: source.byteLength,
      gzipBytes: gzipSync(source, { level: 9 }).byteLength,
    };
    assetMetrics.set(asset, metrics);
    return metrics;
  }

  const routeBundles = routes.map((route) => {
    const initialJs = [...new Set(normalizedAssets[route].filter((asset) => asset.endsWith('.js')))];
    const assets = initialJs.map(measureAsset).sort((a, b) => b.gzipBytes - a.gzipBytes || a.asset.localeCompare(b.asset));
    return {
      route,
      gzipBytes: assets.reduce((total, asset) => total + asset.gzipBytes, 0),
      rawBytes: assets.reduce((total, asset) => total + asset.rawBytes, 0),
      assets,
    };
  });

  return { buildId, distPath: resolvedDist, routes: routeBundles };
}

export function evaluateRouteBudgets(measurement, policy) {
  validateBudgetPolicy(policy);
  const measuredRoutes = new Set(measurement.routes.map(({ route }) => route));
  for (const route of Object.keys(policy.exceptions ?? {})) {
    invariant(measuredRoutes.has(route), `Performance exception is stale or mistyped; route was not built: ${route}`);
  }

  const results = measurement.routes.map((bundle) => {
    const exception = policy.exceptions?.[bundle.route] ?? null;
    const ordinaryLimitKb = policy.routeMaxKb[bundle.route] ?? policy.defaultMaxKb;
    const limitKb = exception?.maxKb ?? ordinaryLimitKb;
    const limitBytes = limitKb * policy.kilobyteBytes;
    return {
      ...bundle,
      ordinaryLimitKb,
      limitKb,
      limitBytes,
      exception,
      passed: bundle.gzipBytes <= limitBytes,
      headroomBytes: limitBytes - bundle.gzipBytes,
    };
  });

  return {
    ...measurement,
    policy: {
      kilobyteBytes: policy.kilobyteBytes,
      defaultMaxKb: policy.defaultMaxKb,
      routeMaxKb: policy.routeMaxKb,
      exceptions: policy.exceptions ?? {},
    },
    passed: results.every((result) => result.passed),
    routes: results,
  };
}

function formatKb(bytes) {
  return `${(bytes / 1000).toFixed(1)} kB`;
}

function printHuman(report) {
  console.log('Production First Load JS budgets (gzip, 1 kB = 1000 bytes)');
  console.log(`Build: ${report.buildId}`);
  for (const result of report.routes) {
    const status = result.passed ? (result.exception ? 'PASS*' : 'PASS ') : 'FAIL ';
    const deltaLabel = result.headroomBytes >= 0 ? `${formatKb(result.headroomBytes)} headroom` : `${formatKb(Math.abs(result.headroomBytes))} over`;
    console.log(`${status} ${result.route.padEnd(24)} ${formatKb(result.gzipBytes).padStart(10)} / ${result.limitKb.toFixed(0).padStart(3)} kB  (${deltaLabel})`);
    if (!result.passed) {
      for (const asset of result.assets.slice(0, 3)) {
        console.log(`       ${formatKb(asset.gzipBytes).padStart(10)}  ${asset.asset}`);
      }
    }
    if (result.exception) {
      console.log(`       documented exception: ${result.exception.reason}`);
    }
  }
  const passedCount = report.routes.filter((route) => route.passed).length;
  const exceptionCount = report.routes.filter((route) => route.exception).length;
  const suffix = exceptionCount ? ` (${exceptionCount} documented exception${exceptionCount === 1 ? '' : 's'})` : '';
  console.log(`${report.passed ? 'PASS' : 'FAIL'} performance budgets: ${passedCount}/${report.routes.length} routes within limit${suffix}`);
}

function parseArgs(argv) {
  const options = { distPath: DEFAULT_DIST_PATH, policyPath: DEFAULT_POLICY_PATH, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dist') options.distPath = resolve(argv[++index] ?? '');
    else if (arg.startsWith('--dist=')) options.distPath = resolve(arg.slice('--dist='.length));
    else if (arg === '--policy') options.policyPath = resolve(argv[++index] ?? '');
    else if (arg.startsWith('--policy=')) options.policyPath = resolve(arg.slice('--policy='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function runPerformanceBudgetCheck({ distPath = DEFAULT_DIST_PATH, policyPath = DEFAULT_POLICY_PATH } = {}) {
  const policy = validateBudgetPolicy(readJson(resolve(policyPath), 'Performance budget policy'));
  return evaluateRouteBudgets(measureProductionRouteBundles(resolve(distPath)), policy);
}

function printHelp() {
  console.log(`Usage: node scripts/check-route-bundles.mjs [options]\n\nOptions:\n  --dist <path>    Next production output (default: .next)\n  --policy <path>  Budget policy JSON\n  --json           Emit machine-readable output\n  --help           Show this help`);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    const report = runPerformanceBudgetCheck(options);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printHuman(report);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options?.json) console.log(JSON.stringify({ passed: false, error: message }, null, 2));
    else console.error(`Performance budget check could not run: ${message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
