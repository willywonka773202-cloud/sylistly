import crypto from 'node:crypto';
import { GOOGLE_HOSTS, safeHostname } from './retailer-url';
import type { Category, Product, SearchIntent } from './types';

const SEARCHAPI_ENDPOINT = 'https://www.searchapi.io/api/v1/search';
const SEARCH_TIMEOUT_MS = 12_000;
const PRODUCT_TIMEOUT_MS = Number.parseInt(process.env.SEARCHAPI_PRODUCT_TIMEOUT_MS || '2500', 10);
const MIN_TRUSTED_RESULTS = 3;
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
  'stevemadden.com', 'coach.com', 'longchamp.com', 'bottegaveneta.com',
  'michaelkors.com', 'gentlemonster.com', 'mejuri.com', 'pandora.net',
  'swarovski.com', 'tiffany.com', 'missoma.com', 'abercrombie.com',
  'drmartens.com', 'newbalance.com', 'converse.com', 'birkenstock.com',
  'ugg.com', 'jordan.com', 'neweracap.com', 'bloomingdales.com',
  'macys.com', 'dillards.com', 'zappos.com', 'dsw.com', 'journeys.com',
  'footlocker.com', 'champssports.com', 'finishline.com', 'jdsports.com',
  'dickssportinggoods.com', 'hibbett.com', 'mytheresa.com', 'luisaviaroma.com',
  'zumiez.com', 'slamjam.com', 'scheels.com', 'gemplers.com',
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
  'stevemadden.com': ['steve madden'],
  'coach.com': ['coach'],
  'longchamp.com': ['longchamp'],
  'bottegaveneta.com': ['bottega veneta'],
  'michaelkors.com': ['michael kors'],
  'gentlemonster.com': ['gentle monster'],
  'mejuri.com': ['mejuri'],
  'pandora.net': ['pandora'],
  'swarovski.com': ['swarovski'],
  'tiffany.com': ['tiffany', 'tiffany co'],
  'missoma.com': ['missoma'],
  'abercrombie.com': ['abercrombie'],
  'drmartens.com': ['dr martens', 'drmartens'],
  'newbalance.com': ['new balance'],
  'converse.com': ['converse'],
  'birkenstock.com': ['birkenstock'],
  'ugg.com': ['ugg'],
  'jordan.com': ['jordan'],
  'neweracap.com': ['new era'],
  'bloomingdales.com': ['bloomingdale', 'bloomingdales'],
  'macys.com': ['macys', 'macy s'],
  'dillards.com': ['dillards', 'dillard s'],
  'zappos.com': ['zappos'],
  'dsw.com': ['dsw'],
  'journeys.com': ['journeys'],
  'footlocker.com': ['foot locker', 'footlocker'],
  'champssports.com': ['champs sports', 'champssports'],
  'finishline.com': ['finish line', 'finishline'],
  'jdsports.com': ['jd sports', 'jdsports'],
  'dickssportinggoods.com': ["dick's sporting goods", 'dicks sporting goods'],
  'hibbett.com': ['hibbett'],
  'mytheresa.com': ['mytheresa'],
  'luisaviaroma.com': ['luisaviaroma'],
  'zumiez.com': ['zumiez'],
  'slamjam.com': ['slam jam', 'slamjam'],
  'scheels.com': ['scheels'],
  'gemplers.com': ['gemplers'],
};

const MARKETPLACE_RETAILERS = new Set([
  'amazon.com',
  'ebay.com',
  'etsy.com',
  'mercari.com',
  'poshmark.com',
  'vestiairecollective.com',
  'whatnot.com',
  'goat.com',
  'stockx.com',
]);

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

interface SearchApiShoppingResult {
  product_id?: string;
  title?: string;
  product_link?: string;
  seller?: string;
  offers?: string;
  extracted_offers?: number;
  offers_link?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  delivery?: string;
  thumbnail?: string;
  product_token?: string;
}

interface SearchApiOffer {
  title?: string;
  link?: string;
  price?: string;
  extracted_price?: number;
  total_price?: string;
  extracted_total_price?: number;
  delivery_price?: string;
  extracted_delivery_price?: number;
  rating?: number;
  reviews?: number;
  details?: string[];
  merchant?: {
    name?: string;
  };
}

