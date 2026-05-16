// SearchAPI catalog expansion - DRY RUN BY DEFAULT.
//
// Generates a query plan for catalog gaps. It never calls SearchAPI unless all
// live gates are satisfied. Live fetching is still intentionally stubbed.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

type Frame = 'masc' | 'fem' | 'androgynous' | 'any';

interface QueryCandidate {
  query: string;
  targetCategory: Category;
  targetFrame: Frame;
  targetVibe?: string;
  maxResults: number;
  reason: string;
  priority: number;
}

interface CliFlags {
  json: boolean;
  limit: number;
  write: boolean;
  live: boolean;
  dryRun: boolean;
  maxQueries: number;
}

interface PlanReport {
  generatedAt: string;
  mode: 'dry-run' | 'live';
  totalCandidates: number;
  emittedCount: number;
  estimatedMaxQueries: number;
  estimatedMaxResults: number;
  candidates: QueryCandidate[];
  liveCheck: {
    hasKey: boolean;
    liveEnvFlag: boolean;
    liveCliFlag: boolean;
    maxQueriesFromEnv: number;
    maxQueriesFromCli: number;
    wouldRunLive: boolean;
    blockedReason: string | null;
  };
  notes: string[];
}

const FORMULA_VIBES: Record<Category, string[]> = {
  top: ['clean elevated', 'streetwear hoodie', 'date polished', 'gym training', 'office smart casual', 'old money knit'],
  bottom: ['tailored trouser', 'wide leg pant', 'cargo pants', 'denim jeans', 'mini skirt', 'midi skirt'],
  shoes: ['white sneaker', 'loafer', 'platform boot', 'sandals', 'running sneaker'],
  outer: ['oversized blazer', 'puffer jacket', 'trench coat', 'leather jacket', 'cardigan'],
  bag: ['structured tote', 'crossbody bag', 'shoulder bag', 'gym backpack'],
  hat: ['baseball cap', 'beanie', 'sun hat', 'bucket hat'],
  eyewear: ['cat eye sunglasses', 'aviator sunglasses', 'wayfarer sunglasses'],
  jewelry: ['hoop earrings', 'gold necklace', 'pearl earrings', 'cuban chain'],
};

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { json: false, limit: 30, write: false, live: false, dryRun: false, maxQueries: 0 };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--write') flags.write = true;
    else if (arg === '--live') flags.live = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.limit = Math.min(n, 300);
    } else if (arg.startsWith('--max-queries=')) {
      const n = Number.parseInt(arg.slice('--max-queries='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.maxQueries = Math.min(n, 50);
    }
  }
  return flags;
}

function classifyFrame(product: Product): Frame {
  if (!Array.isArray(product.gender) || product.gender.length === 0) return 'any';
  if (product.gender.includes('masc') && !product.gender.includes('fem')) return 'masc';
  if (product.gender.includes('fem') && !product.gender.includes('masc')) return 'fem';
  if (product.gender.includes('androgynous')) return 'androgynous';
  return 'any';
}

