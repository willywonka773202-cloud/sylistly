/**
 * Catalog-free commerce helpers for the Remix client shell.
 *
 * Keep this module free of generated catalog data. The Build route imports it
 * synchronously for render-time validation and signatures, while the much
 * larger catalog/look engine is loaded only after mount or on interaction.
 */
import {
  hasExactProductLink,
  hasProductCommerceLink,
  isEditorialCutoutProduct,
  isMultiItemSetProduct,
} from '@/lib/product-image-quality';
import { isVerifiedStyleOwnedProduct } from '@/lib/style-owned-product';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { isVerificationFresh } from '@/lib/verification-freshness';

export const COMPLETE_BUYABLE_REQUIRED_SLOTS = ['top', 'bottom', 'shoes'] as const satisfies readonly Category[];
const REQUIRED_SLOTS: Category[] = [...COMPLETE_BUYABLE_REQUIRED_SLOTS];
const FRESH_AVAILABILITY_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalize(value?: string | null): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Build can validate an already-hydrated product without importing the catalog
 * JSON. Positive availability and its timestamp are embedded into every
 * published catalog row by the catalog engine/API; absent evidence fails closed.
 */
export function isFreshBuildCatalogProduct(
  product?: Product | null,
  now = Date.now(),
): product is Product {
  if (
    !product
    || product.inStock === false
    || !isEditorialCutoutProduct(product)
    || !hasProductCommerceLink(product)
    || !hasExactProductLink(product)
    || isMultiItemSetProduct(product)
    || !product.imageTransparentUrl
  ) {
    return false;
  }

  const hasPositiveAvailability = product.availabilityState === 'in_stock'
    || product.availabilityState === 'available';
  return hasPositiveAvailability
    && isVerificationFresh(product.lastVerifiedAt, FRESH_AVAILABILITY_WINDOW_MS, now);
}

/** A finished Remix outfit may contain published catalog rows or one verified
 * temporary "Style what I own" anchor. Both sources expire after 24 hours. */
export function isBuyableOutfitProduct(product?: Product | null): product is Product {
  return isFreshBuildCatalogProduct(product) || isVerifiedStyleOwnedProduct(product);
}

export function collectOutfitProductIds(items: Partial<Record<Category, Product>>): string[] {
  return CATEGORY_ORDER
    .map((slot) => items[slot]?.id || null)
    .filter((id): id is string => Boolean(id));
}

export interface CompleteBuyableLookValidation {
  ok: boolean;
  totalCents: number;
  maxTotalCents: number | null;
  missingRequiredSlots: Category[];
  nonBuyableSlots: Category[];
  overBudgetCents: number;
}

export function outfitTotalCents(items: Partial<Record<Category, Product>>): number {
  return Object.values(items).reduce((sum, product) => sum + (product?.priceCents || 0), 0);
}

export function validateCompleteBuyableLook(
  items: Partial<Record<Category, Product>>,
  maxTotalCents?: number | null,
): CompleteBuyableLookValidation {
  const normalizedMax = typeof maxTotalCents === 'number'
    && Number.isFinite(maxTotalCents)
    && maxTotalCents > 0
    ? maxTotalCents
    : null;
  const missingRequiredSlots = REQUIRED_SLOTS.filter((slot) => !items[slot]);
  const nonBuyableSlots = (Object.entries(items) as Array<[Category, Product | undefined]>)
    .filter(([slot, product]) => Boolean(product) && (product?.category !== slot || !isBuyableOutfitProduct(product)))
    .map(([slot]) => slot);
  const totalCents = outfitTotalCents(items);
  const overBudgetCents = normalizedMax == null ? 0 : Math.max(0, totalCents - normalizedMax);

  return {
    ok: missingRequiredSlots.length === 0 && nonBuyableSlots.length === 0 && overBudgetCents === 0,
    totalCents,
    maxTotalCents: normalizedMax,
    missingRequiredSlots,
    nonBuyableSlots,
    overBudgetCents,
  };
}

export function outfitRequiredSignature(items: Partial<Record<Category, Product>>): string {
  return REQUIRED_SLOTS
    .map((slot) => `${slot}:${items[slot]?.id || '-'}`)
    .join('|');
}

export function outfitFullSignature(items: Partial<Record<Category, Product>>): string {
  return CATEGORY_ORDER
    .map((slot) => `${slot}:${items[slot]?.id || '-'}`)
    .join('|');
}

export function getShoeId(items: Partial<Record<Category, Product>>): string | null {
  return items.shoes?.id || null;
}

export function getBrandOrMerchant(product?: Product | null): string {
  return normalize(product?.brand || product?.retailer || '');
}

export function getOutfitBrandCounts(items: Partial<Record<Category, Product>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of Object.values(items)) {
    const key = getBrandOrMerchant(product);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
