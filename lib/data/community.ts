import type { Comment, CommunityPost, Story } from '../social-types';
import { SEED_OUTFITS } from './outfits';

/**
 * Community posts + stories (the "posts", "comments", "stories" tables), derived
 * from the seeded outfits so captions, likes and saves stay in sync.
 */

const BASE = Date.UTC(2026, 4, 29, 12, 0, 0);
function hoursAgo(n: number): string {
  return new Date(BASE - n * 3_600_000).toISOString();
}

const COMMENT_POOL: Array<{ authorId: string; text: string }> = [
  { authorId: 'ivy', text: 'obsessed with this 🔥' },
  { authorId: 'devon', text: 'the shoes pull it together fr' },
  { authorId: 'maya', text: 'such a clean palette' },
  { authorId: 'noah', text: 'need the full fit linked pls' },
  { authorId: 'lena', text: 'this is my whole aesthetic ✨' },
  { authorId: 'sofia', text: 'saving for date night' },
  { authorId: 'kai', text: 'fit goes hard' },
  { authorId: 'theo', text: 'the layering 👏' },
  { authorId: 'priya', text: 'where is the bag from??' },
  { authorId: 'jules', text: 'minimal perfection' },
  { authorId: 'marcus', text: 'timeless.' },
  { authorId: 'remy', text: 'texture game strong' },
];

function commentsFor(index: number, ownerId: string): Comment[] {
  const count = [3, 1, 2, 0, 2, 1, 3, 1, 2, 0][index % 10];
  const out: Comment[] = [];
  for (let i = 0; i < count; i++) {
    const pick = COMMENT_POOL[(index * 3 + i * 5) % COMMENT_POOL.length];
    if (pick.authorId === ownerId) continue;
    out.push({
      id: `c-${index}-${i}`,
      authorId: pick.authorId,
      text: pick.text,
      createdAt: hoursAgo(index * 2 + i),
    });
  }
  return out;
}

export const SEED_POSTS: CommunityPost[] = SEED_OUTFITS.filter(
  (o) => o.visibility === 'public',
).map((o, index) => ({
  id: `p-${o.id}`,
  creatorId: o.ownerId,
  outfitId: o.id,
  caption: o.caption || o.title,
  likes: o.likes,
  saves: o.saves,
  comments: commentsFor(index, o.ownerId),
  occasion: o.occasion,
  type: 'outfit',
  createdAt: hoursAgo(index * 5 + 1),
}));

export const POST_BY_ID: Map<string, CommunityPost> = new Map(SEED_POSTS.map((p) => [p.id, p]));
export const POST_BY_OUTFIT: Map<string, CommunityPost> = new Map(SEED_POSTS.map((p) => [p.outfitId, p]));

export function getPost(id: string): CommunityPost | undefined {
  return POST_BY_ID.get(id);
}

export const SEED_STORIES: Story[] = SEED_OUTFITS.filter((o) => o.storyEnabled).map((o, index) => ({
  id: `s-${o.id}`,
  creatorId: o.ownerId,
  outfitId: o.id,
  label: o.title,
  createdAt: hoursAgo(index * 3 + 1),
}));
