import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, Product } from '@/lib/types';
import type { VibeId } from '@/lib/vibes';

/** A single piece's placement on the post canvas — position is a PERCENT of the
 *  canvas (centre-anchored) + scale, so a post renders identically at any size. */
export interface PostPiecePlacement {
  xPct: number;
  yPct: number;
  scale: number;
  z: number;
}

/**
 * A user-composed outfit post — the Studio's output. It snapshots the fit's
 * products so it survives the source fit being deleted, plus a per-piece layout
 * the user arranged by hand. Local-only for now (this device); the model is
 * deliberately a clean, serialisable object so a future "publish" can POST it to
 * the backend unchanged. HONEST: no like/comment counts live here — those need
 * real accounts + a shared DB (see profile page note).
 */
export interface OutfitPost {
  id: string;
  createdAt: string;
  caption: string;
  sourceFitId?: string;
  vibe?: VibeId;
  /** Product snapshot, keyed by slot — the same shape OutfitLookCard renders. */
  items: Partial<Record<Category, Product>>;
  /** Per-product hand-arranged placement (keyed by product id). Absent ⇒ the
   *  card's default collage is used. */
  layout: Record<string, PostPiecePlacement>;
}

interface PostsState {
  posts: OutfitPost[];
  addPost: (post: Omit<OutfitPost, 'id' | 'createdAt'>) => OutfitPost;
  removePost: (id: string) => void;
  updateCaption: (id: string, caption: string) => void;
}

export const usePosts = create<PostsState>()(
  persist(
    (set) => ({
      posts: [],
      addPost: (post) => {
        const created: OutfitPost = {
          ...post,
          id: `post-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        // Newest first; cap at 60 so localStorage can't grow unbounded.
        set((state) => ({ posts: [created, ...state.posts].slice(0, 60) }));
        return created;
      },
      removePost: (id) => set((state) => ({ posts: state.posts.filter((post) => post.id !== id) })),
      updateCaption: (id, caption) =>
        set((state) => ({
          posts: state.posts.map((post) => (post.id === id ? { ...post, caption } : post)),
        })),
    }),
    { name: 'sylistly.posts.v1', version: 1 },
  ),
);
