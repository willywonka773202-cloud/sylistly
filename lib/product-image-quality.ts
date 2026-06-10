import { getProductOutboundUrl } from './product-links';
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
  // Aritzia product media is Cloudflare-blocked from our image proxy in local
  // and production, so keeping it renderable creates broken feed images.
  'assets.aritzia.com',
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
  'boyshort', 'boyshorts', 'boxer', 'boxers', 'boxer short', 'boxer shorts',
  'undershirt', 'undershirts',
  'g string', 'g-string',
  'bra', 'bralette',
  't shirt bra', 't-shirt bra', 'teardrop t shirt bra', 'teardrop t-shirt bra',
  'lace bra', 'push up bra', 'padded bra', 'wireless bra', 'underwire bra',
  'corset lingerie', 'lace set', 'lingerie set',
  'pajama', 'pajamas', 'pyjama', 'pyjamas', 'pjs',
  'sleepwear', 'nightgown', 'nightie', 'nightshirt',
  'bikini', 'bikinis', 'bikini top', 'bikini bottom', 'bikini set',
  'swim', 'swimsuit', 'swimwear', 'swim top', 'swim short', 'swim shorts', 'swim brief', 'swim briefs',
  'board short', 'board shorts', 'cover up', 'cover-up', 'cover ups', 'cover-ups', 'coverup', 'coverups',
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

const MULTI_ITEM_SET_TERMS = [
  '2 piece', '2-piece', 'two piece', 'two-piece',
  '3 piece', '3-piece', 'three piece', 'three-piece',
  '2 pcs', '2pcs', '3 pcs', '3pcs',
  '2 pack', '2-pack', '3 pack', '3-pack',
  'matching set', 'co ord', 'co-ord', 'coord set', 'coordinated set',
  'outfit set', 'pant set', 'pants set', 'trouser set', 'trousers set',
  'short set', 'shorts set', 'skirt set', 'sweater set',
  'blazer set', 'jacket set', 'cardigan set', 'tracksuit',
  'bag set', 'tote bag set', 'hat and tote', 'hat and tote bag set', 'tote and hat set',
  'suit set', 'complete outfit',
];

const TOP_CONFLICT_SINGLE_ITEM_TERMS = [
  'pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans',
  'bottom', 'bottoms', 'short', 'shorts', 'skirt', 'leggings', 'jogger', 'joggers',
  'suit', 'bottoms',
];

const OUTER_CONFLICT_SINGLE_ITEM_TERMS = [
  'pant set', 'pants set', 'trouser set', 'trousers set',
  'skirt set', 'shorts set', 'co ord', 'co-ord', 'tracksuit',
  'complete outfit',
];

const BOTTOM_CONFLICT_SINGLE_ITEM_TERMS = [
  'blouse', 'shirt set', 'top set', 'tee set', 'blazer set', 'jacket set',
  'cardigan set', 'suit set', 'complete outfit',
];

