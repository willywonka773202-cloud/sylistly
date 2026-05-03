import type { Product } from './types';

const BAD_IMAGE_URL_TERMS = [
  'placeholder',
  'place-holder',
  'no-image',
  'no_image',
  'noimage',
  'image-coming-soon',
  'coming-soon',
  'blank',
  'transparent',
  'missing',
  'default-product',
  'default_image',
  'defaultimage',
  'fallback',
  'spacer',
  'pixel',
  '1x1',
  'grey.gif',
  'gray.gif',
  'loading',
  'skeleton',
  'no_photo',
  'nophoto',
  'not-available',
  'not_available',
  'image-not-found',
  'image_not_found',
  'product-image-missing',
];

const BLOCKED_IMAGE_URL_SUBSTRINGS = [
  'gray-cloth',
  'grey-cloth',
  'gray_cloth',
  'grey_cloth',
  'cloth-placeholder',
  'placeholder-cloth',
  'fabric-swatch',
  'cloth-swatch',
  'material-swatch',
  'textile-swatch',
  'blank-fabric',
  'draped-cloth',
  'plain-cloth',
  'gray-fabric',
  'grey-fabric',
  'fabric-placeholder',
  'swatch-placeholder',
  'draped-fabric',
  'plain-fabric',
  'wrinkled-cloth',
  'wrinkled-fabric',
  'cloth-texture',
  'fabric-texture',
];

const BLOCKED_PRODUCT_ID_SUBSTRINGS = [
  'gray-cloth',
  'grey-cloth',
  'placeholder-cloth',
  'fabric-swatch',
  'cloth-swatch',
  'fabric-placeholder',
  'swatch-placeholder',
];

const LOW_INFORMATION_PRODUCT_TERMS = [
  'fabric swatch',
  'cloth swatch',
  'material swatch',
  'textile swatch',
  'fabric sample',
  'cloth sample',
  'material sample',
  'gray cloth',
  'grey cloth',
  'draped cloth',
  'plain cloth',
  'blank cloth',
  'fabric by the yard',
  'yard fabric',
  'solid fabric',
  'linen fabric',
  'cotton fabric',
  'polyester fabric',
  'unfinished fabric',
  'fabric only',
  'cloth only',
  'remnant fabric',
  'fabric remnant',
  'sewing fabric',
  'upholstery fabric',
  'drapery fabric',
  'curtain fabric',
  'quilting fabric',
  'by the metre',
  'by the meter',
  'by the yard',
  'flat cloth',
  'floor cloth',
  'grey textile',
  'gray textile',
];

const MARKETPLACE_TERMS = [
  'poshmark',
  'ebay',
  'etsy',
  'depop',
  'mercari',
  'grailed',
  'thredup',
  'vestiaire',
  'stockx',
  'goat',
];

const LOW_QUALITY_LISTING_TERMS = [
  'pre-owned',
  'pre owned',
  'used',
  'vintage',
  'bundle',
  'lot of',
  'floor',
  'flat lay',
  'flatlay',
  'wrinkled',
  'stain',
  'stained',
  'flaw',
  'distressed condition',
  'closet',
  'resale',
  'secondhand',
  'thrifted',
  'thrift',
  'authentic used',
  'worn once',
  'minor wear',
  'inventory photo',
  'stock photo only',
  'see photos',
  'actual item',
  'photo 1',
];

const PREFERRED_RETAILER_TERMS = [
  'nordstrom',
  'ssense',
  'farfetch',
  'mr porter',
  'net-a-porter',
  'revolve',
  'aritzia',
  'zara',
  'hm',
  'h&m',
  'uniqlo',
  'cos',
  'everlane',
  'nike',
  'adidas',
  'new balance',
  'j.crew',
  'madewell',
  'urban outfitters',
  'asos',
  'mango',
  'gap',
  'banana republic',
  'abercrombie',
  'levi',
  'levi\'s',
  'levi’s',
  'jcrew',
  'anthropologie',
  'free people',
  'lululemon',
  'alo',
  'a&f',
  'massimo dutti',
  'reiss',
  'coach',
  'miansai',
  'mejuri',
  'missoma',
  'swarovski',
  'ray-ban',
  'ray ban',
  'gentle monster',
  'warby parker',
  'oakley',
];

const KNOWN_EYEWEAR_TERMS = [
  'ray ban',
  'ray-ban',
  'oakley',
  'warby parker',
  'gentle monster',
  'quay',
  'persol',
  'prada eyewear',
  'versace eyewear',
  'versace',
  'gucci eyewear',
  'gucci',
  'tom ford eyewear',
  'tom ford',
];

