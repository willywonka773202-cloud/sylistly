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
  '1x1.',
  'grey.gif',
  'gray.gif',
  'loading',
  'skeleton',
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
  'fabric-closeup',
  'fabric-close-up',
  'cloth-closeup',
  'cloth-close-up',
  'wrinkled-cloth',
  'folded-cloth',
  'textile-closeup',
  'textile-close-up',
];

const BLOCKED_PRODUCT_ID_SUBSTRINGS = [
  'gray-cloth',
  'grey-cloth',
  'placeholder-cloth',
  'fabric-swatch',
  'cloth-swatch',
];

/**
 * Intimates / sleepwear / lingerie / loose-bodywear keywords that read as
 * "underwear-style image" rather than a wearable normal-outfit top or
 * bottom. Products matching these terms can still live in the catalog —
 * they're just not allowed to fill required slots on a normal /feed card
 * (the user complaint was bras and lace sets rendering as a "bottom" or
 * sole top in clean/travel/casual feed posts).
 *
 * Sports-bra is intentionally NOT here — it's a valid gym/athletic top and
 * is handled by vibe rules elsewhere. Pure-fashion items that happen to
 * contain 'bra' as a substring ("bracelet", "abracadabra") are protected
 * by hasAnyTerm's whole-word matching.
 */
const INTIMATES_SLEEPWEAR_TERMS = [
  'lingerie', 'intimate', 'intimates',
  'thong', 'panty', 'panties',
  'underwear', 'undergarment', 'undergarments',
  'boyshort', 'boyshorts',
  'g string', 'g-string',
  'lace bra', 'push up bra', 'padded bra', 'wireless bra', 'underwire bra',
  'corset lingerie', 'lace set', 'lingerie set',
  'pajama', 'pajamas', 'pyjama', 'pyjamas', 'pjs',
  'sleepwear', 'nightgown', 'nightie', 'nightshirt',
  'bikini bottom', 'bikini set', 'swim brief', 'swim briefs',
];

/**
 * Generic visual-weakness signals beyond fabric-closeup / placeholder
 * already covered above. These indicate products whose image is more
 * likely a detail crop or a body-part photo than a clean product shot.
 */
const VISUALLY_WEAK_PRODUCT_TERMS = [
  'detail shot', 'close up of', 'closeup of',
  'fabric detail', 'fabric texture', 'texture detail',
  'body part', 'body shot', 'cropped body',
  'macro shot', 'macro photo',
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
  'fabric closeup',
  'fabric close up',
  'cloth closeup',
  'cloth close up',
  'textile closeup',
  'textile close up',
  'material closeup',
  'material close up',
  'folded cloth',
  'folded fabric',
  'wrinkled cloth',
  'wrinkled fabric',
  'blank fabric',
  'plain fabric',
  'placeholder fabric',
  'flat fabric photo',
  'fabric only',
  'clothing fabric only',
  'texture image',
  'unresolved product photo',
];

const FEED_BLOCKED_PRODUCT_TERMS = [
  ...LOW_INFORMATION_PRODUCT_TERMS,
  ...INTIMATES_SLEEPWEAR_TERMS,
  ...VISUALLY_WEAK_PRODUCT_TERMS,
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
];

const KNOWN_EYEWEAR_BRANDS = ['ray ban', 'ray-ban', 'oakley', 'warby parker', 'gentle monster', 'quay', 'prada eyewear', 'versace eyewear'];