// Reviewed local cutouts that technically have alpha but are model/full-outfit
// composites instead of standalone garment PNGs. Keep them out of feed,
// profile, and Studio until the catalog has true item-only replacements.
const NON_GARMENT_CUTOUT_PRODUCT_IDS = new Set([
  'generated-dc188b225d49fbd3',
  'generated-f1e5461b86e85cb7',
  'generated-041da4cfe0a7056b',
  'generated-156d42979e60b705',
  'generated-1f202726dff2f014',
  'generated-2b668469c7d84f6e',
  'generated-2eeb9177b2a156a5',
  'generated-35f0341cafaf810d',
  'generated-3869739e43797ced',
  'generated-487eeeb7ad2ed5b2',
  'generated-5aefcd19a46a76a7',
  'generated-6256d844cd2f73bc',
  'generated-6de1b00357f7dd68',
  'generated-88f416d38d4962b4',
  'generated-958408328a58e8bb',
  'generated-bf4f3fe2a92cf5a3',
  'generated-c677c02745bffdd5',
  'generated-cb9a8d25c4d3df34',
  'generated-d7fe8cdb6fe638b2',
  'generated-e0ad64fcd8e46714',
  'generated-e190f85176ee9be5',
  'generated-e946a57f141dc54c',
  'generated-ef1ef5d28cfcf7d5',
  'generated-ef8c18a9ce9f8c03',
  'generated-efe763d1bf479e59',
  'generated-225686ca63c9d93c',
  'generated-45eb351ccebff462',
  'generated-7c557ad32e2c12be',
  'generated-8c4ffd01ffe62765',
  'generated-8f03b87432cc3508',
  'generated-ab5e6d73176190dd',
  'generated-b0b6e135c92a2b63',
  'generated-b72613e805c41cbc',
  'generated-b96a8896c72f00bf',
  'generated-d888f3299a33a53c',
  '597372a8b97e783f',
  '9d9a77f2e03b6851',
  'generated-16a4517c50e5ee1d',
  'generated-30526b6c04e69ac5',
  'generated-75790e3b8b9f7733',
  'generated-9b9db014b2d9ed3b',
  'generated-c3564a6db0b7b1d0',
  'generated-e6b0808f98ef5088',
  'generated-0dd8cfe08bb7a011',
  'generated-4e43016dfc8eedee',
  'generated-502841f449c32876',
  'generated-a5801e98c45f1cbf',
  'generated-c8dab16c6c0f23f2',
  'generated-edc1856050584cdb',
  '91d2606d3ed9958a',
  'generated-837496a0a03041b8',
  'generated-8d4e3bcd82077a3d',
  'generated-91163af986a5b635',
  'generated-07a062f2c9f7de29',
  'generated-0e18fa1391190bba',
  'generated-1008f102d799c90d',
  'generated-130d1c8797765e26',
  'generated-2e20fec284a6cd6b',
  'generated-38b88276652f406d',
  'generated-39cb3da53d56aafb',
  'generated-61904954680f6ff8',
  'generated-6d3010389559c096',
  'generated-70b1660ec9405a6b',
  'generated-7709b5e5769a8e76',
  'generated-7da43d666e4b7449',
  'generated-867a2968367d0d14',
  'generated-8d0a40412cd7c0af',
  'generated-99542fd664d775ef',
  'generated-99fdae77bcd417ac',
  'generated-9f26b6fa3eaeecc1',
  'generated-9f7712f662e0034d',
  'generated-a45af73010be409a',
  'generated-aa6cb4ece0190b0a',
  'generated-ce58332aab800a94',
  'generated-d91ad828ec14dafd',
  'generated-e4521506a432189e',
  'generated-f0e7bfe9cff043d9',
  'generated-f3212c62c5d40d22',
  'generated-f403e370ccf52a12',
  'generated-f7db09272e73cd2c',
  'generated-fdb47b6778ec997e',
  '85f6cb6cd1ec6df2',
  'f2e4852913aacbdf',
  'generated-2e0beab658a1e16a',
  'generated-3084801187d53eaa',
  'generated-9bc59c9d7498e99f',
  'generated-130411501038e332',
  'generated-624a9117048c37d2',
  'generated-9745d91b67c10bb9',
  'generated-758ef28a0e13da4b',
  'generated-bb0fee93a3e25796',
  'generated-ca938ba8cedc6c1f',
  'generated-d846c2cc5d7d5160',
  'generated-d21d09ad6fd72b69',
  'generated-e6454b5080145d0e',
  'generated-efea7e82501f92dd',
  'ba8f3b445e60ac75',
  'bc78a561ef3414cd',
  // Non-wearable products that slipped into the drop catalog (not garments at all)
  'drop-1efc45f13d67a1f7', // Striped Beach Towel (was categorized "jewelry")
  'drop-0f54676d64f945de', // Fancy Velvet Ring Box (a box, not a wearable)
  // Cutout is a GOLF logo graphic, not the pants the product claims to be
  'searchapi-quality-bottoms-dickies-874-dickies-men-s-original-874-work-pants-501ff70f6f38bd',
]);

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

const COSTUME_SET_LISTING_TERMS = [
  'costume',
  'cosplay',
  'dress up',
  'set includes',
  'outfit for women',
  'outfit for men',
  'western outfits women',
  'cowboy clothes for women',
];

const FEED_BLOCKED_PRODUCT_TERMS = [
  ...LOW_INFORMATION_PRODUCT_TERMS,
  ...INTIMATES_SLEEPWEAR_TERMS,
  ...VISUALLY_WEAK_PRODUCT_TERMS,
  ...COSTUME_SET_LISTING_TERMS,
  'fuck',
  'fucking',
  'bitch',
  'asshole',
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
  'tiktok shop',
  'lightinthebox',
  'devilinspired',
  'wild jolie',
  'cool shapewear',
];

