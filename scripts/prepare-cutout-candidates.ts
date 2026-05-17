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
import { applyCatalogCutoutOverridesToProducts } from '../lib/catalog-cutout-overrides';
import { validateProduct } from '../lib/catalog-schemas/product.v2';
import type { Category, Product } from '../lib/types';

type SourceLabel = 'brand-catalog' | 'generated-catalog' | 'photo-catalog';

interface CutoutCandidate {
  id: string;
  source: SourceLabel;
  brand: string;
  name: string;
  category: Category | 'unknown';
  vibes: string[];
  matchedTargetVibes: string[];
  gender: string[];
  imageUrl: string;
  productUrl?: string;
  feedVisibility: 'likely-first-50' | 'not-prioritized';
  priority: number;
  reasons: string[];
}

interface CliFlags {
  json: boolean;
  limit: number;
  write: boolean;
  categories: Array<Category | 'unknown'>;
  targetVibes: string[];
  vibeQuotas: Record<string, number>;
  targetFrame: string;
  preferFeedFirst: number;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    json: false,
    limit: 100,
    write: false,
    categories: [],
    targetVibes: [],
    vibeQuotas: {},
    targetFrame: '',
    preferFeedFirst: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') flags.json = true;
    else if (arg === '--write') flags.write = true;
    else if (arg === '--categories' && argv[index + 1]) {
      flags.categories = parseCategories(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--categories=')) {
      flags.categories = parseCategories(arg.slice('--categories='.length));
    }
    else if (arg === '--target-vibes' && argv[index + 1]) {
      flags.targetVibes = parseCsv(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--target-vibes=')) {
      flags.targetVibes = parseCsv(arg.slice('--target-vibes='.length));
    } else if (arg === '--vibe-quotas' && argv[index + 1]) {
      flags.vibeQuotas = parseVibeQuotas(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--vibe-quotas=')) {
      flags.vibeQuotas = parseVibeQuotas(arg.slice('--vibe-quotas='.length));
    } else if (arg === '--prefer-feed-first' && argv[index + 1]) {
      const n = Number.parseInt(argv[index + 1], 10);
      if (Number.isFinite(n) && n > 0) flags.preferFeedFirst = Math.min(n, 200);
      index += 1;
    } else if (arg.startsWith('--prefer-feed-first=')) {
      const n = Number.parseInt(arg.slice('--prefer-feed-first='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.preferFeedFirst = Math.min(n, 200);
    } else if (arg === '--target-frame' && argv[index + 1]) {
      flags.targetFrame = argv[index + 1].trim().toLowerCase();
      index += 1;
    } else if (arg.startsWith('--target-frame=')) {
      flags.targetFrame = arg.slice('--target-frame='.length).trim().toLowerCase();
    }
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

function parseCategories(value: string): Array<Category | 'unknown'> {
  const valid = new Set<string>(PRIORITY_CATEGORIES);
  const categories: Array<Category | 'unknown'> = [];
  for (const raw of value.split(',')) {
    const normalized = raw.trim().toLowerCase();
    if (!valid.has(normalized)) continue;
    const category = normalized as Category | 'unknown';
    if (!categories.includes(category)) categories.push(category);
  }
  return categories;
}

function parseCsv(value: string): string[] {
  const out: string[] = [];
  for (const raw of value.split(',')) {
    const normalized = raw.trim().toLowerCase();
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

function parseVibeQuotas(value: string): Record<string, number> {
  const quotas: Record<string, number> = {};
  for (const raw of value.split(',')) {
    if (!raw.includes(':')) continue;
    const [vibeRaw, quotaRaw] = raw.split(':', 2);
    const vibe = vibeRaw.trim().toLowerCase();
    const quota = Number.parseInt(quotaRaw.trim(), 10);
    if (!vibe || !Number.isFinite(quota)) continue;
    quotas[vibe] = Math.max(0, quota);
  }
  return quotas;
}

const TARGET_VIBE_ALIASES: Record<string, string[]> = {
  classic: ['classic', 'old money', 'preppy', 'business casual', 'clean', 'minimal'],
  street: ['street', 'streetwear', 'y2k', 'edgy'],
  work: ['work', 'workwear', 'office', 'business casual'],
  date: ['date', 'night out', 'dressy'],
  vacation: ['vacation', 'summer', 'beach', 'travel'],
  cozy: ['cozy', 'winter'],
};

function aliasesForTargetVibe(vibe: string): string[] {
  return TARGET_VIBE_ALIASES[vibe] || [vibe];
}

function matchedTargetVibes(vibes: string[], targets: string[]): string[] {
  return targets.filter((target) => vibes.some((vibe) => aliasesForTargetVibe(target).includes(vibe)));
}

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
  const vibes = [...(Array.isArray(p.vibes) ? p.vibes : []), ...(Array.isArray(p.occasions) ? p.occasions : [])]
    .filter((vibe): vibe is string => typeof vibe === 'string')
    .map((vibe) => vibe.toLowerCase());
  const gender = (Array.isArray(p.gender) ? p.gender : [])
    .filter((frame) => typeof frame === 'string')
    .map((frame) => frame.toLowerCase());

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
    vibes,
    matchedTargetVibes: [],
    gender,
    imageUrl: imageUrl.slice(0, 300),
    productUrl: productUrl?.slice(0, 300),
    feedVisibility: 'not-prioritized',
    priority,
    reasons,
  };
}

interface CutoutReport {
  generatedAt: string;
  totalCatalogProducts: number;
  categoryFilter: Array<Category | 'unknown'>;
  targetVibes: string[];
  targetVibeAliases: Record<string, string[]>;
  vibeQuotas: Record<string, number>;
  targetFrame: string;
  preferFeedFirst: number;
  candidateCount: number;
  emittedCount: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byVibe: Record<string, number>;
  byFrame: Record<string, number>;
  byFeedVisibility: Record<string, number>;
  candidates: CutoutCandidate[];
  // Honest notes that ride with the report so any downstream user
  // immediately understands the report's scope and limits.
  notes: string[];
}

function orderCandidates(
  candidates: CutoutCandidate[],
  categories: Array<Category | 'unknown'>,
  targetVibes: string[],
  vibeQuotas: Record<string, number>,
): CutoutCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  if (targetVibes.length > 0 && Object.keys(vibeQuotas).length > 0) {
    const selected: CutoutCandidate[] = [];
    const seen = new Set<string>();
    for (const target of targetVibes) {
      const quota = vibeQuotas[target] ?? 0;
      if (quota <= 0) continue;
      const matches = sorted.filter((candidate) => candidate.matchedTargetVibes.includes(target));
      for (const candidate of matches.slice(0, quota)) {
        if (seen.has(candidate.id)) continue;
        selected.push(candidate);
        seen.add(candidate.id);
      }
    }
    for (const candidate of sorted) {
      if (seen.has(candidate.id)) continue;
      selected.push(candidate);
      seen.add(candidate.id);
    }
    return selected;
  }
  if (categories.length === 0) return sorted;

  const groups = new Map<Category | 'unknown', CutoutCandidate[]>();
  for (const category of categories) groups.set(category, []);
  for (const candidate of sorted) {
    const group = groups.get(candidate.category);
    if (group) group.push(candidate);
  }

  const ordered: CutoutCandidate[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const category of categories) {
      const next = groups.get(category)?.shift();
      if (!next) continue;
      ordered.push(next);
      added = true;
    }
  }
  return ordered;
}

function build(flags: CliFlags): CutoutReport {
  const sources: Array<{ label: SourceLabel; products: unknown[] }> = [
    { label: 'brand-catalog', products: applyCatalogCutoutOverridesToProducts(BRAND_CATALOG_PRODUCTS as Product[]) as unknown[] },
    { label: 'generated-catalog', products: applyCatalogCutoutOverridesToProducts(GENERATED_CATALOG_PRODUCTS as Product[]) as unknown[] },
    { label: 'photo-catalog', products: applyCatalogCutoutOverridesToProducts(PHOTO_CATALOG_PRODUCTS as Product[]) as unknown[] },
  ];

  let totalCatalog = 0;
  const candidates: CutoutCandidate[] = [];
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byVibe: Record<string, number> = {};
  const byFrame: Record<string, number> = {};
  const byFeedVisibility: Record<string, number> = {};
  const categoryFilter = new Set<Category | 'unknown'>(flags.categories);

  for (const { label, products } of sources) {
    totalCatalog += products.length;
    let kept = 0;
    for (const product of products) {
      const candidate = buildCandidate(product, label);
      if (!candidate) continue;
      if (categoryFilter.size > 0 && !categoryFilter.has(candidate.category)) continue;
      candidate.matchedTargetVibes = matchedTargetVibes(candidate.vibes, flags.targetVibes);
      if (flags.targetVibes.length > 0 && candidate.matchedTargetVibes.length === 0) continue;
      if (flags.targetFrame && !candidate.gender.includes(flags.targetFrame)) continue;
      const matchedVibes = candidate.matchedTargetVibes;
      if (matchedVibes.length) {
        candidate.priority += matchedVibes.length * 45;
        candidate.reasons.push(`target vibe match: ${matchedVibes.join(', ')}`);
        for (const vibe of matchedVibes) byVibe[vibe] = (byVibe[vibe] || 0) + 1;
      }
      if (flags.targetFrame && candidate.gender.includes(flags.targetFrame)) {
        candidate.priority += 35;
        candidate.reasons.push(`target frame match: ${flags.targetFrame}`);
        byFrame[flags.targetFrame] = (byFrame[flags.targetFrame] || 0) + 1;
      }
      if (flags.preferFeedFirst > 0 && matchedVibes.length > 0 && ['top', 'bottom', 'shoes', 'outer', 'bag'].includes(candidate.category)) {
        candidate.priority += 25;
        candidate.feedVisibility = 'likely-first-50';
        candidate.reasons.push(`prefer-feed-first=${flags.preferFeedFirst}`);
      }
      candidates.push(candidate);
      kept += 1;
      byCategory[candidate.category] = (byCategory[candidate.category] || 0) + 1;
      byFeedVisibility[candidate.feedVisibility] = (byFeedVisibility[candidate.feedVisibility] || 0) + 1;
    }
    bySource[label] = kept;
  }

  const orderedCandidates = orderCandidates(candidates, flags.categories, flags.targetVibes, flags.vibeQuotas);

  return {
    generatedAt: new Date().toISOString(),
    totalCatalogProducts: totalCatalog,
    categoryFilter: flags.categories,
    targetVibes: flags.targetVibes,
    targetVibeAliases: Object.fromEntries(flags.targetVibes.map((vibe) => [vibe, aliasesForTargetVibe(vibe)])),
    vibeQuotas: flags.vibeQuotas,
    targetFrame: flags.targetFrame,
    preferFeedFirst: flags.preferFeedFirst,
    candidateCount: orderedCandidates.length,
    emittedCount: 0,
    byCategory,
    bySource,
    byVibe,
    byFrame,
    byFeedVisibility,
    candidates: orderedCandidates,
    notes: [
      'This report is read-only and does NOT perform background removal.',
      'A "candidate" is a product with a safe original image and no transparent asset.',
      flags.categories.length
        ? 'Category filtering is active; emitted candidates are balanced by requested category where possible.'
        : 'Priority weighs feed-critical category, retail-white-bg hint, and presence of productUrl.',
      flags.targetVibes.length
        ? 'Target-vibe filtering uses explicit style-family aliases, e.g. street includes streetwear and work includes office.'
        : 'No target-vibe filtering is active.',
      'Background removal still requires an external tool (e.g. remove.bg, Photoroom, local rembg).',
      'After a real cutout pipeline runs, register reviewed assets with scripts/register-cutouts.ts.',
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
  if (report.categoryFilter.length) console.log(`Category filter: ${report.categoryFilter.join(', ')}`);
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
  if (report.targetVibes.length) {
    console.log('By target vibe');
    console.log('--------------');
    for (const [vibe, count] of Object.entries(report.byVibe).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(vibe, 20)} ${count}`);
    }
    console.log('');
    console.log('By feed visibility');
    console.log('------------------');
    for (const [label, count] of Object.entries(report.byFeedVisibility).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(label, 20)} ${count}`);
    }
    console.log('');
  }
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
  const report = build(flags);
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
