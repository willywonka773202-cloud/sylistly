// SearchAPI catalog expansion - DRY RUN BY DEFAULT.
//
// Builds a transparent-coverage-first query plan. It never calls SearchAPI
// unless every live gate is satisfied. Live results are candidate-only review
// data and are never merged into the runtime catalog by this script.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

type Frame = 'masc' | 'fem' | 'androgynous' | 'any';
type ImageUrlType = 'merchantCdn' | 'googleThumbnailProxy' | 'googleShoppingImage' | 'searchIntent' | 'unsafe' | 'missing';
type LinkType = 'directProductUrl' | 'merchantUrl' | 'googleShoppingFallback' | 'missing';
type CutoutReadiness = 'high' | 'medium' | 'low' | 'reviewOnly' | 'blocked';

interface QueryTemplate {
  frame: Frame;
  productType: string;
  tail: 'shop' | 'official';
  query?: string;
}

interface CategoryPriority {
  category: Category;
  transparentCount: number;
  transparentTarget: number;
  transparentGap: number;
  safeOriginalCount: number;
  priority: number;
  maxQueries: number;
  reason: string;
}

interface QueryCandidate {
  query: string;
  targetCategory: Category;
  targetFrame: Frame;
  targetProductType: string;
  maxResults: number;
  reason: string;
  priority: number;
  transparentCount: number;
  transparentTarget: number;
  transparentGap: number;
  categoryMaxQueries: number;
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
  targetProductType: string;
  reason: string;
  title: string;
  brand: string;
  retailer: string;
  price: string;
  priceCents: number;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  imageUrlType: ImageUrlType;
  productUrl: string;
  merchantUrl: string;
  googleShoppingUrl: string;
  linkType: LinkType;
  searchapiProductId: string;
  cutoutReadiness: CutoutReadiness;
  qualityFlags: string[];
}

