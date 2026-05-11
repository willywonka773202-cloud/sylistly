import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Gender = 'masc' | 'fem' | 'androgynous';
type Category = 'hat' | 'outer' | 'top' | 'bottom' | 'shoes' | 'bag' | 'eyewear' | 'jewelry';
type BudgetTier = 'budget' | 'mid' | 'premium' | 'luxury' | 'unknown';

type SearchApiResult = {
  title?: string;
  link?: string;
  url?: string;
  product_link?: string;
  product_page_url?: string;
  product_url?: string;
  shopping_link?: string;
  offers_link?: string;
  merchant_link?: string;
  serpapi_link?: string;
  source?: string;
  seller?: string;
  seller_name?: string;
  merchant?: string;
  store?: string;
  brand?: string;
  snippet?: string;
  price?: string;
  extracted_price?: number | string;
  thumbnail?: string;
  thumbnails?: string[];
  image?: string;
  images?: string[];
  position?: number;
  product_id?: string;
  offers?: Array<{
    link?: string;
    url?: string;
    product_link?: string;
    price?: string;
    extracted_price?: number | string;
  }>;
};

type SearchApiResponse = {
  shopping_results?: SearchApiResult[];
  organic_results?: SearchApiResult[];
  product_results?: SearchApiResult[];
  inline_shopping_results?: SearchApiResult[];
  results?: SearchApiResult[];
};

type CatalogCandidate = {
  id: string;
  brand: string;
  name: string;
  category: Category;
  gender: Gender[];
  priceCents: number | null;
  currency: 'USD';
  budgetTier: BudgetTier;
  imageUrl: string | null;
  productUrl: string;
  retailerUrl: string;
  sourceQuery: string;
  sourceResultPosition: number | null;
  sourceProductId: string | null;
  retailer: string;
  vibes: string[];
  occasions: string[];
  searchTerms: string[];
  needsReview: boolean;
  reviewReasons: string[];
  importedAt: string;
  metadata: {
    source: 'searchapi';
    endpoint: string;
    imageQuality: 'ok' | 'missing';
    reviewStatus: 'candidate';
  };
};

type RejectionReason =
  | 'missingName'
  | 'missingUrl'
  | 'badCategory'
  | 'duplicateUrl'
  | 'duplicateBrandName'
  | 'duplicateWeakIdentity'
  | 'nonFashion'
  | 'noPrice'
  | 'unknownGender';

type RejectionStats = Record<RejectionReason, number>;

type NormalizeResult =
  | { candidate: CatalogCandidate; rejected?: never }
  | { candidate: null; rejected: RejectionReason };

type DuplicateIdentity =
  | { kind: 'url'; key: string }
  | { kind: 'brandName'; key: string }
  | { kind: 'weakIdentity'; key: string };

const SEARCHAPI_ENDPOINT = process.env.SEARCHAPI_ENDPOINT || 'https://www.searchapi.io/api/v1/search';
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY?.trim();
const DRY_RUN = process.env.SEARCHAPI_DRY_RUN === 'true';
const DEBUG_DEDUPE = process.env.SEARCHAPI_DEBUG_DEDUPE === 'true';
const MAX_RESULTS_PER_QUERY = parsePositiveInteger(process.env.SEARCHAPI_MAX_RESULTS, 40);
const MAX_QUERIES = parseOptionalPositiveInteger(process.env.SEARCHAPI_MAX_QUERIES);
const PLACEHOLDER_SEARCHAPI_KEY = ['your', 'key', 'here'].join('_');

const SEARCH_QUERIES = [
  'men capsule wardrobe basics products',
  'women capsule wardrobe basics products',
  'men streetwear cargos hoodie sneakers',
  'women clean girl cardigan jeans sneakers bag',
  'men old money loafers trousers polo blazer',
  'women old money blazer trousers flats bag',
  'men gym shorts hoodie trainers',
  'women gym leggings tank sneakers',
  'men date night jacket boots shirt',
  'women date night dress heels bag',
  'college campus outfits men products',
  'college campus outfits women products',
  'airport travel outfit essentials unisex',
  'budget fashion basics men women sneakers jeans tees',
  'premium fashion accessories bags sunglasses jewelry',
  'popular sneakers outfit styling products',
] as const;

