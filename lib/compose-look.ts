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
import {
  buildCatalogLook,
  COMPLETE_BUYABLE_REQUIRED_SLOTS,
  isBuyableClientCatalogProduct,
  respectsCatalogGenerationHardPreferences,
  validateCompleteBuyableLook,
  type CatalogGenerationPreferences,
} from '@/lib/client-catalog';
import { getLibraryLook } from '@/lib/outfit-library';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import {
  getBudgetMaxCents,
  VIBES,
  type GeneratorBudget,
  type GeneratorFrame,
  type VibeId,
} from '@/lib/vibes';
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

export const DEFAULT_FEED_BUDGET: GeneratorBudget = 'under500';
export const DEFAULT_FEED_MAX_TOTAL_CENTS = 50_000;

/** Optional whole-look controls. Keeping this final argument optional preserves
 * every existing `generateLooks` caller while making the default affordable. */
export interface FeedGenerationOptions {
  budget?: GeneratorBudget;
  customMaxCents?: number | null;
  /** Hard cap for the complete outfit. `null` explicitly opts out. */
  maxTotalCents?: number | null;
  preferences?: CatalogGenerationPreferences;
}

interface ResolvedFeedGenerationOptions {
  budget: GeneratorBudget;
  customMaxCents: number | null;
  maxTotalCents: number | null;
  preferences?: CatalogGenerationPreferences;
}

function cleanPreferenceList(value: string[] | undefined): string[] | undefined {
  const cleaned = Array.from(new Set((value || []).map((entry) => entry.trim()).filter(Boolean))).slice(0, 40);
  return cleaned.length ? cleaned : undefined;
}

function resolveFeedGenerationOptions(options: FeedGenerationOptions): ResolvedFeedGenerationOptions {
  const validCustomMax = typeof options.customMaxCents === 'number'
    && Number.isFinite(options.customMaxCents)
    && options.customMaxCents > 0
    ? options.customMaxCents
    : null;
  const requestedBudget = options.budget ?? DEFAULT_FEED_BUDGET;
  const budget = requestedBudget === 'custom' && validCustomMax == null
    ? DEFAULT_FEED_BUDGET
    : requestedBudget;
  const hasExplicitTotalCap = Object.prototype.hasOwnProperty.call(options, 'maxTotalCents');
  const explicitTotalCap = typeof options.maxTotalCents === 'number'
    && Number.isFinite(options.maxTotalCents)
    && options.maxTotalCents > 0
    ? options.maxTotalCents
    : null;
  const budgetMax = getBudgetMaxCents(budget, validCustomMax);
  const derivedTotalCap = Number.isFinite(budgetMax) && budgetMax > 0 ? budgetMax : null;
  return {
    budget,
    customMaxCents: validCustomMax,
    maxTotalCents: hasExplicitTotalCap ? explicitTotalCap : derivedTotalCap,
    preferences: options.preferences ? {
      preferredBrands: cleanPreferenceList(options.preferences.preferredBrands),
      preferredRetailers: cleanPreferenceList(options.preferences.preferredRetailers),
      preferredColors: cleanPreferenceList(options.preferences.preferredColors),
      preferredTerms: cleanPreferenceList(options.preferences.preferredTerms),
      excludedBrands: cleanPreferenceList(options.preferences.excludedBrands),
      excludedRetailers: cleanPreferenceList(options.preferences.excludedRetailers),
      excludedTerms: cleanPreferenceList(options.preferences.excludedTerms),
      preferredSizes: options.preferences.preferredSizes,
      priceTolerancePct: options.preferences.priceTolerancePct,
      taste: options.preferences.taste,
    } : undefined,
  };
}

function sanitizeLockedItems(
  lockedItems: Partial<Record<Category, Product>>,
): Partial<Record<Category, Product>> {
  const sanitized: Partial<Record<Category, Product>> = {};
  for (const [category, product] of Object.entries(lockedItems) as Array<[Category, Product | undefined]>) {
    if (
      product
      && product.category === category
      && isCategorySane(product)
      && isBuyableClientCatalogProduct(product)
    ) {
      sanitized[category] = product;
    }
  }
  return sanitized;
}

