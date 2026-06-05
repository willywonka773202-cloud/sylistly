import catalogUrlOverridesData from '../data/catalog-url-overrides.json';
import type { Product } from './types';

interface CatalogUrlOverride {
  productUrl?: string;
  retailerUrl?: string;
  fallbackUrl?: string;
  googleShoppingUrl?: string;
  retailerHost?: string;
  sourceUrl?: string;
  verifiedAt?: string;
  verificationNotes?: string;
}

const catalogUrlOverrides = catalogUrlOverridesData as Record<string, CatalogUrlOverride>;

function cleanUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function cleanText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function applyCatalogUrlOverrides(product: Product): Product {
  const override = catalogUrlOverrides[product.id];
  if (!override) return product;

  const productUrl = cleanUrl(override.productUrl);
  const retailerUrl = cleanUrl(override.retailerUrl);
  const fallbackUrl = cleanUrl(override.fallbackUrl);
  const googleShoppingUrl = cleanUrl(override.googleShoppingUrl);
  const sourceUrl = cleanUrl(override.sourceUrl);
  const retailerHost = cleanText(override.retailerHost);
  const verifiedAt = cleanText(override.verifiedAt);
  const verificationNotes = cleanText(override.verificationNotes);

  return {
    ...product,
    ...(productUrl ? { productUrl } : {}),
    ...(retailerUrl ? { retailerUrl } : {}),
    ...(fallbackUrl ? { fallbackUrl } : {}),
    ...(googleShoppingUrl ? { googleShoppingUrl } : {}),
    metadata: {
      ...(product.metadata || {}),
      urlOverride: true,
      ...(retailerHost ? { retailerHost } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(verifiedAt ? { urlVerifiedAt: verifiedAt } : {}),
      ...(verificationNotes ? { urlVerificationNotes: verificationNotes } : {}),
    },
  };
}

export function applyCatalogUrlOverridesToProducts(products: Product[]): Product[] {
  return products.map(applyCatalogUrlOverrides);
}
