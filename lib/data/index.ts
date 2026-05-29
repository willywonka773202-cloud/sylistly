/** Barrel for the seeded data layer + cross-cutting query helpers. */
export * from './closet';
export * from './creators';
export * from './outfits';
export * from './community';

import type { Category } from '../types';
import type { ClosetItem, Outfit } from '../social-types';
import { CLOSET_ITEMS } from './closet';
import { SEED_OUTFITS } from './outfits';
import { SEED_POSTS } from './community';

export function itemsByOwner(ownerId: string): ClosetItem[] {
  return CLOSET_ITEMS.filter((i) => i.ownerId === ownerId);
}

export function itemsByCategory(category: Category, ownerId?: string): ClosetItem[] {
  return CLOSET_ITEMS.filter((i) => i.category === category && (!ownerId || i.ownerId === ownerId));
}

export function outfitsByOwner(ownerId: string): Outfit[] {
  return SEED_OUTFITS.filter((o) => o.ownerId === ownerId);
}

export function publicOutfits(): Outfit[] {
  return SEED_OUTFITS.filter((o) => o.visibility === 'public');
}

export function postsByCreator(creatorId: string) {
  return SEED_POSTS.filter((p) => p.creatorId === creatorId);
}

/** Trending = most liked public posts. */
export function trendingPosts(limit = 12) {
  return [...SEED_POSTS].sort((a, b) => b.likes - a.likes).slice(0, limit);
}
