// Prepare cutout candidates — read-only.
//
// Scans the catalog and produces a prioritized list of products that
// would benefit from a real transparent-background asset. Output is
// JSON to stdout (and optionally to data/catalog/cutout-candidates/
// when the user explicitly opts in via --write).
//
// Does NOT call any background-removal API. Does NOT download images.
// Does NOT generate transparent assets. It's a planning report.
//
//   npx jiti scripts/prepare-cutout-candidates.ts
//   npx jiti scripts/prepare-cutout-candidates.ts --limit=200
//   npx jiti scripts/prepare-cutout-candidates.ts --limit=50 --write
//   npx jiti scripts/prepare-cutout-candidates.ts --json
//
// Priority ordering:
//   1. Feed/Build-visible categories first (top / bottom / shoes / outer)
//   2. Retail-white-bg hint in the image URL (easier to cut out)
//   3. Brand merchandising rank — products with productUrl ranked higher

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_CATALOG_PRODUCTS } from '../lib/brand-catalog';
import { GENERATED_CATALOG_PRODUCTS } from '../lib/generated-catalog';
import { PHOTO_CATALOG_PRODUCTS } from '../lib/photo-catalog';
import { validateProduct } from '../lib/catalog-schemas/product.v2';
import type { Category, Product } from '../lib/types';

type SourceLabel = 'brand-catalog' | 'generated-catalog' | 'photo-catalog';

interface CutoutCandidate {
  id: string;
  source: SourceLabel;
  brand: string;
  name: string;
  category: Category | 'unknown';
  imageUrl: string;
  productUrl?: string;
  priority: number;
  reasons: string[];
}

interface CliFlags {
  json: boolean;
  limit: number;
  write: boolean;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { json: false, limit: 100, write: false };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--write') flags.write = true;
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.limit = Math.min(n, 1000);
    }
  }
  return flags;
}

const PRIORITY_CATEGORIES: Array<Category | 'unknown'> = [
  'top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry',
];

const RETAIL_WHITE_BG_HINTS = [
  '/product/', '/shop/', '_white', 'white-bg', 'pdp', 'productimage',
  'product-image', '/dw/image', 'dimg', '/is/image',
];

function looksRetailWhite(url: string): boolean {
  const lower = url.toLowerCase();
  return RETAIL_WHITE_BG_HINTS.some((hint) => lower.includes(hint));
}

function buildCandidate(product: unknown, source: SourceLabel): CutoutCandidate | null {
  if (!product || typeof product !== 'object') return null;
  const p = product as Partial<Product> & { imageTransparentUrl?: unknown };

  const id = typeof p.id === 'string' ? p.id : '';
  if (!id) return null;

  const imageUrl = typeof p.imageUrl === 'string' ? p.imageUrl : '';
  if (!imageUrl) return null;

  const hasTransparent =
    typeof p.imageTransparentUrl === 'string' &&
    p.imageTransparentUrl.trim() !== '' &&
    !p.imageTransparentUrl.startsWith('data:');
  if (hasTransparent) return null;

  // Validate to ensure the image is safe before we recommend it for
  // background removal. We never want to spend cutout-budget on a
  // data:image/svg+xml placeholder or a Google-shopping search URL.
  const result = validateProduct(product);
  const blocking = new Set([
    'IMAGE_URL_DATA_URL',
    'IMAGE_URL_SVG_DATA',
    'IMAGE_URL_SEARCH_INTENT',
    'IMAGE_URL_PLACEHOLDER',
    'IMAGE_URL_UNSAFE_HOST',
    'IMAGE_URL_NOT_STRING',
    'MISSING_IMAGE_URL',
  ]);
  if (result.issues.some((issue) => blocking.has(issue.code as string))) return null;

  const brand = typeof p.brand === 'string' ? p.brand : '<missing>';
  const name = typeof p.name === 'string' ? p.name : '<missing>';
  const category = (typeof p.category === 'string' ? p.category : 'unknown') as Category | 'unknown';
  const productUrl = typeof p.productUrl === 'string' ? p.productUrl : undefined;

  const reasons: string[] = [];
  let priority = 0;

  const categoryRank = PRIORITY_CATEGORIES.indexOf(category);
  if (categoryRank >= 0) {
    priority += 100 - categoryRank * 4;
    reasons.push(`feed-critical category: ${category}`);
  }

  if (looksRetailWhite(imageUrl)) {
    priority += 30;
    reasons.push('retail-white-bg suspected — likely cheap to cut out');
  }

  if (productUrl) {
    priority += 10;
    reasons.push('has productUrl — shoppable');
  }

  if ((p.imageQuality as unknown) === 'good') {
    priority += 8;
    reasons.push('imageQuality=good');
  }

  return {
    id,
    source,
    brand,
    name,
    category,
    imageUrl: imageUrl.slice(0, 300),
    productUrl: productUrl?.slice(0, 300),
    priority,
    reasons,
  };
}

