'use client';

import { ArrowLeft, Bookmark, Heart, LayoutGrid, Sparkles, ShoppingBag } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { getProductOutboundUrl } from '@/lib/product-links';
import { useCheckout } from '@/store/checkout';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedPost, useSocialFeed } from '@/store/social-feed';
import type { Product } from '@/lib/types';

const FitViewer = dynamic(() => import('@/components/FitViewer').then((m) => m.FitViewer), { ssr: false });

function postProducts(post: FeedPost): Product[] {
  return Object.values(post.items).filter((product): product is Product => Boolean(product));
}

function formatLikes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export default function SwipePage() {
  const router = useRouter();
  const posts = useSocialFeed((state) => state.posts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const generateMorePosts = useSocialFeed((state) => state.generateMorePosts);
  const replaceItems = useFit((state) => state.replaceItems);
  const saveFit = useSavedFits((state) => state.saveFit);
  const setCheckout = useCheckout((state) => state.setCheckout);

  const [hasMounted, setHasMounted] = useState(false);
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHasMounted(true);
    if (posts.length < 8) generateMorePosts(10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(
    () => (hasMounted ? posts.filter((post) => postProducts(post).length >= 3).slice(0, 60) : []),
    [hasMounted, posts],
  );

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * 1.5) {
      generateMorePosts(6);
    }
  }

  function like(post: FeedPost) {
    toggleLike(post.id);
    if (!post.liked) {
      setBurstId(post.id);
      window.setTimeout(() => setBurstId((id) => (id === post.id ? null : id)), 650);
    }
  }
  function save(post: FeedPost) {
    saveFit(post.items);
    setSavedId(post.id);
    window.setTimeout(() => setSavedId((id) => (id === post.id ? null : id)), 1400);
  }
  function build(post: FeedPost) {
    replaceItems(post.items);
    router.push('/build');
  }
  function shop(post: FeedPost) {
    const products = postProducts(post)
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    setCheckout({ title: post.title, products });
    router.push('/checkout');
  }

  return (
    <main className="relative mx-auto h-[100dvh] max-w-[480px] overflow-hidden bg-bg">
      <h1 className="sr-only">Swipe fits</h1>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Link
          href="/feed"
          aria-label="Back to feed"
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition active:scale-90"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="pointer-events-none text-center">
          <div className="text-[8px] font-black uppercase tracking-[.24em] text-white/70">Sylistly</div>
          <div className="font-serif text-[18px] font-semibold leading-none text-white">Swipe</div>
        </div>
        <Link
          href="/feed"
          aria-label="Switch to grid feed"
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition active:scale-90"
        >
          <LayoutGrid size={18} />
        </Link>
      </header>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-hide"
      >
        {!hasMounted ? (
          <div className="grid h-full place-items-center text-[14px] font-semibold text-muted-2">Loading fits…</div>
        ) : (
          cards.map((post) => {
            const products = postProducts(post);
            return (
              <section
                key={post.id}
                data-swipe-post={post.id}
                className="relative flex h-[100dvh] snap-start snap-always flex-col justify-center bg-[linear-gradient(180deg,#fbf8f2_0%,#f4eee6_42%,#191412_74%,#080706_100%)]"
              >
                <button
                  type="button"
                  onClick={() => setActivePost(post)}
                  aria-label={`Open ${post.title}`}
                  className="relative mx-auto mt-[calc(env(safe-area-inset-top)+58px)] w-full flex-1 px-4"
                >
                  <OutfitLookCard
                    items={products}
                    title={post.title}
                    subtitle={post.formulaLabel || post.vibe}
                    presentation="flatlay"
                    loading="eager"
                    productLinks={false}
                    className="h-full max-h-[60dvh]"
                    feedContext={{ formulaId: post.formulaId, formulaLabel: post.formulaLabel }}
                  />
                  {burstId === post.id ? (
                    <span className="pointer-events-none absolute inset-0 grid place-items-center">
                      <Heart size={120} className="animate-ping text-accent drop-shadow-[0_0_28px_rgba(246,48,107,.9)]" fill="currentColor" />
                    </span>
                  ) : null}
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[42dvh] bg-[linear-gradient(180deg,transparent,rgba(8,7,6,.86)_64%,#080706)]" />

                {/* right action rail */}
                <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+118px)] right-3 z-20 flex flex-col items-center gap-4">
                  <button type="button" onClick={() => like(post)} aria-label="Like" className="flex flex-col items-center gap-1">
                    <span className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md transition active:scale-90 ${post.liked ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-white/20 bg-black/40 text-white'}`}>
                      <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
                    </span>
                    <span className="text-[11px] font-bold text-white drop-shadow">{formatLikes(post.likeCount)}</span>
                  </button>
                  <button type="button" onClick={() => save(post)} aria-label="Save" className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition active:scale-90">
                    <Bookmark size={20} fill={savedId === post.id ? 'currentColor' : 'none'} className={savedId === post.id ? 'text-accent' : ''} />
                  </button>
                  <button type="button" onClick={() => build(post)} aria-label="Build this fit" className="grid h-12 w-12 place-items-center rounded-full border border-accent/50 bg-accent text-white shadow-pink-glow transition active:scale-90">
                    <Sparkles size={20} />
                  </button>
                  <button type="button" onClick={() => shop(post)} aria-label="Shop this fit" className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition active:scale-90">
                    <ShoppingBag size={20} />
                  </button>
                </div>

                {/* meta */}
                <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+108px)] z-10 px-4 pr-[84px]">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[10px] font-black text-white">
                      {(post.username || 'F').replace(/^@/, '').charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[12px] font-semibold text-white/85">{post.username || 'by fitcommunity'}</span>
                  </div>
                  <h2 className="mt-2 font-serif text-[26px] font-semibold leading-[.96] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,.5)]">{post.title}</h2>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="rounded-full border border-white/18 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white/85 backdrop-blur-md">{post.vibe}</span>
                    {savedId === post.id ? (
                      <span className="rounded-full bg-accent/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white">Saved</span>
                    ) : null}
                  </div>
                </div>
              </section>
            );
          })
        )}
      </div>

      {activePost ? (
        <FitViewer
          post={activePost}
          products={postProducts(activePost)}
          relatedPosts={[]}
          source="feed"
          onClose={() => setActivePost(null)}
          onLike={(post) => like(post)}
          onSave={(post) => save(post)}
          onRemix={(post) => { setActivePost(null); build(post); }}
          onShop={(post) => { setActivePost(null); shop(post); }}
          onBuildAroundHero={(post) => { setActivePost(null); build(post); }}
          onOpenEditor={(post) => { setActivePost(null); build(post); }}
          onJumpToPost={() => {}}
        />
      ) : null}
    </main>
  );
}