const CATEGORY_CONFLICT_TERMS: Record<Product['category'], string[]> = {
  shoes: ['shirt', 'jacket', 'coat', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote', 'necklace', 'sunglasses'],
  top: ['shoes', 'sneaker', 'boot', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote', 'necklace', 'sunglasses'],
  bottom: ['shirt', 'tee', 'jacket', 'coat', 'shoes', 'sneaker', 'boot', 'bag', 'tote', 'necklace', 'sunglasses'],
  outer: ['shoes', 'sneaker', 'boot', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote', 'necklace'],
  bag: ['shoes', 'sneaker', 'boot', 'pants', 'trouser', 'jeans', 'shirt', 'jacket', 'coat', 'necklace', 'sunglasses'],
  eyewear: ['shirt', 'jacket', 'pants', 'jeans', 'shoes', 'bag', 'necklace'],
  jewelry: ['shirt', 'jacket', 'pants', 'jeans', 'shoes', 'bag', 'sunglasses'],
  hat: ['jacket', 'pants', 'trouser', 'shoes', 'bag', 'necklace'],
};

const CATEGORY_REQUIRED_TERMS: Partial<Record<Product['category'], string[]>> = {
  eyewear: ['sunglasses', 'glasses', 'eyeglasses', 'eyewear', 'shades', 'frames'],
  jewelry: ['necklace', 'bracelet', 'ring', 'earring', 'earrings', 'hoop', 'chain', 'pendant', 'jewelry', 'bangle', 'cuff', 'watch'],
  hat: ['cap', 'hat', 'beanie', 'bucket', 'headband', 'skullcap'],
};

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

export function hasUsableTransparentImage(product?: Product | null): boolean {
  if (!product) return false;
  return hasUsableImageUrl(product.imageTransparentUrl || product.imageCutoutUrl);
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

function productDescriptiveContext(product: Product): string {
  return [
    product.id,
    product.name,
    product.brand,
    product.sourceQuery,
    ...(product.searchTerms || []),
    ...(product.colors || []),
    typeof product.metadata?.title === 'string' ? product.metadata.title : '',
    typeof product.metadata?.description === 'string' ? product.metadata.description : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizedText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasAnyTerm(text: string, terms: string[]): boolean {
  const normalized = normalizedText(text);
  const padded = ` ${normalized} `;
  return terms.some((term) => padded.includes(` ${normalizedText(term)} `));
}

export function isBlockedProductImage(product?: Product | null): boolean {
  if (!product) return true;
  const context = productImageContext(product);
  if (BLOCKED_PRODUCT_ID_SUBSTRINGS.some((term) => String(product.id).toLowerCase().includes(term))) return true;
  if (BLOCKED_IMAGE_URL_SUBSTRINGS.some((term) => context.includes(term))) return true;
  if (LOW_INFORMATION_PRODUCT_TERMS.some((term) => context.includes(term))) return true;
  return false;
}

export function isFeedBlockedProductImage(product?: Product | null): boolean {
  if (!product || isBlockedProductImage(product)) return true;
  const descriptive = productDescriptiveContext(product);
  const urlContext = [
    product.imageUrl,
    product.imageOriginalUrl,
    product.productUrl,
    product.retailerUrl,
    product.googleShoppingUrl,
    product.fallbackUrl,
  ].filter(Boolean).join(' ').toLowerCase();

  if (FEED_BLOCKED_PRODUCT_TERMS.some((term) => hasAnyTerm(descriptive, [term]))) return true;
  if (BLOCKED_IMAGE_URL_SUBSTRINGS.some((term) => urlContext.includes(term))) return true;
  return false;
}

/**
 * True when a product's text strongly suggests intimates/lingerie/sleepwear.
 * Used to block these items from filling normal-outfit required slots on
 * /feed cards. Sports bras (which read "sports bra" not "lace bra") are
 * NOT caught by this gate.
 */
export function isIntimatesOrSleepwear(product?: Product | null): boolean {
  if (!product) return false;
  const descriptive = productDescriptiveContext(product);
  return INTIMATES_SLEEPWEAR_TERMS.some((term) => hasAnyTerm(descriptive, [term]));
}

/**
 * True when a product's text suggests a visually weak feed card —
 * detail crops, body-part shots, macro/texture photography. These pass
 * basic renderability but render poorly as feed hero or rail products.
 */
export function isVisuallyWeakFeedProduct(product?: Product | null): boolean {
  if (!product) return false;
  const descriptive = productDescriptiveContext(product);
  return VISUALLY_WEAK_PRODUCT_TERMS.some((term) => hasAnyTerm(descriptive, [term]));
}

// Positive-whitelist term sets — a product whose category claims to be X
// but whose title/description does not include any of the X terms below is
// treated as low category confidence and blocked from feed required slots.
// Mirrors lib/catalog.ts:scoreCategoryIntegrity so the feed gate applies
// the same standard to BOTH generator-produced AND collection-derived
// feed posts (collection sanitize was bypassing the integrity score).
const NORMAL_TOP_TERMS = [
  'shirt', 't shirt', 't-shirt', 'tee', 'tank', 'top', 'blouse', 'sweater',
  'knit', 'polo', 'button down', 'button-down', 'oxford', 'cardigan',
  'hoodie', 'crewneck', 'crew neck', 'pullover', 'henley', 'turtleneck',
  'mock neck', 'mock-neck', 'long sleeve', 'short sleeve', 'jersey',
  'sweatshirt', 'cami', 'camisole',
];

const NORMAL_BOTTOM_TERMS = [
  'pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'denim',
  'short', 'shorts', 'skirt', 'cargo', 'cargos', 'chino', 'chinos',
  'legging', 'leggings', 'jogger', 'joggers', 'sweatpant', 'sweatpants',
  'culotte', 'culottes', 'slack', 'slacks', 'midi skirt', 'mini skirt',
];

const NORMAL_SHOE_TERMS = [
  'shoe', 'shoes', 'sneaker', 'sneakers', 'trainer', 'trainers',
  'loafer', 'loafers', 'boot', 'boots', 'heel', 'heels', 'sandal',
  'sandals', 'clog', 'clogs', 'mule', 'mules', 'flat', 'flats',
  'oxford', 'derby', 'wedge', 'wedges', 'slip on', 'slip-on',
  'pump', 'pumps',
  // Flagship sneaker model names that frequently appear in product titles
  // without a generic word like "sneaker". Without these the positive
  // whitelist would reject Adidas Samba / Campus / Gazelle, Nike Air Force /
  // Dunk / Jordan, New Balance 530/574/9060, Dr Martens 1460, etc. —
  // catalog flagship products that should remain feed-eligible.
  'samba', 'gazelle', 'campus', 'spezial', 'forum',
  'air force', 'air max', 'dunk', 'jordan', 'blazer mid', 'cortez',
  '530', '574', '550', '9060', '993', '2002r', '1080',
  '1460', '1461', 'jadon', 'pascal',
  'birkenstock', 'boston', 'arizona',
  'converse', 'chuck taylor', 'vans', 'authentic', 'old skool',
  'reebok', 'club c', 'classic leather',
];

const NORMAL_BAG_TERMS = [
  'bag', 'tote', 'backpack', 'crossbody', 'cross body', 'cross-body',
  'shoulder bag', 'duffel', 'duffle', 'purse', 'clutch', 'satchel',
  'messenger', 'fanny pack', 'belt bag', 'sling',
];

const NORMAL_OUTER_TERMS = [
  'jacket', 'coat', 'blazer', 'cardigan', 'puffer', 'parka',
  'hoodie', 'overshirt', 'trench', 'bomber', 'shell', 'windbreaker',
  'shacket', 'fleece', 'gilet', 'vest',
];

/**
 * Word-boundary positive-whitelist check: does the product's
 * title/description contain at least one term that confirms it really is
 * the kind of product its `category` claims it is?
 *
 * Used for the categories that have to be visually correct on every feed
 * card (top, bottom, shoes, bag, outer). Returns true (no constraint) for
 * categories without a positive whitelist defined here.
 */
function hasNormalCategoryWhitelistMatch(product: Product): boolean {
  const text = productDescriptiveContext(product);
  switch (product.category) {
    case 'top':
      return hasAnyTerm(text, NORMAL_TOP_TERMS);
    case 'bottom':
      return hasAnyTerm(text, NORMAL_BOTTOM_TERMS);
    case 'shoes':
      return hasAnyTerm(text, NORMAL_SHOE_TERMS);
    case 'bag':
      return hasAnyTerm(text, NORMAL_BAG_TERMS);
    case 'outer':
      return hasAnyTerm(text, NORMAL_OUTER_TERMS);
    default:
      return true; // hat / eyewear / jewelry handled by CATEGORY_REQUIRED_TERMS
  }
}

/**
 * True when product.category=top AND the product reads as a wearable
 * shirt/tank/sweater/etc. — NOT a bra, lingerie set, swim top, or other
 * non-normal-outfit top.
 */
export function isNormalOutfitTop(product?: Product | null): boolean {
  if (!product || product.category !== 'top') return false;
  if (isIntimatesOrSleepwear(product)) return false;
  return hasAnyTerm(productDescriptiveContext(product), NORMAL_TOP_TERMS);
}

/**
 * True when product.category=bottom AND the product reads as wearable
 * pants/jeans/trousers/shorts/skirt/leggings/joggers — NOT underwear,
 * lingerie, swim bottom, sleep shorts, etc.
 */
export function isNormalOutfitBottom(product?: Product | null): boolean {
  if (!product || product.category !== 'bottom') return false;
  if (isIntimatesOrSleepwear(product)) return false;
  return hasAnyTerm(productDescriptiveContext(product), NORMAL_BOTTOM_TERMS);
}

/**
 * True when product.category=shoes AND the product reads as actual
 * footwear — NOT a fabric closeup or accessory miscategorized as shoes.
 */
export function isNormalOutfitShoe(product?: Product | null): boolean {
  if (!product || product.category !== 'shoes') return false;
  return hasAnyTerm(productDescriptiveContext(product), NORMAL_SHOE_TERMS);
}

/**
 * Combined category-confidence check: a product really looks like what
 * its category claims it is. Returns true for high-confidence,
 * false for products that should not represent that category in feed.
 */
export function hasHighCategoryConfidence(product?: Product | null, category?: Product['category']): boolean {
  if (!product) return false;
  const targetCategory = category ?? product.category;
  if (!targetCategory) return false;
  if (product.category !== targetCategory) return false;
  if (isIntimatesOrSleepwear(product)) return false;
  if (hasFeedCategoryMismatch(product)) return false;
  if (!hasNormalCategoryWhitelistMatch(product)) {
    // hat / eyewear / jewelry use the existing CATEGORY_REQUIRED_TERMS gate
    // already enforced by hasFeedCategoryMismatch above.
    return ['hat', 'eyewear', 'jewelry'].includes(targetCategory);
  }
  return true;
}

/**
 * True when a product is a strong candidate to anchor a feed card as the
 * large hero image. Hero products should be the visual centerpiece —
 * tops, outer, and bottoms in that order; not accessories, not shoes
 * (unless explicitly a shoe-focused editorial), and never visually weak.
 */
export function isFeedHeroCandidate(product?: Product | null): boolean {
  if (!product) return false;
  if (!isRenderableProductForFeed(product)) return false;
  if (isVisuallyWeakFeedProduct(product)) return false;
  if (isIntimatesOrSleepwear(product)) return false;
  // Hero anchors: pieces large enough to fill the visual frame.
  return product.category === 'top'
    || product.category === 'outer'
    || product.category === 'bottom';
}

export function hasFeedCategoryMismatch(product: Product): boolean {
  const text = productDescriptiveContext(product);
  if (CATEGORY_CONFLICT_TERMS[product.category]?.some((term) => hasAnyTerm(text, [term]))) {
    const categoryTerm = CATEGORY_REQUIRED_TERMS[product.category]?.some((term) => hasAnyTerm(text, [term]));
    if (!categoryTerm) return true;
  }

  const requiredTerms = CATEGORY_REQUIRED_TERMS[product.category];
  if (!requiredTerms?.length) return false;
  if (product.category === 'eyewear' && hasAnyTerm(text, KNOWN_EYEWEAR_BRANDS)) return false;
  return !requiredTerms.some((term) => hasAnyTerm(text, [term]));
}

export function hasUsableProductImage(product?: Product | null): product is Product {
  if (!product) return false;
  const hasTransparent = hasUsableTransparentImage(product);
  if (product.imageQuality === 'missing' && !hasTransparent) return false;
  if (isBlockedProductImage(product) && !hasTransparent) return false;
  return hasTransparent || hasUsableImageUrl(product.imageUrl);
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

export function isRenderableProductForFeed(product?: Product | null): product is Product {
  return Boolean(
    isRenderableProduct(product)
    && !isFeedBlockedProductImage(product)
    && !hasFeedCategoryMismatch(product)
    && productImageQualityScore(product) > -20,
  );
}

export function filterRenderableProducts(products: Product[]): Product[] {
  return products.filter(isRenderableProduct);
}

export function filterFeedRenderableProducts(products: Product[]): Product[] {
  return products.filter(isRenderableProductForFeed);
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

export function productImageQualityScore(product: Product): number {
  const text = productQualityText(product);
  let score = 0;

  if (isBlockedProductImage(product)) return -999;

  if (product.imageQuality === 'good') score += 18;
  if (product.imageQuality === 'ok') score += 6;
  if (product.productUrl || product.retailerUrl) score += 14;
  if (product.priceCents > 0) score += 4;
  if ((product.vibes?.length || 0) + (product.searchTerms?.length || 0) >= 3) score += 4;

  if (PREFERRED_RETAILER_TERMS.some((term) => text.includes(term))) score += 18;
  if (MARKETPLACE_TERMS.some((term) => text.includes(term))) score -= 34;
  if (LOW_QUALITY_LISTING_TERMS.some((term) => text.includes(term))) score -= 22;
  if (LOW_INFORMATION_PRODUCT_TERMS.some((term) => text.includes(term))) score -= 80;
  if (isFeedBlockedProductImage(product)) score -= 120;
  if (hasFeedCategoryMismatch(product)) score -= 90;
  if (text.includes('google.com/shopping') || text.includes('#oshopproduct')) score -= 8;

  return score;
}

export function sortImageBackedProducts(products: Product[]): Product[] {
  const renderable = filterRenderableProducts(products)
    .map((product, index) => ({ product, index, score: productImageQualityScore(product) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const preferred = renderable.filter((entry) => entry.score >= 0);
  const pool = preferred.length >= 5 ? preferred : renderable;
  return pool.map((entry) => entry.product);
}

export function getProductImageQualityScore(product: Product): number {
  return productImageQualityScore(product);
}

export function sortProductsByImageQuality(products: Product[]): Product[] {
  return sortImageBackedProducts(products);
}

export function sortFeedRenderableProducts(products: Product[]): Product[] {
  return filterFeedRenderableProducts(products)
    .map((product, index) => ({ product, index, score: productImageQualityScore(product) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.product);
}

export function isHighConfidenceRenderableProduct(product?: Product | null): product is Product {
  return isRenderableProduct(product) && productImageQualityScore(product) > -25;
}

export function filterHighConfidenceProducts(products: Product[]): Product[] {
  const highConfidence = products.filter(isHighConfidenceRenderableProduct);
  return highConfidence.length ? highConfidence : filterRenderableProducts(products);
}
