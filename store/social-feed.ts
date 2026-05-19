import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildCatalogLook,
  getBrandOrMerchant,
  getCollectionProducts,
  getShoeId,
  hydrateItemsFromCatalog,
  LAUNCH_COLLECTIONS,
  outfitCategorySignature,
  outfitFullSignature,
  outfitRequiredSignature,
} from '@/lib/catalog';
import { sortFeedRenderableProducts } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';

const FEED_POST_LIMIT = 360;

export interface FeedComment {
  id: string;
  user: string;
  text: string;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  username: string;
  avatar: string;
  title: string;
  caption?: string;
  vibe: string;
  frameBias?: 'masc' | 'fem' | 'androgynous' | 'any';
  heroImageUrl?: string;
  sourceType?: 'editorial' | 'community' | 'discover' | 'catalog';
  source?: 'launch' | 'generated-plan' | 'generated-live' | 'repaired' | 'first-screen';
  formulaId?: string;
  formulaLabel?: string;
  formulaStructure?: string;
  outfitReason?: string;
  tags: string[];
  visibility: 'public' | 'private';
  createdAt: string;
  totalCents: number;
  itemCount: number;
  items: Partial<Record<Category, Product>>;
  likeCount: number;
  liked: boolean;
  saved: boolean;
  comments: FeedComment[];
}

interface SocialFeedState {
  posts: FeedPost[];
  generationCursor: number;
  generateMorePosts: (count?: number) => void;
  postFit: (
    items: Partial<Record<Category, Product>>,
    options?: { title?: string; vibe?: string; visibility?: 'public' | 'private' },
  ) => FeedPost | null;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  addComment: (id: string, text: string) => void;
}

function sanitizeItems(items: Partial<Record<Category, Product>>): Partial<Record<Category, Product>> {
  const hydratedItems = hydrateItemsFromCatalog(items);
  const products = sortFeedRenderableProducts(
    Object.values(hydratedItems).filter((product): product is Product => Boolean(product)),
  );
  return Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
}

function fitTotals(items: Partial<Record<Category, Product>>) {
  const products = Object.values(items).filter((product): product is Product => Boolean(product));
  return {
    itemCount: products.length,
    totalCents: products.reduce((sum, product) => sum + (product.priceCents || 0), 0),
  };
}

function hasRequiredSlots(items: Partial<Record<Category, Product>>): boolean {
  return Boolean(items.top && items.bottom && items.shoes);
}

function createTitle(items: Partial<Record<Category, Product>>, fallback = 'Posted fit'): string {
  const products = Object.values(items).filter((product): product is Product => Boolean(product));
  const brands = Array.from(new Set(products.map((product) => product.brand))).slice(0, 2);
  if (!brands.length) return fallback;
  return brands.length === 1 ? `${brands[0]} fit` : `${brands.join(' + ')} fit`;
}

function itemsFromCollection(index: number): Partial<Record<Category, Product>> {
  const products = sortFeedRenderableProducts(getCollectionProducts(LAUNCH_COLLECTIONS[index]));
  return Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
}

function seedPost(
  items: Partial<Record<Category, Product>>,
  ageIndex: number,
  id: string,
  username: string,
  avatar: string,
  title: string,
  vibe: string,
  tags: string[],
  likeCount: number,
  caption: string,
  frameBias: FeedPost['frameBias'] = 'any',
  sourceType: FeedPost['sourceType'] = 'catalog',
  formula?: { id: string; label: string; structure: string; reason: string },
  source: FeedPost['source'] = 'generated-plan',
): FeedPost {
  const sanitized = sanitizeItems(items);
  const totals = fitTotals(sanitized);
  return {
    id,
    username,
    avatar,
    title,
    caption,
    vibe,
    frameBias,
    sourceType,
    source,
    formulaId: formula?.id,
    formulaLabel: formula?.label,
    formulaStructure: formula?.structure,
    outfitReason: formula?.reason,
    tags,
    visibility: 'public',
    createdAt: new Date(Date.now() - (ageIndex + 1) * 18 * 60 * 60 * 1000).toISOString(),
    totalCents: totals.totalCents,
    itemCount: totals.itemCount,
    items: sanitized,
    likeCount,
    liked: false,
    saved: false,
    comments: [
      { id: `${id}-c1`, user: '@maisonmira', text: 'Clean fit.', createdAt: new Date().toISOString() },
      { id: `${id}-c2`, user: '@closetlab', text: 'Would remix the shoes.', createdAt: new Date().toISOString() },
    ],
  };
}

