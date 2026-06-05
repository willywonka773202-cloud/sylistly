import crypto from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Category, Product } from '../lib/types.ts';

type Gender = 'masc' | 'fem' | 'androgynous';

interface SearchPlanItem {
  id: number;
  query: string;
  targetVibes: string[];
  targetOccasions: string[];
  targetCategories: Category[];
  targetGender: Gender[];
  gapOnly?: boolean;
}

interface SearchApiShoppingResult {
  product_id?: string;
  title?: string;
  name?: string;
  link?: string;
  product_link?: string;
  source_link?: string;
  seller?: string;
  merchant?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  image?: string;
  product_token?: string;
  product?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SearchApiPayload {
  [key: string]: unknown;
  shopping_results?: SearchApiShoppingResult[];
  popular_products?: SearchApiShoppingResult[];
  organic_results?: SearchApiShoppingResult[];
}

interface RejectionCounts {
  rejectedNoTitle: number;
  rejectedNoUrl: number;
  rejectedNoImage: number;
  rejectedDuplicate: number;
  rejectedWrongCategory: number;
  acceptedDirectUrl: number;
  acceptedGoogleFallback: number;
  accepted: number;
}

type UrlDecision = 'direct' | 'googleFallback';

const OUTPUT_PATH = path.resolve(process.cwd(), 'data/generated-catalog.json');
const PHOTO_CATALOG_PATH = path.resolve(process.cwd(), 'data/photo-catalog.json');
const SEARCHAPI_ENDPOINT = 'https://www.searchapi.io/api/v1/search';
const SEARCH_SCOPE = process.env.SEARCH_SCOPE || 'missing-vibes';
const DEFAULT_MAX_SEARCHES = SEARCH_SCOPE === 'all' ? '40' : '16';
const MAX_SEARCHES = Number.parseInt(process.env.MAX_SEARCHES || DEFAULT_MAX_SEARCHES, 10);
const RESULTS_PER_QUERY = Number.parseInt(process.env.RESULTS_PER_QUERY || '8', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const DEBUG_SEARCHAPI = process.env.DEBUG_SEARCHAPI === '1' || process.argv.includes('--debug');

const CATEGORY_TARGETS: Record<Category, number> = {
  top: 40,
  bottom: 35,
  outer: 35,
  shoes: 40,
  bag: 25,
  hat: 20,
  eyewear: 25,
  jewelry: 25,
};

const CATEGORY_TERMS: Record<Category, string[]> = {
  hat: ['hat', 'cap', 'beanie', 'bucket hat', 'trucker'],
  outer: ['jacket', 'coat', 'hoodie', 'cardigan', 'blazer', 'overshirt', 'puffer', 'trench', 'sweater'],
  top: ['shirt', 'tee', 'top', 'tank', 'polo', 'blouse', 'bra', 'sports bra', 'button down', 'knit'],
  bottom: ['pants', 'jeans', 'shorts', 'skirt', 'trousers', 'leggings', 'jogger', 'cargo'],
  shoes: ['shoes', 'sneakers', 'boots', 'heels', 'sandals', 'loafers', 'slides'],
  bag: ['bag', 'handbag', 'tote', 'backpack', 'duffel', 'duffle', 'crossbody', 'shoulder bag', 'purse'],
  eyewear: ['sunglasses', 'glasses', 'eyewear', 'shades', 'frames'],
  jewelry: ['jewelry', 'necklace', 'earrings', 'bracelet', 'ring', 'chain', 'hoops'],
};

const COLOR_TERMS = [
  'black', 'white', 'cream', 'ivory', 'neutral', 'beige', 'tan', 'brown', 'navy', 'blue',
  'grey', 'gray', 'charcoal', 'pink', 'red', 'green', 'olive', 'silver', 'gold',
];

const SEARCH_PLAN: SearchPlanItem[] = [
  { id: 1, query: 'men minimalist outfit essentials black white neutral top pants sneakers', targetVibes: ['clean', 'minimal', 'casual'], targetOccasions: ['everyday'], targetCategories: ['top', 'bottom', 'shoes'], targetGender: ['masc', 'androgynous'] },
  { id: 2, query: 'women minimalist outfit essentials black white neutral top pants shoes', targetVibes: ['clean', 'minimal', 'casual'], targetOccasions: ['everyday'], targetCategories: ['top', 'bottom', 'shoes'], targetGender: ['fem', 'androgynous'] },
  { id: 3, query: 'unisex clean outfit essentials sneakers cap bag sunglasses', targetVibes: ['clean', 'minimal', 'casual'], targetOccasions: ['everyday'], targetCategories: ['shoes', 'hat', 'bag', 'eyewear'], targetGender: ['androgynous'] },
  { id: 4, query: 'minimalist fashion accessories sunglasses jewelry bag', targetVibes: ['clean', 'minimal', 'luxury'], targetOccasions: ['everyday', 'date'], targetCategories: ['eyewear', 'jewelry', 'bag'], targetGender: ['fem', 'androgynous'] },
  { id: 5, query: 'men streetwear hoodie cargo pants sneakers cap popular brands', targetVibes: ['streetwear', 'college', 'casual'], targetOccasions: ['everyday'], targetCategories: ['outer', 'bottom', 'shoes', 'hat'], targetGender: ['masc', 'androgynous'] },
  { id: 6, query: 'women streetwear outfit cargo pants crop top sneakers bag', targetVibes: ['streetwear', 'y2k', 'casual'], targetOccasions: ['everyday'], targetCategories: ['bottom', 'top', 'shoes', 'bag'], targetGender: ['fem', 'androgynous'] },
  { id: 7, query: 'college outfit essentials hoodie jeans sneakers cap backpack', targetVibes: ['college', 'casual', 'streetwear'], targetOccasions: ['school', 'everyday'], targetCategories: ['outer', 'bottom', 'shoes', 'hat', 'bag'], targetGender: ['androgynous'] },
  { id: 8, query: 'streetwear accessories New Era cap sunglasses chain bag', targetVibes: ['streetwear', 'college', 'casual'], targetOccasions: ['everyday'], targetCategories: ['hat', 'eyewear', 'jewelry', 'bag'], targetGender: ['masc', 'androgynous'] },
  { id: 9, query: 'women night out outfit black top leather jacket heels bag jewelry', targetVibes: ['night', 'edgy', 'date'], targetOccasions: ['night out', 'date'], targetCategories: ['top', 'outer', 'shoes', 'bag', 'jewelry'], targetGender: ['fem'] },
  { id: 10, query: 'men night out outfit jacket shirt trousers loafers chain', targetVibes: ['night', 'date', 'edgy'], targetOccasions: ['night out', 'date'], targetCategories: ['outer', 'top', 'bottom', 'shoes', 'jewelry'], targetGender: ['masc'] },
  { id: 11, query: 'date night outfit women dressy top jeans heels bag jewelry', targetVibes: ['date', 'night', 'luxury'], targetOccasions: ['date', 'night out'], targetCategories: ['top', 'bottom', 'shoes', 'bag', 'jewelry'], targetGender: ['fem'] },
  { id: 12, query: 'date night outfit men clean jacket knit polo trousers shoes', targetVibes: ['date', 'clean', 'old money'], targetOccasions: ['date', 'night out'], targetCategories: ['outer', 'top', 'bottom', 'shoes'], targetGender: ['masc'] },
  { id: 13, query: 'men gym outfit Nike Adidas shorts training top shoes', targetVibes: ['gym', 'athletic'], targetOccasions: ['workout'], targetCategories: ['top', 'bottom', 'shoes'], targetGender: ['masc'] },
  { id: 14, query: 'women gym outfit leggings sports bra training shoes bag', targetVibes: ['gym', 'athletic'], targetOccasions: ['workout'], targetCategories: ['top', 'bottom', 'shoes', 'bag'], targetGender: ['fem'] },
  { id: 15, query: 'athletic outfit essentials sneakers shorts hoodie cap', targetVibes: ['gym', 'athletic', 'casual'], targetOccasions: ['workout', 'everyday'], targetCategories: ['shoes', 'bottom', 'outer', 'hat'], targetGender: ['androgynous'] },
  { id: 16, query: 'gym accessories cap sunglasses duffel bag', targetVibes: ['gym', 'athletic'], targetOccasions: ['workout'], targetCategories: ['hat', 'eyewear', 'bag'], targetGender: ['androgynous'] },
  { id: 17, query: 'men business casual outfit loafers trousers button down blazer', targetVibes: ['office', 'business casual', 'old money'], targetOccasions: ['office'], targetCategories: ['shoes', 'bottom', 'top', 'outer'], targetGender: ['masc'] },
  { id: 18, query: 'women business casual outfit blazer trousers loafers bag', targetVibes: ['office', 'business casual', 'old money'], targetOccasions: ['office'], targetCategories: ['outer', 'bottom', 'shoes', 'bag'], targetGender: ['fem'] },
  { id: 19, query: 'old money outfit men polo trousers loafers sweater', targetVibes: ['old money', 'preppy', 'luxury'], targetOccasions: ['office', 'date'], targetCategories: ['top', 'bottom', 'shoes', 'outer'], targetGender: ['masc'] },
  { id: 20, query: 'old money outfit women cardigan trousers loafers sunglasses jewelry', targetVibes: ['old money', 'preppy', 'luxury'], targetOccasions: ['office', 'date'], targetCategories: ['outer', 'bottom', 'shoes', 'eyewear', 'jewelry'], targetGender: ['fem'] },
  { id: 21, query: 'men vacation outfit linen shirt shorts sandals sunglasses', targetVibes: ['vacation', 'beach', 'summer'], targetOccasions: ['vacation', 'beach'], targetCategories: ['top', 'bottom', 'shoes', 'eyewear'], targetGender: ['masc'] },
  { id: 22, query: 'women vacation outfit linen pants tank sandals straw bag sunglasses', targetVibes: ['vacation', 'beach', 'summer'], targetOccasions: ['vacation', 'beach'], targetCategories: ['bottom', 'top', 'shoes', 'bag', 'eyewear'], targetGender: ['fem'] },
  { id: 23, query: 'beach outfit essentials sunglasses sandals tote hat', targetVibes: ['vacation', 'beach', 'summer'], targetOccasions: ['vacation', 'beach'], targetCategories: ['eyewear', 'shoes', 'bag', 'hat'], targetGender: ['androgynous'] },
  { id: 24, query: 'summer outfit accessories sunglasses tote hat jewelry', targetVibes: ['summer', 'vacation', 'beach'], targetOccasions: ['vacation', 'beach'], targetCategories: ['eyewear', 'bag', 'hat', 'jewelry'], targetGender: ['fem', 'androgynous'] },
  { id: 25, query: 'men winter outfit puffer jacket beanie boots scarf', targetVibes: ['winter', 'cozy'], targetOccasions: ['winter'], targetCategories: ['outer', 'hat', 'shoes'], targetGender: ['masc'] },
  { id: 26, query: 'women winter outfit puffer jacket knit sweater boots beanie', targetVibes: ['winter', 'cozy'], targetOccasions: ['winter'], targetCategories: ['outer', 'top', 'shoes', 'hat'], targetGender: ['fem'] },
  { id: 27, query: 'cozy outfit hoodie sweatpants UGG beanie tote', targetVibes: ['cozy', 'winter', 'casual'], targetOccasions: ['everyday', 'winter'], targetCategories: ['outer', 'bottom', 'shoes', 'hat', 'bag'], targetGender: ['androgynous'] },
  { id: 28, query: 'winter accessories beanie sunglasses boots bag', targetVibes: ['winter', 'cozy'], targetOccasions: ['winter'], targetCategories: ['hat', 'eyewear', 'shoes', 'bag'], targetGender: ['androgynous'] },
  { id: 29, query: 'edgy outfit black leather jacket boots sunglasses jewelry', targetVibes: ['edgy', 'night'], targetOccasions: ['night out'], targetCategories: ['outer', 'shoes', 'eyewear', 'jewelry'], targetGender: ['androgynous'] },
  { id: 30, query: 'techwear outfit cargo pants shell jacket sneakers bag', targetVibes: ['techwear', 'streetwear', 'edgy'], targetOccasions: ['everyday'], targetCategories: ['bottom', 'outer', 'shoes', 'bag'], targetGender: ['androgynous'] },
  { id: 31, query: 'y2k outfit women sunglasses bag jewelry jeans top', targetVibes: ['y2k', 'streetwear', 'night'], targetOccasions: ['everyday', 'night out'], targetCategories: ['eyewear', 'bag', 'jewelry', 'bottom', 'top'], targetGender: ['fem'] },
  { id: 32, query: 'western outfit boots denim jacket belt hat', targetVibes: ['western', 'casual'], targetOccasions: ['everyday'], targetCategories: ['shoes', 'outer', 'hat'], targetGender: ['androgynous'] },
  { id: 33, query: 'Ray Ban Oakley Le Specs sunglasses black fashion', targetVibes: ['clean', 'streetwear', 'night', 'summer'], targetOccasions: ['everyday', 'vacation'], targetCategories: ['eyewear'], targetGender: ['androgynous'], gapOnly: true },
  { id: 34, query: 'Mejuri Missoma gold jewelry necklace earrings bracelet', targetVibes: ['clean', 'date', 'luxury', 'old money'], targetOccasions: ['date', 'office'], targetCategories: ['jewelry'], targetGender: ['fem', 'androgynous'], gapOnly: true },
  { id: 35, query: 'men silver chain necklace fashion jewelry', targetVibes: ['streetwear', 'night', 'edgy'], targetOccasions: ['night out'], targetCategories: ['jewelry'], targetGender: ['masc'], gapOnly: true },
  { id: 36, query: 'women fashion shoulder bag black cream brown popular brands', targetVibes: ['clean', 'night', 'date', 'office'], targetOccasions: ['everyday', 'date'], targetCategories: ['bag'], targetGender: ['fem'], gapOnly: true },
  { id: 37, query: 'New Era Nike Adidas cap black white neutral', targetVibes: ['streetwear', 'clean', 'college', 'gym'], targetOccasions: ['everyday'], targetCategories: ['hat'], targetGender: ['androgynous'], gapOnly: true },
  { id: 38, query: 'black sneakers New Balance Nike Adidas ASICS Salomon', targetVibes: ['streetwear', 'clean', 'athletic'], targetOccasions: ['everyday'], targetCategories: ['shoes'], targetGender: ['androgynous'], gapOnly: true },
  { id: 39, query: 'loafers boots heels sandals fashion outfit shoes', targetVibes: ['office', 'night', 'vacation', 'old money'], targetOccasions: ['office', 'date', 'vacation'], targetCategories: ['shoes'], targetGender: ['androgynous'], gapOnly: true },
  { id: 40, query: 'puffer jacket leather jacket denim jacket trench coat fashion', targetVibes: ['winter', 'edgy', 'streetwear', 'office'], targetOccasions: ['everyday', 'winter'], targetCategories: ['outer'], targetGender: ['androgynous'], gapOnly: true },
];

const TARGETED_MISSING_VIBE_PLAN: SearchPlanItem[] = [
  { id: 101, query: 'men office outfit blazer trousers loafers button down', targetVibes: ['office', 'business casual'], targetOccasions: ['office'], targetCategories: ['outer', 'bottom', 'shoes', 'top'], targetGender: ['masc'] },
  { id: 102, query: 'women office outfit blazer trousers loafers work bag', targetVibes: ['office', 'business casual'], targetOccasions: ['office'], targetCategories: ['outer', 'bottom', 'shoes', 'bag'], targetGender: ['fem'] },
  { id: 103, query: 'men business casual outfit polo chinos loafers sweater', targetVibes: ['business casual', 'preppy', 'office'], targetOccasions: ['office', 'everyday'], targetCategories: ['top', 'bottom', 'shoes', 'outer'], targetGender: ['masc'] },
  { id: 104, query: 'women business casual outfit cardigan trousers flats tote', targetVibes: ['business casual', 'preppy', 'office'], targetOccasions: ['office', 'everyday'], targetCategories: ['outer', 'bottom', 'shoes', 'bag'], targetGender: ['fem'] },
  { id: 105, query: 'men vacation outfit linen shirt shorts sandals sunglasses', targetVibes: ['vacation', 'beach', 'summer'], targetOccasions: ['vacation', 'beach'], targetCategories: ['top', 'bottom', 'shoes', 'eyewear'], targetGender: ['masc'] },
  { id: 106, query: 'women vacation beach outfit linen pants tank sandals straw bag', targetVibes: ['vacation', 'beach', 'summer'], targetOccasions: ['vacation', 'beach'], targetCategories: ['bottom', 'top', 'shoes', 'bag'], targetGender: ['fem'] },
  { id: 107, query: 'summer outfit sunglasses sandals tote hat linen', targetVibes: ['summer', 'vacation', 'beach'], targetOccasions: ['vacation', 'beach', 'everyday'], targetCategories: ['eyewear', 'shoes', 'bag', 'hat', 'top', 'bottom'], targetGender: ['androgynous'] },
  { id: 108, query: 'men winter cozy outfit puffer jacket sweater beanie boots', targetVibes: ['winter', 'cozy'], targetOccasions: ['winter', 'everyday'], targetCategories: ['outer', 'top', 'hat', 'shoes'], targetGender: ['masc'] },
  { id: 109, query: 'women winter cozy outfit puffer jacket knit sweater boots beanie', targetVibes: ['winter', 'cozy'], targetOccasions: ['winter', 'everyday'], targetCategories: ['outer', 'top', 'shoes', 'hat'], targetGender: ['fem'] },
  { id: 110, query: 'cozy outfit hoodie sweatpants ugg beanie tote', targetVibes: ['cozy', 'winter', 'casual'], targetOccasions: ['everyday', 'winter'], targetCategories: ['outer', 'bottom', 'shoes', 'hat', 'bag'], targetGender: ['androgynous'] },
  { id: 111, query: 'techwear outfit shell jacket cargo pants sneakers crossbody bag', targetVibes: ['techwear', 'streetwear', 'edgy'], targetOccasions: ['everyday'], targetCategories: ['outer', 'bottom', 'shoes', 'bag'], targetGender: ['androgynous'] },
  { id: 112, query: 'black techwear cargo pants jacket sneakers bag', targetVibes: ['techwear', 'streetwear', 'edgy'], targetOccasions: ['everyday'], targetCategories: ['bottom', 'outer', 'shoes', 'bag'], targetGender: ['androgynous'] },
  { id: 113, query: 'western outfit cowboy boots denim jacket belt hat', targetVibes: ['western', 'casual'], targetOccasions: ['everyday'], targetCategories: ['shoes', 'outer', 'hat'], targetGender: ['androgynous'] },
  { id: 114, query: 'women western outfit denim boots belt hat', targetVibes: ['western', 'casual'], targetOccasions: ['everyday'], targetCategories: ['outer', 'shoes', 'hat'], targetGender: ['fem', 'androgynous'] },
  { id: 115, query: 'men preppy outfit polo sweater chinos loafers', targetVibes: ['preppy', 'business casual', 'office'], targetOccasions: ['office', 'everyday'], targetCategories: ['top', 'outer', 'bottom', 'shoes'], targetGender: ['masc'] },
  { id: 116, query: 'women preppy outfit cardigan pleated skirt loafers headband', targetVibes: ['preppy', 'business casual', 'office'], targetOccasions: ['office', 'everyday'], targetCategories: ['outer', 'bottom', 'shoes', 'hat'], targetGender: ['fem'] },
];

const ACTIVE_SEARCH_PLAN = SEARCH_SCOPE === 'all' ? SEARCH_PLAN : TARGETED_MISSING_VIBE_PLAN;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = parsePrice(value);
      if (parsed > 0) return parsed;
    }
  }
  return null;
}

