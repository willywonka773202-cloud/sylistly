'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AestheticId, OccasionKey } from '@/lib/social-types';

interface MeState {
  name: string;
  handle: string;
  bio: string;
  avatarColor: string;
  aesthetics: AestheticId[];
  occasions: OccasionKey[];
  onboarded: boolean;
  setProfile: (partial: Partial<Pick<MeState, 'name' | 'handle' | 'bio' | 'avatarColor'>>) => void;
  setAesthetics: (aesthetics: AestheticId[]) => void;
  setOccasions: (occasions: OccasionKey[]) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useMe = create<MeState>()(
  persist(
    (set) => ({
      name: 'You',
      handle: 'you',
      bio: 'Building my Style DNA on Sylistly.',
      avatarColor: '#c2554e',
      aesthetics: [],
      occasions: [],
      onboarded: false,
      setProfile: (partial) => set((s) => ({ ...s, ...partial })),
      setAesthetics: (aesthetics) => set({ aesthetics }),
      setOccasions: (occasions) => set({ occasions }),
      completeOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
    }),
    { name: 'sylistly.me.v1' },
  ),
);
