import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildCatalogLook, getCollectionProducts, LAUNCH_COLLECTIONS } from '@/lib/catalog';
import { getOutfitProducts, repairOrRegenerateOutfit } from '@/lib/catalog-health';
import type { Category, Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';

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
  occasion?: string;
  story?: boolean;
  frameBias?: 'masc' | 'fem' | 'androgynous' | 'any';
  heroImageUrl?: string;
  sourceType?: 'editorial' | 'community' | 'discover' | 'catalog';
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
  postFit: (
    items: Partial<Record<Category, Product>>,
    options?: {
      title?: string;
      caption?: string;
      vibe?: string;
      occasion?: string;
      story?: boolean;
      visibility?: 'public' | 'private';
    },
  ) => FeedPost | null;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  addComment: (id: string, text: string) => void;
}

function sanitizeItems(items: Partial<Record<Category, Product>>): Partial<Record<Category, Product>> {
  return repairOrRegenerateOutfit({ items, vibe: 'clean', frame: 'any', budget: 'under250' });
}

function fitTotals(items: Partial<Record<Category, Product>>) {
  const products = getOutfitProducts(items);
  return {
    itemCount: products.length,
    totalCents: products.reduce((sum, product) => sum + (product.priceCents || 0), 0),
  };
}

function createTitle(items: Partial<Record<Category, Product>>, fallback = 'Posted fit'): string {
  const products = getOutfitProducts(items);
  const brands = Array.from(new Set(products.map((product) => product.brand))).slice(0, 2);
  if (!brands.length) return fallback;
  return brands.length === 1 ? `${brands[0]} fit` : `${brands.join(' + ')} fit`;
}

function itemsFromCollection(index: number): Partial<Record<Category, Product>> {
  const products = getCollectionProducts(LAUNCH_COLLECTIONS[index]);
  return repairOrRegenerateOutfit({
    items: Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>,
    vibe: LAUNCH_COLLECTIONS[index]?.vibe || 'clean',
    frame: LAUNCH_COLLECTIONS[index]?.frame === 'all' ? 'any' : LAUNCH_COLLECTIONS[index]?.frame,
    budget: 'under500',
    seed: index,
  });
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
): FeedPost {
  const totals = fitTotals(items);
  return {
    id,
    username,
    avatar,
    title,
    caption,
    vibe,
    frameBias,
    sourceType,
    tags,
    visibility: 'public',
    createdAt: new Date(Date.now() - (ageIndex + 1) * 18 * 60 * 60 * 1000).toISOString(),
    totalCents: totals.totalCents,
    itemCount: totals.itemCount,
    items,
    likeCount,
    liked: false,
    saved: false,
    comments: [
      { id: `${id}-c1`, user: '@maisonmira', text: 'Clean fit.', createdAt: new Date().toISOString() },
      { id: `${id}-c2`, user: '@closetlab', text: 'Would remix the shoes.', createdAt: new Date().toISOString() },
    ],
  };
}

