// SearchAPI catalog expansion - DRY RUN BY DEFAULT.
//
// Generates a query plan for catalog gaps. It never calls SearchAPI unless all
// live gates are satisfied. Live results are candidate-only review data and are
// never merged into the runtime catalog by this script.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

type Frame = 'masc' | 'fem' | 'androgynous' | 'any';
type ImageUrlType = 'merchant-or-cdn' | 'google-thumbnail' | 'unsafe' | 'missing';
type CutoutReadiness = 'likely-cutout-ready' | 'needs-review' | 'reject';

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

interface LiveCheck {
  hasKey: boolean;
  liveEnvFlag: boolean;
  liveCliFlag: boolean;
  maxQueriesFromEnv: number;
  maxQueriesFromCli: number;
  wouldRunLive: boolean;
  blockedReason: string | null;
  liveQueryLimit: number;
}

interface SearchApiCandidate {
  id: string;
  source: 'searchapi';
  reviewStatus: 'candidate';
  imageStatus: 'original';
  liveMergeReady: false;
  query: string;
  queryIndex: number;
  targetCategory: Category;
  targetFrame: Frame;
  targetVibe?: string;
  reason: string;
  title: string;
  brand: string;
  retailer: string;
  price: string;
  priceCents: number;
  imageUrl: string;
  imageUrlType: ImageUrlType;
  productUrl: string;
  googleShoppingUrl: string;
  searchapiProductId: string;
  searchapiProductToken: string;
  cutoutReadiness: CutoutReadiness;
  qualityFlags: string[];
}

interface LiveRunReport {
  generatedAt: string;
  mode: 'live';
  queriesRequested: number;
  queriesRun: number;
  candidatesFound: number;
  goodImageCandidates: number;
  badOrUnsafeCandidates: number;
  directProductUrlCandidates: number;
  categoriesImproved: Record<Category, number>;
  imageUrlTypes: Record<ImageUrlType, number>;
  outputFile: string;
  queryReports: Array<{
    query: string;
    targetCategory: Category;
    targetFrame: Frame;
    targetVibe?: string;
    resultsReceived: number;
    candidatesAccepted: number;
    blockedCandidates: number;
    error?: string;
  }>;
  candidates: SearchApiCandidate[];
  notes: string[];
}

interface PlanReport {
  generatedAt: string;
  mode: 'dry-run' | 'live';
  totalCandidates: number;
  emittedCount: number;
  estimatedMaxQueries: number;
  estimatedMaxResults: number;
  candidates: QueryCandidate[];
  liveCheck: LiveCheck;
  liveRun?: LiveRunReport;
  notes: string[];
}

type SearchApiRawResult = Record<string, unknown>;

const SEARCHAPI_ENDPOINT = 'https://www.searchapi.io/api/v1/search';

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
      if (Number.isFinite(n) && n > 0) flags.maxQueries = Math.min(n, 100);
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
          query: `${frameLabel} ${vibe} ${category} product photo`.replace(/\s+/g, ' ').trim(),
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

function buildLiveCheck(flags: CliFlags): LiveCheck {
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
  const liveQueryLimit = Math.min(
    Number.isFinite(maxQueriesFromEnv) && maxQueriesFromEnv > 0 ? maxQueriesFromEnv : 0,
    flags.maxQueries > 0 ? flags.maxQueries : 0,
    flags.limit,
    100,
  );
  if (liveCliFlag && liveEnvFlag && liveQueryLimit <= 0) blockedReasons.push('computed live query limit is 0');
  const wouldRunLive = blockedReasons.length === 0;

  return {
    hasKey,
    liveEnvFlag,
    liveCliFlag,
    maxQueriesFromEnv: Number.isFinite(maxQueriesFromEnv) ? maxQueriesFromEnv : 0,
    maxQueriesFromCli: flags.maxQueries,
    wouldRunLive,
    blockedReason: wouldRunLive ? null : blockedReasons.join(' | '),
    liveQueryLimit,
  };
}

