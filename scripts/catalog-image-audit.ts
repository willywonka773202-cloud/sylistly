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
import { validateProduct } from '../lib/catalog-schemas/product.v2';
import type { Category, Product } from '../lib/types';

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
    { label: 'brand-catalog', products: BRAND_CATALOG_PRODUCTS as unknown[] },
    { label: 'generated-catalog', products: GENERATED_CATALOG_PRODUCTS as unknown[] },
    { label: 'photo-catalog', products: PHOTO_CATALOG_PRODUCTS as unknown[] },
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

  return {
    generatedAt: new Date().toISOString(),
    totals,
    bySource,
    byCategoryNeedingCutout,
    topCutoutCandidates,
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

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const report = audit();
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report, flags);
  }
  process.exit(0);
}

main();