function nestedString(source: SearchApiShoppingResult, key: string): string {
  const nested = isRecord(source.product) ? source.product[key] : undefined;
  return firstString(source[key], nested);
}

function parsePrice(value: string): number {
  const match = value.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return 0;
  const price = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(price) ? price : 0;
}

function inferBrand(title: string, seller: string): string {
  const normalized = normalize(`${title} ${seller}`);
  const known = [
    'Nike', 'Adidas', 'New Balance', 'ASICS', 'Salomon', 'Ray-Ban', 'Oakley', 'Le Specs',
    'Mejuri', 'Missoma', 'Miansai', 'Zara', 'H&M', 'Uniqlo', 'Aritzia', 'Lululemon',
    'Alo Yoga', 'Coach', 'Michael Kors', 'Longchamp', 'Carhartt', 'Dickies', "Levi's",
    'The North Face', 'UGG', 'Dr. Martens', 'Birkenstock', 'Converse',
  ];
  const found = known.find((brand) => normalized.includes(normalize(brand)));
  return found || seller.trim() || 'Unknown';
}

function inferCategory(title: string, plan: SearchPlanItem): Category | null {
  const normalized = normalize(title);
  const scored = plan.targetCategories
    .map((category) => ({
      category,
      score: CATEGORY_TERMS[category].reduce((sum, term) => sum + (normalized.includes(normalize(term)) ? 1 : 0), 0),
    }))
    .sort((left, right) => right.score - left.score);

  if (scored[0]?.score) return scored[0].category;
  return plan.targetCategories.length === 1 ? plan.targetCategories[0] : null;
}