const REJECTION_LABELS: Record<RejectionReason, string> = {
  missingName: 'missing name',
  missingUrl: 'missing url',
  badCategory: 'bad category',
  duplicateUrl: 'duplicate by url',
  duplicateBrandName: 'duplicate by brand/name',
  duplicateWeakIdentity: 'duplicate by weak missing identity',
  nonFashion: 'non-fashion',
  noPrice: 'no price',
  unknownGender: 'unknown gender',
};

const FASHION_PRODUCT_PATTERN = /sneaker|shoe|trainer|loafer|boot|heel|flat|sandal|slide|bag|tote|backpack|crossbody|duffel|purse|handbag|sunglass|eyewear|glasses|necklace|ring|earring|bracelet|watch|jewelry|jewellery|chain|cap|hat|beanie|jacket|coat|blazer|hoodie|cardigan|sweater|crewneck|puffer|trench|overshirt|fleece|shirt|tee|t-shirt|tank|polo|blouse|bodysuit|dress|skirt|jean|pant|trouser|cargo|short|legging|chino|jogger|sweatpant|wardrobe|apparel|clothing|fashion|accessor/i;

const EDITORIAL_OR_NON_PRODUCT_PATTERN = /pinterest|reddit|youtube|tiktok|instagram|lookbook|outfit ideas|outfit inspo|inspiration|how to|guide|article|blog|wiki|quiz|template|wallpaper|stock photo/i;

class SearchApiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SearchApiHttpError';
    this.status = status;
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function redactSearchApiKey(value: string): string {
  return SEARCHAPI_KEY ? value.replaceAll(SEARCHAPI_KEY, '[redacted-searchapi-key]') : value;
}

function keyFingerprint() {
  const key = SEARCHAPI_KEY || '';
  const canShowEdges = key.length > 10;

  return {
    exists: key.length > 0 ? 'yes' : 'no',
    first6: canShowEdges ? key.slice(0, 6) : key ? '[hidden-short-key]' : 'n/a',
    last4: canShowEdges ? key.slice(-4) : key ? '[hidden-short-key]' : 'n/a',
    length: key.length,
  };
}

function printKeyFingerprint() {
  const fingerprint = keyFingerprint();
  console.log(
    `SearchAPI key fingerprint: exists=${fingerprint.exists}, first6=${fingerprint.first6}, last4=${fingerprint.last4}, length=${fingerprint.length}`,
  );
}

function hasRealSearchApiKey(): boolean {
  const key = SEARCHAPI_KEY;
  return Boolean(key && key !== PLACEHOLDER_SEARCHAPI_KEY);
}

