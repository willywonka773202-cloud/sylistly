import crypto from 'node:crypto';
import type { Category, Product, SearchIntent } from './types';

const SERP_ENDPOINT = 'https://serpapi.com/search.json';
const SEARCH_TIMEOUT_MS = 12_000;
const PRODUCT_TIMEOUT_MS = 2_500;
const MIN_TRUSTED_RESULTS = 3;
const GOOGLE_HOSTS = new Set(['google.com', 'www.google.com']);

const CATEGORY_KEYWORDS: Record<Category, string> = {
  hat: 'hat cap beanie',
  outer: 'jacket coat outerwear',
  top: 'shirt top tee blouse sweater',
  bottom: 'pants jeans shorts skirt',
  shoes: 'shoes sneakers boots',
  bag: 'bag handbag tote backpack',
  eyewear: 'sunglasses eyeglasses',
  jewelry: 'necklace ring earrings bracelet',
};

/**
 * Retailer allowlist — affiliate-enabled, trustworthy.
 * Used to filter Google Shopping results to domains we can monetize + trust.
 */
export const TRUSTED_RETAILERS = new Set([
  'ssense.com', 'nordstrom.com', 'farfetch.com', 'endclothing.com', 'mrporter.com',
  'net-a-porter.com', 'shopbop.com', 'revolve.com', 'asos.com', 'zara.com',
  'hm.com', 'uniqlo.com', 'nike.com', 'adidas.com', 'goat.com', 'stockx.com',
  'etsy.com', 'amazon.com', 'urbanoutfitters.com', 'freepeople.com',
  'anthropologie.com', 'pacsun.com', 'aritzia.com', 'lululemon.com', 'aloyoga.com',
  'matchesfashion.com', 'saksfifthavenue.com', 'bergdorfgoodman.com',
  'gucci.com', 'prada.com', 'miumiu.com', 'balenciaga.com', 'agolde.com',
  'levi.com', 'levis.com', 'stussy.com', 'dickies.com', 'carhartt.com',
  'carhartt-wip.com', 'thenorthface.com', 'burberry.com', 'maxmara.com',
  'acnestudios.com', 'supremenewyork.com', 'ray-ban.com', 'oakley.com',
]);

const TRUSTED_RETAILER_ALIASES: Record<string, string[]> = {
  'ssense.com': ['ssense'],
  'nordstrom.com': ['nordstrom'],
  'farfetch.com': ['farfetch'],
  'endclothing.com': ['end', 'end clothing', 'end.'],
  'mrporter.com': ['mr porter'],
  'net-a-porter.com': ['net a porter', 'net-a-porter'],
  'shopbop.com': ['shopbop'],
  'revolve.com': ['revolve'],
  'asos.com': ['asos'],
  'zara.com': ['zara'],
  'hm.com': ['h&m', 'hm'],
  'uniqlo.com': ['uniqlo'],
  'nike.com': ['nike'],
  'adidas.com': ['adidas'],
  'goat.com': ['goat'],
  'stockx.com': ['stockx'],
  'etsy.com': ['etsy'],
  'amazon.com': ['amazon'],
  'urbanoutfitters.com': ['urban outfitters'],
  'freepeople.com': ['free people'],
  'anthropologie.com': ['anthropologie'],
  'pacsun.com': ['pacsun'],
  'aritzia.com': ['aritzia'],
  'lululemon.com': ['lululemon'],
  'aloyoga.com': ['alo yoga', 'alo'],
  'matchesfashion.com': ['matchesfashion', 'matches'],
  'saksfifthavenue.com': ['saks fifth avenue', 'saks'],
  'bergdorfgoodman.com': ['bergdorf goodman'],
  'gucci.com': ['gucci'],
  'prada.com': ['prada'],
  'miumiu.com': ['miu miu'],
  'balenciaga.com': ['balenciaga'],
  'agolde.com': ['agolde'],
  'levi.com': ["levi's", 'levis', 'levi strauss'],
  'levis.com': ["levi's", 'levis', 'levi strauss'],
  'stussy.com': ['stussy'],
  'dickies.com': ['dickies'],
  'carhartt.com': ['carhartt'],
  'carhartt-wip.com': ['carhartt wip'],
  'thenorthface.com': ['the north face', 'north face'],
  'burberry.com': ['burberry'],
  'maxmara.com': ['max mara'],
  'acnestudios.com': ['acne studios'],
  'supremenewyork.com': ['supreme'],
  'ray-ban.com': ['ray ban', 'ray-ban'],
  'oakley.com': ['oakley'],
};