const KNOWN_JEWELRY_TERMS = [
  'miansai',
  'mejuri',
  'missoma',
  'swarovski',
  'vitaly',
  'tiffany',
  'david yurman',
  'monica vinader',
  'pandora',
  'ana luisa',
  'gorjana',
  'kendra scott',
  'jewelry',
  'jewellery',
];

const CATEGORY_POSITIVE_TERMS: Record<Product['category'], string[]> = {
  hat: ['cap', 'hat', 'beanie', 'bucket', 'headband', 'visor', 'beret'],
  outer: ['jacket', 'coat', 'blazer', 'cardigan', 'puffer', 'hoodie', 'overshirt', 'trench', 'bomber', 'parka', 'shell', 'vest'],
  top: ['shirt', 'tee', 't shirt', 't-shirt', 'top', 'tank', 'polo', 'sweater', 'hoodie', 'cardigan', 'blouse', 'cami', 'knit'],
  bottom: ['pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'cargo', 'chino', 'legging', 'leggings', 'sweatpant', 'sweatpants', 'jogger', 'joggers'],
  shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'loafer', 'loafers', 'boot', 'boots', 'heel', 'heels', 'sandal', 'sandals', 'clog', 'flat', 'pump'],
  bag: ['bag', 'tote', 'backpack', 'crossbody', 'shoulder', 'duffel', 'purse', 'handbag', 'satchel', 'clutch', 'hobo'],
  eyewear: ['sunglasses', 'glasses', 'eyeglasses', 'eyewear', 'shades', 'frames'],
  jewelry: ['necklace', 'bracelet', 'ring', 'rings', 'earring', 'earrings', 'hoop', 'hoops', 'chain', 'pendant', 'jewelry', 'jewellery', 'stud', 'studs', 'huggie', 'bangle', 'cuff', 'charm', 'watch'],
};

