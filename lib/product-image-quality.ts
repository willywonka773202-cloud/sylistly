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

export function isHighConfidenceRenderableProduct(product?: Product | null): product is Product {
  return isRenderableProduct(product) && productImageQualityScore(product) > -25;
}

export function filterHighConfidenceProducts(products: Product[]): Product[] {
  const highConfidence = products.filter(isHighConfidenceRenderableProduct);
  return highConfidence.length ? highConfidence : filterRenderableProducts(products);
}
