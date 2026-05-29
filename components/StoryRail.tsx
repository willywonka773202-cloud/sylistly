'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { SEED_STORIES } from '@/lib/data/community';
import { getCreator } from '@/lib/data/creators';
import { Avatar } from './Primitives';
import { StoryViewer } from './StoryViewer';
import { useSocial } from '@/store/social';
import { useMe } from '@/store/me';
import { useMounted } from '@/lib/use-mounted';

export function StoryRail() {
  const router = useRouter();
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const viewedStories = useSocial((s) => s.viewedStories);
  const meName = useMe((s) => s.name);
  const meColor = useMe((s) => s.avatarColor);
  const mounted = useMounted();

  const circles = useMemo(() => {
    const order: string[] = [];
    for (const s of SEED_STORIES) if (!order.includes(s.creatorId)) order.push(s.creatorId);
    return order
      .map((cid) => {
        const creator = getCreator(cid);
        const firstIndex = SEED_STORIES.findIndex((s) => s.creatorId === cid);
        const storyIds = SEED_STORIES.filter((s) => s.creatorId === cid).map((s) => s.id);
        return creator ? { creator, firstIndex, storyIds } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, []);

  return (
    <>
      <div className="flex gap-3.5 overflow-x-auto scrollbar-hide px-5 py-1">
        {/* Your OOTD */}
        <button onClick={() => router.push('/create')} className="flex flex-col items-center gap-1.5 shrink-0 btn-press">
          <div className="relative">
            <div className="rounded-full p-[2px] bg-surface-2 border border-dashed border-hairline-2">
              <Avatar name={meName} color={meColor} size={58} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 grid place-items-center w-6 h-6 rounded-full bg-ink text-cream border-2 border-bg">
              <Plus size={14} strokeWidth={2.6} />
            </div>
          </div>
          <span className="text-[11px] text-ink-soft font-medium">Your OOTD</span>
        </button>

        {circles.map((c) => {
          const viewed = mounted && c.storyIds.every((id) => viewedStories.includes(id));
          return (
            <button
              key={c.creator.id}
              onClick={() => setViewerStart(c.firstIndex)}
              className="flex flex-col items-center gap-1.5 shrink-0 btn-press"
            >
              <Avatar name={c.creator.name} color={c.creator.avatarColor} size={62} ring={viewed ? 'viewed' : 'unviewed'} />
              <span className="text-[11px] text-muted-2 font-medium max-w-[64px] truncate">{c.creator.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      <StoryViewer
        stories={SEED_STORIES}
        startIndex={viewerStart ?? 0}
        open={viewerStart !== null}
        onClose={() => setViewerStart(null)}
      />
    </>
  );
}
