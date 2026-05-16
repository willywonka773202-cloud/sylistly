// Catalog image audit — read-only.
//
// Surfaces, per source, how many products have original-only images,
// transparent cutouts, or unsafe images. Reports candidates that would
// benefit from a transparent-asset pipeline.  Does NOT call any
// external API. Does NOT mutate catalog data.
//
//   npx jiti scripts/catalog-image-audit.ts
//   npx jiti scripts/catalog-image-audit.ts --json
//   npx jiti scripts/catalog-image-audit.ts --limit=40 --verbose
//
// Exit code is always 0 — this is an advisory audit, not a release gate.

import { BRAND_CATALOG_PRODUCTS } from '../lib/brand-catalog';
import { GENERATED_CATALOG_PRODUCTS } from '../lib/generated-catalog';
import { PHOTO_CATALOG_PRODUCTS } from '../lib/photo-catalog';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { applyCatalogCutoutOverridesToProducts } from '../lib/catalog-cutout-overrides';
import { validateProduct } from '../lib/catalog-schemas/product.v2';
import type { Category, Product } from '../lib/types';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type SourceLabel = 'brand-catalog' | 'generated-catalog' | 'photo-catalog';

interface ImageAuditRow {
  source: SourceLabel;
  id: string;
  brand: string;
  name: string;
  category: Category | 'unknown';
  imageUrl: string;
  hasTransparent: boolean;
  imageSource?: string;
  imageStatus?: string;
  isSafe: boolean;
  needsCutout: boolean;
  signals: string[];
}

interface ImageAuditReport {
  generatedAt: string;
  totals: {
    products: number;
    withTransparent: number;
    withOriginalOnly: number;
    withUnsafeImage: number;
    needsCutoutPriority: number;
  };
  bySource: Array<{
    label: SourceLabel;
    total: number;
    withTransparent: number;
    withOriginalOnly: number;
    withUnsafeImage: number;
    needsCutoutPriority: number;
  }>;
  byCategoryNeedingCutout: Record<string, number>;
  topCutoutCandidates: ImageAuditRow[];
  runtimeTransparentProducts: Array<{
    id: string;
    title: string;
    category: Category;
    imageUrl: string;
    imageTransparentUrl: string;
    publicFileExists: boolean;
    productImageShouldPrefer: boolean;
  }>;
  routeVisibility: {
    discover: Array<{ id: string; title: string; category: Category; section: string }>;
    feedFirst50: Array<{ id: string; title: string; category: Category }>;
    wardrobe: string;
    saved: string;
    canvas: string;
  };
  generatedAssets: {
    cutoutDir: string;
    totalFiles: number;
    registeredFiles: number;
    missingCatalogRegistration: string[];
    registeredLocalUrlsMissingFiles: string[];
  };
}

interface CliFlags {
  json: boolean;
  verbose: boolean;
  limit: number;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { json: false, verbose: false, limit: 50 };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--verbose') flags.verbose = true;
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.limit = Math.min(n, 500);
    }
  }
  return flags;
}

const RETAIL_BACKGROUND_HINTS = [
  // URL fragments that often correlate with retailer white-background
  // product photos. Pure heuristic — used only to PRIORITIZE candidates,
  // never to claim a product has a white background.
  '/product/',
  '/shop/',
  '_white',
  'white-bg',
  'pdp',
  'productimage',
  'product-image',
  '/dw/image',
  'dimg',
  '/is/image',
];

function looksRetailWhite(url: string): boolean {
  const normalized = url.toLowerCase();
  return RETAIL_BACKGROUND_HINTS.some((hint) => normalized.includes(hint));
}

