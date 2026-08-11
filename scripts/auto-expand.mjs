/**
 * Auto-expand pipeline — grows the clothing catalog and regenerates the
 * pre-made outfit library, end to end. Safe to run on a schedule (CI cron).
 *
 *   1. (optional) Grow the catalog via SearchAPI — only if SEARCHAPI_KEY is set.
 *      New products are merged into data/generated-catalog.json.
 *   2. Rebuild the client catalog (quality-gated: only products with usable
 *      transparent images survive, so growth can never inject junk into prod).
 *   3. Regenerate the coordinated, gendered outfit library from the catalog.
 *
 * The caller (CI workflow) then verifies (tsc + build) and deploys only if green.
 *
 * Run:  node scripts/auto-expand.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const has = (key) => Boolean(process.env[key] && process.env[key].trim());
const run = (cmd, env = {}) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });
};
const count = (path, pick) => {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return pick(data);
  } catch {
    return 0;
  }
};

const beforeProducts = count('data/client-catalog.json', (d) => (Array.isArray(d) ? d.length : (d.products || []).length));
const beforeLooks = count('data/outfit-library.json', (d) => Object.values(d.looks || {}).reduce(
  (sum, byFrame) => sum + Object.values(byFrame).reduce((s, rows) => s + rows.length, 0), 0));

console.log('=== Sylistly auto-expand ===');
console.log(`before: ${beforeProducts} catalog products, ${beforeLooks} pre-made outfits`);

// 1) Grow the catalog (optional — needs the owner's SearchAPI key)
if (has('SEARCHAPI_KEY')) {
  console.log('\nSEARCHAPI_KEY present → growing catalog via SearchAPI…');
  try {
    run('npm run catalog:expand', {
      SEARCHAPI_LIVE: process.env.SEARCHAPI_LIVE || 'true',
      MAX_SEARCHES: process.env.MAX_SEARCHES || '40',
    });
  } catch (error) {
    if (process.env.CATALOG_ALLOW_GROWTH_FAILURE === '1') {
      console.warn(`catalog:expand failed — explicitly allowed to continue with existing catalog. (${error.message})`);
    } else {
      throw new Error(`catalog:expand failed; candidate generation aborted. (${error.message})`);
    }
  }
} else {
  console.log('\nNo SEARCHAPI_KEY → skipping live catalog growth (will still regenerate from the existing catalog).');
}

// 2) Rebuild the client catalog (keyless, quality-gated)
run('npm run catalog:client');

// 3) Regenerate the coordinated outfit library (keyless)
run('node scripts/generate-outfit-library.mjs');

const afterProducts = count('data/client-catalog.json', (d) => (Array.isArray(d) ? d.length : (d.products || []).length));
const afterLooks = count('data/outfit-library.json', (d) => Object.values(d.looks || {}).reduce(
  (sum, byFrame) => sum + Object.values(byFrame).reduce((s, rows) => s + rows.length, 0), 0));

console.log('\n=== auto-expand complete ===');
console.log(`after:  ${afterProducts} catalog products (${afterProducts - beforeProducts >= 0 ? '+' : ''}${afterProducts - beforeProducts}), ${afterLooks} outfits (${afterLooks - beforeLooks >= 0 ? '+' : ''}${afterLooks - beforeLooks})`);