function buildReport(flags: CliFlags): PlanReport {
  const candidates = buildPlan();
  const emitted = candidates.slice(0, flags.limit);
  const liveCheck = buildLiveCheck(flags);

  return {
    generatedAt: new Date().toISOString(),
    mode: liveCheck.wouldRunLive ? 'live' : 'dry-run',
    totalCandidates: candidates.length,
    emittedCount: emitted.length,
    estimatedMaxQueries: emitted.length,
    estimatedMaxResults: emitted.reduce((sum, candidate) => sum + candidate.maxResults, 0),
    candidates: emitted,
    liveCheck,
    notes: [
      'This script does not call SearchAPI in dry-run mode.',
      'Live mode requires SEARCHAPI_KEY + SEARCHAPI_LIVE=true + SEARCHAPI_MAX_QUERIES=N + --live + --max-queries=N.',
      'Live results are candidate-only with reviewStatus=candidate and liveMergeReady=false.',
      'SearchAPI can find better merchant images and product URLs, but it does not remove backgrounds.',
    ],
  };
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function nestedString(result: SearchApiRawResult, key: string): string {
  const value = result[key];
  if (typeof value === 'string') return value;
  return '';
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isUsableUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:')) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  return true;
}

function isUnsafeImageUrl(url: string): boolean {
  if (!isUsableUrl(url)) return true;
  const lowered = url.toLowerCase();
  return lowered.includes('placeholder') || lowered.endsWith('.svg') || lowered.includes('/svg');
}

function imageUrlType(imageUrl: string): ImageUrlType {
  if (!imageUrl) return 'missing';
  if (isUnsafeImageUrl(imageUrl)) return 'unsafe';
  const host = safeHostname(imageUrl);
  if (host.includes('googleusercontent.com') || host.includes('gstatic.com') || host.includes('encrypted-tbn')) {
    return 'google-thumbnail';
  }
  return 'merchant-or-cdn';
}

function extractResults(payload: unknown): SearchApiRawResult[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const keys = ['shopping_results', 'inline_shopping_results', 'product_results', 'organic_results'];
  const results: SearchApiRawResult[] = [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') results.push(item as SearchApiRawResult);
      }
    }
  }
  return results;
}

function resultProductUrls(result: SearchApiRawResult): { productUrl: string; googleShoppingUrl: string } {
  const candidates = [
    firstString(result.source_link),
    firstString(result.source_url, result.sourceUrl, result.merchant_link, result.seller_link),
    firstString(result.link),
    firstString(result.product_link),
  ].filter(isUsableUrl);
  const productUrl = candidates.find((url) => !safeHostname(url).includes('google.')) || '';
  const googleShoppingUrl = candidates.find((url) => safeHostname(url).includes('google.')) || '';
  return { productUrl, googleShoppingUrl };
}

function classifyCandidate(result: SearchApiRawResult): { readiness: CutoutReadiness; flags: string[]; type: ImageUrlType } {
  const flags: string[] = [];
  const imageUrl = firstString(result.image, result.thumbnail, result.image_url);
  const type = imageUrlType(imageUrl);
  const urls = resultProductUrls(result);
  const title = firstString(result.title, result.name);

  if (!title) flags.push('missing-title');
  if (!imageUrl) flags.push('missing-image');
  if (type === 'unsafe') flags.push('unsafe-image-url');
  if (type === 'google-thumbnail') flags.push('google-thumbnail-image');
  if (!urls.productUrl) flags.push('missing-direct-product-url');
  if (!urls.productUrl && !urls.googleShoppingUrl) flags.push('missing-product-url');

  if (!title || !imageUrl || type === 'unsafe') return { readiness: 'reject', flags, type };
  if (urls.productUrl && type === 'merchant-or-cdn') return { readiness: 'likely-cutout-ready', flags, type };
  return { readiness: 'needs-review', flags, type };
}

function toSearchApiCandidate(result: SearchApiRawResult, plan: QueryCandidate, queryIndex: number): SearchApiCandidate {
  const title = firstString(result.title, result.name);
  const retailer = firstString(result.source, result.merchant, result.seller);
  const imageUrl = firstString(result.image, result.thumbnail, result.image_url);
  const urls = resultProductUrls(result);
  const priceText = firstString(result.price);
  const price = firstNumber(result.extracted_price, result.price);
  const classification = classifyCandidate(result);
  const idSeed = [plan.query, title, retailer, imageUrl, urls.productUrl, firstString(result.product_id)].join('|');

  return {
    id: `searchapi-${createHash('sha1').update(idSeed).digest('hex').slice(0, 16)}`,
    source: 'searchapi',
    reviewStatus: 'candidate',
    imageStatus: 'original',
    liveMergeReady: false,
    query: plan.query,
    queryIndex,
    targetCategory: plan.targetCategory,
    targetFrame: plan.targetFrame,
    targetVibe: plan.targetVibe,
    reason: plan.reason,
    title,
    brand: firstString(result.brand, retailer),
    retailer,
    price: priceText,
    priceCents: Math.round(price * 100),
    imageUrl,
    imageUrlType: classification.type,
    productUrl: urls.productUrl,
    googleShoppingUrl: urls.googleShoppingUrl,
    searchapiProductId: firstString(result.product_id),
    searchapiProductToken: firstString(result.product_token),
    cutoutReadiness: classification.readiness,
    qualityFlags: classification.flags,
  };
}

