import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, Product } from '@/lib/types';

interface FitState {
  items: Partial<Record<Category, Product>>;
  setItem: (cat: Category, product: Product) => void;
  removeItem: (cat: Category) => void;
  clear: () => void;
  totalCents: () => number;
  count: () => number;
}

export const useFit = create<FitState>()(
  persist(
    (set, get) => ({
      items: {},
      setItem: (cat, product) => set((s) => ({ items: { ...s.items, [cat]: product } })),
      removeItem: (cat) =>
        set((s) => {
          const { [cat]: _, ...rest } = s.items;
          return { items: rest };
        }),
      clear: () => set({ items: {} }),
      totalCents: () =>
        Object.values(get().items).reduce((sum, p) => sum + (p?.priceCents || 0), 0),
      count: () => Object.values(get().items).filter(Boolean).length,
    }),
    { name: 'sylistly.fit.v1' },
  ),
);
