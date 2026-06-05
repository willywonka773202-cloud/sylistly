import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types.ts';

type CsvRow = Record<string, string>;

interface ImportReport {
  generatedAt: string;
  sourceDir: string;
  candidatesRead: number;
  detailsRead: number;
  importedProducts: number;
  skipped: {
    missingRequiredFields: number;
    invalidCategory: number;
    lowValueRetailer: number;
    blockedTerms: number;
    duplicate: number;
  };
  byCategory: Record<Category, number>;
  directOfferProducts: number;
  googleShoppingFallbackProducts: number;
  outputFile: string;
  notes: string[];
}

const ROOT = process.cwd();
const DEFAULT_SOURCE_DIR = join(ROOT, '..', '..', 'Sylistly', 'catalog-intelligence', 'data');
const SOURCE_DIR = process.env.SYLISTLY_SEARCHAPI_DATA_DIR || DEFAULT_SOURCE_DIR;
const CANDIDATES_CSV = join(SOURCE_DIR, 'searchapi-quality-candidates.csv');
const DETAILS_CSV = join(SOURCE_DIR, 'searchapi-product-details.csv');
const OUTPUT_FILE = join(ROOT, 'data', 'searchapi-quality-catalog.json');
const REPORT_FILE = join(ROOT, 'data', 'catalog', 'reports', 'searchapi-quality-import-report.json');

const CATEGORY_TERMS: Record<Category, string[]> = {
  hat: ['hat', 'cap', 'beanie', 'bucket', 'headband'],
  outer: ['jacket', 'coat', 'blazer', 'cardigan', 'puffer', 'parka', 'hoodie', 'overshirt', 'trench', 'bomber', 'shell', 'windbreaker', 'fleece', 'vest', 'track'],
  top: ['shirt', 't-shirt', 'tee', 'tank', 'top', 'blouse', 'sweater', 'knit', 'polo', 'button down', 'oxford', 'bodysuit', 'sweatshirt'],
  bottom: ['pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'denim', 'short', 'shorts', 'skirt', 'legging', 'leggings', 'jogger', 'sweatpant'],
  shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'trainer', 'boot', 'boots', 'loafer', 'sandal', 'clog', 'mule', 'flat', 'samba', 'kayano', 'xt-6', '1460', 'boston', 'chuck'],
  bag: ['bag', 'tote', 'backpack', 'crossbody', 'shoulder bag', 'duffel', 'duffle', 'purse', 'clutch', 'satchel', 'messenger', 'belt bag', 'sling'],
  eyewear: ['sunglasses', 'glasses', 'eyeglasses', 'eyewear', 'shades', 'frames', 'wayfarer', 'sutro'],
  jewelry: ['necklace', 'bracelet', 'ring', 'earring', 'earrings', 'hoop', 'chain', 'pendant', 'jewelry', 'bangle', 'cuff'],
};

const LOW_VALUE_RETAILER_TERMS = [
  'ebay',
  'poshmark',
  'depop',
  'mercari',
  'walmart',
  'instacart',
  'stockx',
  'goat',
  'lyst',
  'modesens',
];

const BLOCKED_TERMS = [
  'pre-owned',
  'pre owned',
  'used',
  'vintage',
  'costume',
  'cosplay',
  'bundle',
  'lot of',
  'kids',
  'toddler',
  'baby',
  'dog',
  'pet',
  'doll',
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((rowValues) => rowValues.some((value) => value !== ''));
}

function readCsvObjects(filePath: string): CsvRow[] {
  if (!existsSync(filePath)) return [];
  const rows = parseCsv(readFileSync(filePath, 'utf8'));
  const headers = rows[0] || [];
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function splitPipes(value: string): string[] {
  return Array.from(new Set(value.split('|').map((item) => item.trim()).filter(Boolean)));
}

function hasTerm(text: string, term: string): boolean {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedTerm = normalize(term);
  return Boolean(normalizedTerm) && normalizedText.includes(` ${normalizedTerm} `);
}

function hasAnyTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => hasTerm(text, term));
}

function inferCategory(name: string, fallback: string): Category | null {
  const text = normalize(name);
  let best: { category: Category; score: number } | null = null;

  for (const category of CATEGORY_ORDER) {
    const score = CATEGORY_TERMS[category].reduce((sum, term) => sum + (text.includes(normalize(term)) ? 1 : 0), 0);
    if (!best || score > best.score) best = { category, score };
  }

  if (best && best.score > 0) return best.category;
  return CATEGORY_ORDER.includes(fallback as Category) ? fallback as Category : null;
}