async function fetchSearchApiResults(plan: QueryCandidate): Promise<SearchApiRawResult[]> {
  const apiKey = process.env.SEARCHAPI_KEY?.trim();
  if (!apiKey) throw new Error('SEARCHAPI_KEY is missing');

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: plan.query,
    hl: 'en',
    gl: 'us',
    location: 'United States',
    num: String(Math.min(plan.maxResults, 20)),
  });

  const response = await fetch(`${SEARCHAPI_ENDPOINT}?${params.toString()}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) throw new Error(`SearchAPI HTTP ${response.status}`);
  return extractResults(await response.json());
}

function countRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

async function runLiveSearch(report: PlanReport): Promise<LiveRunReport> {
  const queryLimit = report.liveCheck.liveQueryLimit;
  const plans = report.candidates.slice(0, queryLimit);
  const candidates: SearchApiCandidate[] = [];
  const queryReports: LiveRunReport['queryReports'] = [];
  const seen = new Set<string>();
  const categoriesImproved = countRecord(CATEGORY_ORDER);
  const imageUrlTypes = countRecord(['merchant-or-cdn', 'google-thumbnail', 'unsafe', 'missing'] as const);

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    try {
      const results = await fetchSearchApiResults(plan);
      let accepted = 0;
      let blocked = 0;

      for (const result of results) {
        const candidate = toSearchApiCandidate(result, plan, index + 1);
        imageUrlTypes[candidate.imageUrlType] += 1;
        if (candidate.cutoutReadiness === 'reject') {
          blocked += 1;
          continue;
        }
        const dedupeKey = [candidate.title.toLowerCase(), candidate.productUrl || candidate.googleShoppingUrl, candidate.imageUrl].join('|');
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        candidates.push(candidate);
        categoriesImproved[candidate.targetCategory] += 1;
        accepted += 1;
      }

      queryReports.push({
        query: plan.query,
        targetCategory: plan.targetCategory,
        targetFrame: plan.targetFrame,
        targetVibe: plan.targetVibe,
        resultsReceived: results.length,
        candidatesAccepted: accepted,
        blockedCandidates: blocked,
      });
    } catch (error) {
      queryReports.push({
        query: plan.query,
        targetCategory: plan.targetCategory,
        targetFrame: plan.targetFrame,
        targetVibe: plan.targetVibe,
        resultsReceived: 0,
        candidatesAccepted: 0,
        blockedCandidates: 0,
        error: error instanceof Error ? error.message : 'Unknown SearchAPI error',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
  const outDir = join(process.cwd(), 'data', 'catalog', 'candidates');
  mkdirSync(outDir, { recursive: true });
  const outputFile = join(outDir, `searchapi-results-${stamp}.json`);

  const liveRun: LiveRunReport = {
    generatedAt: new Date().toISOString(),
    mode: 'live',
    queriesRequested: queryLimit,
    queriesRun: queryReports.filter((entry) => !entry.error).length,
    candidatesFound: candidates.length,
    goodImageCandidates: candidates.filter((candidate) => candidate.cutoutReadiness === 'likely-cutout-ready').length,
    badOrUnsafeCandidates: queryReports.reduce((sum, entry) => sum + entry.blockedCandidates, 0),
    directProductUrlCandidates: candidates.filter((candidate) => Boolean(candidate.productUrl)).length,
    categoriesImproved,
    imageUrlTypes,
    outputFile,
    queryReports,
    candidates,
    notes: [
      'Candidate-only SearchAPI output. Do not merge directly into runtime catalog.',
      'reviewStatus is candidate and liveMergeReady is false for every row.',
      'SearchAPI improves source discovery; transparent backgrounds still require cutout generation and review.',
    ],
  };

  writeFileSync(outputFile, `${JSON.stringify(liveRun, null, 2)}\n`, 'utf8');
  writeFileSync(join(process.cwd(), 'data', 'catalog', 'reports', 'searchapi-live-report.json'), `${JSON.stringify(liveRun, null, 2)}\n`, 'utf8');
  return liveRun;
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
  console.log(`  live query limit      : ${report.liveCheck.liveQueryLimit}`);
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

  if (report.liveRun) {
    console.log('');
    console.log('Live results');
    console.log('------------');
    console.log(`  queries run              : ${report.liveRun.queriesRun}/${report.liveRun.queriesRequested}`);
    console.log(`  candidates found         : ${report.liveRun.candidatesFound}`);
    console.log(`  likely cutout-ready      : ${report.liveRun.goodImageCandidates}`);
    console.log(`  bad/unsafe blocked       : ${report.liveRun.badOrUnsafeCandidates}`);
    console.log(`  direct product URLs      : ${report.liveRun.directProductUrlCandidates}`);
    console.log(`  output                   : ${report.liveRun.outputFile}`);
    console.log('  categories improved      :');
    for (const [category, count] of Object.entries(report.liveRun.categoriesImproved).filter(([, count]) => count > 0)) {
      console.log(`    ${category}: ${count}`);
    }
    console.log('  image URL types          :');
    for (const [type, count] of Object.entries(report.liveRun.imageUrlTypes).filter(([, count]) => count > 0)) {
      console.log(`    ${type}: ${count}`);
    }
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const report = buildReport(flags);

  if (report.mode === 'live') {
    report.liveRun = await runLiveSearch(report);
  }

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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'SearchAPI expansion failed');
  process.exit(1);
});