function getSearchApiKey(): string {
  const key = SEARCHAPI_KEY;
  if (!key || key === PLACEHOLDER_SEARCHAPI_KEY) {
    throw new Error('Missing real SearchAPI key. Set SEARCHAPI_KEY in .env.local.');
  }
  return key;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function backupCandidatesFile(outputPath: string): Promise<string> {
  const backupPath = path.join(path.dirname(outputPath), 'searchapi-catalog-candidates.backup.json');
  if (await fileExists(outputPath)) {
    await copyFile(outputPath, backupPath);
  } else {
    await writeFile(backupPath, '[]\n', 'utf8');
  }
  return backupPath;
}

async function printRuntimeDiagnostics() {
  const cwd = path.resolve(process.cwd());
  const envLocalPath = path.join(cwd, '.env.local');
  console.log(`Importer cwd: ${cwd}`);
  console.log(`.env.local exists: ${(await fileExists(envLocalPath)) ? 'yes' : 'no'}`);
  printKeyFingerprint();
}

function cleanText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeToken(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slug(value: string): string {
  return normalizeToken(value).replace(/\s+/g, '-').slice(0, 70) || 'catalog-candidate';
}

function stableId(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function createRejectionStats(): RejectionStats {
  return {
    missingName: 0,
    missingUrl: 0,
    badCategory: 0,
    duplicateUrl: 0,
    duplicateBrandName: 0,
    duplicateWeakIdentity: 0,
    nonFashion: 0,
    noPrice: 0,
    unknownGender: 0,
  };
}

function incrementRejection(stats: RejectionStats, reason: RejectionReason) {
  stats[reason] += 1;
}

function mergeRejectionStats(target: RejectionStats, source: RejectionStats) {
  for (const reason of Object.keys(REJECTION_LABELS) as RejectionReason[]) {
    target[reason] += source[reason];
  }
}

function printImportStats(label: string, rawCount: number, acceptedCount: number, stats: RejectionStats) {
  console.log(`${label}:`);
  console.log(`  raw results: ${rawCount}`);
  console.log(`  accepted candidates: ${acceptedCount}`);
  for (const reason of Object.keys(REJECTION_LABELS) as RejectionReason[]) {
    console.log(`  rejected: ${REJECTION_LABELS[reason]}: ${stats[reason]}`);
  }
}

function firstCleanUrl(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = normalizeUrl(value);
    if (normalized) return normalized;
  }
  return '';
}

function extractProductUrl(result: SearchApiResult): string {
  return firstCleanUrl([
    result.product_link,
    result.product_page_url,
    result.product_url,
    result.link,
    result.url,
    result.shopping_link,
    result.merchant_link,
    result.offers?.[0]?.product_link,
    result.offers?.[0]?.link,
    result.offers?.[0]?.url,
    result.offers_link,
    result.serpapi_link,
  ]);
}

function extractImageUrl(result: SearchApiResult): string | null {
  return firstCleanUrl([
    result.thumbnail,
    result.thumbnails?.[0],
    result.image,
    result.images?.[0],
  ]) || null;
}

function normalizeUrl(value?: string | null): string {
  const raw = cleanText(value);
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gclid',
      'fbclid',
      'msclkid',
      'ref',
      'tag',
      'api_key',
    ];
    for (const param of trackingParams) url.searchParams.delete(param);
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}

function getUrlDomain(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function identityKeyPart(value: string): string {
  return normalizeToken(value).slice(0, 120);
}

function createDuplicateIdentity(candidate: CatalogCandidate): DuplicateIdentity {
  const normalizedProductUrl = normalizeUrl(candidate.productUrl).toLowerCase();
  if (normalizedProductUrl) {
    return { kind: 'url', key: normalizedProductUrl };
  }

  const brandKey = identityKeyPart(candidate.brand);
  const nameKey = identityKeyPart(candidate.name);
  if (brandKey && nameKey && candidate.priceCents !== null) {
    return {
      kind: 'brandName',
      key: `${brandKey}|${nameKey}|${candidate.category}|${candidate.priceCents}`,
    };
  }

  const domain = getUrlDomain(candidate.retailerUrl);
  return {
    kind: 'weakIdentity',
    key: `${nameKey}|${candidate.category}|${domain || identityKeyPart(candidate.retailer)}`,
  };
}

function duplicateReasonForIdentity(identity: DuplicateIdentity): RejectionReason {
  if (identity.kind === 'url') return 'duplicateUrl';
  if (identity.kind === 'brandName') return 'duplicateBrandName';
  return 'duplicateWeakIdentity';
}

function debugDuplicate({
  count,
  query,
  identity,
  candidate,
}: {
  count: number;
  query: string;
  identity: DuplicateIdentity;
  candidate: CatalogCandidate;
}) {
  if (!DEBUG_DEDUPE || count > 10) return;
  console.log(
    `Dedupe ${count}: ${duplicateReasonForIdentity(identity)} key=${identity.key} query="${query}" product="${candidate.brand} ${candidate.name}"`,
  );
}

function inferGender(query: string, text: string): Gender[] {
  const lower = `${query} ${text}`.toLowerCase();
  const hasWomen = /\bwomen\b|\bwoman\b|\bfemale\b|\bfemme\b|\bgirl\b/.test(lower);
  const hasMen = /\bmen\b|\bman\b|\bmale\b|\bmasc\b/.test(lower);
  const hasUnisex = /\bunisex\b|\bneutral\b|\bandrogynous\b/.test(lower);

  if (hasMen && hasWomen) return ['masc', 'fem', 'androgynous'];
  if (hasWomen) return ['fem', 'androgynous'];
  if (hasMen) return ['masc', 'androgynous'];
  if (hasUnisex) return ['androgynous'];
  return ['androgynous'];
}

function inferCategory(text: string): Category | null {
  const lower = text.toLowerCase();
  if (/sneaker|shoe|trainer|loafer|boot|heel|flat|sandal|slide/.test(lower)) return 'shoes';
  if (/bag|tote|backpack|crossbody|duffel|purse|handbag|shoulder bag/.test(lower)) return 'bag';
  if (/sunglass|eyewear|glasses|shades/.test(lower)) return 'eyewear';
  if (/necklace|ring|earring|bracelet|watch|jewelry|jewellery|chain/.test(lower)) return 'jewelry';
  if (/cap|hat|beanie|headband|hair clip|hair accessory/.test(lower)) return 'hat';
  if (/jacket|coat|blazer|hoodie|cardigan|sweater|crewneck|puffer|trench|overshirt|fleece|zip/.test(lower)) return 'outer';
  if (/jean|pant|trouser|cargo|short|legging|skirt|chino|jogger|sweatpant/.test(lower)) return 'bottom';
  if (/shirt|tee|t-shirt|tank|polo|blouse|bodysuit|top|dress|wardrobe|basic|essential|apparel|clothing|fashion/.test(lower)) return 'top';
  return null;
}

function inferVibes(query: string, text: string): string[] {
  const lower = `${query} ${text}`.toLowerCase();
  return unique([
    /capsule|wardrobe basic|basics|essential/.test(lower) ? 'capsule' : null,
    /street|cargo|hoodie|sneaker/.test(lower) ? 'streetwear' : null,
    /clean girl|clean/.test(lower) ? 'clean' : null,
    /old money|loafer|polo|blazer|trouser/.test(lower) ? 'old money' : null,
    /gym|legging|trainer|athletic|performance/.test(lower) ? 'gym' : null,
    /date night|date|dress heel|dinner/.test(lower) ? 'date night' : null,
    /campus|college/.test(lower) ? 'campus' : null,
    /airport|travel/.test(lower) ? 'travel' : null,
    /budget|affordable|under/.test(lower) ? 'budget' : null,
    /premium|designer|luxury/.test(lower) ? 'premium' : null,
    /sneaker/.test(lower) ? 'sneaker rotation' : null,
  ]);
}

function inferOccasions(query: string, text: string): string[] {
  const lower = `${query} ${text}`.toLowerCase();
  return unique([
    /capsule|basic|essential/.test(lower) ? 'everyday' : null,
    /gym|legging|trainer|athletic/.test(lower) ? 'gym' : null,
    /date night|date|dinner/.test(lower) ? 'date night' : null,
    /campus|college/.test(lower) ? 'campus' : null,
    /airport|travel/.test(lower) ? 'travel' : null,
    /old money|polo|blazer|trouser/.test(lower) ? 'smart casual' : null,
    /street|hoodie|cargo|sneaker/.test(lower) ? 'casual' : null,
  ]);
}

function inferSearchTerms(query: string, text: string): string[] {
  return unique(
    `${query} ${text}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !['the', 'and', 'for', 'with', 'products'].includes(token))
      .slice(0, 20),
  );
}

function priceValueToCents(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/(?:US\s*)?\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

function parsePriceCents(result: SearchApiResult): number | null {
  const priceValues = [
    result.extracted_price,
    result.price,
    result.offers?.[0]?.extracted_price,
    result.offers?.[0]?.price,
    result.snippet,
  ];

  for (const value of priceValues) {
    const cents = priceValueToCents(value);
    if (cents) return cents;
  }

  return null;
}

function inferBudgetTier(priceCents: number | null): BudgetTier {
  if (!priceCents) return 'unknown';
  if (priceCents < 6000) return 'budget';
  if (priceCents < 15000) return 'mid';
  if (priceCents < 40000) return 'premium';
  return 'luxury';
}

function titleCaseBrand(value: string): string {
  return cleanText(value)
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function inferRetailerFromUrl(productUrl: string): string {
  try {
    const hostname = new URL(productUrl).hostname
      .replace(/^www\./, '')
      .replace(/\.(com|net|org|co|io|shop|store|us|uk|ca|au)$/i, '');
    const retailer = hostname.split('.').filter(Boolean).pop();
    return retailer ? titleCaseBrand(retailer) : '';
  } catch {
    return '';
  }
}

function inferBrand(result: SearchApiResult, title: string, productUrl: string): string {
  const source = cleanText(result.brand || result.source || result.seller || result.seller_name || result.merchant || result.store);
  if (source) return source;
  const splitters = [' - ', ' | ', ' at ', ' from '];
  for (const splitter of splitters) {
    const [first] = title.split(splitter);
    if (first && first.length >= 2 && first.length <= 40) return first.trim();
  }
  return inferRetailerFromUrl(productUrl) || title.split(' ').slice(0, 2).join(' ');
}

function isLikelyFashionCandidate({
  query,
  text,
  productUrl,
  priceCents,
  category,
}: {
  query: string;
  text: string;
  productUrl: string;
  priceCents: number | null;
  category: Category;
}): boolean {
  const combined = `${text} ${productUrl}`;
  if (EDITORIAL_OR_NON_PRODUCT_PATTERN.test(combined) && priceCents === null) return false;
  if (FASHION_PRODUCT_PATTERN.test(combined)) return true;
  if (FASHION_PRODUCT_PATTERN.test(query) && category && (priceCents !== null || /shop|store|product|collection|\/p\/|\/products?\//i.test(productUrl))) return true;
  return false;
}

function isUsefulWithoutPrice({
  query,
  text,
  productUrl,
  imageUrl,
  brand,
}: {
  query: string;
  text: string;
  productUrl: string;
  imageUrl: string | null;
  brand: string;
}): boolean {
  const combined = `${query} ${text} ${productUrl} ${brand}`;
  if (imageUrl && FASHION_PRODUCT_PATTERN.test(combined)) return true;
  return /shop|store|product|collection|\/p\/|\/products?\//i.test(productUrl) && FASHION_PRODUCT_PATTERN.test(combined);
}

function normalizeResult(query: string, result: SearchApiResult, importedAt: string): NormalizeResult {
  const name = cleanText(result.title);
  if (!name) return { candidate: null, rejected: 'missingName' };

  const productUrl = extractProductUrl(result);
  if (!productUrl) return { candidate: null, rejected: 'missingUrl' };

  const descriptiveText = cleanText(`${name} ${result.snippet || ''} ${productUrl}`);
  const category = inferCategory(descriptiveText) || inferCategory(query);
  if (!category) return { candidate: null, rejected: 'badCategory' };

  const brand = inferBrand(result, name, productUrl);
  const gender = inferGender(query, descriptiveText);
  if (!gender.length) return { candidate: null, rejected: 'unknownGender' };

  const priceCents = parsePriceCents(result);
  const imageUrl = extractImageUrl(result);
  if (!isLikelyFashionCandidate({ query, text: descriptiveText, productUrl, priceCents, category })) {
    return { candidate: null, rejected: 'nonFashion' };
  }
  if (priceCents === null && !isUsefulWithoutPrice({ query, text: descriptiveText, productUrl, imageUrl, brand })) {
    return { candidate: null, rejected: 'noPrice' };
  }

  const signature = `${productUrl}|${normalizeToken(brand)}|${normalizeToken(name)}|${category}`;
  const reviewReasons = unique([
    priceCents === null ? 'missing price' : null,
    imageUrl === null ? 'missing image' : null,
    !cleanText(result.brand || result.source || result.seller || result.seller_name || result.merchant || result.store)
      ? 'brand inferred'
      : null,
  ]);

  return {
    candidate: {
      id: `searchapi-${slug(brand)}-${stableId(signature)}`,
      brand,
      name,
      category,
      gender,
      priceCents,
      currency: 'USD',
      budgetTier: inferBudgetTier(priceCents),
      imageUrl,
      productUrl,
      retailerUrl: productUrl,
      sourceQuery: query,
      sourceResultPosition: typeof result.position === 'number' ? result.position : null,
      sourceProductId: result.product_id || null,
      retailer: brand,
      vibes: inferVibes(query, descriptiveText),
      occasions: inferOccasions(query, descriptiveText),
      searchTerms: inferSearchTerms(query, descriptiveText),
      needsReview: reviewReasons.length > 0,
      reviewReasons,
      importedAt,
      metadata: {
        source: 'searchapi',
        endpoint: SEARCHAPI_ENDPOINT,
        imageQuality: imageUrl ? 'ok' : 'missing',
        reviewStatus: 'candidate',
      },
    },
  };
}

function selectedQueries(): string[] {
  const requestedIds = process.env.SEARCHAPI_QUERY_IDS?.split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= SEARCH_QUERIES.length);

  const queries = requestedIds?.length
    ? requestedIds.map((id) => SEARCH_QUERIES[id - 1])
    : [...SEARCH_QUERIES];

  return MAX_QUERIES ? queries.slice(0, MAX_QUERIES) : queries;
}

async function search(query: string): Promise<SearchApiResult[]> {
  const apiKey = getSearchApiKey();

  const url = new URL(SEARCHAPI_ENDPOINT);
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('num', String(MAX_RESULTS_PER_QUERY));

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SearchApiHttpError(
      response.status,
      redactSearchApiKey(`SearchAPI returned ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`),
    );
  }

  const json = (await response.json()) as SearchApiResponse;
  return [
    ...(json.shopping_results || []),
    ...(json.inline_shopping_results || []),
    ...(json.product_results || []),
    ...(json.organic_results || []),
    ...(json.results || []),
  ];
}

async function main() {
  await printRuntimeDiagnostics();

  if (!hasRealSearchApiKey()) {
    console.error('Missing real SearchAPI key. Set SEARCHAPI_KEY in .env.local.');
    process.exitCode = 1;
    return;
  }

  const queries = selectedQueries();
  console.log(`Planned SearchAPI queries: ${queries.length}`);
  queries.forEach((query, index) => console.log(`${index + 1}. ${query}`));

  if (DRY_RUN) {
    console.log('SEARCHAPI_DRY_RUN=true; no API calls made and no candidate file written.');
    return;
  }

  const importedAt = new Date().toISOString();
  const candidates: CatalogCandidate[] = [];
  const seenIdentityKeys = new Set<string>();
  const failures: Array<{ query: string; error: string }> = [];
  const totalStats = createRejectionStats();
  let totalRawResults = 0;
  let totalAcceptedCandidates = 0;
  let debugDuplicateCount = 0;
  let invalidApiKey = false;
  let quotaExhausted = false;

  for (const query of queries) {
    try {
      const results = await search(query);
      const queryStats = createRejectionStats();
      let added = 0;
      totalRawResults += results.length;

      for (const result of results.slice(0, MAX_RESULTS_PER_QUERY)) {
        const normalized = normalizeResult(query, result, importedAt);
        if (!normalized.candidate) {
          incrementRejection(queryStats, normalized.rejected);
          continue;
        }

        const { candidate } = normalized;
        const identity = createDuplicateIdentity(candidate);

        if (!identity.key) {
          incrementRejection(queryStats, 'duplicateWeakIdentity');
          debugDuplicateCount += 1;
          debugDuplicate({ count: debugDuplicateCount, query, identity, candidate });
          continue;
        }

        const dedupeKey = `${identity.kind}:${identity.key}`;
        if (seenIdentityKeys.has(dedupeKey)) {
          incrementRejection(queryStats, duplicateReasonForIdentity(identity));
          debugDuplicateCount += 1;
          debugDuplicate({ count: debugDuplicateCount, query, identity, candidate });
          continue;
        }

        seenIdentityKeys.add(dedupeKey);
        candidates.push(candidate);
        added += 1;
      }

      mergeRejectionStats(totalStats, queryStats);
      totalAcceptedCandidates += added;
      printImportStats(`SearchAPI query "${query}"`, results.length, added, queryStats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ query, error: message });

      if (error instanceof SearchApiHttpError && error.status === 401) {
        invalidApiKey = true;
        console.warn('Invalid SearchAPI key. Check .env.local.');
        break;
      }

      if (error instanceof SearchApiHttpError && error.status === 429) {
        quotaExhausted = true;
        console.warn('SearchAPI quota exhausted.');
        break;
      }

      console.warn(`SearchAPI: ${query} failed: ${message}`);
    }
  }

  printImportStats('SearchAPI totals', totalRawResults, totalAcceptedCandidates, totalStats);

  if (candidates.length === 0) {
    console.warn('No candidates written because the import produced 0 candidates. Existing data/searchapi-catalog-candidates.json was preserved.');
    process.exitCode = 1;
    return;
  }

  const outputDir = path.join(process.cwd(), 'data');
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'searchapi-catalog-candidates.json');
  const backupPath = await backupCandidatesFile(outputPath);
  console.log(`Backed up existing catalog candidates to ${backupPath}`);
  await writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${candidates.length} reviewed-only catalog candidates to ${outputPath}`);
  if (quotaExhausted) {
    console.warn('SearchAPI quota exhausted. Saved only candidates collected before the quota response.');
    process.exitCode = 1;
  }
  if (invalidApiKey) {
    console.warn('Invalid SearchAPI key. Check .env.local. Saved only candidates collected before the key error.');
    process.exitCode = 1;
  }
  if (failures.length) {
    console.warn(`Completed with ${failures.length} failed search${failures.length === 1 ? '' : 'es'}. Candidates from successful searches were still saved.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