function buildPlan(): QueryCandidate[] {
  const products = ALL_CATALOG_PRODUCTS as Product[];
  const counts = new Map<string, number>();
  for (const product of products) {
    if (!CATEGORY_ORDER.includes(product.category as Category)) continue;
    const frame = classifyFrame(product);
    counts.set(`${product.category}|${frame}`, (counts.get(`${product.category}|${frame}`) || 0) + 1);
  }

  const candidates: QueryCandidate[] = [];
  for (const category of CATEGORY_ORDER) {
    const frames: Frame[] = ['masc', 'fem', 'androgynous'];
    const categoryProducts = products.filter((product) => product.category === category);
    const transparentCount = categoryProducts.filter((product) => product.imageTransparentUrl).length;
    const affordableCount = categoryProducts.filter((product) => product.priceCents > 0 && product.priceCents < 15000).length;
    const imageGapBoost = Math.max(0, 10 - transparentCount);
    const priceDiversityBoost = affordableCount < 20 ? 12 : 0;
    for (const frame of frames) {
      const count = counts.get(`${category}|${frame}`) || 0;
      if (count >= 15) continue;
      const frameLabel = frame === 'androgynous' ? 'unisex' : frame === 'masc' ? "men's" : "women's";
      const vibes = FORMULA_VIBES[category] || [''];
      for (const vibe of vibes) {
        candidates.push({
          query: `${frameLabel} ${vibe} ${category}`.replace(/\s+/g, ' ').trim(),
          targetCategory: category,
          targetFrame: frame,
          targetVibe: vibe,
          maxResults: 20,
          reason: `Thin ${category} x ${frame} coverage (${count}/15 target); ${transparentCount} transparent assets; ${affordableCount} under $150.`,
          priority: (15 - count) * 10 + imageGapBoost + priceDiversityBoost + (vibes.length - vibes.indexOf(vibe)),
        });
      }
    }
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

function buildReport(flags: CliFlags): PlanReport {
  const candidates = buildPlan();
  const emitted = candidates.slice(0, flags.limit);
  const hasKey = Boolean(process.env.SEARCHAPI_KEY && process.env.SEARCHAPI_KEY.trim());
  const liveEnvFlag = process.env.SEARCHAPI_LIVE === 'true';
  const maxQueriesFromEnv = Number.parseInt(process.env.SEARCHAPI_MAX_QUERIES || '', 10);
  const liveCliFlag = flags.live;
  const blockedReasons: string[] = [];
  if (!hasKey) blockedReasons.push('SEARCHAPI_KEY missing');
  if (!liveEnvFlag) blockedReasons.push('SEARCHAPI_LIVE!="true"');
  if (!Number.isFinite(maxQueriesFromEnv) || maxQueriesFromEnv <= 0) blockedReasons.push('SEARCHAPI_MAX_QUERIES not set or <=0');
  if (!liveCliFlag) blockedReasons.push('--live flag absent');
  if (flags.maxQueries <= 0) blockedReasons.push('--max-queries not set or <=0');
  const wouldRunLive = blockedReasons.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    mode: wouldRunLive ? 'live' : 'dry-run',
    totalCandidates: candidates.length,
    emittedCount: emitted.length,
    estimatedMaxQueries: emitted.length,
    estimatedMaxResults: emitted.reduce((sum, candidate) => sum + candidate.maxResults, 0),
    candidates: emitted,
    liveCheck: {
      hasKey,
      liveEnvFlag,
      liveCliFlag,
      maxQueriesFromEnv: Number.isFinite(maxQueriesFromEnv) ? maxQueriesFromEnv : 0,
      maxQueriesFromCli: flags.maxQueries,
      wouldRunLive,
      blockedReason: wouldRunLive ? null : blockedReasons.join(' | '),
    },
    notes: [
      'This script does not call SearchAPI in dry-run mode.',
      'Live mode requires SEARCHAPI_KEY + SEARCHAPI_LIVE=true + SEARCHAPI_MAX_QUERIES=N + --live + --max-queries=N.',
      'Live results must remain candidate-only with reviewStatus=candidate and liveMergeReady=false.',
      'SearchAPI can find better merchant images and product URLs, but it does not remove backgrounds.',
    ],
  };
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function writeReport(report: PlanReport): void {
  const reportsDir = join(process.cwd(), 'data', 'catalog', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, 'searchapi-expansion-plan-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function printHuman(report: PlanReport): void {
  console.log('SearchAPI Catalog Expansion');
  console.log('===========================');
  console.log(`Mode: ${report.mode.toUpperCase()}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log('');
  console.log('Live mode gates');
  console.log('---------------');
  console.log(`  SEARCHAPI_KEY present : ${report.liveCheck.hasKey}`);
  console.log(`  SEARCHAPI_LIVE=true   : ${report.liveCheck.liveEnvFlag}`);
  console.log(`  SEARCHAPI_MAX_QUERIES : ${report.liveCheck.maxQueriesFromEnv}`);
  console.log(`  --live flag           : ${report.liveCheck.liveCliFlag}`);
  console.log(`  --max-queries         : ${report.liveCheck.maxQueriesFromCli}`);
  console.log(`  would run live        : ${report.liveCheck.wouldRunLive}`);
  if (report.liveCheck.blockedReason) console.log(`  blocked by            : ${report.liveCheck.blockedReason}`);
  console.log('');
  console.log(`Plan size: ${report.totalCandidates} candidates; emitting ${report.emittedCount}`);
  console.log(`Estimated live queries for emitted plan: ${report.estimatedMaxQueries}`);
  console.log(`Estimated max result rows: ${report.estimatedMaxResults}`);
  console.log('');
  console.log('Top candidates');
  console.log('--------------');
  for (const candidate of report.candidates) {
    console.log(`  (p=${candidate.priority}) [${pad(candidate.targetCategory, 8)} | ${pad(candidate.targetFrame, 12)}] "${candidate.query}"`);
    console.log(`      reason: ${candidate.reason}`);
  }
  console.log('');
  for (const note of report.notes) console.log(`  - ${note}`);
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const report = buildReport(flags);
  writeReport(report);

  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);

  if (flags.write) {
    const outDir = join(process.cwd(), 'data', 'catalog', 'candidates');
    mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const outFile = join(outDir, `searchapi-plan-${stamp}.json`);
    writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nWrote ${outFile}`);
  }

  if (report.mode === 'live') {
    console.log('');
    console.log('Live execution stub: all live gates are satisfied, but fetching is intentionally not implemented yet.');
  }
}

main();
