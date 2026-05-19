import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hydrateProductFromCatalog } from '@/lib/catalog';
import type { Category, Product } from '@/lib/types';

/**
 * Local-only wardrobe store. Stores the user's real choices — pieces
 * they explicitly added from the catalog/feed/build — under closet or
 * wishlist status. We never seed fake "owned" items; an empty store
 * stays empty until the user acts.
 *
 * Items are persisted by serializing the full Product shape, mirroring
 * how saved-fits.ts persists. This avoids requiring a re-fetch from the
 * catalog on every page load.
 */
export type WardrobeStatus = 'closet' | 'wishlist';

export interface WardrobeItem {
  id: string;             // local-unique id (deterministic from productId)
  productId: string;      // catalog product id
  product: Product;       // snapshot of the catalog product at add-time
  status: WardrobeStatus;
  addedAt: string;        // ISO timestamp
  source: 'catalog' | 'saved-fit' | 'feed' | 'build' | 'manual';
}

interface WardrobeState {
  items: WardrobeItem[];

  /** Read selectors (cheap, pure derived data — call inline if you want
   * them reactive, otherwise just call from inside components). */
  closetCount: () => number;
  wishlistCount: () => number;
  byCategory: () => Partial<Record<Category, WardrobeItem[]>>;
  hasItem: (productId: string) => boolean;
  isInCloset: (productId: string) => boolean;
  isInWishlist: (productId: string) => boolean;

  /** Mutations. Each is idempotent on the (productId, status) pair —
   * adding an item that already exists at the same status is a no-op;
   * adding an item that exists at the other status MOVES it. */
  addToCloset: (product: Product, source?: WardrobeItem['source']) => void;
  addToWishlist: (product: Product, source?: WardrobeItem['source']) => void;
  moveToCloset: (productId: string) => void;
  moveToWishlist: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearAll: () => void;
}

const MAX_ITEMS = 240;

function makeItemId(productId: string): string {
  return `wardrobe-${productId}`;
}

function makeItem(
  product: Product,
  status: WardrobeStatus,
  source: WardrobeItem['source'],
): WardrobeItem {
  const hydratedProduct = hydrateProductFromCatalog(product);
  return {
    id: makeItemId(hydratedProduct.id),
    productId: hydratedProduct.id,
    product: hydratedProduct,
    status,
    addedAt: new Date().toISOString(),
    source,
  };
}

function upsertItem(
  current: WardrobeItem[],
  product: Product,
  status: WardrobeStatus,
  source: WardrobeItem['source'],
): WardrobeItem[] {
  const existingIndex = current.findIndex((entry) => entry.productId === product.id);
  const hydratedProduct = hydrateProductFromCatalog(product);
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    const updated: WardrobeItem = {
      ...existing,
      id: makeItemId(hydratedProduct.id),
      productId: hydratedProduct.id,
      product: hydratedProduct,
      status,
      addedAt: existing.status === status ? existing.addedAt : new Date().toISOString(),
    };
    if (
      existing.status === updated.status
      && existing.product.imageUrl === updated.product.imageUrl
      && existing.product.imageTransparentUrl === updated.product.imageTransparentUrl
      && existing.product.imageCutoutUrl === updated.product.imageCutoutUrl
    ) {
      return current; // no-op
    }
    const next = current.slice();
    next[existingIndex] = updated;
    return next;
  }
  return [makeItem(product, status, source), ...current].slice(0, MAX_ITEMS);
}

// Coerce arbitrary input into a clean WardrobeItem[].  Used by every
// path that might surface bad shape: store mutations, rehydration, and
// the selectWardrobeItems read selector below.  We accept the cost of
// re-validating on every read because the alternative is reasoning
// about "is the store healthy yet?" at every call site — which is what
// caused the .filter-is-not-a-function crash.
function normalizeItems(value: unknown): WardrobeItem[] {
  if (!Array.isArray(value)) return [];
  const out: WardrobeItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<WardrobeItem>;
    const valid = (
      typeof candidate.id === 'string'
      && typeof candidate.productId === 'string'
      && (candidate.status === 'closet' || candidate.status === 'wishlist')
      && typeof candidate.product === 'object'
      && candidate.product !== null
      && typeof (candidate.product as Product).id === 'string'
    );
    if (!valid) continue;
    const status = candidate.status === 'closet' || candidate.status === 'wishlist' ? candidate.status : 'wishlist';
    const product = hydrateProductFromCatalog(candidate.product as Product);
    out.push({
      id: makeItemId(product.id),
      productId: product.id,
      product,
      status,
      addedAt: typeof candidate.addedAt === 'string' ? candidate.addedAt : new Date().toISOString(),
      source: candidate.source || 'manual',
    });
  }
  return out;
}