// Collection-derived seed posts namespace their IDs with `feed-launch-` so
// they cannot collide with generated-plan posts (`feed-plan-…`). Several
// LAUNCH_COLLECTIONS ids (vacation-masc-resort, street-femme-downtown,
// gym-femme-studio, gym-masc-training, cozy-femme-weekend) appear with the
// SAME literal id in GENERATED_POST_PLAN below — without namespacing, both
// produced `feed-X` and React fired duplicate-key warnings on /feed.
const COLLECTION_POSTS = LAUNCH_COLLECTIONS.map((collection, index) => seedPost(
  itemsFromCollection(index),
  index,
  `feed-launch-${collection.id}`,
  ['@selene.studio', '@downtown.dia', '@neutralindex', '@studioafter', '@workwearweek', '@resortfile', '@clubroom'][index % 7] || '@sylistly',
  collection.label.slice(0, 1).toUpperCase(),
  collection.label,
  collection.vibe === 'street' ? 'Streetwear' : collection.vibe.charAt(0).toUpperCase() + collection.vibe.slice(1),
  [collection.vibe, collection.queryHint, collection.frame === 'all' ? 'any frame' : `${collection.frame} bias`],
  420 - index * 9,
  collection.blurb,
  collection.frame === 'all' ? 'any' : collection.frame,
  'discover',
  undefined,
  'launch',
));