interface CutoutReport {
  generatedAt: string;
  totalCatalogProducts: number;
  candidateCount: number;
  emittedCount: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  candidates: CutoutCandidate[];
  // Honest notes that ride with the report so any downstream user
  // immediately understands the report's scope and limits.
  notes: string[];
}

function build(): CutoutReport {
  const sources: Array<{ label: SourceLabel; products: unknown[] }> = [
    { label: 'brand-catalog', products: BRAND_CATALOG_PRODUCTS as unknown[] },
    { label: 'generated-catalog', products: GENERATED_CATALOG_PRODUCTS as unknown[] },
    { label: 'photo-catalog', products: PHOTO_CATALOG_PRODUCTS as unknown[] },
  ];

  let totalCatalog = 0;
  const candidates: CutoutCandidate[] = [];
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const { label, products } of sources) {
    totalCatalog += products.length;
    let kept = 0;
    for (const product of products) {
      const candidate = buildCandidate(product, label);
      if (!candidate) continue;
      candidates.push(candidate);
      kept += 1;
      byCategory[candidate.category] = (byCategory[candidate.category] || 0) + 1;
    }
    bySource[label] = kept;
  }

  candidates.sort((a, b) => b.priority - a.priority);

  return {
    generatedAt: new Date().toISOString(),
    totalCatalogProducts: totalCatalog,
    candidateCount: candidates.length,
    emittedCount: 0,
    byCategory,
    bySource,
    candidates,
    notes: [
      'This report is read-only and does NOT perform background removal.',
      'A "candidate" is a product with a safe original image and no transparent asset.',
      'Priority weighs feed-critical category, retail-white-bg hint, and presence of productUrl.',
      'Background removal still requires an external tool (e.g. remove.bg, Photoroom, local rembg).',
      'After the user runs a real cutout pipeline, write the result to product.imageTransparentUrl.',
    ],
  };
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function printHuman(report: CutoutReport, flags: CliFlags): void {
  const sample = report.candidates.slice(0, flags.limit);
  console.log('Cutout candidate plan');
  console.log('=====================');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Catalog total: ${report.totalCatalogProducts}`);
  console.log(`Candidate count (no transparent asset, safe image): ${report.candidateCount}`);
  console.log('');
  console.log('By category');
  console.log('-----------');
  for (const [category, count] of Object.entries(report.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(category, 20)} ${count}`);
  }
  console.log('');
  console.log('By source');
  console.log('---------');
  for (const [source, count] of Object.entries(report.bySource)) {
    console.log(`  ${pad(source, 22)} ${count}`);
  }
  console.log('');
  console.log(`Top ${sample.length} candidates`);
  console.log('-------------------');
  for (const candidate of sample) {
    console.log(
      `  [${candidate.source}] (p=${candidate.priority}) ${candidate.category} · ${candidate.brand} · ${candidate.name.slice(0, 60)}`,
    );
  }
  console.log('');
  for (const note of report.notes) console.log(`  · ${note}`);
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const report = build();
  report.emittedCount = Math.min(flags.limit, report.candidates.length);
  if (flags.json) {
    console.log(JSON.stringify({ ...report, candidates: report.candidates.slice(0, flags.limit) }, null, 2));
  } else {
    printHuman(report, flags);
  }
  if (flags.write) {
    try {
      const outDir = join(process.cwd(), 'data', 'catalog', 'cutout-candidates');
      mkdirSync(outDir, { recursive: true });
      const outFile = join(outDir, `cutout-candidates-${new Date().toISOString().slice(0, 10)}.json`);
      writeFileSync(outFile, JSON.stringify({ ...report, candidates: report.candidates.slice(0, flags.limit) }, null, 2), 'utf-8');
      console.log(`\nWrote ${outFile}`);
    } catch (error) {
      console.error('Failed to write report:', error);
    }
  }
  process.exit(0);
}

main();
