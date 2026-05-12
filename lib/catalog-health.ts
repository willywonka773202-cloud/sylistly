import { ALL_CATALOG_PRODUCTS, buildCatalogLook, getCatalogProductById } from './catalog';
import { isRenderableProduct, productImageQualityScore } from './product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from './types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from './vibes';

export type OutfitItems = Partial<Record<Category, Product>>;

const REQUIRED_SLOTS: Category[] = ['top', 'bottom', 'shoes'];

export function formatPrice(cents?: number | null): string {
  if (!cents || cents <= 0) return 'Price varies';
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function normalizeCategory(category?: string | null): Category {
  if (CATEGORY_ORDER.includes(category as Category)) return category as Category;
  return 'top';
}

export function normalizeGender(gender?: string | null): GeneratorFrame | 'any' {
  if (gender === 'masc' || gender === 'men' || gender === 'male') return 'masc';
  if (gender === 'fem' || gender === 'women' || gender === 'female') return 'fem';
  if (gender === 'androgynous' || gender === 'unisex' || gender === 'neutral') return 'androgynous';
  return 'any';
}

export function getProductByIdSafe(id?: string | null): Product | null {
  if (!id) return null;
  return getCatalogProductById(id);
}

export function getProductsByIdsSafe(ids: Array<string | null | undefined>): Product[] {
  return ids.map((id) => getProductByIdSafe(id)).filter((product): product is Product => Boolean(product));
}

export function isRealCatalogProduct(product?: Product | null): product is Product {
  return Boolean(
    product
      && product.id
      && product.name?.trim()
      && product.brand?.trim()
      && product.category
      && CATEGORY_ORDER.includes(product.category)
      && (product.priceCents || 0) >= 0
      && getCatalogProductById(product.id),
  );
}

export function validateProduct(product?: Product | null) {
  const issues: string[] = [];
  if (!product) issues.push('missing product');
  if (product && !product.id) issues.push('missing id');
  if (product && !product.name?.trim()) issues.push('missing name');
  if (product && !product.brand?.trim()) issues.push('missing brand');
  if (product && !CATEGORY_ORDER.includes(product.category)) issues.push('invalid category');
  if (product && !getCatalogProductById(product.id)) issues.push('not in catalog');
  return { valid: issues.length === 0, issues };
}

export function getOutfitProducts(items: OutfitItems): Product[] {
  return CATEGORY_ORDER.map((slot) => items[slot]).filter((product): product is Product => isRealCatalogProduct(product));
}

export function calculateOutfitTotal(items: OutfitItems): number {
  return getOutfitProducts(items).reduce((sum, product) => sum + (product.priceCents || 0), 0);
}

export function validateOutfit(items: OutfitItems) {
  const products = getOutfitProducts(items);
  const missingRequired = REQUIRED_SLOTS.filter((slot) => !items[slot]);
  const orphaned = Object.values(items).filter((product): product is Product => Boolean(product) && !isRealCatalogProduct(product));
  return {
    valid: missingRequired.length === 0 && orphaned.length === 0 && products.length >= 3,
    products,
    missingRequired,
    orphaned,
    totalCents: calculateOutfitTotal(items),
  };
}

function frameMatches(product: Product, frame?: GeneratorFrame | 'any') {
  if (!frame || frame === 'any') return true;
  return !product.gender?.length || product.gender.includes(frame) || product.gender.includes('androgynous');
}

function matchesVibe(product: Product, vibe?: string) {
  if (!vibe) return true;
  const needle = vibe.toLowerCase();
  return [
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
    product.name,
    product.brand,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function fallbackForSlot({
  slot,
  frame,
  vibe,
  usedIds,
}: {
  slot: Category;
  frame?: GeneratorFrame | 'any';
  vibe?: string;
  usedIds: Set<string>;
}) {
  return ALL_CATALOG_PRODUCTS
    .filter((product) => product.category === slot)
    .filter(isRealCatalogProduct)
    .filter((product) => !usedIds.has(product.id))
    .filter((product) => frameMatches(product, frame))
    .map((product) => ({
      product,
      score:
        productImageQualityScore(product)
        + (matchesVibe(product, vibe) ? 32 : 0)
        + (isRenderableProduct(product) ? 18 : 0)
        + (product.metadata?.featured ? 12 : 0),
    }))
    .sort((left, right) => right.score - left.score)[0]?.product || null;
}

export function repairOutfit(
  items: OutfitItems,
  options: {
    vibe?: string;
    frame?: GeneratorFrame | 'any';
  } = {},
): OutfitItems {
  const repaired: OutfitItems = {};
  const usedIds = new Set<string>();

  for (const slot of CATEGORY_ORDER) {
    const product = items[slot];
    const catalogProduct = product ? getCatalogProductById(product.id) : null;
    if (catalogProduct && isRealCatalogProduct(catalogProduct) && !usedIds.has(catalogProduct.id)) {
      repaired[slot] = catalogProduct;
      usedIds.add(catalogProduct.id);
    }
  }

  for (const slot of REQUIRED_SLOTS) {
    if (repaired[slot]) continue;
    const replacement = fallbackForSlot({ slot, frame: options.frame, vibe: options.vibe, usedIds });
    if (replacement) {
      repaired[slot] = replacement;
      usedIds.add(replacement.id);
    }
  }

  return repaired;
}

export function repairOrRegenerateOutfit({
  items,
  vibe = 'clean',
  frame = 'any',
  budget = 'under250',
  seed = 0,
}: {
  items: OutfitItems;
  vibe?: VibeId | string;
  frame?: GeneratorFrame | 'any';
  budget?: GeneratorBudget;
  seed?: number;
}): OutfitItems {
  const repaired = repairOutfit(items, { vibe, frame });
  if (validateOutfit(repaired).valid) return repaired;

  const generated = buildCatalogLook({
    vibe: (vibe as VibeId) || 'clean',
    frame: frame === 'any' ? 'androgynous' : frame,
    budget,
    mode: 'full',
    seed,
  }).products;
  return repairOutfit(generated, { vibe, frame });
}

export function assertRenderableOutfit(items: OutfitItems): OutfitItems {
  const repaired = repairOutfit(items);
  const validation = validateOutfit(repaired);
  if (!validation.valid) {
    throw new Error(`Outfit is not renderable: ${validation.missingRequired.join(', ') || 'invalid catalog refs'}`);
  }
  return repaired;
}

export function getCatalogStats() {
  const byGender: Record<string, number> = {};
  const byCategory = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<Category, number>;
  const byBudgetTier: Record<string, number> = { budget: 0, mid: 0, premium: 0, luxury: 0 };
  const styleCoverage = new Set<string>();
  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  let missingImages = 0;
  let unrenderable = 0;

  for (const product of ALL_CATALOG_PRODUCTS) {
    if (seenIds.has(product.id)) duplicateIds.add(product.id);
    seenIds.add(product.id);
    byCategory[product.category] += 1;
    if (!product.imageUrl) missingImages += 1;
    else if (!isRenderableProduct(product)) unrenderable += 1;
    for (const gender of product.gender || ['androgynous']) byGender[gender] = (byGender[gender] || 0) + 1;
    for (const vibe of product.vibes || []) styleCoverage.add(vibe);
    const price = product.priceCents || 0;
    const tier = price < 6000 ? 'budget' : price < 15000 ? 'mid' : price < 40000 ? 'premium' : 'luxury';
    byBudgetTier[tier] += 1;
  }

  return {
    total: ALL_CATALOG_PRODUCTS.length,
    byGender,
    byCategory,
    byBudgetTier,
    styleCoverage: Array.from(styleCoverage).sort(),
    duplicateIds: Array.from(duplicateIds),
    missingImages,
    unrenderable,
  };
}


export function calculateBudgetStatus(totalCents: number, budget: GeneratorBudget = 'under250') {
  const budgetCaps: Record<GeneratorBudget, number> = {
    any: 100000,
    under100: 10000,
    under250: 25000,
    under500: 50000,
    custom: 25000,
  };
  const cap = budgetCaps[budget] || budgetCaps.under250;
  return {
    capCents: cap,
    totalCents,
    remainingCents: cap - totalCents,
    overBudget: totalCents > cap,
    label: totalCents > cap ? `${formatPrice(totalCents - cap)} over` : `${formatPrice(cap - totalCents)} left`,
  };
}

export function calculateCompleteness(items: OutfitItems): number {
  const validation = validateOutfit(items);
  const presentRequired = REQUIRED_SLOTS.length - validation.missingRequired.length;
  const optionalCount = CATEGORY_ORDER.filter((slot) => !REQUIRED_SLOTS.includes(slot) && items[slot]).length;
  return Math.min(100, Math.round((presentRequired / REQUIRED_SLOTS.length) * 72 + Math.min(optionalCount, 4) * 7));
}

export function calculateRenderabilityScore(items: OutfitItems): number {
  const products = getOutfitProducts(items);
  if (!products.length) return 0;
  const average = products.reduce((sum, product) => sum + productImageQualityScore(product), 0) / products.length;
  return Math.max(0, Math.min(100, Math.round(55 + average)));
}

export function calculateWardrobeMatch(items: OutfitItems, wardrobeProductIds: Set<string>): number {
  const products = getOutfitProducts(items);
  if (!products.length) return 0;
  const ownedCount = products.filter((product) => wardrobeProductIds.has(product.id)).length;
  return Math.round((ownedCount / products.length) * 100);
}

export function calculateOutfitScore(items: OutfitItems, wardrobeProductIds: Set<string> = new Set()) {
  const completeness = calculateCompleteness(items);
  const renderability = calculateRenderabilityScore(items);
  const wardrobeMatch = calculateWardrobeMatch(items, wardrobeProductIds);
  const total = Math.round(completeness * 0.45 + renderability * 0.35 + wardrobeMatch * 0.2);
  return { total, completeness, renderability, wardrobeMatch };
}

export function getBestHeroPiece(items: OutfitItems): Product | null {
  const weight: Record<Category, number> = { hat: 4, outer: 34, top: 32, bottom: 22, shoes: 28, bag: 14, eyewear: 8, jewelry: 8 };
  return getOutfitProducts(items)
    .map((product, index) => ({ product, index, score: weight[product.category] + productImageQualityScore(product) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.product || null;
}

export function chooseSatellitePieces(items: OutfitItems, limit = 3): Product[] {
  const hero = getBestHeroPiece(items);
  return getOutfitProducts(items)
    .filter((product) => product.id !== hero?.id)
    .sort((left, right) => CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category))
    .slice(0, limit);
}