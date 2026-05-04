import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, Product } from '@/lib/types';

export interface WardrobeItem {
  productId: string;
  category: Category;
  brand: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  addedAt: string;
}

interface WardrobeState {
  ownedItems: WardrobeItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  hasItem: (productId: string) => boolean;
  clearWardrobe: () => void;
}

export const useWardrobe = create<WardrobeState>()(
  persist(
    (set, get) => ({
      ownedItems: [],
      addItem: (product) => {
        if (get().hasItem(product.id)) return;
        const item: WardrobeItem = {
          productId: product.id,
          category: product.category,
          brand: product.brand,
          name: product.name,
          imageUrl: product.imageUrl,
          priceCents: product.priceCents,
          addedAt: new Date().toISOString(),
        };
        set((state) => ({ ownedItems: [item, ...state.ownedItems].slice(0, 200) }));
      },
      removeItem: (productId) =>
        set((state) => ({ ownedItems: state.ownedItems.filter((item) => item.productId !== productId) })),
      hasItem: (productId) => get().ownedItems.some((item) => item.productId === productId),
      clearWardrobe: () => set({ ownedItems: [] }),
    }),
    { name: 'sylistly.wardrobe.v1' },
  ),
);
