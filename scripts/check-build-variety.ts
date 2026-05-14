import {
  buildCatalogLook,
  collectOutfitProductIds,
  getBrandOrMerchant,
  getShoeId,
  getVibeQualityWarnings,
  outfitFullSignature,
  outfitRequiredSignature,
} from '../lib/catalog';
import { genderMismatchReasons } from '../lib/frame-inference';
import { isRenderableProduct } from '../lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';
import type { GeneratorFrame, VibeId } from '../lib/vibes';

const RUNS_PER_SCENARIO = 25;

const SCENARIOS: Array<{ label: string; vibe: VibeId; frame: GeneratorFrame }> = [
  { label: 'clean masc', vibe: 'clean', frame: 'masc' },
  { label: 'clean fem', vibe: 'clean', frame: 'fem' },
  { label: 'streetwear masc', vibe: 'street', frame: 'masc' },
  { label: 'streetwear fem', vibe: 'street', frame: 'fem' },
  { label: 'gym masc', vibe: 'gym', frame: 'masc' },
  { label: 'gym fem', vibe: 'gym', frame: 'fem' },
  { label: 'office masc', vibe: 'office', frame: 'masc' },
  { label: 'office fem', vibe: 'office', frame: 'fem' },
  { label: 'date masc', vibe: 'date', frame: 'masc' },
  { label: 'date fem', vibe: 'date', frame: 'fem' },
  { label: 'travel masc', vibe: 'clean', frame: 'masc' },
  { label: 'travel fem', vibe: 'clean', frame: 'fem' },
];

function productLabel(product: Product): string {
  return `${product.brand} ${product.name}`.replace(/\s+/g, ' ').trim();
}

function bump<T>(map: Map<T, number>, key: T) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topNumberCounts<T>(map: Map<T, number>, labeler: (key: T) => string, limit = 5): string {
  const rows = Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key, count]) => `${labeler(key)} x${count}`);
  return rows.length ? rows.join('; ') : 'none';
}

