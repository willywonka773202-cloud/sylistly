'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Bookmark, CalendarDays, ChartPie, CheckCircle2, Grid3X3, Heart, Menu, MoreHorizontal, Pencil, Plus, RotateCcw, ShoppingBag, SlidersHorizontal, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import type { CheckoutProduct } from '@/components/CheckoutSheet';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { getCheckoutUrlHost } from '@/lib/checkout';
import { getProductOutboundUrl } from '@/lib/product-links';
import { hasExactProductLink, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { type SavedFitRecord, useSavedFits } from '@/store/saved-fits';
import { getSeedFeedPosts, type FeedPost, useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

const CheckoutSheet = dynamic(
  () => import('@/components/CheckoutSheet').then((module) => module.CheckoutSheet),
  { ssr: false, loading: () => null },
);
const FitViewer = dynamic(
  () => import('@/components/FitViewer').then((module) => module.FitViewer),
  { ssr: false, loading: () => null },
);

const SKIN_TONES = ['#f5d0b5', '#ddb192', '#c9a98a', '#a47757', '#7d553e', '#4b3025'];
const BODY_TYPES = ['masc', 'fem', 'androgynous', 'custom'] as const;
const BUDGETS = ['low', 'mid', 'high', 'luxury'] as const;
type ProfileArchiveTab = 'posted' | 'saved' | 'liked' | 'inspo';
const PROFILE_ARCHIVE_TABS: Array<{ id: ProfileArchiveTab; label: string; empty: string }> = [
  { id: 'posted', label: 'Posted', empty: 'Post from Builder to replace this inspo grid.' },
  { id: 'saved', label: 'Saved', empty: 'Save looks from Feed, Builder, or Editor.' },
  { id: 'liked', label: 'Liked', empty: 'Like outfits in Feed or Builder to build this archive.' },
  { id: 'inspo', label: 'Inspo', empty: 'Catalog-backed outfit inspiration.' },
];
const PROFILE_INITIAL_ARCHIVE_COUNT = 4;
const PROFILE_ARCHIVE_INCREMENT = 4;
const BODY_TYPE_LABELS: Record<(typeof BODY_TYPES)[number], string> = {
  masc: 'Male',
  fem: 'Female',
  androgynous: 'Neutral',
  custom: 'Custom',
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function postProducts(post: FeedPost, failedImageIds: Set<string>): Product[] {
  return sortTransparentFeedRenderableProducts(
    Object.values(post.items).filter(
      (product): product is Product => Boolean(product && !failedImageIds.has(product.id)),
    ),
  );
}

function productLinkStats(products: Product[]): { exactCount: number; linkedCount: number } {
  const linkedProducts = products.filter((product) => Boolean(getProductOutboundUrl(product)));
  return {
    exactCount: linkedProducts.filter(hasExactProductLink).length,
    linkedCount: linkedProducts.length,
  };
}

function productLinkHosts(products: Product[]): string {
  return Array.from(
    new Set(
      products
        .map((product) => getCheckoutUrlHost(getProductOutboundUrl(product)))
        .filter(Boolean),
    ),
  )
    .slice(0, 5)
    .join(',');
}

function itemsFromProducts(products: Product[]): Partial<Record<Category, Product>> {
  return Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
}

function heroProductForPost(post: FeedPost, failedImageIds: Set<string>): Product | null {
  const products = postProducts(post, failedImageIds);
  return products.find((product) => ['outer', 'top', 'bottom', 'shoes'].includes(product.category)) ?? products[0] ?? null;
}

function savedFitToPost(fit: SavedFitRecord, index: number): FeedPost {
  return {
    id: `profile-saved-${fit.id}`,
    username: '@you',
    avatar: 'S',
    title: fit.title,
    caption: 'Saved to your Sylistly archive with real linked transparent pieces.',
    vibe: 'Saved',
    frameBias: 'any',
    sourceType: 'community',
    source: 'first-screen',
    tags: ['saved', 'archive', 'real links'],
    visibility: 'public',
    createdAt: fit.createdAt,
    totalCents: fit.totalCents,
    itemCount: fit.itemCount,
    items: fit.items,
    likeCount: Math.max(1, 24 - index),
    liked: false,
    saved: true,
    comments: [],
  };
}

export default function ProfilePage() {
  const profile = useProfile((state) => state.profile);
  const setSkinTone = useProfile((state) => state.setSkinTone);
  const setBodyType = useProfile((state) => state.setBodyType);
  const setTopSize = useProfile((state) => state.setTopSize);
  const setBottomSize = useProfile((state) => state.setBottomSize);
  const setShoeSize = useProfile((state) => state.setShoeSize);
  const setBudget = useProfile((state) => state.setBudget);
  const setVibesFromText = useProfile((state) => state.setVibesFromText);
  const setBrandsFromText = useProfile((state) => state.setBrandsFromText);
  const savedFitCount = useSavedFits((state) => state.fits.length);
  const savedFits = useSavedFits((state) => state.fits);
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const posts = useSocialFeed((state) => state.posts);
  const generateMorePosts = useSocialFeed((state) => state.generateMorePosts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const toggleSave = useSocialFeed((state) => state.toggleSave);
  const replaceItems = useFit((state) => state.replaceItems);
  const currentFitItems = useFit((state) => state.items);
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Style profile');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [activeArchiveTab, setActiveArchiveTab] = useState<ProfileArchiveTab>('posted');
  const [archiveImageReady, setArchiveImageReady] = useState(false);
  const [visibleArchiveCount, setVisibleArchiveCount] = useState(PROFILE_INITIAL_ARCHIVE_COUNT);

  useEffect(() => setHasMounted(true), []);
  useEffect(() => {
    if (!hasMounted || posts.length >= 8) return;
    const timeout = window.setTimeout(() => {
      generateMorePosts(4);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [generateMorePosts, hasMounted, posts.length]);
  useEffect(() => {
    setVisibleArchiveCount(PROFILE_INITIAL_ARCHIVE_COUNT);
    setArchiveImageReady(false);
    if (!hasMounted) return;
    const timeout = window.setTimeout(() => {
      setArchiveImageReady(true);
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [activeArchiveTab, hasMounted]);
  const sourcePosts = hasMounted && posts.length ? posts : getSeedFeedPosts();

  const savedFitPosts = useMemo(
    () => savedFits
      .map(savedFitToPost)
      .filter((post) => postProducts(post, failedImageIds).length >= 3),
    [failedImageIds, savedFits],
  );
  const userPosts = useMemo(
    () => (hasMounted ? sourcePosts.filter((post) => post.username === '@you' && postProducts(post, failedImageIds).length >= 3) : []),
    [sourcePosts, failedImageIds, hasMounted],
  );
  const likedPosts = useMemo(
    () => (hasMounted ? sourcePosts.filter((post) => post.liked && postProducts(post, failedImageIds).length >= 3) : []),
    [failedImageIds, hasMounted, sourcePosts],
  );
  const inspoPosts = useMemo(
    () => sourcePosts.filter((post) => postProducts(post, failedImageIds).length >= 3).slice(0, 10),
    [failedImageIds, sourcePosts],
  );
  const profileViewerPosts = useMemo(
    () => [...savedFitPosts, ...sourcePosts],
    [savedFitPosts, sourcePosts],
  );
  const archiveCollections = useMemo(
    () => ({
      posted: userPosts,
      saved: savedFitPosts,
      liked: likedPosts,
      inspo: inspoPosts,
    }),
    [inspoPosts, likedPosts, savedFitPosts, userPosts],
  );
  const activeArchivePosts = archiveCollections[activeArchiveTab];
  const isArchiveFallback = !activeArchivePosts.length && inspoPosts.length > 0;
  const archiveTabLabel = PROFILE_ARCHIVE_TABS.find((tab) => tab.id === activeArchiveTab)?.label || 'Outfit';
  const archiveEmptyCopy = PROFILE_ARCHIVE_TABS.find((tab) => tab.id === activeArchiveTab)?.empty;
  const fullGridPosts = activeArchivePosts.length
    ? activeArchivePosts
    : inspoPosts.slice(0, 8);
  const gridPosts = fullGridPosts.slice(0, visibleArchiveCount);
  const hasMoreArchivePosts = visibleArchiveCount < fullGridPosts.length;
  const resolvedActivePost = activePost ? profileViewerPosts.find((post) => post.id === activePost.id) ?? activePost : null;
  const activePostProducts = resolvedActivePost ? postProducts(resolvedActivePost, failedImageIds) : [];
  const activeRelatedPosts = resolvedActivePost?.formulaId
    ? profileViewerPosts.filter((post) => post.id !== resolvedActivePost.id && post.formulaId === resolvedActivePost.formulaId).slice(0, 3)
    : [];
  const likedCount = hasMounted ? posts.filter((post) => post.liked).length : 0;
  const currentBuildCount = hasMounted ? Object.values(currentFitItems).filter(Boolean).length : 0;

  // Style DNA — derived from REAL saved fits + wardrobe. No invented
  // stats. If the user hasn't saved anything, the panel says so rather
  // than fabricating "top vibe: streetwear".
  const styleDna = useMemo(() => {
    if (!hasMounted) {
      return {
        topBrands: [],
        topCategories: [],
        topVibe: null,
        topFormula: null,
        medianPriceCents: 0,
        averagePriceCents: 0,
        budgetTier: null,
        totalPiecesObserved: 0,
        archetype: 'Building Your Style DNA',
      };
    }
    const brandCounts = new Map<string, number>();
    const categoryCounts = new Map<Category, number>();
    const vibeCounts = new Map<string, number>();
    const formulaCounts = new Map<string, number>();
    const prices: number[] = [];
    let totalPiecesObserved = 0;
    const textSignals: string[] = [];

    for (const fit of savedFits) {
      for (const product of Object.values(fit.items)) {
        if (!product) continue;
        totalPiecesObserved += 1;
        if (product.brand) brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
        categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
        if (product.priceCents > 0) prices.push(product.priceCents);
        for (const vibe of [...(product.vibes || []), ...(product.occasions || [])]) {
          vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
        }
        textSignals.push(product.brand, product.name, ...(product.vibes || []), ...(product.occasions || []), ...(product.searchTerms || []));
      }
    }
    for (const entry of wardrobeItems) {
      const product = entry.product;
      totalPiecesObserved += 1;
      if (product.brand) brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
      categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
      if (product.priceCents > 0) prices.push(product.priceCents);
      for (const vibe of [...(product.vibes || []), ...(product.occasions || [])]) {
        vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
      }
      textSignals.push(product.brand, product.name, ...(product.vibes || []), ...(product.occasions || []), ...(product.searchTerms || []));
    }
    for (const post of posts.filter((entry) => entry.liked || entry.saved || entry.username === '@you')) {
      vibeCounts.set(post.vibe, (vibeCounts.get(post.vibe) || 0) + 1);
      if (post.formulaLabel) formulaCounts.set(post.formulaLabel, (formulaCounts.get(post.formulaLabel) || 0) + 1);
      textSignals.push(post.vibe, post.title, post.formulaLabel || '', ...(post.tags || []));
    }
    for (const vibe of profile.stylePrefs.vibes || []) {
      vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
      textSignals.push(vibe);
    }
    for (const brand of profile.stylePrefs.brands || []) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
      textSignals.push(brand);
    }

    const topBrands = Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);
    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);
    const topVibe = Array.from(vibeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topFormula = Array.from(formulaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const medianPriceCents = prices.length
      ? prices.slice().sort((a, b) => a - b)[Math.floor(prices.length / 2)]
      : 0;
    const averagePriceCents = prices.length
      ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
      : 0;
    const budgetTier =
      medianPriceCents === 0
        ? null
        : medianPriceCents < 10000
        ? 'Budget-conscious'
        : medianPriceCents < 25000
        ? 'Smart spend'
        : medianPriceCents < 60000
        ? 'Premium'
        : 'Luxury';
    const signalText = textSignals.join(' ').toLowerCase();
    const archetypeScores = [
      {
        label: 'Clean Minimalist',
        score: ['clean', 'minimal', 'neutral', 'white', 'black', 'tailored', 'basics'].filter((term) => signalText.includes(term)).length,
      },
      {
        label: 'Streetwear Athlete',
        score: ['street', 'sneaker', 'hoodie', 'cargo', 'nike', 'adidas', 'campus', 'samba'].filter((term) => signalText.includes(term)).length,
      },
      {
        label: 'Elevated Casual',
        score: ['date', 'night', 'office', 'blazer', 'trouser', 'leather', 'polo', 'coach'].filter((term) => signalText.includes(term)).length,
      },
      {
        label: 'Gym Utility',
        score: ['gym', 'training', 'athletic', 'alo', 'track', 'utility', 'shorts'].filter((term) => signalText.includes(term)).length,
      },
      {
        label: 'Old Money Prep',
        score: ['old money', 'preppy', 'linen', 'loafer', 'cardigan', 'polo', 'khaki'].filter((term) => signalText.includes(term)).length,
      },
    ].sort((left, right) => right.score - left.score);
    const archetype = totalPiecesObserved >= 5 || savedFits.length >= 2 || wardrobeItems.length >= 5
      ? archetypeScores[0]?.label || 'Building Your Style DNA'
      : 'Building Your Style DNA';

    return { topBrands, topCategories, topVibe, topFormula, medianPriceCents, averagePriceCents, budgetTier, totalPiecesObserved, archetype };
  }, [hasMounted, posts, profile.stylePrefs.brands, profile.stylePrefs.vibes, savedFits, wardrobeItems]);

  const progressChecklist = useMemo(() => {
    if (!hasMounted) {
      return [
        { label: 'Save 3 fits', complete: false, detail: '0/3 saved' },
        { label: 'Add 5 wardrobe items', complete: false, detail: '0/5 added' },
        { label: 'Add shoes', complete: false, detail: 'No shoes in wardrobe yet' },
        { label: 'Use a build', complete: false, detail: 'No build detected' },
        { label: 'Choose favorite vibes', complete: false, detail: 'Add vibes below' },
      ];
    }
    const hasShoes = wardrobeItems.some((entry) => entry.product.category === 'shoes');
    const hasFavoriteVibes = Boolean(profile.stylePrefs.vibes?.length);
    return [
      { label: 'Save 3 fits', complete: savedFits.length >= 3, detail: `${Math.min(savedFits.length, 3)}/3 saved` },
      { label: 'Add 5 wardrobe items', complete: wardrobeItems.length >= 5, detail: `${Math.min(wardrobeItems.length, 5)}/5 added` },
      { label: 'Add shoes', complete: hasShoes, detail: hasShoes ? 'Shoe slot covered' : 'No shoes in wardrobe yet' },
      { label: 'Use a build', complete: currentBuildCount > 0 || savedFits.length > 0, detail: currentBuildCount > 0 ? `${currentBuildCount} builder pieces` : savedFits.length > 0 ? 'Saved fit detected' : 'No build detected' },
      { label: 'Choose favorite vibes', complete: hasFavoriteVibes, detail: hasFavoriteVibes ? (profile.stylePrefs.vibes || []).join(', ') : 'Add vibes below' },
    ];
  }, [currentBuildCount, hasMounted, profile.stylePrefs.vibes, savedFits.length, wardrobeItems]);
  const completedProgress = progressChecklist.filter((item) => item.complete).length;
  const progressPercent = Math.round((completedProgress / progressChecklist.length) * 100);

  function remix(post: FeedPost) {
    const products = postProducts(post, failedImageIds);
    replaceItems(itemsFromProducts(products));
    router.push('/build');
  }

  function buildAroundHero(post: FeedPost) {
    const products = postProducts(post, failedImageIds);
    const hero = heroProductForPost(post, failedImageIds);
    replaceItems(itemsFromProducts(products));
    router.push(hero ? `/build?lock=${encodeURIComponent(hero.category)}` : '/build');
  }

  function openEditor(post: FeedPost) {
    const products = postProducts(post, failedImageIds);
    if (products.length < 3) return;
    replaceItems(itemsFromProducts(products));
    router.push('/canvas?source=profile-viewer');
  }

  function shop(post: FeedPost, focusProduct?: Product) {
    const sourceProducts = focusProduct ? [focusProduct] : postProducts(post, failedImageIds);
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

  return (
    <main
      className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-[#080706] text-white"
      data-profile-page
      data-profile-active-tab={activeArchiveTab}
      data-profile-fallback-source={isArchiveFallback ? 'inspo' : 'none'}
      data-profile-grid-count={gridPosts.length}
      data-profile-grid-total-count={fullGridPosts.length}
      data-profile-images-ready={archiveImageReady ? 'true' : 'false'}
      data-profile-posted-count={userPosts.length}
      data-profile-saved-post-count={savedFitPosts.length}
      data-profile-liked-post-count={likedPosts.length}
      data-profile-inspo-count={inspoPosts.length}
    >
      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(246,48,107,.18),transparent_34%),linear-gradient(180deg,#15100f_0%,#080706_52%,#040303_100%)] pb-32">
        <section className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+18px)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="sy-eyebrow">Profile</div>
              <h1 className="mt-1 font-serif text-[35px] font-semibold tracking-[-.04em] text-white">willys</h1>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[.055] px-2 py-1 shadow-[0_18px_44px_rgba(0,0,0,.32)] backdrop-blur-xl">
              <Link href="/saved" className="grid h-10 w-10 place-items-center rounded-full text-white/88 transition active:scale-95 hover:bg-white/[.08]" aria-label="Open planner">
                <CalendarDays size={21} />
              </Link>
              <a href="#style-dna" className="grid h-10 w-10 place-items-center rounded-full text-white/88 transition active:scale-95 hover:bg-white/[.08]" aria-label="Open style analytics">
                <ChartPie size={23} />
              </a>
              <Link href="/wardrobe" className="grid h-10 w-10 place-items-center rounded-full text-white/88 transition active:scale-95 hover:bg-white/[.08]" aria-label="Open wardrobe menu">
                <Menu size={24} />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[116px_1fr] items-center gap-5">
            <div className="relative">
              <div className="grid h-[96px] w-[96px] place-items-center rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.32),transparent_34%),linear-gradient(135deg,#f6306b,#35242b_54%,#0d0a09)] text-[46px] font-black text-white shadow-[0_18px_46px_rgba(246,48,107,.25)]">
                W
              </div>
              <Link
                href="/build"
                className="absolute bottom-0 right-3 grid h-9 w-9 place-items-center rounded-full border-[3px] border-[#15100f] bg-accent text-white shadow-pink-glow"
                aria-label="Create outfit"
              >
                <Plus size={22} strokeWidth={3} />
              </Link>
            </div>
            <div className="min-w-0">
              <div className="text-[20px] font-bold leading-tight text-white">Will Lambert</div>
              <div className="mt-3 grid max-w-[230px] grid-cols-3 gap-5">
                <SocialStat label="Posts" value={hasMounted ? savedFitCount : 0} />
                <SocialStat label="Likes" value={likedCount} />
                <SocialStat label="Following" value={0} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href="#style-dna"
              className="rounded-[16px] border border-white/10 bg-white/[.07] px-4 py-3 text-center text-[15px] font-bold text-white transition active:scale-[0.98] hover:border-accent/45"
            >
              Edit profile
            </a>
            <Link
              href="/feed"
              className="rounded-[16px] bg-accent px-4 py-3 text-center text-[15px] font-bold text-white shadow-pink-glow transition active:scale-[0.98]"
            >
              Share profile
            </Link>
          </div>

          <div className="mt-4 rounded-[24px] border border-accent/22 bg-[radial-gradient(circle_at_20%_0%,rgba(246,48,107,.24),transparent_44%),rgba(255,255,255,.045)] p-4 shadow-[0_20px_54px_rgba(0,0,0,.32)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[.22em] text-accent">Style pulse</div>
                <div className="mt-1 font-serif text-[24px] font-semibold tracking-[-.03em] text-white">{styleDna.archetype}</div>
              </div>
              <Link href="/build" className="grid h-12 w-12 flex-none place-items-center rounded-full bg-white text-[#15100f] shadow-[0_14px_34px_rgba(0,0,0,.25)] transition active:scale-95" aria-label="Create outfit from profile">
                <Plus size={24} strokeWidth={2.6} />
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <PulseMetric label="Saved" value={savedFits.length} />
              <PulseMetric label="Closet" value={wardrobeItems.length} />
              <PulseMetric label="Signals" value={styleDna.totalPiecesObserved} />
            </div>
          </div>

          <div className="mt-6 border-b border-white/10">
            <div className="grid grid-cols-3 text-center text-[17px] font-bold">
              {[
                { id: 'posted' as const, label: 'Clothes' },
                { id: 'saved' as const, label: 'Outfits' },
                { id: 'inspo' as const, label: 'Collections' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveArchiveTab(tab.id)}
                  className={`relative pb-3 transition active:scale-[0.98] ${
                    activeArchiveTab === tab.id ? 'text-white' : 'text-white/42'
                  }`}
                >
                  {tab.label}
                  {activeArchiveTab === tab.id ? (
                    <span className="absolute inset-x-7 bottom-0 h-[3px] rounded-full bg-accent shadow-pink-glow" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {[
              { label: 'All', tab: 'inspo' as const },
              { label: 'Posted', tab: 'posted' as const },
              { label: 'Saved', tab: 'saved' as const },
              { label: 'Liked', tab: 'liked' as const },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setActiveArchiveTab(chip.tab)}
                className={`flex-none rounded-[13px] px-4 py-2 text-[13px] font-bold transition active:scale-95 ${
                  activeArchiveTab === chip.tab ? 'bg-white text-[#15100f]' : 'border border-white/10 bg-white/[.045] text-white/54'
                }`}
              >
                {chip.label}
              </button>
            ))}
            <button type="button" className="ml-auto grid h-12 w-12 flex-none place-items-center rounded-full border border-white/10 bg-white/[.07] text-white transition active:scale-95" aria-label="Filter outfits">
              <SlidersHorizontal size={22} />
            </button>
            <button type="button" className="grid h-12 w-12 flex-none place-items-center rounded-full border border-white/10 bg-white/[.07] text-white transition active:scale-95" aria-label="More outfit options">
              <MoreHorizontal size={24} />
            </button>
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-1 scrollbar-hide" data-profile-story-rail>
            {[
              ['Clean', Sparkles],
              ['Streetwear', Grid3X3],
              ['Night Out', Heart],
              ['Saved', Bookmark],
              ['Remixes', RotateCcw],
            ].map(([label, Icon]) => {
              const IconComponent = Icon as typeof Sparkles;
              return (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => setActiveArchiveTab(label === 'Saved' ? 'saved' : label === 'Remixes' ? 'posted' : 'inspo')}
                  className="w-[72px] flex-none text-center transition active:scale-95"
                >
                  <span className="mx-auto grid h-[64px] w-[64px] place-items-center rounded-full bg-[linear-gradient(135deg,#f6306b,#ff8aa7_55%,#f7d8b8)] p-[2px] shadow-[0_14px_30px_rgba(246,48,107,.22)]">
                    <span className="grid h-full w-full place-items-center rounded-full bg-[#120d0c] text-white">
                      <IconComponent size={20} />
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[12px] font-semibold text-white/68">{label as string}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="px-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[.18em] text-accent">Profile archive</div>
              <h2 className="mt-1 font-serif text-[29px] font-semibold tracking-[-.04em] text-white">
                {isArchiveFallback ? 'Suggested real looks' : `${archiveTabLabel} grid`}
              </h2>
            </div>
            {!activeArchivePosts.length ? (
              <p className="max-w-[18ch] text-right text-[10px] leading-snug text-white/46">
                {archiveEmptyCopy}
                {isArchiveFallback ? ' Showing linked catalog looks for now.' : null}
              </p>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {gridPosts.map((post, index) => {
              const products = postProducts(post, failedImageIds);
              const linkStats = productLinkStats(products);
              return (
                <button
                  key={post.id}
                  type="button"
                  data-profile-grid-post={post.id}
                  data-profile-product-count={products.length}
                  data-profile-linked-count={linkStats.linkedCount}
                  data-profile-exact-count={linkStats.exactCount}
                  data-profile-link-quality={`${linkStats.exactCount}/${linkStats.linkedCount}`}
                  data-profile-link-hosts={productLinkHosts(products)}
                  data-profile-active-archive={activeArchiveTab}
                  data-profile-rendered-archive={isArchiveFallback ? 'inspo' : activeArchiveTab}
                  data-profile-transparent-only="true"
                  onClick={() => setActivePost(post)}
                  className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[.045] text-left shadow-[0_18px_44px_rgba(0,0,0,.28)] transition active:scale-[0.98] hover:border-accent/35"
                  aria-label={`Open ${post.title} with ${linkStats.exactCount} exact product links out of ${linkStats.linkedCount} linked pieces`}
                >
                  <div className="m-2 h-[216px]">
                    {archiveImageReady || index < 2 ? (
                      <OutfitLookCard
                        items={products}
                        title={post.title}
                        subtitle={post.formulaLabel || post.vibe}
                        compact
                        presentation="stacked"
                        loading={index < 2 ? 'eager' : 'lazy'}
                        className="h-full"
                        onImageUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                      />
                    ) : (
                      <div className="h-full rounded-[28px] border border-white/8 bg-[linear-gradient(120deg,rgba(255,255,255,.07),rgba(255,255,255,.025),rgba(246,48,107,.08))] opacity-80" />
                    )}
                  </div>
                  <div className="px-3 pb-3">
                    <h3 className="line-clamp-1 text-[15px] font-black tracking-[-.02em] text-white">{post.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-white/58">
                      <span>{post.vibe}</span>
                      <span>{formatPrice(post.totalCents)}</span>
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] text-emerald-200"
                        aria-label={`${linkStats.exactCount} exact product pages out of ${linkStats.linkedCount} linked pieces`}
                        data-profile-link-quality-badge={`${linkStats.exactCount}/${linkStats.linkedCount}`}
                      >
                        <ShoppingBag size={9} />
                        {linkStats.exactCount}/{linkStats.linkedCount}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMoreArchivePosts ? (
            <button
              type="button"
              onClick={() => setVisibleArchiveCount((count) => count + PROFILE_ARCHIVE_INCREMENT)}
              className="mt-4 w-full rounded-full border border-white/10 bg-white/[.055] px-4 py-3 text-[13px] font-black uppercase tracking-[.16em] text-white/78 transition active:scale-[0.98] hover:border-accent/40"
            >
              Load more looks
            </button>
          ) : null}
        </section>

        <section className="mx-4 mt-5 rounded-[28px] border border-white/10 bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/10 text-accent">
              <WandSparkles size={17} />
            </div>
            <div>
              <h2 className="font-serif text-[20px] font-semibold text-ink">Style DNA insights</h2>
              <p className="mt-1 text-[12px] text-muted-2">
                Computed from your real saved fits + closet — no fake stats.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-accent/30 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.18),transparent_44%),rgba(246,48,107,.08)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[.18em] text-accent">Style archetype</div>
                <div className="mt-1 font-serif text-[27px] font-semibold leading-tight text-ink">{styleDna.archetype}</div>
              </div>
              <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
                <WandSparkles size={19} />
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-2">
              {styleDna.archetype === 'Building Your Style DNA'
                ? `Sylistly has ${styleDna.totalPiecesObserved} real style signal${styleDna.totalPiecesObserved === 1 ? '' : 's'}. Add more saved fits and wardrobe pieces before assigning a stronger archetype.`
                : `Assigned from ${styleDna.totalPiecesObserved} real signals. Strongest cues: ${[
                    styleDna.topVibe,
                    styleDna.topCategories[0],
                    styleDna.topBrands[0],
                  ].filter(Boolean).join(', ') || 'saved fits, wardrobe, feed likes, and preferences'}.`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DnaStat label="Top formula/vibe" value={styleDna.totalPiecesObserved > 0 ? (styleDna.topFormula || styleDna.topVibe || 'Not enough data') : 'Not enough data'} />
            <DnaStat label="Top category" value={styleDna.topCategories[0] || 'Not enough data'} />
            <DnaStat label="Top brand" value={styleDna.topBrands[0] || 'Not enough data'} />
            <DnaStat label="Average price" value={styleDna.averagePriceCents > 0 ? formatPrice(styleDna.averagePriceCents) : 'Not enough data'} />
            <DnaStat label="Budget tendency" value={styleDna.budgetTier || profile.stylePrefs.budget || 'Not enough data'} accent />
          </div>

          <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Progress checklist</div>
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-2">{completedProgress}/{progressChecklist.length}</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-accent shadow-pink-glow" style={{ width: `${Math.max(6, progressPercent)}%` }} />
            </div>
            <div className="mt-3 space-y-2">
              {progressChecklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-[16px] border border-white/8 bg-white/[0.035] p-3">
                  <CheckCircle2 size={16} className={item.complete ? 'mt-0.5 flex-none text-accent' : 'mt-0.5 flex-none text-muted'} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-ink">{item.label}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-muted-2">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-accent/25 bg-accent/10 p-4">
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Improve recommendations</div>
            <div className="mt-3 grid gap-2">
              <RecommendationLink href="/saved" label="Save 3 fits" complete={savedFits.length >= 3} />
              <RecommendationLink href="/wardrobe" label="Add 5 closet items" complete={wardrobeItems.length >= 5} />
              <RecommendationLink href="/wardrobe" label="Add shoes" complete={wardrobeItems.some((entry) => entry.product.category === 'shoes')} />
              <RecommendationLink href="/stylist" label="Try Stylist" complete={currentBuildCount > 0 || savedFits.length > 0} />
              <RecommendationLink href="/canvas" label="Create Canvas card" complete={currentBuildCount > 0 || savedFits.length > 0} />
            </div>
          </div>

          <div id="style-dna" className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-accent">
              <Pencil size={11} />
              Edit your preferences
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {BUDGETS.map((budget) => (
              <button
                key={budget}
                type="button"
                onClick={() => setBudget(budget)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] ${
                  profile.stylePrefs.budget === budget
                    ? 'border-accent bg-accent text-white'
                    : 'border-hairline bg-surface-2 text-muted-2'
                }`}
              >
                {budget}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {BODY_TYPES.map((bodyType) => (
              <button
                key={bodyType}
                type="button"
                onClick={() => setBodyType(bodyType)}
                className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[.14em] ${
                  profile.bodyType === bodyType
                    ? 'border-accent bg-accent text-white'
                    : 'border-hairline bg-surface-2 text-muted-2'
                }`}
              >
                {BODY_TYPE_LABELS[bodyType]}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`Select skin tone ${tone}`}
                onClick={() => setSkinTone(tone)}
                className={`h-9 w-9 rounded-full border-2 transition ${profile.skinTone === tone ? 'scale-105 border-white' : 'border-transparent'}`}
                style={{ backgroundColor: tone }}
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <label className="text-[11px] text-muted-2">
              Top
              <input value={profile.sizes.top || ''} onChange={(event) => setTopSize(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="M" />
            </label>
            <label className="text-[11px] text-muted-2">
              Waist
              <input value={profile.sizes.bottom?.waist?.toString() || ''} onChange={(event) => setBottomSize(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="30" />
            </label>
            <label className="text-[11px] text-muted-2">
              Shoe
              <input value={profile.sizes.shoe || ''} onChange={(event) => setShoeSize(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="9" />
            </label>
          </div>

          <label className="mt-4 block text-[11px] text-muted-2">
            Vibes
            <input value={(profile.stylePrefs.vibes || []).join(', ')} onChange={(event) => setVibesFromText(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="clean girl, streetwear, date night" />
          </label>
          <label className="mt-3 block text-[11px] text-muted-2">
            Favorite brands
            <input value={(profile.stylePrefs.brands || []).join(', ')} onChange={(event) => setBrandsFromText(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="Skims, Nike, Zara" />
          </label>
        </section>
      </div>

      <BottomNav />

      <FitViewer
        post={resolvedActivePost}
        products={activePostProducts}
        relatedPosts={activeRelatedPosts}
        source="profile"
        onClose={() => setActivePost(null)}
        onLike={(post) => toggleLike(post.id)}
        onSave={(post) => toggleSave(post.id)}
        onRemix={(post) => {
          setActivePost(null);
          remix(post);
        }}
        onShop={(post, product) => {
          setActivePost(null);
          shop(post, product);
        }}
        onBuildAroundHero={(post) => {
          setActivePost(null);
          buildAroundHero(post);
        }}
        onOpenEditor={(post) => {
          setActivePost(null);
          openEditor(post);
        }}
        onJumpToPost={(postId) => {
          const nextPost = profileViewerPosts.find((post) => post.id === postId) ?? null;
          setActivePost(nextPost);
        }}
        onImageUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
      />

      <CheckoutSheet open={Boolean(checkoutProducts)} title={checkoutTitle} products={checkoutProducts || []} onClose={() => setCheckoutProducts(null)} />
    </main>
  );
}

function SocialStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="text-[20px] font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[13px] font-semibold leading-none text-white/48">{label}</div>
    </div>
  );
}

function PulseMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[17px] font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[8px] font-black uppercase tracking-[.16em] text-white/42">{label}</div>
    </div>
  );
}

function DnaStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-[16px] border p-2.5 ${accent ? 'border-accent/30 bg-accent/10' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className={`text-[8px] font-bold uppercase tracking-[.16em] ${accent ? 'text-accent' : 'text-muted'}`}>{label}</div>
      <div className={`mt-1 line-clamp-2 text-[12px] font-semibold ${accent ? 'text-white' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

function RecommendationLink({
  href,
  label,
  complete,
}: {
  href: string;
  label: string;
  complete: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-black/18 px-3 py-2.5 transition active:scale-[0.98] hover:border-accent/45"
    >
      <span className="text-[12px] font-semibold text-ink">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[.14em] ${
        complete ? 'bg-accent text-white shadow-pink-glow' : 'border border-white/10 bg-white/[0.04] text-muted'
      }`}>
        {complete ? 'Done' : 'Open'}
      </span>
    </Link>
  );
}