const GENERATED_POST_PLAN: Array<{
  id: string;
  title: string;
  caption: string;
  vibe: VibeId;
  label: string;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  seed: number;
  tags: string[];
  formulaId: string;
}> = [
  { id: 'coffee-clean-fem', title: 'Coffee run clean fit', caption: 'Soft neutrals with enough polish for errands that turn into plans.', vibe: 'clean', label: 'Clean', frame: 'fem', budget: 'under250', seed: 101, tags: ['clean', 'coffee run', 'minimal'], formulaId: 'clean-elevated' },
  { id: 'airport-neutral', title: 'Airport uniform', caption: 'A composed travel look with comfortable anchors and a sharp bag.', vibe: 'clean', label: 'Clean', frame: 'androgynous', budget: 'under250', seed: 102, tags: ['airport', 'neutral', 'travel'], formulaId: 'travel-airport' },
  { id: 'street-femme-downtown', title: 'Downtown street edit', caption: 'Baggy shapes, black accessories, and a sneaker-first street formula.', vibe: 'street', label: 'Streetwear', frame: 'fem', budget: 'under500', seed: 201, tags: ['streetwear', 'downtown', 'sneakers'], formulaId: 'streetwear-sneaker-led' },
  { id: 'street-masc-campus', title: 'Campus layers', caption: 'A layered street fit that reads casual without losing intent.', vibe: 'street', label: 'Streetwear', frame: 'masc', budget: 'under250', seed: 202, tags: ['college', 'layers', 'casual'], formulaId: 'campus-cozy' },
  { id: 'night-masc-polish', title: 'Night out masculine', caption: 'Sleek black pieces built for dinner, drinks, and a late checkout.', vibe: 'night', label: 'Night out', frame: 'masc', budget: 'under500', seed: 301, tags: ['night', 'black', 'polished'], formulaId: 'night-out' },
  { id: 'night-femme-gold', title: 'Gold hour black fit', caption: 'A dressy black base with jewelry doing the final edit.', vibe: 'night', label: 'Night out', frame: 'fem', budget: 'under500', seed: 302, tags: ['night', 'jewelry', 'date'], formulaId: 'date-polished' },
  { id: 'date-femme-soft', title: 'Soft date night', caption: 'Fitted top, sharp bottom, and accessories with just enough shine.', vibe: 'date', label: 'Date night', frame: 'fem', budget: 'under250', seed: 401, tags: ['date', 'soft', 'polished'], formulaId: 'date-polished' },
  { id: 'date-masc-clean', title: 'Clean dinner fit', caption: 'A quiet polished fit that works before and after the reservation.', vibe: 'date', label: 'Date night', frame: 'masc', budget: 'under500', seed: 402, tags: ['date', 'clean', 'dinner'], formulaId: 'date-polished' },
  { id: 'gym-femme-studio', title: 'Studio to street', caption: 'Performance pieces that still feel intentional outside the gym.', vibe: 'gym', label: 'Gym', frame: 'fem', budget: 'under250', seed: 501, tags: ['gym', 'athletic', 'studio'], formulaId: 'gym-training' },
  { id: 'gym-masc-training', title: 'Training day', caption: 'A no-fuss athletic look with clean proportions and real utility.', vibe: 'gym', label: 'Gym', frame: 'masc', budget: 'under250', seed: 502, tags: ['training', 'athletic', 'gym'], formulaId: 'gym-training' },
  { id: 'office-fem-cream', title: 'Cream office uniform', caption: 'Tailored neutral pieces that look expensive without shouting.', vibe: 'office', label: 'Office', frame: 'fem', budget: 'under500', seed: 601, tags: ['office', 'tailored', 'cream'], formulaId: 'office-smart-casual' },
  { id: 'office-masc-smart', title: 'Smart office rotation', caption: 'A clean workday formula with refined shoes and a structured layer.', vibe: 'office', label: 'Office', frame: 'masc', budget: 'under500', seed: 602, tags: ['office', 'smart', 'tailored'], formulaId: 'office-smart-casual' },
  { id: 'vacation-femme-linen', title: 'Beach club neutral', caption: 'Linen, sunglasses, and vacation ease in one board.', vibe: 'vacation', label: 'Vacation', frame: 'fem', budget: 'under250', seed: 701, tags: ['beach', 'linen', 'summer'], formulaId: 'vacation-resort' },
  { id: 'vacation-masc-resort', title: 'Resort morning', caption: 'Lightweight pieces with a warm-weather shoe and tote energy.', vibe: 'vacation', label: 'Vacation', frame: 'masc', budget: 'under500', seed: 702, tags: ['vacation', 'resort', 'linen'], formulaId: 'vacation-resort' },
  { id: 'cozy-femme-weekend', title: 'Soft weekend stack', caption: 'Relaxed layers that still look curated for a cold coffee walk.', vibe: 'cozy', label: 'Cozy', frame: 'fem', budget: 'under250', seed: 801, tags: ['cozy', 'weekend', 'winter'], formulaId: 'campus-cozy' },
  { id: 'cozy-masc-winter', title: 'Winter off-duty', caption: 'Warm essentials arranged around boots, knit texture, and utility.', vibe: 'cozy', label: 'Cozy', frame: 'masc', budget: 'under500', seed: 802, tags: ['winter', 'cozy', 'layers'], formulaId: 'travel-airport' },
  { id: 'preppy-femme-city', title: 'Preppy city look', caption: 'Classic pieces made current with a structured bag and crisp shoes.', vibe: 'preppy', label: 'Preppy', frame: 'fem', budget: 'under500', seed: 901, tags: ['preppy', 'old money', 'city'], formulaId: 'old-money-knit' },
  { id: 'preppy-masc-weekend', title: 'Clubhouse weekend', caption: 'A refined weekend board with loafers, knitwear, and easy polish.', vibe: 'preppy', label: 'Preppy', frame: 'masc', budget: 'under500', seed: 902, tags: ['old money', 'preppy', 'weekend'], formulaId: 'old-money-knit' },
  { id: 'edgy-femme-downtown', title: 'Edgy downtown', caption: 'Dark pieces, shine, and a little bite in the accessories.', vibe: 'edgy', label: 'Edgy', frame: 'fem', budget: 'under500', seed: 1001, tags: ['edgy', 'black', 'leather'], formulaId: 'techwear-utility' },
  { id: 'edgy-masc-tech', title: 'Techwear utility', caption: 'Black utility pieces with technical shape and a crossbody finish.', vibe: 'edgy', label: 'Techwear', frame: 'masc', budget: 'under500', seed: 1002, tags: ['techwear', 'utility', 'black'], formulaId: 'techwear-utility' },
  { id: 'clean-masc-casual', title: 'Clean casual base', caption: 'A reliable neutral formula for everyday wear with room to remix.', vibe: 'clean', label: 'Clean', frame: 'masc', budget: 'under250', seed: 1101, tags: ['clean', 'casual', 'neutral'], formulaId: 'clean-elevated' },
  { id: 'street-any-black', title: 'Black street uniform', caption: 'Dark streetwear pieces with an easy sneaker finish.', vibe: 'street', label: 'Streetwear', frame: 'androgynous', budget: 'under500', seed: 1201, tags: ['streetwear', 'black', 'uniform'], formulaId: 'streetwear-sneaker-led' },
  { id: 'office-any-soft', title: 'Soft workday edit', caption: 'Office pieces with a smoother, less corporate read.', vibe: 'office', label: 'Office', frame: 'androgynous', budget: 'under500', seed: 1301, tags: ['office', 'workwear', 'tailored'], formulaId: 'office-smart-casual' },
  { id: 'night-any-luxe', title: 'Luxe monochrome', caption: 'A darker outfit board built around sleek shapes and shine.', vibe: 'night', label: 'Night out', frame: 'androgynous', budget: 'under500', seed: 1401, tags: ['luxury', 'night', 'monochrome'], formulaId: 'date-polished' },
];

