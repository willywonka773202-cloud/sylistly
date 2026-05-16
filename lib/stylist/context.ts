// Build a StylistContext from real local app state. Pure function — no
// React, no side effects. Both the local responder and a future API
// integration can call this to produce a consistent, real-data context
// snapshot. If a slice of state is empty, we return honest empty/zero
// values instead of synthesizing fake signals.

import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import type { FeedPost } from '@/store/social-feed';
import type { SavedFitRecord } from '@/store/saved-fits';
import type { WardrobeItem } from '@/store/wardrobe';
import type { Profile } from '@/lib/types';
import type { StylistContext } from './types';

interface BuildContextInput {
  currentFitItems: Partial<Record<Category, Product>>;
  savedFits: SavedFitRecord[];
  wardrobeItems: WardrobeItem[];
  feedPosts: FeedPost[];
  profile?: Profile | null;
}

const REQUIRED_CATEGORIES: Category[] = ['top', 'bottom', 'shoes'];

function topEntries<T>(map: Map<T, number>, limit: number): T[] {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function medianCents(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function classifyBudgetTier(medianPrice: number): StylistContext['budgetTendency'] {
  if (medianPrice === 0) return 'unknown';
  if (medianPrice < 10000) return 'budget';
  if (medianPrice < 25000) return 'smart';
  if (medianPrice < 60000) return 'premium';
  return 'luxury';
}

export function buildStylistContext(input: BuildContextInput): StylistContext {
  const { currentFitItems, savedFits, wardrobeItems, feedPosts, profile } = input;

  const closetItems = wardrobeItems.filter((entry) => entry.status === 'closet');
  const wishlistItems = wardrobeItems.filter((entry) => entry.status === 'wishlist');

  const currentProducts: Product[] = Object.values(currentFitItems).filter(
    (item): item is Product => Boolean(item),
  );
  const closetProducts = closetItems.map((entry) => entry.product);
  const wishlistProducts = wishlistItems.map((entry) => entry.product);
  const savedProducts = savedFits.flatMap((fit) =>
    Object.values(fit.items).filter((product): product is Product => Boolean(product)),
  );

  const currentFitCategories: Category[] = Array.from(
    new Set(currentProducts.map((product) => product.category)),
  );
  const closetCategorySet = new Set(closetProducts.map((product) => product.category));
  const closetCategories: Category[] = CATEGORY_ORDER.filter((category) =>
    closetCategorySet.has(category),
  );

  const currentFitTotalCents = currentProducts.reduce(
    (sum, product) => sum + (product.priceCents || 0),
    0,
  );
  const currentFitMissingRequiredSlots = REQUIRED_CATEGORIES.filter(
    (category) => !currentFitCategories.includes(category),
  );
  const wardrobeMissingCategories = CATEGORY_ORDER.filter((category) => !closetCategorySet.has(category));

  // distribution / signal aggregates derive from saved + wardrobe + liked.
  // We DO NOT mix in feed posts the user hasn't engaged with, because
  // that would inflate signals with content the user didn't choose.
  const likedPosts = feedPosts.filter((post) => post.liked);
  const savedSocialPosts = feedPosts.filter((post) => post.saved);
  const signalSources: Product[] = [
    ...closetProducts,
    ...wishlistProducts,
    ...savedProducts,
    ...likedPosts.flatMap((post) => Object.values(post.items).filter((p): p is Product => Boolean(p))),
    ...savedSocialPosts.flatMap((post) => Object.values(post.items).filter((p): p is Product => Boolean(p))),
  ];

  const closetDistribution: Partial<Record<Category, number>> = {};
  for (const product of closetProducts) {
    closetDistribution[product.category] = (closetDistribution[product.category] || 0) + 1;
  }

  const brandCounts = new Map<string, number>();
  const categoryCounts = new Map<Category, number>();
  const vibeCounts = new Map<string, number>();
  const prices: number[] = [];

  for (const product of signalSources) {
    if (product.brand) brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
    categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
    if (product.priceCents > 0) prices.push(product.priceCents);
    for (const vibe of [...(product.vibes || []), ...(product.occasions || [])]) {
      vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
    }
  }

  // Feed-post vibe (formula-tagged) also counts — but only for posts the
  // user actually liked/saved or that are their own (@you).
  for (const post of [...likedPosts, ...savedSocialPosts]) {
    if (post.vibe) vibeCounts.set(post.vibe, (vibeCounts.get(post.vibe) || 0) + 1);
  }

  // Profile preferences nudge — small bumps so explicit user prefs win
  // ties.  Never enough to fabricate a signal where data doesn't exist.
  if (profile?.stylePrefs?.vibes) {
    for (const vibe of profile.stylePrefs.vibes) {
      vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
    }
  }
  if (profile?.stylePrefs?.brands) {
    for (const brand of profile.stylePrefs.brands) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    }
  }

  const topSavedVibes = topEntries(vibeCounts, 3);
  const topBrands = topEntries(brandCounts, 3);
  const topCategories = topEntries(categoryCounts, 3);
  const budgetTendency = classifyBudgetTier(medianCents(prices));

  const recentSavedFitSummary = savedFits.slice(0, 5).map((fit) => ({
    id: fit.id,
    title: fit.title,
    itemCount: fit.itemCount,
    totalCents: fit.totalCents,
  }));
  const recentWardrobeSummary = wardrobeItems.slice(0, 8).map((item) => ({
    id: item.id,
    productId: item.productId,
    category: item.product.category,
    brand: item.product.brand,
    status: item.status,
  }));

  // We declare "enough data" once the user has at least 3 saved fits
  // OR at least 5 wardrobe pieces. Below that, the Style DNA section
  // should label itself "building" instead of fabricating an archetype.
  const hasEnoughDataForStyleDNA = savedFits.length >= 3 || closetItems.length >= 5;

  return {
    savedFitCount: savedFits.length,
    closetCount: closetItems.length,
    wishlistCount: wishlistItems.length,
    likedFeedCount: likedPosts.length,
    currentFitPieceCount: currentProducts.length,
    currentFitTotalCents,
    currentFitCategories,
    currentFitMissingRequiredSlots,
    closetCategories,
    wardrobeMissingCategories,
    closetDistribution,
    topSavedVibes,
    topBrands,
    topCategories,
    budgetTendency,
    recentSavedFitSummary,
    recentWardrobeSummary,
    hasEnoughDataForStyleDNA,
    knownProducts: signalSources,
  };
}
