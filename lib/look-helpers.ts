/**
 * Light, catalog-free feed helpers — shared by the feed island (render path)
 * AND the look engine (lib/compose-look). Kept JSON-free on purpose: the island
 * imports these statically, so anything here lands in First Load JS. The heavy
 * catalog logic lives in lib/compose-look (lazy-loaded), never here.
 */
import type { Category, Product } from '@/lib/types';
import { VIBES, type VibeId } from '@/lib/vibes';

export interface ScrollLook {
  key: string;
  vibe: VibeId;
  items: Partial<Record<Category, Product>>;
  gen: number;
  /** 'syli' = genuinely Claude-composed (from the baked AI library). */
  source: 'syli' | 'engine';
  /** Claude's real styling note — only present on 'syli' looks. */
  note?: string;
  /** The baked library id — marked seen only when the card is viewed. */
  aiId?: string;
  /** Claude's palette words ('navy', 'cream') — rendered as swatch dots. */
  palette?: string[];
}

export const VIBE_META = new Map(VIBES.map((vibe) => [vibe.id, vibe]));

/** Curated rotation so consecutive cards feel like turning magazine pages. */
export const VIBE_ROTATION: VibeId[] = [
  'street', 'clean', 'night', 'cozy', 'date', 'edgy', 'office', 'preppy', 'vacation', 'gym',
];

export function lookProducts(items: Partial<Record<Category, Product>>): Product[] {
  return Object.values(items).filter((product): product is Product => Boolean(product));
}

/**
 * Cheap title-vs-category sanity gate: a bucket hat tagged as a "top" (real
 * catalog bug) wrecks the worn silhouette. The durable fix is the vision
 * enrichment pass; until then, obviously miscategorized garments stay off
 * the plate.
 */
const GARMENT_SLOTS = new Set<Category>(['top', 'bottom', 'outer']);
const NON_GARMENT_TERMS = /\b(bucket hat|beanie|cap|hat|sunglasses|eyeglass|necklace|earring|bracelet|tote|handbag)\b/i;

export function isCategorySane(product: Product): boolean {
  if (!GARMENT_SLOTS.has(product.category)) return true;
  return !NON_GARMENT_TERMS.test(product.name || '');
}