const CATEGORY_CONFLICT_TERMS: Record<Product['category'], string[]> = {
  hat: ['jacket', 'coat', 'pants', 'trouser', 'shoes', 'sneaker', 'bag', 'dress'],
  outer: ['shoes', 'sneaker', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'necklace', 'ring'],
  top: ['pants', 'trouser', 'jeans', 'shorts', 'skirt', 'shoes', 'sneaker', 'bag', 'tote', 'necklace', 'sunglasses'],
  bottom: ['jacket', 'coat', 'shirt', 'tee', 'shoes', 'sneaker', 'bag', 'tote', 'necklace', 'sunglasses'],
  shoes: ['shirt', 'jacket', 'coat', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'necklace', 'sunglasses'],
  bag: ['shoes', 'sneaker', 'pants', 'trouser', 'jeans', 'jacket', 'coat', 'necklace', 'sunglasses'],
  eyewear: ['shirt', 'jacket', 'pants', 'shoes', 'bag', 'necklace'],
  jewelry: ['shirt', 'jacket', 'pants', 'shoes', 'bag', 'sunglasses'],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasAnyText(text: string, terms: string[]): boolean {
  const padded = ` ${normalize(text)} `;
  return terms.some((term) => padded.includes(` ${normalize(term)} `));
}

export function hasUsableImageUrl(imageUrl?: string | null): boolean {
  if (!imageUrl || typeof imageUrl !== 'string') return false;
  const trimmed = imageUrl.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();

  if (normalized.startsWith('data:image/svg+xml')) return false;
  if (normalized.startsWith('data:image/gif') && (normalized.includes('r0lgod') || normalized.includes('transparent'))) return false;
  if (normalized.startsWith('data:')) return false;
  if (normalized === '#' || normalized === 'about:blank') return false;
  if (BAD_IMAGE_URL_TERMS.some((term) => normalized.includes(term))) return false;
  if (BLOCKED_IMAGE_URL_SUBSTRINGS.some((term) => normalized.includes(term))) return false;
  if (normalized.includes('/svg/') || normalized.endsWith('.svg')) return false;
  if (normalized.includes('blank.gif') || normalized.includes('empty.gif')) return false;

  return normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('/');
}

function productImageContext(product: Product): string {
  return [
    product.id,
    product.name,
    product.brand,
    product.retailer,
    product.imageUrl,
    product.productUrl,
    product.retailerUrl,
    product.googleShoppingUrl,
    product.fallbackUrl,
    ...(product.searchTerms || []),
    ...(product.colors || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function productCategoryContext(product: Product): string {
  return [
    product.name,
    product.brand,
    product.retailer,
    product.sourceQuery,
    ...(product.searchTerms || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.colors || []),
  ]
    .filter(Boolean)
    .join(' ');
}

export function isBlockedProductImage(product?: Product | null): boolean {
  if (!product) return true;
  const context = productImageContext(product);
  if (BLOCKED_PRODUCT_ID_SUBSTRINGS.some((term) => String(product.id).toLowerCase().includes(term))) return true;
  if (BLOCKED_IMAGE_URL_SUBSTRINGS.some((term) => context.includes(term))) return true;
  if (LOW_INFORMATION_PRODUCT_TERMS.some((term) => context.includes(term))) return true;
  return false;
}

export function hasUsableProductImage(product?: Product | null): product is Product {
  if (!product) return false;
  if (product.imageQuality === 'missing') return false;
  if (isBlockedProductImage(product)) return false;
  return hasUsableImageUrl(product.imageUrl);
}

export function categoryMatchScore(product: Product): number {
  const context = productCategoryContext(product);
  const positives = CATEGORY_POSITIVE_TERMS[product.category] || [];
  const conflicts = CATEGORY_CONFLICT_TERMS[product.category] || [];
  const hasPositive = hasAnyText(context, positives);
  const hasConflict = hasAnyText(context, conflicts);
  const hasKnownEyewear = product.category === 'eyewear' && hasAnyText(context, KNOWN_EYEWEAR_TERMS);
  const hasKnownJewelry = product.category === 'jewelry' && hasAnyText(context, KNOWN_JEWELRY_TERMS);

  if (product.category === 'eyewear') return hasPositive || hasKnownEyewear ? 34 : -120;
  if (product.category === 'jewelry') return hasPositive || hasKnownJewelry ? 34 : -120;
  if (product.category === 'hat') return hasPositive ? 28 : hasConflict ? -95 : -18;
  if (hasPositive && !hasConflict) return 28;
  if (hasPositive && hasConflict) return -18;
  if (hasConflict) return -100;
  return -12;
}

export function hasCategoryTitleMismatch(product: Product): boolean {
  return categoryMatchScore(product) <= -95;
}

export function isRenderableProduct(product?: Product | null): product is Product {
  return Boolean(
    product
    && product.id
    && product.brand?.trim()
    && product.name?.trim()
    && product.category
    && hasUsableProductImage(product),
  );
}

export function filterRenderableProducts(products: Product[]): Product[] {
  return products.filter(isRenderableProduct);
}

function productQualityText(product: Product): string {
  return [
    product.name,
    product.brand,
    product.retailer,
    product.productUrl,
    product.retailerUrl,
    product.googleShoppingUrl,
    product.fallbackUrl,
    ...(product.searchTerms || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function queryTokens(query: string): string[] {
  const stopwords = new Set(['the', 'and', 'for', 'with', 'mens', 'womens', 'men', 'women']);
  const tokens = normalize(query)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
  return Array.from(new Set(tokens.flatMap((token) => {
    if (token.endsWith('ies') && token.length > 4) return [token, `${token.slice(0, -3)}y`];
    if (token.endsWith('s') && token.length > 4) return [token, token.slice(0, -1)];
    return [token];
  })));
}

const QUERY_STYLE_TERMS: Record<Product['category'], string[]> = {
  hat: ['cap', 'hat', 'beanie', 'bucket', 'headband', 'visor'],
  outer: ['bomber', 'puffer', 'blazer', 'trench', 'coat', 'jacket', 'cardigan', 'parka', 'shell', 'leather'],
  top: ['polo', 'knit', 'sweater', 'tee', 'shirt', 'tank', 'cami', 'hoodie', 'blouse', 'button'],
  bottom: ['trouser', 'pant', 'jean', 'short', 'skirt', 'cargo', 'chino', 'legging', 'jogger', 'sweatpant'],
  shoes: ['loafer', 'sneaker', 'boot', 'heel', 'sandal', 'clog', 'flat', 'pump', 'slide', 'mule'],
  bag: ['tote', 'crossbody', 'shoulder', 'backpack', 'duffel', 'clutch', 'satchel', 'hobo'],
  eyewear: ['sunglasses', 'glasses', 'eyewear', 'shades', 'frames'],
  jewelry: ['necklace', 'bracelet', 'ring', 'earring', 'hoop', 'chain', 'pendant', 'watch'],
};

const QUERY_GENERIC_TERMS: Partial<Record<Product['category'], string[]>> = {
  hat: ['hat'],
  outer: ['jacket', 'coat'],
  top: ['top', 'shirt'],
  bottom: ['pant', 'pants'],
  shoes: ['shoe', 'shoes'],
  bag: ['bag'],
  eyewear: ['glasses', 'eyewear'],
  jewelry: ['jewelry', 'jewellery'],
};

function querySpecificTerms(query: string, category?: Product['category']): string[] {
  const tokens = queryTokens(query);
  if (!category) return tokens;
  const styleTerms = QUERY_STYLE_TERMS[category] || [];
  const specific = tokens.filter((token) => styleTerms.includes(token));
  const generic = new Set(QUERY_GENERIC_TERMS[category] || []);
  const nonGeneric = specific.filter((token) => !generic.has(token));
  return nonGeneric.length ? nonGeneric : specific;
}

function matchesQuerySpecificity(product: Product, query: string, category?: Product['category']): boolean {
  const terms = querySpecificTerms(query, category);
  if (!terms.length) return true;
  const text = normalize(productQualityText(product));
  return terms.some((term) => text.includes(term));
}

export function productImageQualityScore(product: Product): number {
  const text = productQualityText(product);
  let score = 0;

  if (isBlockedProductImage(product)) return -999;
  if (hasCategoryTitleMismatch(product)) return -240;

  if (product.imageQuality === 'good') score += 18;
  if (product.imageQuality === 'ok') score += 6;
  if (hasUsableImageUrl(product.imageUrl)) score += 20;
  score += categoryMatchScore(product);
  if (product.productUrl || product.retailerUrl) score += 14;
  if (product.priceCents > 0) score += 4;
  if ((product.vibes?.length || 0) + (product.searchTerms?.length || 0) >= 3) score += 4;
  if ((product.gender?.length || 0) > 0) score += 3;

  if (PREFERRED_RETAILER_TERMS.some((term) => text.includes(term))) score += 18;
  if (MARKETPLACE_TERMS.some((term) => text.includes(term))) score -= 34;
  if (LOW_QUALITY_LISTING_TERMS.some((term) => text.includes(term))) score -= 22;
  if (LOW_INFORMATION_PRODUCT_TERMS.some((term) => text.includes(term))) score -= 80;
  if (text.includes('encrypted-tbn') && MARKETPLACE_TERMS.some((term) => text.includes(term))) score -= 8;
  if (text.includes('google.com/shopping') || text.includes('#oshopproduct')) score -= 8;

  return score;
}

export const getProductImageQualityScore = productImageQualityScore;

export function sortImageBackedProducts(products: Product[]): Product[] {
  const renderable = filterRenderableProducts(products)
    .map((product, index) => ({ product, index, score: productImageQualityScore(product) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const preferred = renderable.filter((entry) => entry.score >= 0);
  const pool = preferred.length >= 5 ? preferred : renderable;
  return pool.map((entry) => entry.product);
}

export function searchResultQualityScore(product: Product, query = '', category?: Product['category']): number {
  const text = normalize(productQualityText(product));
  const normalizedQuery = normalize(query);
  const tokens = queryTokens(query);
  let score = productImageQualityScore(product);

  if (category && product.category === category) score += 36;
  if (normalizedQuery && text.includes(normalizedQuery)) score += 90;
  for (const token of tokens) {
    if (text.includes(token)) score += 42;
  }

  const positives = CATEGORY_POSITIVE_TERMS[product.category] || [];
  for (const term of positives) {
    if (tokens.includes(normalize(term))) score += 18;
  }

  return score;
}

export function sortSearchResultProducts(products: Product[], query = '', category?: Product['category']): Product[] {
  const renderableProducts = filterRenderableProducts(products);
  const specificMatches = renderableProducts.filter((product) => matchesQuerySpecificity(product, query, category));
  const specificTerms = querySpecificTerms(query, category);
  if (specificTerms.length && !specificMatches.length) return [];
  const rankingPool = specificTerms.length ? specificMatches : renderableProducts;
  const renderable = rankingPool
    .map((product, index) => ({
      product,
      index,
      score: searchResultQualityScore(product, query, category),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const preferred = renderable.filter((entry) => entry.score >= 0);
  const pool = preferred.length >= 5 ? preferred : renderable;
  return pool.map((entry) => entry.product);
}

export function isHighConfidenceRenderableProduct(product?: Product | null): product is Product {
  return isRenderableProduct(product) && productImageQualityScore(product) > -25;
}

export function filterHighConfidenceProducts(products: Product[]): Product[] {
  const highConfidence = products.filter(isHighConfidenceRenderableProduct);
  return highConfidence.length ? highConfidence : filterRenderableProducts(products);
}