const BLOCKED_FEED_RETAILER_TERMS = [
  ...MARKETPLACE_TERMS,
  'costume',
  'cosplay',
  'shopcarters',
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
  top: ['shoes', 'sneaker', 'boot', 'pants', 'trouser', 'jeans', 'shorts', 'bottom', 'bottoms', 'skirt', 'leggings', 'bag', 'tote', 'necklace', 'sunglasses'],
  bottom: ['shirt', 'tee', 'blouse', 'jacket', 'coat', 'shoes', 'sneaker', 'boot', 'bag', 'tote', 'necklace', 'sunglasses'],
  outer: ['shirt', 'tee', 't-shirt', 'top', 'blouse', 'shoes', 'sneaker', 'boot', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote', 'necklace'],
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

export function getTransparentProductImageUrl(product?: Product | null): string | null {
  if (!product) return null;
  if (product.imageStatus === 'cutout-failed' || product.imageStatus === 'quarantined') return null;
  const candidate = product.imageTransparentUrl || product.imageCutoutUrl;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!hasUsableImageUrl(trimmed)) return null;
  return trimmed;
}

export function hasTransparentProductImage(product?: Product | null): product is Product {
  return Boolean(product && getTransparentProductImageUrl(product));
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
    product.retailer,
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

function productTitleContext(product: Product): string {
  return [
    product.id,
    product.name,
    product.brand,
    product.retailer,
    typeof product.metadata?.title === 'string' ? product.metadata.title : '',
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
  if (BLOCKED_FEED_RETAILER_TERMS.some((term) => descriptive.includes(term) || urlContext.includes(term))) return true;
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
  const descriptive = productTitleContext(product);
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

export function isMultiItemSetProduct(product?: Product | null): boolean {
  if (!product) return false;
  const descriptive = productTitleContext(product);
  const padded = ` ${normalizedText(descriptive)} `;

  if (MULTI_ITEM_SET_TERMS.some((term) => hasAnyTerm(descriptive, [term]))) return true;

  if (product.category === 'top' && TOP_CONFLICT_SINGLE_ITEM_TERMS.some((term) => hasAnyTerm(descriptive, [term]))) {
    return true;
  }
  if (product.category === 'outer' && OUTER_CONFLICT_SINGLE_ITEM_TERMS.some((term) => padded.includes(` ${normalizedText(term)} `))) {
    return true;
  }
  if (product.category === 'bottom' && BOTTOM_CONFLICT_SINGLE_ITEM_TERMS.some((term) => padded.includes(` ${normalizedText(term)} `))) {
    return true;
  }

  return false;
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
  'new balance', '860v2', '471', '475',
  '530', '574', '550', '9060', '993', '2002r', '1080',
  'f50',
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
  'shacket', 'fleece', 'gilet', 'vest', 'track',
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
  // Search terms/source queries can say "coat" even when the merchant title
  // says "tee"; trust the product title for category integrity.
  const text = productTitleContext(product);
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
  const text = productTitleContext(product);
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
  if (product.imageQuality === 'missing') return false;
  if (isBlockedProductImage(product)) return false;
  return hasUsableImageUrl(product.imageUrl);
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

export function isTransparentRenderableProduct(product?: Product | null): product is Product {
  return Boolean(isRenderableProduct(product) && hasTransparentProductImage(product));
}

export function isRenderableProductForFeed(product?: Product | null): product is Product {
  return Boolean(
    isRenderableProduct(product)
    && !isFeedBlockedProductImage(product)
    && !hasFeedCategoryMismatch(product)
    && !isMultiItemSetProduct(product)
    && hasHighCategoryConfidence(product)
    && productImageQualityScore(product) > -20,
  );
}

export function isTransparentRenderableProductForFeed(product?: Product | null): product is Product {
  return Boolean(isRenderableProductForFeed(product) && hasTransparentProductImage(product));
}

export function isEditorialCutoutProduct(product?: Product | null): product is Product {
  if (!isTransparentRenderableProductForFeed(product)) return false;
  if (NON_GARMENT_CUTOUT_PRODUCT_IDS.has(product.id)) return false;
  if (product.imageStatus === 'review-only' || product.imageStatus === 'quarantined' || product.imageStatus === 'cutout-failed') {
    return false;
  }
  if (product.imageQualityFlags?.some((flag) => ['body-model', 'full-body', 'multi-item', 'outfit-set', 'bad-cutout'].includes(flag))) {
    return false;
  }
  return true;
}

export function hasProductCommerceLink(product?: Product | null): boolean {
  return Boolean(
    product
    && (
      product.productUrl?.trim()
      || product.retailerUrl?.trim()
      || product.googleShoppingUrl?.trim()
      || product.fallbackUrl?.trim()
    ),
  );
}

export function isSyntheticStudioProduct(product?: Product | null): boolean {
  if (!product) return false;
  const source = String(product.metadata?.source || '').toLowerCase();
  const brand = String(product.brand || '').toLowerCase();
  const retailer = String(product.retailer || '').toLowerCase();
  // `generated_catalog` means the row was discovered from a search/catalog
  // expansion job. Those products can still be real merchant-backed pieces
  // with real product images and shopping links. Only block true synthetic
  // studio assets or AI-created product imagery.
  return product.imageSource === 'generated'
    || source === 'editorial_essentials'
    || brand === 'sylistly studio'
    || retailer === 'sylistly studio';
}

export function isRealCommerceProductForFeed(product?: Product | null): product is Product {
  return Boolean(
    isRenderableProductForFeed(product)
    && hasProductCommerceLink(product)
    && !isSyntheticStudioProduct(product),
  );
}

export function filterRenderableProducts(products: Product[]): Product[] {
  return products.filter(isRenderableProduct);
}

export function filterFeedRenderableProducts(products: Product[]): Product[] {
  return products.filter(isRenderableProductForFeed);
}

export function filterTransparentRenderableProducts(products: Product[]): Product[] {
  return products.filter(isTransparentRenderableProduct);
}

export function filterTransparentFeedRenderableProducts(products: Product[]): Product[] {
  return products.filter(isTransparentRenderableProductForFeed);
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

function isSearchOrAggregatorUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase();
    const params = parsed.searchParams;
    const hash = parsed.hash.toLowerCase();
    const isNordstromProductPath =
      (hostname === 'nordstrom.com' || hostname === 'nordstromrack.com') &&
      /^\/s\/[^/]+\/\d+/.test(pathname);

    if (hostname.includes('google.') && (pathname.includes('/search') || pathname.includes('/shopping'))) return true;
    if (hash.includes('oshopproduct')) return true;
    if (pathname.includes('/search') || (pathname.includes('/s/') && !isNordstromProductPath) || pathname.includes('search-result')) return true;
    return params.has('q')
      || params.has('query')
      || params.has('search')
      || params.has('searchTerm')
      || params.has('text')
      || params.has('keyword');
  } catch {
    return true;
  }
}

export function hasExactProductLink(product?: Product | null): boolean {
  if (!product || !hasProductCommerceLink(product)) return false;

  try {
    const outboundUrl = getProductOutboundUrl(product);
    const parsed = new URL(outboundUrl);
    const pathname = parsed.pathname.toLowerCase();

    if (!pathname || pathname === '/') return false;
    return !isSearchOrAggregatorUrl(outboundUrl);
  } catch {
    return false;
  }
}

function productCommerceQualityScore(product: Product): number {
  if (!hasProductCommerceLink(product)) return 0;

  const outboundUrl = getProductOutboundUrl(product);
  let score = hasExactProductLink(product) ? 36 : 8;
  if (isSearchOrAggregatorUrl(outboundUrl)) score -= 14;
  if (product.productUrl || product.retailerUrl) score += 6;
  return score;
}

export function productImageQualityScore(product: Product): number {
  const text = productQualityText(product);
  let score = 0;

  if (isBlockedProductImage(product)) return -999;
  if (isMultiItemSetProduct(product)) return -999;

  if (product.imageQuality === 'good') score += 18;
  if (product.imageQuality === 'ok') score += 6;
  if (product.productUrl || product.retailerUrl) score += 8;
  score += productCommerceQualityScore(product);
  if (product.priceCents > 0) score += 4;
  if ((product.vibes?.length || 0) + (product.searchTerms?.length || 0) >= 3) score += 4;

  if (PREFERRED_RETAILER_TERMS.some((term) => text.includes(term))) score += 18;
  if (MARKETPLACE_TERMS.some((term) => text.includes(term))) score -= 34;
  if (LOW_QUALITY_LISTING_TERMS.some((term) => text.includes(term))) score -= 22;
  if (LOW_INFORMATION_PRODUCT_TERMS.some((term) => text.includes(term))) score -= 80;
  if (isFeedBlockedProductImage(product)) score -= 120;
  if (hasFeedCategoryMismatch(product)) score -= 90;
  if (text.includes('google.com/shopping') || text.includes('google.com/search') || text.includes('#oshopproduct')) score -= 8;

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

export function sortRealCommerceFeedProducts(products: Product[]): Product[] {
  return products.filter(isRealCommerceProductForFeed)
    .map((product, index) => ({
      product,
      index,
      score:
        productImageQualityScore(product)
        + (hasTransparentProductImage(product) ? 14 : 0)
        + productCommerceQualityScore(product),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.product);
}

export function sortTransparentFeedRenderableProducts(products: Product[]): Product[] {
  return products
    .filter((product) =>
      isEditorialCutoutProduct(product)
      && hasProductCommerceLink(product)
      && !isSyntheticStudioProduct(product),
    )
    .map((product, index) => ({
      product,
      index,
      score:
        productImageQualityScore(product)
        + productCommerceQualityScore(product),
    }))
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
