import { buildCatalogLook, getVibeQualityWarnings } from '../lib/catalog';
import { genderMismatchReasons, productGenderTags } from '../lib/frame-inference';
import { isRenderableProduct } from '../lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';
import type { GeneratorFrame, VibeId } from '../lib/vibes';

const RUNS_PER_SCENARIO = 10;

const SCENARIOS: Array<{ label: string; vibe: VibeId; frame: GeneratorFrame }> = [
  { label: 'clean masc', vibe: 'clean', frame: 'masc' },
  { label: 'clean fem', vibe: 'clean', frame: 'fem' },
  { label: 'streetwear masc', vibe: 'street', frame: 'masc' },
  { label: 'streetwear fem', vibe: 'street', frame: 'fem' },
  { label: 'night masc', vibe: 'night', frame: 'masc' },
  { label: 'night fem', vibe: 'night', frame: 'fem' },
  { label: 'date masc', vibe: 'date', frame: 'masc' },
  { label: 'date fem', vibe: 'date', frame: 'fem' },
  { label: 'gym masc', vibe: 'gym', frame: 'masc' },
  { label: 'gym fem', vibe: 'gym', frame: 'fem' },
  { label: 'office masc', vibe: 'office', frame: 'masc' },
  { label: 'office fem', vibe: 'office', frame: 'fem' },
  { label: 'vacation masc', vibe: 'vacation', frame: 'masc' },
  { label: 'vacation fem', vibe: 'vacation', frame: 'fem' },
  { label: 'old money masc', vibe: 'preppy', frame: 'masc' },
  { label: 'old money fem', vibe: 'preppy', frame: 'fem' },
  { label: 'y2k masc', vibe: 'street', frame: 'masc' },
  { label: 'y2k fem', vibe: 'street', frame: 'fem' },
  { label: 'techwear masc', vibe: 'edgy', frame: 'masc' },
  { label: 'techwear fem', vibe: 'edgy', frame: 'fem' },
];

interface ScenarioReport {
  label: string;
  frame: GeneratorFrame;
  totalPicks: number;
  uniqueIds: number;
  repeatRate: number;
  averageItems: number;
  eyewearRuns: number;
  jewelryRuns: number;
  mismatchCount: number;
  categoryMismatchCount: number;
  offFrameCount: number;
  vibeContradictions: number;
  accessoryOveruseRuns: number;
  weakCategoryMatches: number;
  missingByCategory: Partial<Record<Category, number>>;
  repeatedProducts: Array<{ label: string; count: number }>;
  warningSamples: string[];
  samples: string[];
  productCounts: Record<string, number>;
  missingRequiredRuns: number;
  missingTopRuns: number;
  missingBottomRuns: number;
  missingShoesRuns: number;
  completeRequiredRuns: number;
}

function productIds(products: Partial<Record<Category, Product>>): string[] {
  return Object.values(products)
    .filter((product): product is Product => Boolean(product))
    .map((product) => product.id);
}

function productLabel(product: Product): string {
  return `${product.brand} ${product.name}`.replace(/\s+/g, ' ').trim();
}

function slotSummary(products: Partial<Record<Category, Product>>): string {
  return CATEGORY_ORDER
    .map((category) => {
      const product = products[category];
      return product ? `${category}:${productLabel(product)}` : null;
    })
    .filter(Boolean)
    .join(' | ');
}

function isOffFrame(product: Product, frame: GeneratorFrame): boolean {
  if (frame === 'androgynous') return false;
  const tags = productGenderTags(product);
  return !tags.includes(frame) && !tags.includes('androgynous');
}

function normalizedProductText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...(product.searchTerms || []),
  ].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
}