function generatedLookFromPlan(
  plan: (typeof GENERATED_POST_PLAN)[number],
  cursor = 0,
  options: {
    avoidProductIds?: string[];
    avoidComboSignatures?: string[];
    recentShoeIds?: string[];
    recentBrandCounts?: Record<string, number>;
  } = {},
): { items: Partial<Record<Category, Product>>; formula: { id: string; label: string; structure: string; reason: string } } {
  const generated = buildCatalogLook({
    vibe: plan.vibe,
    frame: plan.frame,
    budget: plan.budget,
    mode: 'full',
    seed: plan.seed + cursor * 1_019,
    avoidProductIds: options.avoidProductIds || [],
    avoidComboSignatures: options.avoidComboSignatures || [],
    recentShoeIds: options.recentShoeIds || [],
    recentBrandCounts: options.recentBrandCounts,
    preferredFormulaId: plan.formulaId,
    diversityStrength: 'high',
  });
  return {
    items: sanitizeItems(generated.products),
    formula: {
      id: generated.formula.id,
      label: generated.formula.label,
      structure: generated.formula.structure,
      reason: generated.formula.reason,
    },
  };
}

const GENERATED_POSTS = GENERATED_POST_PLAN.map((plan, index) => {
  const generated = generatedLookFromPlan(plan);
  return seedPost(
    generated.items,
    index + COLLECTION_POSTS.length,
    // Generated-plan posts get a `feed-plan-` prefix so they cannot collide
    // with `feed-launch-*` collection posts even when both lists share an
    // id like `vacation-masc-resort`. See COLLECTION_POSTS for context.
    `feed-plan-${plan.id}`,
    ['@styleloop', '@closetlab', '@fitarchive', '@outfitindex', '@wearfile'][index % 5] || '@sylistly',
    plan.title.slice(0, 1).toUpperCase(),
    plan.title,
    plan.label,
    plan.tags,
    360 - index * 7,
    plan.caption,
    plan.frame,
    'catalog',
    generated.formula,
    'generated-plan',
  );
});

const FIRST_SCREEN_POST_IDS = [
  'feed-plan-airport-neutral',
  'feed-plan-street-femme-downtown',
  'feed-plan-street-masc-campus',
  'feed-plan-gym-masc-training',
  'feed-plan-date-femme-soft',
  'feed-plan-vacation-femme-linen',
  'feed-plan-office-masc-smart',
  'feed-plan-preppy-masc-weekend',
  'feed-plan-edgy-masc-tech',
  'feed-plan-night-femme-gold',
];

function prioritizeFirstScreenPosts(posts: FeedPost[]): FeedPost[] {
  const order = new Map(FIRST_SCREEN_POST_IDS.map((id, index) => [id, index]));
  return [...posts].sort((left, right) => {
    const leftOrder = order.get(left.id) ?? 999;
    const rightOrder = order.get(right.id) ?? 999;
    return leftOrder - rightOrder;
  });
}

/**
 * Defense-in-depth dedupe by id. The namespaced prefixes already prevent
 * cross-source collisions; this also catches any future within-list
 * duplicate silently rather than crashing React with a key warning.
 */
