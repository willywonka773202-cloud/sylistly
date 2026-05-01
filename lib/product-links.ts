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

  if (isValidHttpUrl(product.retailerUrl)) return product.retailerUrl;
  if (isValidHttpUrl(retailerLanding)) return retailerLanding;
  if (isValidHttpUrl(sourceUrl)) return sourceUrl;
  if (isValidHttpUrl(product.affiliateUrl)) return product.affiliateUrl;

  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${product.brand} ${product.name}`)}`;
}