function repairCompleteFeedLook({
  candidateItems,
  vibe,
  frame,
  seed,
  avoidProductIds,
  lockedItems,
  disabledSlots,
  generation,
}: {
  candidateItems?: Partial<Record<Category, Product>>;
  vibe: VibeId;
  frame: GeneratorFrame;
  seed: number;
  avoidProductIds: string[];
  lockedItems: Partial<Record<Category, Product>>;
  disabledSlots: Set<Category>;
  generation: ResolvedFeedGenerationOptions;
}): Partial<Record<Category, Product>> | null {
  const requiredSlots = new Set<Category>(COMPLETE_BUYABLE_REQUIRED_SLOTS);
  const preferredItems: Partial<Record<Category, Product>> = {};
  for (const [category, product] of Object.entries(candidateItems || {}) as Array<[Category, Product | undefined]>) {
    if (product && product.category === category && isCategorySane(product)) preferredItems[category] = product;
  }

  const vibeSlots = VIBE_META.get(vibe)?.slots || [];
  const candidateSlots = Object.keys(candidateItems || {}) as Category[];
  const lockedSlots = Object.keys(lockedItems) as Category[];
  const targetSlots = Array.from(new Set<Category>([
    ...COMPLETE_BUYABLE_REQUIRED_SLOTS,
    ...vibeSlots,
    ...candidateSlots,
    ...lockedSlots,
  ])).filter((slot) => requiredSlots.has(slot) || !disabledSlots.has(slot) || Boolean(lockedItems[slot]));

  const built = buildCatalogLook({
    vibe,
    frame,
    budget: generation.budget,
    customMaxCents: generation.customMaxCents,
    mode: 'full',
    seed,
    avoidProductIds,
    currentItems: preferredItems,
    lockedItems: Object.keys(lockedItems).length ? lockedItems : undefined,
    targetSlots,
    transparentOnly: true,
    maxTotalCents: generation.maxTotalCents,
    requireCompleteBuyable: true,
    preferences: generation.preferences,
  });

  const products: Partial<Record<Category, Product>> = {};
  for (const [category, product] of Object.entries(built.products) as Array<[Category, Product | undefined]>) {
    const disabledOptional = disabledSlots.has(category)
      && !requiredSlots.has(category)
      && !lockedItems[category];
    if (
      product
      && !disabledOptional
      && product.category === category
      && isCategorySane(product)
      && isEditorialCutoutProduct(product)
      && isBuyableClientCatalogProduct(product)
    ) {
      products[category] = product;
    }
  }

  return validateCompleteBuyableLook(products, generation.maxTotalCents).ok ? products : null;
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
  generation: ResolvedFeedGenerationOptions,
): Partial<Record<Category, Product>> | null {
  const hasLocks = Object.keys(lockedItems).length > 0;
  const hasSlotPrefs = disabledSlots.size > 0;
  if (!hasLocks && !hasSlotPrefs) {
    const library = getLibraryLook(vibe, frame, {
      seed,
      avoidProductIds,
      maxTotalCents: generation.maxTotalCents,
      taste: generation.preferences?.taste,
      preferences: generation.preferences,
    });
    if (library) {
      const repaired = repairCompleteFeedLook({
        candidateItems: library.products,
        vibe,
        frame,
        seed,
        avoidProductIds,
        lockedItems,
        disabledSlots,
        generation,
      });
      if (repaired) return repaired;
    }
  }

  return repairCompleteFeedLook({
    vibe,
    frame,
    seed,
    avoidProductIds,
    lockedItems,
    disabledSlots,
    generation,
  });
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
  generationOptions: FeedGenerationOptions = {},
): { looks: ScrollLook[]; state: GenState } {
  let { seed, index } = state;
  let recentIds = state.recentIds;
  const { vibeLikes, vibePasses, seenAiIds } = state;
  const generation = resolveFeedGenerationOptions(generationOptions);
  const buyableLocks = sanitizeLockedItems(locks);

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

  while (fresh.length < count && attempts < count * 8) {
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
      Object.values(buyableLocks).map((product) => product?.id).filter(Boolean),
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
        const aiProducts = lookProducts(aiLook.products);
        const aiIsEligible = validateCompleteBuyableLook(
          aiLook.products,
          generation.maxTotalCents,
        ).ok && aiProducts.every((product) => (
          isCategorySane(product)
          && isEditorialCutoutProduct(product)
          && respectsCatalogGenerationHardPreferences(product, generation.preferences)
        ));
        // An altered AI record is no longer the authored look. Accept only a
        // fully valid, unchanged record; otherwise use the budget-aware baked
        // pool instead of repeatedly composing the same cheap repairs.
        if (aiIsEligible) {
          const ids = aiProducts.map((product) => product.id);
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
    }

    const items = composeScrollLook(vibe, frame, seed, avoid, buyableLocks, disabledSlots, generation);
    if (!items) continue;
    const ids = lookProducts(items).map((product) => product.id);
    recentIds = [...recentIds, ...ids].slice(-80);
    fresh.push({ key: `look-${seed}`, vibe, items, gen: 0, source: 'engine' });
  }

  return { looks: fresh, state: { seed, index, recentIds, vibeLikes, vibePasses, seenAiIds } };
}

/** The deterministic opening deck (default frame, no filter, no personalization)
 *  — server-rendered so the feed paints instantly without shipping the catalog. */
export function composeInitialLooks(
  count = 4,
  generationOptions: FeedGenerationOptions = {},
): { looks: ScrollLook[]; cursor: GenState } {
  const { looks, state } = generateLooks(
    count,
    'androgynous',
    'all',
    initialGenState(),
    {},
    new Set(),
    generationOptions,
  );
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