const COLLECTION_POSTS = LAUNCH_COLLECTIONS.map((collection, index) => seedPost(
  itemsFromCollection(index),
  index,
  `feed-${collection.id}`,
  ['@selene.studio', '@downtown.dia', '@neutralindex', '@studioafter', '@workwearweek', '@resortfile', '@clubroom'][index % 7] || '@sylistly',
  collection.label.slice(0, 1).toUpperCase(),
  collection.label,
  collection.vibe === 'street' ? 'Streetwear' : collection.vibe.charAt(0).toUpperCase() + collection.vibe.slice(1),
  [collection.vibe, collection.queryHint, collection.frame === 'all' ? 'any frame' : `${collection.frame} bias`],
  420 - index * 9,
  collection.blurb,
  collection.frame === 'all' ? 'any' : collection.frame,
  'discover',
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
}> = [
  { id: 'coffee-clean-fem', title: 'Coffee run clean fit', caption: 'Soft neutrals with enough polish for errands that turn into plans.', vibe: 'clean', label: 'Clean', frame: 'fem', budget: 'under250', seed: 101, tags: ['clean', 'coffee run', 'minimal'] },
  { id: 'airport-neutral', title: 'Airport uniform', caption: 'A composed travel look with comfortable anchors and a sharp bag.', vibe: 'clean', label: 'Clean', frame: 'androgynous', budget: 'under250', seed: 102, tags: ['airport', 'neutral', 'travel'] },
  { id: 'street-femme-downtown', title: 'Downtown street edit', caption: 'Baggy shapes, black accessories, and a sneaker-first street formula.', vibe: 'street', label: 'Streetwear', frame: 'fem', budget: 'under500', seed: 201, tags: ['streetwear', 'downtown', 'sneakers'] },
  { id: 'street-masc-campus', title: 'Campus layers', caption: 'A layered street fit that reads casual without losing intent.', vibe: 'street', label: 'Streetwear', frame: 'masc', budget: 'under250', seed: 202, tags: ['college', 'layers', 'casual'] },
  { id: 'night-masc-polish', title: 'Night out masculine', caption: 'Sleek black pieces built for dinner, drinks, and a late checkout.', vibe: 'night', label: 'Night out', frame: 'masc', budget: 'under500', seed: 301, tags: ['night', 'black', 'polished'] },
  { id: 'night-femme-gold', title: 'Gold hour black fit', caption: 'A dressy black base with jewelry doing the final edit.', vibe: 'night', label: 'Night out', frame: 'fem', budget: 'under500', seed: 302, tags: ['night', 'jewelry', 'date'] },
  { id: 'date-femme-soft', title: 'Soft date night', caption: 'Fitted top, sharp bottom, and accessories with just enough shine.', vibe: 'date', label: 'Date night', frame: 'fem', budget: 'under250', seed: 401, tags: ['date', 'soft', 'polished'] },
  { id: 'date-masc-clean', title: 'Clean dinner fit', caption: 'A quiet polished fit that works before and after the reservation.', vibe: 'date', label: 'Date night', frame: 'masc', budget: 'under500', seed: 402, tags: ['date', 'clean', 'dinner'] },
  { id: 'gym-femme-studio', title: 'Studio to street', caption: 'Performance pieces that still feel intentional outside the gym.', vibe: 'gym', label: 'Gym', frame: 'fem', budget: 'under250', seed: 501, tags: ['gym', 'athletic', 'studio'] },
  { id: 'gym-masc-training', title: 'Training day', caption: 'A no-fuss athletic look with clean proportions and real utility.', vibe: 'gym', label: 'Gym', frame: 'masc', budget: 'under250', seed: 502, tags: ['training', 'athletic', 'gym'] },
  { id: 'office-fem-cream', title: 'Cream office uniform', caption: 'Tailored neutral pieces that look expensive without shouting.', vibe: 'office', label: 'Office', frame: 'fem', budget: 'under500', seed: 601, tags: ['office', 'tailored', 'cream'] },
  { id: 'office-masc-smart', title: 'Smart office rotation', caption: 'A clean workday formula with refined shoes and a structured layer.', vibe: 'office', label: 'Office', frame: 'masc', budget: 'under500', seed: 602, tags: ['office', 'smart', 'tailored'] },
  { id: 'vacation-femme-linen', title: 'Beach club neutral', caption: 'Linen, sunglasses, and vacation ease in one board.', vibe: 'vacation', label: 'Vacation', frame: 'fem', budget: 'under250', seed: 701, tags: ['beach', 'linen', 'summer'] },
  { id: 'vacation-masc-resort', title: 'Resort morning', caption: 'Lightweight pieces with a warm-weather shoe and tote energy.', vibe: 'vacation', label: 'Vacation', frame: 'masc', budget: 'under500', seed: 702, tags: ['vacation', 'resort', 'linen'] },
  { id: 'cozy-femme-weekend', title: 'Soft weekend stack', caption: 'Relaxed layers that still look curated for a cold coffee walk.', vibe: 'cozy', label: 'Cozy', frame: 'fem', budget: 'under250', seed: 801, tags: ['cozy', 'weekend', 'winter'] },
  { id: 'cozy-masc-winter', title: 'Winter off-duty', caption: 'Warm essentials arranged around boots, knit texture, and utility.', vibe: 'cozy', label: 'Cozy', frame: 'masc', budget: 'under500', seed: 802, tags: ['winter', 'cozy', 'layers'] },
  { id: 'preppy-femme-city', title: 'Preppy city look', caption: 'Classic pieces made current with a structured bag and crisp shoes.', vibe: 'preppy', label: 'Preppy', frame: 'fem', budget: 'under500', seed: 901, tags: ['preppy', 'old money', 'city'] },
  { id: 'preppy-masc-weekend', title: 'Clubhouse weekend', caption: 'A refined weekend board with loafers, knitwear, and easy polish.', vibe: 'preppy', label: 'Preppy', frame: 'masc', budget: 'under500', seed: 902, tags: ['old money', 'preppy', 'weekend'] },
  { id: 'edgy-femme-downtown', title: 'Edgy downtown', caption: 'Dark pieces, shine, and a little bite in the accessories.', vibe: 'edgy', label: 'Edgy', frame: 'fem', budget: 'under500', seed: 1001, tags: ['edgy', 'black', 'leather'] },
  { id: 'edgy-masc-tech', title: 'Techwear utility', caption: 'Black utility pieces with technical shape and a crossbody finish.', vibe: 'edgy', label: 'Techwear', frame: 'masc', budget: 'under500', seed: 1002, tags: ['techwear', 'utility', 'black'] },
];

function itemsFromGeneratedLook(plan: (typeof GENERATED_POST_PLAN)[number]): Partial<Record<Category, Product>> {
  const generated = buildCatalogLook({
    vibe: plan.vibe,
    frame: plan.frame,
    budget: plan.budget,
    mode: 'full',
    seed: plan.seed,
  }).products;
  return repairOrRegenerateOutfit({
    items: generated,
    vibe: plan.vibe,
    frame: plan.frame,
    budget: plan.budget,
    seed: plan.seed,
  });
}

const GENERATED_POSTS = GENERATED_POST_PLAN.map((plan, index) => seedPost(
  itemsFromGeneratedLook(plan),
  index + COLLECTION_POSTS.length,
  `feed-${plan.id}`,
  ['@styleloop', '@closetlab', '@fitarchive', '@outfitindex', '@wearfile'][index % 5] || '@sylistly',
  plan.title.slice(0, 1).toUpperCase(),
  plan.title,
  plan.label,
  plan.tags,
  360 - index * 7,
  plan.caption,
  plan.frame,
  'catalog',
));

const SEED_POSTS: FeedPost[] = [...COLLECTION_POSTS, ...GENERATED_POSTS].filter((post) => fitTotals(post.items).itemCount >= 4);
const FEED_STORAGE_VERSION = 3;
const MAX_PERSISTED_COMMUNITY_POSTS = 12;
const FEED_CATEGORY_ORDER: Category[] = ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'];
const SEED_POSTS_BY_ID = new Map(SEED_POSTS.map((post) => [post.id, post]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim() ? value : undefined;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 12);
}

function normalizeFrameBias(value: unknown, fallback: FeedPost['frameBias'] = 'any'): FeedPost['frameBias'] {
  return value === 'masc' || value === 'fem' || value === 'androgynous' || value === 'any' ? value : fallback;
}

function normalizeSourceType(value: unknown, fallback: FeedPost['sourceType'] = 'catalog'): FeedPost['sourceType'] {
  return value === 'editorial' || value === 'community' || value === 'discover' || value === 'catalog' ? value : fallback;
}

function normalizeVisibility(value: unknown): FeedPost['visibility'] {
  return value === 'private' ? 'private' : 'public';
}

function normalizeStoredItems(value: unknown): Partial<Record<Category, Product>> {
  if (!isRecord(value)) return {};
  const items: Partial<Record<Category, Product>> = {};

  for (const category of FEED_CATEGORY_ORDER) {
    const maybeProduct = value[category];
    if (isRecord(maybeProduct) && readString(maybeProduct.id)) {
      items[category] = maybeProduct as unknown as Product;
    }
  }

  return items;
}

function normalizeComments(value: unknown, postId: string): FeedComment[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 24)
    .map((comment, index) => {
      const record = isRecord(comment) ? comment : {};
      const text = readString(record.text);
      if (!text) return null;
      return {
        id: readString(record.id) || `${postId}-comment-${index}`,
        user: readString(record.user) || '@you',
        text,
        createdAt: readString(record.createdAt) || new Date().toISOString(),
      } satisfies FeedComment;
    })
    .filter((comment): comment is FeedComment => Boolean(comment));
}

