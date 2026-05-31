'use client';
import { useEffect } from 'react';
import { motion, useAnimationControls, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { OutfitBoard } from '@/components/OutfitBoard';
import type { FeedPost } from '@/store/social-feed';

export type SwipeAction = 'like' | 'pass' | 'super';

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function SwipeCard({
  post,
  active,
  offset,
  force,
  onResolve,
}: {
  post: FeedPost;
  active: boolean;
  offset: number;
  force?: SwipeAction | null;
  onResolve: (action: SwipeAction) => void;
}) {
  const controls = useAnimationControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-15, 15]);
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -40], [1, 0]);
  const superOpacity = useTransform(y, [-150, -50], [1, 0]);

  async function fly(action: SwipeAction) {
    if (action === 'super') {
      await controls.start({ y: -820, opacity: 0, transition: { duration: 0.32 } });
    } else {
      await controls.start({ x: action === 'like' ? 760 : -760, y: 60, opacity: 0, transition: { duration: 0.3 } });
    }
    onResolve(action);
  }

  useEffect(() => {
    if (active && force) fly(force);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [force]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -140 && Math.abs(info.offset.x) < 120) return fly('super');
    if (info.offset.x > 120) return fly('like');
    if (info.offset.x < -120) return fly('pass');
    controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } });
  }

  const scale = 1 - offset * 0.05;
  const translateY = offset * 16;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, y, rotate, zIndex: 60 - offset }}
      animate={controls}
      initial={false}
      drag={active}
      dragSnapToOrigin={false}
      dragElastic={0.65}
      onDragEnd={active ? onDragEnd : undefined}
    >
      <motion.div
        animate={{ scale, y: translateY }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative h-full w-full overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#181613_0%,#0e0d0c_100%)] p-3 shadow-[0_30px_70px_rgba(0,0,0,.5)]"
      >
        <OutfitBoard items={post.items} className="h-[74%] w-full" />

        {active && (
          <>
            <motion.div style={{ opacity: likeOpacity }} className="absolute left-6 top-7 -rotate-12 rounded-xl border-[3px] border-accent px-3 py-1 font-serif text-2xl font-bold tracking-wide text-accent">
              LOVE
            </motion.div>
            <motion.div style={{ opacity: nopeOpacity }} className="absolute right-6 top-7 rotate-12 rounded-xl border-[3px] border-white/70 px-3 py-1 font-serif text-2xl font-bold tracking-wide text-white/80">
              PASS
            </motion.div>
            <motion.div style={{ opacity: superOpacity }} className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-xl border-[3px] border-amber-300 px-3 py-1 font-serif text-2xl font-bold tracking-wide text-amber-300">
              SUPER
            </motion.div>
          </>
        )}

        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">{post.avatar}</span>
            {post.username}
          </span>
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-money backdrop-blur">{formatPrice(post.totalCents)}</span>
        </div>

        <div className="absolute inset-x-3 bottom-3 px-1">
          <div className="font-serif text-[22px] font-semibold leading-tight text-ink">{post.title}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-accent/30 bg-accent/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-accent-hot">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
