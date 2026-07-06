/**
 * The feed look engine — the ONLY place the three catalog JSONs
 * (client-catalog ~898KB · outfit-library ~336KB · ai-look-library ~108KB)
 * are reached for the feed. Imported STATICALLY only by the server feed page
 * (app/page.tsx), which resolves the opening deck at build time; the client
 * feed island (components/Feed.tsx) loads this via dynamic import() so the
 * catalog never enters the route's First Load JS.
 *
 * `generateLooks` is the single source of truth for deck generation — the
 * server's deterministic opening deck and the client's subsequent re-rolls run
 * the exact same function, so SSR HTML and post-hydration generation agree.
 */
import { getAiLook } from '@/lib/ai-look-library';
import { buildCatalogLook } from '@/lib/client-catalog';
import { getLibraryLook } from '@/lib/outfit-library';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { VIBES, type GeneratorFrame, type VibeId } from '@/lib/vibes';
import {
  isCategorySane,
  lookProducts,
  VIBE_META,
  VIBE_ROTATION,
  type ScrollLook,
} from '@/lib/look-helpers';

/** The deck-generation cursor — serializable so the server can hand it to the
 *  client island, which resumes generation exactly where the server left off. */
export interface GenState {
  seed: number;
  index: number;
  recentIds: string[];
  /** Read-only generation inputs (on-device taste signal). */
  vibeLikes: Record<string, number>;
  vibePasses: Record<string, number>;
  /** Baked-AI looks already shown — avoided. Array (not Set) so it serializes. */
  seenAiIds: string[];
}

/** Matches the feed's original ref defaults (seedRef 101, indexRef 0, …). */
export function initialGenState(): GenState {
  return { seed: 101, index: 0, recentIds: [], vibeLikes: {}, vibePasses: {}, seenAiIds: [] };
}

/**
 * One look, instantly: pre-generated library when nothing is pinned (best
 * coordination scores), live client-side compose whenever the user has locked
 * pieces or switched slots off — the two things the library can't honor.
 */
function composeScrollLook(
  vibe: VibeId,
  frame: GeneratorFrame,
  seed: number,
  avoidProductIds: string[],
  lockedItems: Partial<Record<Category, Product>>,
  disabledSlots: Set<Category>,
): Partial<Record<Category, Product>> | null {
  const hasLocks = Object.keys(lockedItems).length > 0;
  const hasSlotPrefs = disabledSlots.size > 0;
  if (!hasLocks && !hasSlotPrefs) {
    const library = getLibraryLook(vibe, frame, { seed, avoidProductIds });
    if (library) {
      const sane: Partial<Record<Category, Product>> = {};
      for (const [category, product] of Object.entries(library.products)) {
        if (product && isCategorySane(product) && isEditorialCutoutProduct(product)) {
          sane[category as Category] = product;
        }
      }
      if (lookProducts(sane).length >= 3) return sane;
    }
  }
  const vibeSlots = VIBE_META.get(vibe)?.slots || [];
  const targetSlots = vibeSlots.filter((slot) => !disabledSlots.has(slot));
  const built = buildCatalogLook({
    vibe,
    frame,
    budget: 'any',
    mode: 'full',
    seed,
    avoidProductIds,
    lockedItems: hasLocks ? lockedItems : undefined,
    currentItems: hasLocks ? lockedItems : undefined,
    targetSlots: targetSlots.length >= 3 ? targetSlots : undefined,
    transparentOnly: true,
  });
  const products: Partial<Record<Category, Product>> = {};
  for (const [category, product] of Object.entries(built.products)) {
    if (
      product
      && !disabledSlots.has(category as Category)
      && isCategorySane(product)
      && isEditorialCutoutProduct(product)
    ) {
      products[category as Category] = product;
    }
  }
  return lookProducts(products).length >= 3 ? products : null;
}

/**
 * Deal `count` fresh looks, advancing (and returning) the generation cursor.
 * Pure: same (count, frame, filter, state, locks, disabledSlots) → same deck.
 * Was app/page.tsx's `makeLooks`; lifted here so the server's opening deck and
 * the client's re-rolls share one codepath.
 */