const BRAND_ALIASES: Array<{ alias: string; brand: string }> = [
  { alias: 'fear of god essentials', brand: 'Essentials' },
  { alias: 'essentials', brand: 'Essentials' },
  { alias: 'nike', brand: 'Nike' },
  { alias: 'adidas', brand: 'Adidas' },
  { alias: 'prada', brand: 'Prada' },
  { alias: 'miu miu', brand: 'Miu Miu' },
  { alias: 'balenciaga', brand: 'Balenciaga' },
  { alias: 'agolde', brand: 'AGOLDE' },
  { alias: 'levi s', brand: "Levi's" },
  { alias: 'levis', brand: "Levi's" },
  { alias: 'stussy', brand: 'Stussy' },
  { alias: 'carhartt', brand: 'Carhartt' },
  { alias: 'dickies', brand: 'Dickies' },
  { alias: 'the north face', brand: 'The North Face' },
  { alias: 'north face', brand: 'The North Face' },
  { alias: 'max mara', brand: 'Max Mara' },
  { alias: 'burberry', brand: 'Burberry' },
  { alias: 'acne studios', brand: 'Acne Studios' },
  { alias: 'supreme', brand: 'Supreme' },
  { alias: 'gucci', brand: 'Gucci' },
  { alias: 'ray ban', brand: 'Ray-Ban' },
  { alias: 'rayban', brand: 'Ray-Ban' },
  { alias: 'oakley', brand: 'Oakley' },
];

function buildQueryString(intent: SearchIntent, rawQuery: string): string {
  const parts: string[] = [];
  if (rawQuery.trim()) parts.push(rawQuery.trim());
  if (intent.brand?.length) parts.push(intent.brand.join(' '));
  if (intent.color?.length) parts.push(intent.color.join(' '));
  if (intent.style?.length) parts.push(intent.style.join(' '));
  parts.push(CATEGORY_KEYWORDS[intent.category]);
  parts.push(...(intent.keywords || []));
  const merged = Array.from(new Set(parts.filter(Boolean))).join(' ');
  return merged || rawQuery || CATEGORY_KEYWORDS[intent.category];
}

interface SerpShoppingResult {
  title?: string;
  source?: string;
  link?: string;
  product_link?: string;
  serpapi_product_api?: string;
  immersive_product_page_token?: string;
  serpapi_immersive_product_api?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  thumbnails?: Array<{ link?: string }>;
  product_id?: string;
  multiple_sources?: boolean;
}

interface SerpImmersiveStore {
  name?: string;
  link?: string;
  title?: string;
  tag?: string;
  price?: string;
  extracted_price?: number;
  total?: string;
  extracted_total?: number;
  shipping?: string;
  shipping_extracted?: number;
  rating?: number;
  reviews?: number;
  details_and_offers?: string[];
}

interface SerpImmersiveProductResponse {
  product_results?: {
    stores?: SerpImmersiveStore[];
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function safeHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function isGoogleRetailerUrl(url: string): boolean {
  const host = safeHostname(url);
  return host ? GOOGLE_HOSTS.has(host) : false;
}

export function hasDirectRetailerUrl(url: string): boolean {
  const host = safeHostname(url);
  return Boolean(host) && !GOOGLE_HOSTS.has(host as string);
}

function isTrustedRetailer(retailer: string, host: string | null): boolean {
  if (host) {
    for (const domain of TRUSTED_RETAILERS) {
      if (host === domain || host.endsWith(`.${domain}`)) return true;
    }

    if (!GOOGLE_HOSTS.has(host)) return false;
  }

  const normalizedRetailer = normalizeText(retailer);
  return Object.values(TRUSTED_RETAILER_ALIASES)
    .flat()
    .some((alias) => normalizedRetailer.includes(normalizeText(alias)));
}

function firstImage(result: SerpShoppingResult): string | null {
  return (
    result.thumbnail ||
    result.serpapi_thumbnail ||
    result.thumbnails?.find((image) => image.link)?.link ||
    null
  );
}

function bestKnownUrl(result: SerpShoppingResult): string | null {
  const direct = result.link?.trim();
  if (direct && !isGoogleRetailerUrl(direct)) return direct;
  return result.product_link?.trim() || direct || null;
}

function parsePrice(value: string): number {
  const matches = value.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!matches?.length) return 0;
  const prices = matches
    .map((match) => Number(match.replace(/,/g, '')))
    .filter((price) => Number.isFinite(price));
  if (!prices.length) return 0;
  return Math.min(...prices);
}

function inferBrand(title: string, source: string): string {
  const normalizedTitle = normalizeText(title);
  for (const { alias, brand } of BRAND_ALIASES) {
    if (normalizedTitle.includes(alias)) return brand;
  }

  const normalizedSource = normalizeText(source);
  for (const { alias, brand } of BRAND_ALIASES) {
    if (normalizedSource.includes(alias)) return brand;
  }

  return source.trim() || 'Unknown';
}

function cleanName(title: string, brand: string): string {
  const trimmed = title.trim();
  if (!trimmed) return brand;

  const prefix = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
  const cleaned = trimmed
    .replace(prefix, '')
    .replace(/\s*[|·-]\s*[^|·-]+$/, '')
    .trim();
  return cleaned || trimmed;
}

function dedupeByIdentity(items: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];

