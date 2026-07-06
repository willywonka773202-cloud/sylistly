import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isTransparentRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import type { VibeId } from '@/lib/vibes';

export interface SavedFitRecord {
  id: string;
  title: string;
  createdAt: string;
  totalCents: number;
  itemCount: number;
  items: Partial<Record<Category, Product>>;
  /** The vibe the fit was generated under — the honest source for grouping/stats
   *  (legacy fits saved before this field fall back to title inference). */
  vibe?: VibeId;
  /** Saved fits are PRIVATE by default (absent ⇒ private); only `public` fits appear on the public profile + feed. */
  visibility?: 'private' | 'public';
  /** Set once the fit is published to the profile + public feed. */
  publishedPostId?: string;
  publishedAt?: string;
}

interface SavedFitsState {
  fits: SavedFitRecord[];
  saveFit: (items: Partial<Record<Category, Product>>, vibe?: VibeId) => SavedFitRecord | null;
  removeFit: (id: string) => void;
  /** Rename a saved fit (user-given title overrides the auto-generated one). */
  renameFit: (id: string, title: string) => void;
  /** Mark a saved fit as published, linking it to the feed/profile post it created. */
  markPublished: (fitId: string, postId: string) => void;
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

function transparentItemsOnly(items: Partial<Record<Category, Product>>): Partial<Record<Category, Product>> {
  return Object.fromEntries(
    Object.entries(items).filter((entry): entry is [Category, Product] =>
      Boolean(entry[1] && isTransparentRenderableProduct(entry[1])),
    ),
  ) as Partial<Record<Category, Product>>;
}

export const useSavedFits = create<SavedFitsState>()(
  persist(
    (set) => ({
      fits: [],
      saveFit: (items, vibe) => {
        const selected = transparentItemsOnly(items);
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
          vibe,
          visibility: 'private',
        };

        set((state) => ({ fits: [savedFit, ...state.fits].slice(0, 24) }));
        return savedFit;
      },
      removeFit: (id) =>
        set((state) => ({ fits: state.fits.filter((fit) => fit.id !== id) })),
      renameFit: (id, title) =>
        set((state) => ({
          fits: state.fits.map((fit) => (fit.id === id ? { ...fit, title } : fit)),
        })),
      markPublished: (fitId, postId) =>
        set((state) => ({
          fits: state.fits.map((fit) =>
            fit.id === fitId
              ? { ...fit, visibility: 'public', publishedPostId: postId, publishedAt: new Date().toISOString() }
              : fit,
          ),
        })),
    }),
    {
      name: 'sylistly.saved-fits.v1',
      version: 3,
      migrate: (persistedState) => {
        const state = persistedState as SavedFitsState | undefined;
        if (!state?.fits) return state as SavedFitsState;

        return {
          ...state,
          fits: state.fits
            // ponytail: items persist as full product snapshots, and
            // transparentItemsOnly already drops broken pieces — re-resolving
            // from the catalog only refreshed names/prices but dragged the
            // 898KB catalog into every route's First Load JS. Dropped; re-add an
            // async post-hydrate refresh if stale prices ever matter.
            .map((fit) => {
              const items = transparentItemsOnly(fit.items);
              const itemCount = Object.keys(items).length;
              return {
                ...fit,
                items,
                itemCount,
                totalCents: Object.values(items).reduce((sum, product) => sum + (product?.priceCents || 0), 0),
              };
            })
            .filter((fit) => fit.itemCount > 0),
        };
      },
    },
  ),
);