function inferColors(value: string): string[] {
  const normalized = normalize(value);
  return COLOR_TERMS.filter((color) => normalized.includes(normalize(color)));
}

function isGoodImage(url: string | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url) && !url.startsWith('data:image/');
}

function isUsableUrl(url: string | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function isGoogleShoppingUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    return host === 'google.com' && (/^\/(?:search|shopping)/i.test(parsed.pathname) || parsed.hash.includes('oshopproduct'));
  } catch {
    return /google\.com\/(?:search|shopping)|#oshopproduct/i.test(url);
  }
}

function isDirectRetailerUrl(url: string | undefined): boolean {
  return isUsableUrl(url) && !isGoogleShoppingUrl(url);
}

function productKey(product: Product): string {
  return `${product.category}::${normalize(product.brand)}::${normalize(product.name)}`;
}

function urlKey(product: Product): string {
  const url = product.productUrl || product.retailerUrl || product.googleShoppingUrl || product.fallbackUrl || '';
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.toString().toLowerCase();
  } catch {
    return normalize(url);
  }
}

function arrayValue(product: Product, key: keyof Product, metadataKey: string): string[] {
  const topLevel = product[key];
  const metadataValue = product.metadata?.[metadataKey];
  const values = Array.isArray(topLevel) ? topLevel : Array.isArray(metadataValue) ? metadataValue : [];
  return values.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
}