interface LiveRunReport {
  generatedAt: string;
  mode: 'live';
  queriesRequested: number;
  queriesRun: number;
  candidatesFound: number;
  highOrMediumCandidates: number;
  blockedCandidates: number;
  directOrMerchantLinkCandidates: number;
  queriesRunByCategory: Record<Category, number>;
  candidatesByCategory: Record<Category, number>;
  imageUrlTypeCounts: Record<ImageUrlType, number>;
  linkTypeCounts: Record<LinkType, number>;
  cutoutReadinessCounts: Record<CutoutReadiness, number>;
  weakCategoriesImproved: Category[];
  recommendation: 'continue' | 'stop' | 'adjust';
  recommendationReason: string;
  outputFile: string;
  queryReports: Array<{
    query: string;
    targetCategory: Category;
    targetFrame: Frame;
    targetProductType: string;
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
  plannedQueryCountByCategory: Record<Category, number>;
  weakCategoriesTargeted: Category[];
  maxQueriesPerCategory: Record<Category, number>;
  categoryPriorities: CategoryPriority[];
  candidates: QueryCandidate[];
  liveCheck: LiveCheck;
  liveRun?: LiveRunReport;
  notes: string[];
}

type SearchApiRawResult = Record<string, unknown>;

const SEARCHAPI_ENDPOINT = 'https://www.searchapi.io/api/v1/search';
const TARGETED_CATEGORY_ORDER: Category[] = ['shoes', 'bottom', 'outer', 'bag', 'hat', 'jewelry', 'top', 'eyewear'];
const WEAK_CATEGORY_SET = new Set<Category>(['shoes', 'bottom', 'outer', 'bag', 'hat', 'jewelry', 'top']);

const TRANSPARENT_TARGETS: Record<Category, number> = {
  hat: 10,
  outer: 20,
  top: 25,
  bottom: 25,
  shoes: 20,
  bag: 10,
  eyewear: 8,
  jewelry: 8,
};

const CATEGORY_MAX_QUERIES: Record<Category, number> = {
  shoes: 5,
  bottom: 5,
  outer: 5,
  bag: 4,
  hat: 3,
  jewelry: 2,
  top: 1,
  eyewear: 1,
};

const QUERY_TEMPLATES: Record<Category, QueryTemplate[]> = {
  shoes: [
    { frame: 'masc', productType: 'white leather sneakers', tail: 'shop', query: "site:zappos.com men's white leather sneakers product image" },
    { frame: 'fem', productType: 'black ankle boots', tail: 'shop', query: "site:zappos.com women's black ankle boots product image" },
    { frame: 'masc', productType: 'brown leather loafers', tail: 'official', query: "site:nike.com men's white leather sneakers product image" },
    { frame: 'fem', productType: 'running sneakers', tail: 'official', query: "site:adidas.com women's running sneakers product image" },
    { frame: 'androgynous', productType: 'white canvas sneakers', tail: 'shop', query: "men's white leather sneakers official product page" },
    { frame: 'fem', productType: 'strappy sandals', tail: 'shop' },
  ],
  bottom: [
    { frame: 'fem', productType: 'black trousers', tail: 'shop', query: "site:nordstrom.com women's black trousers product image" },
    { frame: 'masc', productType: 'cargo pants', tail: 'official', query: "site:gap.com men's cargo pants product image" },
    { frame: 'fem', productType: 'straight leg jeans', tail: 'shop', query: "site:levi.com women's straight leg jeans product image" },
    { frame: 'masc', productType: 'chino pants', tail: 'shop', query: "men's chino pants official product page" },
    { frame: 'fem', productType: 'wide leg pants', tail: 'official' },
    { frame: 'androgynous', productType: 'relaxed denim jeans', tail: 'shop' },
  ],
  outer: [
    { frame: 'masc', productType: 'bomber jacket', tail: 'official' },
    { frame: 'fem', productType: 'trench coat', tail: 'shop' },
    { frame: 'masc', productType: 'puffer jacket', tail: 'official' },
    { frame: 'fem', productType: 'tailored blazer', tail: 'shop' },
    { frame: 'androgynous', productType: 'denim jacket', tail: 'official' },
    { frame: 'fem', productType: 'leather jacket', tail: 'shop' },
  ],
  bag: [
    { frame: 'fem', productType: 'tote bag', tail: 'shop' },
    { frame: 'masc', productType: 'crossbody bag', tail: 'official' },
    { frame: 'androgynous', productType: 'backpack', tail: 'shop' },
    { frame: 'fem', productType: 'shoulder bag', tail: 'official' },
    { frame: 'masc', productType: 'messenger bag', tail: 'shop' },
  ],
  hat: [
    { frame: 'androgynous', productType: 'baseball cap', tail: 'official' },
    { frame: 'androgynous', productType: 'beanie hat', tail: 'shop' },
    { frame: 'androgynous', productType: 'bucket hat', tail: 'official' },
    { frame: 'fem', productType: 'sun hat', tail: 'shop' },
  ],
  jewelry: [
    { frame: 'fem', productType: 'gold hoop earrings', tail: 'shop' },
    { frame: 'masc', productType: 'silver chain necklace', tail: 'official' },
    { frame: 'androgynous', productType: 'silver signet ring', tail: 'shop' },
  ],
  top: [
    { frame: 'fem', productType: 'white button down shirt', tail: 'official' },
    { frame: 'masc', productType: 'knit polo shirt', tail: 'shop' },
    { frame: 'fem', productType: 'black tank top', tail: 'shop' },
  ],
  eyewear: [
    { frame: 'masc', productType: 'aviator sunglasses', tail: 'official' },
    { frame: 'fem', productType: 'cat eye sunglasses', tail: 'shop' },
  ],
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
  return /^https?:\/\//i.test(url);
}

function isSearchIntentUrl(url: string): boolean {
  const host = safeHostname(url);
  const lowered = url.toLowerCase();
  return host.includes('google.') && (lowered.includes('/search?') || lowered.includes('tbm=') || lowered.includes('udm='));
}

function isDirectProductPath(url: string): boolean {
  const lowered = url.toLowerCase();
  return [
    '/product/',
    '/products/',
    '/p/',
    '/shop/',
    '/item/',
    '/items/',
    '/dp/',
    '/sku/',
  ].some((part) => lowered.includes(part));
}

function valueAtPath(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringsAtPath(source: unknown, path: string): string[] {
  const value = valueAtPath(source, path);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => typeof item === 'string' ? [item.trim()] : [])
      .filter(Boolean);
  }
  return [];
}

