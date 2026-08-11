/**
 * Primary-feed commerce contract.
 *
 * Exercises the same `generateLooks` path used by SSR and client re-deals. Every
 * emitted look must be a complete outfit, contain only exact retailer PDP links,
 * avoid known unavailable stock, and honor the default whole-look ceiling.
 * Invalid source/locked pieces must be repaired; impossible looks are suppressed.
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
const {
  CLIENT_CATALOG_PRODUCTS,
  buildCatalogLook,
  isBuyableClientCatalogProduct,
  validateCompleteBuyableLook,
} = jiti('@/lib/client-catalog');
const {
  DEFAULT_FEED_MAX_TOTAL_CENTS,
  generateLooks,
  initialGenState,
} = jiti('@/lib/compose-look');
const { hasExactProductLink } = jiti('@/lib/product-image-quality');

const VIBES = ['clean', 'street', 'office', 'date', 'gym', 'cozy', 'vacation', 'preppy', 'night', 'edgy'];
const FRAMES = ['androgynous', 'fem', 'masc'];
// One full-feed deal for every vibe × frame cohort keeps this CI check focused
// while still spanning all 30 recommendation contexts.
const LOOKS_PER_COHORT = 1;
const EXPECTED_LOOKS = VIBES.length * FRAMES.length * LOOKS_PER_COHORT;
const VARIETY_FLOOR = 60;

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures += 1;
};

let looks = 0;
let pieces = 0;
let exactPieces = 0;
let buyablePieces = 0;
let completeLooks = 0;
let budgetCompliantLooks = 0;
let maxObservedTotal = 0;
let minObservedTotal = Number.POSITIVE_INFINITY;
const distinct = new Set();
const violations = [];

for (let vibeIndex = 0; vibeIndex < VIBES.length; vibeIndex += 1) {
  const vibe = VIBES[vibeIndex];
  for (let frameIndex = 0; frameIndex < FRAMES.length; frameIndex += 1) {
    const frame = FRAMES[frameIndex];
    const state = { ...initialGenState(), seed: 101 + vibeIndex * 997 + frameIndex * 89 };
    // No options on purpose: this verifies the backward-compatible default is
    // the affordable whole-look ceiling, not merely a caller-provided cap.
    const generated = generateLooks(LOOKS_PER_COHORT, frame, vibe, state);
    for (const look of generated.looks) {
      const products = Object.values(look.items).filter(Boolean);
      const validation = validateCompleteBuyableLook(look.items, DEFAULT_FEED_MAX_TOTAL_CENTS);
      const exactCount = products.filter((product) => hasExactProductLink(product)).length;
      const buyableCount = products.filter((product) => isBuyableClientCatalogProduct(product)).length;

      looks += 1;
      pieces += products.length;
      exactPieces += exactCount;
      buyablePieces += buyableCount;
      if (validation.missingRequiredSlots.length === 0) completeLooks += 1;
      if (validation.overBudgetCents === 0) budgetCompliantLooks += 1;
      maxObservedTotal = Math.max(maxObservedTotal, validation.totalCents);
      minObservedTotal = Math.min(minObservedTotal, validation.totalCents);
      products.forEach((product) => distinct.add(product.id));

      if (!validation.ok || exactCount !== products.length || buyableCount !== products.length) {
        violations.push({
          vibe,
          frame,
          key: look.key,
          totalCents: validation.totalCents,
          exact: `${exactCount}/${products.length}`,
          missing: validation.missingRequiredSlots,
          nonBuyable: validation.nonBuyableSlots,
        });
      }
    }
  }
}

const cheapBuyableTop = CLIENT_CATALOG_PRODUCTS
  .filter((product) => product.category === 'top' && isBuyableClientCatalogProduct(product))
  .sort((left, right) => left.priceCents - right.priceCents)[0];
const cheapBuyableBag = CLIENT_CATALOG_PRODUCTS
  .filter((product) => product.category === 'bag' && isBuyableClientCatalogProduct(product))
  .sort((left, right) => left.priceCents - right.priceCents)[0];

const validLocked = cheapBuyableTop
  ? buildCatalogLook({
      vibe: 'clean',
      frame: 'androgynous',
      budget: 'under500',
      mode: 'full',
      seed: 417,
      lockedItems: { top: cheapBuyableTop },
      targetSlots: ['top', 'bottom', 'shoes'],
      maxTotalCents: DEFAULT_FEED_MAX_TOTAL_CENTS,
      requireCompleteBuyable: true,
    })
  : null;

const invalidTop = cheapBuyableTop
  ? { ...cheapBuyableTop, id: '__unavailable-top-fixture__', inStock: false }
  : null;
const repairedRequired = invalidTop
  ? buildCatalogLook({
      vibe: 'clean',
      frame: 'androgynous',
      budget: 'under500',
      mode: 'full',
      seed: 719,
      currentItems: { top: invalidTop },
      targetSlots: ['top', 'bottom', 'shoes'],
      maxTotalCents: DEFAULT_FEED_MAX_TOTAL_CENTS,
      requireCompleteBuyable: true,
    })
  : null;

const invalidBag = cheapBuyableBag
  ? { ...cheapBuyableBag, id: '__unavailable-bag-fixture__', inStock: false }
  : null;
const handledOptional = invalidBag
  ? buildCatalogLook({
      vibe: 'clean',
      frame: 'androgynous',
      budget: 'under500',
      mode: 'full',
      seed: 1021,
      currentItems: { bag: invalidBag },
      targetSlots: ['top', 'bottom', 'shoes', 'bag'],
      maxTotalCents: DEFAULT_FEED_MAX_TOTAL_CENTS,
      requireCompleteBuyable: true,
    })
  : null;

const customCap = 35_000;
const customGenerated = generateLooks(
  3,
  'androgynous',
  'clean',
  { ...initialGenState(), seed: 2027 },
  {},
  new Set(),
  { budget: 'custom', customMaxCents: customCap, maxTotalCents: customCap },
);
const impossible = generateLooks(
  1,
  'androgynous',
  'clean',
  { ...initialGenState(), seed: 3031 },
  {},
  new Set(),
  { budget: 'custom', customMaxCents: 1, maxTotalCents: 1 },
);

const pieceRatio = pieces ? exactPieces / pieces : 0;
const buyableRatio = pieces ? buyablePieces / pieces : 0;
const completeRatio = looks ? completeLooks / looks : 0;
const budgetRatio = looks ? budgetCompliantLooks / looks : 0;
console.log(`looks=${looks}/${EXPECTED_LOOKS}  pieces=${pieces}  distinct=${distinct.size}`);
console.log(`exact PDP pieces=${(pieceRatio * 100).toFixed(1)}%  buyable=${(buyableRatio * 100).toFixed(1)}%`);
console.log(`required-slot complete=${(completeRatio * 100).toFixed(1)}%  within $${DEFAULT_FEED_MAX_TOTAL_CENTS / 100}=${(budgetRatio * 100).toFixed(1)}%`);
console.log(`whole-look totals=$${(minObservedTotal / 100).toFixed(2)}–$${(maxObservedTotal / 100).toFixed(2)}`);
if (violations.length) console.log('violations:', violations.slice(0, 5));

check('default primary feed emits every requested look', looks === EXPECTED_LOOKS);
check('100% of emitted pieces have exact retailer PDP links', pieceRatio === 1);
check('100% of emitted pieces are not known unavailable/inStock=false', buyableRatio === 1);
check('100% of emitted looks contain top + bottom + shoes', completeRatio === 1);
check(`100% of default looks total <= $${DEFAULT_FEED_MAX_TOTAL_CENTS / 100}`, budgetRatio === 1);
check(`generation still reaches >=${VARIETY_FLOOR} distinct buyable products`, distinct.size >= VARIETY_FLOOR);
check(
  'a valid locked item is preserved inside a compliant look',
  Boolean(validLocked?.buyability.ok && validLocked.products.top?.id === cheapBuyableTop?.id),
);
check(
  'an unavailable required piece is replaced by a buyable same-category item',
  Boolean(
    repairedRequired?.buyability.ok
      && repairedRequired.products.top
      && repairedRequired.products.top.id !== invalidTop?.id
      && repairedRequired.products.top.category === 'top',
  ),
);
check(
  'an unavailable optional piece is repaired or safely omitted',
  Boolean(
    handledOptional?.buyability.ok
      && (!handledOptional.products.bag || handledOptional.products.bag.id !== invalidBag?.id),
  ),
);
check(
  `custom whole-look cap ($${customCap / 100}) propagates`,
  customGenerated.looks.length > 0
    && customGenerated.looks.every((look) => validateCompleteBuyableLook(look.items, customCap).ok),
);
check('an impossible cap suppresses the look instead of leaking it', impossible.looks.length === 0);

if (failures > 0) {
  console.error(`\n${failures} shoppability check(s) FAILED`);
  process.exit(1);
}
console.log('\nShoppability: PASS');
