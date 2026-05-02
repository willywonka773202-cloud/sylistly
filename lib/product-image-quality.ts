import type { Product } from './types';

const BAD_IMAGE_URL_TERMS = [
  'placeholder',
  'no-image',
  'no_image',
  'image-coming-soon',
  'coming-soon',
  'blank',
  'transparent',
  'missing',
  'default-product',
  'fallback',
];

export function hasUsableImageUrl(imageUrl?: string | null): boolean {
  if (!imageUrl || typeof imageUrl !== 'string') return false;
  const trimmed = imageUrl.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();

  if (normalized.startsWith('data:image/svg+xml')) return false;
  if (normalized === '#' || normalized === 'about:blank') return false;
  if (BAD_IMAGE_URL_TERMS.some((term) => normalized.includes(term))) return false;

  return normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('/');
}

export function hasUsableProductImage(product?: Product | null): product is Product {
  if (!product) return false;
  if (product.imageQuality === 'missing') return false;
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
