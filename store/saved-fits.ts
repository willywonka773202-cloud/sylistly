import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, Product } from '@/lib/types';

export interface SavedFitRecord {
  id: string;
  title: string;
  createdAt: string;
  totalCents: number;
  itemCount: number;
  items: Partial<Record<Category, Product>>;
}

interface SavedFitsState {
  fits: SavedFitRecord[];
  saveFit: (items: Partial<Record<Category, Product>>) => SavedFitRecord | null;
  removeFit: (id: string) => void;
}

function createTitle(items: Partial<Record<Category, Product>>, itemCount: number): string {
  const brands = Array.from(
    new Set(
      Object.values(items)
        .filter((product): product is Product => Boolean(product))
        .map((product) => product.brand),
    ),
  ).slice(0, 2);

  if (!brands.length) return `${itemCount}-piece fit`;
  if (brands.length === 1) return `${brands[0]} ${itemCount}-piece fit`;
  return `${brands.join(' + ')} fit`;
}

export const useSavedFits = create<SavedFitsState>()(
  persist(
    (set) => ({
      fits: [],
      saveFit: (items) => {
        const selected = Object.fromEntries(
          Object.entries(items).filter(([, product]) => Boolean(product)),
        ) as Partial<Record<Category, Product>>;
        const itemCount = Object.keys(selected).length;

        if (!itemCount) return null;

        const totalCents = Object.values(selected).reduce(
          (sum, product) => sum + (product?.priceCents || 0),
          0,
        );
        const savedFit: SavedFitRecord = {
          id: `fit-${Date.now()}`,
          title: createTitle(selected, itemCount),
          createdAt: new Date().toISOString(),
          totalCents,
          itemCount,
          items: selected,
        };

        set((state) => ({ fits: [savedFit, ...state.fits].slice(0, 24) }));
        return savedFit;
      },
      removeFit: (id) =>
        set((state) => ({ fits: state.fits.filter((fit) => fit.id !== id) })),
    }),
    { name: 'sylistly.saved-fits.v1' },
  ),
);
