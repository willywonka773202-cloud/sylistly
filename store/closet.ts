'use client';
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AestheticId, ClosetItem, Formality, Season, Warmth } from '@/lib/social-types';
import type { Category } from '@/lib/types';
import type { GarmentShape } from '@/lib/garment-art';
import { CLOSET_ITEMS } from '@/lib/data/closet';
import { registerItems, unregisterItem } from '@/lib/item-registry';

const SEED_ME = CLOSET_ITEMS.filter((i) => i.ownerId === 'me');

export interface NewItemInput {
  name: string;
  brand?: string;
  category: Category;
  shape: GarmentShape;
  color: string;
  colorName?: string;
  subcategory?: string;
  tags?: AestheticId[];
  formality?: Formality;
  season?: Season;
  warmth?: Warmth;
  priceCents?: number;
  shopUrl?: string;
}

interface ClosetState {
  userItems: ClosetItem[];
  favorites: string[];
  hiddenIds: string[];
  addItem: (input: NewItemInput) => ClosetItem;
  removeItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
}

export const useCloset = create<ClosetState>()(
  persist(
    (set) => ({
      userItems: [],
      favorites: [],
      hiddenIds: [],
      addItem: (input) => {
        const item: ClosetItem = {
          id: `user-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: input.name.trim() || 'New piece',
          brand: input.brand?.trim() || 'My closet',
          category: input.category,
          subcategory: input.subcategory || input.category,
          shape: input.shape,
          color: input.color,
          colorName: input.colorName || 'Custom',
          tags: input.tags || [],
          formality: input.formality || 'casual',
          season: input.season || 'all',
          warmth: input.warmth || 'mid',
          priceCents: input.priceCents,
          shopUrl: input.shopUrl,
          ownerId: 'me',
          source: 'user',
          createdAt: new Date().toISOString(),
        };
        registerItems([item]);
        set((s) => ({ userItems: [item, ...s.userItems] }));
        return item;
      },
      removeItem: (id) =>
        set((s) => {
          if (s.userItems.some((i) => i.id === id)) {
            unregisterItem(id);
            return {
              userItems: s.userItems.filter((i) => i.id !== id),
              favorites: s.favorites.filter((f) => f !== id),
            };
          }
          return { hiddenIds: [...new Set([...s.hiddenIds, id])] };
        }),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
    }),
    {
      name: 'sylistly.closet.v1',
      onRehydrateStorage: () => (state) => {
        if (state?.userItems?.length) registerItems(state.userItems);
      },
    },
  ),
);

/** The user's full closet = seeded 'me' items + user-added, minus removed, newest first. */
export function useMyClosetItems(): ClosetItem[] {
  const userItems = useCloset((s) => s.userItems);
  const hidden = useCloset((s) => s.hiddenIds);
  return useMemo(
    () =>
      [...userItems, ...SEED_ME]
        .filter((i) => !hidden.includes(i.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [userItems, hidden],
  );
}
