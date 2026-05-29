'use client';
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OccasionKey, PlannerEntry } from '@/lib/social-types';

interface PlannerState {
  entries: PlannerEntry[];
  schedule: (date: string, outfitId: string, occasion?: OccasionKey) => void;
  unschedule: (date: string, outfitId: string) => void;
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      entries: [],
      schedule: (date, outfitId, occasion) =>
        set((s) => ({
          entries: [
            ...s.entries.filter((e) => !(e.date === date && e.outfitId === outfitId)),
            { date, outfitId, occasion },
          ],
        })),
      unschedule: (date, outfitId) =>
        set((s) => ({ entries: s.entries.filter((e) => !(e.date === date && e.outfitId === outfitId)) })),
    }),
    { name: 'sylistly.planner.v1' },
  ),
);

export function useEntriesForDate(date: string): PlannerEntry[] {
  const entries = usePlanner((s) => s.entries);
  return useMemo(() => entries.filter((e) => e.date === date), [entries, date]);
}
