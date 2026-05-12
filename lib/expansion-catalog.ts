import expansionData from '../data/catalog-reviewed-additions.json';
import type { Product } from './types';
import { hasUsableImageUrl } from './product-image-quality';
import { hasDirectRetailerUrl } from './retailer-url';

type PersistedExpansionProduct = Product & {
  metadata?: Product['metadata'] & {
    source?: 'expansion-reviewed';
    sourcePack?: string;
    sourceCandidateId?: string;
  };
};

function isSafe(product: PersistedExpansionProduct): boolean {
  if (!product.id || !product.brand?.trim() || !product.name?.trim()) return false;
  if (!product.category || !product.imageUrl) return false;
  if (!hasUsableImageUrl(product.imageUrl)) return false;
  const productUrl = String(product.productUrl || '');
  const retailerUrl = String(product.retailerUrl || '');
  const hasRealLink = (productUrl && !/google\.com\/search/i.test(productUrl) && hasDirectRetailerUrl(productUrl))
    || (retailerUrl && !/google\.com\/search/i.test(retailerUrl) && hasDirectRetailerUrl(retailerUrl));
  return Boolean(hasRealLink);
}

export const EXPANSION_REVIEWED_PRODUCTS: Product[] = (expansionData as PersistedExpansionProduct[])
  .filter(isSafe)
  .map((product) => ({
    ...product,
    metadata: {
      source: 'expansion-reviewed',
      ...(product.metadata || {}),
    },
  }));
