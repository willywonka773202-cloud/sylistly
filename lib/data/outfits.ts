import type { Outfit } from '../social-types';
import { REAL_OUTFITS } from '../real-catalog';

/**
 * Seeded outfits are now assembled from the REAL catalog via the curated look
 * recipes (data/discover-look-recipes.json) in lib/real-catalog.ts, so every
 * outfit renders real clothing photos.
 */
export const SEED_OUTFITS: Outfit[] = REAL_OUTFITS;

export const OUTFIT_BY_ID: Map<string, Outfit> = new Map(SEED_OUTFITS.map((o) => [o.id, o]));

export function getOutfit(id: string): Outfit | undefined {
  return OUTFIT_BY_ID.get(id);
}