function dedupeFeedPostsById(posts: FeedPost[]): FeedPost[] {
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    out.push(post);
  }
  return out;
}

const SEED_POSTS: FeedPost[] = prioritizeFirstScreenPosts(dedupeFeedPostsById(
  // Require ≥ 5 sanitized products per seed post. OutfitBoard renders an
  // 8-slot absolute-positioned collage; posts with only 3-4 products leave
  // 4-5 visibly empty slot positions and look broken on the first /feed
  // page. The launch + generated catalog easily produces 5+ piece outfits;
  // sparse seeds (mostly legacy LAUNCH_COLLECTIONS with dead product refs)
  // get filtered out.
  [...COLLECTION_POSTS, ...GENERATED_POSTS].filter((post) => fitTotals(post.items).itemCount >= 5 && hasRequiredSlots(post.items)),
));

function recentProductIds(posts: FeedPost[]): string[] {
  return Array.from(new Set(
    posts
      .slice(-28)
      .flatMap((post) => Object.values(post.items).filter((product): product is Product => Boolean(product)).map((product) => product.id)),
  )).slice(0, 90);
}

function capFeedPosts(posts: FeedPost[], limit = FEED_POST_LIMIT): FeedPost[] {
  if (posts.length <= limit) return posts;
  return posts.slice(posts.length - limit);
}

function normalizeFeedPost(post: FeedPost): FeedPost | null {
  const items = sanitizeItems(post.items);
  const totals = fitTotals(items);
  // Persisted state must also clear the 5-product board minimum (see
  // SEED_POSTS construction). Posts that fall below after sanitize get
  // dropped on rehydration rather than rendering with empty board slots.
  if (totals.itemCount < 5 || !hasRequiredSlots(items)) return null;
  return {
    ...post,
    items,
    itemCount: totals.itemCount,
    totalCents: totals.totalCents,
  };
}

function mergePersistedPostsWithSeeds(persistedPosts?: FeedPost[]): FeedPost[] {
  const cleanPersisted = (persistedPosts || [])
    .map(normalizeFeedPost)
    .filter((post): post is FeedPost => Boolean(post));
  const persistedById = new Map(cleanPersisted.map((post) => [post.id, post]));
  const seedIds = new Set(SEED_POSTS.map((post) => post.id));

  const mergedSeeds = SEED_POSTS.map((seed) => {
    const persisted = persistedById.get(seed.id);
    if (!persisted) return seed;
    return {
      ...seed,
      liked: Boolean(persisted.liked),
      saved: Boolean(persisted.saved),
      likeCount: Math.max(seed.likeCount, persisted.likeCount || 0),
      comments: persisted.comments?.length ? persisted.comments : seed.comments,
    };
  });

  const userPosts = cleanPersisted
    .filter((post) => post.sourceType === 'community' && !seedIds.has(post.id))
    .slice(0, 12);

  return dedupeFeedPostsById([...mergedSeeds, ...userPosts]);
}

function makeGeneratedPost(
  plan: (typeof GENERATED_POST_PLAN)[number],
  cursor: number,
  options: {
    avoidProductIds?: string[];
    avoidComboSignatures?: string[];
    recentShoeIds?: string[];
    recentBrandCounts?: Record<string, number>;
  },
): FeedPost | null {
  const generated = generatedLookFromPlan(plan, cursor, options);
  const items = generated.items;
  const totals = fitTotals(items);
  // Streaming generated posts also clear the 5-product board minimum so
  // infinite-scroll never injects a sparse "broken-looking" card. The
  // generateFeedBatch retry budget (count * 8) is generous enough to
  // tolerate the higher rejection rate.
  if (totals.itemCount < 5 || !hasRequiredSlots(items)) return null;
  return seedPost(
    items,
    cursor + COLLECTION_POSTS.length,
    // Streaming feed posts use `feed-plan-${id}-${cursor}` so they also
    // share the `feed-plan-` namespace and can never collide with seed
    // collection posts (`feed-launch-…`).
    `feed-plan-${plan.id}-${cursor}`,
    ['@styleloop', '@closetlab', '@fitarchive', '@outfitindex', '@wearfile', '@cityuniform', '@dailyform'][cursor % 7] || '@sylistly',
    plan.title.slice(0, 1).toUpperCase(),
    plan.title,
    plan.label,
    plan.tags,
    Math.max(24, 330 - (cursor % 25) * 4),
    plan.caption,
    plan.frame,
    'catalog',
    generated.formula,
    'generated-live',
  );
}