function uniqueStrings(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group || []).map((value) => value.trim()).filter(Boolean)));
}

function metadataSize(product: Product): number {
  return product.metadata ? Object.keys(product.metadata).length : 0;
}

function qualityScore(product: Product): number {
  const mainUrl = product.productUrl || product.retailerUrl || '';
  const host = safeHostname(mainUrl);
  return [
    isGoodImage(product.imageUrl) ? 80 : 0,
    isDirectRetailerUrl(mainUrl) ? 45 : 0,
    isGoogleShoppingUrl(mainUrl) ? -80 : 0,
    isGoogleShoppingUrl(product.googleShoppingUrl || product.fallbackUrl) ? 8 : 0,
    host && !host.includes('google.') ? 18 : 0,
    product.priceCents > 0 ? 16 : 0,
    arrayValue(product, 'vibes', 'vibes').length * 4,
    arrayValue(product, 'occasions', 'occasions').length * 3,
    arrayValue(product, 'searchTerms', 'searchTerms').length,
    metadataSize(product),
  ].reduce((sum, value) => sum + value, 0);
}

function mergeProducts(left: Product, right: Product): Product {
  const primary = qualityScore(right) > qualityScore(left) ? right : left;
  const secondary = primary === right ? left : right;
  const vibes = uniqueStrings(arrayValue(primary, 'vibes', 'vibes'), arrayValue(secondary, 'vibes', 'vibes'));
  const occasions = uniqueStrings(arrayValue(primary, 'occasions', 'occasions'), arrayValue(secondary, 'occasions', 'occasions'));
  const colors = uniqueStrings(arrayValue(primary, 'colors', 'colors'), arrayValue(secondary, 'colors', 'colors'));
  const gender = uniqueStrings(arrayValue(primary, 'gender', 'gender'), arrayValue(secondary, 'gender', 'gender')) as Gender[];
  const searchTerms = uniqueStrings(arrayValue(primary, 'searchTerms', 'searchTerms'), arrayValue(secondary, 'searchTerms', 'searchTerms'));
  const sourceQueries = uniqueStrings(
    [primary.sourceQuery || '', secondary.sourceQuery || ''],
    arrayValue(primary, 'sourceQuery' as keyof Product, 'sourceQueries'),
    arrayValue(secondary, 'sourceQuery' as keyof Product, 'sourceQueries'),
  );

  return {
    ...secondary,
    ...primary,
    id: primary.id,
    priceCents: primary.priceCents > 0 ? primary.priceCents : secondary.priceCents,
    imageUrl: isGoodImage(primary.imageUrl) ? primary.imageUrl : secondary.imageUrl,
    imageOriginalUrl: isGoodImage(primary.imageOriginalUrl) ? primary.imageOriginalUrl : secondary.imageOriginalUrl,
    retailerUrl: isDirectRetailerUrl(primary.retailerUrl) ? primary.retailerUrl : isDirectRetailerUrl(secondary.retailerUrl) ? secondary.retailerUrl : '',
    productUrl: isDirectRetailerUrl(primary.productUrl || primary.retailerUrl)
      ? (primary.productUrl || primary.retailerUrl)
      : isDirectRetailerUrl(secondary.productUrl || secondary.retailerUrl)
        ? (secondary.productUrl || secondary.retailerUrl)
        : undefined,
    googleShoppingUrl: primary.googleShoppingUrl || primary.fallbackUrl || secondary.googleShoppingUrl || secondary.fallbackUrl,
    fallbackUrl: primary.fallbackUrl || primary.googleShoppingUrl || secondary.fallbackUrl || secondary.googleShoppingUrl,
    vibes,
    occasions,
    colors,
    gender,
    searchTerms,
    sourceQuery: primary.sourceQuery || secondary.sourceQuery,
    imageQuality: isGoodImage(primary.imageUrl) ? 'good' : primary.imageQuality,
    metadata: {
      ...(secondary.metadata || {}),
      ...(primary.metadata || {}),
      vibes,
      styles: vibes,
      occasions,
      colors,
      gender,
      keywords: searchTerms,
      searchTerms,
      sourceQueries,
      imageQuality: isGoodImage(primary.imageUrl) ? 'good' : primary.imageQuality,
    },
  };
}

