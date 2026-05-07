import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/types';

export type WardrobeStatus = 'owned' | 'similar' | 'wishlist';

export interface WardrobeItem {
  product: Product;
  status: WardrobeStatus;
  addedAt: string;
  updatedAt: string;
}

interface WardrobeState {
  items: Record<string, WardrobeItem>;
  setItemStatus: (product: Product, status: WardrobeStatus) => void;
  toggleItemStatus: (product: Product, status: WardrobeStatus) => void;
  removeItem: (productId: string) => void;
  clearStatus: (status: WardrobeStatus) => void;
  getProductsByStatus: (statuses?: WardrobeStatus[]) => Product[];
  countByStatus: (status: WardrobeStatus) => number;
}

export const WARDROBE_STATUS_LABELS: Record<WardrobeStatus, string> = {
  owned: 'Owned',
  similar: 'Similar',
  wishlist: 'Wishlist',
};

export const useWardrobe = create<WardrobeState>()(
  persist(
    (set, get) => ({
      items: {},
      setItemStatus: (product, status) =>
        set((state) => {
          const existing = state.items[product.id];
          const now = new Date().toISOString();
          return {
            items: {
              ...state.items,
              [product.id]: {
                product,
                status,
                addedAt: existing?.addedAt || now,
                updatedAt: now,
              },
            },
          };
        }),
      toggleItemStatus: (product, status) =>
        set((state) => {
          const existing = state.items[product.id];
          if (existing?.status === status) {
            const next = { ...state.items };
            delete next[product.id];
            return { items: next };
          }

          const now = new Date().toISOString();
          return {
            items: {
              ...state.items,
              [product.id]: {
                product,
                status,
                addedAt: existing?.addedAt || now,
                updatedAt: now,
              },
            },
          };
        }),
      removeItem: (productId) =>
        set((state) => {
          const next = { ...state.items };
          delete next[productId];
          return { items: next };
        }),
      clearStatus: (status) =>
        set((state) => ({
          items: Object.fromEntries(
            Object.entries(state.items).filter(([, item]) => item.status !== status),
          ) as Record<string, WardrobeItem>,
        })),
      getProductsByStatus: (statuses = ['owned', 'similar', 'wishlist']) =>
        Object.values(get().items)
          .filter((item) => statuses.includes(item.status))
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
          .map((item) => item.product),
      countByStatus: (status) => Object.values(get().items).filter((item) => item.status === status).length,
    }),
    {
      name: 'sylistly.wardrobe.v1',
      version: 1,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
