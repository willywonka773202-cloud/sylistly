// Catalog expansion plan - read-only.
//
// Builds a deterministic next-step plan from the runtime catalog. It does not
// call SearchAPI, does not merge candidate data, and does not mutate products.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { validateProduct } from '../lib/catalog-schemas/product.v2';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

type PriceTier = 'under-50' | 'under-150' | 'under-400' | '400-plus' | 'unknown';

interface PlanItem {
  target: string;
  priority: number;
  reason: string;
  recommendedAction: string;
}

interface ExpansionPlanReport {
  generatedAt: string;
  totals: {
    products: number;
    transparentProducts: number;
    originalOnlyProducts: number;
    unsafeImages: number;
    missingProductUrl: number;
  };
  categoryGaps: PlanItem[];
  vibeGaps: PlanItem[];
  priceGaps: PlanItem[];
  imageQualityPlan: PlanItem[];
  searchApiPlan: PlanItem[];
  backgroundRemovalPlan: PlanItem[];
  notes: string[];
}

function priceTier(product: Product): PriceTier {
  if (!Number.isFinite(product.priceCents) || product.priceCents <= 0) return 'unknown';
  if (product.priceCents < 5000) return 'under-50';
  if (product.priceCents < 15000) return 'under-150';
  if (product.priceCents < 40000) return 'under-400';
  return '400-plus';
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) || 0) + amount);
}

