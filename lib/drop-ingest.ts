import crypto from 'node:crypto';
import type { Category, Product } from './types';

type Gender = 'masc' | 'fem' | 'androgynous';

export interface DropSourceConfig {
  version: number;
  sources?: DropSource[];
  searches?: DropSearch[];
}

export interface DropSource {
  id: string;
  type: 'shopifyCollection';
  retailer: string;
  baseUrl: string;
  collection: string;
  defaultCategory?: Category;
  vibes?: string[];
  occasions?: string[];
  gender?: Gender[];
  maxProducts?: number;
}

export interface DropSearch {
  id: string;
  query: string;
  category: Category;
  vibes?: string[];
  occasions?: string[];
  gender?: Gender[];
  maxResults?: number;
}

interface ShopifyImage {
  src?: string;
}

interface ShopifyVariant {
  price?: string;
  available?: boolean;
}

interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
}

interface SearchApiResult {
  title?: string;
  name?: string;
  link?: string;
  product_link?: string;
  source_link?: string;
  source?: string;
  merchant?: string;
  seller?: string;
  price?: string;
  extracted_price?: number;
  image?: string;
  thumbnail?: string;
  product_id?: string;
  [key: string]: unknown;
}

export interface DropIngestOptions {
  limit?: number;
  sourceId?: string;
  includeSearchApi?: boolean;
  maxSearchQueries?: number;
}

export interface DropSourceReport {
  id: string;
  type: string;
  status: 'ok' | 'skipped' | 'failed';
  productsFound: number;
  productsAccepted: number;
  error?: string;
}

export interface DropIngestResult {
  generatedAt: string;
  products: Product[];
  reports: DropSourceReport[];
}

const SEARCHAPI_ENDPOINT = 'https://www.searchapi.io/api/v1/search';

const CATEGORY_TERMS: Record<Category, string[]> = {
  hat: ['hat', 'cap', 'beanie', 'bucket hat', 'headband'],
  outer: ['jacket', 'coat', 'hoodie', 'cardigan', 'blazer', 'overshirt', 'puffer', 'trench', 'vest'],
  top: ['shirt', 'tee', 't-shirt', 'top', 'tank', 'polo', 'blouse', 'sweater', 'bra', 'button down', 'knit'],
  bottom: ['pant', 'pants', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'trouser', 'trousers', 'legging', 'jogger', 'cargo'],
  shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'heel', 'heels', 'sandal', 'sandals', 'loafer', 'loafers', 'slide', 'slides'],
  bag: ['bag', 'tote', 'backpack', 'duffel', 'duffle', 'crossbody', 'shoulder bag', 'purse', 'clutch'],
  eyewear: ['sunglasses', 'glasses', 'eyewear', 'frames', 'shades'],
  jewelry: ['jewelry', 'necklace', 'earrings', 'earring', 'bracelet', 'ring', 'chain', 'watch', 'hoop'],
};

const PRODUCT_TYPE_CATEGORY_HINTS: Array<{ category: Category; terms: string[] }> = [
  { category: 'shoes', terms: ['footwear', 'sneakers', 'shoes', 'boots', 'sandals'] },
  { category: 'outer', terms: ['outerwear', 'jackets', 'jacket', 'coats', 'coat'] },
  { category: 'top', terms: ['shirts', 'shirt', 'tees', 'tee', 'tops', 'top', 'knits', 'knit', 'polos', 'polo', 'hoodies', 'hoodie', 'sweaters', 'sweater'] },
  { category: 'bottom', terms: ['bottoms', 'bottom', 'pants', 'pant', 'shorts', 'short', 'denim', 'jeans', 'skirt'] },
  { category: 'bag', terms: ['bags', 'bag', 'handbags', 'totes', 'tote'] },
  { category: 'hat', terms: ['hats', 'hat', 'caps', 'cap', 'headwear'] },
  { category: 'eyewear', terms: ['eyewear', 'sunglasses', 'glasses'] },
  { category: 'jewelry', terms: ['jewelry', 'jewellery', 'necklaces', 'necklace', 'rings', 'ring', 'bracelets', 'bracelet'] },
];

const COLOR_TERMS = [
  'black', 'white', 'cream', 'ivory', 'beige', 'tan', 'brown', 'navy', 'blue',
  'grey', 'gray', 'charcoal', 'pink', 'red', 'green', 'olive', 'silver', 'gold',
  'yellow', 'orange', 'purple',
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedPhrase = normalize(phrase);
  return Boolean(normalizedPhrase && normalizedText.includes(` ${normalizedPhrase} `));
}

function hashId(seed: string): string {
  return crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function parsePriceCents(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value * 100);
    if (typeof value !== 'string') continue;
    const match = value.match(/\d[\d,]*(?:\.\d+)?/);
    if (!match) continue;
    const parsed = Number(match[0].replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 100);
  }
  return 0;
}

function cleanUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function productUrl(baseUrl: string, handle = ''): string {
  if (!handle) return '';
  return cleanUrl(new URL(`/products/${handle}`, baseUrl).toString());
}