export const useWardrobe = create<WardrobeState>()(
  persist(
    (set, get) => ({
      items: [],

      closetCount: () => normalizeItems(get().items).filter((item) => item.status === 'closet').length,
      wishlistCount: () => normalizeItems(get().items).filter((item) => item.status === 'wishlist').length,

      byCategory: () => {
        const out: Partial<Record<Category, WardrobeItem[]>> = {};
        for (const item of normalizeItems(get().items)) {
          const cat = item.product.category;
          if (!out[cat]) out[cat] = [];
          out[cat]!.push(item);
        }
        return out;
      },

      hasItem: (productId) => normalizeItems(get().items).some((entry) => entry.productId === productId),
      isInCloset: (productId) =>
        normalizeItems(get().items).some((entry) => entry.productId === productId && entry.status === 'closet'),
      isInWishlist: (productId) =>
        normalizeItems(get().items).some((entry) => entry.productId === productId && entry.status === 'wishlist'),

      addToCloset: (product, source = 'manual') =>
        set((state) => ({ items: upsertItem(normalizeItems(state.items), product, 'closet', source) })),
      addToWishlist: (product, source = 'manual') =>
        set((state) => ({ items: upsertItem(normalizeItems(state.items), product, 'wishlist', source) })),

      moveToCloset: (productId) =>
        set((state) => {
          const next = normalizeItems(state.items).map((item) =>
            item.productId === productId && item.status !== 'closet'
              ? { ...item, status: 'closet' as WardrobeStatus, addedAt: new Date().toISOString() }
              : item,
          );
          return { items: next };
        }),
      moveToWishlist: (productId) =>
        set((state) => {
          const next = normalizeItems(state.items).map((item) =>
            item.productId === productId && item.status !== 'wishlist'
              ? { ...item, status: 'wishlist' as WardrobeStatus, addedAt: new Date().toISOString() }
              : item,
          );
          return { items: next };
        }),

      removeItem: (productId) =>
        set((state) => ({ items: normalizeItems(state.items).filter((entry) => entry.productId !== productId) })),

      clearAll: () => set({ items: [] }),
    }),
    {
      // Keep the storage key stable so we don't strand the user's prior
      // closet entries — the version bump + migrate is what recovers
      // from a malformed v1 shape (e.g. items persisted as an object
      // map, or a future schema we don't yet recognize).
      name: 'sylistly.wardrobe.v1',
      version: 3,
      migrate: (persistedState, fromVersion) => {
        // Accept anything, normalize to a known-good array. Earlier
        // drafts of this store had a different shape; this migrate
        // path is what stops the .filter-is-not-a-function crash for
        // users who already loaded the old shape into localStorage.
        if (!persistedState || typeof persistedState !== 'object') {
          return { items: [] };
        }
        const candidate = persistedState as { items?: unknown };
        return { ...(persistedState as object), items: normalizeItems(candidate.items) };
      },
      // Belt-and-suspenders: even if migrate isn't invoked (e.g. fresh
      // user, no persisted state) the rehydration callback coerces
      // items to an array. The state arg can be undefined on
      // hydration error, hence the guard.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.items = normalizeItems(state.items);
        }
      },
    },
  ),
);

/**
 * Read-side safe selector. Every consumer should use this instead of
 * `useWardrobe((state) => state.items)` — it guarantees an array
 * regardless of persistence state, so components can call
 * `.filter` / `.map` / for-of without defensive checks of their own.
 *
 * Usage:
 *   const wardrobeItems = useWardrobe(selectWardrobeItems);
 *   const closet = wardrobeItems.filter((i) => i.status === 'closet');
 */
export function selectWardrobeItems(state: WardrobeState): WardrobeItem[] {
  return normalizeItems(state.items);
}
