'use client';

import { Bookmark, Check, ChevronRight, Heart, Info, Layers, LoaderCircle, MessageCircle, RotateCcw, Send, ShoppingBag, Sparkles, Wand2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { OutfitBoard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { ALL_CATALOG_PRODUCTS } from '@/lib/catalog';
import { getProductOutboundUrl } from '@/lib/product-links';
import { filterFeedRenderableProducts, isRenderableProduct } from '@/lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedPost, useSocialFeed } from '@/store/social-feed';

const FILTERS = ['For You', 'Trending', 'Following', 'Under $100', 'Night Out', 'Streetwear', 'Clean', 'Gym'];
const QUICK_REACTIONS = ['Fire', 'Swap shoes', 'Too expensive', 'Clean fit', 'Better without hat'];
const TRANSPARENT_EXPERIMENT_MIN_ITEMS = 5;

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

const TRANSPARENT_PRODUCTS_BY_CATEGORY: Record<Category, Product[]> = Object.fromEntries(
  CATEGORY_ORDER.map((category) => [
    category,
    ALL_CATALOG_PRODUCTS
      .filter((product) => product.category === category && product.imageTransparentUrl)
      .filter(isRenderableProduct),
  ]),
) as Record<Category, Product[]>;

function totalCentsFor(items: Partial<Record<Category, Product>>): number {
  return Object.values(items).reduce((sum, product) => sum + (product?.priceCents || 0), 0);
}

function transparentCountFor(items: Partial<Record<Category, Product>>): number {
  return Object.values(items).filter((product) => Boolean(product?.imageTransparentUrl)).length;
}

function buildTransparentExperimentPost(post: FeedPost, index: number): FeedPost | null {
  const usedIds = new Set<string>();
  const originalCategories = CATEGORY_ORDER.filter((category) => Boolean(post.items[category]));
  const targetCategories = Array.from(new Set<Category>([
    ...originalCategories,
    'top',
    'bottom',
    'shoes',
    'outer',
    'bag',
    'eyewear',
    'jewelry',
    'hat',
  ])).slice(0, Math.max(TRANSPARENT_EXPERIMENT_MIN_ITEMS, originalCategories.length));
  const items: Partial<Record<Category, Product>> = {};

  targetCategories.forEach((category, categoryIndex) => {
    const existing = post.items[category];
    if (existing?.imageTransparentUrl && isRenderableProduct(existing) && !usedIds.has(existing.id)) {
      items[category] = existing;
      usedIds.add(existing.id);
      return;
    }

    const pool = TRANSPARENT_PRODUCTS_BY_CATEGORY[category] || [];
    if (!pool.length) return;
    for (let offset = 0; offset < pool.length; offset += 1) {
      const candidate = pool[(index + categoryIndex + offset) % pool.length];
      if (!candidate || usedIds.has(candidate.id)) continue;
      items[category] = candidate;
      usedIds.add(candidate.id);
      return;
    }
  });

  const products = visibleProducts({ ...post, items } as FeedPost);
  if (products.length < TRANSPARENT_EXPERIMENT_MIN_ITEMS) return null;
  if (!items.top || !items.bottom || !items.shoes) return null;

  return {
    ...post,
    id: `${post.id}-transparent-preview`,
    title: `${post.title}`,
    caption: post.caption || 'Transparent experiment preview using reviewed cutout assets.',
    source: 'repaired',
    tags: Array.from(new Set([...post.tags, 'transparent experiment'])),
    items,
    itemCount: products.length,
    totalCents: totalCentsFor(items),
  };
}

function buildTransparentExperiment(posts: FeedPost[]) {
  const originalOnlySkipped = posts.filter((post) => transparentCountFor(post.items) < TRANSPARENT_EXPERIMENT_MIN_ITEMS).length;
  const previewPosts = posts
    .map(buildTransparentExperimentPost)
    .filter((post): post is FeedPost => Boolean(post));
  const transparentProductsUsed = new Set(
    previewPosts.flatMap((post) =>
      Object.values(post.items)
        .filter((product): product is Product => Boolean(product?.imageTransparentUrl))
        .map((product) => product.id),
    ),
  ).size;

  return {
    posts: previewPosts,
    transparentProductsUsed,
    skippedOriginalOnlyPosts: originalOnlySkipped,
  };
}

function postMatches(post: FeedPost, filter: string): boolean {
  if (filter === 'For You') return true;
  if (filter === 'Trending') return post.likeCount >= 250;
  if (filter === 'Following') return post.username !== '@you';
  if (filter === 'Under $100') return post.totalCents / Math.max(1, post.itemCount) <= 10000;
  const needle = filter.toLowerCase().replace(' out', '');
  return [post.vibe, ...post.tags].some((tag) => tag.toLowerCase().includes(needle));
}

function feedPostElementId(postId: string): string {
  return `feed-post-${postId}`;
}

// Composes 2-3 styling notes from REAL post + product data.  No fake
// AI text — every line is sourced from fields the generator already
// populated (outfitReason, vibe, frameBias) or derived from the actual
// product categories present in the post.
function computeStylingNotes(post: FeedPost, products: Product[]): string[] {
  const notes: string[] = [];
  if (post.outfitReason && post.outfitReason.trim()) {
    notes.push(post.outfitReason.trim());
  }

  const cats = new Set(products.map((p) => p.category));
  const stack: string[] = [];
  if (cats.has('outer')) stack.push('layered outer');
  if (cats.has('top')) stack.push('grounded top');
  if (cats.has('bottom')) stack.push('tailored bottom');
  if (cats.has('shoes')) stack.push('anchor shoes');
  if (cats.has('bag')) stack.push('intentional bag');
  if (stack.length >= 2 && notes.length < 2) {
    notes.push(`${capitalize(stack.slice(0, 3).join(', '))} — ${products.length} pieces working together.`);
  }

  if (post.frameBias && post.frameBias !== 'any' && notes.length < 3) {
    notes.push(`Tuned for a ${post.frameBias} frame in the ${post.vibe} vibe.`);
  } else if (notes.length < 3 && post.formulaLabel) {
    notes.push(`${post.formulaLabel} formula — the structure does the work.`);
  }

  return notes.slice(0, 3);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function findSimilarPosts(current: FeedPost, all: FeedPost[], limit = 3): FeedPost[] {
  if (!current.formulaId) return [];
  return all
    .filter((post) => post.id !== current.id && post.formulaId === current.formulaId)
    .slice(0, limit);
}

function heroProductForPost(post: FeedPost): Product | null {
  const items = post.items as Partial<Record<Category, Product>>;
  return items.outer || items.top || items.bottom || items.shoes || null;
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
  const [whyPostId, setWhyPostId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transparentExperiment, setTransparentExperiment] = useState(false);
  const [experimentReady, setExperimentReady] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const transparentExperimentData = useMemo(() => buildTransparentExperiment(posts), [posts]);
  const displayPosts = transparentExperiment ? transparentExperimentData.posts : posts;
  const filteredPosts = useMemo(
    // Require ≥ 5 visible (post-image-failure-filter) products so every feed
    // card fills enough of OutfitBoard's 8 fixed slot positions to avoid the
    // "broken-looking" empty-board appearance. The store-level filters
    // (SEED_POSTS, normalizeFeedPost, makeGeneratedPost) already enforce 5+
    // pre-render; this final UI guard catches images that fail at runtime.
    () => displayPosts.filter((post) => postMatches(post, activeFilter) && visibleProducts(post).length >= 5),
    [displayPosts, activeFilter],
  );

  useEffect(() => {
    setTransparentExperiment(new URLSearchParams(window.location.search).get('transparentExperiment') === '1');
    setExperimentReady(true);
  }, []);

  useEffect(() => {
    if (!experimentReady || transparentExperiment) return;
    if (posts.length < 24) generateMorePosts(18);
  }, [experimentReady, generateMorePosts, posts.length, transparentExperiment]);

  useEffect(() => {
    if (transparentExperiment) return;
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
  }, [generateMorePosts, filteredPosts.length, transparentExperiment]);

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

  // "Build around this" is a stronger version of remix: it sends the
  // visible products to /build AND locks the hero category so the user
  // sees an obvious "this piece stays, swap everything else around it"
  // experience.  Lock is communicated via the existing search-param
  // pattern (`?lock=outer`) so /build can pick it up on mount without
  // any cross-route store coupling.
  function buildAroundHero(post: FeedPost) {
    const products = visibleProducts(post);
    if (products.length < 3) return;
    if (remixingPostId) return;
    const hero = heroProductForPost(post) ?? products[0];
    if (!hero) {
      remix(post);
      return;
    }
    setRemixingPostId(post.id);
    setBurstPostId(post.id);
    window.setTimeout(() => {
      replaceItems(itemsFromProducts(products));
      router.push(`/build?lock=${encodeURIComponent(hero.category)}`);
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

  function jumpToPost(postId: string) {
    setWhyPostId(null);
    // Defer the scroll until after the sheet close commits and the
    // browser has painted — running inside the same tick fights the
    // snap-scroll layout and lands one snap off.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(feedPostElementId(postId))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  const whyPost = whyPostId ? posts.find((post) => post.id === whyPostId) ?? null : null;

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

        {transparentExperiment ? (
          <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+92px)] z-30 rounded-[20px] border border-[#8ff0be]/35 bg-[#0b1711]/88 p-3 text-white shadow-[0_18px_44px_rgba(0,0,0,.36)] backdrop-blur-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.2em] text-[#8ff0be]">Transparent experiment mode - preview only</div>
                <div className="mt-1 text-[11px] leading-relaxed text-white/78">
                  {transparentExperimentData.transparentProductsUsed} transparent products used · {transparentExperimentData.posts.length} posts shown · {transparentExperimentData.skippedOriginalOnlyPosts} original-heavy posts bypassed.
                </div>
              </div>
              <a href="/feed" className="rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white">
                Normal mode
              </a>
            </div>
          </div>
        ) : null}

        <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth">
          {filteredPosts.length === 0 ? (
            <div className="grid h-full snap-start place-items-center bg-bg px-6 text-center">
              <div>
                <div className="font-serif text-[24px] text-ink">No transparent preview fits yet</div>
                <p className="mt-2 text-sm text-muted-2">Open Catalog Lab to inspect available cutout assets, or switch back to normal Feed.</p>
                <a href="/feed" className="mt-4 inline-flex rounded-full bg-accent px-4 py-2.5 text-[11px] font-black uppercase tracking-[.14em] text-white shadow-pink-glow">
                  Normal Feed
                </a>
              </div>
            </div>
          ) : null}
          {filteredPosts.map((post) => {
            const products = visibleProducts(post);
            const formulaLabel = post.formulaLabel || [post.tags[0], post.tags[1]].filter(Boolean).join(' / ');
            return (
              <article
                key={post.id}
                id={feedPostElementId(post.id)}
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

                {/* Stylist Pick badge — anchors each card with a clear AI-stylist signal */}
                <div className="pointer-events-none absolute left-4 top-[calc(env(safe-area-inset-top)+72px)] z-[15]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/45 bg-[#0e0a0a]/82 px-3 py-1.5 shadow-[0_10px_26px_rgba(246,48,107,.4)] backdrop-blur-md">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                      <Wand2 size={10} strokeWidth={2.6} />
                    </span>
                    <div className="leading-none">
                      <div className="text-[7px] font-black uppercase tracking-[.22em] text-accent">Stylist pick</div>
                      <div className="mt-0.5 text-[10px] font-semibold text-white">
                        {post.formulaLabel || post.vibe || 'Catalog fit'}
                      </div>
                    </div>
                  </div>
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
                  <button
                    type="button"
                    onClick={() => setWhyPostId(post.id)}
                    aria-label="Why this fit works"
                    className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-[#1a0d12]/70 px-3.5 py-2 text-white shadow-[0_10px_28px_rgba(246,48,107,.28)] backdrop-blur-md transition active:scale-[0.97] motion-safe:transition-all motion-safe:duration-200 hover:border-accent/60 hover:shadow-[0_14px_34px_rgba(246,48,107,.45)]"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                      <Sparkles size={12} />
                    </span>
                    <div className="flex flex-col leading-none text-left">
                      <span className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Formula</span>
                      <span className="mt-0.5 text-[12px] font-semibold tracking-tight text-white">
                        {formulaLabel || post.sourceType || 'Catalog fit'}
                      </span>
                    </div>
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/12 px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white/85">
                      <Info size={10} />
                      Why
                      <ChevronRight size={10} className="-mr-1" />
                    </span>
                  </button>
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

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWhyPostId(post.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/85 backdrop-blur-md transition active:scale-[0.97] motion-safe:transition-all motion-safe:duration-200 hover:border-accent/55 hover:text-white"
                    >
                      <Layers size={12} className="text-accent" />
                      More like this
                    </button>
                    <button
                      type="button"
                      onClick={() => buildAroundHero(post)}
                      disabled={remixingPostId === post.id}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/45 bg-accent/15 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white backdrop-blur-md transition active:scale-[0.97] motion-safe:transition-all motion-safe:duration-200 hover:border-accent/70 hover:bg-accent/22 disabled:opacity-70"
                    >
                      <Wand2 size={12} className="text-accent" />
                      Build around hero
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

      {whyPost ? (() => {
        const whyProducts = visibleProducts(whyPost);
        const notes = computeStylingNotes(whyPost, whyProducts);
        const similar = findSimilarPosts(whyPost, posts);
        const heroProduct = heroProductForPost(whyPost) ?? whyProducts[0] ?? null;
        const keyProducts = whyProducts.slice(0, 5);
        return (
          <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/60 backdrop-blur-sm">
            <button className="absolute inset-0" aria-label="Close why this works" onClick={() => setWhyPostId(null)} />
            <section className="relative z-10 max-h-[82dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-22px_60px_rgba(0,0,0,.55)]">
              <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                    <Sparkles size={16} />
                  </span>
                  <div className="leading-tight">
                    <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Why this works</div>
                    <div className="mt-0.5 font-serif text-[22px] font-semibold text-ink">
                      {whyPost.formulaLabel || 'Catalog fit'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-white/14 bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.14em] text-white/75">
                        {whyPost.vibe}
                      </span>
                      {whyPost.frameBias && whyPost.frameBias !== 'any' ? (
                        <span className="rounded-full border border-white/14 bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.14em] text-white/75">
                          {whyPost.frameBias} frame
                        </span>
                      ) : null}
                      <span className="rounded-full border border-accent/40 bg-accent/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.14em] text-accent">
                        {formatPrice(whyPost.totalCents)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWhyPostId(null)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {notes.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {notes.map((note, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2.5 rounded-[18px] border border-white/8 bg-white/[0.04] px-3 py-2.5"
                    >
                      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-accent/22 text-accent text-[10px] font-black">
                        {index + 1}
                      </span>
                      <p className="text-[13px] leading-relaxed text-white/86">{note}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {heroProduct ? (
                <div className="mt-5">
                  <div className="text-[10px] font-bold uppercase tracking-[.18em] text-muted">Hero piece</div>
                  <div className="mt-2 flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/[0.04] p-2.5">
                    <div className="h-16 w-16 flex-none overflow-hidden rounded-[14px] bg-[#fff7ef]">
                      <ProductImage
                        product={heroProduct}
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-1.5"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-bold uppercase tracking-[.16em] text-accent">{heroProduct.brand}</div>
                      <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight text-ink">{heroProduct.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-2">{formatPrice(heroProduct.priceCents)} · {heroProduct.category}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {keyProducts.length > 0 ? (
                <div className="mt-5">
                  <div className="text-[10px] font-bold uppercase tracking-[.18em] text-muted">Key pieces</div>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {keyProducts.map((product) => (
                      <div
                        key={`${whyPost.id}-key-${product.id}`}
                        className="h-[78px] w-[64px] flex-none overflow-hidden rounded-[16px] border border-white/10 bg-[#fff7ef] shadow-[0_8px_18px_rgba(0,0,0,.28)]"
                      >
                        <ProductImage
                          product={product}
                          wrapperClassName="h-full w-full"
                          className="h-full w-full object-contain p-1.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {similar.length > 0 ? (
                <div className="mt-5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-[.18em] text-muted">More like this</div>
                    <div className="text-[10px] text-muted">{similar.length} similar</div>
                  </div>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {similar.map((sim) => {
                      const simHero = heroProductForPost(sim);
                      return (
                        <button
                          key={sim.id}
                          type="button"
                          onClick={() => jumpToPost(sim.id)}
                          className="group relative h-[96px] w-[78px] flex-none overflow-hidden rounded-[18px] border border-white/12 bg-[#fff7ef] shadow-[0_10px_24px_rgba(0,0,0,.32)] transition active:scale-95 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_36px_rgba(246,48,107,.42)] motion-safe:transition-all motion-safe:duration-200"
                          aria-label={`Jump to similar fit: ${sim.title}`}
                        >
                          {simHero ? (
                            <ProductImage
                              product={simHero}
                              wrapperClassName="h-full w-full"
                              className="h-full w-full object-contain p-1.5"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-white/[0.04] text-[10px] text-muted">—</div>
                          )}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,.78)_100%)]" />
                          <div className="pointer-events-none absolute inset-x-1 bottom-1 truncate text-[8px] font-bold uppercase tracking-[.14em] text-white">
                            {sim.vibe}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = whyPost;
                    setWhyPostId(null);
                    if (target) remix(target);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
                >
                  <RotateCcw size={13} />
                  Remix in Builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = whyPost;
                    setWhyPostId(null);
                    if (target) shop(target);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/14"
                >
                  <ShoppingBag size={13} />
                  Shop fit
                </button>
              </div>
            </section>
          </div>
        );
      })() : null}

      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </main>
  );
}
