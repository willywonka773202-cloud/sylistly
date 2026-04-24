import { BRAND_CATALOG_PRODUCTS } from './brand-catalog';
import { parseSearchIntentHeuristic, rerankProducts } from './claude';
import { PHOTO_CATALOG_PRODUCTS } from './photo-catalog';
import { presentationScore } from './presentation-score';
import { hasDirectRetailerUrl } from './retailer-url';
import { searchBrandCatalog } from './brand-catalog';
import { searchPhotoCatalog } from './photo-catalog';
import { CATEGORY_ORDER, type Category, type Product, type SearchIntent } from './types';
import {
  VIBES,
  getBudgetMaxCents,
  vibeSearchQuery,
  type GeneratorBudget,
  type GeneratorFrame,
  type VibeId,
} from './vibes';

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

type GeneratorMode = 'starter' | 'missing' | 'full' | 'refresh';

function productCommerceScore(product: Product): number {
  let score = 0;
  if (product.trusted !== false) score += 18;
  if (hasDirectRetailerUrl(product.retailerUrl)) score += 22;
  if (hasRealPhoto(product)) score += 16;
  return score;
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

function isUnderBudget(product: Product, budget: GeneratorBudget, customMaxCents?: number | null): boolean {
  return product.priceCents <= getBudgetMaxCents(budget, customMaxCents);
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

function resolveTargetSlots(
  mode: GeneratorMode,
  vibeSlots: Category[],
  existingItems: Partial<Record<Category, Product>>,
): Category[] {
  if (mode === 'full') return CATEGORY_ORDER;
  if (mode === 'refresh') {
    return Array.from(new Set([
      ...vibeSlots,
      ...Object.keys(existingItems).filter((slot): slot is Category => CATEGORY_ORDER.includes(slot as Category)),
    ]));
  }
  return vibeSlots;
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
  const pool = items.slice(0, Math.min(18, items.length));
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
  {
    id: 'clean-femme-soft',
    label: 'Soft tailored clean',
    vibe: 'clean',
    frame: 'fem',
    blurb: 'A sharper feminine clean look with tailored pants, a fitted top, and polished accessories.',
    queryHint: 'clean womenswear',
    productIds: [
      'catalog-top-aritzia-contour',
      'catalog-bottom-aritzia-effortless',
      'catalog-shoes-nike-af1',
      'catalog-bag-coach-tabby',
      'catalog-jewelry-mejuri-dome',
    ],
  },
  {
    id: 'clean-masc-smart',
    label: 'Clean city uniform',
    vibe: 'clean',
    frame: 'masc',
    blurb: 'A cleaner menswear base with relaxed tailoring, a premium tee, and understated shoes.',
    queryHint: 'clean menswear',
    productIds: [
      'catalog-top-uniqlo-airism',
      'catalog-bottom-levis-501',
      'catalog-shoes-converse-chuck70',
      'catalog-hat-ralphlauren-cap',
      'catalog-eyewear-rayban-wayfarer',
    ],
  },
  {
    id: 'date-femme-afterdark',
    label: 'After dark polish',
    vibe: 'date',
    frame: 'fem',
    blurb: 'A dressier date build with a fitted top, tailored base, and jewelry-led finish.',
    queryHint: 'date night',
    productIds: [
      'catalog-top-aritzia-contour',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-stevemadden-heel',
      'catalog-jewelry-pandora-hoops',
      'catalog-bag-saintlaurent-le5a7',
    ],
  },
  {
    id: 'date-masc-polished',
    label: 'Polished night out',
    vibe: 'date',
    frame: 'masc',
    blurb: 'A polished menswear date look with a cleaner shirt, darker jacket, and sharper footwear.',
    queryHint: 'mens date night',
    productIds: [
      'catalog-outer-abercrombie-bomber',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-levis-501',
      'catalog-shoes-docmartens-1460',
      'catalog-eyewear-rayban-wayfarer',
    ],
  },
  {
    id: 'edgy-femme-night',
    label: 'Edgy gallery night',
    vibe: 'edgy',
    frame: 'fem',
    blurb: 'A darker feminine build with sharper layers and heavier footwear.',
    queryHint: 'edgy womenswear',
    productIds: [
      'catalog-outer-abercrombie-bomber',
      'catalog-top-zara-corset',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-docmartens-1460',
      'catalog-bag-saintlaurent-le5a7',
    ],
  },
  {
    id: 'edgy-masc-core',
    label: 'Workwear after dark',
    vibe: 'edgy',
    frame: 'masc',
    blurb: 'Structured workwear layers and heavier shoes for a darker everyday look.',
    queryHint: 'edgy menswear',
    productIds: [
      'catalog-outer-carhartt-detroit',
      'catalog-top-stussy-tee',
      'catalog-bottom-dickies-874',
      'catalog-shoes-docmartens-1460',
      'catalog-hat-carhartt-beanie',
    ],
  },
  {
    id: 'office-masc-refined',
    label: 'Refined office core',
    vibe: 'office',
    frame: 'masc',
    blurb: 'A more office-ready menswear build with a clean outer layer and structured separates.',
    queryHint: 'mens office wear',
    productIds: [
      'catalog-outer-zara-trench',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-abercrombie-tailored',
      'catalog-shoes-converse-chuck70',
      'catalog-bag-michaelkors-tote',
    ],
  },
  {
    id: 'vacation-masc-resort',
    label: 'Resort off-duty',
    vibe: 'vacation',
    frame: 'masc',
    blurb: 'An easy vacation set with softer basics, relaxed accessories, and warm-weather footwear.',
    queryHint: 'mens vacation outfit',
    productIds: [
      'catalog-hat-ralphlauren-cap',
      'catalog-top-uniqlo-airism',
      'catalog-bottom-levis-501',
      'catalog-shoes-birkenstock-boston',
      'catalog-bag-longchamp-lepliage',
    ],
  },
  {
    id: 'gym-femme-studio',
    label: 'Studio set',
    vibe: 'gym',
    frame: 'fem',
    blurb: 'A tighter studio-led activewear set with stronger womenswear picks and cleaner sneakers.',
    queryHint: 'womens gym set',
    productIds: [
      'catalog-top-lululemon-swiftly',
      'catalog-bottom-lululemon-align',
      'catalog-shoes-newbalance-530',
      'catalog-bag-lululemon-beltbag',
    ],
  },
  {
    id: 'gym-masc-training',
    label: 'Training uniform',
    vibe: 'gym',
    frame: 'masc',
    blurb: 'A menswear training build with a straightforward performance top and cleaner athletic base.',
    queryHint: 'mens gym fit',
    productIds: [
      'catalog-top-nike-tee',
      'catalog-bottom-nike-jogger',
      'catalog-shoes-newbalance-530',
      'catalog-hat-nike-club-cap',
    ],
  },
  {
    id: 'cozy-femme-weekend',
    label: 'Weekend soft layers',
    vibe: 'cozy',
    frame: 'fem',
    blurb: 'A softer cold-weather build with puffed outerwear and more feminine cozy accessories.',
    queryHint: 'cozy womenswear',
    productIds: [
      'catalog-outer-aritzia-superpuff',
      'catalog-top-skims-tank',
      'catalog-bottom-lululemon-align',
      'catalog-shoes-ugg-ultramini',
      'catalog-bag-coach-tabby',
    ],
  },
  {
    id: 'street-femme-downtown',
    label: 'Downtown femme street',
    vibe: 'street',
    frame: 'fem',
    blurb: 'A more feminine streetwear lane with a sharper jacket, denim base, and statement bag.',
    queryHint: 'femme streetwear',
    productIds: [
      'catalog-hat-nike-club-cap',
      'catalog-outer-adidas-firebird',
      'catalog-top-nike-tee',
      'catalog-bottom-agolde-90s',
      'catalog-shoes-nike-af1',
      'catalog-bag-telfar-shopping',
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
  customMaxCents?: number | null,
  usedIds?: Set<string>,
): Product | null {
  const originalHaystack = searchHaystack(product);
  const candidates = ALL_CATALOG_PRODUCTS
    .filter((candidate) => candidate.category === product.category)
    .filter(hasRealPhoto)
    .filter((candidate) => candidate.id !== product.id)
    .filter((candidate) => !budget || isUnderBudget(candidate, budget, customMaxCents))
    .filter((candidate) => !usedIds || !usedIds.has(candidate.id));

  if (!candidates.length) return null;

  return candidates
    .map((candidate) => {
      let score = 100;
      if (candidate.metadata?.featured) score += 20;
      if (normalize(candidate.brand) === normalize(product.brand)) score += 30;
      score += productCommerceScore(candidate);

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
  let score = product.metadata?.featured ? 12 : 4;
  score += productCommerceScore(product);
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
  customMaxCents,
  usedIds,
  avoidIds,
  usedBrands,
  collectionCandidates,
}: {
  slot: Category;
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  usedIds: Set<string>;
  avoidIds: Set<string>;
  usedBrands: Set<string>;
  collectionCandidates: Product[];
}): Product[] {
  const query = vibeSearchQuery(vibe, slot, budget, frame, customMaxCents);
  const intent = parseSearchIntentHeuristic(query, slot);
  intent.priceMax = Number.isFinite(getBudgetMaxCents(budget, customMaxCents))
    ? getBudgetMaxCents(budget, customMaxCents) / 100
    : null;
  intent.priceMin = null;
  const collectionIds = new Set(
    collectionCandidates
      .filter((product) => product.category === slot)
      .map((product) => product.id),
  );
  const searchedIds = new Set(
    dedupeProducts([
      ...searchPhotoCatalog(intent, query, 24),
      ...searchBrandCatalog(intent, query, 16),
    ]).map((product) => product.id),
  );

  const ranked = ALL_CATALOG_PRODUCTS
    .filter((product) => product.category === slot)
    .filter((product) => isUnderBudget(product, budget, customMaxCents))
    .filter((product) => !usedIds.has(product.id))
    .map((product) => ({
      product,
      score:
        scoreFallbackProduct(product, vibe, frame)
        + (collectionIds.has(product.id) ? 14 : 0)
        + (searchedIds.has(product.id) ? 24 : 0)
        - (usedBrands.has(normalize(product.brand)) ? 18 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product)
    .filter((product, index, list) => list.findIndex((entry) => entry.id === product.id) === index);

  const preferred = ranked.filter((product) => !avoidIds.has(product.id));
  const avoided = ranked.filter((product) => avoidIds.has(product.id));
  return [...preferred, ...avoided].slice(0, 36);
}

export function buildCatalogLook({
  vibe,
  frame,
  budget,
  customMaxCents,
  currentItems,
  mode,
  seed = 0,
  avoidProductIds = [],
}: {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  currentItems?: Partial<Record<Category, Product>>;
  mode: GeneratorMode;
  seed?: number;
  avoidProductIds?: string[];
}): {
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
} {
  const vibeConfig = VIBES.find((entry) => entry.id === vibe) || VIBES[0];
  const existingItems = currentItems || {};
  const targetSlots = resolveTargetSlots(mode, vibeConfig.slots, existingItems);
  const picked: Partial<Record<Category, Product>> = {};
  const usedIds = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );
  const usedBrands = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => normalize(product.brand)),
  );
  const avoidIds = new Set(avoidProductIds);

  const collections = getCollectionsFor(vibe, frame);
  const bestCollection = collections.length
    ? collections[(stableHash(`${vibe}:${frame}:${budget}:${customMaxCents || 0}`) + Math.abs(seed || 0)) % collections.length] || collections[0] || null
    : null;
  const collectionCandidates = dedupeProducts(
    [
      ...(bestCollection ? getCollectionProducts(bestCollection) : []),
      ...collections.flatMap((collection) => getCollectionProducts(collection)),
    ],
  );

  for (const slot of targetSlots) {
    if (mode === 'missing' && existingItems[slot]) continue;
    const candidatePool = getSlotCandidates({
      slot,
      vibe,
      frame,
      budget,
      customMaxCents,
      usedIds,
      avoidIds,
      usedBrands,
      collectionCandidates,
    });
    const chosen = chooseVariedCandidate(candidatePool, seed, `${vibe}:${frame}:${budget}:${customMaxCents || 0}:${slot}:catalog`);
    if (!chosen) continue;

    picked[slot] = chosen;
    usedIds.add(chosen.id);
    usedBrands.add(normalize(chosen.brand));
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
  customMaxCents,
  currentItems,
  mode,
  seed = 0,
  avoidProductIds = [],
}: {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  currentItems?: Partial<Record<Category, Product>>;
  mode: GeneratorMode;
  seed?: number;
  avoidProductIds?: string[];
}): Promise<{
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
  assistantMode: 'ai-assisted' | 'catalog';
}> {
  const base = buildCatalogLook({ vibe, frame, budget, customMaxCents, currentItems, mode, seed, avoidProductIds });
  const vibeConfig = VIBES.find((entry) => entry.id === vibe) || VIBES[0];
  const existingItems = currentItems || {};
  const targetSlots = resolveTargetSlots(mode, vibeConfig.slots, existingItems);
  const usedIds = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );
  const usedBrands = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => normalize(product.brand)),
  );
  const avoidIds = new Set(avoidProductIds);
  const collections = getCollectionsFor(vibe, frame);
  const chosenCollection = collections.length
    ? collections[(stableHash(`${vibe}:${frame}:${budget}:${customMaxCents || 0}:ai`) + Math.abs(seed || 0)) % collections.length] || collections[0] || null
    : null;
  const collectionCandidates = dedupeProducts(
    [
      ...(chosenCollection ? getCollectionProducts(chosenCollection) : []),
      ...collections.flatMap((collection) => getCollectionProducts(collection)),
    ],
  );
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const picked: Partial<Record<Category, Product>> = {};

  for (const slot of targetSlots) {
    if (mode === 'missing' && existingItems[slot]) continue;

    const candidatePool = getSlotCandidates({
      slot,
      vibe,
      frame,
      budget,
      customMaxCents,
      usedIds,
      avoidIds,
      usedBrands,
      collectionCandidates,
    });

    if (!candidatePool.length) continue;
    const photoFirstPool = candidatePool.filter(hasRealPhoto);
    const rankingPool = photoFirstPool.length ? photoFirstPool : candidatePool;

    const query = vibeSearchQuery(vibe, slot, budget, frame, customMaxCents);
    const intent = parseSearchIntentHeuristic(query, slot);
    intent.priceMax = Number.isFinite(getBudgetMaxCents(budget, customMaxCents))
      ? getBudgetMaxCents(budget, customMaxCents) / 100
      : null;
    intent.priceMin = null;
    const ranked = await rerankProducts(query, intent, rankingPool, Math.min(3, rankingPool.length));
    const variedRanked = ranked.filter((product) => !usedIds.has(product.id));
    const chosen =
      chooseVariedCandidate(variedRanked, seed, `${vibe}:${frame}:${budget}:${customMaxCents || 0}:${slot}:ai`)
      || variedRanked[0]
      || rankingPool[0];

    if (!chosen) continue;
    picked[slot] = chosen;
    usedIds.add(chosen.id);
    usedBrands.add(normalize(chosen.brand));
  }

  const mergedProducts = {
    ...base.products,
    ...picked,
  };

  for (const slot of targetSlots) {
    const current = mergedProducts[slot];
    if (!current) continue;
    if (!isUnderBudget(current, budget, customMaxCents)) {
      delete mergedProducts[slot];
    }
  }

  for (const slot of targetSlots) {
    const current = mergedProducts[slot];
    if (!current || hasRealPhoto(current)) continue;
    const replacement = findRealPhotoReplacement(current, budget, customMaxCents, usedIds);
    if (!replacement) continue;
    mergedProducts[slot] = replacement;
    usedIds.add(replacement.id);
  }

  const missingSlots = targetSlots.filter((slot) => !mergedProducts[slot] && !(mode === 'missing' && existingItems[slot]));

  return {
    products: mergedProducts,
    collection: base.collection,
    missingSlots,
    assistantMode: aiEnabled ? 'ai-assisted' : 'catalog',
  };
}
