import { wrapAffiliate } from './affiliate';
import { buildRetailerClickPath, type RetailerAttribution } from './retailer-attribution';
import type { Product } from './types';

function isValidHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getProductOutboundUrl(product: Product): string {
  const metadata = (product.metadata || {}) as Record<string, unknown>;
  const retailerLanding = typeof metadata.retailerUrl === 'string' ? metadata.retailerUrl : '';
  const sourceUrl = typeof metadata.sourceUrl === 'string' ? metadata.sourceUrl : '';
  const googleShoppingUrl = typeof metadata.googleShoppingUrl === 'string' ? metadata.googleShoppingUrl : '';
  const fallbackUrl = typeof metadata.fallbackUrl === 'string' ? metadata.fallbackUrl : '';

  if (isValidHttpUrl(product.productUrl)) return product.productUrl;
  if (isValidHttpUrl(product.retailerUrl)) return product.retailerUrl;
  if (isValidHttpUrl(retailerLanding)) return retailerLanding;
  if (isValidHttpUrl(sourceUrl)) return sourceUrl;
  if (isValidHttpUrl(product.affiliateUrl)) return product.affiliateUrl;
  if (isValidHttpUrl(product.googleShoppingUrl)) return product.googleShoppingUrl;
  if (isValidHttpUrl(product.fallbackUrl)) return product.fallbackUrl;
  if (isValidHttpUrl(googleShoppingUrl)) return googleShoppingUrl;
  if (isValidHttpUrl(fallbackUrl)) return fallbackUrl;

  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${product.brand} ${product.name}`)}`;
}

/**
 * The URL to navigate to when a user shops a product. It points at Sylistly's
 * validated server redirect, which records attribution and then applies the
 * configured affiliate wrapper. Use getProductOutboundUrl (raw) for display +
 * link-quality checks, which must see the real retailer URL.
 */
export type ProductClickAttribution = Omit<RetailerAttribution, 'productId'>;

export function getShoppableUrl(product: Product, attribution: ProductClickAttribution = {}): string {
  // Style What I Own anchors are device-local references the user already has.
  // They are intentionally absent from server catalog resolution, so routing
  // an `owned-*` id through /api/out would produce a broken 404 purchase CTA.
  if (product.id.startsWith('owned-')) return '';
  // Route through the server so every supported surface gets the same validated
  // destination, click ledger, and affiliate sub-id. The redirect still works
  // from the bundled static catalog when Supabase is not configured.
  return buildRetailerClickPath({
    ...attribution,
    productId: product.id,
    surface: attribution.surface || 'product-link',
  });
}

/** Raw affiliate URL for server jobs/tests that intentionally bypass click logging. */
export function getDirectAffiliateUrl(product: Product, subId = product.id): string {
  return wrapAffiliate(getProductOutboundUrl(product), subId);
}