function hasCategoryMismatch(product: Product): boolean {
  const text = normalizedProductText(product);
  const knownEyewearBrand = hasAny(text, ['ray ban', 'oakley', 'warby parker', 'gentle monster', 'quay', 'versace eyewear', 'prada eyewear']);

  switch (product.category) {
    case 'shoes':
      return hasAny(text, ['shirt', 'jacket', 'coat', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote']);
    case 'top':
      return hasAny(text, ['pants', 'trouser', 'jeans', 'shorts', 'skirt', 'shoes', 'sneaker', 'bag', 'tote']);
    case 'bottom':
      return hasAny(text, ['jacket', 'coat', 'shirt', 'tee', 'shoes', 'sneaker', 'bag', 'tote']);
    case 'outer':
      return hasAny(text, ['shoes', 'sneaker', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote'])
        && !hasAny(text, ['jacket', 'coat', 'blazer', 'cardigan', 'puffer', 'hoodie', 'overshirt', 'trench', 'bomber']);
    case 'bag':
      return hasAny(text, ['shoes', 'sneaker', 'pants', 'trouser', 'jeans', 'jacket', 'coat'])
        || hasAny(text, ['dress size', 'hat and jewelry set']);
    case 'eyewear':
      return !knownEyewearBrand && !hasAny(text, ['sunglasses', 'glasses', 'eyeglasses', 'eyewear', 'shades']);
    case 'jewelry':
      return !hasAny(text, ['necklace', 'bracelet', 'ring', 'earring', 'earrings', 'hoop', 'chain', 'pendant', 'jewelry']);
    case 'hat':
      return hasAny(text, ['jacket', 'pants', 'trouser', 'shoes', 'bag']) && !hasAny(text, ['cap', 'hat', 'beanie', 'bucket']);
    default:
      return false;
  }
}

function isAccessoryOveruse(vibe: VibeId, products: Partial<Record<Category, Product>>): boolean {
  const hasEyewear = Boolean(products.eyewear);
  const hasJewelry = Boolean(products.jewelry);

  switch (vibe) {
    case 'gym':
    case 'cozy':
      return hasEyewear || hasJewelry;
    case 'clean':
      return hasJewelry || (hasEyewear && hasJewelry);
    case 'office':
      return hasEyewear && hasJewelry;
    default:
      return false;
  }
}

function simulateScenario({ label, vibe, frame }: { label: string; vibe: VibeId; frame: GeneratorFrame }): ScenarioReport {
  const seen = new Set<string>();
  const counts = new Map<string, { label: string; count: number }>();
  const recentIds: string[] = [];
  const missingByCategory: Partial<Record<Category, number>> = {};
  const samples: string[] = [];
  const productCounts: Record<string, number> = {};
  let currentItems: Partial<Record<Category, Product>> = {};
  let totalPicks = 0;
  let repeatedPicks = 0;
  let eyewearRuns = 0;
  let jewelryRuns = 0;
  let mismatchCount = 0;
  let categoryMismatchCount = 0;
  let offFrameCount = 0;
  let vibeContradictions = 0;
  let accessoryOveruseRuns = 0;
  let weakCategoryMatches = 0;
  let missingRequiredRuns = 0;
  let missingTopRuns = 0;
  let missingBottomRuns = 0;
  let missingShoesRuns = 0;
  let completeRequiredRuns = 0;
  const warningSamples: string[] = [];

  for (let run = 0; run < RUNS_PER_SCENARIO; run += 1) {
    const currentIds = productIds(currentItems);
    const result = buildCatalogLook({
      vibe,
      frame,
      budget: 'any',
      mode: 'full',
      seed: 40_000 + run * 1_019 + label.length * 53,
      currentItems,
      avoidProductIds: Array.from(new Set([...recentIds, ...currentIds])),
    });

    const products = result.products;
    const ids = productIds(products);
    totalPicks += ids.length;

    for (const product of Object.values(products).filter((item): item is Product => Boolean(item))) {
      if (seen.has(product.id)) repeatedPicks += 1;
      seen.add(product.id);
      counts.set(product.id, {
        label: productLabel(product),
        count: (counts.get(product.id)?.count || 0) + 1,
      });
      productCounts[product.id] = (productCounts[product.id] || 0) + 1;
      if (genderMismatchReasons(product, frame).length) mismatchCount += 1;
      if (hasCategoryMismatch(product)) categoryMismatchCount += 1;
      if (isOffFrame(product, frame)) offFrameCount += 1;
      const qualityWarnings = getVibeQualityWarnings(product, vibe, frame);
      if (qualityWarnings.length) {
        weakCategoryMatches += 1;
        if (qualityWarnings.some((warning) => warning.includes('hard-avoids'))) vibeContradictions += 1;
        if (warningSamples.length < 4) {
          warningSamples.push(`${product.category}:${productLabel(product)} -> ${qualityWarnings.join('; ')}`);
        }
      }
    }

    if (products.eyewear) eyewearRuns += 1;
    if (products.jewelry) jewelryRuns += 1;
    const missingTop = !products.top;
    const missingBottom = !products.bottom;
    const missingShoes = !products.shoes;
    if (missingTop || missingBottom || missingShoes) missingRequiredRuns += 1;
    if (missingTop) missingTopRuns += 1;
    if (missingBottom) missingBottomRuns += 1;
    if (missingShoes) missingShoesRuns += 1;
    if (!missingTop && !missingBottom && !missingShoes) completeRequiredRuns += 1;
    if (isAccessoryOveruse(vibe, products)) accessoryOveruseRuns += 1;

    for (const category of CATEGORY_ORDER) {
      if (!products[category]) {
        missingByCategory[category] = (missingByCategory[category] || 0) + 1;
      }
    }

    if (samples.length < 2) samples.push(slotSummary(products));
    currentItems = products;
    recentIds.unshift(...ids);
    recentIds.splice(72);
  }

  return {
    label,
    frame,
    totalPicks,
    uniqueIds: seen.size,
    repeatRate: totalPicks ? repeatedPicks / totalPicks : 0,
    averageItems: totalPicks / RUNS_PER_SCENARIO,
    eyewearRuns,
    jewelryRuns,
    mismatchCount,
    categoryMismatchCount,
    offFrameCount,
    vibeContradictions,
    accessoryOveruseRuns,
    weakCategoryMatches,
    missingByCategory,
    repeatedProducts: Array.from(counts.values())
      .filter((entry) => entry.count > 1)
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    warningSamples,
    samples,
    productCounts,
    missingRequiredRuns,
    missingTopRuns,
    missingBottomRuns,
    missingShoesRuns,
    completeRequiredRuns,
  };
}

function formatMissing(missingByCategory: Partial<Record<Category, number>>): string {
  const entries = CATEGORY_ORDER
    .map((category) => [category, missingByCategory[category] || 0] as const)
    .filter(([, count]) => count > 0);

  if (!entries.length) return 'none';
  return entries.map(([category, count]) => `${category}:${count}`).join(', ');
}

interface LockScenarioReport {
  label: string;
  passed: boolean;
  lockedSlots: Category[];
  changedUnlockedSlots: number;
  badImageCount: number;
  sample: string;
  failures: string[];
}

function simulateLockedGenerationScenario({
  label,
  vibe,
  frame,
  lockedSlots,
}: {
  label: string;
  vibe: VibeId;
  frame: GeneratorFrame;
  lockedSlots: Category[];
}): LockScenarioReport {
  const base = buildCatalogLook({
    vibe,
    frame,
    budget: 'any',
    mode: 'full',
    seed: 91_000 + label.length * 97,
  });
  const lockedItems = Object.fromEntries(
    lockedSlots
      .map((slot) => [slot, base.products[slot]] as const)
      .filter((entry): entry is readonly [Category, Product] => Boolean(entry[1])),
  ) as Partial<Record<Category, Product>>;
  const unlockedSlots = CATEGORY_ORDER.filter((slot) => !lockedItems[slot]);
  const next = buildCatalogLook({
    vibe,
    frame,
    budget: 'any',
    mode: 'refresh',
    seed: 94_000 + label.length * 131,
    currentItems: lockedItems,
    targetSlots: unlockedSlots,
    avoidProductIds: productIds(base.products),
  });
  const merged = {
    ...lockedItems,
    ...next.products,
  };
  const failures: string[] = [];

  for (const slot of Object.keys(lockedItems) as Category[]) {
    if (merged[slot]?.id !== lockedItems[slot]?.id) {
      failures.push(`${slot} changed from locked product`);
    }
  }

  const changedUnlockedSlots = unlockedSlots.filter((slot) => {
    const before = base.products[slot]?.id;
    const after = merged[slot]?.id;
    return Boolean(before && after && before !== after);
  }).length;
  const badImageCount = Object.values(merged)
    .filter((product): product is Product => Boolean(product))
    .filter((product) => !isRenderableProduct(product)).length;

  if (Object.keys(lockedItems).length !== lockedSlots.length) {
    failures.push('base look could not fill every requested locked slot');
  }
  if (changedUnlockedSlots < 2) {
    failures.push('fewer than two unlocked slots changed');
  }
  if (badImageCount) {
    failures.push(`${badImageCount} non-renderable products in merged locked look`);
  }

  return {
    label,
    passed: failures.length === 0,
    lockedSlots: Object.keys(lockedItems) as Category[],
    changedUnlockedSlots,
    badImageCount,
    sample: slotSummary(merged),
    failures,
  };
}

const lockReports = [
  simulateLockedGenerationScenario({ label: 'office fem keeps top+shoes', vibe: 'office', frame: 'fem', lockedSlots: ['top', 'shoes'] }),
  simulateLockedGenerationScenario({ label: 'street masc keeps outer+shoes', vibe: 'street', frame: 'masc', lockedSlots: ['outer', 'shoes'] }),
  simulateLockedGenerationScenario({ label: 'vacation fem keeps top+bag', vibe: 'vacation', frame: 'fem', lockedSlots: ['top', 'bag'] }),
];

const reports = SCENARIOS.map(simulateScenario);
const aggregateProductCounts = new Map<string, number>();
let aggregatePicks = 0;
let aggregateUnique = 0;
let aggregateMissingRequiredRuns = 0;
let aggregateMissingTopRuns = 0;
let aggregateMissingBottomRuns = 0;
let aggregateMissingShoesRuns = 0;
let aggregateCompleteRequiredRuns = 0;
let aggregateMismatchCount = 0;
let aggregateCategoryMismatchCount = 0;
let aggregateOffFrameCount = 0;
let aggregateVibeContradictions = 0;

for (const report of reports) {
  aggregatePicks += report.totalPicks;
  aggregateUnique += report.uniqueIds;
  aggregateMissingRequiredRuns += report.missingRequiredRuns;
  aggregateMissingTopRuns += report.missingTopRuns;
  aggregateMissingBottomRuns += report.missingBottomRuns;
  aggregateMissingShoesRuns += report.missingShoesRuns;
  aggregateCompleteRequiredRuns += report.completeRequiredRuns;
  aggregateMismatchCount += report.mismatchCount;
  aggregateCategoryMismatchCount += report.categoryMismatchCount;
  aggregateOffFrameCount += report.offFrameCount;
  aggregateVibeContradictions += report.vibeContradictions;
  for (const [id, count] of Object.entries(report.productCounts)) {
    aggregateProductCounts.set(id, (aggregateProductCounts.get(id) || 0) + count);
  }
}

const totalRuns = reports.length * RUNS_PER_SCENARIO;
const completionRateTopBottomShoes = totalRuns ? aggregateCompleteRequiredRuns / totalRuns : 0;

console.log(`Generator variety simulation: ${RUNS_PER_SCENARIO} full-look runs per scenario`);
console.log('No SearchAPI calls are made by this script.');
console.log(
  [
    `Aggregate outfits=${reports.length * RUNS_PER_SCENARIO}`,
    `uniqueProducts=${aggregateProductCounts.size}`,
    `totalPicks=${aggregatePicks}`,
    `catalogUseRate=${((aggregateProductCounts.size / aggregatePicks) * 100).toFixed(1)}%`,
    `scenarioUniqueSum=${aggregateUnique}`,
    `missingRequiredRuns=${aggregateMissingRequiredRuns}`,
    `missingTop=${aggregateMissingTopRuns}`,
    `missingBottom=${aggregateMissingBottomRuns}`,
    `missingShoes=${aggregateMissingShoesRuns}`,
    `completionRateTopBottomShoes=${(completionRateTopBottomShoes * 100).toFixed(1)}%`,
    `genderMismatches=${aggregateMismatchCount}`,
    `categoryMismatches=${aggregateCategoryMismatchCount}`,
    `offFrame=${aggregateOffFrameCount}`,
    `vibeContradictions=${aggregateVibeContradictions}`,
  ].join('  '),
);
// Machine-parseable single-line summary — read by scripts/qa-check.ts to
// gate CI on outfit completeness. Format: `SUMMARY_JSON: { … }`.
const summary = {
  totalOutfits: totalRuns,
  uniqueProducts: aggregateProductCounts.size,
  totalPicks: aggregatePicks,
  missingRequiredRuns: aggregateMissingRequiredRuns,
  missingTop: aggregateMissingTopRuns,
  missingBottom: aggregateMissingBottomRuns,
  missingShoes: aggregateMissingShoesRuns,
  completionRateTopBottomShoes,
  genderMismatches: aggregateMismatchCount,
  categoryMismatches: aggregateCategoryMismatchCount,
  offFrame: aggregateOffFrameCount,
  vibeContradictions: aggregateVibeContradictions,
};
console.log(`SUMMARY_JSON: ${JSON.stringify(summary)}`);
console.log('');

for (const report of reports) {
  console.log(
    [
      report.label.padEnd(17),
      `avgItems=${report.averageItems.toFixed(1)}`,
      `unique=${report.uniqueIds}/${report.totalPicks}`,
      `repeatRate=${(report.repeatRate * 100).toFixed(1)}%`,
      `eyewear=${report.eyewearRuns}/${RUNS_PER_SCENARIO}`,
      `jewelry=${report.jewelryRuns}/${RUNS_PER_SCENARIO}`,
      `mismatch=${report.mismatchCount}`,
      `catMismatch=${report.categoryMismatchCount}`,
      `offFrame=${report.offFrameCount}`,
      `vibeContradictions=${report.vibeContradictions}`,
      `accessoryOveruse=${report.accessoryOveruseRuns}/${RUNS_PER_SCENARIO}`,
      `weakCategory=${report.weakCategoryMatches}`,
      `missingRequired=${report.missingRequiredRuns}`,
      `missing=${formatMissing(report.missingByCategory)}`,
    ].join('  '),
  );
}

console.log('\nTop repeated products:');
const globalRepeated = Array.from(aggregateProductCounts.entries())
  .filter(([, count]) => count > 1)
  .sort((left, right) => right[1] - left[1])
  .slice(0, 12);
console.log(
  `  global: ${
    globalRepeated.length
      ? globalRepeated.map(([id, count]) => `${id} (${count})`).join('; ')
      : 'none'
  }`,
);
for (const report of reports) {
  const repeated = report.repeatedProducts.length
    ? report.repeatedProducts.map((entry) => `${entry.label} (${entry.count})`).join('; ')
    : 'none';
  console.log(`  ${report.label}: ${repeated}`);
}

console.log('\nSample outfits:');
for (const report of reports) {
  console.log(`\n${report.label}`);
  report.samples.forEach((sample, index) => console.log(`  ${index + 1}. ${sample}`));
}

console.log('\nQuality warnings:');
for (const report of reports) {
  if (!report.warningSamples.length) {
    console.log(`  ${report.label}: none`);
    continue;
  }
  console.log(`  ${report.label}:`);
  report.warningSamples.forEach((warning) => console.log(`    - ${warning}`));
}

const mismatchReports = reports.filter((report) => report.mismatchCount > 0 || report.categoryMismatchCount > 0 || report.offFrameCount > 8);
if (mismatchReports.length) {
  console.log('\nFrame warning:');
  for (const report of mismatchReports) {
    console.log(`  ${report.label}: mismatch=${report.mismatchCount}, categoryMismatch=${report.categoryMismatchCount}, offFrame=${report.offFrameCount}`);
  }
}

console.log('\nLocked item regeneration:');
for (const report of lockReports) {
  console.log(
    [
      `  ${report.passed ? 'PASS' : 'FAIL'} ${report.label}`,
      `locked=${report.lockedSlots.join(',') || 'none'}`,
      `changedUnlocked=${report.changedUnlockedSlots}`,
      `badImages=${report.badImageCount}`,
    ].join('  '),
  );
  if (report.failures.length) {
    report.failures.forEach((failure) => console.log(`    - ${failure}`));
  }
  console.log(`    ${report.sample}`);
}

if (lockReports.some((report) => !report.passed)) {
  process.exitCode = 1;
}