function topProductCounts(map: Map<string, { product: Product; count: number }>, limit = 5): string {
  const rows = Array.from(map.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((entry) => `${productLabel(entry.product)} x${entry.count}`);
  return rows.length ? rows.join('; ') : 'none';
}

function simulateScenario({ label, vibe, frame }: { label: string; vibe: VibeId; frame: GeneratorFrame }) {
  const recentIds: string[] = [];
  const recentShoes: string[] = [];
  const requiredCombos: string[] = [];
  const fullCombos: string[] = [];
  const brandCounts: Record<string, number> = {};
  const productCounts = new Map<string, { product: Product; count: number }>();
  const shoeCounts = new Map<string, { product: Product; count: number }>();
  const brandTotals = new Map<string, number>();
  const formulaCounts = new Map<string, number>();
  const requiredComboCounts = new Map<string, number>();
  const fullComboCounts = new Map<string, number>();
  let missingTop = 0;
  let missingBottom = 0;
  let missingShoes = 0;
  let unrenderableCount = 0;
  let genderMismatches = 0;
  let vibeContradictions = 0;
  let totalItems = 0;

  for (let run = 0; run < RUNS_PER_SCENARIO; run += 1) {
    const result = buildCatalogLook({
      vibe,
      frame,
      budget: 'under500',
      mode: 'full',
      seed: 250_000 + run * 2_041 + label.length * 131,
      avoidProductIds: recentIds,
      avoidComboSignatures: [...requiredCombos, ...fullCombos],
      recentShoeIds: recentShoes,
      recentBrandCounts: brandCounts,
      recentFormulaIds: Array.from(formulaCounts.entries()).sort((left, right) => right[1] - left[1]).map(([id]) => id).slice(0, 8),
      diversityStrength: 'high',
    });
    const products = result.products;
    bump(formulaCounts, result.formula.id);
    if (!products.top) missingTop += 1;
    if (!products.bottom) missingBottom += 1;
    if (!products.shoes) missingShoes += 1;

    const requiredSig = outfitRequiredSignature(products);
    const fullSig = outfitFullSignature(products);
    bump(requiredComboCounts, requiredSig);
    bump(fullComboCounts, fullSig);
    requiredCombos.unshift(requiredSig);
    fullCombos.unshift(fullSig);
    requiredCombos.splice(20);
    fullCombos.splice(20);

    const shoeId = getShoeId(products);
    if (shoeId) {
      recentShoes.unshift(shoeId);
      recentShoes.splice(12);
    }

    const ids = collectOutfitProductIds(products);
    recentIds.unshift(...ids);
    recentIds.splice(64);

    for (const product of Object.values(products).filter((item): item is Product => Boolean(item))) {
      totalItems += 1;
      if (!isRenderableProduct(product)) unrenderableCount += 1;
      if (genderMismatchReasons(product, frame).length) genderMismatches += 1;
      if (getVibeQualityWarnings(product, vibe, frame).some((warning) => warning.includes('hard-avoids'))) vibeContradictions += 1;
      productCounts.set(product.id, {
        product,
        count: (productCounts.get(product.id)?.count || 0) + 1,
      });
      if (product.category === 'shoes') {
        shoeCounts.set(product.id, {
          product,
          count: (shoeCounts.get(product.id)?.count || 0) + 1,
        });
      }
      const brand = getBrandOrMerchant(product);
      if (brand) {
        brandCounts[brand] = Math.min(12, (brandCounts[brand] || 0) + 1);
        bump(brandTotals, brand);
      }
    }
  }

  const duplicateRequiredCombos = Array.from(requiredComboCounts.values()).filter((count) => count > 1).length;
  const duplicateFullCombos = Array.from(fullComboCounts.values()).filter((count) => count > 1).length;
  const uniqueProducts = productCounts.size;
  const catalogUseRate = totalItems ? uniqueProducts / totalItems : 0;
  const maxShoeRepeats = Math.max(0, ...Array.from(shoeCounts.values()).map((entry) => entry.count));
  const maxBrandRepeats = Math.max(0, ...Array.from(brandTotals.values()));
  const averageItems = totalItems / RUNS_PER_SCENARIO;
  const failures: string[] = [];

  if (missingTop || missingBottom || missingShoes) failures.push(`missing required slots top=${missingTop} bottom=${missingBottom} shoes=${missingShoes}`);
  if (unrenderableCount) failures.push(`unrenderable=${unrenderableCount}`);
  if (genderMismatches) failures.push(`genderMismatches=${genderMismatches}`);
  if (vibeContradictions) failures.push(`vibeContradictions=${vibeContradictions}`);
  if (duplicateRequiredCombos > 1) failures.push(`duplicateRequiredCombos=${duplicateRequiredCombos}`);
  if (maxShoeRepeats > 10) failures.push(`top shoe repeated ${maxShoeRepeats} times`);
  if (uniqueProducts < 40) failures.push(`uniqueProducts too low (${uniqueProducts})`);
  if (averageItems < 4.5) failures.push(`averageItems too low (${averageItems.toFixed(1)})`);

  return {
    label,
    totalItems,
    uniqueProducts,
    productIds: Array.from(productCounts.keys()),
    catalogUseRate,
    duplicateRequiredCombos,
    duplicateFullCombos,
    missingTop,
    missingBottom,
    missingShoes,
    unrenderableCount,
    genderMismatches,
    vibeContradictions,
    averageItems,
    maxShoeRepeats,
    maxBrandRepeats,
    formulaDiversity: formulaCounts.size,
    topProducts: topProductCounts(productCounts),
    topShoes: topProductCounts(shoeCounts, 4),
    topBrands: topNumberCounts(brandTotals, (brand) => String(brand), 4),
    failures,
  };
}

const reports = SCENARIOS.map(simulateScenario);
const aggregateProductIds = new Set(reports.flatMap((report) => report.productIds));
const aggregateItems = reports.reduce((sum, report) => sum + report.totalItems, 0);
const aggregateDuplicateRequiredCombos = reports.reduce((sum, report) => sum + report.duplicateRequiredCombos, 0);
const aggregateDuplicateFullCombos = reports.reduce((sum, report) => sum + report.duplicateFullCombos, 0);
const aggregateMissingTop = reports.reduce((sum, report) => sum + report.missingTop, 0);
const aggregateMissingBottom = reports.reduce((sum, report) => sum + report.missingBottom, 0);
const aggregateMissingShoes = reports.reduce((sum, report) => sum + report.missingShoes, 0);

console.log(`Build variety simulation: ${RUNS_PER_SCENARIO} generate clicks per scenario`);
console.log(
  [
    'Aggregate:',
    `uniqueProducts=${aggregateProductIds.size}`,
    `catalogUseRate=${aggregateItems ? ((aggregateProductIds.size / aggregateItems) * 100).toFixed(1) : '0.0'}%`,
    `duplicateRequiredCombos=${aggregateDuplicateRequiredCombos}`,
    `duplicateFullCombos=${aggregateDuplicateFullCombos}`,
    `missing=${aggregateMissingTop}/${aggregateMissingBottom}/${aggregateMissingShoes}`,
  ].join('  '),
);
for (const report of reports) {
  console.log(
    [
      report.failures.length ? 'FAIL' : 'PASS',
      report.label.padEnd(15),
      `uniqueProducts=${report.uniqueProducts}`,
      `catalogUseRate=${(report.catalogUseRate * 100).toFixed(1)}%`,
      `duplicateRequiredCombos=${report.duplicateRequiredCombos}`,
      `duplicateFullCombos=${report.duplicateFullCombos}`,
      `missing=${report.missingTop}/${report.missingBottom}/${report.missingShoes}`,
      `gender=${report.genderMismatches}`,
      `unrenderable=${report.unrenderableCount}`,
      `avgItems=${report.averageItems.toFixed(1)}`,
      `maxShoe=${report.maxShoeRepeats}`,
      `maxBrand=${report.maxBrandRepeats}`,
      `formulaDiversity=${report.formulaDiversity}`,
    ].join('  '),
  );
  console.log(`  topProducts: ${report.topProducts}`);
  console.log(`  topShoes: ${report.topShoes}`);
  console.log(`  topBrands: ${report.topBrands}`);
  if (report.failures.length) report.failures.forEach((failure) => console.log(`  - ${failure}`));
}

if (reports.some((report) => report.failures.length)) {
  process.exitCode = 1;
}
