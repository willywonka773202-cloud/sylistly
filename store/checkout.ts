import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CheckoutProduct } from '@/components/CheckoutSheet';

interface CheckoutSelection {
  title: string;
  lookId?: string;
  productIds?: string[];
  // Kept as an input for existing callers. Only IDs are retained; retailer
  // URLs and prices are deliberately never durable checkout state.
  products?: CheckoutProduct[];
}

interface CheckoutState {
  title: string;
  lookId?: string;
  productIds: string[];
  setCheckout: (payload: CheckoutSelection) => void;
  clearCheckout: () => void;
}

function normalizeProductIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.flatMap((value) => {
    const id = typeof value === 'string'
      ? value.trim()
      : value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'
        ? (value as { id: string }).id.trim()
        : '';
    return id && id.length <= 180 && !id.startsWith('owned-') ? [id] : [];
  })));
}

export const useCheckout = create<CheckoutState>()(
  persist(
    (set) => ({
      title: 'Your fit',
      productIds: [],
      setCheckout: ({ title, lookId, productIds, products }) => set({
        title,
        lookId,
        productIds: normalizeProductIds(productIds ?? products),
      }),
      clearCheckout: () => set({ title: 'Your fit', lookId: undefined, productIds: [] }),
    }),
    {
      name: 'sylistly.checkout.v1',
      version: 2,
      migrate: (persistedState) => {
        const legacy = (persistedState && typeof persistedState === 'object'
          ? persistedState
          : {}) as {
          title?: unknown;
          lookId?: unknown;
          productIds?: unknown;
          products?: unknown;
        };
        return {
          title: typeof legacy.title === 'string' ? legacy.title : 'Your fit',
          lookId: typeof legacy.lookId === 'string' ? legacy.lookId : undefined,
          productIds: normalizeProductIds(legacy.productIds ?? legacy.products),
        };
      },
      partialize: (state) => ({
        title: state.title,
        lookId: state.lookId,
        productIds: state.productIds,
      }),
    },
  ),
);
