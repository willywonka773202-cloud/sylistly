'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Outfit, StyleDNA } from '@/lib/social-types';
import { applySwipe, emptyDNA } from '@/lib/recommend';

interface DnaState {
  dna: StyleDNA;
  swipe: (outfit: Outfit, action: 'like' | 'dislike' | 'superlike' | 'save') => void;
  reset: () => void;
}

export const useStyleDNA = create<DnaState>()(
  persist(
    (set) => ({
      dna: emptyDNA(),
      swipe: (outfit, action) => set((s) => ({ dna: applySwipe(s.dna, outfit, action) })),
      reset: () => set({ dna: emptyDNA() }),
    }),
    { name: 'sylistly.styledna.v1' },
  ),
);
