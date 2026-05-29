/**
 * Editorial composition engine.
 *
 * Arranges outfit pieces into premium, layered layouts on a normalized canvas
 * (all coordinates are fractions 0..1 of the canvas, so a layout looks identical
 * at any rendered size). Powers both the "Auto Arrange" button in the editor and
 * deterministic seeding of demo outfits (no Math.random → no hydration mismatch).
 */
import type { Category } from './types';
import type { LayoutPreset, OutfitLayoutItem } from './social-types';

export const LAYOUT_PRESETS: Array<{ id: LayoutPreset; label: string; blurb: string }> = [
  { id: 'editorial', label: 'Editorial', blurb: 'Layered fashion-board composition' },
  { id: 'grid', label: 'Classic Grid', blurb: 'Even, catalog-style grid' },
  { id: 'flatlay', label: 'Flat Lay', blurb: 'Scattered product flat lay' },
  { id: 'streetwear', label: 'Streetwear', blurb: 'Bold overlapping layers' },
  { id: 'catalog', label: 'Minimal', blurb: 'Quiet centered column' },
  { id: 'story', label: 'Story', blurb: 'Vertical 9:16 stack' },
];

/** relative footprint per category (1 = a top) */
const CATEGORY_SCALE: Record<Category, number> = {
  outer: 1.16,
  top: 1.0,
  bottom: 1.04,
  shoes: 0.72,
  bag: 0.62,
  hat: 0.52,
  eyewear: 0.46,
  jewelry: 0.46,
};

interface Anchor {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
}

type PresetAnchors = Partial<Record<Category, Anchor>>;

const PRESET_ANCHORS: Record<LayoutPreset, PresetAnchors> = {
  editorial: {
    outer: { x: 0.31, y: 0.42, scale: 1.12, rotation: -7, z: 1 },
    top: { x: 0.53, y: 0.33, scale: 1.0, rotation: 2, z: 3 },
    bottom: { x: 0.55, y: 0.64, scale: 1.02, rotation: 4, z: 2 },
    shoes: { x: 0.63, y: 0.88, scale: 1.0, rotation: -4, z: 4 },
    bag: { x: 0.83, y: 0.58, scale: 1.0, rotation: 9, z: 5 },
    hat: { x: 0.49, y: 0.1, scale: 1.0, rotation: -3, z: 6 },
    eyewear: { x: 0.24, y: 0.14, scale: 1.0, rotation: -10, z: 6 },
    jewelry: { x: 0.82, y: 0.2, scale: 1.0, rotation: 8, z: 6 },
  },
  grid: {
    hat: { x: 0.27, y: 0.24, scale: 1.0, rotation: 0, z: 1 },
    top: { x: 0.5, y: 0.26, scale: 0.95, rotation: 0, z: 1 },
    outer: { x: 0.74, y: 0.26, scale: 0.95, rotation: 0, z: 1 },
    bottom: { x: 0.32, y: 0.66, scale: 0.95, rotation: 0, z: 1 },
    shoes: { x: 0.56, y: 0.7, scale: 0.95, rotation: 0, z: 1 },
    bag: { x: 0.78, y: 0.68, scale: 0.9, rotation: 0, z: 1 },
    eyewear: { x: 0.74, y: 0.9, scale: 0.85, rotation: 0, z: 1 },
    jewelry: { x: 0.26, y: 0.9, scale: 0.85, rotation: 0, z: 1 },
  },
  flatlay: {
    outer: { x: 0.34, y: 0.4, scale: 1.1, rotation: -12, z: 1 },
    top: { x: 0.58, y: 0.3, scale: 0.96, rotation: 9, z: 3 },
    bottom: { x: 0.46, y: 0.66, scale: 1.0, rotation: -6, z: 2 },
    shoes: { x: 0.74, y: 0.78, scale: 1.0, rotation: 14, z: 4 },
    bag: { x: 0.8, y: 0.44, scale: 0.95, rotation: -16, z: 5 },
    hat: { x: 0.2, y: 0.7, scale: 0.95, rotation: 10, z: 4 },
    eyewear: { x: 0.22, y: 0.2, scale: 1.0, rotation: -18, z: 6 },
    jewelry: { x: 0.82, y: 0.16, scale: 1.0, rotation: 12, z: 6 },
  },
  streetwear: {
    outer: { x: 0.46, y: 0.44, scale: 1.32, rotation: -4, z: 2 },
    top: { x: 0.5, y: 0.36, scale: 0.92, rotation: 0, z: 3 },
    bottom: { x: 0.52, y: 0.68, scale: 1.08, rotation: 2, z: 1 },
    shoes: { x: 0.58, y: 0.9, scale: 1.12, rotation: -6, z: 4 },
    bag: { x: 0.82, y: 0.66, scale: 1.05, rotation: 12, z: 5 },
    hat: { x: 0.48, y: 0.09, scale: 1.05, rotation: -4, z: 6 },
    eyewear: { x: 0.26, y: 0.16, scale: 1.0, rotation: -10, z: 6 },
    jewelry: { x: 0.78, y: 0.24, scale: 0.95, rotation: 8, z: 6 },
  },
  catalog: {
    hat: { x: 0.5, y: 0.11, scale: 0.9, rotation: 0, z: 1 },
    outer: { x: 0.5, y: 0.36, scale: 0.95, rotation: 0, z: 1 },
    top: { x: 0.5, y: 0.36, scale: 0.92, rotation: 0, z: 2 },
    bottom: { x: 0.5, y: 0.64, scale: 0.95, rotation: 0, z: 1 },
    shoes: { x: 0.5, y: 0.88, scale: 0.9, rotation: 0, z: 3 },
    bag: { x: 0.78, y: 0.6, scale: 0.78, rotation: 0, z: 4 },
    eyewear: { x: 0.22, y: 0.6, scale: 0.78, rotation: 0, z: 4 },
    jewelry: { x: 0.78, y: 0.86, scale: 0.78, rotation: 0, z: 4 },
  },
  story: {
    hat: { x: 0.5, y: 0.12, scale: 1.0, rotation: 0, z: 6 },
    eyewear: { x: 0.26, y: 0.16, scale: 0.95, rotation: -8, z: 6 },
    top: { x: 0.5, y: 0.34, scale: 1.05, rotation: 0, z: 3 },
    outer: { x: 0.32, y: 0.38, scale: 1.1, rotation: -6, z: 1 },
    bottom: { x: 0.5, y: 0.6, scale: 1.05, rotation: 0, z: 2 },
    shoes: { x: 0.5, y: 0.85, scale: 1.0, rotation: 0, z: 4 },
    bag: { x: 0.78, y: 0.54, scale: 0.95, rotation: 10, z: 5 },
    jewelry: { x: 0.76, y: 0.22, scale: 0.9, rotation: 6, z: 6 },
  },
};

