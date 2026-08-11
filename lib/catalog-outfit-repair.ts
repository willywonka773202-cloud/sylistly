import {
  evaluateProductPublishability,
  type CatalogHealthSnapshot,
} from './catalog-publishability';
import type { Category, Product } from './types';

export const COMPLETE_OUTFIT_REQUIRED_CATEGORIES = ['top', 'bottom', 'shoes'] as const;
type RequiredOutfitCategory = typeof COMPLETE_OUTFIT_REQUIRED_CATEGORIES[number];

export interface CatalogOutfitReplacement {
  category: RequiredOutfitCategory;
  removedProductId: string | null;
  replacementProductId: string;
}

export type CatalogOutfitRepairResult =
  | {
      status: 'unchanged' | 'repaired';
      items: Partial<Record<Category, Product>>;
      totalCents: number;
      replacements: CatalogOutfitReplacement[];
      removedOptionalProductIds: string[];
    }
  | {
      status: 'suppressed';
      reason: 'missing_verified_replacement' | 'over_budget';
      missingCategories: RequiredOutfitCategory[];
      removedOptionalProductIds: string[];
    };

function totalCents(items: Partial<Record<Category, Product>>): number {
  return Object.values(items).reduce((sum, product) => sum + (product?.priceCents || 0), 0);
}

/**
 * Deterministic health-repair boundary for persisted outfits. Required pieces
 * are kept only with fresh positive evidence, replaced by a same-category
 * candidate under the whole-look cap, or the look is suppressed. Invalid
 * optional pieces are removed instead of blocking a complete core look.
 */
export function repairOrSuppressCatalogOutfit(input: {
  items: Partial<Record<Category, Product>>;
  candidateProducts: readonly Product[];
  health: CatalogHealthSnapshot;
  now: number | Date;
  maxTotalCents: number;
  retiredProductIds?: ReadonlySet<string>;
  compatibilityScore?: (
    candidate: Product,
    category: RequiredOutfitCategory,
    retainedItems: Partial<Record<Category, Product>>,
  ) => number;
}): CatalogOutfitRepairResult {
  const retired = input.retiredProductIds || new Set<string>();
  const isServable = (product: Product | undefined): product is Product => Boolean(
    product
      && !retired.has(product.id)
      && evaluateProductPublishability(product, {
        health: input.health,
        freshnessPolicy: 'require-fresh',
        requireExplicitStock: true,
        requireExplicitTrust: true,
        now: input.now,
      }).publishable,
  );

  const retained: Partial<Record<Category, Product>> = {};
  const removedOptionalProductIds: string[] = [];
  const invalidRequired = new Map<RequiredOutfitCategory, Product | undefined>();
  const required = new Set<Category>(COMPLETE_OUTFIT_REQUIRED_CATEGORIES);

  for (const [category, product] of Object.entries(input.items) as Array<[Category, Product | undefined]>) {
    if (product && product.category === category && isServable(product)) retained[category] = product;
    else if (required.has(category)) invalidRequired.set(category as RequiredOutfitCategory, product);
    else if (product) removedOptionalProductIds.push(product.id);
  }
  for (const category of COMPLETE_OUTFIT_REQUIRED_CATEGORIES) {
    if (!retained[category] && !invalidRequired.has(category)) invalidRequired.set(category, undefined);
  }

  const missingCategories = [...invalidRequired.keys()];
  if (!missingCategories.length) {
    const currentTotal = totalCents(retained);
    return currentTotal <= input.maxTotalCents
      ? {
          status: removedOptionalProductIds.length ? 'repaired' : 'unchanged',
          items: retained,
          totalCents: currentTotal,
          replacements: [],
          removedOptionalProductIds,
        }
      : {
          status: 'suppressed',
          reason: 'over_budget',
          missingCategories: [],
          removedOptionalProductIds,
        };
  }

  const usedIds = new Set(Object.values(retained).filter(Boolean).map((product) => product!.id));
  const candidatesByCategory = new Map<RequiredOutfitCategory, Product[]>();
  for (const category of missingCategories) {
    const candidates = input.candidateProducts
      .filter((candidate) => (
        candidate.category === category
        && !usedIds.has(candidate.id)
        && isServable(candidate)
      ))
      .map((candidate) => ({
        candidate,
        score: input.compatibilityScore?.(candidate, category, retained) || 0,
      }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((left, right) => (
        right.score - left.score
        || left.candidate.priceCents - right.candidate.priceCents
        || left.candidate.id.localeCompare(right.candidate.id)
      ))
      .map(({ candidate }) => candidate);
    candidatesByCategory.set(category, candidates);
  }

  const solution: { items: Partial<Record<Category, Product>> | null } = { items: null };
  function choose(index: number, working: Partial<Record<Category, Product>>, chosenIds: Set<string>): void {
    if (solution.items) return;
    if (index >= missingCategories.length) {
      if (totalCents(working) <= input.maxTotalCents) solution.items = { ...working };
      return;
    }
    const category = missingCategories[index];
    for (const candidate of candidatesByCategory.get(category) || []) {
      if (chosenIds.has(candidate.id)) continue;
      const next = { ...working, [category]: candidate };
      if (totalCents(next) > input.maxTotalCents) continue;
      choose(index + 1, next, new Set([...chosenIds, candidate.id]));
      if (solution.items) return;
    }
  }
  choose(0, retained, usedIds);

  const repairedItems = solution.items;
  if (!repairedItems) {
    return {
      status: 'suppressed',
      reason: 'missing_verified_replacement',
      missingCategories,
      removedOptionalProductIds,
    };
  }

  const replacements = missingCategories.map((category) => ({
    category,
    removedProductId: invalidRequired.get(category)?.id || null,
    replacementProductId: repairedItems![category]!.id,
  }));
  return {
    status: 'repaired',
    items: repairedItems,
    totalCents: totalCents(repairedItems),
    replacements,
    removedOptionalProductIds,
  };
}