function collectUrlStrings(source: unknown, keyHints: string[], maxDepth = 5): string[] {
  const urls: string[] = [];
  const seenObjects = new WeakSet<object>();
  const seenUrls = new Set<string>();
  const normalizedHints = keyHints.map((hint) => hint.toLowerCase());

  function visit(value: unknown, key = '', depth = 0): void {
    if (depth > maxDepth || value == null) return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const keyMatches = normalizedHints.some((hint) => key.toLowerCase().includes(hint));
      if (keyMatches && isUsableUrl(trimmed) && !seenUrls.has(trimmed)) {
        seenUrls.add(trimmed);
        urls.push(trimmed);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      if (seenObjects.has(value)) return;
      seenObjects.add(value);
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        visit(childValue, childKey, depth + 1);
      }
    }
  }

  visit(source);
  return urls;
}

function frameLabel(frame: Frame): string {
  if (frame === 'masc') return "men's";
  if (frame === 'fem') return "women's";
  if (frame === 'androgynous') return 'unisex';
  return '';
}

function buildQuery(template: QueryTemplate): string {
  if (template.query) return template.query.replace(/\s+/g, ' ').trim();
  const lead = `${frameLabel(template.frame)} ${template.productType}`.trim();
  return `${lead} product image white background ${template.tail}`.replace(/\s+/g, ' ').trim();
}

function countRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function buildCategoryPriorities(products: Product[]): CategoryPriority[] {
  const priorities: CategoryPriority[] = [];
  for (const category of TARGETED_CATEGORY_ORDER) {
    const categoryProducts = products.filter((product) => product.category === category);
    const transparentCount = categoryProducts.filter((product) => product.imageTransparentUrl).length;
    const safeOriginalCount = categoryProducts.filter((product) => product.imageUrl && !product.imageTransparentUrl).length;
    const transparentTarget = TRANSPARENT_TARGETS[category];
    const transparentGap = Math.max(0, transparentTarget - transparentCount);
    const orderBoost = TARGETED_CATEGORY_ORDER.length - TARGETED_CATEGORY_ORDER.indexOf(category);
    const coreBoost = WEAK_CATEGORY_SET.has(category) ? 100 : 0;
    const priority = coreBoost + orderBoost * 25 + transparentGap * 12 + Math.min(30, safeOriginalCount / 4);
    priorities.push({
      category,
      transparentCount,
      transparentTarget,
      transparentGap,
      safeOriginalCount,
      priority: Number(priority.toFixed(1)),
      maxQueries: CATEGORY_MAX_QUERIES[category],
      reason: `${transparentCount}/${transparentTarget} transparent assets; ${safeOriginalCount} original-image products remain available for source improvement.`,
    });
  }
  return priorities.sort((a, b) => b.priority - a.priority);
}