  for (const item of items) {
    const imageHash = crypto
      .createHash('sha1')
      .update(item.imageOriginalUrl || item.imageUrl)
      .digest('hex')
      .slice(0, 8);
    const key = `${item.brand.toLowerCase()}::${item.name.toLowerCase()}::${imageHash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function toProduct(result: SerpShoppingResult, category: Category): Product {
  const retailerUrl = bestKnownUrl(result) || 'https://google.com';
  const retailerHost = safeHostname(retailerUrl);
  const imageUrl = firstImage(result);
  const price = result.extracted_price ?? parsePrice(result.price || '0');
  const brand = inferBrand(result.title || '', result.source || '');
  const name = cleanName(result.title || '', brand);
  const trusted = isTrustedRetailer(result.source || '', retailerHost);
  const idSeed = result.product_id || retailerUrl || `${brand}:${name}:${result.price || ''}`;

  return {
    id: crypto.createHash('sha1').update(idSeed).digest('hex').slice(0, 16),
    brand,
    name,
    category,
    priceCents: Math.round(price * 100),
    currency: 'USD',
    retailer: result.source || retailerHost || 'Unknown retailer',
    retailerUrl,
    // TODO: swap this thumbnail for the bg-removed CDN asset once the image worker exists.
    imageUrl: imageUrl!,
    imageOriginalUrl: imageUrl || undefined,
    trusted,
    metadata: {
      trusted,
      retailerHost,
      serpapiProductId: result.product_id,
      serpapiProductApi: result.serpapi_product_api,
      immersiveProductPageToken: result.immersive_product_page_token,
      serpapiImmersiveProductApi: result.serpapi_immersive_product_api,
      shoppingLink: result.product_link,
      rawSource: result.source,
      rawPrice: result.price,
      multipleSources: result.multiple_sources ?? false,
    },
  };
}

export async function searchShopping(intent: SearchIntent, rawQuery: string): Promise<Product[]> {
  const query = buildQueryString(intent, rawQuery);
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) throw new Error('SERPAPI_KEY is not configured');

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: apiKey,
    hl: 'en',
    gl: 'us',
    google_domain: 'google.com',
    device: 'desktop',
    num: '16',
  });
  if (intent.priceMax) params.set('max_price', `${intent.priceMax}`);
  if (intent.priceMin) params.set('min_price', `${intent.priceMin}`);

  const response = await withTimeout(
    fetch(`${SERP_ENDPOINT}?${params}`, { cache: 'no-store' }),
    SEARCH_TIMEOUT_MS,
    `SerpAPI search timed out for "${rawQuery || query}"`,
  );

  if (!response.ok) throw new Error(`serpapi ${response.status}`);

  const data = await response.json();
  const raw: SerpShoppingResult[] = data.shopping_results || [];
  const rawHosts = raw
    .map((result) => safeHostname(bestKnownUrl(result)))
    .filter((host): host is string => Boolean(host));

  console.info(
    '[serpapi] query=%s built=%s results=%d hosts=%o',
    rawQuery || '(blank)',
    query,
    raw.length,
    rawHosts,
  );

  const products = dedupeByIdentity(
    raw
      .filter((result) => firstImage(result) && (result.extracted_price || result.price))
      .map((result) => toProduct(result, intent.category)),
  );

  const trusted = products.filter((product) => product.trusted !== false);
  const untrusted = products.filter((product) => product.trusted === false);

  if (trusted.length < MIN_TRUSTED_RESULTS) {
    console.warn(
      '[serpapi] trusted results below threshold for "%s": %d trusted of %d total',
      rawQuery || query,
      trusted.length,
      products.length,
    );
    return [...trusted, ...untrusted];
  }

  return trusted.length >= 6 ? trusted : [...trusted, ...untrusted];
}

async function fetchProductStores(product: Product): Promise<SerpImmersiveStore[]> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return [];

  const immersiveUrl = typeof product.metadata?.serpapiImmersiveProductApi === 'string'
    ? product.metadata.serpapiImmersiveProductApi
    : null;
  const pageToken = typeof product.metadata?.immersiveProductPageToken === 'string'
    ? product.metadata.immersiveProductPageToken
    : null;

  const url = new URL(immersiveUrl || SERP_ENDPOINT);
  if (!immersiveUrl) {
    if (!pageToken) return [];
    url.searchParams.set('engine', 'google_immersive_product');
    url.searchParams.set('page_token', pageToken);
  }
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('more_stores', 'true');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'us');
  url.searchParams.set('google_domain', 'google.com');
  url.searchParams.set('device', 'desktop');

  const response = await withTimeout(
    fetch(url.toString(), { cache: 'no-store' }),
    PRODUCT_TIMEOUT_MS,
    `SerpAPI immersive product lookup timed out for ${product.id}`,
  );

  if (!response.ok) throw new Error(`serpapi immersive product ${response.status}`);

  const data = (await response.json()) as SerpImmersiveProductResponse;
  return data.product_results?.stores || [];
}

function storeSortKey(store: SerpImmersiveStore): number {
  const host = safeHostname(store.link || '');
  const trusted = isTrustedRetailer(store.name || '', host);
  const price = store.extracted_total ?? store.extracted_price ?? parsePrice(store.total || store.price || '0');
  const bestPrice = /best price/i.test(store.tag || '') ? 1 : 0;
  const reviews = store.reviews ?? 0;

  return (
    (trusted ? 100_000 : 0) +
    (bestPrice ? 20_000 : 0) +
    reviews -
    Math.round(price * 100)
  );
}

export async function hydrateRetailerUrls(products: Product[]): Promise<Product[]> {
  return Promise.all(
    products.map(async (product) => {
      const currentHost = safeHostname(product.retailerUrl);
      if (currentHost && !GOOGLE_HOSTS.has(currentHost)) {
        return {
          ...product,
          id: crypto.createHash('sha1').update(product.retailerUrl).digest('hex').slice(0, 16),
        };
      }

      const immersiveApi = typeof product.metadata?.serpapiImmersiveProductApi === 'string'
        ? product.metadata.serpapiImmersiveProductApi
        : null;
      const pageToken = typeof product.metadata?.immersiveProductPageToken === 'string'
        ? product.metadata.immersiveProductPageToken
        : null;

      if (!immersiveApi && !pageToken) return product;

      try {
        const stores = await fetchProductStores(product);
        const storeHosts = stores
          .map((store) => safeHostname(store.link || ''))
          .filter((host): host is string => Boolean(host));
        console.info('[serpapi] product=%s storeHosts=%o', product.id, storeHosts);

        const bestStore = [...stores]
          .filter((store) => store.link)
          .sort((a, b) => storeSortKey(b) - storeSortKey(a))[0];

        if (!bestStore) return product;

        const retailerUrl = bestStore.link || product.retailerUrl;
        const host = safeHostname(retailerUrl);
        const trusted = isTrustedRetailer(bestStore.name || product.retailer, host);
        const price = bestStore.extracted_total ?? bestStore.extracted_price ?? parsePrice(bestStore.total || bestStore.price || '');

        return {
          ...product,
          id: crypto.createHash('sha1').update(retailerUrl).digest('hex').slice(0, 16),
          retailer: bestStore.name || product.retailer,
          retailerUrl,
          trusted,
          priceCents: price > 0 ? Math.round(price * 100) : product.priceCents,
          metadata: {
            ...(product.metadata || {}),
            trusted,
            retailerHost: host,
            resolvedBy: 'google_immersive_product',
            storeTag: bestStore.tag,
          },
        };
      } catch (error) {
        console.warn('[serpapi] store lookup failed for %s: %s', product.id, String(error));
        return product;
      }
    }),
  );
}
