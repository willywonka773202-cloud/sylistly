'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Heart, RotateCcw, Sparkles, Star, Wand2, X } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { SwipeCard, type SwipeAction } from '@/components/SwipeDeck';
import { outfitBoardProducts } from '@/components/OutfitBoard';
import { useSocialFeed, type FeedPost } from '@/store/social-feed';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';

export default function SwipePage() {
  const posts = useSocialFeed((s) => s.posts);
  const toggleLike = useSocialFeed((s) => s.toggleLike);
  const toggleSave = useSocialFeed((s) => s.toggleSave);
  const generateMore = useSocialFeed((s) => s.generateMorePosts);
  const replaceItems = useFit((s) => s.replaceItems);
  const saveFit = useSavedFits((s) => s.saveFit);
  const router = useRouter();

  const [seen, setSeen] = useState<string[]>([]);
  const [force, setForce] = useState<SwipeAction | null>(null);
  const [likedVibes, setLikedVibes] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const deck = useMemo(
    () => posts.filter((p) => !seen.includes(p.id) && outfitBoardProducts(p.items).length >= 4),
    [posts, seen],
  );
  const top = deck[0];

  useEffect(() => {
    if (deck.length < 5) generateMore(14);
  }, [deck.length, generateMore]);

  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(null), 2200);
    return () => window.clearTimeout(t);
  }, [status]);

  function resolve(post: FeedPost, action: SwipeAction) {
    setForce(null);
    setSeen((s) => [...s, post.id]);
    if (action === 'like' || action === 'super') {
      if (!post.liked) toggleLike(post.id);
      setLikedVibes((v) => [...v, post.vibe]);
    }
    if (action === 'super') {
      if (!post.saved) toggleSave(post.id);
      saveFit(post.items);
    }
  }

  function trigger(action: SwipeAction) {
    if (top) setForce(action);
  }

  const insight = useMemo(() => {
    if (!likedVibes.length) return 'Swipe right on fits you’d wear — Sylistly learns your taste.';
    const counts: Record<string, number> = {};
    likedVibes.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    const topVibe = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return `You’re loving ${topVibe.toLowerCase()} fits — more coming your way.`;
  }, [likedVibes]);

  const progress = Math.min(1, seen.length / 12);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <header className="px-5 pb-2 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-accent">Discover</div>
            <h1 className="font-serif text-[30px] font-semibold leading-none text-ink">Swipe fits</h1>
          </div>
          <button
            onClick={() => { setSeen([]); setLikedVibes([]); }}
            className="grid h-10 w-10 place-items-center rounded-full border border-hairline bg-surface-1 text-muted-2"
            aria-label="Reset"
          >
            <RotateCcw size={17} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-hairline bg-surface-1 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <Sparkles size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-ink">{insight}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(6, progress * 100)}%` }} />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-serif text-lg leading-none text-ink">{seen.length}</div>
            <div className="text-[9px] uppercase tracking-[.14em] text-muted">swipes</div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full flex-1 px-5 py-3">
        <div className="relative mx-auto h-full w-full max-w-[380px]">
          {deck.length === 0 ? (
            <div className="grid h-full place-items-center rounded-[30px] border border-hairline bg-surface-1 text-center">
              <div className="px-8">
                <Sparkles className="mx-auto text-accent" size={28} />
                <div className="mt-3 font-serif text-xl text-ink">Loading more fits…</div>
                <div className="mt-1 text-[13px] text-muted">Fresh looks are on the way.</div>
              </div>
            </div>
          ) : (
            deck
              .slice(0, 3)
              .map((post, i) => (
                <SwipeCard
                  key={post.id}
                  post={post}
                  active={i === 0}
                  offset={i}
                  force={i === 0 ? force : null}
                  onResolve={(action) => resolve(post, action)}
                />
              ))
              .reverse()
          )}
        </div>
      </div>

      {top && (
        <div className="px-5 pb-2">
          {status && <div className="mb-2 text-center text-[12px] text-muted">{status}</div>}
          <div className="flex items-center justify-center gap-3.5">
            <ActionBtn onClick={() => { if (top) { saveFit(top.items); if (!top.saved) toggleSave(top.id); setStatus('Saved to your fits'); } }} aria="Save" small>
              <Bookmark size={19} className="text-muted-2" />
            </ActionBtn>
            <ActionBtn onClick={() => trigger('pass')} aria="Pass">
              <X size={26} strokeWidth={2.4} className="text-white/80" />
            </ActionBtn>
            <ActionBtn onClick={() => trigger('super')} aria="Superlike" accent big>
              <Star size={26} className="fill-white text-white" />
            </ActionBtn>
            <ActionBtn onClick={() => trigger('like')} aria="Love">
              <Heart size={26} strokeWidth={2.4} className="text-accent" />
            </ActionBtn>
            <ActionBtn onClick={() => { replaceItems(top.items); router.push('/build'); }} aria="Remix" small>
              <Wand2 size={19} className="text-muted-2" />
            </ActionBtn>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function ActionBtn({
  children,
  onClick,
  aria,
  big,
  small,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  aria: string;
  big?: boolean;
  small?: boolean;
  accent?: boolean;
}) {
  const size = big ? 'h-16 w-16' : small ? 'h-11 w-11' : 'h-14 w-14';
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className={`grid place-items-center rounded-full border transition active:scale-90 ${size} ${
        accent ? 'border-accent bg-accent shadow-pink-glow' : 'border-hairline bg-surface-1'
      }`}
    >
      {children}
    </button>
  );
}