function buildPlan(): { priorities: CategoryPriority[]; candidates: QueryCandidate[] } {
  const products = ALL_CATALOG_PRODUCTS as Product[];
  const priorities = buildCategoryPriorities(products);
  const candidates: QueryCandidate[] = [];

  for (const priority of priorities) {
    if (priority.transparentGap <= 0 && priority.category !== 'top') continue;
    const templates = QUERY_TEMPLATES[priority.category].slice(0, priority.maxQueries);
    templates.forEach((template, index) => {
      candidates.push({
        query: buildQuery(template),
        targetCategory: priority.category,
        targetFrame: template.frame,
        targetProductType: template.productType,
        maxResults: 20,
        reason: `${priority.reason} Query uses product-image/white-background terms to avoid outfit/editorial results.`,
        priority: Number((priority.priority - index).toFixed(1)),
        transparentCount: priority.transparentCount,
        transparentTarget: priority.transparentTarget,
        transparentGap: priority.transparentGap,
        categoryMaxQueries: priority.maxQueries,
      });
    });
  }

  return { priorities, candidates: candidates.sort((a, b) => b.priority - a.priority) };
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
  const plan = buildPlan();
  const emitted = plan.candidates.slice(0, flags.limit);
  const liveCheck = buildLiveCheck(flags);
  const plannedQueryCountByCategory = countRecord(CATEGORY_ORDER);
  const maxQueriesPerCategory = countRecord(CATEGORY_ORDER);
  for (const candidate of emitted) plannedQueryCountByCategory[candidate.targetCategory] += 1;
  for (const priority of plan.priorities) maxQueriesPerCategory[priority.category] = priority.maxQueries;

  return {
    generatedAt: new Date().toISOString(),
    mode: liveCheck.wouldRunLive ? 'live' : 'dry-run',
    totalCandidates: plan.candidates.length,
    emittedCount: emitted.length,
    estimatedMaxQueries: emitted.length,
    estimatedMaxResults: emitted.reduce((sum, candidate) => sum + candidate.maxResults, 0),
    plannedQueryCountByCategory,
    weakCategoriesTargeted: CATEGORY_ORDER.filter((category) => plannedQueryCountByCategory[category] > 0 && WEAK_CATEGORY_SET.has(category)),
    maxQueriesPerCategory,
    categoryPriorities: plan.priorities,
    candidates: emitted,
    liveCheck,
    notes: [
      'This script does not call SearchAPI in dry-run mode.',
      'The query plan prioritizes transparent coverage gaps before broad catalog count gaps.',
      'Live mode requires SEARCHAPI_KEY + SEARCHAPI_LIVE=true + SEARCHAPI_MAX_QUERIES=N + --live + --max-queries=N.',
      'Live results are candidate-only with reviewStatus=candidate and liveMergeReady=false.',
      'SearchAPI can find better merchant images and product URLs, but it does not remove backgrounds.',
    ],
  };
}

function imageUrlType(imageUrl: string): ImageUrlType {
  if (!imageUrl) return 'missing';
  if (!isUsableUrl(imageUrl)) return 'unsafe';
  const lowered = imageUrl.toLowerCase();
  if (lowered.includes('placeholder') || lowered.endsWith('.svg') || lowered.includes('/svg')) return 'unsafe';
  if (isSearchIntentUrl(imageUrl)) return 'searchIntent';
  const host = safeHostname(imageUrl);
  if (host.includes('google.') && lowered.includes('oshopproduct')) return 'googleShoppingImage';
  if (host.includes('googleusercontent.com') || host.includes('gstatic.com') || host.includes('encrypted-tbn')) {
    return 'googleThumbnailProxy';
  }
  return 'merchantCdn';
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

function resultProductUrls(result: SearchApiRawResult): { productUrl: string; merchantUrl: string; googleShoppingUrl: string; linkType: LinkType } {
  const explicitProductUrls = [
    ...stringsAtPath(result, 'product_link'),
    ...stringsAtPath(result, 'product.url'),
    ...stringsAtPath(result, 'product.link'),
    ...stringsAtPath(result, 'offer.link'),
    ...stringsAtPath(result, 'offers.0.link'),
    ...collectUrlStrings(result, ['product_link', 'product_url', 'productUrl', 'offer_link', 'buy_link']),
  ].filter(isUsableUrl);
  const explicitMerchantUrls = [
    ...stringsAtPath(result, 'source_link'),
    ...stringsAtPath(result, 'source_url'),
    ...stringsAtPath(result, 'sourceUrl'),
    ...stringsAtPath(result, 'merchant_link'),
    ...stringsAtPath(result, 'seller_link'),
    ...stringsAtPath(result, 'merchant.url'),
    ...stringsAtPath(result, 'seller.url'),
    ...collectUrlStrings(result, ['source', 'merchant', 'seller', 'retailer', 'store']),
  ].filter(isUsableUrl);
  const fallbackUrls = [
    firstString(result.link),
    firstString(result.url),
    ...collectUrlStrings(result, ['link', 'url']),
  ].filter(isUsableUrl);

  const nonGoogleProduct = explicitProductUrls.find((url) => !safeHostname(url).includes('google.') && !isSearchIntentUrl(url)) || '';
  const nonGoogleMerchant = explicitMerchantUrls.find((url) => !safeHostname(url).includes('google.') && !isSearchIntentUrl(url)) || '';
  const nonGoogleFallback = fallbackUrls.find((url) => !safeHostname(url).includes('google.') && !isSearchIntentUrl(url)) || '';
  const googleShoppingUrl = [...explicitProductUrls, ...explicitMerchantUrls, ...fallbackUrls].find((url) => safeHostname(url).includes('google.')) || '';
  const productUrl = nonGoogleProduct || (isDirectProductPath(nonGoogleFallback) ? nonGoogleFallback : '');
  const merchantUrl = productUrl ? '' : nonGoogleMerchant || nonGoogleFallback;
  const linkType: LinkType = productUrl
    ? 'directProductUrl'
    : merchantUrl ? 'merchantUrl'
    : googleShoppingUrl ? 'googleShoppingFallback' : 'missing';

  return { productUrl, merchantUrl, googleShoppingUrl, linkType };
}

function resultImageUrls(result: SearchApiRawResult): { imageUrl: string; thumbnailUrl: string; sourceUrl: string; imageType: ImageUrlType } {
  const directImages = [
    firstString(result.image_url),
    firstString(result.product_image),
    firstString(result.original_image),
    ...stringsAtPath(result, 'image.url'),
    ...stringsAtPath(result, 'product.image'),
    ...stringsAtPath(result, 'product.image_url'),
    ...stringsAtPath(result, 'images.0'),
    ...stringsAtPath(result, 'images.0.url'),
    ...collectUrlStrings(result, ['image_url', 'imageUrl', 'product_image', 'original_image', 'source_image']),
  ].filter(isUsableUrl);
  const thumbnailImages = [
    firstString(result.thumbnail),
    firstString(result.image),
    ...stringsAtPath(result, 'thumbnail.url'),
    ...stringsAtPath(result, 'thumbnails.0'),
    ...stringsAtPath(result, 'thumbnails.0.url'),
    ...collectUrlStrings(result, ['thumbnail', 'thumb']),
  ].filter(isUsableUrl);

  const sourceUrl = directImages.find((url) => imageUrlType(url) === 'merchantCdn') || '';
  const imageUrl = sourceUrl || directImages[0] || thumbnailImages[0] || '';
  return {
    imageUrl,
    thumbnailUrl: thumbnailImages[0] || '',
    sourceUrl,
    imageType: imageUrlType(imageUrl),
  };
}

function sanitizeRawValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth-limit]';
  if (typeof value === 'string') {
    if (value.length > 500) return `${value.slice(0, 500)}...[truncated]`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 5).map((item) => sanitizeRawValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase();
    if (lowered.includes('token') || lowered.includes('cookie') || lowered.includes('key') || lowered.includes('auth')) {
      sanitized[key] = '[redacted]';
      continue;
    }
    sanitized[key] = sanitizeRawValue(childValue, depth + 1);
  }
  return sanitized;
}

