'use client';

import Link from 'next/link';
import { Bookmark, CheckCircle2, Grid3X3, Heart, Layers, MessageCircle, Palette, Pencil, RotateCcw, Ruler, ShoppingBag, Sparkles, WandSparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedPost, useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

const SKIN_TONES = ['#f5d0b5', '#ddb192', '#c9a98a', '#a47757', '#7d553e', '#4b3025'];
const BODY_TYPES = ['masc', 'fem', 'androgynous', 'custom'] as const;
const BUDGETS = ['low', 'mid', 'high', 'luxury'] as const;
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
  return Object.values(post.items).filter(
    (product): product is Product =>
      isHighConfidenceRenderableProduct(product) && !failedImageIds.has(product.id),
  );
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
  const savedCount = useSavedFits((state) => state.fits.length);
  const savedFits = useSavedFits((state) => state.fits);
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const posts = useSocialFeed((state) => state.posts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const toggleSave = useSocialFeed((state) => state.toggleSave);
  const replaceItems = useFit((state) => state.replaceItems);
  const currentFitItems = useFit((state) => state.items);
  const router = useRouter();
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Style profile');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  const userPosts = useMemo(
    () => posts.filter((post) => post.username === '@you' && postProducts(post, failedImageIds).length >= 3),
    [posts, failedImageIds],
  );
  const gridPosts = userPosts.length
    ? userPosts
    : posts.filter((post) => postProducts(post, failedImageIds).length >= 3).slice(0, 8);
  const likedCount = posts.filter((post) => post.liked).length;
  const closetCount = wardrobeItems.filter((entry) => entry.status === 'closet').length;
  const wishlistCount = wardrobeItems.filter((entry) => entry.status === 'wishlist').length;
  const currentBuildCount = Object.values(currentFitItems).filter(Boolean).length;

  // Style DNA — derived from REAL saved fits + wardrobe. No invented
  // stats. If the user hasn't saved anything, the panel says so rather
  // than fabricating "top vibe: streetwear".
  const styleDna = useMemo(() => {
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
  }, [posts, profile.stylePrefs.brands, profile.stylePrefs.vibes, savedFits, wardrobeItems]);

  const progressChecklist = useMemo(() => {
    const hasShoes = wardrobeItems.some((entry) => entry.product.category === 'shoes');
    const hasFavoriteVibes = Boolean(profile.stylePrefs.vibes?.length);
    return [
      { label: 'Save 3 fits', complete: savedFits.length >= 3, detail: `${Math.min(savedFits.length, 3)}/3 saved` },
      { label: 'Add 5 wardrobe items', complete: wardrobeItems.length >= 5, detail: `${Math.min(wardrobeItems.length, 5)}/5 added` },
      { label: 'Add shoes', complete: hasShoes, detail: hasShoes ? 'Shoe slot covered' : 'No shoes in wardrobe yet' },
      { label: 'Use a build', complete: currentBuildCount > 0 || savedFits.length > 0, detail: currentBuildCount > 0 ? `${currentBuildCount} builder pieces` : savedFits.length > 0 ? 'Saved fit detected' : 'No build detected' },
      { label: 'Choose favorite vibes', complete: hasFavoriteVibes, detail: hasFavoriteVibes ? (profile.stylePrefs.vibes || []).join(', ') : 'Add vibes below' },
    ];
  }, [currentBuildCount, profile.stylePrefs.vibes, savedFits.length, wardrobeItems]);
  const completedProgress = progressChecklist.filter((item) => item.complete).length;
  const progressPercent = Math.round((completedProgress / progressChecklist.length) * 100);

  function remix(post: FeedPost) {
    replaceItems(post.items);
    router.push('/build');
  }

  function shop(post: FeedPost) {
    const products = postProducts(post, failedImageIds)
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

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto px-4 pb-7 pt-10">
        <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(246,48,107,.16),transparent_32%),linear-gradient(180deg,#191513_0%,#0f0e0d_100%)] p-4 shadow-[0_28px_64px_rgba(0,0,0,.42)]">
          <div className="flex items-start gap-4">
            <div className="grid h-[82px] w-[82px] shrink-0 place-items-center rounded-[28px] border border-accent/35 bg-accent text-[32px] font-black text-white shadow-pink-glow">
              S
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h1 className="font-serif text-[28px] font-semibold leading-none text-ink">Style profile</h1>
                  <p className="mt-1 text-[12px] font-semibold text-muted-2">@you · local</p>
                </div>
                <a
                  href="#style-dna"
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-[10px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-[0.96] motion-safe:transition-transform motion-safe:duration-150"
                >
                  <Pencil size={12} />
                  Edit
                </a>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#cfc0b8]">
                Building swipeable fits around clean layers, sharp night pieces, and image-backed shopping picks.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[
              ['Saved', savedCount],
              ['Closet', closetCount],
              ['Wishlist', wishlistCount],
              ['Liked', likedCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-3 text-center">
                <div className="font-serif text-[20px] font-semibold text-ink">{value}</div>
                <div className="mt-1 text-[8px] uppercase tracking-[.15em] text-muted">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5">
            <Link
              href="/wardrobe"
              className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55"
            >
              Clothes
            </Link>
            <Link
              href="/saved"
              className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55"
            >
              Outfits
            </Link>
            <Link
              href="/wardrobe"
              className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55"
            >
              Collections
            </Link>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {[
              ['Clean', Sparkles],
              ['Streetwear', Grid3X3],
              ['Night Out', Heart],
              ['Saved', Bookmark],
              ['Remixes', RotateCcw],
            ].map(([label, Icon]) => {
              const IconComponent = Icon as typeof Sparkles;
              return (
                <div key={label as string} className="flex-none text-center">
                  <div className="grid h-[58px] w-[58px] place-items-center rounded-full border border-accent/25 bg-[#fff6eb] text-accent shadow-[0_12px_28px_rgba(0,0,0,.24)]">
                    <IconComponent size={17} />
                  </div>
                  <div className="mt-1 text-[9px] font-semibold text-muted-2">{label as string}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[.18em] text-accent">Posted fits</div>
              <h2 className="mt-1 font-serif text-[24px] font-semibold text-ink">Outfit grid</h2>
            </div>
            {!userPosts.length ? (
              <p className="max-w-[18ch] text-right text-[10px] leading-snug text-muted">Post from Builder to replace this inspo grid.</p>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {gridPosts.map((post) => {
              const products = postProducts(post, failedImageIds);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setActivePost(post)}
                  className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#151311] text-left shadow-[0_18px_38px_rgba(0,0,0,.32)]"
                >
                  <div className="m-2 grid h-[190px] grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px] border border-[#eadfd5] bg-[#fff7ef] p-1.5">
                    {products.slice(0, 5).map((product, index) => (
                      <div key={`${post.id}-${product.id}`} className={`overflow-hidden rounded-[12px] bg-white/80 ${index === 0 ? 'row-span-2' : ''}`}>
                        <ProductImage
                          product={product}
                          wrapperClassName="h-full w-full"
                          className="h-full w-full object-contain p-1.5"
                          onUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="px-3 pb-3">
                    <h3 className="line-clamp-1 font-serif text-[18px] font-semibold text-ink">{post.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                      <span>{post.vibe}</span>
                      <span>{formatPrice(post.totalCents)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-surface-1 p-4">
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
            <DnaStat label="Top formula/vibe" value={styleDna.topFormula || styleDna.topVibe || 'Not enough data'} />
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

      {activePost ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/70 backdrop-blur-sm">
          <button className="absolute inset-0" aria-label="Close post" onClick={() => setActivePost(null)} />
          <article className="relative z-10 max-h-[calc(100dvh-28px)] w-full overflow-y-auto rounded-t-[34px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-24px_70px_rgba(0,0,0,.55)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold text-muted-2">{activePost.username}</div>
                <h2 className="mt-1 font-serif text-[27px] font-semibold leading-tight text-ink">{activePost.title}</h2>
              </div>
              <button onClick={() => setActivePost(null)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-[28px] border border-[#eadfd5] bg-[#fff7ef] p-2">
              <div className="grid h-[360px] grid-cols-2 grid-rows-3 gap-2 overflow-hidden rounded-[22px] bg-[#fffaf5] p-2">
                {postProducts(activePost, failedImageIds).slice(0, 6).map((product, index) => (
                  <div key={`${activePost.id}-modal-${product.id}`} className={`overflow-hidden rounded-[16px] bg-white/80 ring-1 ring-[#eadfd5] ${index === 0 ? 'row-span-2' : ''}`}>
                    <ProductImage
                      product={product}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-contain p-2"
                      onUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-muted-2">
              {activePost.vibe} outfit built from image-backed pieces. Remix it in Builder, lock your favorite items, then keep swiping variations.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activePost.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-muted-2">{tag}</span>
              ))}
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-muted-2">{formatPrice(activePost.totalCents)}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => toggleLike(activePost.id)} className={`inline-flex items-center justify-center gap-1 rounded-full border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] ${activePost.liked ? 'border-accent bg-accent text-white' : 'border-white/10 bg-white/[0.04] text-muted-2'}`}>
                <Heart size={13} fill={activePost.liked ? 'currentColor' : 'none'} />
                {activePost.likeCount}
              </button>
              <button className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2">
                <MessageCircle size={13} />
                {activePost.comments.length}
              </button>
              <button onClick={() => toggleSave(activePost.id)} className={`inline-flex items-center justify-center gap-1 rounded-full border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] ${activePost.saved ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 bg-white/[0.04] text-muted-2'}`}>
                <Bookmark size={13} fill={activePost.saved ? 'currentColor' : 'none'} />
                Save
              </button>
            </div>
            <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-2">
              <button onClick={() => remix(activePost)} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow">
                <RotateCcw size={13} />
                Remix
              </button>
              <button onClick={() => shop(activePost)} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2">
                <ShoppingBag size={13} />
                Shop fit
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <CheckoutSheet open={Boolean(checkoutProducts)} title={checkoutTitle} products={checkoutProducts || []} onClose={() => setCheckoutProducts(null)} />
    </main>
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
