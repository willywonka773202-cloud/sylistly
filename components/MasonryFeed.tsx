'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Bookmark, MessageCircle } from 'lucide-react';
import type { CommunityPost } from '@/lib/social-types';
import { getOutfit } from '@/lib/data/outfits';
import { getCreator } from '@/lib/data/creators';
import { OutfitCollage } from './OutfitCollage';
import { Avatar } from './Primitives';
import { useSocial } from '@/store/social';
import { compactCount } from '@/lib/style';
import { useMounted } from '@/lib/use-mounted';

const ASPECTS = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square', 'aspect-[5/6]'];

export function MasonryFeed({ posts, onOpen }: { posts: CommunityPost[]; onOpen: (post: CommunityPost) => void }) {
  const columns = useMemo(() => {
    const cols: CommunityPost[][] = [[], []];
    posts.forEach((p, i) => cols[i % 2].push(p));
    return cols;
  }, [posts]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-3">
          {col.map((post, i) => (
            <FeedCard key={post.id} post={post} aspect={ASPECTS[(ci + i * 2) % ASPECTS.length]} onOpen={() => onOpen(post)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FeedCard({ post, aspect, onOpen }: { post: CommunityPost; aspect: string; onOpen: () => void }) {
  const outfit = getOutfit(post.outfitId);
  const creator = getCreator(post.creatorId);
  const liked = useSocial((s) => s.likedPosts.includes(post.id));
  const saved = useSocial((s) => s.savedPosts.includes(post.id));
  const toggleLike = useSocial((s) => s.toggleLike);
  const toggleSavePost = useSocial((s) => s.toggleSavePost);
  const mounted = useMounted();
  if (!outfit || !creator) return null;

  return (
    <motion.div whileTap={{ scale: 0.98 }} className="relative">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative">
          <OutfitCollage outfit={outfit} className={`w-full ${aspect}`} rounded="rounded-2xl" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 pr-2.5 pl-1 h-7 rounded-full glass-card">
            <Avatar name={creator.name} color={creator.avatarColor} size={20} />
            <span className="text-[11px] font-semibold text-ink max-w-[72px] truncate">{creator.name.split(' ')[0]}</span>
          </div>
        </div>
      </button>
      <div className="px-0.5 pt-2">
        <p className="text-[12px] text-ink-soft line-clamp-2 leading-snug">{post.caption}</p>
        <div className="flex items-center gap-3 mt-1.5 text-muted">
          <button
            onClick={() => toggleLike(post.id)}
            className="flex items-center gap-1 btn-press"
            aria-label="Like"
          >
            <Heart size={15} className={mounted && liked ? 'fill-accent text-accent' : ''} />
            <span className="text-[11px]">{compactCount(post.likes + (mounted && liked ? 1 : 0))}</span>
          </button>
          <span className="flex items-center gap-1">
            <MessageCircle size={15} />
            <span className="text-[11px]">{compactCount(post.comments.length)}</span>
          </span>
          <button
            onClick={() => toggleSavePost(post.id)}
            className="ml-auto btn-press"
            aria-label="Save"
          >
            <Bookmark size={15} className={mounted && saved ? 'fill-ink text-ink' : ''} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
