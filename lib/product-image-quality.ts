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
