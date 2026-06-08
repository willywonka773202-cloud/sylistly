/**
 * Pre-generated outfit library — instant, $0 runtime.
 *
 * `data/outfit-library.json` holds thousands of coordination-scored outfits
 * (generated offline by scripts/generate-outfit-library.mjs, zero API cost),
 * interned to keep the bundle tiny. This module hydrates them back into real
 * products and serves a fresh, well-coordinated look per vibe × frame.
 */
import libraryData from '@/data/outfit-library.json';
import { CLIENT_CATALOG_PRODUCTS } from '@/lib/client-catalog';
import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame, VibeId } from '@/lib/vibes';

interface LibraryFile {
  slots: Category[];
  ids: string[];
  looks: Record<string, Record<string, number[][]>>;
}

const DATA = libraryData as LibraryFile;
const BY_ID = new Map(CLIENT_CATALOG_PRODUCTS.map((p) => [p.id, p]));

function poolFor(vibe: string, frame: string): number[][] {
  const byFrame = DATA.looks[vibe];
  if (!byFrame) return [];
  return byFrame[frame] || byFrame.androgynous || [];
}

function hydrate(row: number[]): Partial<Record<Category, Product>> {
  const out: Partial<Record<Category, Product>> = {};
  for (let i = 0; i < DATA.slots.length; i += 1) {
    const idx = row[i];
    if (idx == null || idx < 0) continue;
    const product = BY_ID.get(DATA.ids[idx]);
    if (product) out[DATA.slots[i]] = product;
  }
  return out;
}

/** Does the pre-generated library cover this vibe (in this or the androgynous frame)? */
export function hasLibraryCoverage(vibe: VibeId, frame: GeneratorFrame): boolean {
  return poolFor(vibe, frame).length > 0;
}

/**
 * Pick a fresh, well-coordinated pre-generated look for the given vibe × frame.
 * Rotation: penalizes looks that overlap `avoidProductIds` (recently shown) and
 * randomizes via `seed`, so consecutive generates feel non-repeating. Returns
 * null only if the library has no usable look (caller falls back to live compose).
 */
export function getLibraryLook(
  vibe: VibeId,
  frame: GeneratorFrame,
  opts: { seed?: number; avoidProductIds?: string[]; maxItemCents?: number | null } = {},
): { products: Partial<Record<Category, Product>>; formulaId: string } | null {
  const pool = poolFor(vibe, frame);
  if (pool.length === 0) return null;

  const avoid = new Set(opts.avoidProductIds || []);
  const maxItemCents = opts.maxItemCents && opts.maxItemCents > 0 ? opts.maxItemCents : null;
  const seed = opts.seed ?? 0;
  const jitter = (n: number) => {
    const x = Math.sin((seed + n) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  let best: number[] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < pool.length; i += 1) {
    const row = pool[i];
    let overlap = 0;
    let overBudget = false;
    for (const idx of row) {
      if (idx < 0) continue;
      const id = DATA.ids[idx];
      if (avoid.has(id)) overlap += 1;
      if (maxItemCents) {
        const product = BY_ID.get(id);
        if (product && (product.priceCents || 0) > maxItemCents) { overBudget = true; break; }
      }
    }
    if (overBudget) continue; // respect the user's budget cap
    const freshness = -overlap * 2 + jitter(i); // prefer low overlap, randomized
    if (freshness > bestScore) {
      bestScore = freshness;
      best = row;
    }
  }
  if (!best) return null;

  const products = hydrate(best);
  if (Object.keys(products).length < 3) return null;
  return { products, formulaId: `lib-${vibe}` };
}