function runtimeTransparentRows(root: string): ImageAuditReport['runtimeTransparentProducts'] {
  return (ALL_CATALOG_PRODUCTS as Product[])
    .filter((product) => typeof product.imageTransparentUrl === 'string' && product.imageTransparentUrl.trim())
    .map((product) => {
      const transparentUrl = product.imageTransparentUrl || '';
      const filePath = transparentUrl.startsWith('/assets/')
        ? join(root, 'public', transparentUrl.replace(/^\//, ''))
        : '';
      return {
        id: product.id,
        title: `${product.brand} ${product.name}`,
        category: product.category,
        imageUrl: product.imageUrl,
        imageTransparentUrl: transparentUrl,
        publicFileExists: Boolean(filePath && existsSync(filePath)),
        productImageShouldPrefer: true,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

function routeVisibility(rows: ImageAuditReport['runtimeTransparentProducts']): ImageAuditReport['routeVisibility'] {
  const topByTitle = rows.slice(0, 48);
  const discover = topByTitle.slice(0, 24).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    section: 'Discover: Transparent-ready pieces rail',
  }));
  const feedFirst50 = rows.slice(0, 20).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
  }));
  return {
    discover,
    feedFirst50,
    wardrobe: 'Visible after the user adds a transparent-ready product to closet or wishlist.',
    saved: 'Visible only inside saved fits that include one of the transparent-ready product ids.',
    canvas: 'Visible only when the current or loaded fit contains one of the transparent-ready product ids.',
  };
}

function buildRow(product: unknown, source: SourceLabel): ImageAuditRow | null {
  if (!product || typeof product !== 'object') return null;
  const p = product as Partial<Product> & {
    imageTransparentUrl?: unknown;
    imageSource?: unknown;
    imageStatus?: unknown;
  };
  const id = typeof p.id === 'string' ? p.id : '<missing-id>';
  const brand = typeof p.brand === 'string' ? p.brand : '<missing>';
  const name = typeof p.name === 'string' ? p.name : '<missing>';
  const category = (typeof p.category === 'string' ? p.category : 'unknown') as Category | 'unknown';
  const imageUrl = typeof p.imageUrl === 'string' ? p.imageUrl : '';

  const hasTransparent =
    typeof p.imageTransparentUrl === 'string' && p.imageTransparentUrl.trim() !== '' && !p.imageTransparentUrl.startsWith('data:');

  // Validate to see if the product image is fundamentally safe.
  const result = validateProduct(product);
  const imageBlockingCodes = new Set([
    'IMAGE_URL_DATA_URL',
    'IMAGE_URL_SVG_DATA',
    'IMAGE_URL_SEARCH_INTENT',
    'IMAGE_URL_PLACEHOLDER',
    'IMAGE_URL_UNSAFE_HOST',
    'IMAGE_URL_NOT_STRING',
    'MISSING_IMAGE_URL',
  ]);
  const isSafe = !result.issues.some((issue) => imageBlockingCodes.has(issue.code as string));

  const signals: string[] = [];
  if (!isSafe) signals.push('unsafe-image');
  if (hasTransparent) signals.push('has-transparent');
  if (!hasTransparent && isSafe) signals.push('needs-cutout');
  if (looksRetailWhite(imageUrl)) signals.push('retail-white-bg-suspected');

  const needsCutout = isSafe && !hasTransparent;

  return {
    source,
    id,
    brand,
    name,
    category,
    imageUrl: imageUrl.slice(0, 200),
    hasTransparent,
    imageSource: typeof p.imageSource === 'string' ? p.imageSource : undefined,
    imageStatus: typeof p.imageStatus === 'string' ? p.imageStatus : undefined,
    isSafe,
    needsCutout,
    signals,
  };
}