function imageUrl(value: string): string {
  if (!value) return '';
  if (value.startsWith('//')) return `https:${value}`;
  return cleanUrl(value);
}

function inferCategory(text: string, fallback?: Category): Category | null {
  const normalized = normalize(text);
  for (const hint of PRODUCT_TYPE_CATEGORY_HINTS) {
    if (hint.terms.some((term) => containsPhrase(normalized, term))) return hint.category;
  }

  let best: { category: Category; score: number } | null = null;
  for (const [category, terms] of Object.entries(CATEGORY_TERMS) as Array<[Category, string[]]>) {
    const score = terms.reduce((sum, term) => sum + (containsPhrase(normalized, term) ? 1 : 0), 0);
    if (score > (best?.score || 0)) best = { category, score };
  }
  return best?.score ? best.category : fallback || null;
}

function inferColors(text: string): string[] {
  const normalized = normalize(text);
  return COLOR_TERMS.filter((color) => normalized.includes(normalize(color)));
}

function searchTerms(text: string, extras: string[] = []): string[] {
  return Array.from(new Set([
    ...normalize(text).split(/\s+/),
    ...extras.flatMap((extra) => normalize(extra).split(/\s+/)),
  ].filter((term) => term.length > 1))).slice(0, 32);
}

function shopifyToProduct(source: DropSource, product: ShopifyProduct): Product | null {
  const title = firstString(product.title);
  const handle = firstString(product.handle);
  const url = productUrl(source.baseUrl, handle);
  const image = imageUrl(firstString(product.images?.[0]?.src));
  const category = inferCategory(`${title} ${product.product_type || ''} ${(product.tags || []).join(' ')}`, source.defaultCategory);
  if (!title || !url || !image || !category) return null;

  const variants = product.variants || [];
  const priceCents = variants.reduce((lowest, variant) => {
    const cents = parsePriceCents(variant.price);
    if (!cents) return lowest;
    return lowest ? Math.min(lowest, cents) : cents;
  }, 0);
  const colors = inferColors(`${title} ${(product.tags || []).join(' ')}`);
  const vibes = source.vibes || ['new arrivals'];
  const occasions = source.occasions || ['everyday'];
  const gender = source.gender || ['androgynous'];
  const id = `drop-${hashId([source.id, product.id || handle, title, url].join('|'))}`;

  return {
    id,
    brand: firstString(product.vendor) || source.retailer,
    name: title,
    category,
    priceCents,
    currency: 'USD',
    retailer: source.retailer,
    retailerUrl: url,
    productUrl: url,
    imageUrl: image,
    imageOriginalUrl: image,
    imageSource: 'merchant',
    imageStatus: 'needs-cutout',
    inStock: variants.length ? variants.some((variant) => variant.available !== false) : true,
    trusted: true,
    vibes,
    occasions,
    colors,
    gender,
    searchTerms: searchTerms(`${source.retailer} ${title}`, [...vibes, ...occasions, ...colors]),
    sourceQuery: `${source.retailer} ${source.collection}`,
    imageQuality: 'good',
    popularityScore: 0,
    metadata: {
      source: 'drop_catalog',
      sourceId: source.id,
      sourceType: source.type,
      collection: source.collection,
      sourceProductId: product.id,
      productType: product.product_type,
      tags: product.tags || [],
      colors,
      styles: vibes,
      vibes,
      occasions,
      gender,
      keywords: searchTerms(title, product.tags || []),
      searchTerms: searchTerms(`${source.retailer} ${title}`, [...vibes, ...occasions, ...colors]),
      imageQuality: 'good',
      discoveredAt: new Date().toISOString(),
    },
  };
}

async function fetchShopifySource(source: DropSource): Promise<{ products: Product[]; found: number }> {
  const limit = Math.min(Math.max(source.maxProducts || 40, 1), 250);
  const url = new URL(`/collections/${source.collection}/products.json`, source.baseUrl);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'user-agent': 'SylistlyCatalogBot/1.0 (+https://www.sylistly.com)',
    },
  });
  if (!response.ok) throw new Error(`shopify ${response.status}`);
  const payload = await response.json() as { products?: ShopifyProduct[] };
  const rawProducts = Array.isArray(payload.products) ? payload.products : [];
  return {
    found: rawProducts.length,
    products: rawProducts
      .map((product) => shopifyToProduct(source, product))
      .filter((product): product is Product => Boolean(product)),
  };
}

function searchApiUrl(result: SearchApiResult): string {
  const candidates = [
    firstString(result.source_link),
    firstString(result.product_link),
    firstString(result.link),
  ].filter(Boolean);
  return candidates.find((url) => {
    try {
      const parsed = new URL(url);
      return !parsed.hostname.includes('google.');
    } catch {
      return false;
    }
  }) || '';
}

