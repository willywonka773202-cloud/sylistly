import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  return {
    id: makeItemId(product.id),
    productId: product.id,
    product,
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
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    if (existing.status === status) return current; // no-op
    const updated: WardrobeItem = { ...existing, status, addedAt: new Date().toISOString() };
    const next = current.slice();
    next[existingIndex] = updated;
    return next;
  }
  return [makeItem(product, status, source), ...current].slice(0, MAX_ITEMS);
}

export const useWardrobe = create<WardrobeState>()(
  persist(
    (set, get) => ({
      items: [],

      closetCount: () => get().items.filter((item) => item.status === 'closet').length,
      wishlistCount: () => get().items.filter((item) => item.status === 'wishlist').length,

      byCategory: () => {
        const out: Partial<Record<Category, WardrobeItem[]>> = {};
        for (const item of get().items) {
          const cat = item.product.category;
          if (!out[cat]) out[cat] = [];
          out[cat]!.push(item);
        }
        return out;
      },

      hasItem: (productId) => get().items.some((entry) => entry.productId === productId),
      isInCloset: (productId) =>
        get().items.some((entry) => entry.productId === productId && entry.status === 'closet'),
      isInWishlist: (productId) =>
        get().items.some((entry) => entry.productId === productId && entry.status === 'wishlist'),

      addToCloset: (product, source = 'manual') =>
        set((state) => ({ items: upsertItem(state.items, product, 'closet', source) })),
      addToWishlist: (product, source = 'manual') =>
        set((state) => ({ items: upsertItem(state.items, product, 'wishlist', source) })),

      moveToCloset: (productId) =>
        set((state) => {
          const next = state.items.map((item) =>
            item.productId === productId && item.status !== 'closet'
              ? { ...item, status: 'closet' as WardrobeStatus, addedAt: new Date().toISOString() }
              : item,
          );
          return { items: next };
        }),
      moveToWishlist: (productId) =>
        set((state) => {
          const next = state.items.map((item) =>
            item.productId === productId && item.status !== 'wishlist'
              ? { ...item, status: 'wishlist' as WardrobeStatus, addedAt: new Date().toISOString() }
              : item,
          );
          return { items: next };
        }),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((entry) => entry.productId !== productId) })),

      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'sylistly.wardrobe.v1',
      version: 1,
      // We persist the Product snapshot inside each WardrobeItem so a
      // user's wardrobe survives a catalog refresh that drops a product.
      // No migration logic needed yet — v1 is the first shape.
    },
  ),
);
