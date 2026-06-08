import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildCatalogLook,
  CLIENT_CATALOG_PRODUCTS,
  getBrandOrMerchant,
  getCollectionProducts,
  getShoeId,
  LAUNCH_COLLECTIONS,
  outfitCategorySignature,
  outfitFullSignature,
  outfitRequiredSignature,
} from '@/lib/client-catalog';
import { hasExactProductLink, productImageQualityScore, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';
import aiFeedLooksRaw from '../data/ai-feed-looks.json';

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

export interface FeedGenerationOptions {
  vibe?: VibeId | 'any';
  frame?: GeneratorFrame | 'any';
  budget?: GeneratorBudget;
}

interface SocialFeedState {
  posts: FeedPost[];
  generationCursor: number;
  generateMorePosts: (count?: number, options?: FeedGenerationOptions) => void;
  postFit: (
    items: Partial<Record<Category, Product>>,
    options?: { title?: string; vibe?: string; visibility?: 'public' | 'private' },
  ) => FeedPost | null;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  addComment: (id: string, text: string) => void;
}

function sanitizeItems(items: Partial<Record<Category, Product>>): Partial<Record<Category, Product>> {
  const products = sortTransparentFeedRenderableProducts(
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

function hasRequiredSlots(items: Partial<Record<Category, Product>>): boolean {
  return Boolean(items.top && items.bottom && items.shoes);
}

function feedQualityProducts(items: Partial<Record<Category, Product>>): Product[] {
  return sortTransparentFeedRenderableProducts(
    Object.values(items).filter((product): product is Product => Boolean(product)),
  );
}

function exactLinkedProductCount(items: Partial<Record<Category, Product>>): number {
  return feedQualityProducts(items).filter(hasExactProductLink).length;
}

function feedOutfitQualityScore(items: Partial<Record<Category, Product>>): number {
  const products = feedQualityProducts(items);
  if (!products.length) return -999;
  const exactCount = products.filter(hasExactProductLink).length;
  const categoryCount = new Set(products.map((product) => product.category)).size;
  const averageImageScore = products.reduce((sum, product) => sum + productImageQualityScore(product), 0) / products.length;
  return (
    averageImageScore
    + products.length * 12
    + categoryCount * 7
    + exactCount * 28
    + (hasRequiredSlots(items) ? 70 : -120)
  );
}

function postMeetsFeedQualityFloor(items: Partial<Record<Category, Product>>): boolean {
  const products = feedQualityProducts(items);
  if (products.length < 3 || !hasRequiredSlots(items)) return false;
  const exactMinimum = Math.min(2, Math.max(1, Math.floor(products.length / 3)));
  if (exactLinkedProductCount(items) < exactMinimum) return false;
  return feedOutfitQualityScore(items) > 90;
}

function createTitle(items: Partial<Record<Category, Product>>, fallback = 'Posted fit'): string {
  const products = Object.values(items).filter((product): product is Product => Boolean(product));
  const brands = Array.from(new Set(products.map((product) => product.brand))).slice(0, 2);
  if (!brands.length) return fallback;
  return brands.length === 1 ? `${brands[0]} fit` : `${brands.join(' + ')} fit`;
}

function itemsFromCollection(index: number): Partial<Record<Category, Product>> {
  const products = sortTransparentFeedRenderableProducts(getCollectionProducts(LAUNCH_COLLECTIONS[index]));
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
    transparentOnly: true,
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

// Generated-plan posts are not bulk-built at module load. The first-screen
// posts below use a small deterministic generator pass with diversity history
// so the feed opens with real transparent boards without hard-coded repeats.
const GENERATED_POSTS: FeedPost[] = [];

const REAL_CUTOUT_SEED_PLAN: Array<{
  id: string;
  title: string;
  caption: string;
  vibe: string;
  tags: string[];
  frameBias: FeedPost['frameBias'];
  optional: Category[];
  username: string;
  avatar: string;
  likeCount: number;
}> = [
  {
    id: 'clean-capsule',
    title: 'Clean capsule edit',
    caption: 'A simple transparent-cutout board built from real linked pieces.',
    vibe: 'Clean',
    tags: ['clean', 'capsule', 'real links'],
    frameBias: 'any',
    optional: ['outer', 'bag', 'eyewear'],
    username: '@cutoutfile',
    avatar: 'C',
    likeCount: 348,
  },
  {
    id: 'street-sneaker',
    title: 'Sneaker-led street board',
    caption: 'The shoe carries the read while the core pieces stay easy to remix.',
    vibe: 'Streetwear',
    tags: ['streetwear', 'sneakers', 'remixable'],
    frameBias: 'any',
    optional: ['outer', 'hat', 'bag'],
    username: '@styleloop',
    avatar: 'S',
    likeCount: 331,
  },
  {
    id: 'office-soft',
    title: 'Soft workday edit',
    caption: 'Polished real pieces arranged for a lighter office formula.',
    vibe: 'Office',
    tags: ['office', 'tailored', 'minimal'],
    frameBias: 'any',
    optional: ['outer', 'bag', 'jewelry'],
    username: '@wardrobestudio',
    avatar: 'W',
    likeCount: 316,
  },
  {
    id: 'date-polish',
    title: 'Date night polish',
    caption: 'A compact night-out board with accessories framing the outfit.',
    vibe: 'Night out',
    tags: ['date', 'night', 'polished'],
    frameBias: 'any',
    optional: ['bag', 'jewelry', 'outer'],
    username: '@maisonmira',
    avatar: 'M',
    likeCount: 304,
  },
  {
    id: 'weekend-cozy',
    title: 'Weekend layer stack',
    caption: 'Soft layers, real product links, and no background-image filler.',
    vibe: 'Cozy',
    tags: ['cozy', 'weekend', 'layers'],
    frameBias: 'any',
    optional: ['outer', 'hat', 'bag'],
    username: '@dailyform',
    avatar: 'D',
    likeCount: 292,
  },
  {
    id: 'airport-neutral',
    title: 'Airport neutral board',
    caption: 'Travel-ready pieces kept clean enough for quick saves and remixes.',
    vibe: 'Travel',
    tags: ['travel', 'neutral', 'comfortable'],
    frameBias: 'any',
    optional: ['outer', 'bag', 'hat'],
    username: '@terminalfit',
    avatar: 'T',
    likeCount: 286,
  },
  {
    id: 'preppy-city',
    title: 'Preppy city cutout',
    caption: 'Classic shapes with enough whitespace to feel editorial.',
    vibe: 'Preppy',
    tags: ['preppy', 'city', 'classic'],
    frameBias: 'any',
    optional: ['outer', 'eyewear', 'jewelry'],
    username: '@clubroom',
    avatar: 'P',
    likeCount: 274,
  },
  {
    id: 'black-edit',
    title: 'Black edit uniform',
    caption: 'Dark real pieces with the accessory scale kept intentional.',
    vibe: 'Edgy',
    tags: ['black', 'edgy', 'uniform'],
    frameBias: 'any',
    optional: ['outer', 'bag', 'eyewear'],
    username: '@outfitindex',
    avatar: 'O',
    likeCount: 268,
  },
  {
    id: 'gym-clean',
    title: 'Gym to street cutout',
    caption: 'Performance pieces that still belong in the main visual feed.',
    vibe: 'Gym',
    tags: ['gym', 'sporty', 'street'],
    frameBias: 'any',
    optional: ['outer', 'hat', 'bag'],
    username: '@studioafter',
    avatar: 'G',
    likeCount: 254,
  },
  {
    id: 'vacation-light',
    title: 'Light vacation board',
    caption: 'Warm-weather pieces with transparent assets and outbound shopping paths.',
    vibe: 'Vacation',
    tags: ['vacation', 'light', 'resort'],
    frameBias: 'any',
    optional: ['hat', 'eyewear', 'bag'],
    username: '@resortfile',
    avatar: 'V',
    likeCount: 247,
  },
  {
    id: 'minimal-daily',
    title: 'Minimal daily uniform',
    caption: 'A quiet everyday formula sourced from reviewed catalog cutouts.',
    vibe: 'Minimal',
    tags: ['minimal', 'daily', 'uniform'],
    frameBias: 'any',
    optional: ['outer', 'bag'],
    username: '@neutralindex',
    avatar: 'N',
    likeCount: 239,
  },
  {
    id: 'night-mono',
    title: 'Monochrome night fit',
    caption: 'A darker board that keeps the clothing real and the canvas clean.',
    vibe: 'Night out',
    tags: ['night', 'monochrome', 'real links'],
    frameBias: 'any',
    optional: ['outer', 'bag', 'jewelry'],
    username: '@wearfile',
    avatar: 'W',
    likeCount: 228,
  },
];

const CURATED_REAL_CUTOUT_SEED_IDS: Record<string, Partial<Record<Category, string>>> = {
  'clean-capsule': {
    top: 'drop-801c170d2ea55154',
    bottom: 'generated-74fe933994f14082',
    shoes: 'catalog-shoes-stevemadden-heel',
    outer: 'drop-5300f6d5ddd93126',
    bag: 'catalog-bag-longchamp-lepliage',
    eyewear: 'drop-d36288d25687c3c1',
    jewelry: 'drop-76f8b0c619820c23',
  },
  'street-sneaker': {
    top: 'generated-a40b4a1a792a2517',
    bottom: 'drop-186f1a82b7d7f58f',
    shoes: 'drop-ac9095f6e93a7998',
    outer: 'drop-f2aa4850ca8554b2',
    bag: 'drop-ae17bc93cc49eb90',
    hat: 'drop-3001f97cdb615164',
    eyewear: 'drop-d6b445c3b7a9c48f',
  },
  'office-soft': {
    top: 'drop-45fff17e9bad78c8',
    bottom: 'generated-74fe933994f14082',
    shoes: 'drop-1a6a1daef1f7baf9',
    outer: 'drop-6841a846416360a9',
    bag: 'catalog-bag-longchamp-lepliage',
    jewelry: 'drop-aa1f3ed5ae3eb698',
  },
  'date-polish': {
    top: 'drop-07fd958a07ae21ad',
    bottom: 'generated-99aeccf41750984d',
    shoes: 'catalog-shoes-stevemadden-heel',
    outer: 'drop-45cea998b25d57a2',
    bag: 'drop-0a48f1226427b537',
    jewelry: '5f0c9a42e1eb6cd1',
  },
  'weekend-cozy': {
    top: 'generated-7ca4be6cd09823e8',
    bottom: 'generated-275150bce379b9a7',
    shoes: 'drop-7cf401599cf12aac',
    outer: 'generated-2f1bfa27a4583c16',
    bag: 'drop-d40a795efab86a1c',
    hat: 'drop-aced2433cf49a015',
  },
  'airport-neutral': {
    top: 'generated-7ca4be6cd09823e8',
    bottom: 'generated-de7d7fa0912bedd2',
    shoes: 'drop-aca0d9cd19822b6c',
    outer: 'ac42819e80705c93',
    bag: 'catalog-bag-longchamp-lepliage',
    hat: 'drop-d3819cc4464e3b78',
    eyewear: 'drop-8663a61076d67ff5',
  },
  'preppy-city': {
    top: 'drop-f1f3c6969d86c0c6',
    bottom: 'generated-16008bf3bb3a8476',
    shoes: 'drop-1a6a1daef1f7baf9',
    outer: 'drop-dc4c8e6f86f4f9a7',
    bag: 'drop-509e967f0f0bf159',
    hat: 'drop-4be50de0a894949f',
    eyewear: 'drop-d36288d25687c3c1',
  },
  'black-edit': {
    top: 'drop-07fd958a07ae21ad',
    bottom: 'generated-3475f4f3d7fe7731',
    shoes: 'drop-ac9095f6e93a7998',
    outer: 'ac42819e80705c93',
    bag: 'generated-e658d4d99d9e357d',
    hat: 'drop-c94745f295e8a719',
    eyewear: 'drop-d6b445c3b7a9c48f',
  },
  'gym-clean': {
    top: 'drop-745cbb5a4c57a65f',
    bottom: 'drop-3ae9091e99c3dbfb',
    shoes: 'cf644945808d11f8',
    outer: 'drop-308d9613a88aabae',
    bag: 'generated-adc7c43cad42c4cb',
    hat: 'drop-2f2b0aae5796c4da',
  },
  'vacation-light': {
    top: 'drop-6552e83f3ef3e9b7',
    bottom: 'generated-4e5b08cc31bf2b02',
    shoes: 'drop-2f62f11e699bf8c4',
    bag: 'catalog-bag-longchamp-lepliage',
    hat: 'generated-7788ea56c2c2841a',
    eyewear: 'drop-8663a61076d67ff5',
    jewelry: 'drop-05793dd760e9ddbc',
  },
  'minimal-daily': {
    top: 'drop-801c170d2ea55154',
    bottom: 'generated-589e8f931d3c29f7',
    shoes: 'catalog-shoes-nike-af1',
    outer: 'drop-f5ebb99db1f47f0a',
    bag: 'drop-d40a795efab86a1c',
    eyewear: 'drop-8b49c4dfd62a1e33',
  },
  'night-mono': {
    top: 'drop-07fd958a07ae21ad',
    bottom: 'generated-99aeccf41750984d',
    shoes: 'drop-00cd2debba354113',
    outer: 'drop-45cea998b25d57a2',
    bag: 'drop-ae17bc93cc49eb90',
    jewelry: '561d375c28389500',
  },
};

const FEED_PRODUCT_BY_ID = new Map(CLIENT_CATALOG_PRODUCTS.map((product) => [product.id, product]));

function curatedSeedItems(seedId: string): Partial<Record<Category, Product>> {
  const idsByCategory = CURATED_REAL_CUTOUT_SEED_IDS[seedId];
  if (!idsByCategory) return {};
  return sanitizeItems(Object.fromEntries(
    Object.entries(idsByCategory)
      .map(([category, productId]) => [category, productId ? FEED_PRODUCT_BY_ID.get(productId) : undefined])
      .filter((entry): entry is [Category, Product] => Boolean(entry[1])),
  ) as Partial<Record<Category, Product>>);
}

function maxOutfitBrandRepeat(items: Partial<Record<Category, Product>>): number {
  const counts = new Map<string, number>();
  for (const product of Object.values(items).filter((product): product is Product => Boolean(product))) {
    const brand = getBrandOrMerchant(product);
    if (!brand) continue;
    counts.set(brand, (counts.get(brand) || 0) + 1);
  }
  return Math.max(0, ...Array.from(counts.values()));
}

const REAL_CUTOUT_SEED_GENERATOR_IDS = [
  'coffee-clean-fem',
  'street-masc-campus',
  'office-fem-cream',
  'date-femme-soft',
  'cozy-masc-winter',
  'airport-neutral',
  'preppy-femme-city',
  'street-any-black',
  'gym-masc-training',
  'vacation-femme-linen',
  'clean-masc-casual',
  'night-any-luxe',
];

function seedGeneratorPlan(index: number): (typeof GENERATED_POST_PLAN)[number] {
  const preferredId = REAL_CUTOUT_SEED_GENERATOR_IDS[index % REAL_CUTOUT_SEED_GENERATOR_IDS.length];
  return GENERATED_POST_PLAN.find((plan) => plan.id === preferredId) || GENERATED_POST_PLAN[index % GENERATED_POST_PLAN.length] || GENERATED_POST_PLAN[0];
}

function buildRealCutoutSeedPosts(): FeedPost[] {
  const posts: FeedPost[] = [];
  const usedProductIds: string[] = [];
  const recentShoeIds: string[] = [];
  const recentBrandCounts: Record<string, number> = {};

  REAL_CUTOUT_SEED_PLAN.forEach((plan, index) => {
    const generatorPlan = seedGeneratorPlan(index);
    const generatedCandidate = generatedLookFromPlan(generatorPlan, index, {
      avoidProductIds: usedProductIds.slice(-72),
      recentShoeIds: recentShoeIds.slice(-16),
      recentBrandCounts,
    });
    const curatedItems = curatedSeedItems(plan.id);
    const curatedTotals = fitTotals(curatedItems);
    const curatedCandidate = curatedTotals.itemCount >= 3 && hasRequiredSlots(curatedItems)
      ? {
          items: curatedItems,
          formula: {
            id: generatorPlan.formulaId,
            label: generatorPlan.label,
            structure: generatorPlan.caption,
            reason: plan.caption,
          },
        }
      : null;
    const generatedBrandRepeat = maxOutfitBrandRepeat(generatedCandidate.items);
    const curatedBrandRepeat = curatedCandidate ? maxOutfitBrandRepeat(curatedCandidate.items) : Number.POSITIVE_INFINITY;
    const generated = postMeetsFeedQualityFloor(generatedCandidate.items)
      && (generatedBrandRepeat <= 1 || !curatedCandidate || !postMeetsFeedQualityFloor(curatedCandidate.items) || curatedBrandRepeat >= generatedBrandRepeat)
      ? generatedCandidate
      : curatedCandidate || generatedCandidate;
    const post = seedPost(
      generated.items,
      index,
      `feed-real-${plan.id}`,
      plan.username,
      plan.avatar,
      plan.title,
      plan.vibe,
      plan.tags,
      plan.likeCount,
      plan.caption,
      plan.frameBias,
      'catalog',
      generated.formula,
      'first-screen',
    );

    if (!postMeetsFeedQualityFloor(post.items)) return;
    posts.push(post);
    for (const product of Object.values(post.items).filter((product): product is Product => Boolean(product))) {
      usedProductIds.push(product.id);
      const brand = getBrandOrMerchant(product);
      if (brand) recentBrandCounts[brand] = (recentBrandCounts[brand] || 0) + 1;
    }
    const shoeId = shoesId(post);
    if (shoeId) recentShoeIds.push(shoeId);
  });

  return posts;
}

const REAL_CUTOUT_SEED_POSTS = buildRealCutoutSeedPosts();

// AI-composed feed looks, baked offline by scripts/generate-ai-feed.mjs (the
// real composer running via /api/look). Resolved against the client catalog so
// there is ZERO runtime AI cost — the feed shows genuinely AI-styled outfits
// for free. Re-run the script + bump the persist version to refresh the pool.
interface AiFeedLookRaw {
  id: string;
  vibe: string;
  frameBias?: FeedPost['frameBias'];
  title: string;
  username: string;
  tags: string[];
  likeCount: number;
  caption: string;
  palette?: string[];
  formula?: { id: string; label: string; structure: string; reason: string } | null;
  items: Record<string, string>;
}

const AI_FEED_AVATARS = ['#c9a98a', '#8a6f5b', '#e7c79b', '#b3937a', '#d8b48f', '#6f5a49', '#a9866a', '#caa07c'];

function buildAiSeedPosts(): FeedPost[] {
  const posts: FeedPost[] = [];
  (aiFeedLooksRaw as unknown as AiFeedLookRaw[]).forEach((look, index) => {
    const items = sanitizeItems(
      Object.fromEntries(
        Object.entries(look.items)
          .map(([category, productId]) => [category, FEED_PRODUCT_BY_ID.get(productId)])
          .filter((entry): entry is [Category, Product] => Boolean(entry[1])),
      ) as Partial<Record<Category, Product>>,
    );
    if (!hasRequiredSlots(items) || !postMeetsFeedQualityFloor(items)) return;
    posts.push(
      seedPost(
        items,
        index,
        `feed-ai-${look.id}`,
        look.username,
        AI_FEED_AVATARS[index % AI_FEED_AVATARS.length],
        look.title,
        look.vibe,
        look.tags,
        look.likeCount,
        look.caption,
        look.frameBias || 'any',
        'community',
        look.formula || undefined,
        'first-screen',
      ),
    );
  });
  return posts;
}

const AI_SEED_POSTS = buildAiSeedPosts();

const FIRST_SCREEN_POST_IDS = [
  'feed-real-clean-capsule',
  'feed-real-street-sneaker',
  'feed-real-office-soft',
  'feed-real-date-polish',
  'feed-real-weekend-cozy',
  'feed-real-airport-neutral',
  'feed-real-preppy-city',
  'feed-real-black-edit',
  'feed-real-gym-clean',
  'feed-real-vacation-light',
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
  // AI-composed looks always lead the feed; then the curated first-screen set;
  // then everything else. Array.sort is stable, so ties keep insertion order.
  const rank = (post: FeedPost) => (post.id.startsWith('feed-ai-') ? -1000 : (order.get(post.id) ?? 999));
  return [...posts].sort((left, right) => rank(left) - rank(right));
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
  // Require the core outfit only. The current catalog gate intentionally
  // prefers 3-4 true transparent garment cutouts over 5+ model/full-body
  // composites, and the collage renderer no longer exposes empty fixed slots.
  [...AI_SEED_POSTS, ...REAL_CUTOUT_SEED_POSTS, ...COLLECTION_POSTS, ...GENERATED_POSTS].filter((post) => postMeetsFeedQualityFloor(post.items)),
));

export function getSeedFeedPosts(): FeedPost[] {
  return SEED_POSTS;
}

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
  // Persisted state must also clear the transparent core outfit minimum.
  if (!postMeetsFeedQualityFloor(items)) return null;
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
  // Streaming generated posts clear the same transparent core minimum as
  // seed posts. Sparse editorial collages are acceptable while catalog
  // cutouts are being expanded; model/full-body composites are not.
  if (!postMeetsFeedQualityFloor(items)) return null;
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

function normalizeGenerationOptions(options?: FeedGenerationOptions): Required<FeedGenerationOptions> {
  return {
    vibe: options?.vibe || 'any',
    frame: options?.frame || 'any',
    budget: options?.budget || 'any',
  };
}

function generationPlanPool(options: Required<FeedGenerationOptions>): typeof GENERATED_POST_PLAN {
  const exactMatches = GENERATED_POST_PLAN.filter((plan) =>
    (options.vibe === 'any' || plan.vibe === options.vibe)
    && (options.frame === 'any' || plan.frame === options.frame),
  );
  if (exactMatches.length) return exactMatches;

  const vibeMatches = options.vibe === 'any' ? [] : GENERATED_POST_PLAN.filter((plan) => plan.vibe === options.vibe);
  if (vibeMatches.length) return vibeMatches;

  const frameMatches = options.frame === 'any' ? [] : GENERATED_POST_PLAN.filter((plan) => plan.frame === options.frame);
  return frameMatches.length ? frameMatches : GENERATED_POST_PLAN;
}

/**
 * Per-shoe usage cap when generating a streaming feed batch. The catalog
 * has only ~63 shoes; without this guard the same Steve Madden Slingback /
 * Nike Air Force / Birkenstock Boston dominate the entire feed because
 * they outscore lower-quality alternatives every call.
 */
const FEED_SHOE_REPEAT_CAP = 2;

/**
 * Per-brand cap across visible feed pieces. Counting every visible product
 * catches repeated bags, shoes, and accessories instead of only tops/bottoms.
 */
const FEED_BRAND_REPEAT_CAP = 4;

function shoesId(post: FeedPost): string | undefined {
  return getShoeId(post.items) || undefined;
}

function postVisibleBrands(post: FeedPost): string[] {
  return feedQualityProducts(post.items)
    .map((product) => getBrandOrMerchant(product))
    .filter((brand): brand is string => Boolean(brand));
}

function postBrandCounts(post: FeedPost): Map<string, number> {
  const counts = new Map<string, number>();
  for (const brand of postVisibleBrands(post)) {
    counts.set(brand, (counts.get(brand) || 0) + 1);
  }
  return counts;
}

function generateFeedBatch(existingPosts: FeedPost[], startCursor: number, count: number, options?: FeedGenerationOptions): { posts: FeedPost[]; cursor: number } {
  const generationOptions = normalizeGenerationOptions(options);
  const planPool = generationPlanPool(generationOptions);
  const requiredSignatures = new Set(existingPosts.map((post) => outfitRequiredSignature(post.items)).filter(Boolean));
  const fullSignatures = new Set(existingPosts.map((post) => outfitFullSignature(post.items)).filter(Boolean));
  const categoryStructureCounts = new Map<string, number>();
  const shoeCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  for (const post of existingPosts) {
    const sid = shoesId(post);
    if (sid) shoeCounts.set(sid, (shoeCounts.get(sid) || 0) + 1);
    for (const brand of postVisibleBrands(post)) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    }
    const structure = outfitCategorySignature(post.items);
    categoryStructureCounts.set(structure, (categoryStructureCounts.get(structure) || 0) + 1);
  }
  const batch: FeedPost[] = [];
  let cursor = startCursor;
  let attempts = 0;

  while (batch.length < count && attempts < count * 8) {
    const basePlan = planPool[cursor % planPool.length];
    const plan = {
      ...basePlan,
      frame: generationOptions.frame === 'any' ? basePlan.frame : generationOptions.frame,
      budget: generationOptions.budget === 'any' ? basePlan.budget : generationOptions.budget,
    };
    // Build avoid list: rolling recent IDs + over-capped shoes that we
    // want the generator to actively avoid this iteration.
    const overUsedShoes = Array.from(shoeCounts.entries())
      .filter(([, n]) => n >= FEED_SHOE_REPEAT_CAP)
      .map(([id]) => id);
    const avoidProductIds = Array.from(new Set([
      ...recentProductIds([...existingPosts, ...batch]),
      ...overUsedShoes,
    ])).slice(0, 120);

    const post = makeGeneratedPost(plan, cursor, {
      avoidProductIds,
      avoidComboSignatures: [
        ...Array.from(requiredSignatures),
        ...Array.from(fullSignatures),
      ].slice(-240),
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
    const brands = postBrandCounts(post);
    const wouldOvercap = Array.from(brands.entries())
      .some(([brand, count]) => (brandCounts.get(brand) || 0) + count > FEED_BRAND_REPEAT_CAP);
    if (wouldOvercap && attempts < count * 6) continue;
    const structure = outfitCategorySignature(post.items);
    const structureCount = categoryStructureCounts.get(structure) || 0;
    if (structureCount >= 6 && attempts < count * 6) continue;

    // Accept.
    requiredSignatures.add(requiredSignature);
    fullSignatures.add(fullSignature);
    if (sid) shoeCounts.set(sid, (shoeCounts.get(sid) || 0) + 1);
    for (const [brand, brandCount] of brands) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + brandCount);
    }
    categoryStructureCounts.set(structure, structureCount + 1);
    batch.push(post);
  }

  return {
    posts: batch,
    cursor,
  };
}

const INITIAL_GENERATED_BATCH = SEED_POSTS.length >= 14
  ? { posts: [] as FeedPost[], cursor: 0 }
  : generateFeedBatch(SEED_POSTS, 0, Math.max(14 - SEED_POSTS.length, 14));

const INITIAL_FEED_POSTS = capFeedPosts([...SEED_POSTS, ...INITIAL_GENERATED_BATCH.posts]);
const INITIAL_GENERATION_CURSOR = INITIAL_GENERATED_BATCH.cursor;

export const useSocialFeed = create<SocialFeedState>()(
  persist(
    (set) => ({
      posts: INITIAL_FEED_POSTS,
      generationCursor: INITIAL_GENERATION_CURSOR,
      generateMorePosts: (count = 12, options) =>
        set((state) => {
          const cleanExisting = state.posts
            .map(normalizeFeedPost)
            .filter((post): post is FeedPost => Boolean(post));
          const existingWithSeeds = cleanExisting.length < SEED_POSTS.length
            ? mergePersistedPostsWithSeeds(cleanExisting)
            : cleanExisting;
          const generated = generateFeedBatch(existingWithSeeds, state.generationCursor || 0, count, options);
          return {
            posts: capFeedPosts([...existingWithSeeds, ...generated.posts]),
            generationCursor: generated.cursor,
          };
        }),
      postFit: (items, options) => {
        const selected = sanitizeItems(items);
        const totals = fitTotals(selected);
        if (totals.itemCount < 3 || !postMeetsFeedQualityFloor(selected)) return null;
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
      name: 'sylistly.social-feed.v2',
      // v19 refreshes the first-screen seed pool after replacing hard-coded
      // curated product IDs with diversity-aware transparent catalog picks.
      version: 19,
      migrate: (persistedState) => {
        const state = persistedState as Partial<SocialFeedState> | undefined;
        const posts = mergePersistedPostsWithSeeds(state?.posts);
        const generationCursor = Number.isFinite(state?.generationCursor) ? Number(state?.generationCursor) : GENERATED_POST_PLAN.length;
        return {
          ...state,
          posts: posts.length ? posts : INITIAL_FEED_POSTS,
          generationCursor,
        } as SocialFeedState;
      },
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<SocialFeedState> | undefined;
        const posts = mergePersistedPostsWithSeeds(state?.posts);
        const generationCursor = Number.isFinite(state?.generationCursor)
          ? Math.max(Number(state?.generationCursor), currentState.generationCursor || 0)
          : currentState.generationCursor;
        return {
          ...currentState,
          posts: posts.length ? posts : currentState.posts,
          generationCursor,
        };
      },
    },
  ),
);
