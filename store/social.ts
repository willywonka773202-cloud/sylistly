'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SocialState {
  likedPosts: string[];
  savedPosts: string[];
  follows: string[];
  viewedStories: string[];
  toggleLike: (id: string) => void;
  toggleSavePost: (id: string) => void;
  toggleFollow: (creatorId: string) => void;
  markStoryViewed: (id: string) => void;
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
}

export const useSocial = create<SocialState>()(
  persist(
    (set) => ({
      likedPosts: [],
      savedPosts: [],
      follows: [],
      viewedStories: [],
      toggleLike: (id) => set((s) => ({ likedPosts: toggle(s.likedPosts, id) })),
      toggleSavePost: (id) => set((s) => ({ savedPosts: toggle(s.savedPosts, id) })),
      toggleFollow: (creatorId) => set((s) => ({ follows: toggle(s.follows, creatorId) })),
      markStoryViewed: (id) =>
        set((s) => (s.viewedStories.includes(id) ? s : { viewedStories: [id, ...s.viewedStories] })),
    }),
    { name: 'sylistly.social.v1' },
  ),
);