function sanitizeGeneratedProduct(product: Product): Product {
  const googleUrl = [product.googleShoppingUrl, product.fallbackUrl, product.productUrl, product.retailerUrl].find(isGoogleShoppingUrl);
  const directUrl = [product.productUrl, product.retailerUrl].find(isDirectRetailerUrl) || '';

  return {
    ...product,
    retailerUrl: isDirectRetailerUrl(product.retailerUrl) ? product.retailerUrl : directUrl,
    productUrl: isDirectRetailerUrl(product.productUrl) ? product.productUrl : directUrl || undefined,
    googleShoppingUrl: product.googleShoppingUrl || googleUrl || undefined,
    fallbackUrl: product.fallbackUrl || googleUrl || undefined,
    metadata: {
      ...(product.metadata || {}),
      googleShoppingUrl: product.googleShoppingUrl || googleUrl || product.metadata?.googleShoppingUrl,
      fallbackUrl: product.fallbackUrl || googleUrl || product.metadata?.fallbackUrl,
    },
  };
}

function dedupeProducts(products: Product[]): Product[] {
  const output: Product[] = [];
  const idIndex = new Map<string, number>();
  const keyIndex = new Map<string, number>();
  const urlIndex = new Map<string, number>();

  for (const product of products) {
    const candidate = sanitizeGeneratedProduct(product);
    const keys = [candidate.id ? idIndex.get(candidate.id) : undefined, keyIndex.get(productKey(candidate)), urlIndex.get(urlKey(candidate))]
      .filter((index): index is number => typeof index === 'number');
    const existingIndex = keys[0];

    if (typeof existingIndex === 'number') {
      output[existingIndex] = mergeProducts(output[existingIndex], candidate);
    } else {
      output.push(candidate);
    }

    const index = typeof existingIndex === 'number' ? existingIndex : output.length - 1;
    const merged = output[index];
    if (merged.id) idIndex.set(merged.id, index);
    keyIndex.set(productKey(merged), index);
    const url = urlKey(merged);
    if (url) urlIndex.set(url, index);
  }

  return output;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function timestampForBackup(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

async function backupGeneratedCatalog(): Promise<string | null> {
  try {
    await readFile(OUTPUT_PATH, 'utf8');
  } catch {
    return null;
  }

  const backupPath = path.resolve(
    path.dirname(OUTPUT_PATH),
    `generated-catalog.backup-${timestampForBackup()}.json`,
  );
  await copyFile(OUTPUT_PATH, backupPath);
  return backupPath;
}

function extractResults(data: SearchApiPayload): SearchApiShoppingResult[] {
  return [
    ...(Array.isArray(data.shopping_results) ? data.shopping_results : []),
    ...(Array.isArray(data.popular_products) ? data.popular_products : []),
    ...(Array.isArray(data.organic_results) ? data.organic_results : []),
  ];
}

function summarizeRawResult(result: SearchApiShoppingResult): Record<string, unknown> {
  const product = isRecord(result.product) ? result.product : undefined;
  return {
    title: firstString(result.title, result.name, product?.title, product?.name),
    link: firstString(result.link),
    product_link: firstString(result.product_link, product?.product_link, product?.link),
    source_link: firstString(result.source_link, product?.source_link),
    sourceUrl: firstString(result.source_url, result.sourceUrl, result.merchant_link, result.seller_link, result.serpapi_link, result.google_product_link, product?.source_url, product?.sourceUrl),
    source: firstString(result.source, result.merchant, result.seller, product?.source, product?.merchant, product?.seller),
    retailer: firstString(result.retailer, result.store, product?.retailer, product?.store),
    price: firstString(result.price, product?.price),
    extracted_price: result.extracted_price ?? product?.extracted_price,
    thumbnail: firstString(result.thumbnail, product?.thumbnail),
    image: firstString(result.image, product?.image),
    product: product
      ? {
          keys: Object.keys(product).slice(0, 20),
          title: firstString(product.title, product.name),
          link: firstString(product.link, product.product_link, product.source_link),
          price: firstString(product.price),
          thumbnail: firstString(product.thumbnail),
          image: firstString(product.image),
        }
      : undefined,
  };
}

function printSearchApiDebug(data: SearchApiPayload, results: SearchApiShoppingResult[]): void {
  console.log('\nDEBUG SearchAPI response');
  console.log(`Top-level keys: ${Object.keys(data).join(', ') || '(none)'}`);
  console.log(`shopping_results exists: ${Array.isArray(data.shopping_results)} (${Array.isArray(data.shopping_results) ? data.shopping_results.length : 0})`);
  console.log(`organic_results exists: ${Array.isArray(data.organic_results)} (${Array.isArray(data.organic_results) ? data.organic_results.length : 0})`);
  console.log('First 3 raw results:');
  results.slice(0, 3).forEach((result, index) => {
    console.log(`  [${index + 1}] ${JSON.stringify(summarizeRawResult(result), null, 2)}`);
  });
}

async function searchShoppingRaw(query: string): Promise<{ data: SearchApiPayload; results: SearchApiShoppingResult[] }> {
  const apiKey = process.env.SEARCHAPI_KEY?.trim();
  if (!apiKey) throw new Error('SEARCHAPI_KEY is missing');

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    hl: 'en',
    gl: 'us',
    location: 'United States',
  });

  const response = await fetch(`${SEARCHAPI_ENDPOINT}?${params.toString()}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) throw new Error(`searchapi ${response.status}`);
  const data = await response.json() as SearchApiPayload;
  return { data, results: extractResults(data) };
}

function getTitle(result: SearchApiShoppingResult): string {
  return firstString(result.title, result.name, nestedString(result, 'title'), nestedString(result, 'name'));
}

function getImageUrl(result: SearchApiShoppingResult): string {
  return firstString(result.image, result.thumbnail, nestedString(result, 'image'), nestedString(result, 'thumbnail'));
}

function getUrlCandidates(result: SearchApiShoppingResult): string[] {
  return [
    firstString(result.source_link, nestedString(result, 'source_link')),
    firstString(
      result.source_url,
      result.sourceUrl,
      result.merchant_link,
      result.seller_link,
      nestedString(result, 'source_url'),
      nestedString(result, 'sourceUrl'),
      nestedString(result, 'merchant_link'),
      nestedString(result, 'seller_link'),
    ),
    firstString(result.link, nestedString(result, 'link')),
    firstString(result.product_link, nestedString(result, 'product_link')),
  ];
}

function getProductUrls(result: SearchApiShoppingResult): { directUrl: string; googleShoppingUrl: string; fallbackUrl: string } {
  const candidates = getUrlCandidates(result).filter(isUsableUrl);
  const directUrl = candidates.find(isDirectRetailerUrl) || '';
  const googleShoppingUrl = candidates.find(isGoogleShoppingUrl) || '';

  return {
    directUrl,
    googleShoppingUrl,
    fallbackUrl: directUrl || googleShoppingUrl,
  };
}

function getRetailer(result: SearchApiShoppingResult, retailerUrl: string): string {
  const host = safeHostname(retailerUrl);
  return firstString(
    result.source,
    result.merchant,
    result.seller,
    nestedString(result, 'source'),
    nestedString(result, 'merchant'),
    nestedString(result, 'seller'),
    host || undefined,
  );
}

function getPrice(result: SearchApiShoppingResult): number {
  return firstNumber(
    result.extracted_price,
    result.price,
    nestedString(result, 'extracted_price'),
    nestedString(result, 'price'),
  ) ?? 0;
}

function makeEmptyCounts(): RejectionCounts {
  return {
    rejectedNoTitle: 0,
    rejectedNoUrl: 0,
    rejectedNoImage: 0,
    rejectedDuplicate: 0,
    rejectedWrongCategory: 0,
    acceptedDirectUrl: 0,
    acceptedGoogleFallback: 0,
    accepted: 0,
  };
}

function addCounts(target: RejectionCounts, source: RejectionCounts): void {
  target.rejectedNoTitle += source.rejectedNoTitle;
  target.rejectedNoUrl += source.rejectedNoUrl;
  target.rejectedNoImage += source.rejectedNoImage;
  target.rejectedDuplicate += source.rejectedDuplicate;
  target.rejectedWrongCategory += source.rejectedWrongCategory;
  target.acceptedDirectUrl += source.acceptedDirectUrl;
  target.acceptedGoogleFallback += source.acceptedGoogleFallback;
  target.accepted += source.accepted;
}

function toProduct(result: SearchApiShoppingResult, plan: SearchPlanItem, options: { requireImage: boolean }, counts: RejectionCounts): Product | null {
  const title = getTitle(result);
  const imageUrl = getImageUrl(result);
  const price = getPrice(result);
  const urls = getProductUrls(result);
  const retailerUrl = urls.directUrl;
  const host = safeHostname(retailerUrl);
  const retailer = getRetailer(result, retailerUrl || urls.googleShoppingUrl);
  const category = inferCategory(title, plan);
  const urlDecision: UrlDecision = urls.directUrl ? 'direct' : 'googleFallback';

  if (!title) {
    counts.rejectedNoTitle += 1;
    return null;
  }
  if (!urls.directUrl && !urls.googleShoppingUrl) {
    counts.rejectedNoUrl += 1;
    return null;
  }
  if (options.requireImage && !isGoodImage(imageUrl)) {
    counts.rejectedNoImage += 1;
    return null;
  }
  if (!category) {
    counts.rejectedWrongCategory += 1;
    return null;
  }
  const usableImageUrl = isGoodImage(imageUrl) ? imageUrl : '';

  const brand = inferBrand(title, retailer);
  const name = title;
  const colors = inferColors(`${title} ${plan.query}`);
  const sourceQuery = plan.query;
  const searchTerms = Array.from(new Set(normalize(plan.query).split(/\s+/).filter(Boolean)));
  const popularityScore = Math.min(100, Math.round((result.rating || 0) * 12 + Math.log10((result.reviews || 0) + 1) * 18));
  const idSeed = [category, normalize(brand), normalize(name), result.product_id || '', retailerUrl || urls.googleShoppingUrl].filter(Boolean).join('::');
  if (urlDecision === 'googleFallback') counts.acceptedGoogleFallback += 1;
  else counts.acceptedDirectUrl += 1;

  return {
    id: `generated-${crypto.createHash('sha1').update(idSeed).digest('hex').slice(0, 16)}`,
    brand,
    name,
    category,
    priceCents: Math.round(price * 100),
    currency: 'USD',
    retailer,
    retailerUrl,
    productUrl: retailerUrl || undefined,
    googleShoppingUrl: urls.googleShoppingUrl || undefined,
    fallbackUrl: urls.googleShoppingUrl || undefined,
    imageUrl: usableImageUrl,
    imageOriginalUrl: usableImageUrl,
    trusted: true,
    vibes: plan.targetVibes,
    occasions: plan.targetOccasions,
    colors,
    gender: plan.targetGender,
    searchTerms,
    sourceQuery,
    imageQuality: usableImageUrl ? 'good' : 'missing',
    popularityScore,
    metadata: {
      source: 'generated_catalog',
      sourceQuery,
      colors,
      styles: plan.targetVibes,
      vibes: plan.targetVibes,
      occasions: plan.targetOccasions,
      gender: plan.targetGender,
      keywords: searchTerms,
      searchTerms,
      imageQuality: usableImageUrl ? 'good' : 'missing',
      popularityScore,
      searchapiProductId: result.product_id,
      searchapiProductToken: result.product_token,
      retailerHost: host,
      googleShoppingUrl: urls.googleShoppingUrl || undefined,
      fallbackUrl: urls.googleShoppingUrl || undefined,
    },
  };
}

function acceptProducts(raw: SearchApiShoppingResult[], plan: SearchPlanItem, existingProducts: Product[]): { accepted: Product[]; counts: RejectionCounts } {
  const counts = makeEmptyCounts();
  const seen = new Set<string>();
  const output: Product[] = [];
  const requireImage = raw.some((result) => isGoodImage(getImageUrl(result)));

  for (const product of existingProducts) {
    seen.add(product.id);
    seen.add(productKey(product));
  }

  for (const result of raw) {
    const product = toProduct(result, plan, { requireImage }, counts);
    if (!product) continue;

    const keys = [product.id, productKey(product), product.productUrl || product.retailerUrl || product.googleShoppingUrl || product.fallbackUrl]
      .filter((key): key is string => typeof key === 'string' && Boolean(key));
    if (keys.some((key) => seen.has(key))) {
      counts.rejectedDuplicate += 1;
      continue;
    }

    keys.forEach((key) => seen.add(key));
    output.push(product);
    counts.accepted += 1;
    if (output.length >= RESULTS_PER_QUERY) break;
  }

  return { accepted: output, counts };
}

function countByCategory(products: Product[]): Record<Category, number> {
  const counts = Object.fromEntries(Object.keys(CATEGORY_TARGETS).map((category) => [category, 0])) as Record<Category, number>;
  for (const product of products) counts[product.category] += 1;
  return counts;
}

function hasGaps(products: Product[], plan: SearchPlanItem): boolean {
  if (!plan.gapOnly) return true;
  const counts = countByCategory(products);
  return plan.targetCategories.some((category) => counts[category] < CATEGORY_TARGETS[category]);
}

function printSummary(label: string, products: Product[]): void {
  const categoryCounts = countByCategory(products);
  const vibeCounts = new Map<string, number>();

  for (const product of products) {
    const vibes = Array.isArray(product.metadata?.vibes) ? product.metadata.vibes as string[] : product.vibes || [];
    for (const vibe of vibes) vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
  }

  console.log(`\n${label}`);
  console.log('By category:');
  Object.entries(categoryCounts).forEach(([category, count]) => console.log(`  ${category}: ${count}`));
  console.log('By vibe/topic:');
  Array.from(vibeCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .forEach(([vibe, count]) => console.log(`  ${vibe}: ${count}`));
}

const existing = await readJson<Product[]>(OUTPUT_PATH, []);
const existingCatalog = await readJson<Product[]>(PHOTO_CATALOG_PATH, []);
const collected: Product[] = [];
let searchesUsed = 0;
let debugPrinted = false;
const totalCounts = makeEmptyCounts();

console.log(`Catalog expansion scope: ${SEARCH_SCOPE === 'all' ? 'all' : 'missing-vibes'}`);
console.log(`Search limit: ${MAX_SEARCHES}`);

for (const plan of ACTIVE_SEARCH_PLAN) {
  const mergedSoFar = dedupeProducts([...existingCatalog, ...existing, ...collected]);
  if (searchesUsed >= MAX_SEARCHES) break;
  if (plan.gapOnly && !hasGaps(mergedSoFar, plan)) continue;

  if (DRY_RUN) {
    searchesUsed += 1;
    console.log(`DRY [${plan.id}] ${plan.query}`);
    continue;
  }

  try {
    const { data, results: raw } = await searchShoppingRaw(plan.query);
    searchesUsed += 1;
    if (DEBUG_SEARCHAPI && !debugPrinted) {
      printSearchApiDebug(data, raw);
      debugPrinted = true;
    }

    const { accepted, counts } = acceptProducts(raw, plan, mergedSoFar);
    addCounts(totalCounts, counts);

    collected.push(...accepted);
    console.log(`OK   [${plan.id}] ${plan.query} -> ${accepted.length} accepted`);
    console.log(
      `     rejections: noTitle=${counts.rejectedNoTitle}, noUrl=${counts.rejectedNoUrl}, noImage=${counts.rejectedNoImage}, duplicate=${counts.rejectedDuplicate}, wrongCategory=${counts.rejectedWrongCategory}, directAccepted=${counts.acceptedDirectUrl}, googleFallbackAccepted=${counts.acceptedGoogleFallback}, accepted=${counts.accepted}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`WARN [${plan.id}] ${plan.query} -> ${message}`);
    if (/SEARCHAPI_KEY is missing|searchapi 429/i.test(message)) break;
  }
}