function buildReport(): ExpansionPlanReport {
  const products = ALL_CATALOG_PRODUCTS as Product[];
  const byCategory = new Map<Category, number>();
  const byVibe = new Map<string, number>();
  const byPrice = new Map<PriceTier, number>();
  const needsCutoutByCategory = new Map<Category, number>();
  let transparentProducts = 0;
  let originalOnlyProducts = 0;
  let unsafeImages = 0;
  let missingProductUrl = 0;
  const imageBlockingCodes = new Set([
    'IMAGE_URL_DATA_URL',
    'IMAGE_URL_SVG_DATA',
    'IMAGE_URL_SEARCH_INTENT',
    'IMAGE_URL_PLACEHOLDER',
    'IMAGE_URL_UNSAFE_HOST',
    'IMAGE_URL_NOT_STRING',
    'MISSING_IMAGE_URL',
  ]);

  for (const product of products) {
    if (!CATEGORY_ORDER.includes(product.category as Category)) continue;
    const category = product.category as Category;
    increment(byCategory, category);
    increment(byPrice, priceTier(product));
    for (const vibe of [...(product.vibes || []), ...(product.occasions || [])]) {
      if (typeof vibe === 'string' && vibe.trim()) increment(byVibe, vibe.trim().toLowerCase());
    }
    const validation = validateProduct(product);
    const unsafe = validation.issues.some((issue) => imageBlockingCodes.has(issue.code as string));
    if (unsafe) unsafeImages += 1;
    if (!product.productUrl && !product.retailerUrl) missingProductUrl += 1;
    if (product.imageTransparentUrl) {
      transparentProducts += 1;
    } else if (!unsafe && product.imageUrl) {
      originalOnlyProducts += 1;
      increment(needsCutoutByCategory, category);
    }
  }

  const categoryGaps = CATEGORY_ORDER
    .map((category) => {
      const count = byCategory.get(category) || 0;
      const cutoutGap = needsCutoutByCategory.get(category) || 0;
      const target = category === 'top' || category === 'bottom' || category === 'outer' ? 140 : 80;
      const priority = Math.max(0, target - count) + Math.min(35, cutoutGap / 4);
      return {
        target: category,
        priority: Number(priority.toFixed(1)),
        reason: `${count} products now; ${cutoutGap} safe originals still need transparent assets`,
        recommendedAction: count < target
          ? 'Add reviewed products, then run cutout pipeline for high-visibility items.'
          : 'Prioritize cutout generation before adding more volume.',
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => item.priority > 0);

  const requiredVibes = ['clean', 'street', 'office', 'date', 'gym', 'cozy', 'vacation', 'edgy', 'preppy', 'night'];
  const vibeGaps = requiredVibes
    .map((vibe) => {
      const count = byVibe.get(vibe) || 0;
      return {
        target: vibe,
        priority: Math.max(0, 55 - count),
        reason: `${count} products tagged for ${vibe}; target is 55+ for reliable generation variety`,
        recommendedAction: 'Use reviewed additions or SearchAPI candidates, then keep generator tags explicit.',
      };
    })
    .filter((item) => item.priority > 0)
    .sort((a, b) => b.priority - a.priority);

  const priceTargets: Record<PriceTier, number> = {
    'under-50': 90,
    'under-150': 220,
    'under-400': 180,
    '400-plus': 50,
    unknown: 0,
  };
  const priceGaps = (Object.keys(priceTargets) as PriceTier[])
    .map((tier) => {
      const count = byPrice.get(tier) || 0;
      return {
        target: tier,
        priority: Math.max(0, priceTargets[tier] - count),
        reason: `${count} products in ${tier}; target is ${priceTargets[tier]}`,
        recommendedAction: 'Fill price tier gaps with real product URLs and images before expanding adjacent vibes.',
      };
    })
    .filter((item) => item.priority > 0)
    .sort((a, b) => b.priority - a.priority);

  const imageQualityPlan: PlanItem[] = [
    {
      target: 'transparent-assets',
      priority: originalOnlyProducts,
      reason: `${originalOnlyProducts} runtime products still have safe original-only images`,
      recommendedAction: 'Batch local cutout generation in reviewed chunks, starting with Feed/Build-visible products.',
    },
    {
      target: 'unsafe-images',
      priority: unsafeImages * 2,
      reason: `${unsafeImages} products have unsafe or weak image URLs`,
      recommendedAction: 'Use SearchAPI or manual review to replace source images before cutout processing.',
    },
    {
      target: 'missing-product-url',
      priority: missingProductUrl,
      reason: `${missingProductUrl} products are missing a productUrl/retailerUrl`,
      recommendedAction: 'Resolve merchant URLs before considering products live-merge ready.',
    },
  ].filter((item) => item.priority > 0);

  const searchApiPlan: PlanItem[] = categoryGaps.slice(0, 6).map((gap) => ({
    target: `${gap.target} search queries`,
    priority: gap.priority,
    reason: gap.reason,
    recommendedAction: 'Run scripts/searchapi-catalog-expand.ts in dry-run first; live mode should stay capped and review-only.',
  }));

  const backgroundRemovalPlan: PlanItem[] = categoryGaps.slice(0, 8).map((gap) => ({
    target: `${gap.target} cutout queue`,
    priority: gap.priority,
    reason: gap.reason,
    recommendedAction: 'Run prepare-cutout-candidates, generate a limited local batch, register only verified transparent files.',
  }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      products: products.length,
      transparentProducts,
      originalOnlyProducts,
      unsafeImages,
      missingProductUrl,
    },
    categoryGaps,
    vibeGaps,
    priceGaps,
    imageQualityPlan,
    searchApiPlan,
    backgroundRemovalPlan,
    notes: [
      'SearchAPI can improve original product images and URLs, but does not remove backgrounds.',
      'Background removal should run in batches and land in public/assets/cutouts before registration.',
      'Expansion packs should remain candidate/review-only until quality checks pass.',
    ],
  };
}

function writeJsonReport(report: ExpansionPlanReport): void {
  const outDir = join(process.cwd(), 'data', 'catalog', 'reports');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'catalog-expansion-plan-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

function printHuman(report: ExpansionPlanReport): void {
  console.log('Catalog Expansion Plan');
  console.log('======================');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Products: ${report.totals.products}`);
  console.log(`Transparent products: ${report.totals.transparentProducts}`);
  console.log(`Original-only products: ${report.totals.originalOnlyProducts}`);
  console.log(`Unsafe images: ${report.totals.unsafeImages}`);
  console.log('');
  console.log('Top category targets');
  console.log('--------------------');
  for (const item of report.categoryGaps.slice(0, 8)) {
    console.log(`  ${item.target}: p=${item.priority} - ${item.reason}`);
  }
  console.log('');
  console.log('Top vibe targets');
  console.log('----------------');
  for (const item of report.vibeGaps.slice(0, 8)) {
    console.log(`  ${item.target}: p=${item.priority} - ${item.reason}`);
  }
  console.log('');
  console.log('Image work');
  console.log('----------');
  for (const item of report.imageQualityPlan) {
    console.log(`  ${item.target}: p=${item.priority} - ${item.reason}`);
  }
}

function main(): void {
  const json = process.argv.includes('--json');
  const report = buildReport();
  writeJsonReport(report);
  if (json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
}

main();
