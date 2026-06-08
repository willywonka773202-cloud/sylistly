'use client';

import dynamic from 'next/dynamic';
import { Bookmark, Check, ChevronRight, Heart, Info, LoaderCircle, MessageCircle, RotateCcw, Send, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import type { CheckoutProduct } from '@/components/CheckoutSheet';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { getCheckoutUrlHost } from '@/lib/checkout';
import { getProductOutboundUrl } from '@/lib/product-links';
import { hasExactProductLink, isFeedHeroCandidate, productImageQualityScore, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedGenerationOptions, type FeedPost, useSocialFeed } from '@/store/social-feed';

const CheckoutSheet = dynamic(
  () => import('@/components/CheckoutSheet').then((module) => module.CheckoutSheet),
  { ssr: false, loading: () => null },
);
const FitViewer = dynamic(
  () => import('@/components/FitViewer').then((module) => module.FitViewer),
  { ssr: false, loading: () => null },
);

const FILTERS = ['For You', 'Trending', 'Following', 'Under $100', 'Night Out', 'Streetwear', 'Clean', 'Gym'];
const QUICK_REACTIONS = ['Fire', 'Swap shoes', 'Too expensive', 'Clean fit', 'Better without hat'];
const STORY_RING_CLASSES = [
  'from-[#111111] via-[#f6306b] to-[#f7d8b8]',
  'from-[#4b2f21] via-[#d8a92b] to-[#f8f4ec]',
  'from-[#1f2b42] via-[#7891ac] to-[#e8dcc9]',
  'from-[#101010] via-[#6e5544] to-[#d9c5a8]',
  'from-[#5f1327] via-[#f6306b] to-[#fff4ef]',
];
const INITIAL_RENDERED_POSTS = 8;
const FEED_RENDER_INCREMENT = 4;
const FEED_GENERATE_BATCH = 6;
const REQUIRED_FEED_CATEGORIES: Category[] = ['top', 'bottom', 'shoes'];
const REPEAT_SENSITIVE_CATEGORIES: Category[] = ['top', 'bottom', 'shoes', 'outer'];
const MIN_DEDUPED_FEED_POSTS = 8;

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Headwear',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

function feedGenerationOptionsForFilter(filter: string): FeedGenerationOptions | undefined {
  if (filter === 'Under $100') return { budget: 'under100' };
  if (filter === 'Night Out') return { vibe: 'night' };
  if (filter === 'Streetwear') return { vibe: 'street' };
  if (filter === 'Clean') return { vibe: 'clean' };
  if (filter === 'Gym') return { vibe: 'gym' };
  return undefined;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function visibleProducts(post: FeedPost): Product[] {
  return sortTransparentFeedRenderableProducts(Object.values(post.items).filter(
    (product): product is Product =>
      Boolean(product),
  ));
}

function postSourceRank(post: FeedPost): number {
  if (post.source === 'first-screen') return 0;
  if (post.source === 'launch') return 1;
  if (post.source === 'generated-plan') return 2;
  if (post.source === 'generated-live') return 3;
  if (post.source === 'repaired') return 4;
  return 5;
}

function feedOutfitSignature(post: FeedPost): string {
  return visibleProducts(post)
    .map((product) => `${product.category}:${product.id}`)
    .sort()
    .join('|');
}

function feedDiversityKey(post: FeedPost): string {
  return post.formulaId || `${post.vibe}:${post.frameBias || 'any'}:${post.sourceType || 'catalog'}`;
}

function sortFeedGroup(posts: FeedPost[]): FeedPost[] {
  return [...posts].sort((left, right) => {
    const leftProducts = visibleProducts(left);
    const rightProducts = visibleProducts(right);
    const leftStats = productLinkStats(leftProducts);
    const rightStats = productLinkStats(rightProducts);
    return postSourceRank(left) - postSourceRank(right)
      || postVisualQualityScore(right) - postVisualQualityScore(left)
      || rightStats.exactCount - leftStats.exactCount
      || rightProducts.length - leftProducts.length
      || right.likeCount - left.likeCount;
  });
}

function diversifyFeedPosts(posts: FeedPost[]): FeedPost[] {
  const seenSignatures = new Set<string>();
  const groups = new Map<string, FeedPost[]>();

  for (const post of posts) {
    const signature = feedOutfitSignature(post);
    if (!signature || seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);
    const key = feedDiversityKey(post);
    groups.set(key, [...(groups.get(key) || []), post]);
  }

  const sortedGroups = Array.from(groups.values())
    .map(sortFeedGroup)
    .sort((left, right) => {
      const leftTop = left[0];
      const rightTop = right[0];
      if (!leftTop || !rightTop) return 0;
      return postSourceRank(leftTop) - postSourceRank(rightTop)
        || postVisualQualityScore(rightTop) - postVisualQualityScore(leftTop)
        || rightTop.likeCount - leftTop.likeCount;
    });

  const diversified: FeedPost[] = [];
  let cursor = 0;
  while (sortedGroups.some((group) => cursor < group.length)) {
    for (const group of sortedGroups) {
      const post = group[cursor];
      if (post) diversified.push(post);
    }
    cursor += 1;
  }

  return diversified;
}

function feedProductRepeatCap(product: Product): number {
  return REPEAT_SENSITIVE_CATEGORIES.includes(product.category) ? 1 : 2;
}

function rememberFeedProducts(counts: Map<string, number>, post: FeedPost): void {
  for (const product of visibleProducts(post)) {
    counts.set(product.id, (counts.get(product.id) || 0) + 1);
  }
}

function exceedsFeedRepeatCap(post: FeedPost, counts: Map<string, number>, extraAllowance = 0): boolean {
  return visibleProducts(post).some((product) => {
    const cap = feedProductRepeatCap(product) + extraAllowance;
    return (counts.get(product.id) || 0) >= cap;
  });
}

function limitRepeatedFeedProducts(posts: FeedPost[]): FeedPost[] {
  const counts = new Map<string, number>();
  const preferred: FeedPost[] = [];
  const deferred: FeedPost[] = [];

  for (const post of posts) {
    if (exceedsFeedRepeatCap(post, counts)) {
      deferred.push(post);
      continue;
    }
    preferred.push(post);
    rememberFeedProducts(counts, post);
  }

  const minimumPreferred = Math.min(MIN_DEDUPED_FEED_POSTS, posts.length);
  if (preferred.length >= minimumPreferred) return [...preferred, ...deferred];

  const relaxedCounts = new Map(counts);
  const relaxed: FeedPost[] = [...preferred];
  const remaining: FeedPost[] = [];

  for (const post of deferred) {
    if (relaxed.length < minimumPreferred || !exceedsFeedRepeatCap(post, relaxedCounts, 1)) {
      relaxed.push(post);
      rememberFeedProducts(relaxedCounts, post);
    } else {
      remaining.push(post);
    }
  }

  return [...relaxed, ...remaining];
}

function productLinkStats(products: Product[]): { exactCount: number; linkedCount: number; totalCount: number } {
  const linkedProducts = products.filter((product) => Boolean(getProductOutboundUrl(product)));
  return {
    exactCount: linkedProducts.filter(hasExactProductLink).length,
    linkedCount: linkedProducts.length,
    totalCount: products.length,
  };
}

function feedProductsByCategory(products: Product[]): Map<Category, Product> {
  return new Map(products.map((product) => [product.category, product]));
}

function feedCoreSlotCount(products: Product[]): number {
  const byCategory = feedProductsByCategory(products);
  return REQUIRED_FEED_CATEGORIES.filter((category) => byCategory.has(category)).length;
}

function feedCategoryCount(products: Product[]): number {
  return new Set(products.map((product) => product.category)).size;
}

function postVisualQualityScore(post: FeedPost): number {
  const products = visibleProducts(post);
  if (!products.length) return -999;
  const stats = productLinkStats(products);
  const averageImageScore = products.reduce((sum, product) => sum + productImageQualityScore(product), 0) / products.length;
  const hasHero = Boolean(heroProductForPost(post));
  const coreSlots = feedCoreSlotCount(products);
  return (
    averageImageScore
    + products.length * 11
    + feedCategoryCount(products) * 7
    + coreSlots * 28
    + stats.exactCount * 24
    + stats.linkedCount * 5
    + (hasHero ? 24 : -30)
    + Math.min(18, post.likeCount / 28)
    - postSourceRank(post) * 4
  );
}

function postMeetsFeedQuality(post: FeedPost): boolean {
  const products = visibleProducts(post);
  if (products.length < 3) return false;
  const byCategory = feedProductsByCategory(products);
  if (!REQUIRED_FEED_CATEGORIES.every((category) => byCategory.has(category))) return false;
  const stats = productLinkStats(products);
  if (stats.linkedCount < products.length) return false;
  if (stats.exactCount < Math.min(2, products.length)) return false;
  if (!feedOutfitSignature(post)) return false;
  return postVisualQualityScore(post) > 80;
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

function feedPostElementId(postId: string): string {
  return `feed-post-${postId}`;
}

function findSimilarPosts(current: FeedPost, all: FeedPost[], limit = 3): FeedPost[] {
  if (!current.formulaId) return [];
  return all
    .filter((post) => post.id !== current.id && post.formulaId === current.formulaId)
    .slice(0, limit);
}

function storyPreviewProduct(post: FeedPost): Product | null {
  return visibleProducts(post)[0] ?? null;
}

function storyInitial(post: FeedPost): string {
  const label = post.formulaLabel || post.vibe || post.title;
  return label.trim().charAt(0).toUpperCase() || 'S';
}

function heroProductForPost(post: FeedPost): Product | null {
  const items = post.items as Partial<Record<Category, Product>>;
  return [items.outer, items.top, items.bottom, items.shoes]
    .find((product): product is Product => Boolean(product && isFeedHeroCandidate(product))) || null;
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
  const [hasMounted, setHasMounted] = useState(false);
  const [activeFilter, setActiveFilter] = useState('For You');
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);
  const [commentText, setCommentText] = useState('');
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Fit Feed');
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [remixingPostId, setRemixingPostId] = useState<string | null>(null);
  const [savedPulsePostId, setSavedPulsePostId] = useState<string | null>(null);
  const [whyPostId, setWhyPostId] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visiblePostCount, setVisiblePostCount] = useState(INITIAL_RENDERED_POSTS);
  const [storyPreviewImagesReady, setStoryPreviewImagesReady] = useState(false);
  const [pieceTrayImagesReady, setPieceTrayImagesReady] = useState(false);
  const feedScrollerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastFilterGenerateRef = useRef<string | null>(null);
  // A post's feed-quality verdict depends only on its (immutable) products, not
  // on like/save toggles — cache it by id so mutating `posts` (every like/save)
  // doesn't re-run the expensive per-post quality scoring across the whole feed.
  const feedQualityCacheRef = useRef<Map<string, boolean>>(new Map());
  const feedGenerationOptions = useMemo(() => feedGenerationOptionsForFilter(activeFilter), [activeFilter]);
  const filteredPosts = useMemo(
    // Show only real commerce-backed pieces, then interleave the queue so
    // consecutive cards do not feel like the same generated formula.
    () => {
      if (!hasMounted) return [];
      const cache = feedQualityCacheRef.current;
      const meetsQuality = (post: FeedPost) => {
        let verdict = cache.get(post.id);
        if (verdict === undefined) {
          verdict = postMeetsFeedQuality(post);
          cache.set(post.id, verdict);
        }
        return verdict;
      };
      return limitRepeatedFeedProducts(diversifyFeedPosts(posts.filter((post) => postMatches(post, activeFilter) && meetsQuality(post))));
    },
    [posts, activeFilter, hasMounted],
  );
  const storyPosts = useMemo(() => filteredPosts.slice(0, 7), [filteredPosts]);
  const activeStoryPost = activeStoryIndex === null ? null : storyPosts[activeStoryIndex] ?? null;
  const renderedPosts = useMemo(
    () => filteredPosts.slice(0, visiblePostCount),
    [filteredPosts, visiblePostCount],
  );
  const firstRenderedPostId = renderedPosts[0]?.id ?? null;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    setVisiblePostCount(INITIAL_RENDERED_POSTS);
  }, [activeFilter]);

  useEffect(() => {
    if (!hasMounted) return;
    setStoryPreviewImagesReady(false);
    const timeout = window.setTimeout(() => setStoryPreviewImagesReady(true), 500);
    return () => window.clearTimeout(timeout);
  }, [activeFilter, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    if (!firstRenderedPostId) {
      setPieceTrayImagesReady(false);
      return;
    }
    setPieceTrayImagesReady(false);
    const timeout = window.setTimeout(() => setPieceTrayImagesReady(true), 900);
    return () => window.clearTimeout(timeout);
  }, [activeFilter, firstRenderedPostId, hasMounted]);

  // Scroll back to the top when the user switches filters. Scroll restoration is
  // already pinned to 'manual' above, so one rAF'd scrollTo is enough — no need
  // for the old listener/timer/interval gauntlet.
  useLayoutEffect(() => {
    if (!hasMounted) return;
    const scroller = feedScrollerRef.current;
    if (!scroller) return;
    const raf = window.requestAnimationFrame(() => {
      scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeFilter, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    if (posts.length < 14) {
      let didRun = false;
      const run = () => {
        if (didRun) return;
        didRun = true;
        generateMorePosts(FEED_GENERATE_BATCH, feedGenerationOptions);
      };
      const requestIdle = window.requestIdleCallback || ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 400));
      const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
      const id = requestIdle(run, { timeout: 2200 });
      const fallback = window.setTimeout(run, 900);
      return () => {
        cancelIdle(id);
        window.clearTimeout(fallback);
      };
    }
  }, [feedGenerationOptions, generateMorePosts, hasMounted, posts.length]);

  useEffect(() => {
    if (!hasMounted) return;
    if (filteredPosts.length >= INITIAL_RENDERED_POSTS) return;
    if (lastFilterGenerateRef.current === activeFilter) return;
    lastFilterGenerateRef.current = activeFilter;
    const timeout = window.setTimeout(() => generateMorePosts(FEED_GENERATE_BATCH, feedGenerationOptions), 180);
    return () => window.clearTimeout(timeout);
  }, [activeFilter, feedGenerationOptions, filteredPosts.length, generateMorePosts, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setLoadingMore(true);
        if (visiblePostCount < filteredPosts.length) {
          setVisiblePostCount((current) => Math.min(current + FEED_RENDER_INCREMENT, filteredPosts.length));
        } else {
          generateMorePosts(FEED_GENERATE_BATCH, feedGenerationOptions);
          setVisiblePostCount((current) => current + FEED_RENDER_INCREMENT);
        }
        window.setTimeout(() => setLoadingMore(false), 360);
      },
      { root: null, rootMargin: '900px 0px', threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feedGenerationOptions, generateMorePosts, filteredPosts.length, hasMounted, visiblePostCount]);

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

  function openEditor(post: FeedPost) {
    const products = visibleProducts(post);
    if (products.length < 3) return;
    replaceItems(itemsFromProducts(products));
    router.push('/canvas?source=fit-viewer');
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

  function shop(post: FeedPost, focusProduct?: Product) {
    const sourceProducts = focusProduct ? [focusProduct] : visibleProducts(post);
    const products = sourceProducts
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    setCheckoutTitle(focusProduct ? `${focusProduct.brand} ${focusProduct.name}` : post.title);
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
    <main
      className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-[#f6f1ea]"
      data-feed-diversity-version="6"
      data-feed-visible-count={filteredPosts.length}
      data-feed-rendered-count={renderedPosts.length}
    >
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
        <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="pointer-events-auto rounded-[22px] border border-black/8 bg-white/88 px-3 py-2.5 shadow-[0_16px_38px_rgba(42,28,21,.16)] backdrop-blur-xl">
            <div className="text-center">
              <div className="text-[8px] font-black uppercase tracking-[.2em] text-[#8a766b]">Community</div>
              <div className="font-serif text-[20px] font-semibold leading-none text-[#171118]">
                Fit <em className="italic text-accent">feed</em>
              </div>
            </div>
            <div className="mt-2 flex justify-center">
              <div className="flex max-w-full justify-start gap-2 overflow-x-auto px-1 scrollbar-hide">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`flex-none rounded-full px-3.5 py-1.5 text-[10px] font-semibold tracking-wide transition active:scale-90 motion-safe:transition-all motion-safe:duration-200 ${
                      activeFilter === filter
                        ? 'bg-[#171118] text-white shadow-[0_8px_22px_rgba(23,17,24,.18)]'
                        : 'bg-[#171118]/6 text-[#51443d] hover:bg-[#171118]/10 hover:text-[#171118]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {storyPosts.length ? (
          <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+106px)] z-20 px-3">
            <div className="pointer-events-auto flex gap-2 overflow-x-auto rounded-[22px] border border-black/8 bg-white/72 px-2.5 py-2 shadow-[0_14px_32px_rgba(42,28,21,.14)] backdrop-blur-xl scrollbar-hide">
            {storyPosts.map((post, index) => {
              const preview = storyPreviewProduct(post);
              return (
                <button
                  key={`story-${post.id}`}
                  type="button"
                  onClick={() => setActiveStoryIndex(index)}
                  className="group w-[50px] flex-none text-center transition active:scale-95"
                  aria-label={`Open ${post.title} story`}
                >
                  <span className={`block rounded-full bg-gradient-to-br ${STORY_RING_CLASSES[index % STORY_RING_CLASSES.length]} p-[2px] shadow-[0_12px_30px_rgba(0,0,0,.34)]`}>
                    <span
                      className="grid h-[46px] w-[46px] place-items-center overflow-hidden rounded-full border border-black/8 bg-white/64"
                      data-story-preview-ready={storyPreviewImagesReady ? 'true' : 'false'}
                    >
                      {preview && storyPreviewImagesReady ? (
                        <ProductImage
                          product={preview}
                          transparentOnly
                          displayMode="thumbnail"
                          wrapperClassName="h-full w-full bg-transparent"
                          className="h-full w-full object-contain p-1.5 transition group-hover:scale-110"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_34%,rgba(246,48,107,.22),transparent_52%)] font-serif text-[18px] font-semibold text-[#171118]/86">
                          {preview ? CATEGORY_LABELS[preview.category].charAt(0) : storyInitial(post)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[9px] font-bold tracking-[-.01em] text-[#51443d]">
                    {post.formulaLabel || post.vibe}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        ) : null}

        <div
          ref={feedScrollerRef}
          className="h-full overflow-y-auto overscroll-contain px-2.5 pb-[118px] pt-[calc(env(safe-area-inset-top)+198px)]"
        >
          <div className="columns-2 [column-gap:0.625rem]">
            {renderedPosts.map((post, index) => {
              const products = visibleProducts(post);
              const linkStats = productLinkStats(products);
              const likeLabel =
                post.likeCount >= 1000 ? `${(post.likeCount / 1000).toFixed(1)}k` : `${post.likeCount}`;
              const handle = post.username && post.username.trim() ? post.username : 'by fitcommunity';
              const initial = handle.replace(/^@/, '').charAt(0).toUpperCase() || 'F';
              const boardHeight = index % 5 === 0 ? 'h-[280px]' : index % 3 === 0 ? 'h-[212px]' : 'h-[244px]';
              return (
                <button
                  key={post.id}
                  type="button"
                  id={feedPostElementId(post.id)}
                  data-feed-post={post.id}
                  data-feed-post-product-count={products.length}
                  data-feed-post-link-quality={`${linkStats.exactCount}/${linkStats.linkedCount}`}
                  data-feed-post-signature={feedOutfitSignature(post)}
                  data-feed-post-diversity-key={feedDiversityKey(post)}
                  onClick={() => setWhyPostId(post.id)}
                  className="group mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-[20px] border border-black/8 bg-white text-left shadow-[0_8px_22px_rgba(42,28,21,.1)] transition active:scale-[0.985] motion-safe:transition-all motion-safe:duration-200 motion-safe:[@media(hover:hover)]:hover:-translate-y-0.5 motion-safe:[@media(hover:hover)]:hover:shadow-[0_18px_40px_rgba(42,28,21,.22)]"
                >
                  <div className="sy-studio relative overflow-hidden">
                    <OutfitLookCard
                      items={products}
                      title={post.title}
                      subtitle={post.formulaLabel || post.vibe}
                      compact
                      loading="eager"
                      presentation="flatlay"
                      productLinks={false}
                      className={`${boardHeight} w-full`}
                      feedContext={{ formulaId: post.formulaId, formulaLabel: post.formulaLabel }}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        like(post);
                      }}
                      aria-label="Like fit"
                      className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-[#171118] shadow-[0_6px_16px_rgba(0,0,0,.18)] backdrop-blur-md transition active:scale-90 motion-safe:[@media(hover:hover)]:hover:scale-[1.08]"
                    >
                      <Heart size={15} fill={post.liked ? 'currentColor' : 'none'} className={post.liked ? 'text-accent' : ''} />
                    </button>
                    {linkStats.exactCount > 0 ? (
                      <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-[#171118]/82 px-2 py-1 text-[8px] font-bold uppercase tracking-[.12em] text-white backdrop-blur-md">
                        <ShoppingBag size={9} />
                        {linkStats.exactCount} shoppable
                      </span>
                    ) : null}
                  </div>
                  <div className="px-2.5 pt-2">
                    <h3 className="line-clamp-1 text-[13px] font-bold tracking-[-.01em] text-[#171118]">{post.title}</h3>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="rounded-full bg-[#171118]/6 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[.1em] text-[#51443d]">
                        {post.vibe}
                      </span>
                      <span className="text-[10px] font-bold text-[#171118]/55">{formatPrice(post.totalCents)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-accent text-[9px] font-black text-white">
                        {initial}
                      </span>
                      <span className="truncate text-[10.5px] font-semibold text-[#8a766b]">{handle}</span>
                    </div>
                    <span className="inline-flex flex-none items-center gap-1 text-[11px] font-bold text-[#171118]/72">
                      <Heart size={11} fill="currentColor" className="text-accent" />
                      {likeLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div ref={sentinelRef} className="grid min-h-[28dvh] place-items-center px-6 pb-28 pt-4 text-center">
            <div>
              <div className="font-serif text-[20px] text-[#171118]">{loadingMore ? 'Loading more fits…' : 'More fits are coming'}</div>
              <p className="mt-2 text-[13px] text-[#8a766b]">New boards are on deck.</p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />

      <FeedStoryViewer
        post={activeStoryPost}
        products={activeStoryPost ? visibleProducts(activeStoryPost) : []}
        storyCount={storyPosts.length}
        storyIndex={activeStoryIndex ?? 0}
        onClose={() => setActiveStoryIndex(null)}
        onPrev={() => setActiveStoryIndex((current) => (current === null ? 0 : Math.max(0, current - 1)))}
        onNext={() => setActiveStoryIndex((current) => {
          if (current === null) return null;
          const nextIndex = current + 1;
          return nextIndex >= storyPosts.length ? null : nextIndex;
        })}
        onLike={(post) => like(post)}
        onSave={(post) => savePost(post)}
        onShop={(post) => {
          setActiveStoryIndex(null);
          shop(post);
        }}
        onDetails={(post) => {
          setActiveStoryIndex(null);
          setWhyPostId(post.id);
        }}
      />

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
              <button onClick={() => submitComment()} aria-label="Send comment" className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                <Send size={15} />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {whyPost ? (
      <FitViewer
        post={whyPost}
        products={whyPost ? visibleProducts(whyPost) : []}
        relatedPosts={whyPost ? findSimilarPosts(whyPost, posts) : []}
        source="feed"
        onClose={() => setWhyPostId(null)}
        onLike={like}
        onSave={savePost}
        onRemix={(post) => {
          setWhyPostId(null);
          remix(post);
        }}
        onShop={(post, product) => {
          setWhyPostId(null);
          shop(post, product);
        }}
        onBuildAroundHero={(post) => {
          setWhyPostId(null);
          buildAroundHero(post);
        }}
        onOpenEditor={(post) => {
          setWhyPostId(null);
          openEditor(post);
        }}
        onJumpToPost={jumpToPost}
      />
      ) : null}

      {checkoutProducts ? (
      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
      ) : null}
    </main>
  );
}

function FeedStoryViewer({
  post,
  products,
  storyCount,
  storyIndex,
  onClose,
  onPrev,
  onNext,
  onLike,
  onSave,
  onShop,
  onDetails,
}: {
  post: FeedPost | null;
  products: Product[];
  storyCount: number;
  storyIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLike: (post: FeedPost) => void;
  onSave: (post: FeedPost) => void;
  onShop: (post: FeedPost) => void;
  onDetails: (post: FeedPost) => void;
}) {
  if (!post) return null;
  const linkStats = productLinkStats(products);
  const handle = post.username.replace(/^@/, '') || 'sylistly';

  return (
    <div
      className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${post.title} story`}
      data-feed-story-viewer
      data-feed-story-product-count={products.length}
      data-feed-story-link-quality={`${linkStats.exactCount}/${linkStats.linkedCount}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#111_0%,#050505_100%)]" />
      <div className="relative z-10 flex flex-none gap-1.5 px-3 pt-[calc(env(safe-area-inset-top)+10px)]">
        {Array.from({ length: Math.max(storyCount, 1) }).map((_, index) => (
          <span key={`story-progress-${index}`} className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              className={`block h-full rounded-full bg-white ${index < storyIndex ? 'w-full' : index === storyIndex ? 'w-[72%]' : 'w-0'}`}
            />
          </span>
        ))}
      </div>

      <header className="relative z-10 flex flex-none items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={() => onDetails(post)} className="flex min-w-0 items-center gap-2 text-left" aria-label={`Open ${post.title} details`}>
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-accent bg-[#2a1c20] text-[13px] font-black uppercase shadow-[0_10px_28px_rgba(246,48,107,.36)]">
            {post.avatar || handle.slice(0, 1)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-black tracking-[-.01em]">{handle}</span>
            <span className="block text-[12px] font-semibold text-white/56">{post.source === 'generated-live' ? 'now' : '3h'}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/10 text-white transition active:scale-95 hover:bg-white/16"
          aria-label="Close story"
        >
          <X size={24} />
        </button>
      </header>

      <section className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-[calc(env(safe-area-inset-bottom)+82px)]">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-[#f8f8f5] shadow-[0_24px_72px_rgba(0,0,0,.5)]">
          <button type="button" onClick={onPrev} className="absolute inset-y-0 left-0 z-20 w-1/4" aria-label="Previous story" />
          <button type="button" onClick={onNext} className="absolute inset-y-0 right-0 z-20 w-1/4" aria-label="Next story" />
          <div className="absolute inset-x-5 top-5 z-10 flex items-center justify-between gap-2 text-[#181818]">
            <span className="rounded-full bg-white/76 px-3 py-1 text-[9px] font-black uppercase tracking-[.16em] shadow-[0_8px_18px_rgba(0,0,0,.08)]">
              {post.formulaLabel || post.vibe}
            </span>
            <span className="rounded-full bg-white/76 px-3 py-1 text-[9px] font-black uppercase tracking-[.16em] shadow-[0_8px_18px_rgba(0,0,0,.08)]">
              {products.length} pieces
            </span>
          </div>
          <div className="h-full px-3 pb-4 pt-8">
            <OutfitLookCard
              items={products}
              title={post.title}
              subtitle={post.formulaLabel || post.vibe}
              className="h-full"
              productLinks={false}
              presentation="stacked"
              feedContext={{ formulaId: post.formulaId, formulaLabel: post.formulaLabel }}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[auto_auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => onLike(post)}
            className="inline-flex items-center gap-1.5 rounded-full px-1 text-[14px] font-black text-white transition active:scale-95"
            aria-label="Like story"
          >
            <Heart size={30} fill={post.liked ? 'currentColor' : 'none'} className={post.liked ? 'text-accent' : 'text-white'} />
            {post.likeCount}
          </button>
          <button
            type="button"
            onClick={() => onDetails(post)}
            className="inline-flex items-center gap-1.5 rounded-full px-1 text-[14px] font-black text-white transition active:scale-95"
            aria-label="Open story comments"
          >
            <MessageCircle size={29} />
            {post.comments.length}
          </button>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-black">{post.title}</div>
            <div className="mt-0.5 truncate text-[11px] font-semibold text-white/50">
              {formatPrice(post.totalCents)} · {linkStats.exactCount}/{linkStats.linkedCount} exact
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSave(post)}
              className={`grid h-10 w-10 place-items-center rounded-full border transition active:scale-95 ${
                post.saved ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-white/18 bg-white/10 text-white'
              }`}
              aria-label="Save story fit"
            >
              <Bookmark size={17} fill={post.saved ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={() => onShop(post)}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-black transition active:scale-95"
              aria-label="Shop story fit"
            >
              <ShoppingBag size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
