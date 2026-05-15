'use client';

import { Bookmark, Check, Heart, LoaderCircle, MessageCircle, RotateCcw, Send, ShoppingBag, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { OutfitBoard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { filterFeedRenderableProducts } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedPost, useSocialFeed } from '@/store/social-feed';

const FILTERS = ['For You', 'Trending', 'Following', 'Under $100', 'Night Out', 'Streetwear', 'Clean', 'Gym'];
const QUICK_REACTIONS = ['Fire', 'Swap shoes', 'Too expensive', 'Clean fit', 'Better without hat'];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function visibleProducts(post: FeedPost): Product[] {
  return filterFeedRenderableProducts(Object.values(post.items).filter(
    (product): product is Product =>
      Boolean(product),
  ));
}

function itemsFromProducts(products: Product[]): Partial<Record<Category, Product>> {
  return Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
}

function postMatches(post: FeedPost, filter: string): boolean {
  if (filter === 'For You') return true;
  if (filter === 'Trending') return post.likeCount >= 250;
  if (filter === 'Following') return post.username !== '@you';
  if (filter === 'Under $100') return post.totalCents / Math.max(1, post.itemCount) <= 10000;
  const needle = filter.toLowerCase().replace(' out', '');
  return [post.vibe, ...post.tags].some((tag) => tag.toLowerCase().includes(needle));
}

export default function FitFeedPage() {
  const posts = useSocialFeed((state) => state.posts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const toggleSave = useSocialFeed((state) => state.toggleSave);
  const addComment = useSocialFeed((state) => state.addComment);
  const generateMorePosts = useSocialFeed((state) => state.generateMorePosts);
  const replaceItems = useFit((state) => state.replaceItems);
  const saveFit = useSavedFits((state) => state.saveFit);
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('For You');
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);
  const [commentText, setCommentText] = useState('');
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Fit Feed');
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [remixingPostId, setRemixingPostId] = useState<string | null>(null);
  const [savedPulsePostId, setSavedPulsePostId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const filteredPosts = useMemo(
    // Require ≥ 5 visible (post-image-failure-filter) products so every feed
    // card fills enough of OutfitBoard's 8 fixed slot positions to avoid the
    // "broken-looking" empty-board appearance. The store-level filters
    // (SEED_POSTS, normalizeFeedPost, makeGeneratedPost) already enforce 5+
    // pre-render; this final UI guard catches images that fail at runtime.
    () => posts.filter((post) => postMatches(post, activeFilter) && visibleProducts(post).length >= 5),
    [posts, activeFilter],
  );

  useEffect(() => {
    if (posts.length < 24) generateMorePosts(18);
  }, [generateMorePosts, posts.length]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setLoadingMore(true);
        generateMorePosts(14);
        window.setTimeout(() => setLoadingMore(false), 360);
      },
      { root: null, rootMargin: '900px 0px', threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [generateMorePosts, filteredPosts.length]);

  function remix(post: FeedPost) {
    const products = visibleProducts(post);
    if (products.length < 3) return;
    if (remixingPostId) return;
    setRemixingPostId(post.id);
    setBurstPostId(post.id);
    window.setTimeout(() => {
      replaceItems(itemsFromProducts(products));
      router.push('/build');
    }, 620);
  }

  function like(post: FeedPost) {
    toggleLike(post.id);
    setBurstPostId(post.id);
    window.setTimeout(() => setBurstPostId(null), 420);
  }

  function savePost(post: FeedPost) {
    const wasSaved = post.saved;
    toggleSave(post.id);
    if (!wasSaved) {
      const products = visibleProducts(post);
      if (products.length >= 3) saveFit(itemsFromProducts(products));
      setSavedPulsePostId(post.id);
      window.setTimeout(() => setSavedPulsePostId((current) => (current === post.id ? null : current)), 1200);
    }
  }

  function shop(post: FeedPost) {
    const products = visibleProducts(post)
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    setCheckoutTitle(post.title);
    setCheckoutProducts(products);
  }

  function submitComment(text = commentText) {
    const trimmed = text.trim();
    if (!commentPost || !trimmed) return;
    addComment(commentPost.id, trimmed);
    setCommentText('');
    setCommentPost(null);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <div className="relative flex-1 overflow-hidden">
        {savedPulsePostId ? (
          <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+76px)] z-40 flex justify-center px-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/45 bg-[#1c0f15]/95 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_18px_44px_rgba(246,48,107,.55)] backdrop-blur-md">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                <Check size={13} strokeWidth={3} />
              </span>
              Saved to your fits
            </div>
          </div>
        ) : null}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/38 px-3 py-2 shadow-[0_16px_34px_rgba(0,0,0,.32)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[8px] uppercase tracking-[.2em] text-white/55">Fit Feed</div>
                <div className="font-serif text-[20px] font-semibold leading-none text-white">
                  Swipe <em className="italic text-accent">fits</em>
                </div>
              </div>
              <div className="flex max-w-[250px] gap-2 overflow-x-auto scrollbar-hide">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`flex-none rounded-full px-3.5 py-1.5 text-[10px] font-semibold tracking-wide transition active:scale-90 motion-safe:transition-all motion-safe:duration-200 ${
                      activeFilter === filter
                        ? 'scale-[1.08] bg-accent text-white shadow-[0_0_0_2px_rgba(255,255,255,.16),0_8px_28px_rgba(246,48,107,.55)] ring-1 ring-white/30'
                        : 'bg-white/10 text-white/70 ring-1 ring-white/0 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth">
          {filteredPosts.map((post) => {
            const products = visibleProducts(post);
            const formulaLabel = post.formulaLabel || [post.tags[0], post.tags[1]].filter(Boolean).join(' / ');
            return (
              <article
                key={post.id}
                className="relative flex h-full snap-start snap-always flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(246,48,107,.14),transparent_34%),linear-gradient(180deg,#14110f_0%,#090807_100%)]"
              >
                {burstPostId === post.id ? (
                  <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-accent/10">
                    <div className="grid h-28 w-28 animate-ping place-items-center rounded-full border border-accent/40 bg-accent/15" />
                    <Heart className="absolute text-accent drop-shadow-[0_0_28px_rgba(246,48,107,.95)]" size={74} fill="currentColor" />
                  </div>
                ) : null}

                {remixingPostId === post.id ? (
                  <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#0a0707]/75 backdrop-blur-md">
                    <div className="relative grid h-20 w-20 place-items-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent/35" />
                      <span className="absolute inset-2 rounded-full bg-accent/20" />
                      <LoaderCircle size={36} className="relative animate-spin text-white drop-shadow-[0_0_18px_rgba(246,48,107,.85)]" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-[.24em] text-accent">Building similar fit</div>
                      <div className="mt-1 font-serif text-[18px] font-semibold text-white">Opening Builder…</div>
                    </div>
                  </div>
                ) : null}

                <div className="absolute inset-x-0 top-[92px] z-0 px-4">
                  <OutfitBoard
                    items={itemsFromProducts(products)}
                    variant="feed"
                    feedContext={{ formulaId: post.formulaId, formulaLabel: post.formulaLabel }}
                    className="h-[clamp(320px,48dvh,450px)]"
                  />
                </div>

                <div className="absolute right-3 top-[47%] z-20 flex -translate-y-1/2 flex-col items-center gap-3">
                  <button
                    onClick={() => like(post)}
                    className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 ${
                      post.liked ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-white/18 bg-black/38 text-white'
                    }`}
                    aria-label="Like fit"
                  >
                    <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
                  </button>
                  <div className="-mt-2 text-center text-[10px] font-semibold text-white/80">{post.likeCount}</div>
                  <button
                    onClick={() => setCommentPost(post)}
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-black/38 text-white backdrop-blur-md transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150"
                    aria-label="Open comments"
                  >
                    <MessageCircle size={20} />
                  </button>
                  <button
                    onClick={() => savePost(post)}
                    className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 ${
                      post.saved ? 'border-accent bg-accent/18 text-accent' : 'border-white/18 bg-black/38 text-white'
                    } ${savedPulsePostId === post.id ? 'motion-safe:animate-[pulse_.42s_ease-out_1] scale-110' : ''}`}
                    aria-label="Save fit"
                  >
                    <Bookmark size={20} fill={post.saved ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => remix(post)}
                    disabled={remixingPostId === post.id}
                    className="grid h-12 w-12 place-items-center rounded-full border border-accent/45 bg-accent text-white shadow-pink-glow transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 disabled:opacity-70"
                    aria-label="Remix in Builder"
                  >
                    {remixingPostId === post.id ? <LoaderCircle size={20} className="animate-spin" /> : <RotateCcw size={20} />}
                  </button>
                  <button
                    onClick={() => shop(post)}
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-black/38 text-white backdrop-blur-md transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150"
                    aria-label="Shop fit"
                  >
                    <ShoppingBag size={20} />
                  </button>
                </div>

                <div className="relative z-10 mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pr-[76px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-[#1a0d12]/70 px-3.5 py-2 text-white shadow-[0_10px_28px_rgba(246,48,107,.28)] backdrop-blur-md">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                      <Sparkles size={12} />
                    </span>
                    <div className="flex flex-col leading-none">
                      <span className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Formula</span>
                      <span className="mt-0.5 text-[12px] font-semibold tracking-tight text-white">
                        {formulaLabel || post.sourceType || 'Catalog fit'}
                      </span>
                    </div>
                  </div>
                  <h1 className="mt-3 font-serif text-[35px] font-semibold leading-[.94] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,.42)]">
                    {post.title}
                  </h1>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/78">
                    {post.outfitReason || post.caption || `${post.vibe} outfit, ready to remix in Builder.`}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-white/78 backdrop-blur-md">
                      {post.vibe}
                    </span>
                    {post.frameBias && post.frameBias !== 'any' ? (
                      <span className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-white/78 backdrop-blur-md">
                        {post.frameBias} bias
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-white/78 backdrop-blur-md">
                      {formatPrice(post.totalCents)}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {products.slice(0, 6).map((product) => (
                      <button
                        key={`${post.id}-tray-${product.id}`}
                        type="button"
                        onClick={() => shop(post)}
                        className="group relative h-[78px] w-[66px] flex-none overflow-hidden rounded-[18px] border border-[#eadfd5] bg-[#fff7ef] shadow-[0_12px_30px_rgba(0,0,0,.28)] ring-0 ring-accent/0 transition active:scale-90 hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(246,48,107,.4)] hover:ring-2 hover:ring-accent/60 motion-safe:transition-all motion-safe:duration-200"
                        aria-label={`Shop ${product.brand} ${product.name}`}
                      >
                        <ProductImage
                          product={product}
                          wrapperClassName="h-full w-full"
                          className="h-full w-full object-contain p-1.5 motion-safe:transition-transform motion-safe:duration-200 group-hover:scale-105 group-active:scale-95"
                        />
                        <div className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.12em] text-white">
                          {product.category}
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,.55)_100%)] opacity-0 transition group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_.78fr] gap-2">
                    <button
                      onClick={() => remix(post)}
                      disabled={remixingPostId === post.id}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 disabled:opacity-70"
                    >
                      {remixingPostId === post.id ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      {remixingPostId === post.id ? 'Loading' : 'Build this'}
                    </button>
                    <button
                      onClick={() => shop(post)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white backdrop-blur-md transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
                    >
                      <ShoppingBag size={14} />
                      Shop Fit
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <div ref={sentinelRef} className="grid min-h-[40dvh] snap-start place-items-center bg-bg px-6 pb-28 text-center">
            <div>
              <div className="font-serif text-[24px] text-ink">{loadingMore ? 'Loading more fits' : 'More fits are coming'}</div>
              <p className="mt-2 text-sm text-muted-2">Keep scrolling for fresh catalog-backed outfits.</p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />

      {commentPost ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/55 backdrop-blur-sm">
          <button className="absolute inset-0" aria-label="Close comments" onClick={() => setCommentPost(null)} />
          <section className="relative z-10 w-full rounded-t-[30px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-22px_60px_rgba(0,0,0,.46)]">
            <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />
            <div className="font-serif text-[22px] font-semibold text-ink">Comments</div>
            <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto">
              {commentPost.comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[12px] text-muted-2">
                  <span className="font-semibold text-ink">{comment.user}</span> {comment.text}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_REACTIONS.map((reaction) => (
                <button key={reaction} onClick={() => submitComment(reaction)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2">
                  {reaction}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add a comment"
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              />
              <button onClick={() => submitComment()} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                <Send size={15} />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </main>
  );
}