export const BASE_FRACTION = 0.42; // base garment width as a fraction of canvas at scale 1

interface ArrangeInput {
  itemId: string;
  category: Category;
}

/** Produce a normalized layout for the given items under a preset. Deterministic. */
export function autoArrange(items: ArrangeInput[], preset: LayoutPreset = 'editorial'): OutfitLayoutItem[] {
  const anchors = PRESET_ANCHORS[preset] || PRESET_ANCHORS.editorial;
  const seenPerCategory: Partial<Record<Category, number>> = {};

  return items.map((item, idx) => {
    const anchor = anchors[item.category] || { x: 0.5, y: 0.5, scale: 1, rotation: 0, z: 1 };
    const dup = seenPerCategory[item.category] || 0;
    seenPerCategory[item.category] = dup + 1;

    // nudge duplicate categories so they don't perfectly stack
    const offset = dup * 0.08;
    const dir = dup % 2 === 0 ? 1 : -1;

    const catScale = CATEGORY_SCALE[item.category] ?? 1;
    return {
      itemId: item.itemId,
      x: clamp01(anchor.x + offset * dir),
      y: clamp01(anchor.y + (dup ? offset * 0.5 : 0)),
      scale: anchor.scale * catScale,
      rotation: anchor.rotation + dir * dup * 5,
      z: anchor.z * 10 + idx,
    };
  });
}

function clamp01(n: number): number {
  return Math.max(0.06, Math.min(0.94, n));
}

/** Garment rendered width in px for a given canvas width + layout scale. */
export function garmentWidthPx(canvasWidth: number, scale: number): number {
  return canvasWidth * BASE_FRACTION * scale;
}
