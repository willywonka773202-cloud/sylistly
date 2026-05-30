import type { ClosetItem } from '../social-types';
import { REAL_ITEMS } from '../real-catalog';

/**
 * The clothing catalog now comes from the REAL product-photo catalog
 * (data/photo-catalog.json, ~410 items with real images), adapted in lib/real-catalog.ts.
 * Synthetic garment art is only a per-item fallback when a photo fails to load.
 */
export const CLOSET_ITEMS: ClosetItem[] = REAL_ITEMS;

export const CLOSET_BY_ID: Map<string, ClosetItem> = new Map(CLOSET_ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ClosetItem | undefined {
  return CLOSET_BY_ID.get(id);
}
