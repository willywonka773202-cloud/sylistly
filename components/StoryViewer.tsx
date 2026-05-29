'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X, Heart, Bookmark, Wand2 } from 'lucide-react';
import type { Story } from '@/lib/social-types';
import { getOutfit } from '@/lib/data/outfits';
import { getCreator } from '@/lib/data/creators';
import { resolveItem } from '@/lib/item-registry';
import { OutfitCollage } from './OutfitCollage';
import { Avatar } from './Primitives';
import { useSocial } from '@/store/social';
import { useOutfits } from '@/store/outfits';
import { timeAgo } from '@/lib/style';
import { successToast } from './Toast';

export function StoryViewer({
  stories,
  startIndex = 0,
  open,
  onClose,
}: {
  stories: Story[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(startIndex);
  const [liked, setLiked] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const markStoryViewed = useSocial((s) => s.markStoryViewed);
  const toggleSaveOutfit = useOutfits((s) => s.toggleSaveOutfit);
  const savedIds = useOutfits((s) => s.savedIds);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  const story = stories[index];
  const outfit = story ? getOutfit(story.outfitId) : undefined;
  const creator = story ? getCreator(story.creatorId) : undefined;

  useEffect(() => {
    if (open && story) {
      markStoryViewed(story.id);
      setLiked(false);
      setShowItems(false);
    }
  }, [open, story, markStoryViewed]);

  function goNext() {
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }
  function goPrev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  if (!open || !story || !outfit || !creator) return null;
  const isSaved = savedIds.includes(outfit.id);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-ink flex items-center justify-center"
      >
        <div className="relative w-full max-w-[440px] h-[100dvh] overflow-hidden">
          <OutfitCollage outfit={outfit} className="absolute inset-0 w-full h-full" rounded="rounded-none" />

          {/* progress bars */}
          <div className="absolute top-0 inset-x-0 px-3 pt-[max(10px,env(safe-area-inset-top))] flex gap-1 z-20">
            {stories.map((s, i) => (
              <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                {i < index && <div className="h-full w-full bg-white" />}
                {i === index && (
                  <motion.div
                    key={`${s.id}-${index}`}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 5, ease: 'linear' }}
                    onAnimationComplete={goNext}
                    className="h-full bg-white"
                  />
                )}
              </div>
            ))}
          </div>

          {/* header */}
          <div className="absolute top-0 inset-x-0 pt-[calc(max(10px,env(safe-area-inset-top))+12px)] px-4 flex items-center gap-2 z-20">
            <Avatar name={creator.name} color={creator.avatarColor} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate drop-shadow">{creator.name}</div>
              <div className="text-[11px] text-white/70">{timeAgo(story.createdAt)} · {story.label}</div>
            </div>
            <button onClick={onClose} className="grid place-items-center w-9 h-9 rounded-full bg-black/25 text-white" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          {/* tap zones */}
          <button onClick={goPrev} className="absolute left-0 top-16 bottom-28 w-1/3 z-10" aria-label="Previous" />
          <button onClick={goNext} className="absolute right-0 top-16 bottom-28 w-1/3 z-10" aria-label="Next" />

          {/* item inspector */}
          <AnimatePresence>
            {showItems && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="absolute left-3 right-3 bottom-32 z-20 glass-card rounded-2xl p-3 max-h-[40%] overflow-y-auto scrollbar-hide"
              >
                <div className="text-2xs uppercase tracking-editorial text-muted mb-2">In this look</div>
                <div className="space-y-1.5">
                  {outfit.itemIds.map((id) => {
                    const item = resolveItem(id);
                    if (!item) return null;
                    return (
                      <div key={id} className="flex items-center justify-between">
                        <span className="text-[13px] text-ink font-medium">{item.name}</span>
                        <span className="text-[11px] text-muted">{item.brand}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* actions */}
          <div className="absolute bottom-0 inset-x-0 pb-[max(20px,env(safe-area-inset-bottom))] px-4 z-20 flex items-center gap-2">
            <button
              onClick={() => setShowItems((v) => !v)}
              className="flex-1 h-12 rounded-full bg-white/15 backdrop-blur text-white text-sm font-semibold border border-white/20"
            >
              {showItems ? 'Hide items' : 'View items'}
            </button>
            <button
              onClick={() => setLiked((v) => !v)}
              className="grid place-items-center w-12 h-12 rounded-full bg-white/15 backdrop-blur border border-white/20"
              aria-label="Like"
            >
              <Heart size={20} className={liked ? 'fill-accent text-accent' : 'text-white'} />
            </button>
            <button
              onClick={() => {
                toggleSaveOutfit(outfit.id);
                successToast(isSaved ? 'Removed from saved' : 'Saved to your looks');
              }}
              className="grid place-items-center w-12 h-12 rounded-full bg-white/15 backdrop-blur border border-white/20"
              aria-label="Save"
            >
              <Bookmark size={20} className={isSaved ? 'fill-white text-white' : 'text-white'} />
            </button>
            <button
              onClick={() => {
                onClose();
                router.push(`/create?remix=${outfit.id}`);
              }}
              className="grid place-items-center w-12 h-12 rounded-full bg-white text-ink"
              aria-label="Recreate"
            >
              <Wand2 size={20} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
