import visionCacheData from '../data/catalog-vision-cache.json';
import type { ProductVisionAnalysis } from './catalog-vision';
import type { Product } from './types';

export type CatalogVisionCache = Record<string, ProductVisionAnalysis>;

const CATALOG_VISION_CACHE = visionCacheData as CatalogVisionCache;

function compactVisionForProduct(analysis: ProductVisionAnalysis): Record<string, unknown> {
  return {
    provider: analysis.provider,
    model: analysis.model,
    category: analysis.category,
    categoryConfidence: analysis.categoryConfidence,
    subcategory: analysis.subcategory,
    colors: analysis.colors,
    materials: analysis.materials,
    patterns: analysis.patterns,
    silhouette: analysis.silhouette,
    formality: analysis.formality,
    seasons: analysis.seasons,
    occasions: analysis.occasions,
    vibes: analysis.vibes,
    compatibleWith: analysis.compatibleWith,
    avoidWith: analysis.avoidWith,
    imageQualityFlags: analysis.imageQualityFlags,
    transparentCutoutScore: analysis.transparentCutoutScore,
    reasoningSummary: analysis.reasoningSummary,
    generatedAt: analysis.generatedAt,
  };
}

export function getCatalogVisionCache(): CatalogVisionCache {
  return CATALOG_VISION_CACHE;
}

export function getCachedProductVision(productId: string): ProductVisionAnalysis | null {
  return CATALOG_VISION_CACHE[productId] || null;
}

export function applyCatalogVisionCacheToProducts(products: Product[]): Product[] {
  return products.map((product) => {
    const analysis = getCachedProductVision(product.id);
    if (!analysis) return product;
    return {
      ...product,
      metadata: {
        ...(product.metadata || {}),
        catalogVision: compactVisionForProduct(analysis),
      },
    };
  });
}
