'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bookmark,
  ChevronRight,
  Check,
  Crown,
  Flame,
  Heart,
  Images,
  Layers,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits, type SavedFitRecord } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function fitCoverProduct(fit: SavedFitRecord): Product | null {
  const items = fit.items;
  return items.outer || items.top || items.bottom || items.shoes || Object.values(items).find(Boolean) || null;
}

function itemsFromProduct(product: Product): Partial<Record<Category, Product>> {
  return { [product.category]: product } as Partial<Record<Category, Product>>;
}

export default function HomePage() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => setHasMounted(true), []);

  const savedFits = useSavedFits((state) => state.fits);
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const addToCloset = useWardrobe((state) => state.addToCloset);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const feedPosts = useSocialFeed((state) => state.posts);
  const currentFitItems = useFit((state) => state.items);
  const replaceItems = useFit((state) => state.replaceItems);

  // Counts derive from real state — never seeded, never inflated.
  const savedCount = hasMounted ? savedFits.length : 0;
  const closetCount = hasMounted ? wardrobeItems.filter((entry) => entry.status === 'closet').length : 0;
  const wishlistCount = hasMounted ? wardrobeItems.filter((entry) => entry.status === 'wishlist').length : 0;
  const likedFeedCount = hasMounted ? feedPosts.filter((post) => post.liked).length : 0;
  const currentFitCount = hasMounted
    ? Object.values(currentFitItems).filter(Boolean).length
    : 0;
  const requiredClosetMissing = useMemo(() => {
    if (!hasMounted) return [];
    const closetCategories = new Set(
      wardrobeItems
        .filter((entry) => entry.status === 'closet')
        .map((entry) => entry.product.category),
    );
    return (['top', 'bottom', 'shoes'] as Category[]).filter((category) => !closetCategories.has(category));
  }, [wardrobeItems, hasMounted]);

  const recentSavedFits = hasMounted ? savedFits.slice(0, 6) : [];
  const recentWardrobe = useMemo(
    () => (hasMounted ? wardrobeItems.slice(0, 6) : []),
    [wardrobeItems, hasMounted],
  );
  const nextBestAction = useMemo(() => {
    if (!hasMounted) {
      return {
        eyebrow: 'Next',
        title: 'Loading your style OS',
        body: 'Reading local saved fits, wardrobe, wishlist, and builder state.',
        cta: 'Open Builder',
        href: '/build',
        disabled: true,
      };
    }
    if (savedCount === 0) {
      return {
        eyebrow: 'Save',
        title: 'Save your first fit',
        body: currentFitCount > 0 ? `${currentFitCount} builder pieces are ready to refine or save.` : 'Build a complete outfit, then save it for remixing.',
        cta: 'Open Builder',
        href: '/build',
      };
    }
    if (closetCount === 0) {
      return {
        eyebrow: 'Wardrobe',
        title: 'Start your wardrobe',
        body: 'Add real catalog pieces to unlock closet gaps and better local styling context.',
        cta: 'Open Wardrobe',
        href: '/wardrobe',
      };
    }
    if (currentFitCount > 0) {
      return {
        eyebrow: 'Builder',
        title: 'Continue your build',
        body: `${currentFitCount} piece${currentFitCount === 1 ? '' : 's'} are in Builder. Refine, save, or shop the look.`,
        cta: 'Finish fit',
        href: '/build',
      };
    }
    if (requiredClosetMissing.length > 0) {
      return {
        eyebrow: 'Closet gap',
        title: 'Complete your closet',
        body: `Missing ${requiredClosetMissing.join(', ')} from the required top-bottom-shoes base.`,
        cta: 'See gaps',
        href: '/wardrobe',
      };
    }
    return {
      eyebrow: 'Remix',
      title: 'Remix a saved fit',
      body: `${savedCount} saved fit${savedCount === 1 ? '' : 's'} can be loaded back into Builder.`,
      cta: 'Open Saved',
      href: '/saved',
    };
  }, [closetCount, currentFitCount, hasMounted, requiredClosetMissing, savedCount]);

  const recentActivity = useMemo(() => {
    if (!hasMounted) return [];
    return [
      ...savedFits.map((fit) => ({
        id: `saved-${fit.id}`,
        eyebrow: 'Saved fit',
        title: fit.title,
        meta: `${fit.itemCount} pieces · ${formatPrice(fit.totalCents)}`,
        createdAt: fit.createdAt,
        href: '/saved',
      })),
      ...wardrobeItems.map((item) => ({
        id: `wardrobe-${item.id}`,
        eyebrow: item.status === 'closet' ? 'Closet add' : 'Wishlist add',
        title: `${item.product.brand} ${item.product.name}`,
        meta: `${item.product.category} · ${formatPrice(item.product.priceCents)}`,
        createdAt: item.addedAt,
        href: '/wardrobe',
      })),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 6);
  }, [hasMounted, savedFits, wardrobeItems]);

  // "Basics" suggestions come from the feed posts the user has already
  // generated/loaded — that's our real catalog footprint. We surface the
  // highest-coverage essentials (top / bottom / shoes) the user hasn't
  // already added to their closet. No fake "you might need" copy.
  const basicSuggestions = useMemo<Product[]>(() => {
    if (!hasMounted) return [];
    const closetProductIds = new Set(
      wardrobeItems.filter((entry) => entry.status === 'closet').map((entry) => entry.productId),
    );
    const targetCategories: Category[] = ['top', 'bottom', 'shoes'];
    const seenIds = new Set<string>();
    const suggestions: Product[] = [];
    for (const post of feedPosts) {
      for (const category of targetCategories) {
        const product = post.items[category];
        if (!product) continue;
        if (closetProductIds.has(product.id)) continue;
        if (seenIds.has(product.id)) continue;
        seenIds.add(product.id);
        suggestions.push(product);
        if (suggestions.length >= 6) return suggestions;
      }
    }
    return suggestions;
  }, [feedPosts, wardrobeItems, hasMounted]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function buildAround(product: Product) {
    replaceItems(itemsFromProduct(product));
    router.push(`/build?lock=${encodeURIComponent(product.category)}`);
  }

  function shopProduct(product: Product) {
    const url = getProductOutboundUrl(product);
    if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <header className="border-b border-hairline px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[.24em] text-accent">Sylistly</div>
            <h1 className="mt-0.5 font-serif text-[26px] font-semibold leading-tight text-ink">Home</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative grid h-9 w-9 cursor-not-allowed place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/45 opacity-75"
              aria-label="Search coming later"
              title="Search coming later"
              disabled
            >
              <Search size={16} />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 py-0.5 text-[6px] font-black uppercase tracking-[.08em] text-black">
                Soon
              </span>
            </button>
            <button
              type="button"
              className="relative grid h-9 w-9 cursor-not-allowed place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/45 opacity-75"
              aria-label="Notifications coming later"
              title="Notifications coming later"
              disabled
            >
              <Bell size={16} />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 py-0.5 text-[6px] font-black uppercase tracking-[.08em] text-black">
                Soon
              </span>
            </button>
            <button
              type="button"
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-accent/25 bg-accent/8 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-accent/70 opacity-80"
              aria-label="Pro coming later"
              title="Pro coming later"
              disabled
            >
              <Crown size={11} />
              Pro soon
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Launch hero */}
        <section className="px-4 pt-4">
          <div className="sy-card-strong sy-enter rounded-[30px] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="sy-eyebrow">AI fashion OS</div>
                <h2 className="mt-2 font-serif text-[32px] font-semibold leading-[.95] text-ink">
                  Your AI stylist is ready.
                </h2>
                <p className="mt-3 text-[12px] leading-relaxed text-muted-2">
                  Sylistly connects Builder, Feed, Saved fits, Wardrobe, Discover, Syli, and Canvas using your real local style data.
                </p>
              </div>
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
                <Wand2 size={21} />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <HeroMetric label="Saved" value={savedCount} />
              <HeroMetric label="Closet" value={closetCount} />
              <HeroMetric label="Wish" value={wishlistCount} />
              <HeroMetric label="Build" value={currentFitCount} />
            </div>

            <div className="mt-4 grid grid-cols-[1.15fr_.85fr] gap-2">
              <Link
                href="/build"
                className="sy-cta-primary px-4 py-3 text-[11px] font-black uppercase tracking-[.14em]"
              >
                <Sparkles size={13} />
                Build a fit
              </Link>
              <Link
                href="/stylist"
                className="sy-cta-secondary px-4 py-3 text-[11px] font-black uppercase tracking-[.14em]"
              >
                Open Syli
              </Link>
            </div>

            <Link
              href="/canvas"
              className="mt-2 flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.045] px-3 py-2.5 text-left transition active:scale-[0.98] hover:border-accent/45"
            >
              <span>
                <span className="block text-[8px] font-black uppercase tracking-[.18em] text-accent">Canvas / Try-On</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-2">
                  Share card is local. AI try-on is clearly marked as future backend.
                </span>
              </span>
              <ChevronRight size={14} className="text-accent" />
            </Link>
          </div>
        </section>

        {/* Quick profile row */}
        <section className="px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <QuickStat label="Your style" hint="Open feed" href="/feed" icon={Flame} count={likedFeedCount} unit="liked" />
            <QuickStat label="Saved" hint="Open saved fits" href="/saved" icon={Bookmark} count={savedCount} unit="fits" />
            <QuickStat label="Closet" hint="Open wardrobe" href="/wardrobe" icon={Layers} count={closetCount} unit="pieces" />
            <QuickStat label="Wishlist" hint="Open wishlist" href="/wardrobe" icon={Heart} count={wishlistCount} unit="pieces" />
            <QuickStat label="AI Stylist" hint="Open Syli" href="/stylist" icon={Wand2} count={currentFitCount} unit="build" />
          </div>
        </section>

        {/* Next best action */}
        <section className="mt-5 px-4">
          <button
            type="button"
            disabled={nextBestAction.disabled}
            onClick={() => router.push(nextBestAction.href)}
            className="group w-full rounded-[26px] border border-accent/30 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.22),transparent_38%),linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03))] p-4 text-left shadow-[0_22px_54px_rgba(0,0,0,.34)] transition active:scale-[0.98] hover:border-accent/60 motion-safe:transition-all motion-safe:duration-200 disabled:opacity-65 disabled:active:scale-100"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[.22em] text-accent">{nextBestAction.eyebrow}</div>
                <div className="mt-1 font-serif text-[21px] font-semibold leading-tight text-ink">{nextBestAction.title}</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white shadow-pink-glow transition group-hover:scale-105">
                <Sparkles size={17} />
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-2">{nextBestAction.body}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-black">
              {nextBestAction.cta}
              <ChevronRight size={11} />
            </span>
          </button>
        </section>

        {/* AI Stylist cards */}
        <section className="mt-6 px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">AI stylist</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">What do you want to do?</div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-muted">Beta</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StylistCard
              icon={Sparkles}
              eyebrow="Make"
              title="Make an outfit"
              body="Generate a full fit for any vibe."
              onClick={() => router.push('/build')}
            />
            <StylistCard
              icon={Layers}
              eyebrow="Build"
              title="Build from your closet"
              body={closetCount > 0 ? `${closetCount} pieces ready` : 'Open Wardrobe to add your first pieces.'}
              onClick={() => router.push('/wardrobe')}
            />
            <StylistCard
              icon={Wand2}
              eyebrow="Insight"
              title="Ask Syli"
              body={
                currentFitCount > 0
                  ? `${currentFitCount} pieces in Builder. Syli can rate it.`
                  : 'Local chat can guide your next real action.'
              }
              onClick={() => router.push('/stylist')}
            />
            <StylistCard
              icon={Images}
              eyebrow="Canvas"
              title="Create a share card"
              body={
                savedCount > 0 || currentFitCount > 0
                  ? 'Turn a real outfit into a share-ready board.'
                  : 'Canvas opens with a clear build-first empty state.'
              }
              onClick={() => router.push('/canvas')}
            />
          </div>
        </section>

        {/* Shortcuts */}
        <section className="mt-6 px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Shortcuts</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Jump in</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <ShortcutTile label="Feed" href="/feed" icon={Flame} />
            <ShortcutTile label="Build" href="/build" icon={Sparkles} />
            <ShortcutTile label="Closet" href="/wardrobe" icon={Layers} />
            <ShortcutTile label="Saved" href="/saved" icon={Bookmark} />
            <ShortcutTile label="Discover" href="/discover" icon={Heart} />
            <ShortcutTile label="Profile" href="/profile" icon={Wand2} />
            <ShortcutTile label="Try On" href="/canvas" icon={Sparkles} />
            <ShortcutTile label="Stylist" href="/stylist" icon={Wand2} />
          </div>
        </section>

        {/* Recent outfits */}
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between px-4">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Recent</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Saved outfits</div>
            </div>
            {recentSavedFits.length > 0 ? (
              <Link href="/saved" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.14em] text-accent">
                See all <ChevronRight size={11} />
              </Link>
            ) : null}
          </div>
          {recentSavedFits.length === 0 ? (
            <div className="mx-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[12px] leading-relaxed text-muted-2">
                No saved fits yet. Save looks from{' '}
                <Link href="/feed" className="text-accent underline decoration-accent decoration-[1.5px] underline-offset-2">/feed</Link>{' '}
                or build one in{' '}
                <Link href="/build" className="text-accent underline decoration-accent decoration-[1.5px] underline-offset-2">/build</Link>.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {recentSavedFits.map((fit) => {
                const cover = fitCoverProduct(fit);
                return (
                  <Link
                    key={fit.id}
                    href="/saved"
                    className="group relative h-[160px] w-[124px] flex-none overflow-hidden rounded-[20px] border border-white/12 bg-[#fff7ef] shadow-[0_14px_30px_rgba(0,0,0,.32)] transition active:scale-95 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_20px_38px_rgba(246,48,107,.4)] motion-safe:transition-all motion-safe:duration-200"
                  >
                    {cover ? (
                      <ProductImage
                        product={cover}
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-3"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-white/[0.04] text-[10px] text-muted">No cover</div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,.78)_100%)]" />
                    <div className="pointer-events-none absolute inset-x-2 bottom-1.5 truncate text-[9px] font-bold uppercase tracking-[.14em] text-white">
                      {formatPrice(fit.totalCents)} · {fit.itemCount}p
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recently added wardrobe */}
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between px-4">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Recently added</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Your closet</div>
            </div>
            <Link href="/wardrobe" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.14em] text-accent">
              Open closet <ChevronRight size={11} />
            </Link>
          </div>
          {recentWardrobe.length === 0 ? (
            <div className="mx-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[12px] leading-relaxed text-muted-2">
                Closet&apos;s empty.{' '}
                <Link href="/feed" className="text-accent underline decoration-accent decoration-[1.5px] underline-offset-2">Browse the feed</Link>{' '}
                or{' '}
                <Link href="/build" className="text-accent underline decoration-accent decoration-[1.5px] underline-offset-2">build a fit</Link>{' '}
                and tap the wardrobe action.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {recentWardrobe.map((item) => (
                <Link
                  key={item.id}
                  href="/wardrobe"
                  className="group relative h-[110px] w-[94px] flex-none overflow-hidden rounded-[18px] border border-white/12 bg-[#fff7ef] shadow-[0_10px_22px_rgba(0,0,0,.28)] transition active:scale-95 hover:-translate-y-1 hover:border-accent/60 motion-safe:transition-all motion-safe:duration-200"
                >
                  <ProductImage
                    product={item.product}
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-contain p-2"
                  />
                  {item.status === 'wishlist' ? (
                    <div className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow">
                      Wish
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Catalog spotlight */}
        <section className="mt-6 pb-6">
          <div className="mb-2 flex items-center justify-between px-4">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Catalog spotlight</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Real pieces to act on</div>
            </div>
          </div>
          {basicSuggestions.length === 0 ? (
            <div className="mx-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[12px] leading-relaxed text-muted-2">
                Suggestions appear once the feed loads catalog products.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {basicSuggestions.map((product) => (
                <article
                  key={`basic-${product.id}`}
                  className="group w-[136px] flex-none overflow-hidden rounded-[20px] border border-white/12 bg-white/[0.055] shadow-[0_12px_28px_rgba(0,0,0,.28)] transition active:scale-95 hover:-translate-y-1 hover:border-accent/60 motion-safe:transition-all motion-safe:duration-200"
                >
                  <button
                    type="button"
                    onClick={() => buildAround(product)}
                    className="block w-full text-left"
                    aria-label={`Build around ${product.name}`}
                  >
                    <div className="relative h-[128px] bg-[#fff7ef]">
                      <ProductImage
                        product={product}
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-2.5"
                      />
                      <div className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.12em] text-white backdrop-blur-md">
                        {product.category}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="truncate text-[8px] font-black uppercase tracking-[.14em] text-accent">{product.brand}</div>
                      <div className="mt-1 line-clamp-2 min-h-[30px] text-[11px] font-semibold leading-tight text-ink">{product.name}</div>
                      <div className="mt-1 text-[10px] font-bold text-white">{formatPrice(product.priceCents)}</div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        addToWishlist(product, 'catalog');
                        showToast('Added to wishlist');
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[8px] font-bold uppercase tracking-[.1em] text-white transition active:scale-95"
                    >
                      Wish
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        addToCloset(product, 'catalog');
                        showToast('Added to closet');
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[8px] font-bold uppercase tracking-[.1em] text-white transition active:scale-95"
                    >
                      Closet
                    </button>
                    <button
                      type="button"
                      onClick={() => buildAround(product)}
                      className="rounded-full bg-accent px-2 py-1.5 text-[8px] font-bold uppercase tracking-[.1em] text-white shadow-pink-glow transition active:scale-95"
                    >
                      Build
                    </button>
                    <button
                      type="button"
                      onClick={() => shopProduct(product)}
                      className="rounded-full bg-white px-2 py-1.5 text-[8px] font-bold uppercase tracking-[.1em] text-black transition active:scale-95"
                    >
                      Shop
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="mt-2 px-4 pb-6">
          <div className="mb-2">
            <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Activity</div>
            <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Recent local actions</div>
          </div>
          {recentActivity.length === 0 ? (
            <HomeOnboardingEmpty />
          ) : (
            <div className="relative space-y-2 pl-4 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-white/10">
              {recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  href={activity.href}
                  className="sy-lift sy-press relative flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3 transition hover:border-accent/50 motion-safe:transition-all motion-safe:duration-200"
                >
                  <span className="absolute -left-[18px] top-1/2 grid h-3.5 w-3.5 -translate-y-1/2 place-items-center rounded-full border border-accent bg-bg">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent/14 text-accent">
                    <Check size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[8px] font-black uppercase tracking-[.18em] text-accent">{activity.eyebrow}</span>
                    <span className="mt-0.5 block truncate text-[12px] font-semibold text-ink">{activity.title}</span>
                    <span className="mt-0.5 block text-[10px] text-muted">{activity.meta}</span>
                  </span>
                  <ChevronRight size={13} className="text-muted" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Share your style */}
        <section className="mt-2 px-4 pb-8">
          <div className="rounded-[24px] border-2 border-accent/30 bg-[radial-gradient(circle_at_18%_15%,rgba(246,48,107,.18),transparent_50%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))] p-5 shadow-[0_24px_56px_rgba(246,48,107,.2)]">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                <Wand2 size={17} />
              </span>
              <div className="flex-1">
                <div className="text-[9px] font-black uppercase tracking-[.22em] text-accent">Share your style</div>
                <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Make a share card</div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
                  Generate a polished card from your current or latest saved fit. Local-only for now, no fake cloud generation.
                </p>
                <button
                  type="button"
                  disabled={savedCount === 0 && currentFitCount === 0}
                  onClick={() => router.push('/canvas')}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 disabled:opacity-50 disabled:active:scale-100"
                >
                  <Plus size={11} />
                  {savedCount > 0 || currentFitCount > 0 ? 'Open Canvas' : 'Save a fit first'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {toast ? (
        <div className="fixed inset-x-0 bottom-[86px] z-[70] mx-auto flex max-w-[480px] justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-accent/35 bg-[#15110f]/95 px-4 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow-[0_14px_42px_rgba(246,48,107,.35)] backdrop-blur-md">
            <ShoppingBag size={13} className="text-accent" />
            {toast}
          </div>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2.5 text-center">
      <div className="font-serif text-[20px] font-semibold leading-none text-ink">{value}</div>
      <div className="mt-1 text-[8px] font-black uppercase tracking-[.16em] text-muted">{label}</div>
    </div>
  );
}

function HomeOnboardingEmpty() {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent/14 text-accent">
          <Sparkles size={16} />
        </span>
        <div>
          <div className="font-serif text-[18px] font-semibold leading-tight text-ink">Start your local style graph</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
            Build a fit, save it, then add pieces to Wardrobe. Home will turn those real actions into your timeline.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Link href="/build" className="sy-cta-primary px-3 py-2.5 text-[9px] font-black uppercase tracking-[.12em]">
          Build
        </Link>
        <Link href="/feed" className="sy-cta-secondary px-3 py-2.5 text-[9px] font-black uppercase tracking-[.12em]">
          Feed
        </Link>
        <Link href="/wardrobe" className="sy-cta-secondary px-3 py-2.5 text-[9px] font-black uppercase tracking-[.12em]">
          Closet
        </Link>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  hint,
  href,
  icon: Icon,
  count,
  unit,
  disabled = false,
}: {
  label: string;
  hint: string;
  href?: string;
  icon: typeof Flame;
  count: number;
  unit: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={`flex h-[88px] w-[88px] flex-none flex-col items-center justify-center gap-1 rounded-[20px] border-2 px-2 transition active:scale-[0.96] motion-safe:transition-transform motion-safe:duration-150 ${
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-55'
          : 'border-white/12 bg-white/[0.05] hover:border-accent/55 hover:bg-white/[0.08]'
      }`}
    >
      <Icon size={18} className={disabled ? 'text-muted' : 'text-accent'} />
      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-white/85">{label}</div>
      <div className="text-[9px] uppercase tracking-[.14em] text-muted">{count} {unit}</div>
    </div>
  );
  if (disabled || !href) {
    return (
      <div title={hint} aria-disabled="true">
        {content}
      </div>
    );
  }
  return (
    <Link href={href} title={hint}>
      {content}
    </Link>
  );
}

function StylistCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  onClick,
  disabled = false,
}: {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  body: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col gap-2 rounded-[20px] border-2 p-3 text-left transition active:scale-[0.97] motion-safe:transition-all motion-safe:duration-200 ${
        disabled
          ? 'cursor-not-allowed border-white/8 bg-white/[0.03] opacity-65'
          : 'border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] shadow-[0_14px_30px_rgba(0,0,0,.2)] hover:border-accent/55 hover:bg-[linear-gradient(135deg,rgba(246,48,107,.18),rgba(246,48,107,.04))] hover:shadow-[0_20px_38px_rgba(246,48,107,.25)]'
      }`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-full transition ${
          disabled ? 'bg-white/8 text-muted' : 'bg-accent/18 text-accent'
        }`}
      >
        <Icon size={14} />
      </span>
      <div className="text-[8px] font-black uppercase tracking-[.22em] text-accent">{eyebrow}</div>
      <div className="font-serif text-[15px] font-semibold leading-tight text-ink">{title}</div>
      <div className="text-[11px] leading-relaxed text-muted-2">{body}</div>
    </button>
  );
}

function ShortcutTile({
  label,
  href,
  icon: Icon,
  disabled = false,
}: {
  label: string;
  href?: string;
  icon?: typeof Flame;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={`flex h-[68px] flex-col items-center justify-center gap-1 rounded-[16px] border transition active:scale-[0.96] motion-safe:transition-transform motion-safe:duration-150 ${
        disabled
          ? 'cursor-not-allowed border-white/8 bg-white/[0.03] opacity-55'
          : 'border-white/12 bg-white/[0.05] hover:border-accent/55'
      }`}
    >
      {Icon ? <Icon size={15} className={disabled ? 'text-muted' : 'text-accent'} /> : <Plus size={14} className="text-muted" />}
      <div className="text-[9px] font-bold uppercase tracking-[.12em] text-white/85">{label}</div>
    </div>
  );
  if (disabled || !href) return <div aria-disabled="true">{content}</div>;
  return <Link href={href}>{content}</Link>;
}
