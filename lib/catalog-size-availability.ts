import type { Product } from './types';

export type RequestedCatalogSizes = Partial<Record<'top' | 'outer' | 'bottom' | 'shoes', string>>;

function normalizedSize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\b(extra small|x small)\b/g, 'xs')
    .replace(/\b(extra large|x large)\b/g, 'xl')
    .replace(/\bsmall\b/g, 's')
    .replace(/\bmedium\b/g, 'm')
    .replace(/\blarge\b/g, 'l')
    .trim();
}

export function catalogSizeMatches(available: string, requested: string): boolean {
  const wanted = normalizedSize(requested);
  const candidate = normalizedSize(available);
  if (!wanted || !candidate) return false;
  if (wanted === candidate) return true;
  const numericWanted = wanted.match(/^\d+(?:\.\d+)?$/)?.[0];
  if (numericWanted) {
    return (candidate.match(/\d+(?:\.\d+)?/g) || [])
      .some((token) => Number(token) === Number(numericWanted));
  }
  return candidate.split(/[^a-z0-9]+/).includes(wanted);
}

/** Fail only on explicit negative evidence. Missing retailer size data is
 * unknown and therefore does not pretend that the requested size is absent. */
export function productSupportsRequestedSize(
  product: Product,
  requestedSizes?: RequestedCatalogSizes,
): boolean {
  if (!requestedSizes || !product.availableSizes?.length) return true;
  if (!['top', 'outer', 'bottom', 'shoes'].includes(product.category)) return true;
  const requested = requestedSizes[product.category as keyof RequestedCatalogSizes];
  if (!requested?.trim()) return true;
  return product.availableSizes.some((available) => catalogSizeMatches(available, requested));
}