interface SearchApiProductOffersResponse {
  offers?: SearchApiOffer[];
}

function getSearchApiKey(): string | null {
  return process.env.SEARCHAPI_KEY?.trim() || process.env.SERPAPI_KEY?.trim() || null;
}

function searchApiHeaders(): Record<string, string> {
  const apiKey = getSearchApiKey();
  if (!apiKey) return {};
  return { Authorization: `Bearer ${apiKey}` };
}

function buildQueryString(intent: SearchIntent, rawQuery: string): string {
  const parts: string[] = [];
  if (rawQuery.trim()) parts.push(rawQuery.trim());
  if (intent.brand?.length) parts.push(intent.brand.join(' '));
  if (intent.color?.length) parts.push(intent.color.join(' '));
  if (intent.style?.length) parts.push(intent.style.join(' '));
  if (intent.priceMin && intent.priceMax) parts.push(`between $${intent.priceMin} and $${intent.priceMax}`);
  else if (intent.priceMax) parts.push(`under $${intent.priceMax}`);
  else if (intent.priceMin) parts.push(`over $${intent.priceMin}`);
  parts.push(CATEGORY_KEYWORDS[intent.category]);
  parts.push(...(intent.keywords || []));
  const merged = Array.from(new Set(parts.filter(Boolean))).join(' ');
  return merged || rawQuery || CATEGORY_KEYWORDS[intent.category];
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

function firstImage(result: SearchApiShoppingResult): string | null {
  return result.thumbnail || null;
}

function bestKnownUrl(result: SearchApiShoppingResult): string | null {
  return result.product_link?.trim() || null;
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

function inferBrand(title: string, seller: string): string {
  const normalizedTitle = normalizeText(title);
  for (const { alias, brand } of BRAND_ALIASES) {
    if (normalizedTitle.includes(alias)) return brand;
  }

  const normalizedSeller = normalizeText(seller);
  for (const { alias, brand } of BRAND_ALIASES) {
    if (normalizedSeller.includes(alias)) return brand;
  }

  return seller.trim() || 'Unknown';
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

function toProduct(result: SearchApiShoppingResult, category: Category): Product {
  const retailerUrl = bestKnownUrl(result) || 'https://google.com';
  const retailerHost = safeHostname(retailerUrl);
  const imageUrl = firstImage(result);
  const price = result.extracted_price ?? parsePrice(result.price || '0');
  const seller = result.seller || '';
  const brand = inferBrand(result.title || '', seller);
  const name = cleanName(result.title || '', brand);
  const trusted = isTrustedRetailer(seller, retailerHost);
  const idSeed = result.product_id || retailerUrl || `${brand}:${name}:${result.price || ''}`;

  return {
    id: crypto.createHash('sha1').update(idSeed).digest('hex').slice(0, 16),
    brand,
    name,
    category,
    priceCents: Math.round(price * 100),
    currency: 'USD',
    retailer: seller || retailerHost || 'Unknown retailer',
    retailerUrl,
    imageUrl: imageUrl!,
    imageOriginalUrl: imageUrl || undefined,
    trusted,
    metadata: {
      trusted,
      retailerHost,
      searchapiProductId: result.product_id,
      searchapiProductToken: result.product_token,
      searchapiOffersLink: result.offers_link,
      rawSeller: seller,
      rawPrice: result.price,
      extractedOffers: result.extracted_offers,
    },
  };
}

export async function searchShopping(intent: SearchIntent, rawQuery: string): Promise<Product[]> {
  const query = buildQueryString(intent, rawQuery);
  const apiKey = getSearchApiKey();
  if (!apiKey) throw new Error('SEARCHAPI_KEY is not configured');

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    hl: 'en',
    gl: 'us',
    location: 'United States',
  });

  const response = await withTimeout(
    fetch(`${SEARCHAPI_ENDPOINT}?${params.toString()}`, {
      cache: 'no-store',
      headers: searchApiHeaders(),
    }),
    SEARCH_TIMEOUT_MS,
    `SearchAPI search timed out for "${rawQuery || query}"`,
  );

  if (!response.ok) throw new Error(`searchapi ${response.status}`);

  const data = await response.json();
  const raw: SearchApiShoppingResult[] = [
    ...(Array.isArray(data.shopping_results) ? data.shopping_results : []),
    ...(Array.isArray(data.popular_products) ? data.popular_products : []),
  ];
  const rawHosts = raw
    .map((result) => safeHostname(bestKnownUrl(result)))
    .filter((host): host is string => Boolean(host));

  console.info(
    '[searchapi] query=%s built=%s results=%d hosts=%o',
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
      '[searchapi] trusted results below threshold for "%s": %d trusted of %d total',
      rawQuery || query,
      trusted.length,
      products.length,
    );
    return [...trusted, ...untrusted];
  }

  return trusted.length >= 6 ? trusted : [...trusted, ...untrusted];
}

