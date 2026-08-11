/**
 * Shared-look resolver for /look/[id] (page + OG image use the same logic).
 * Two slug families:
 *   syli-…  — a baked, genuinely Claude-composed look from the AI library
 *   c-…     — any composed fit, encoded piece-by-piece (lib/share-codes)
 */
import { getAiLookById } from '@/lib/ai-look-library';
import { decodeLookSlug } from '@/lib/share-codes';
import type { Category, Product } from '@/lib/types';
import { VIBES } from '@/lib/vibes';

export interface SharedLook {
  items: Partial<Record<Category, Product>>;
  title: string;
  /** Claude's real styling note — present only on baked looks. */
  note?: string;
  palette?: string[];
  isSyli: boolean;
}

function isCompletePublicComposition(items: Partial<Record<Category, Product>>): boolean {
  return Boolean(items.top && items.bottom && items.shoes)
    && Object.values(items).every((product) => !product || !product.id.startsWith('owned-'));
}

export function resolveSharedLook(rawId: string): SharedLook | null {
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return null;
  }
  if (id.startsWith('syli-')) {
    const look = getAiLookById(id);
    if (!look || !isCompletePublicComposition(look.products)) return null;
    const label = VIBES.find((vibe) => vibe.id === look.vibe)?.label || 'Styled';
    return {
      items: look.products,
      title: `${label} fit`,
      note: look.note,
      palette: look.palette,
      isSyli: true,
    };
  }
  const items = decodeLookSlug(id);
  if (!items || !isCompletePublicComposition(items)) return null;
  return { items, title: 'Styled fit', isSyli: false };
}

export function sharedLookProducts(look: SharedLook): Product[] {
  return Object.values(look.items).filter((product): product is Product => Boolean(product));
}

export function sharedLookTotalCents(look: SharedLook): number {
  return sharedLookProducts(look).reduce((sum, product) => sum + (product.priceCents || 0), 0);
}
