import { BRAND_CATALOG_PRODUCTS } from './brand-catalog';
import { parseSearchIntentHeuristic, rerankProducts } from './claude';
import { PHOTO_CATALOG_PRODUCTS } from './photo-catalog';
import { presentationScore } from './presentation-score';
import type { Category, Product, SearchIntent } from './types';
import { VIBES, vibeSearchQuery, type GeneratorBudget, type GeneratorFrame, type VibeId } from './vibes';

type CollectionFrame = GeneratorFrame | 'all';

export interface CatalogCollection {
  id: string;
  label: string;
  vibe: VibeId;
  frame: CollectionFrame;
  blurb: string;
  queryHint: string;
  productIds: string[];
}

const BUDGET_LIMIT_CENTS: Record<GeneratorBudget, number> = {
  any: Number.POSITIVE_INFINITY,
  under100: 10_000,
  under250: 25_000,
  under500: 50_000,
};

const VIBE_TERMS: Record<VibeId, string[]> = {
  night: ['night out', 'night', 'going out', 'dressy', 'glam'],
  street: ['streetwear', 'workwear', 'retro', 'sporty'],
  clean: ['clean', 'minimal', 'classic', 'quiet luxury'],
  gym: ['gym', 'sporty', 'performance', 'wellness'],
  cozy: ['cozy', 'winter', 'casual', 'soft'],
  date: ['date', 'night out', 'dressy', 'feminine'],
  office: ['office', 'work', 'tailored', 'smart'],
  vacation: ['vacation', 'summer', 'resort', 'coastal'],
  edgy: ['edgy', 'dark', 'grunge', 'statement'],
  preppy: ['preppy', 'classic', 'collegiate', 'smart'],
};

const FRAME_AVOID_TERMS: Record<GeneratorFrame, string[]> = {
  masc: ['skirt', 'heel', 'bodysuit', 'corset', 'cat eye', 'pearl'],
  fem: ['work pants'],
  androgynous: [],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasRealPhoto(product: Product): boolean {
  return Boolean(product.imageUrl) && !String(product.imageUrl).startsWith('data:image/svg+xml');
}

function searchHaystack(product: Product): string {
  return normalize([
    product.brand,
    product.name,
    ...metadataList(product, 'styles'),
    ...metadataList(product, 'vibes'),
    ...metadataList(product, 'keywords'),
  ].join(' '));
}

function metadataList(product: Product, key: 'colors' | 'styles' | 'vibes' | 'keywords'): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isUnderBudget(product: Product, budget: GeneratorBudget): boolean {
  return product.priceCents <= BUDGET_LIMIT_CENTS[budget];
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const output: Product[] = [];

  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    output.push(product);
  }

  return output;
}

