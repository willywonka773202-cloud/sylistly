// SearchAPI catalog expansion — DRY RUN BY DEFAULT.
//
// This script generates the QUERY PLAN we would send to SearchAPI to
// fill catalog gaps. In dry-run mode (the default) it prints/writes
// the plan and does NOT contact SearchAPI. Live mode requires THREE
// gates simultaneously:
//
//   1. process.env.SEARCHAPI_KEY     present (key is never printed)
//   2. process.env.SEARCHAPI_LIVE    === 'true'
//   3. CLI flag --live --max-queries=N where N > 0
//
// Even in live mode, results land in
// `data/catalog/candidates/searchapi-results-YYYYMMDD.json` for review
// and are NEVER auto-merged into the live catalog. Each candidate is
// marked `source: 'searchapi'`, `reviewStatus: 'candidate'`,
// `imageStatus: 'original'`, `liveMergeReady: false`.
//
//   npx jiti scripts/searchapi-catalog-expand.ts
//   npx jiti scripts/searchapi-catalog-expand.ts --json
//   npx jiti scripts/searchapi-catalog-expand.ts --limit=20
//   npx jiti scripts/searchapi-catalog-expand.ts --write
//
// Live mode (requires all three gates):
//   SEARCHAPI_KEY=... SEARCHAPI_LIVE=true \
//     npx jiti scripts/searchapi-catalog-expand.ts --live --max-queries=5

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_CATALOG_PRODUCTS } from '../lib/brand-catalog';
import { GENERATED_CATALOG_PRODUCTS } from '../lib/generated-catalog';
import { PHOTO_CATALOG_PRODUCTS } from '../lib/photo-catalog';
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
  maxQueries: number;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { json: false, limit: 30, write: false, live: false, maxQueries: 0 };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--write') flags.write = true;
    else if (arg === '--live') flags.live = true;
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

const FORMULA_VIBES: Record<string, string[]> = {
  top: ['clean elevated', 'streetwear hoodie', 'date polished', 'gym training', 'office smart-casual', 'old-money knit'],
  bottom: ['tailored trouser', 'wide-leg pant', 'cargo pants', 'denim jeans', 'mini skirt', 'midi skirt'],
  shoes: ['white sneaker', 'sambas', 'loafer', 'platform boot', 'sandals', 'running sneaker'],
  outer: ['oversized blazer', 'puffer jacket', 'trench coat', 'leather jacket', 'cardigan'],
  bag: ['structured tote', 'crossbody bag', 'shoulder bag', 'gym backpack'],
  hat: ['baseball cap', 'beanie', 'sun hat', 'bucket hat'],
  eyewear: ['cat-eye sunglasses', 'aviator sunglasses', 'wayfarer sunglasses'],
  jewelry: ['hoop earrings', 'gold necklace', 'pearl earrings', 'cuban chain'],
};

function classifyFrame(product: Product): Frame {
  if (!Array.isArray(product.gender) || product.gender.length === 0) return 'any';
  if (product.gender.includes('masc') && !product.gender.includes('fem')) return 'masc';
  if (product.gender.includes('fem') && !product.gender.includes('masc')) return 'fem';
  if (product.gender.includes('androgynous')) return 'androgynous';
  return 'any';
}

