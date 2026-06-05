// Catalog coverage report — read-only.
//
// Helps answer "where does the catalog need to grow?" without
// touching live data or calling external services.  Cross-tabs the
// runtime catalog by category × frame × price tier × transparent-
// image status, then surfaces the thinnest combinations and the most
// over-represented brands.
//
//   npx jiti scripts/catalog-coverage.ts
//   npx jiti scripts/catalog-coverage.ts --json

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { BRAND_CATALOG_PRODUCTS } from '../lib/brand-catalog';
import { DROP_CATALOG_PRODUCTS } from '../lib/drop-catalog';
import { GENERATED_CATALOG_PRODUCTS } from '../lib/generated-catalog';
import { PHOTO_CATALOG_PRODUCTS } from '../lib/photo-catalog';
import { SEARCHAPI_QUALITY_PRODUCTS } from '../lib/searchapi-quality-catalog';
import { validateProduct } from '../lib/catalog-schemas/product.v2';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

interface CliFlags {
  json: boolean;
}

function parseFlags(argv: string[]): CliFlags {
  return { json: argv.includes('--json') };
}

type Frame = 'masc' | 'fem' | 'androgynous' | 'unspecified';
type PriceTier = 'under-50' | 'under-150' | 'under-400' | '400-plus' | 'unknown';

function classifyFrame(product: Product): Frame {
  if (!Array.isArray(product.gender) || product.gender.length === 0) return 'unspecified';
  if (product.gender.includes('masc') && !product.gender.includes('fem')) return 'masc';
  if (product.gender.includes('fem') && !product.gender.includes('masc')) return 'fem';
  if (product.gender.includes('androgynous')) return 'androgynous';
  return 'unspecified';
}

function classifyPriceTier(product: Product): PriceTier {
  if (typeof product.priceCents !== 'number' || product.priceCents <= 0) return 'unknown';
  if (product.priceCents < 5000) return 'under-50';
  if (product.priceCents < 15000) return 'under-150';
  if (product.priceCents < 40000) return 'under-400';
  return '400-plus';
}

interface CoverageReport {
  generatedAt: string;
  total: number;
  byCategory: Record<Category, number>;
  bySource: Record<string, number>;
  byFrame: Record<Frame, number>;
  byPriceTier: Record<PriceTier, number>;
  byCategoryAndFrame: Record<Category, Record<Frame, number>>;
  byCategoryAndPriceTier: Record<Category, Record<PriceTier, number>>;
  topBrands: Array<{ brand: string; count: number }>;
  topVibes: Array<{ vibe: string; count: number }>;
  transparent: {
    withTransparent: number;
    originalOnly: number;
    unsafeImages: number;
    needsCutout: number;
    transparentByCategory: Record<Category, number>;
    needsCutoutByCategory: Record<Category, number>;
  };
  missingAssets: {
    missingProductUrl: number;
    missingImageUrl: number;
    registeredTransparentUrlMissingFile: string[];
  };
  thinCombinations: Array<{ category: Category; frame: Frame; count: number }>;
  thinPriceTiers: Array<{ category: Category; priceTier: PriceTier; count: number }>;
  overrepresentedBrands: Array<{ brand: string; share: number }>;
  recommendedNextExpansionCategories: Array<{ category: Category; reason: string; priority: number }>;
}

function emptyCategoryRecord<T>(value: () => T): Record<Category, T> {
  return Object.fromEntries(CATEGORY_ORDER.map((category) => [category, value()])) as Record<Category, T>;
}