export function generateLooks(
  count: number,
  frame: GeneratorFrame,
  filter: VibeId | 'all',
  state: GenState,
  locks: Partial<Record<Category, Product>> = {},
  disabledSlots: Set<Category> = new Set(),
): { looks: ScrollLook[]; state: GenState } {
  let { seed, index } = state;
  let recentIds = state.recentIds;
  const { vibeLikes, vibePasses, seenAiIds } = state;

  const fresh: ScrollLook[] = [];
  // Batch-local picks: dedupes within this deal WITHOUT mutating the persistent
  // seen-set (looks are marked seen only when VIEWED, on the client).
  const batchPicked = new Set<string>();
  let attempts = 0;
  // Net taste signal: a right-swipe (love) lifts a vibe, a left-swipe (pass)
  // lowers it. The most-loved vibe gently steers the rotation; vibes the user
  // keeps passing are skipped. Honest on-device personalization.
  const vibeNet = (v: string) => (vibeLikes[v] || 0) - (vibePasses[v] || 0);
  const topLikedVibe = ([...new Set([
    ...Object.keys(vibeLikes),
    ...Object.keys(vibePasses),
  ])]
    .map((v) => [v, vibeNet(v)] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0] || [])[0] as VibeId | undefined;

  while (fresh.length < count && attempts < count * 4) {
    attempts += 1;
    let vibe: VibeId;
    if (filter !== 'all') {
      vibe = filter;
    } else if (topLikedVibe && index % 3 === 2) {
      vibe = topLikedVibe; // your loves gently steer the rotation
    } else {
      vibe = VIBE_ROTATION[index % VIBE_ROTATION.length];
      if (vibeNet(vibe) <= -3) {
        // keeps getting passed → skip it for the next slot
        index += 1;
        vibe = VIBE_ROTATION[index % VIBE_ROTATION.length];
      }
    }
    index += 1;
    seed += 17;
    const lockedIds = new Set(
      Object.values(locks).map((product) => product?.id).filter(Boolean),
    );
    const avoid = recentIds.filter((id) => !lockedIds.has(id));

    // Claude-baked looks first (only when nothing is pinned — locks and slot
    // prefs need the live engine). The badge is earned, never faked.
    if (lockedIds.size === 0 && disabledSlots.size === 0) {
      const aiLook = getAiLook(filter === 'all' ? vibe : filter, frame, {
        seed,
        seenLookIds: new Set([...seenAiIds, ...batchPicked]),
        avoidProductIds: avoid,
      });
      if (aiLook) {
        batchPicked.add(aiLook.id);
        const ids = lookProducts(aiLook.products).map((product) => product.id);
        recentIds = [...recentIds, ...ids].slice(-80);
        fresh.push({
          key: `look-${seed}`,
          vibe: aiLook.vibe,
          items: aiLook.products,
          gen: 0,
          source: 'syli',
          note: aiLook.note,
          aiId: aiLook.id,
          palette: aiLook.palette,
        });
        continue;
      }
    }

    const items = composeScrollLook(vibe, frame, seed, avoid, locks, disabledSlots);
    if (!items) continue;
    const ids = lookProducts(items).map((product) => product.id);
    recentIds = [...recentIds, ...ids].slice(-80);
    fresh.push({ key: `look-${seed}`, vibe, items, gen: 0, source: 'engine' });
  }

  return { looks: fresh, state: { seed, index, recentIds, vibeLikes, vibePasses, seenAiIds } };
}

/** The deterministic opening deck (default frame, no filter, no personalization)
 *  — server-rendered so the feed paints instantly without shipping the catalog. */
export function composeInitialLooks(count = 4): { looks: ScrollLook[]; cursor: GenState } {
  const { looks, state } = generateLooks(count, 'androgynous', 'all', initialGenState());
  return { looks, cursor: state };
}

/** Representative thumbnail per vibe for the story rail (deterministic, seed 7).
 *  Returns entries (not a Map) so it serializes across the server boundary. */
export function buildVibeThumbs(): Array<[VibeId, Product]> {
  const thumbs: Array<[VibeId, Product]> = [];
  for (const vibe of VIBES) {
    const look = getLibraryLook(vibe.id, 'androgynous', { seed: 7 });
    if (!look) continue;
    const byCat = look.products;
    const pick = byCat.top || byCat.outer || byCat.shoes || lookProducts(byCat)[0];
    if (pick) thumbs.push([vibe.id, pick]);
  }
  return thumbs;
}

// Re-exported for the island's single-slot swap (swapPiece), so the client
// reaches buildCatalogLook only through this lazy-loaded module.
export { buildCatalogLook };