function searchApiToProduct(search: DropSearch, result: SearchApiResult): Product | null {
  const title = firstString(result.title, result.name);
  const url = cleanUrl(searchApiUrl(result));
  const image = imageUrl(firstString(result.image, result.thumbnail));
  if (!title || !url || !image) return null;
  const retailer = firstString(result.source, result.merchant, result.seller) || new URL(url).hostname.replace(/^www\./, '');
  const vibes = search.vibes || ['new arrivals'];
  const occasions = search.occasions || ['everyday'];
  const gender = search.gender || ['androgynous'];
  const colors = inferColors(title);

  return {
    id: `drop-${hashId([search.id, title, url, result.product_id || ''].join('|'))}`,
    brand: retailer,
    name: title,
    category: search.category,
    priceCents: parsePriceCents(result.extracted_price, result.price),
    currency: 'USD',
    retailer,
    retailerUrl: url,
    productUrl: url,
    imageUrl: image,
    imageOriginalUrl: image,
    imageSource: 'searchapi',
    imageStatus: 'needs-cutout',
    inStock: true,
    trusted: true,
    vibes,
    occasions,
    colors,
    gender,
    searchTerms: searchTerms(`${search.query} ${title}`, [...vibes, ...occasions, ...colors]),
    sourceQuery: search.query,
    imageQuality: 'good',
    popularityScore: 0,
    metadata: {
      source: 'drop_catalog',
      sourceId: search.id,
      sourceType: 'searchapi',
      searchapiProductId: result.product_id,
      colors,
      styles: vibes,
      vibes,
      occasions,
      gender,
      keywords: searchTerms(title, [search.query]),
      searchTerms: searchTerms(`${search.query} ${title}`, [...vibes, ...occasions, ...colors]),
      imageQuality: 'good',
      discoveredAt: new Date().toISOString(),
    },
  };
}

async function fetchSearchApiSource(search: DropSearch): Promise<{ products: Product[]; found: number }> {
  const apiKey = process.env.SEARCHAPI_KEY?.trim();
  if (!apiKey) throw new Error('SEARCHAPI_KEY missing');

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: search.query,
    hl: 'en',
    gl: 'us',
    location: 'United States',
  });
  const response = await fetch(`${SEARCHAPI_ENDPOINT}?${params.toString()}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`searchapi ${response.status}`);
  const payload = await response.json() as {
    shopping_results?: SearchApiResult[];
    popular_products?: SearchApiResult[];
    organic_results?: SearchApiResult[];
  };
  const raw = [
    ...(Array.isArray(payload.shopping_results) ? payload.shopping_results : []),
    ...(Array.isArray(payload.popular_products) ? payload.popular_products : []),
    ...(Array.isArray(payload.organic_results) ? payload.organic_results : []),
  ].slice(0, Math.min(Math.max(search.maxResults || 12, 1), 20));

  return {
    found: raw.length,
    products: raw
      .map((result) => searchApiToProduct(search, result))
      .filter((product): product is Product => Boolean(product)),
  };
}

function dedupeProducts(products: Product[]): Product[] {
  const output: Product[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const key = normalize(`${product.category} ${product.brand} ${product.name}`);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(product);
  }
  return output;
}

export async function ingestDropProducts(
  config: DropSourceConfig,
  options: DropIngestOptions = {},
): Promise<DropIngestResult> {
  const products: Product[] = [];
  const reports: DropSourceReport[] = [];
  const sourceFilter = options.sourceId?.trim();
  const limit = Math.min(Math.max(options.limit || 120, 1), 1000);

  for (const source of config.sources || []) {
    if (sourceFilter && source.id !== sourceFilter) {
      reports.push({ id: source.id, type: source.type, status: 'skipped', productsFound: 0, productsAccepted: 0 });
      continue;
    }
    try {
      const result = await fetchShopifySource(source);
      products.push(...result.products);
      reports.push({
        id: source.id,
        type: source.type,
        status: 'ok',
        productsFound: result.found,
        productsAccepted: result.products.length,
      });
    } catch (error) {
      reports.push({
        id: source.id,
        type: source.type,
        status: 'failed',
        productsFound: 0,
        productsAccepted: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (products.length >= limit) break;
  }

  if (options.includeSearchApi) {
    const searches = (config.searches || []).slice(0, Math.max(options.maxSearchQueries || 0, 0));
    for (const search of searches) {
      if (sourceFilter && search.id !== sourceFilter) {
        reports.push({ id: search.id, type: 'searchapi', status: 'skipped', productsFound: 0, productsAccepted: 0 });
        continue;
      }
      try {
        const result = await fetchSearchApiSource(search);
        products.push(...result.products);
        reports.push({
          id: search.id,
          type: 'searchapi',
          status: 'ok',
          productsFound: result.found,
          productsAccepted: result.products.length,
        });
      } catch (error) {
        reports.push({
          id: search.id,
          type: 'searchapi',
          status: 'failed',
          productsFound: 0,
          productsAccepted: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (products.length >= limit) break;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    products: dedupeProducts(products).slice(0, limit),
    reports,
  };
}
