import { productSupportsRequestedSize, type RequestedCatalogSizes } from './catalog-size-availability';
import type { TasteRankingSignals } from './taste-profile';
import type { Product } from './types';

export interface CatalogGenerationPreferences {
  preferredBrands?: string[];
  preferredRetailers?: string[];
  preferredColors?: string[];
  preferredTerms?: string[];
  excludedBrands?: string[];
  excludedRetailers?: string[];
  excludedTerms?: string[];
  /** User sizes are enforced only when the retailer supplied variant sizes.
   * Products with no size evidence remain eligible and are never guessed. */
  preferredSizes?: RequestedCatalogSizes;
  /** 0 strongly favors lower-priced pieces; 20 allows the full budget to lead.
   * The whole-look cap remains a hard invariant regardless of this preference. */
  priceTolerancePct?: number;
  /** Bounded, recency-weighted on-device interaction evidence. This is a soft
   * rank nudge only; it never relaxes any hard generation/commerce gate. */
  taste?: TasteRankingSignals;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function preferenceIncludes(values: string[] | undefined, candidate: string): boolean {
  const normalizedCandidate = normalize(candidate);
  return Boolean(
    normalizedCandidate
      && values?.some((value) => normalize(value) === normalizedCandidate),
  );
}

function metadataStrings(product: Product, key: string): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Shared hard predicate for both live composition and pre-generated rows. */
export function respectsCatalogGenerationHardPreferences(
  product: Product,
  preferences?: CatalogGenerationPreferences,
): boolean {
  if (!preferences) return true;
  if (!productSupportsRequestedSize(product, preferences.preferredSizes)) return false;
  if (preferenceIncludes(preferences.excludedBrands, product.brand)) return false;
  if (preferenceIncludes(preferences.excludedRetailers, product.retailer)) return false;
  const text = [
    product.brand,
    product.name,
    product.retailer,
    ...(product.colors || []),
    ...metadataStrings(product, 'styles'),
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
  ].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  return !(preferences.excludedTerms || []).some((term) => {
    const normalizedTerm = normalize(term);
    return normalizedTerm && text.includes(normalizedTerm);
  });
}
