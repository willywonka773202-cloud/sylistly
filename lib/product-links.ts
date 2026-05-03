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
