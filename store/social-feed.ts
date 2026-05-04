import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildCatalogLook, getCollectionProducts, LAUNCH_COLLECTIONS } from '@/lib/catalog';
import { sortFeedRenderableProducts } from '@/lib/product-image-quality';
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
  const products = sortFeedRenderableProducts(
    Object.values(items).filter((product): product is Product => Boolean(product)),
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
  { id: 'clean-masc-casual', title: 'Clean casual base', caption: 'A reliable neutral formula for everyday wear with room to remix.', vibe: 'clean', label: 'Clean', frame: 'masc', budget: 'under250', seed: 1101, tags: ['clean', 'casual', 'neutral'] },
  { id: 'street-any-black', title: 'Black street uniform', caption: 'Dark streetwear pieces with an easy sneaker finish.', vibe: 'street', label: 'Streetwear', frame: 'androgynous', budget: 'under500', seed: 1201, tags: ['streetwear', 'black', 'uniform'] },
  { id: 'office-any-soft', title: 'Soft workday edit', caption: 'Office pieces with a smoother, less corporate read.', vibe: 'office', label: 'Office', frame: 'androgynous', budget: 'under500', seed: 1301, tags: ['office', 'workwear', 'tailored'] },
  { id: 'night-any-luxe', title: 'Luxe monochrome', caption: 'A darker outfit board built around sleek shapes and shine.', vibe: 'night', label: 'Night out', frame: 'androgynous', budget: 'under500', seed: 1401, tags: ['luxury', 'night', 'monochrome'] },
];

function itemsFromGeneratedLook(plan: (typeof GENERATED_POST_PLAN)[number], cursor = 0, avoidProductIds: string[] = []): Partial<Record<Category, Product>> {
  const generated = buildCatalogLook({
    vibe: plan.vibe,
    frame: plan.frame,
    budget: plan.budget,
    mode: 'full',
    seed: plan.seed + cursor * 1_019,
    avoidProductIds,
  }).products;
  return sanitizeItems(generated);
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

function postSignature(items: Partial<Record<Category, Product>>): string {
  return Object.values(items)
    .filter((product): product is Product => Boolean(product))
    .map((product) => product.id)
    .sort()
    .join('|');
}

function recentProductIds(posts: FeedPost[]): string[] {
  return Array.from(new Set(
    posts
      .slice(0, 20)
      .flatMap((post) => Object.values(post.items).filter((product): product is Product => Boolean(product)).map((product) => product.id)),
  )).slice(0, 90);
}

function normalizeFeedPost(post: FeedPost): FeedPost | null {
  const items = sanitizeItems(post.items);
  const totals = fitTotals(items);
  if (totals.itemCount < 3) return null;
  return {
    ...post,
    items,
    itemCount: totals.itemCount,
    totalCents: totals.totalCents,
  };
}

function makeGeneratedPost(plan: (typeof GENERATED_POST_PLAN)[number], cursor: number, avoidProductIds: string[]): FeedPost | null {
  const items = itemsFromGeneratedLook(plan, cursor, avoidProductIds);
  const totals = fitTotals(items);
  if (totals.itemCount < 3) return null;
  return seedPost(
    items,
    cursor + COLLECTION_POSTS.length,
    `feed-${plan.id}-${cursor}`,
    ['@styleloop', '@closetlab', '@fitarchive', '@outfitindex', '@wearfile', '@cityuniform', '@dailyform'][cursor % 7] || '@sylistly',
    plan.title.slice(0, 1).toUpperCase(),
    plan.title,
    plan.label,
    plan.tags,
    Math.max(24, 330 - (cursor % 25) * 4),
    plan.caption,
    plan.frame,
    'catalog',
  );
}

function generateFeedBatch(existingPosts: FeedPost[], startCursor: number, count: number): { posts: FeedPost[]; cursor: number } {
  const signatures = new Set(existingPosts.map((post) => postSignature(post.items)).filter(Boolean));
  const batch: FeedPost[] = [];
  let cursor = startCursor;
  let attempts = 0;

  while (batch.length < count && attempts < count * 6) {
    const plan = GENERATED_POST_PLAN[cursor % GENERATED_POST_PLAN.length];
    const avoidProductIds = recentProductIds([...batch, ...existingPosts]);
    const post = makeGeneratedPost(plan, cursor, avoidProductIds);
    cursor += 1;
    attempts += 1;
    if (!post) continue;
    const signature = postSignature(post.items);
    if (!signature || signatures.has(signature)) continue;
    signatures.add(signature);
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
            posts: [...cleanExisting, ...generated.posts].slice(0, 140),
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
        set((state) => ({ posts: [post, ...state.posts].slice(0, 140) }));
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
      version: 3,
      migrate: (persistedState) => {
        const state = persistedState as Partial<SocialFeedState> | undefined;
        const posts = (state?.posts?.length ? state.posts : SEED_POSTS)
          .map(normalizeFeedPost)
          .filter((post): post is FeedPost => Boolean(post));
        const generationCursor = Number.isFinite(state?.generationCursor) ? Number(state?.generationCursor) : GENERATED_POST_PLAN.length;
        return {
          ...state,
          posts: posts.length >= 8 ? posts : SEED_POSTS,
          generationCursor,
        } as SocialFeedState;
      },
    },
  ),
);