function buildPlan(): QueryCandidate[] {
  const products: Product[] = [
    ...(BRAND_CATALOG_PRODUCTS as Product[]),
    ...(GENERATED_CATALOG_PRODUCTS as Product[]),
    ...(PHOTO_CATALOG_PRODUCTS as Product[]),
  ];

  // Cross-tab category × frame to find thin combinations to expand.
  const counts = new Map<string, number>();
  for (const product of products) {
    if (!CATEGORY_ORDER.includes(product.category as Category)) continue;
    const frame = classifyFrame(product);
    const key = `${product.category}|${frame}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const candidates: QueryCandidate[] = [];
  for (const category of CATEGORY_ORDER) {
    const frames: Frame[] = ['masc', 'fem', 'androgynous'];
    const vibes = FORMULA_VIBES[category] || [''];
    for (const frame of frames) {
      const count = counts.get(`${category}|${frame}`) || 0;
      // Hard target: at least 15 per (category, frame). Anything below
      // becomes a candidate, weighted by how thin it is.
      if (count >= 15) continue;
      for (const vibe of vibes) {
        const frameLabel = frame === 'androgynous' ? 'unisex' : frame === 'masc' ? "men's" : "women's";
        const query = vibe ? `${frameLabel} ${vibe} ${category}` : `${frameLabel} ${category}`;
        candidates.push({
          query,
          targetCategory: category as Category,
          targetFrame: frame,
          targetVibe: vibe || undefined,
          maxResults: 20,
          reason: `thin combination — ${category} × ${frame} has ${count} products (target 15+)`,
          priority: (15 - count) * 10 + (vibes.length - vibes.indexOf(vibe)) * 1,
        });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}

interface PlanReport {
  generatedAt: string;
  mode: 'dry-run' | 'live';
  totalCandidates: number;
  emittedCount: number;
  candidates: QueryCandidate[];
  liveCheck: {
    hasKey: boolean;
    liveEnvFlag: boolean;
    liveCliFlag: boolean;
    maxQueriesFromCli: number;
    wouldRunLive: boolean;
    blockedReason: string | null;
  };
  notes: string[];
}

function buildReport(flags: CliFlags): PlanReport {
  const candidates = buildPlan();
  const hasKey = Boolean(process.env.SEARCHAPI_KEY && process.env.SEARCHAPI_KEY.trim());
  const liveEnvFlag = process.env.SEARCHAPI_LIVE === 'true';
  const liveCliFlag = flags.live;
  const blockedReasons: string[] = [];
  if (!hasKey) blockedReasons.push('SEARCHAPI_KEY missing');
  if (!liveEnvFlag) blockedReasons.push('SEARCHAPI_LIVE!="true"');
  if (!liveCliFlag) blockedReasons.push('--live flag absent');
  if (flags.maxQueries <= 0) blockedReasons.push('--max-queries not set or <=0');
  const wouldRunLive = blockedReasons.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    mode: wouldRunLive ? 'live' : 'dry-run',
    totalCandidates: candidates.length,
    emittedCount: Math.min(flags.limit, candidates.length),
    candidates: candidates.slice(0, flags.limit),
    liveCheck: {
      hasKey,
      liveEnvFlag,
      liveCliFlag,
      maxQueriesFromCli: flags.maxQueries,
      wouldRunLive,
      blockedReason: wouldRunLive ? null : blockedReasons.join(' · '),
    },
    notes: [
      'This script does NOT call SearchAPI by default. The query plan is local.',
      'Live mode requires SEARCHAPI_KEY + SEARCHAPI_LIVE=true + --live + --max-queries=N.',
      'Even in live mode, results land in data/catalog/candidates/ and are NEVER auto-merged.',
      'Every result is tagged source=searchapi, reviewStatus=candidate, imageStatus=original, liveMergeReady=false.',
      'SearchAPI helps find better merchant images and product URLs — it does NOT remove backgrounds.',
    ],
  };
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
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
  console.log(`  --live flag           : ${report.liveCheck.liveCliFlag}`);
  console.log(`  --max-queries         : ${report.liveCheck.maxQueriesFromCli}`);
  console.log(`  would run live        : ${report.liveCheck.wouldRunLive}`);
  if (report.liveCheck.blockedReason) {
    console.log(`  blocked by            : ${report.liveCheck.blockedReason}`);
  }
  console.log('');
  console.log(`Plan size: ${report.totalCandidates} candidates · emitting ${report.emittedCount}`);
  console.log('');
  console.log('Top candidates');
  console.log('--------------');
  for (const candidate of report.candidates) {
    console.log(`  (p=${candidate.priority}) [${pad(candidate.targetCategory, 8)} · ${pad(candidate.targetFrame, 12)}] "${candidate.query}"`);
    console.log(`      reason: ${candidate.reason}`);
  }
  console.log('');
  for (const note of report.notes) console.log(`  · ${note}`);
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const report = buildReport(flags);

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  if (flags.write) {
    try {
      const outDir = join(process.cwd(), 'data', 'catalog', 'candidates');
      mkdirSync(outDir, { recursive: true });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const outFile = join(outDir, `searchapi-plan-${stamp}.json`);
      writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`\nWrote ${outFile}`);
    } catch (error) {
      console.error('Failed to write report:', error);
    }
  }

  if (report.mode === 'live') {
    // Live execution path is intentionally NOT implemented in this
    // sprint. The script gates everything correctly so a future change
    // can add the actual fetch call without restructuring the surface.
    console.log('');
    console.log('Live execution stub:');
    console.log('  All live-mode gates are satisfied, but the actual SearchAPI fetch is');
    console.log('  not implemented in this script yet. When ready to ship:');
    console.log('    1. Add `lib/searchapi-client.ts` with a single fetch function.');
    console.log('    2. Call it for the first N candidates (N = --max-queries).');
    console.log('    3. Write each result to data/catalog/candidates/searchapi-results-*.json.');
    console.log('    4. NEVER auto-merge into the live catalog.');
  }

  process.exit(0);
}

main();
