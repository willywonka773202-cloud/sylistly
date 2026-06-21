/**
 * AI-baked look library — genuinely Claude-composed outfits, generated
 * offline by scripts/bake-ai-looks.mjs (nightly, hard dollar cap) and served
 * at $0 marginal cost. Only looks in THIS library earn the "Styled by Syli"
 * badge; the deterministic engine never does.
 */
import aiData from '@/data/ai-look-library.json';
import { CLIENT_CATALOG_PRODUCTS } from '@/lib/client-catalog';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame, VibeId } from '@/lib/vibes';

interface BakedLookRecord {
  id: string;
  vibe: string;
  frame: string;
  slots: Record<string, string>;
  stylingNotes?: string;
  palette?: string[];
  formulaLabel?: string;
  bakedAt?: string;
}

export interface AiLook {
  id: string;
  vibe: VibeId;
  frame: GeneratorFrame;
  products: Partial<Record<Category, Product>>;
  note?: string;
  palette?: string[];
  formulaLabel?: string;
}

const BY_ID = new Map(CLIENT_CATALOG_PRODUCTS.map((product) => [product.id, product]));

const RECORDS: BakedLookRecord[] = ((aiData as unknown as { looks?: BakedLookRecord[] }).looks || []);

function hydrate(record: BakedLookRecord): AiLook | null {
  const products: Partial<Record<Category, Product>> = {};
  for (const [slot, id] of Object.entries(record.slots || {})) {
    const product = BY_ID.get(id);
    if (product && isEditorialCutoutProduct(product)) products[slot as Category] = product;
  }
  const count = Object.keys(products).length;
  if (count < 4 || !products.top || !products.bottom || !products.shoes) return null;
  return {
    id: record.id,
    vibe: record.vibe as VibeId,
    frame: record.frame as GeneratorFrame,
    products,
    note: record.stylingNotes,
    palette: record.palette,
    formulaLabel: record.formulaLabel,
  };
}

const HYDRATED: AiLook[] = RECORDS.map(hydrate).filter((look): look is AiLook => Boolean(look));

export function aiLibrarySize(): number {
  return HYDRATED.length;
}

/** All hydrated baked-look ids — for the sitemap (every one is a renderable /look/[id]). */
export function listAiLookIds(): string[] {
  return HYDRATED.map((look) => look.id);
}

/** Look up a baked look by its id (share pages: /look/syli-…). */
export function getAiLookById(id: string): AiLook | null {
  return HYDRATED.find((look) => look.id === id) || null;
}

function jitter(seed: number, n: number): number {
  const x = Math.sin((seed + n) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Pick a fresh Claude-composed look for the vibe × frame. Returns null when
 * the library has nothing unseen — callers fall back to the engine.
 */
export function getAiLook(
  vibe: VibeId | 'all',
  frame: GeneratorFrame,
  opts: { seed?: number; seenLookIds?: Set<string>; avoidProductIds?: string[] } = {},
): AiLook | null {
  const seen = opts.seenLookIds || new Set<string>();
  const avoid = new Set(opts.avoidProductIds || []);
  const seed = opts.seed ?? 0;

  let best: AiLook | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < HYDRATED.length; i += 1) {
    const look = HYDRATED[i];
    if (seen.has(look.id)) continue;
    if (vibe !== 'all' && look.vibe !== vibe) continue;
    if (look.frame !== frame && look.frame !== 'androgynous') continue;
    let overlap = 0;
    for (const product of Object.values(look.products)) {
      if (product && avoid.has(product.id)) overlap += 1;
    }
    const score = -overlap * 2 + jitter(seed, i);
    if (score > bestScore) {
      bestScore = score;
      best = look;
    }
  }
  return best;
}