/**
 * Per-shoe usage cap when generating a streaming feed batch. The catalog
 * has only ~63 shoes; without this guard the same Steve Madden Slingback /
 * Nike Air Force / Birkenstock Boston dominate the entire feed because
 * they outscore lower-quality alternatives every call.
 */
const FEED_SHOE_REPEAT_CAP = 2;

/**
 * Per-brand cap on top/bottom/outer/bag picks across a streaming batch.
 * Same rationale — prevents one brand monopolising the visible feed.
 */
const FEED_BRAND_REPEAT_CAP = 3;

function shoesId(post: FeedPost): string | undefined {
  return getShoeId(post.items) || undefined;
}

function postPrimaryBrands(post: FeedPost): string[] {
  const slots: Category[] = ['top', 'bottom', 'outer', 'bag'];
  return slots
    .map((slot) => getBrandOrMerchant(post.items[slot]))
    .filter((brand): brand is string => Boolean(brand));
}

function generateFeedBatch(existingPosts: FeedPost[], startCursor: number, count: number): { posts: FeedPost[]; cursor: number } {
  const requiredSignatures = new Set(existingPosts.map((post) => outfitRequiredSignature(post.items)).filter(Boolean));
  const fullSignatures = new Set(existingPosts.map((post) => outfitFullSignature(post.items)).filter(Boolean));
  const categoryStructureCounts = new Map<string, number>();
  const shoeCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  for (const post of existingPosts) {
    const sid = shoesId(post);
    if (sid) shoeCounts.set(sid, (shoeCounts.get(sid) || 0) + 1);
    for (const brand of postPrimaryBrands(post)) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    }
    const structure = outfitCategorySignature(post.items);
    categoryStructureCounts.set(structure, (categoryStructureCounts.get(structure) || 0) + 1);
  }
  const batch: FeedPost[] = [];
  let cursor = startCursor;
  let attempts = 0;

  while (batch.length < count && attempts < count * 8) {
    const plan = GENERATED_POST_PLAN[cursor % GENERATED_POST_PLAN.length];
    // Build avoid list: rolling recent IDs + over-capped shoes that we
    // want the generator to actively avoid this iteration.
    const overUsedShoes = Array.from(shoeCounts.entries())
      .filter(([, n]) => n >= FEED_SHOE_REPEAT_CAP)
      .map(([id]) => id);
    const avoidProductIds = Array.from(new Set([
      ...recentProductIds([...batch, ...existingPosts]),
      ...overUsedShoes,
    ])).slice(0, 120);

    const post = makeGeneratedPost(plan, cursor, {
      avoidProductIds,
      avoidComboSignatures: [
        ...Array.from(requiredSignatures),
        ...Array.from(fullSignatures),
      ].slice(-80),
      recentShoeIds: Array.from(shoeCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 18)
        .map(([id]) => id),
      recentBrandCounts: Object.fromEntries(brandCounts),
    });
    cursor += 1;
    attempts += 1;
    if (!post) continue;

    // Reject duplicate combo signatures outright — exact same top+bottom+
    // shoes+accessories combination as an earlier post.
    const requiredSignature = outfitRequiredSignature(post.items);
    const fullSignature = outfitFullSignature(post.items);
    if (!requiredSignature || requiredSignatures.has(requiredSignature) || fullSignatures.has(fullSignature)) continue;

    // Reject when this post's shoes have already hit the cap and we still
    // have other plans we could try. Falls through after cap exhaustion
    // so we never starve the feed entirely.
    const sid = shoesId(post);
    if (sid) {
      const used = shoeCounts.get(sid) || 0;
      if (used >= FEED_SHOE_REPEAT_CAP && attempts < count * 6) continue;
    }

    // Reject when this post would push a brand past the brand cap. Same
    // soft-rejection — only enforced while we still have retry budget.
    const brands = postPrimaryBrands(post);
    const wouldOvercap = brands.some((brand) => (brandCounts.get(brand) || 0) >= FEED_BRAND_REPEAT_CAP);
    if (wouldOvercap && attempts < count * 6) continue;
    const structure = outfitCategorySignature(post.items);
    const structureCount = categoryStructureCounts.get(structure) || 0;
    if (structureCount >= 6 && attempts < count * 6) continue;

    // Accept.
    requiredSignatures.add(requiredSignature);
    fullSignatures.add(fullSignature);
    if (sid) shoeCounts.set(sid, (shoeCounts.get(sid) || 0) + 1);
    for (const brand of brands) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    }
    categoryStructureCounts.set(structure, structureCount + 1);
    batch.push(post);
  }

  return { posts: batch, cursor };
}

