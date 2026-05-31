import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@/lib/types';

const DEFAULT_PROFILE: Profile = {
  id: 'local-profile',
  skinTone: '#c9a98a',
  bodyType: 'androgynous',
  sizes: {},
  stylePrefs: {
    vibes: ['clean', 'streetwear'],
    budget: 'mid',
    brands: [],
  },
  isCreator: false,
};

interface ProfileState {
  profile: Profile;
  setSkinTone: (skinTone: string) => void;
  setBodyType: (bodyType: Profile['bodyType']) => void;
  setTopSize: (top: string) => void;
  setBottomSize: (bottom: string) => void;
  setShoeSize: (shoe: string) => void;
  setBudget: (budget: NonNullable<Profile['stylePrefs']['budget']>) => void;
  setVibesFromText: (value: string) => void;
  setBrandsFromText: (value: string) => void;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      setSkinTone: (skinTone) =>
        set((state) => ({ profile: { ...state.profile, skinTone } })),
      setBodyType: (bodyType) =>
        set((state) => ({ profile: { ...state.profile, bodyType } })),
      setTopSize: (top) =>
        set((state) => ({
          profile: {
            ...state.profile,
            sizes: { ...state.profile.sizes, top },
          },
        })),
      setBottomSize: (bottom) =>
        set((state) => ({
          profile: {
            ...state.profile,
            sizes: { ...state.profile.sizes, bottom: { waist: Number.parseInt(bottom, 10) || undefined } },
          },
        })),
      setShoeSize: (shoe) =>
        set((state) => ({
          profile: {
            ...state.profile,
            sizes: { ...state.profile.sizes, shoe },
          },
        })),
      setBudget: (budget) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, budget },
          },
        })),
      setVibesFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: {
              ...state.profile.stylePrefs,
              vibes: splitCsv(value),
            },
          },
        })),
      setBrandsFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: {
              ...state.profile.stylePrefs,
              brands: splitCsv(value),
            },
          },
        })),
    }),
    { name: 'sylistly.profile.v1' },
  ),
);