function maybeWriteDebugSample(plan: QueryCandidate, payload: unknown, results: SearchApiRawResult[]): void {
  if (process.env.SEARCHAPI_DEBUG_SAMPLE !== 'true') return;
  const outDir = join(process.cwd(), 'data', 'catalog', 'reports');
  mkdirSync(outDir, { recursive: true });
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const sample = {
    generatedAt: new Date().toISOString(),
    query: plan.query,
    targetCategory: plan.targetCategory,
    topLevelKeys: Object.keys(record),
    resultCounts: {
      shopping_results: Array.isArray(record.shopping_results) ? record.shopping_results.length : 0,
      inline_shopping_results: Array.isArray(record.inline_shopping_results) ? record.inline_shopping_results.length : 0,
      product_results: Array.isArray(record.product_results) ? record.product_results.length : 0,
      organic_results: Array.isArray(record.organic_results) ? record.organic_results.length : 0,
      extractedResults: results.length,
    },
    firstResults: results.slice(0, 3).map((result) => sanitizeRawValue(result)),
  };
  writeFileSync(join(outDir, 'searchapi-debug-sample.json'), `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
}

function hasProductLikeTitle(title: string, category: Category): boolean {
  const lowered = title.toLowerCase();
  if (!title.trim()) return false;
  const editorialSignals = ['outfit idea', 'lookbook', 'style guide', 'how to wear', 'pinterest', 'polyvore', 'aesthetic'];
  if (editorialSignals.some((signal) => lowered.includes(signal))) return false;
  const categorySignals: Record<Category, string[]> = {
    shoes: ['shoe', 'sneaker', 'boot', 'loafer', 'sandal', 'heel', 'clog'],
    bottom: ['pant', 'trouser', 'jean', 'short', 'skirt', 'cargo', 'chino'],
    outer: ['jacket', 'coat', 'blazer', 'trench', 'puffer', 'cardigan'],
    bag: ['bag', 'tote', 'backpack', 'crossbody', 'shoulder', 'messenger'],
    hat: ['hat', 'cap', 'beanie', 'bucket'],
    jewelry: ['earring', 'necklace', 'chain', 'ring', 'bracelet', 'hoop'],
    top: ['shirt', 'tee', 'polo', 'tank', 'sweater', 'hoodie', 'blouse'],
    eyewear: ['sunglasses', 'glasses', 'eyewear', 'aviator', 'wayfarer'],
  };
  return categorySignals[category].some((signal) => lowered.includes(signal));
}

function classifyCandidate(result: SearchApiRawResult, plan: QueryCandidate): { readiness: CutoutReadiness; flags: string[]; imageType: ImageUrlType; linkType: LinkType } {
  const flags: string[] = [];
  const imageInfo = resultImageUrls(result);
  const imageType = imageInfo.imageType;
  const urls = resultProductUrls(result);
  const title = firstString(result.title, result.name);
  const productLikeTitle = hasProductLikeTitle(title, plan.targetCategory);
  const targetWeakCategory = WEAK_CATEGORY_SET.has(plan.targetCategory);

  if (!title) flags.push('missing-title');
  if (title && !productLikeTitle) flags.push('title-not-clearly-product-like');
  if (!imageInfo.imageUrl) flags.push('missing-image');
  if (imageInfo.sourceUrl) flags.push('merchant-image-source-found');
  if (imageType === 'unsafe') flags.push('unsafe-image-url');
  if (imageType === 'searchIntent') flags.push('search-intent-image-url');
  if (imageType === 'googleThumbnailProxy') flags.push('google-thumbnail-proxy-image');
  if (imageType === 'googleShoppingImage') flags.push('google-shopping-image-url');
  if (urls.linkType === 'missing') flags.push('missing-product-url');
  if (urls.linkType === 'googleShoppingFallback') flags.push('google-shopping-fallback-only');
  if (urls.linkType === 'directProductUrl' || urls.linkType === 'merchantUrl') flags.push('merchant-link-found');
  if (!targetWeakCategory) flags.push('not-priority-transparent-gap-category');

  if (!title || !productLikeTitle || imageType === 'unsafe' || imageType === 'missing' || imageType === 'searchIntent') {
    return { readiness: 'blocked', flags, imageType, linkType: urls.linkType };
  }
  if (targetWeakCategory && imageType === 'merchantCdn' && (urls.linkType === 'directProductUrl' || urls.linkType === 'merchantUrl')) {
    return { readiness: 'high', flags, imageType, linkType: urls.linkType };
  }
  if (targetWeakCategory && (imageType === 'merchantCdn' || imageType === 'googleShoppingImage') && (urls.linkType === 'directProductUrl' || urls.linkType === 'merchantUrl')) {
    return { readiness: 'medium', flags, imageType, linkType: urls.linkType };
  }
  if (targetWeakCategory && imageType === 'merchantCdn' && urls.linkType === 'googleShoppingFallback') {
    return { readiness: 'medium', flags, imageType, linkType: urls.linkType };
  }
  if (targetWeakCategory) return { readiness: 'low', flags, imageType, linkType: urls.linkType };
  return { readiness: 'reviewOnly', flags, imageType, linkType: urls.linkType };
}

function toSearchApiCandidate(result: SearchApiRawResult, plan: QueryCandidate, queryIndex: number): SearchApiCandidate {
  const title = firstString(result.title, result.name);
  const retailer = firstString(result.source, result.merchant, result.seller);
  const imageInfo = resultImageUrls(result);
  const urls = resultProductUrls(result);
  const priceText = firstString(result.price);
  const price = firstNumber(result.extracted_price, result.price);
  const classification = classifyCandidate(result, plan);
  const idSeed = [plan.query, title, retailer, imageInfo.imageUrl, urls.productUrl || urls.merchantUrl, firstString(result.product_id)].join('|');

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
    targetProductType: plan.targetProductType,
    reason: plan.reason,
    title,
    brand: firstString(result.brand, retailer),
    retailer,
    price: priceText,
    priceCents: Math.round(price * 100),
    imageUrl: imageInfo.imageUrl,
    thumbnailUrl: imageInfo.thumbnailUrl,
    sourceUrl: imageInfo.sourceUrl,
    imageUrlType: classification.imageType,
    productUrl: urls.productUrl,
    merchantUrl: urls.merchantUrl,
    googleShoppingUrl: urls.googleShoppingUrl,
    linkType: classification.linkType,
    searchapiProductId: firstString(result.product_id),
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
  const payload = await response.json();
  const results = extractResults(payload);
  maybeWriteDebugSample(plan, payload, results);
  return results;
}

function makeLiveRecommendation(liveRun: Omit<LiveRunReport, 'recommendation' | 'recommendationReason'>): Pick<LiveRunReport, 'recommendation' | 'recommendationReason'> {
  const highMedium = liveRun.highOrMediumCandidates;
  const directLinks = liveRun.directOrMerchantLinkCandidates;
  const merchantImages = liveRun.imageUrlTypeCounts.merchantCdn;
  const totalImages = Object.values(liveRun.imageUrlTypeCounts).reduce((sum, count) => sum + count, 0);
  const googleThumbnailShare = totalImages > 0 ? liveRun.imageUrlTypeCounts.googleThumbnailProxy / totalImages : 0;
  const coreImproved = ['shoes', 'bottom', 'outer', 'bag', 'hat'].some((category) => liveRun.candidatesByCategory[category as Category] > 0);
  if (directLinks === 0 && merchantImages === 0 && highMedium === 0 && googleThumbnailShare > 0.8) {
    return { recommendation: 'stop', recommendationReason: 'Quality gate failed: no merchant/product links, no merchant/CDN images, no high/medium candidates, and Google thumbnail proxies dominate.' };
  }
  if (highMedium >= 15 && directLinks >= 15 && coreImproved) {
    return { recommendation: 'continue', recommendationReason: 'The batch produced enough high/medium candidates with merchant links in core weak categories.' };
  }
  if (highMedium === 0 || directLinks === 0) {
    return { recommendation: 'adjust', recommendationReason: 'The batch did not produce high/medium candidates with merchant links; revise query/provider parsing before spending more.' };
  }
  return { recommendation: 'adjust', recommendationReason: 'The batch produced some useful candidates but not enough quality for a larger spend yet.' };
}

async function runLiveSearch(report: PlanReport): Promise<LiveRunReport> {
  const queryLimit = report.liveCheck.liveQueryLimit;
  const plans = report.candidates.slice(0, queryLimit);
  const candidates: SearchApiCandidate[] = [];
  const queryReports: LiveRunReport['queryReports'] = [];
  const seen = new Set<string>();
  const queriesRunByCategory = countRecord(CATEGORY_ORDER);
  const candidatesByCategory = countRecord(CATEGORY_ORDER);
  const imageUrlTypeCounts = countRecord(['merchantCdn', 'googleThumbnailProxy', 'googleShoppingImage', 'searchIntent', 'unsafe', 'missing'] as const);
  const linkTypeCounts = countRecord(['directProductUrl', 'merchantUrl', 'googleShoppingFallback', 'missing'] as const);
  const cutoutReadinessCounts = countRecord(['high', 'medium', 'low', 'reviewOnly', 'blocked'] as const);

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    try {
      const results = await fetchSearchApiResults(plan);
      queriesRunByCategory[plan.targetCategory] += 1;
      let accepted = 0;
      let blocked = 0;

      for (const result of results) {
        const candidate = toSearchApiCandidate(result, plan, index + 1);
        imageUrlTypeCounts[candidate.imageUrlType] += 1;
        linkTypeCounts[candidate.linkType] += 1;
        cutoutReadinessCounts[candidate.cutoutReadiness] += 1;
        if (candidate.cutoutReadiness === 'blocked') {
          blocked += 1;
          continue;
        }
        const dedupeKey = [candidate.title.toLowerCase(), candidate.productUrl || candidate.googleShoppingUrl, candidate.imageUrl].join('|');
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        candidates.push(candidate);
        candidatesByCategory[candidate.targetCategory] += 1;
        accepted += 1;
      }

      queryReports.push({
        query: plan.query,
        targetCategory: plan.targetCategory,
        targetFrame: plan.targetFrame,
        targetProductType: plan.targetProductType,
        resultsReceived: results.length,
        candidatesAccepted: accepted,
        blockedCandidates: blocked,
      });
    } catch (error) {
      queryReports.push({
        query: plan.query,
        targetCategory: plan.targetCategory,
        targetFrame: plan.targetFrame,
        targetProductType: plan.targetProductType,
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
  const partialRun = {
    generatedAt: new Date().toISOString(),
    mode: 'live' as const,
    queriesRequested: queryLimit,
    queriesRun: queryReports.filter((entry) => !entry.error).length,
    candidatesFound: candidates.length,
    highOrMediumCandidates: candidates.filter((candidate) => candidate.cutoutReadiness === 'high' || candidate.cutoutReadiness === 'medium').length,
    blockedCandidates: queryReports.reduce((sum, entry) => sum + entry.blockedCandidates, 0),
    directOrMerchantLinkCandidates: candidates.filter((candidate) => candidate.linkType === 'directProductUrl' || candidate.linkType === 'merchantUrl').length,
    queriesRunByCategory,
    candidatesByCategory,
    imageUrlTypeCounts,
    linkTypeCounts,
    cutoutReadinessCounts,
    weakCategoriesImproved: CATEGORY_ORDER.filter((category) => candidatesByCategory[category] > 0 && WEAK_CATEGORY_SET.has(category)),
    outputFile,
    queryReports,
    candidates,
    notes: [
      'Candidate-only SearchAPI output. Do not merge directly into runtime catalog.',
      'reviewStatus is candidate and liveMergeReady is false for every row.',
      'SearchAPI improves source discovery; transparent backgrounds still require cutout generation and review.',
    ],
  };
  const recommendation = makeLiveRecommendation(partialRun);
  const liveRun: LiveRunReport = { ...partialRun, ...recommendation };

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

function printCountMap<T extends string>(map: Record<T, number>): void {
  for (const [key, count] of Object.entries(map).filter(([, count]) => Number(count) > 0)) {
    console.log(`  ${pad(key, 12)} ${count}`);
  }
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
  console.log('Pre-live quality gate');
  console.log('---------------------');
  console.log('Planned query count by category:');
  printCountMap(report.plannedQueryCountByCategory);
  console.log(`Weak categories targeted: ${report.weakCategoriesTargeted.join(', ') || 'none'}`);
  console.log('Max queries per category:');
  for (const category of TARGETED_CATEGORY_ORDER) {
    console.log(`  ${pad(category, 12)} ${report.maxQueriesPerCategory[category]}`);
  }
  console.log('');
  console.log('Category priorities');
  console.log('-------------------');
  for (const priority of report.categoryPriorities) {
    console.log(`  ${pad(priority.category, 8)} p=${priority.priority} max=${priority.maxQueries} - ${priority.reason}`);
  }
  console.log('');
  console.log('Top query plan');
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
    console.log(`  high/medium candidates   : ${report.liveRun.highOrMediumCandidates}`);
    console.log(`  blocked candidates       : ${report.liveRun.blockedCandidates}`);
    console.log(`  direct/merchant links    : ${report.liveRun.directOrMerchantLinkCandidates}`);
    console.log(`  weak categories improved : ${report.liveRun.weakCategoriesImproved.join(', ') || 'none'}`);
    console.log(`  recommendation           : ${report.liveRun.recommendation} - ${report.liveRun.recommendationReason}`);
    console.log(`  output                   : ${report.liveRun.outputFile}`);
    console.log('  queries run by category  :');
    printCountMap(report.liveRun.queriesRunByCategory);
    console.log('  candidates by category   :');
    printCountMap(report.liveRun.candidatesByCategory);
    console.log('  image URL types          :');
    printCountMap(report.liveRun.imageUrlTypeCounts);
    console.log('  link types               :');
    printCountMap(report.liveRun.linkTypeCounts);
    console.log('  cutout readiness         :');
    printCountMap(report.liveRun.cutoutReadinessCounts);
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
