'use client';
import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimationControls, type PanInfo } from 'framer-motion';
import type { Outfit } from '@/lib/social-types';
import { getCreator } from '@/lib/data/creators';
import { OutfitCollage } from './OutfitCollage';
import { Avatar, Chip } from './Primitives';

export type SwipeAction = 'like' | 'dislike' | 'superlike';

export function SwipeCard({
  outfit,
  reasons,
  active,
  offset,
  force,
  onSwipe,
}: {
  outfit: Outfit;
  reasons: string[];
  active: boolean;
  offset: number; // 0 = top
  force?: SwipeAction | null;
  onSwipe: (action: SwipeAction) => void;
}) {
  const controls = useAnimationControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-16, 16]);
  const likeOpacity = useTransform(x, [30, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -30], [1, 0]);
  const superOpacity = useTransform(y, [-150, -40], [1, 0]);
  const creator = getCreator(outfit.ownerId);

  async function fly(action: SwipeAction) {
    if (action === 'superlike') {
      await controls.start({ y: -820, opacity: 0, transition: { duration: 0.32 } });
    } else {
      const dir = action === 'like' ? 1 : -1;
      await controls.start({ x: dir * 720, y: 40, opacity: 0, transition: { duration: 0.3 } });
    }
    onSwipe(action);
  }

  useEffect(() => {
    if (active && force) fly(force);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [force]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -130 && Math.abs(info.offset.x) < 110) {
      fly('superlike');
      return;
    }
    if (info.offset.x > 120) fly('like');
    else if (info.offset.x < -120) fly('dislike');
    else controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
  }

  // stacked appearance for cards behind the top one
  const scale = 1 - offset * 0.05;
  const translateY = offset * 14;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, y, rotate, zIndex: 50 - offset }}
      animate={controls}
      initial={false}
      drag={active}
      dragSnapToOrigin={false}
      dragElastic={0.7}
      onDragEnd={active ? handleDragEnd : undefined}
    >
      <motion.div
        animate={{ scale, y: translateY }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full h-full rounded-[28px] overflow-hidden border border-hairline shadow-card bg-surface-1"
      >
        <OutfitCollage outfit={outfit} className="absolute inset-0 w-full h-full" rounded="rounded-none" />

        {/* swipe overlays */}
        {active && (
          <>
            <motion.div style={{ opacity: likeOpacity }} className="absolute top-8 left-6 -rotate-12 px-4 py-1.5 rounded-xl border-[3px] border-emerald text-emerald font-display text-2xl tracking-wide">
              LOVE
            </motion.div>
            <motion.div style={{ opacity: nopeOpacity }} className="absolute top-8 right-6 rotate-12 px-4 py-1.5 rounded-xl border-[3px] border-accent text-accent font-display text-2xl tracking-wide">
              PASS
            </motion.div>
            <motion.div style={{ opacity: superOpacity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 rounded-xl border-[3px] border-crown text-crown font-display text-2xl tracking-wide">
              SUPER
            </motion.div>
          </>
        )}

        {/* info gradient */}
        <div className="absolute inset-x-0 bottom-0 pt-16 pb-5 px-5 bg-gradient-to-t from-ink/85 via-ink/45 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            {creator && <Avatar name={creator.name} color={creator.avatarColor} size={26} />}
            <span className="text-sm font-semibold text-white drop-shadow">{outfit.title}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reasons.slice(0, 3).map((r) => (
              <span key={r} className="px-2.5 h-7 inline-flex items-center rounded-full bg-white/18 backdrop-blur text-[11px] font-medium text-white border border-white/20">
                {r}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