const acceptedThisRun = dedupeProducts(collected);
const merged = dedupeProducts([...existing, ...collected]).sort((left, right) => {
  if (left.category !== right.category) return left.category.localeCompare(right.category);
  if (left.brand !== right.brand) return left.brand.localeCompare(right.brand);
  return left.name.localeCompare(right.name);
});

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
if (!DRY_RUN && acceptedThisRun.length) {
  const backupPath = await backupGeneratedCatalog();
  if (backupPath) console.log(`Created backup: ${backupPath}`);
  await writeFile(OUTPUT_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
} else if (!DRY_RUN) {
  console.log('No accepted products; preserved existing generated catalog without rewriting.');
}

console.log(`\nSearchAPI searches used: ${searchesUsed}`);
console.log(`Accepted products this run: ${acceptedThisRun.length}`);
console.log(`Direct URL products accepted: ${totalCounts.acceptedDirectUrl}`);
console.log(`Google fallback products accepted: ${totalCounts.acceptedGoogleFallback}`);
console.log(`Products rejected with no shopping URL: ${totalCounts.rejectedNoUrl}`);
if (!DRY_RUN && acceptedThisRun.length) console.log(`Wrote ${merged.length} products to ${OUTPUT_PATH}`);
if (acceptedThisRun.length) printSummary('Accepted products this run', acceptedThisRun);
printSummary('Generated catalog coverage', merged);