function build(): CoverageReport {
  const products: Product[] = ALL_CATALOG_PRODUCTS as Product[];
  const sourceById = new Map<string, string>();
  for (const product of DROP_CATALOG_PRODUCTS as Product[]) sourceById.set(product.id, 'drop-catalog');
  for (const product of SEARCHAPI_QUALITY_PRODUCTS as Product[]) sourceById.set(product.id, 'searchapi-quality-catalog');
  for (const product of BRAND_CATALOG_PRODUCTS as Product[]) sourceById.set(product.id, 'brand-catalog');
  for (const product of GENERATED_CATALOG_PRODUCTS as Product[]) sourceById.set(product.id, 'generated-catalog');
  for (const product of PHOTO_CATALOG_PRODUCTS as Product[]) sourceById.set(product.id, sourceById.get(product.id) || 'photo-catalog');

  const byCategory = emptyCategoryRecord(() => 0);
  const bySource: Record<string, number> = {};
  const byFrame: Record<Frame, number> = { masc: 0, fem: 0, androgynous: 0, unspecified: 0 };
  const byPriceTier: Record<PriceTier, number> = { 'under-50': 0, 'under-150': 0, 'under-400': 0, '400-plus': 0, unknown: 0 };
  const byCategoryAndFrame = emptyCategoryRecord<Record<Frame, number>>(() => ({ masc: 0, fem: 0, androgynous: 0, unspecified: 0 }));
  const byCategoryAndPriceTier = emptyCategoryRecord<Record<PriceTier, number>>(() => ({ 'under-50': 0, 'under-150': 0, 'under-400': 0, '400-plus': 0, unknown: 0 }));
  const brandCounts = new Map<string, number>();
  const vibeCounts = new Map<string, number>();
  const transparentByCategory = emptyCategoryRecord(() => 0);
  const needsCutoutByCategory = emptyCategoryRecord(() => 0);
  let withTransparent = 0;
  let originalOnly = 0;
  let unsafeImages = 0;
  let needsCutout = 0;
  let missingProductUrl = 0;
  let missingImageUrl = 0;
  const registeredTransparentUrlMissingFile: string[] = [];
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
    if (!product || !CATEGORY_ORDER.includes(product.category as Category)) continue;
    const category = product.category as Category;
    const source = sourceById.get(product.id) || 'runtime';
    bySource[source] = (bySource[source] || 0) + 1;
    byCategory[category] += 1;
    const frame = classifyFrame(product);
    byFrame[frame] += 1;
    byCategoryAndFrame[category][frame] += 1;
    const tier = classifyPriceTier(product);
    byPriceTier[tier] += 1;
    byCategoryAndPriceTier[category][tier] += 1;
    if (product.brand) brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
    for (const vibe of [...(product.vibes || []), ...(product.occasions || [])]) {
      if (typeof vibe === 'string') vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
    }
    const validation = validateProduct(product);
    const isUnsafe = validation.issues.some((issue) => imageBlockingCodes.has(issue.code as string));
    if (isUnsafe) unsafeImages += 1;
    if (!product.productUrl && !product.retailerUrl) missingProductUrl += 1;
    if (!product.imageUrl) missingImageUrl += 1;

    const transparent = product.imageTransparentUrl;
    if (typeof transparent === 'string' && transparent.trim() && !transparent.startsWith('data:')) {
      withTransparent += 1;
      transparentByCategory[category] += 1;
      if (transparent.startsWith('/assets/cutouts/')) {
        const filePath = join(process.cwd(), 'public', transparent.replace(/^\//, ''));
        if (!existsSync(filePath)) registeredTransparentUrlMissingFile.push(transparent);
      }
    } else if (!isUnsafe && typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
      originalOnly += 1;
      needsCutout += 1;
      needsCutoutByCategory[category] += 1;
    }
  }

  const total = products.length;
  const topBrands = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([brand, count]) => ({ brand, count }));
  const topVibes = Array.from(vibeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([vibe, count]) => ({ vibe, count }));

  const thinCombinations: Array<{ category: Category; frame: Frame; count: number }> = [];
  for (const category of CATEGORY_ORDER) {
    for (const frame of ['masc', 'fem', 'androgynous'] as Frame[]) {
      const count = byCategoryAndFrame[category][frame];
      if (count <= 4) thinCombinations.push({ category, frame, count });
    }
  }
  thinCombinations.sort((a, b) => a.count - b.count);

  const thinPriceTiers: Array<{ category: Category; priceTier: PriceTier; count: number }> = [];
  for (const category of CATEGORY_ORDER) {
    for (const tier of ['under-50', 'under-150', 'under-400', '400-plus'] as PriceTier[]) {
      const count = byCategoryAndPriceTier[category][tier];
      if (count <= 3) thinPriceTiers.push({ category, priceTier: tier, count });
    }
  }
  thinPriceTiers.sort((a, b) => a.count - b.count);

  const overrepresentedBrands = topBrands
    .filter((entry) => entry.count / Math.max(1, total) > 0.04)
    .map((entry) => ({ brand: entry.brand, share: Number((entry.count / total).toFixed(3)) }));

  const recommendedNextExpansionCategories = CATEGORY_ORDER
    .map((category) => {
      const count = byCategory[category];
      const transparentGap = needsCutoutByCategory[category];
      const thinFramePenalty = thinCombinations.filter((entry) => entry.category === category).length * 8;
      const priority = Math.max(0, 120 - count) + Math.min(40, transparentGap / 3) + thinFramePenalty;
      return {
        category,
        priority: Number(priority.toFixed(1)),
        reason: `${count} runtime products, ${transparentGap} still need transparent assets`,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    total,
    byCategory,
    bySource,
    byFrame,
    byPriceTier,
    byCategoryAndFrame,
    byCategoryAndPriceTier,
    topBrands,
    topVibes,
    transparent: { withTransparent, originalOnly, unsafeImages, needsCutout, transparentByCategory, needsCutoutByCategory },
    missingAssets: { missingProductUrl, missingImageUrl, registeredTransparentUrlMissingFile },
    thinCombinations,
    thinPriceTiers,
    overrepresentedBrands,
    recommendedNextExpansionCategories,
  };
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function printHuman(report: CoverageReport): void {
  console.log('Catalog Coverage');
  console.log('================');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Total products: ${report.total}`);
  console.log('');
  console.log('By category');
  console.log('-----------');
  for (const [category, count] of Object.entries(report.byCategory)) {
    console.log(`  ${pad(category, 14)} ${count}`);
  }
  console.log('');
  console.log('By source');
  console.log('---------');
  for (const [source, count] of Object.entries(report.bySource)) {
    console.log(`  ${pad(source, 18)} ${count}`);
  }
  console.log('');
  console.log('By frame/gender');
  console.log('---------------');
  for (const [frame, count] of Object.entries(report.byFrame)) {
    console.log(`  ${pad(frame, 14)} ${count}`);
  }
  console.log('');
  console.log('By price tier');
  console.log('-------------');
  for (const [tier, count] of Object.entries(report.byPriceTier)) {
    console.log(`  ${pad(tier, 14)} ${count}`);
  }
  console.log('');
  console.log('Top 10 brands');
  console.log('-------------');
  for (const entry of report.topBrands.slice(0, 10)) {
    console.log(`  ${pad(entry.brand, 30)} ${entry.count}`);
  }
  console.log('');
  console.log('Transparent-asset coverage');
  console.log('--------------------------');
  console.log(`  with transparent : ${report.transparent.withTransparent}`);
  console.log(`  original-only    : ${report.transparent.originalOnly}`);
  console.log(`  unsafe images    : ${report.transparent.unsafeImages}`);
  console.log(`  needs cutout     : ${report.transparent.needsCutout}`);
  console.log(`  missing cutout files: ${report.missingAssets.registeredTransparentUrlMissingFile.length}`);
  console.log('');
  console.log('Thinnest category × frame combinations (<=4)');
  console.log('--------------------------------------------');
  for (const row of report.thinCombinations.slice(0, 12)) {
    console.log(`  ${pad(row.category, 14)} ${pad(row.frame, 14)} ${row.count}`);
  }
  console.log('');
  console.log('Overrepresented brands (>4% share)');
  console.log('----------------------------------');
  for (const row of report.overrepresentedBrands) {
    console.log(`  ${pad(row.brand, 30)} ${(row.share * 100).toFixed(1)}%`);
  }
  console.log('');
  console.log('Recommended next expansion categories');
  console.log('--------------------------------------');
  for (const row of report.recommendedNextExpansionCategories) {
    console.log(`  ${pad(row.category, 14)} p=${row.priority}  ${row.reason}`);
  }
}

function writeJsonReport(report: CoverageReport): void {
  const outDir = join(process.cwd(), 'data', 'catalog', 'reports');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'catalog-coverage-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const report = build();
  writeJsonReport(report);
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exit(0);
}

main();