function normalizeFeedPost(rawPost: unknown, seedFallback?: FeedPost): FeedPost | null {
  if (!isRecord(rawPost) && !seedFallback) return null;
  const record = isRecord(rawPost) ? rawPost : {};
  const id = readString(record.id) || seedFallback?.id;
  if (!id) return null;

  const vibe = readString(record.vibe) || seedFallback?.vibe || 'Clean';
  const frameBias = normalizeFrameBias(record.frameBias, seedFallback?.frameBias || 'any');
  const totalHint = readNumber(record.totalCents, seedFallback?.totalCents || 25000);
  const items = repairOrRegenerateOutfit({
    items: Object.keys(record).length ? normalizeStoredItems(record.items) : seedFallback?.items || {},
    vibe: vibe.toLowerCase(),
    frame: frameBias || 'any',
    budget: totalHint <= 25000 ? 'under250' : 'under500',
  });
  const totals = fitTotals(items);

  if (totals.itemCount < 4) return seedFallback || null;

  return {
    id,
    username: readString(record.username) || seedFallback?.username || '@sylistly',
    avatar: readString(record.avatar) || seedFallback?.avatar || 'S',
    title: readString(record.title) || seedFallback?.title || createTitle(items, 'Catalog fit'),
    caption: readString(record.caption) || seedFallback?.caption || 'A database-backed Sylistly outfit ready to remix.',
    vibe,
    occasion: readString(record.occasion) || seedFallback?.occasion,
    story: readBoolean(record.story, seedFallback?.story || false),
    frameBias,
    heroImageUrl: readString(record.heroImageUrl) || seedFallback?.heroImageUrl,
    sourceType: normalizeSourceType(record.sourceType, seedFallback?.sourceType || 'catalog'),
    tags: readStringArray(record.tags, seedFallback?.tags || [vibe.toLowerCase()]),
    visibility: normalizeVisibility(record.visibility || seedFallback?.visibility),
    createdAt: readString(record.createdAt) || seedFallback?.createdAt || new Date().toISOString(),
    totalCents: totals.totalCents,
    itemCount: totals.itemCount,
    items,
    likeCount: Math.max(0, Math.round(readNumber(record.likeCount, seedFallback?.likeCount || 0))),
    liked: readBoolean(record.liked, seedFallback?.liked || false),
    saved: readBoolean(record.saved, seedFallback?.saved || false),
    comments: normalizeComments(record.comments, id),
  };
}