async function fetchProductOffers(product: Product): Promise<SearchApiOffer[]> {
  const apiKey = getSearchApiKey();
  if (!apiKey) return [];

  const productToken = typeof product.metadata?.searchapiProductToken === 'string'
    ? product.metadata.searchapiProductToken
    : null;
  if (!productToken) return [];

  const params = new URLSearchParams({
    engine: 'google_product_offers',
    product_token: productToken,
    hl: 'en',
    gl: 'us',
    page: '1',
  });

  const response = await withTimeout(
    fetch(`${SEARCHAPI_ENDPOINT}?${params.toString()}`, {
      cache: 'no-store',
      headers: searchApiHeaders(),
    }),
    PRODUCT_TIMEOUT_MS,
    `SearchAPI product offers lookup timed out for ${product.id}`,
  );

  if (!response.ok) throw new Error(`searchapi product offers ${response.status}`);

  const data = (await response.json()) as SearchApiProductOffersResponse;
  return data.offers || [];
}

function offerSortKey(offer: SearchApiOffer): number {
  const host = safeHostname(offer.link || '');
  const merchantName = offer.merchant?.name || '';
  const trusted = isTrustedRetailer(merchantName, host);
  const marketplace = host ? MARKETPLACE_RETAILERS.has(host) : false;
  const price = offer.extracted_total_price ?? offer.extracted_price ?? parsePrice(offer.total_price || offer.price || '0');
  const reviews = offer.reviews ?? 0;

  return (
    (trusted ? 1_000_000 : 0) +
    (marketplace ? -250_000 : 0) +
    reviews * 25 -
    Math.round(price * 10)
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

      const productToken = typeof product.metadata?.searchapiProductToken === 'string'
        ? product.metadata.searchapiProductToken
        : null;
      if (!productToken) return product;

      try {
        const offers = await fetchProductOffers(product);
        const offerHosts = offers
          .map((offer) => safeHostname(offer.link || ''))
          .filter((host): host is string => Boolean(host));
        console.info('[searchapi] product=%s offerHosts=%o', product.id, offerHosts);

        const bestOffer = [...offers]
          .filter((offer) => offer.link)
          .sort((a, b) => offerSortKey(b) - offerSortKey(a))[0];

        if (!bestOffer) return product;

        const retailerUrl = bestOffer.link || product.retailerUrl;
        const host = safeHostname(retailerUrl);
        const retailer = bestOffer.merchant?.name || product.retailer;
        const trusted = isTrustedRetailer(retailer, host);
        const price = bestOffer.extracted_total_price ?? bestOffer.extracted_price ?? parsePrice(bestOffer.total_price || bestOffer.price || '');

        return {
          ...product,
          id: crypto.createHash('sha1').update(retailerUrl).digest('hex').slice(0, 16),
          retailer,
          retailerUrl,
          trusted,
          priceCents: price > 0 ? Math.round(price * 100) : product.priceCents,
          metadata: {
            ...(product.metadata || {}),
            trusted,
            retailerHost: host,
            resolvedBy: 'google_product_offers',
          },
        };
      } catch (error) {
        console.warn('[searchapi] offer lookup failed for %s: %s', product.id, String(error));
        return product;
      }
    }),
  );
}
