import { CATEGORY_ORDER, type Product } from './types';

export const STYLE_OWNED_METADATA_KEY = 'styleOwnedVerification';
export const STYLE_OWNED_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const STYLE_OWNED_VERIFICATION_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface StyleOwnedVerification {
  version: 1;
  verified: true;
  source: 'structured-product' | 'catalog-match';
  /** Present only for strict catalog matches so the original published row
   * remains auditable after its ID is replaced by the stable owned-anchor ID. */
  sourceCatalogProductId?: string;
  canonicalUrl: string;
  retailerHost: string;
  availability: 'InStock';
  imageVerified: true;
  verifiedAt: string;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && (!parsed.port || parsed.port === '443');
  } catch {
    return false;
  }
}

export function getStyleOwnedVerification(product?: Product | null): StyleOwnedVerification | null {
  const raw = product?.metadata?.[STYLE_OWNED_METADATA_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<StyleOwnedVerification>;
  if (
    value.version !== 1
    || value.verified !== true
    || (value.source !== 'structured-product' && value.source !== 'catalog-match')
    || value.availability !== 'InStock'
    || value.imageVerified !== true
    || typeof value.retailerHost !== 'string'
    || !value.retailerHost.trim()
    || typeof value.verifiedAt !== 'string'
    || !Number.isFinite(Date.parse(value.verifiedAt))
    || !isHttpsUrl(value.canonicalUrl)
  ) {
    return null;
  }
  if (
    value.source === 'catalog-match'
    && (
      typeof value.sourceCatalogProductId !== 'string'
      || !value.sourceCatalogProductId.trim()
      || value.sourceCatalogProductId.length > 180
      || value.sourceCatalogProductId.startsWith('owned-')
    )
  ) {
    return null;
  }
  return value as StyleOwnedVerification;
}

/**
 * A temporary/saved user-owned piece is allowed onto the Remix canvas only
 * after the server has verified structured Product data, an exact HTTPS PDP,
 * a current price, explicit InStock availability, and a reachable image.
 */
export function isVerifiedStyleOwnedProduct(product?: Product | null, now = Date.now()): boolean {
  const verification = getStyleOwnedVerification(product);
  if (!product || !verification || !Number.isFinite(now)) return false;
  const verifiedAt = Date.parse(verification.verifiedAt);
  if (
    !Number.isFinite(verifiedAt)
    || verifiedAt - now > STYLE_OWNED_VERIFICATION_MAX_FUTURE_SKEW_MS
    || now - verifiedAt > STYLE_OWNED_VERIFICATION_MAX_AGE_MS
  ) {
    return false;
  }
  let canonicalHost = '';
  try {
    canonicalHost = new URL(verification.canonicalUrl).hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  } catch {
    return false;
  }
  return Boolean(
    product.id?.startsWith('owned-')
      && product.metadata?.source === 'style_from_url'
      && product.brand?.trim()
      && product.name?.trim()
      && product.retailer?.trim()
      && CATEGORY_ORDER.includes(product.category)
      && Number.isSafeInteger(product.priceCents)
      && product.priceCents > 0
      && product.priceCents <= 10_000_000
      && product.currency === 'USD'
      && product.inStock === true
      && product.trusted === true
      && product.availabilityState === 'in_stock'
      && product.lastVerifiedAt === verification.verifiedAt
      && isHttpsUrl(product.productUrl)
      && isHttpsUrl(product.retailerUrl)
      && isHttpsUrl(product.imageUrl)
      && product.productUrl === verification.canonicalUrl
      && product.retailerUrl === verification.canonicalUrl
      && canonicalHost === verification.retailerHost.toLowerCase().replace(/\.$/, '').replace(/^www\./, ''),
  );
}

export function getStyleOwnedCanvasImageUrl(product?: Product | null): string | null {
  return product && isVerifiedStyleOwnedProduct(product) ? product.imageUrl : null;
}
