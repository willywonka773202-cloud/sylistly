/**
 * Money-path check: the looks the FEED actually renders are mostly shoppable.
 *
 * The feed does not serve the baked outfit library — it calls buildCatalogLook
 * client-side, so shoppability is decided by scoreProduct's exact-link weight,
 * not by the library generator. Only an exact retailer product page can be
 * affiliate-wrapped for commission; a google-shopping search fallback earns $0
 * and drops the user on a search page. This measures the real ratio across a
 * spread of vibe × frame × seed and fails if it regresses.
 *
 *   node scripts/check-shoppability.mjs   (or: npm run test:shoppability)
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
const { hasExactProductLink } = jiti('@/lib/product-image-quality');

const VIBES = ['clean', 'street', 'office', 'date', 'gym', 'cozy', 'vacation', 'preppy', 'night', 'edgy'];
const FRAMES = ['androgynous', 'fem', 'masc'];

let pieces = 0;
let exact = 0;
let looks = 0;
let looksWithMajority = 0;
const worst = [];
const distinct = new Set();

for (const vibe of VIBES) {
  for (const frame of FRAMES) {
    for (let seed = 0; seed < 8; seed += 1) {
      const look = buildCatalogLook({ vibe, frame, budget: 'any', mode: 'full', seed });
      const products = Object.values(look.products).filter(Boolean);
      if (!products.length) continue;
      const hits = products.filter((product) => hasExactProductLink(product)).length;
      products.forEach((product) => distinct.add(product.id));
      pieces += products.length;
      exact += hits;
      looks += 1;
      if (hits * 2 >= products.length) looksWithMajority += 1;
      worst.push({ vibe, frame, seed, ratio: hits / products.length, label: `${hits}/${products.length}` });
    }
  }
}

worst.sort((a, b) => a.ratio - b.ratio);
const pieceRatio = exact / pieces;
const majorityRatio = looksWithMajority / looks;

console.log(`looks=${looks}  pieces=${pieces}`);
console.log(`exact-link pieces: ${(pieceRatio * 100).toFixed(1)}%  (${exact}/${pieces})`);
console.log(`looks where MOST pieces are shoppable: ${(majorityRatio * 100).toFixed(1)}%`);
console.log(`worst 5: ${worst.slice(0, 5).map((w) => `${w.vibe}/${w.frame}#${w.seed} ${w.label}`).join(' · ')}`);

console.log(`distinct products used: ${distinct.size}`);

// Floors sit just under the measured values so real regressions fail the build
// but ordinary catalog churn does not. VARIETY_FLOOR guards the other side of
// the trade: restricting generation to exact-link pieces must not collapse the
// feed onto the same handful of products.
const PIECE_FLOOR = 0.75;
const MAJORITY_FLOOR = 0.9;
const VARIETY_FLOOR = 150;

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures += 1;
};

check(`>=${PIECE_FLOOR * 100}% of generated pieces link to a real product page`, pieceRatio >= PIECE_FLOOR);
check(`>=${MAJORITY_FLOOR * 100}% of looks are majority-shoppable`, majorityRatio >= MAJORITY_FLOOR);
check(`generation still reaches >=${VARIETY_FLOOR} distinct products`, distinct.size >= VARIETY_FLOOR);

if (failures > 0) {
  console.error(`\n${failures} shoppability check(s) FAILED`);
  process.exit(1);
}
console.log('\nShoppability: PASS');
