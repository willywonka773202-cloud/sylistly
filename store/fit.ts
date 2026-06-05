import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hydrateItemsFromCatalog } from '@/lib/client-catalog';
import { isTransparentRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

interface FitState {
  items: Partial<Record<Category, Product>>;
  setItem: (cat: Category, product: Product) => void;
  replaceItems: (items: Partial<Record<Category, Product>>) => void;
  removeItem: (cat: Category) => void;
  clear: () => void;
  totalCents: () => number;
  count: () => number;
}

function transparentItemsOnly(items: Partial<Record<Category, Product>>): Partial<Record<Category, Product>> {
  return Object.fromEntries(
    Object.entries(items).filter((entry): entry is [Category, Product] =>
      Boolean(entry[1] && isTransparentRenderableProduct(entry[1])),
    ),
  ) as Partial<Record<Category, Product>>;
}

export const useFit = create<FitState>()(
  persist(
    (set, get) => ({
      items: {},
      setItem: (cat, product) => {
        if (!isTransparentRenderableProduct(product)) return;
        set((s) => ({ items: { ...s.items, [cat]: product } }));
      },
      replaceItems: (items) => set({ items: transparentItemsOnly(items) }),
      removeItem: (cat) =>
        set((s) => {
          const next = { ...s.items };
          delete next[cat];
          return { items: next };
        }),
      clear: () => set({ items: {} }),
      totalCents: () =>
        Object.values(get().items).reduce((sum, p) => sum + (p?.priceCents || 0), 0),
      count: () => Object.values(get().items).filter(Boolean).length,
    }),
    {
      name: 'sylistly.fit.v1',
      version: 3,
      migrate: (persistedState) => {
        const state = persistedState as FitState | undefined;
        if (!state?.items) return state as FitState;

        return {
          ...state,
          items: transparentItemsOnly(hydrateItemsFromCatalog(state.items)),
        };
      },
    },
  ),
);