function audit(): ImageAuditReport {
  const sources: Array<{ label: SourceLabel; products: unknown[] }> = [
    { label: 'brand-catalog', products: applyCatalogCutoutOverridesToProducts(BRAND_CATALOG_PRODUCTS as Product[]) as unknown[] },
    { label: 'generated-catalog', products: applyCatalogCutoutOverridesToProducts(GENERATED_CATALOG_PRODUCTS as Product[]) as unknown[] },
    { label: 'photo-catalog', products: applyCatalogCutoutOverridesToProducts(PHOTO_CATALOG_PRODUCTS as Product[]) as unknown[] },
  ];

  const rows: ImageAuditRow[] = [];
  const bySource: ImageAuditReport['bySource'] = [];
  let totals = { products: 0, withTransparent: 0, withOriginalOnly: 0, withUnsafeImage: 0, needsCutoutPriority: 0 };
  const categoryCounts = new Map<string, number>();

  for (const { label, products } of sources) {
    let withTransparent = 0;
    let withOriginalOnly = 0;
    let withUnsafeImage = 0;
    let needsCutoutPriority = 0;
    for (const product of products) {
      const row = buildRow(product, label);
      if (!row) continue;
      rows.push(row);
      totals.products += 1;
      if (row.hasTransparent) {
        withTransparent += 1;
        totals.withTransparent += 1;
      } else {
        if (row.isSafe) {
          withOriginalOnly += 1;
          totals.withOriginalOnly += 1;
        }
      }
      if (!row.isSafe) {
        withUnsafeImage += 1;
        totals.withUnsafeImage += 1;
      }
      if (row.needsCutout) {
        needsCutoutPriority += 1;
        totals.needsCutoutPriority += 1;
        const key = String(row.category);
        categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
      }
    }
    bySource.push({ label, total: products.length, withTransparent, withOriginalOnly, withUnsafeImage, needsCutoutPriority });
  }

  // Top cutout candidates — safe-image products without a transparent
  // asset, ordered by retail-white-bg suspicion first (likely cheapest
  // to convert), then by category coverage of feed-critical categories.
  const priorityCategories: Array<Category | 'unknown'> = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];
  const topCutoutCandidates = rows
    .filter((row) => row.needsCutout)
    .sort((left, right) => {
      const leftWhite = left.signals.includes('retail-white-bg-suspected') ? 1 : 0;
      const rightWhite = right.signals.includes('retail-white-bg-suspected') ? 1 : 0;
      if (leftWhite !== rightWhite) return rightWhite - leftWhite;
      const leftCatRank = priorityCategories.indexOf(left.category);
      const rightCatRank = priorityCategories.indexOf(right.category);
      return (leftCatRank === -1 ? 99 : leftCatRank) - (rightCatRank === -1 ? 99 : rightCatRank);
    })
    .slice(0, 200);

  const byCategoryNeedingCutout = Object.fromEntries(
    Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]),
  );

  const root = process.cwd();
  const runtimeTransparentProducts = runtimeTransparentRows(root);
  const cutoutDir = join(root, 'public', 'assets', 'cutouts');
  const files = existsSync(cutoutDir)
    ? readdirSync(cutoutDir).filter((file) => /\.(png|webp|avif)$/i.test(file)).sort()
    : [];
  const registeredUrls = new Set(
    rows
      .filter((row) => row.hasTransparent)
      .map((row) => {
        const product = sources.flatMap((source) => source.products as Array<Partial<Product>>).find((entry) => entry.id === row.id);
        return typeof product?.imageTransparentUrl === 'string' ? product.imageTransparentUrl : '';
      })
      .filter(Boolean),
  );
  const missingCatalogRegistration = files
    .map((file) => `/assets/cutouts/${file}`)
    .filter((assetPath) => !registeredUrls.has(assetPath));
  const registeredLocalUrlsMissingFiles = Array.from(registeredUrls)
    .filter((url) => url.startsWith('/assets/cutouts/'))
    .filter((url) => !existsSync(join(root, 'public', url.replace(/^\//, ''))));

  return {
    generatedAt: new Date().toISOString(),
    totals,
    bySource,
    byCategoryNeedingCutout,
    topCutoutCandidates,
    runtimeTransparentProducts,
    routeVisibility: routeVisibility(runtimeTransparentProducts),
    generatedAssets: {
      cutoutDir: 'public/assets/cutouts',
      totalFiles: files.length,
      registeredFiles: files.length - missingCatalogRegistration.length,
      missingCatalogRegistration,
      registeredLocalUrlsMissingFiles,
    },
  };
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function printHuman(report: ImageAuditReport, flags: CliFlags): void {
  console.log('Catalog Image Audit');
  console.log('===================');
  console.log(`Generated: ${report.generatedAt}`);
  console.log('');
  console.log('Sources');
  console.log('-------');
  for (const row of report.bySource) {
    console.log(
      `  ${pad(row.label, 20)} total=${row.total}  transparent=${row.withTransparent}  original-only=${row.withOriginalOnly}  unsafe=${row.withUnsafeImage}  needs-cutout=${row.needsCutoutPriority}`,
    );
  }
  console.log('');
  console.log('Totals');
  console.log('------');
  console.log(`  products              : ${report.totals.products}`);
  console.log(`  with transparent asset: ${report.totals.withTransparent}`);
  console.log(`  original-only (safe)  : ${report.totals.withOriginalOnly}`);
  console.log(`  unsafe image          : ${report.totals.withUnsafeImage}`);
  console.log(`  cutout-candidate set  : ${report.totals.needsCutoutPriority}`);
  console.log('');
  console.log('Generated cutout assets');
  console.log('-----------------------');
  console.log(`  files in ${report.generatedAssets.cutoutDir}       : ${report.generatedAssets.totalFiles}`);
  console.log(`  registered in runtime catalog : ${report.generatedAssets.registeredFiles}`);
  console.log(`  missing catalog registration  : ${report.generatedAssets.missingCatalogRegistration.length}`);
  console.log(`  registered missing files      : ${report.generatedAssets.registeredLocalUrlsMissingFiles.length}`);
  console.log('');
  const transparentSample = report.runtimeTransparentProducts.slice(0, Math.min(flags.limit, 20));
  if (transparentSample.length) {
    console.log(`First ${transparentSample.length} runtime products with transparent assets`);
    console.log('-------------------------------------------------------');
    for (const row of transparentSample) {
      console.log(`  ${row.id} | ${row.category} | ${row.title}`);
      console.log(`    original    : ${row.imageUrl.slice(0, 120)}`);
      console.log(`    transparent : ${row.imageTransparentUrl} | file=${row.publicFileExists} | ProductImage prefers=${row.productImageShouldPrefer}`);
    }
    console.log('');
  }
  if (report.routeVisibility.discover.length) {
    console.log('Route visibility');
    console.log('----------------');
    console.log(`  /discover      : ${report.routeVisibility.discover.length} products in Transparent-ready pieces rail`);
    console.log(`  /feed first 50 : ${report.routeVisibility.feedFirst50.length} transparent products may appear depending on generated feed composition`);
    console.log(`  /wardrobe      : ${report.routeVisibility.wardrobe}`);
    console.log(`  /saved         : ${report.routeVisibility.saved}`);
    console.log(`  /canvas        : ${report.routeVisibility.canvas}`);
    console.log('');
  }
  if (Object.keys(report.byCategoryNeedingCutout).length) {
    console.log('Cutout candidates by category');
    console.log('-----------------------------');
    for (const [category, count] of Object.entries(report.byCategoryNeedingCutout)) {
      console.log(`  ${pad(category, 20)} ${count}`);
    }
    console.log('');
  }
  const sample = report.topCutoutCandidates.slice(0, flags.limit);
  if (sample.length) {
    console.log(`Top ${sample.length} cutout candidates (white-bg suspected + feed-critical category first)`);
    console.log('-------------------------------------------------------------------------');
    for (const row of sample) {
      console.log(
        `  [${row.source}] ${row.category} · ${row.brand} · ${row.name.slice(0, 60)}${row.name.length > 60 ? '…' : ''} ${flags.verbose ? `\n     ${row.imageUrl}` : ''}`,
      );
    }
    console.log('');
  }
  console.log('Note: this audit does NOT remove backgrounds. It identifies products that would benefit from a transparent asset.');
  console.log('See scripts/prepare-cutout-candidates.ts for a pipeline-ready candidate list.');
}

function writeJsonReport(report: ImageAuditReport): void {
  const outDir = join(process.cwd(), 'data', 'catalog', 'reports');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'catalog-image-audit-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const report = audit();
  writeJsonReport(report);
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report, flags);
  }
  process.exit(0);
}

main();