function buildFrameIntent(category: Category, frame: GeneratorFrame): SearchIntent {
  return {
    category,
    keywords: [],
    gender: frame,
  };
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chooseVariedCandidate<T>(items: T[], seed: number, key: string): T | null {
  if (!items.length) return null;
  const pool = items.slice(0, Math.min(4, items.length));
  const index = (stableHash(key) + Math.abs(seed || 0)) % pool.length;
  return pool[index] || pool[0] || null;
}

export const LAUNCH_COLLECTIONS: CatalogCollection[] = [
  {
    id: 'night-femme',
    label: 'Midnight polish',
    vibe: 'night',
    frame: 'fem',
    blurb: 'A sharp night-out build with clean lines, a sleek heel, and a statement bag.',
    queryHint: 'night out',
    productIds: [
      'catalog-top-zara-corset',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-stevemadden-heel',
      'catalog-bag-saintlaurent-le5a7',
      'catalog-jewelry-missoma-pearlhoop',
    ],
  },
  {
    id: 'street-masc',
    label: 'Downtown layers',
    vibe: 'street',
    frame: 'masc',
    blurb: 'Layered outerwear, strong denim, and sneaker energy for a more built-out street fit.',
    queryHint: 'streetwear',
    productIds: [
      'catalog-hat-newera-yankees',
      'catalog-outer-northface-nuptse',
      'catalog-top-stussy-tee',
      'catalog-bottom-dickies-874',
      'catalog-shoes-jordan-1low',
    ],
  },
  {
    id: 'clean-all',
    label: 'Clean daily core',
    vibe: 'clean',
    frame: 'all',
    blurb: 'An easy neutral look that works as a clean starting point before you add accessories.',
    queryHint: 'clean minimal',
    productIds: [
      'catalog-top-uniqlo-airism',
      'catalog-bottom-aritzia-effortless',
      'catalog-shoes-nike-af1',
      'catalog-bag-longchamp-lepliage',
      'catalog-eyewear-rayban-wayfarer',
    ],
  },
  {
    id: 'gym-all',
    label: 'Studio reset',
    vibe: 'gym',
    frame: 'all',
    blurb: 'Performance-first basics that still feel like a polished matching set.',
    queryHint: 'gym set',
    productIds: [
      'catalog-top-lululemon-swiftly',
      'catalog-bottom-lululemon-align',
      'catalog-shoes-newbalance-530',
      'catalog-bag-lululemon-beltbag',
    ],
  },
  {
    id: 'cozy-all',
    label: 'Soft weekend',
    vibe: 'cozy',
    frame: 'all',
    blurb: 'Warm layers and off-duty pieces that still build a complete look fast.',
    queryHint: 'cozy weekend',
    productIds: [
      'catalog-outer-aritzia-superpuff',
      'catalog-top-essentials-hoodie',
      'catalog-bottom-nike-jogger',
      'catalog-shoes-ugg-ultramini',
      'catalog-bag-longchamp-lepliage',
    ],
  },
  {
    id: 'office-femme',
    label: 'Refined office',
    vibe: 'office',
    frame: 'fem',
    blurb: 'Tailored layers with a polished tote so the generator can land on something work-ready.',
    queryHint: 'office wear',
    productIds: [
      'catalog-outer-zara-trench',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-abercrombie-tailored',
      'catalog-shoes-stevemadden-heel',
      'catalog-bag-michaelkors-tote',
    ],
  },
  {
    id: 'vacation-femme',
    label: 'Resort set',
    vibe: 'vacation',
    frame: 'fem',
    blurb: 'Light vacation pieces with an easy hat and accessories to anchor the look.',
    queryHint: 'vacation outfit',
    productIds: [
      'catalog-hat-hm-bucket',
      'catalog-top-hm-ribtank',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-birkenstock-boston',
      'catalog-bag-coach-tabby',
      'catalog-eyewear-gucci-cateye',
    ],
  },
  {
    id: 'preppy-masc',
    label: 'Campus classic',
    vibe: 'preppy',
    frame: 'masc',
    blurb: 'A preppy base built around a cap, oxford shirt, and sharper everyday pieces.',
    queryHint: 'preppy classic',
    productIds: [
      'catalog-hat-ralphlauren-cap',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-levis-501',
      'catalog-shoes-converse-chuck70',
      'catalog-bag-michaelkors-tote',
    ],
  },
];

export const ALL_CATALOG_PRODUCTS: Product[] = dedupeProducts([
  ...PHOTO_CATALOG_PRODUCTS,
  ...BRAND_CATALOG_PRODUCTS,
]);

const PRODUCTS_BY_ID = new Map(ALL_CATALOG_PRODUCTS.map((product) => [product.id, product]));

export function getCatalogProductById(id: string): Product | null {
  return PRODUCTS_BY_ID.get(id) || null;
}

function findRealPhotoReplacement(
  product: Product,
  budget?: GeneratorBudget,
  usedIds?: Set<string>,
): Product | null {
  const originalHaystack = searchHaystack(product);
  const candidates = ALL_CATALOG_PRODUCTS
    .filter((candidate) => candidate.category === product.category)
    .filter(hasRealPhoto)
    .filter((candidate) => candidate.id !== product.id)
    .filter((candidate) => !budget || isUnderBudget(candidate, budget))
    .filter((candidate) => !usedIds || !usedIds.has(candidate.id));

  if (!candidates.length) return null;

  return candidates
    .map((candidate) => {
      let score = 100;
      if (candidate.metadata?.featured) score += 20;
      if (normalize(candidate.brand) === normalize(product.brand)) score += 30;

      const candidateHaystack = searchHaystack(candidate);
      const originalTerms = new Set(originalHaystack.split(' ').filter(Boolean));
      const candidateTerms = new Set(candidateHaystack.split(' ').filter(Boolean));

      for (const term of originalTerms) {
        if (candidateTerms.has(term)) score += 6;
      }

      const priceDelta = Math.abs((candidate.priceCents || 0) - (product.priceCents || 0));
      score -= Math.min(25, Math.round(priceDelta / 2500));

      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score)[0]?.candidate || null;
}

export function hydrateItemsFromCatalog(
  items: Partial<Record<Category, Product>>,
): Partial<Record<Category, Product>> {
  const nextItems: Partial<Record<Category, Product>> = {};

  for (const [slot, product] of Object.entries(items) as Array<[Category, Product | undefined]>) {
    if (!product) continue;
    const catalogProduct = getCatalogProductById(product.id);
    const currentIsPlaceholder = String(product.imageUrl || '').startsWith('data:image/svg+xml');

    if (catalogProduct) {
      const catalogHasRealPhoto = hasRealPhoto(catalogProduct);
      if (currentIsPlaceholder && catalogHasRealPhoto) {
        nextItems[slot] = {
          ...product,
          ...catalogProduct,
        };
        continue;
      }
    }

    if (currentIsPlaceholder) {
      nextItems[slot] = findRealPhotoReplacement(product) || product;
      continue;
    }

    nextItems[slot] = product;
  }

  return nextItems;
}

export function getCollectionProducts(collection: CatalogCollection): Product[] {
  return collection.productIds
    .map((id) => getCatalogProductById(id))
    .filter((product): product is Product => Boolean(product));
}

export function getCollectionsFor(vibe?: VibeId, frame?: GeneratorFrame): CatalogCollection[] {
  return LAUNCH_COLLECTIONS.filter((collection) => {
    if (vibe && collection.vibe !== vibe) return false;
    if (!frame || frame === 'androgynous') return true;
    return collection.frame === 'all' || collection.frame === frame;
  });
}

export function getFeaturedCatalogProducts(limit = 8, category?: Category): Product[] {
  const pool = category
    ? ALL_CATALOG_PRODUCTS.filter((product) => product.category === category)
    : ALL_CATALOG_PRODUCTS;

  const featured = pool.filter((product) => Boolean(product.metadata?.featured));
  const fallback = pool.filter((product) => !product.metadata?.featured);

  return dedupeProducts([...featured, ...fallback]).slice(0, limit);
}

function scoreFallbackProduct(
  product: Product,
  vibe: VibeId,
  frame: GeneratorFrame,
): number {
  let score = product.metadata?.featured ? 16 : 8;
  if (hasRealPhoto(product)) score += 40;
  const haystack = searchHaystack(product);
  score += presentationScore(product, buildFrameIntent(product.category, frame));

  for (const term of VIBE_TERMS[vibe]) {
    if (haystack.includes(normalize(term))) score += 10;
  }

  for (const term of FRAME_AVOID_TERMS[frame]) {
    if (haystack.includes(normalize(term))) score -= 14;
  }

  return score;
}

function getSlotCandidates({
  slot,
  vibe,
  frame,
  budget,
  usedIds,
  collectionCandidates,
}: {
  slot: Category;
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  usedIds: Set<string>;
  collectionCandidates: Product[];
}): Product[] {
  const collectionIds = new Set(
    collectionCandidates
      .filter((product) => product.category === slot)
      .map((product) => product.id),
  );

  return ALL_CATALOG_PRODUCTS
    .filter((product) => product.category === slot)
    .filter((product) => isUnderBudget(product, budget))
    .filter((product) => !usedIds.has(product.id))
    .map((product) => ({
      product,
      score:
        scoreFallbackProduct(product, vibe, frame)
        + (collectionIds.has(product.id) ? 28 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product)
    .filter((product, index, list) => list.findIndex((entry) => entry.id === product.id) === index)
    .sort((left, right) => Number(hasRealPhoto(right)) - Number(hasRealPhoto(left)))
    .slice(0, 12);
}

export function buildCatalogLook({
  vibe,
  frame,
  budget,
  currentItems,
  mode,
  seed = 0,
}: {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  currentItems?: Partial<Record<Category, Product>>;
  mode: 'starter' | 'missing';
  seed?: number;
}): {
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
} {
  const vibeConfig = VIBES.find((entry) => entry.id === vibe) || VIBES[0];
  const targetSlots = vibeConfig.slots;
  const existingItems = currentItems || {};
  const picked: Partial<Record<Category, Product>> = {};
  const usedIds = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );

  const collections = getCollectionsFor(vibe, frame);
  const bestCollection = collections[0] || null;
  const collectionCandidates = dedupeProducts(
    collections.flatMap((collection) => getCollectionProducts(collection)),
  );

  for (const slot of targetSlots) {
    if (mode === 'missing' && existingItems[slot]) continue;
    const candidatePool = getSlotCandidates({
      slot,
      vibe,
      frame,
      budget,
      usedIds,
      collectionCandidates,
    });
    const chosen = chooseVariedCandidate(candidatePool, seed, `${vibe}:${frame}:${slot}:catalog`);
    if (!chosen) continue;

    picked[slot] = chosen;
    usedIds.add(chosen.id);
  }

  const missingSlots = targetSlots.filter((slot) => !picked[slot] && !(mode === 'missing' && existingItems[slot]));

  return {
    products: picked,
    collection: bestCollection,
    missingSlots,
  };
}

export async function buildAiCatalogLook({
  vibe,
  frame,
  budget,
  currentItems,
  mode,
  seed = 0,
}: {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  currentItems?: Partial<Record<Category, Product>>;
  mode: 'starter' | 'missing';
  seed?: number;
}): Promise<{
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
  assistantMode: 'ai-assisted' | 'catalog';
}> {
  const base = buildCatalogLook({ vibe, frame, budget, currentItems, mode, seed });
  const vibeConfig = VIBES.find((entry) => entry.id === vibe) || VIBES[0];
  const existingItems = currentItems || {};
  const usedIds = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );
  const collections = getCollectionsFor(vibe, frame);
  const collectionCandidates = dedupeProducts(
    collections.flatMap((collection) => getCollectionProducts(collection)),
  );
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const picked: Partial<Record<Category, Product>> = {};

  for (const slot of vibeConfig.slots) {
    if (mode === 'missing' && existingItems[slot]) continue;

    const candidatePool = getSlotCandidates({
      slot,
      vibe,
      frame,
      budget,
      usedIds,
      collectionCandidates,
    });

    if (!candidatePool.length) continue;
    const photoFirstPool = candidatePool.filter(hasRealPhoto);
    const rankingPool = photoFirstPool.length ? photoFirstPool : candidatePool;

    const query = vibeSearchQuery(vibe, slot, budget, frame);
    const intent = parseSearchIntentHeuristic(query, slot);
    const ranked = await rerankProducts(query, intent, rankingPool, Math.min(3, rankingPool.length));
    const variedRanked = ranked.filter((product) => !usedIds.has(product.id));
    const chosen =
      chooseVariedCandidate(variedRanked, seed, `${vibe}:${frame}:${slot}:ai`)
      || variedRanked[0]
      || rankingPool[0];

    if (!chosen) continue;
    picked[slot] = chosen;
    usedIds.add(chosen.id);
  }

  const mergedProducts = {
    ...base.products,
    ...picked,
  };

  for (const slot of vibeConfig.slots) {
    const current = mergedProducts[slot];
    if (!current || hasRealPhoto(current)) continue;
    const replacement = findRealPhotoReplacement(current, budget, usedIds);
    if (!replacement) continue;
    mergedProducts[slot] = replacement;
    usedIds.add(replacement.id);
  }

  const missingSlots = vibeConfig.slots.filter((slot) => !mergedProducts[slot] && !(mode === 'missing' && existingItems[slot]));

  return {
    products: mergedProducts,
    collection: base.collection,
    missingSlots,
    assistantMode: aiEnabled ? 'ai-assisted' : 'catalog',
  };
}