function first(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function numberFrom(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableId(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function toGender(value: string): Product['gender'] {
  const normalized = normalize(value);
  if (normalized === 'masc') return ['masc'];
  if (normalized === 'fem') return ['fem'];
  return ['androgynous'];
}

function directUrl(row: CsvRow | undefined): string {
  return first(row?.best_offer_url, row?.product_url);
}

function candidateText(candidate: CsvRow, detail?: CsvRow): string {
  return [
    candidate.brand,
    candidate.name,
    candidate.retailer,
    candidate.query,
    detail?.best_offer_retailer,
    detail?.product_title,
    detail?.product_brand,
    detail?.best_offer_domain,
  ].filter(Boolean).join(' ');
}

function buildSearchTerms(product: Product, query: string): string[] {
  const terms = [
    product.brand,
    product.name,
    product.retailer,
    product.category,
    query,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.colors || []),
  ].flatMap((value) => normalize(value).split(/\s+/));

  return Array.from(new Set(terms.filter((term) => term.length > 1))).slice(0, 64);
}

function emptyCategoryCounts(): Record<Category, number> {
  return Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<Category, number>;
}

function main(): void {
  const candidates = readCsvObjects(CANDIDATES_CSV);
  const details = readCsvObjects(DETAILS_CSV);
  const detailByCandidateId = new Map(details.map((row) => [row.candidate_id, row]));
  const products: Product[] = [];
  const seen = new Set<string>();
  const skipped = {
    missingRequiredFields: 0,
    invalidCategory: 0,
    lowValueRetailer: 0,
    blockedTerms: 0,
    duplicate: 0,
  };

  for (const candidate of candidates) {
    const detail = detailByCandidateId.get(candidate.id);
    const text = candidateText(candidate, detail);
    if (hasAnyTerm(text, LOW_VALUE_RETAILER_TERMS)) {
      skipped.lowValueRetailer += 1;
      continue;
    }
    if (hasAnyTerm(text, BLOCKED_TERMS)) {
      skipped.blockedTerms += 1;
      continue;
    }

    const name = first(detail?.product_title, candidate.name);
    const category = inferCategory(name, candidate.category);
    if (!category) {
      skipped.invalidCategory += 1;
      continue;
    }

    const retailerUrl = directUrl(detail) || candidate.product_url;
    const googleShoppingUrl = candidate.product_url;
    const imageUrl = first(detail?.product_image_url, candidate.image_url);
    const priceCents = numberFrom(first(detail?.best_offer_price_cents, candidate.price_cents));
    const dedupeKey = normalize(`${name}|${retailerUrl || googleShoppingUrl}`);
    if (!name || !imageUrl || !priceCents || !retailerUrl) {
      skipped.missingRequiredFields += 1;
      continue;
    }
    if (seen.has(dedupeKey)) {
      skipped.duplicate += 1;
      continue;
    }
    seen.add(dedupeKey);

    const offerUrl = directUrl(detail);
    const product: Product = {
      id: candidate.id || `searchapi-quality-${stableId(dedupeKey)}`,
      brand: first(detail?.product_brand, candidate.brand, candidate.retailer, 'Unknown'),
      name,
      category,
      priceCents,
      currency: candidate.currency || 'USD',
      retailer: first(detail?.best_offer_retailer, candidate.retailer, 'Google Shopping'),
      retailerUrl: offerUrl || googleShoppingUrl,
      productUrl: offerUrl || undefined,
      googleShoppingUrl,
      fallbackUrl: googleShoppingUrl,
      imageUrl,
      imageOriginalUrl: imageUrl,
      imageSource: 'searchapi',
      imageStatus: 'needs-cutout',
      imageQuality: 'good',
      inStock: true,
      trusted: candidate.trusted_retailer === 'yes' || candidate.trusted_domain === 'yes' || Boolean(offerUrl),
      vibes: splitPipes(candidate.vibes),
      occasions: splitPipes(candidate.vibes),
      colors: splitPipes(candidate.colors),
      gender: toGender(candidate.gender),
      sourceQuery: candidate.query,
      popularityScore: Math.round(Number.parseFloat(candidate.quality_score || '0') * 100),
      metadata: {
        source: 'searchapi_quality_catalog',
        sourceId: candidate.id,
        queryId: candidate.query_id,
        queryRank: candidate.query_rank,
        qualityScore: Number.parseFloat(candidate.quality_score || '0'),
        productToken: candidate.product_token,
        detailReady: Boolean(detail),
        offerCount: detail?.offer_count ? Number.parseInt(detail.offer_count, 10) : 0,
        bestOfferDomain: detail?.best_offer_domain,
        bestOfferRetailer: detail?.best_offer_retailer,
        searchapiSheet: 'https://docs.google.com/spreadsheets/d/1X_YnNe4q99twa-WOCG8Zu7l7qAeKeDs13c7aoUdfjvk',
      },
    };
    product.searchTerms = buildSearchTerms(product, candidate.query);
    products.push(product);
  }

  products.sort((left, right) => {
    const detailDelta = Number(Boolean(right.metadata?.detailReady)) - Number(Boolean(left.metadata?.detailReady));
    if (detailDelta !== 0) return detailDelta;
    return (right.popularityScore || 0) - (left.popularityScore || 0);
  });

  const byCategory = emptyCategoryCounts();
  let directOfferProducts = 0;
  let googleShoppingFallbackProducts = 0;
  for (const product of products) {
    byCategory[product.category] += 1;
    if (product.productUrl) directOfferProducts += 1;
    else googleShoppingFallbackProducts += 1;
  }

  const report: ImportReport = {
    generatedAt: new Date().toISOString(),
    sourceDir: SOURCE_DIR,
    candidatesRead: candidates.length,
    detailsRead: details.length,
    importedProducts: products.length,
    skipped,
    byCategory,
    directOfferProducts,
    googleShoppingFallbackProducts,
    outputFile: 'data/searchapi-quality-catalog.json',
    notes: [
      'SearchAPI quality rows are imported as original-image, needs-cutout catalog products.',
      'They are available to catalog/search/review flows immediately, but transparent-only UI surfaces still require cutout generation.',
      'Low-value marketplace and blocked terms are filtered during import.',
    ],
  };

  mkdirSync(join(ROOT, 'data', 'catalog', 'reports'), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();