export const useSocialFeed = create<SocialFeedState>()(
  persist(
    (set) => ({
      posts: SEED_POSTS,
      generationCursor: GENERATED_POST_PLAN.length,
      generateMorePosts: (count = 12) =>
        set((state) => {
          const cleanExisting = state.posts
            .map(normalizeFeedPost)
            .filter((post): post is FeedPost => Boolean(post));
          const generated = generateFeedBatch(cleanExisting, state.generationCursor || 0, count);
          return {
            posts: capFeedPosts([...cleanExisting, ...generated.posts]),
            generationCursor: generated.cursor,
          };
        }),
      postFit: (items, options) => {
        const selected = sanitizeItems(items);
        const totals = fitTotals(selected);
        if (totals.itemCount < 3) return null;
        const post: FeedPost = {
          id: `post-${Date.now()}`,
          username: '@you',
          avatar: 'Y',
          title: options?.title || createTitle(selected),
          caption: 'Posted from Builder. Remix it, lock the best pieces, and keep swiping.',
          vibe: options?.vibe || 'Builder',
          frameBias: 'any',
          sourceType: 'community',
          tags: [options?.vibe || 'builder', options?.visibility || 'public'].filter(Boolean),
          visibility: options?.visibility || 'public',
          createdAt: new Date().toISOString(),
          totalCents: totals.totalCents,
          itemCount: totals.itemCount,
          items: selected,
          likeCount: 0,
          liked: false,
          saved: false,
          comments: [],
        };
        set((state) => ({ posts: [post, ...state.posts].slice(0, FEED_POST_LIMIT) }));
        return post;
      },
      toggleLike: (id) =>
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === id
              ? { ...post, liked: !post.liked, likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)) }
              : post,
          ),
        })),
      toggleSave: (id) =>
        set((state) => ({
          posts: state.posts.map((post) => (post.id === id ? { ...post, saved: !post.saved } : post)),
        })),
      addComment: (id, text) =>
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === id
              ? {
                  ...post,
                  comments: [
                    ...post.comments,
                    { id: `comment-${Date.now()}`, user: '@you', text, createdAt: new Date().toISOString() },
                  ],
                }
              : post,
          ),
        })),
    }),
    {
      name: 'sylistly.social-feed.v1',
      // Bumped 4 → 5 because the per-post product minimum changed (3 → 5):
      // posts persisted at v4 with itemCount=3-4 would re-render with empty
      // OutfitBoard slot positions. Resetting on bump ensures existing
      // users see the new fully-populated feed on first load after deploy.
      // (Earlier v3 → v4 bump was for the namespaced `feed-launch-X` /
      // `feed-plan-X` id format.)
      // Current v6 restores generated seeds first, then merges persisted
      // interactions, so old localStorage cannot keep a stale first screen.
      version: 7,
      migrate: (persistedState) => {
        const state = persistedState as Partial<SocialFeedState> | undefined;
        const posts = mergePersistedPostsWithSeeds(state?.posts);
        const generationCursor = Number.isFinite(state?.generationCursor) ? Number(state?.generationCursor) : GENERATED_POST_PLAN.length;
        return {
          ...state,
          posts: posts.length >= 8 ? posts : SEED_POSTS,
          generationCursor,
        } as SocialFeedState;
      },
      onRehydrateStorage: () => (state) => {
        if (!state?.posts) return;
        const posts = mergePersistedPostsWithSeeds(state.posts);
        state.posts = posts.length >= 8 ? posts : SEED_POSTS;
      },
    },
  ),
);