function normalizePersistedState(persistedState: unknown): Pick<SocialFeedState, 'posts'> {
  const candidate = isRecord(persistedState) && isRecord(persistedState.state) ? persistedState.state : persistedState;
  const rawPosts = isRecord(candidate) ? candidate.posts : null;
  if (!Array.isArray(rawPosts)) return { posts: SEED_POSTS };

  const persistedPosts = rawPosts
    .map((rawPost) => {
      const postId = isRecord(rawPost) ? readString(rawPost.id) : undefined;
      return normalizeFeedPost(rawPost, postId ? SEED_POSTS_BY_ID.get(postId) : undefined);
    })
    .filter((post): post is FeedPost => Boolean(post));
  const persistedById = new Map(persistedPosts.map((post) => [post.id, post]));

  const mergedSeedPosts = SEED_POSTS.map((seedPost) => {
    const persistedPost = persistedById.get(seedPost.id);
    if (!persistedPost) return seedPost;
    return {
      ...seedPost,
      liked: persistedPost.liked,
      saved: persistedPost.saved,
      likeCount: Math.max(seedPost.likeCount, persistedPost.likeCount),
      comments: persistedPost.comments.length ? persistedPost.comments : seedPost.comments,
    };
  });
  const communityPosts = persistedPosts
    .filter((post) => !SEED_POSTS_BY_ID.has(post.id) && fitTotals(post.items).itemCount >= 4)
    .slice(0, MAX_PERSISTED_COMMUNITY_POSTS);
  const posts = [...communityPosts, ...mergedSeedPosts];

  return { posts: posts.length ? posts.slice(0, 60) : SEED_POSTS };
}

export const useSocialFeed = create<SocialFeedState>()(
  persist(
    (set) => ({
      posts: SEED_POSTS,
      postFit: (items, options) => {
        const selected = sanitizeItems(items);
        const totals = fitTotals(selected);
        if (!totals.itemCount) return null;
        const post: FeedPost = {
          id: `post-${Date.now()}`,
          username: '@you',
          avatar: 'Y',
          title: options?.title || createTitle(selected),
          caption: options?.caption || 'Posted from Builder. Remix it, lock the best pieces, and keep swiping.',
          vibe: options?.vibe || 'Builder',
          occasion: options?.occasion,
          story: options?.story || false,
          frameBias: 'any',
          sourceType: 'community',
          tags: [options?.occasion, options?.vibe || 'builder', options?.story ? 'story' : null, options?.visibility || 'public'].filter(Boolean) as string[],
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
        set((state) => ({ posts: [post, ...state.posts].slice(0, 48) }));
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
      version: FEED_STORAGE_VERSION,
      migrate: (persistedState) => normalizePersistedState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        posts: normalizePersistedState(persistedState).posts,
      }),
      partialize: (state) => ({ posts: state.posts }),
    },
  ),
);
