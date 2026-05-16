import catalogCutoutOverridesData from '../data/catalog-cutout-overrides.json';
import type { Product } from './types';

export interface CatalogCutoutOverride {
  imageTransparentUrl?: string;
  imageCutoutUrl?: string;
  imageSource?: Product['imageSource'];
  imageStatus?: Product['imageStatus'];
  imageQualityFlags?: string[];
  imageUpdatedAt?: string;
  imageReviewNotes?: string;
}

const catalogCutoutOverrides = catalogCutoutOverridesData as Record<string, CatalogCutoutOverride>;

function isSafeTransparentUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase().startsWith('data:')) return false;
  return trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return cleaned.length ? Array.from(new Set(cleaned)) : undefined;
}

export function applyCatalogCutoutOverrides(product: Product): Product {
  const override = catalogCutoutOverrides[product.id];
  if (!override) return product;

  const imageTransparentUrl = isSafeTransparentUrl(override.imageTransparentUrl)
    ? override.imageTransparentUrl.trim()
    : undefined;
  const imageCutoutUrl = isSafeTransparentUrl(override.imageCutoutUrl)
    ? override.imageCutoutUrl.trim()
    : undefined;

  if (!imageTransparentUrl && !imageCutoutUrl) return product;

  const imageQualityFlags = cleanStringArray(override.imageQualityFlags);

  return {
    ...product,
    ...(imageTransparentUrl ? { imageTransparentUrl } : {}),
    ...(imageCutoutUrl ? { imageCutoutUrl } : {}),
    imageSource: override.imageSource || 'transparent-pipeline',
    imageStatus: override.imageStatus || 'cutout-ready',
    ...(imageQualityFlags ? { imageQualityFlags } : {}),
    ...(typeof override.imageUpdatedAt === 'string' ? { imageUpdatedAt: override.imageUpdatedAt } : {}),
    ...(typeof override.imageReviewNotes === 'string' ? { imageReviewNotes: override.imageReviewNotes } : {}),
    metadata: {
      ...(product.metadata || {}),
      cutoutOverride: true,
      imageSource: override.imageSource || 'transparent-pipeline',
      imageStatus: override.imageStatus || 'cutout-ready',
    },
  };
}

export function applyCatalogCutoutOverridesToProducts(products: Product[]): Product[] {
  return products.map(applyCatalogCutoutOverrides);
}
