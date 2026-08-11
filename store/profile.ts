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
    priceTolerancePct: 10,
  },
  isCreator: false,
};

export interface NotificationPreferences {
  /** Show the existing "Drop ready" cue on the local profile. */
  dailyDropReady: boolean;
  /** Show the current saved-look total beside the local profile link. */
  savedLookCount: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyDropReady: true,
  savedLookCount: true,
};

interface ProfileState {
  profile: Profile;
  notificationPreferences: NotificationPreferences;
  setSkinTone: (skinTone: string) => void;
  setBodyType: (bodyType: Profile['bodyType']) => void;
  setTopSize: (top: string) => void;
  setBottomSize: (bottom: string) => void;
  setShoeSize: (shoe: string) => void;
  setBudget: (budget: NonNullable<Profile['stylePrefs']['budget']>) => void;
  setFitPreference: (fit: NonNullable<Profile['stylePrefs']['fit']>) => void;
  setPalettePreference: (palette: NonNullable<Profile['stylePrefs']['palette']>) => void;
  setPriceTolerancePct: (priceTolerancePct: number) => void;
  setVibesFromText: (value: string) => void;
  setBrandsFromText: (value: string) => void;
  setRetailersFromText: (value: string) => void;
  setExcludedBrandsFromText: (value: string) => void;
  setExcludedRetailersFromText: (value: string) => void;
  setColorsFromText: (value: string) => void;
  setMaterialsFromText: (value: string) => void;
  setOccasionsFromText: (value: string) => void;
  setExcludedTermsFromText: (value: string) => void;
  setNotificationPreference: <Key extends keyof NotificationPreferences>(
    preference: Key,
    enabled: NotificationPreferences[Key],
  ) => void;
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
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
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
      setFitPreference: (fit) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, fit },
          },
        })),
      setPalettePreference: (palette) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, palette },
          },
        })),
      setPriceTolerancePct: (priceTolerancePct) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: {
              ...state.profile.stylePrefs,
              priceTolerancePct: Math.min(20, Math.max(0, Math.round(priceTolerancePct))),
            },
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
      setRetailersFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, retailers: splitCsv(value) },
          },
        })),
      setExcludedBrandsFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, excludedBrands: splitCsv(value) },
          },
        })),
      setExcludedRetailersFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, excludedRetailers: splitCsv(value) },
          },
        })),
      setColorsFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, colors: splitCsv(value) },
          },
        })),
      setMaterialsFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, materials: splitCsv(value) },
          },
        })),
      setOccasionsFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, occasions: splitCsv(value) },
          },
        })),
      setExcludedTermsFromText: (value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            stylePrefs: { ...state.profile.stylePrefs, excludedTerms: splitCsv(value) },
          },
        })),
      setNotificationPreference: (preference, enabled) =>
        set((state) => ({
          notificationPreferences: {
            ...state.notificationPreferences,
            [preference]: enabled,
          },
        })),
    }),
    { name: 'sylistly.profile.v1' },
  ),
);
