'use client';
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Outfit } from '@/lib/social-types';
import { SEED_OUTFITS } from '@/lib/data/outfits';

interface OutfitsState {
  userOutfits: Outfit[];
  savedIds: string[];
  saveOutfit: (outfit: Outfit) => void;
  deleteOutfit: (id: string) => void;
  toggleSaveOutfit: (id: string) => void;
}

export const useOutfits = create<OutfitsState>()(
  persist(
    (set) => ({
      userOutfits: [],
      savedIds: [],
      saveOutfit: (outfit) =>
        set((s) => {
          const exists = s.userOutfits.some((o) => o.id === outfit.id);
          return {
            userOutfits: exists
              ? s.userOutfits.map((o) => (o.id === outfit.id ? outfit : o))
              : [outfit, ...s.userOutfits],
          };
        }),
      deleteOutfit: (id) =>
        set((s) => ({
          userOutfits: s.userOutfits.filter((o) => o.id !== id),
          savedIds: s.savedIds.filter((x) => x !== id),
        })),
      toggleSaveOutfit: (id) =>
        set((s) => ({
          savedIds: s.savedIds.includes(id)
            ? s.savedIds.filter((x) => x !== id)
            : [id, ...s.savedIds],
        })),
    }),
    { name: 'sylistly.outfits.v1' },
  ),
);

/** All outfits known to the app: user-created first, then seed. */
export function useAllOutfits(): Outfit[] {
  const userOutfits = useOutfits((s) => s.userOutfits);
  return useMemo(() => [...userOutfits, ...SEED_OUTFITS], [userOutfits]);
}

export function useResolveOutfit() {
  const all = useAllOutfits();
  return useMemo(() => {
    const map = new Map(all.map((o) => [o.id, o]));
    return (id: string): Outfit | undefined => map.get(id);
  }, [all]);
}

/** Outfits owned by the user (created + seeded 'me'). */
export function useMyOutfits(): Outfit[] {
  const userOutfits = useOutfits((s) => s.userOutfits);
  return useMemo(
    () =>
      [...userOutfits, ...SEED_OUTFITS.filter((o) => o.ownerId === 'me')].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [userOutfits],
  );
}

export function useSavedOutfits(): Outfit[] {
  const savedIds = useOutfits((s) => s.savedIds);
  const all = useAllOutfits();
  return useMemo(() => {
    const map = new Map(all.map((o) => [o.id, o]));
    return savedIds.map((id) => map.get(id)).filter((o): o is Outfit => Boolean(o));
  }, [savedIds, all]);
}
