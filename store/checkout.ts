import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CheckoutProduct } from '@/components/CheckoutSheet';

interface CheckoutState {
  title: string;
  products: CheckoutProduct[];
  setCheckout: (payload: { title: string; products: CheckoutProduct[] }) => void;
  clearCheckout: () => void;
}

export const useCheckout = create<CheckoutState>()(
  persist(
    (set) => ({
      title: 'Your fit',
      products: [],
      setCheckout: ({ title, products }) => set({ title, products }),
      clearCheckout: () => set({ title: 'Your fit', products: [] }),
    }),
    { name: 'sylistly.checkout.v1' },
  ),
);
