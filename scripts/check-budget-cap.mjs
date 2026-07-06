/**
 * Money-path check: client-catalog's buildCatalogLook honours a TOTAL-outfit
 * budget cap (the Remix budget panel's "$100 for everything") — swapping pieces
 * DOWN to fit rather than dropping slots.
 *
 * client-catalog imports `@/data/*.json`, which the bare `jiti` CLI / its alias
 * option can't resolve — so we patch Node's resolver to rewrite every `@/…`
 * specifier to a repo-root path (covers jiti's transpiled `.ts` requires AND
 * the raw `.json` ones), then drive jiti programmatically. check-lib-units.ts
 * can't do this, hence the separate script.
 *
 *   node scripts/check-budget-cap.mjs   (or: npm run test:budget)
 */
import jitiFactory from 'jiti';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), '..');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(root, request.slice(2)) : request;
  return originalResolve.call(this, mapped, ...rest);
};

const jiti = jitiFactory(here, {});
const { buildCatalogLook } = jiti('@/lib/client-catalog');

const total = (products) =>
  Object.values(products).reduce((sum, item) => sum + ((item && item.priceCents) || 0), 0);

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures += 1;
};

// Same deterministic inputs (fixed seed) — only the cap changes between runs.
const base = { vibe: 'clean', frame: 'androgynous', budget: 'any', mode: 'full', seed: 7 };

const open = buildCatalogLook(base);
const openTotal = total(open.products);
const openSlots = Object.keys(open.products).length;

const cap = Math.floor(openTotal * 0.5);
const capped = buildCatalogLook({ ...base, maxTotalCents: cap });
const cappedTotal = total(capped.products);

const generous = buildCatalogLook({ ...base, maxTotalCents: openTotal * 10 });

console.log(
  `open=$${(openTotal / 100).toFixed(0)} (${openSlots} slots) · cap=$${(cap / 100).toFixed(0)} · ` +
    `capped=$${(cappedTotal / 100).toFixed(0)} (${Object.keys(capped.products).length} slots)`,
);

check('a tight cap lowers the outfit total', cappedTotal < openTotal);
check('budget never raises the total', cappedTotal <= openTotal);
check('budget swaps DOWN, never drops slots (look stays full)', Object.keys(capped.products).length === openSlots);
check('a cap above the total is a no-op (normal generation unharmed)', total(generous.products) === openTotal);

if (failures > 0) {
  console.error(`\n${failures} budget check(s) FAILED`);
  process.exit(1);
}
console.log('\nBudget cap: PASS');
