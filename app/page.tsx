'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  ExternalLink,
  Flame,
  Heart,
  ShoppingBag,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { isExactProductUrl } from '@/lib/checkout';
import { hasExactProductLink, isEditorialCutoutProduct } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { getStylistCatalogProducts, getStylistStarterProducts } from '@/lib/client-catalog';
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
  return [items.outer, items.top, items.bottom, items.shoes, ...Object.values(items)]
    .find((product): product is Product => isLinkedCutoutProduct(product)) || null;
}

function itemsFromProduct(product: Product): Partial<Record<Category, Product>> {
  return { [product.category]: product } as Partial<Record<Category, Product>>;
}

function isLinkedCutoutProduct(product?: Product | null): product is Product {
  return Boolean(product && isEditorialCutoutProduct(product) && hasExactProductLink(product));
}

function merchantHost(product: Product): string {
  const url = getProductOutboundUrl(product);
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return product.retailer || 'merchant';
  }
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
  const mergeItems = useFit((state) => state.mergeItems);

  // Counts derive from real state — never seeded, never inflated.
  const savedCount = hasMounted ? savedFits.length : 0;
  const closetCount = hasMounted ? wardrobeItems.filter((entry) => entry.status === 'closet').length : 0;
  const wishlistCount = hasMounted ? wardrobeItems.filter((entry) => entry.status === 'wishlist').length : 0;
  const likedFeedCount = hasMounted ? feedPosts.filter((post) => post.liked).length : 0;

  const recentSavedFits = hasMounted ? savedFits.slice(0, 6) : [];
  const recentWardrobe = useMemo(
    () => (hasMounted ? wardrobeItems.filter((item) => isLinkedCutoutProduct(item.product)).slice(0, 6) : []),
    [wardrobeItems, hasMounted],
  );
  const homeStories = useMemo(
    () => (hasMounted ? feedPosts
      .filter((post) => Object.values(post.items).some(isLinkedCutoutProduct))
      .slice(0, 8) : []),
    [feedPosts, hasMounted],
  );

  // "Basics" suggestions come from the feed posts the user has already
  // generated/loaded, then fall back to the strict real cutout catalog.
  // No fake "you might need" copy and no non-linked product cards.
  const basicSuggestions = useMemo<Product[]>(() => {
    const closetProductIds = new Set(
      wardrobeItems.filter((entry) => entry.status === 'closet').map((entry) => entry.productId),
    );
    const targetCategories: Category[] = ['top', 'outer', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];
    const seenIds = new Set<string>();
    const suggestions: Product[] = [];

    function addSuggestion(product?: Product | null) {
      if (!isLinkedCutoutProduct(product)) return;
      if (closetProductIds.has(product.id)) return;
      if (seenIds.has(product.id)) return;
      seenIds.add(product.id);
      suggestions.push(product);
    }

    for (const post of feedPosts) {
      for (const category of targetCategories) {
        addSuggestion(post.items[category]);
        if (suggestions.length >= 8) return suggestions;
      }
    }

    const catalogFallback = [...getStylistStarterProducts(8), ...getStylistCatalogProducts()];
    for (const product of catalogFallback) {
      addSuggestion(product);
      if (suggestions.length >= 8) break;
    }

    return suggestions;
  }, [feedPosts, wardrobeItems]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function buildAround(product: Product) {
    // Merge the anchor into any in-progress fit instead of wiping it.
    mergeItems(itemsFromProduct(product));
    router.push(`/build?lock=${encodeURIComponent(product.category)}`);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <header className="px-5 pb-4 pt-[calc(env(safe-area-inset-top)+18px)]">
        <div className="flex items-end justify-between">
          <div>
            <div className="sy-eyebrow">Sylistly</div>
            <h1 className="mt-1 font-serif text-[34px] font-semibold leading-[0.95] tracking-[-0.02em] text-ink">
              Today&rsquo;s <span className="italic text-accent">looks</span>
            </h1>
          </div>
          <Link
            href="/stylist"
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.12em] text-accent transition active:scale-95 hover:border-accent/55"
          >
            <WandSparkles size={13} />
            Syli
          </Link>
        </div>
        <div className="sy-rule mt-4" />
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <section className="px-4 pt-4">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" data-home-story-rail>
            <button
              type="button"
              onClick={() => router.push('/build')}
              className="w-[70px] flex-none text-center transition active:scale-95"
              aria-label="Create your outfit of the day"
            >
              <span className="relative mx-auto grid h-[66px] w-[66px] place-items-center rounded-full bg-[linear-gradient(135deg,#ff3b63,#ff6e8a)] text-white shadow-[0_14px_30px_rgba(255,59,99,.4)]">
                <Sparkles size={26} strokeWidth={2.1} />
                <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-bg bg-ink text-[16px] leading-none text-bg">+</span>
              </span>
              <span className="mt-1.5 block truncate text-[11px] font-semibold text-ink">Your OOTD</span>
            </button>
            {homeStories.map((post, index) => {
              const preview = Object.values(post.items).find(isLinkedCutoutProduct);
              if (!preview) return null;
              return (
                <button
                  key={`home-story-${post.id}`}
                  type="button"
                  onClick={() => router.push('/feed')}
                  className="w-[68px] flex-none text-center transition active:scale-95"
                  aria-label={`Open ${post.title} story in feed`}
                >
                  <span className="mx-auto block rounded-full bg-gradient-to-br from-[#9d78d7] via-accent to-[#eadbd2] p-[3px] shadow-[0_12px_28px_rgba(0,0,0,.25)]">
                    <span className="grid h-[58px] w-[58px] place-items-center overflow-hidden rounded-full border border-white/20 bg-[#f8f4ef]">
                      <ProductImage
                        product={preview}
                        transparentOnly
                        displayMode="thumbnail"
                        wrapperClassName="h-full w-full bg-transparent"
                        className="h-full w-full object-contain p-1.5"
                      />
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] font-semibold text-muted-2">
                    {post.username.replace(/^@/, '') || `style${index + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Focused launch */}
        <section className="px-5 pt-5">
          <div className="sy-card-strong sy-enter overflow-hidden rounded-card-lg p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="sy-eyebrow">AI Stylist</div>
                <h2 className="mt-2.5 font-serif text-[40px] font-semibold leading-[0.9] tracking-[-0.025em] text-ink">
                  Style a fit
                  <br />
                  <span className="italic text-accent">in seconds.</span>
                </h2>
                <p className="mt-3.5 max-w-[30ch] text-[14px] leading-relaxed text-muted-2">
                  Pick a vibe and Syli composes a complete, color-matched outfit from real, shoppable pieces.
                </p>
              </div>
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
                <Sparkles size={22} />
              </span>
            </div>

            <div className="mt-6 grid grid-cols-[1.25fr_.75fr] gap-2.5">
              <Link href="/build" className="sy-cta-primary px-4 py-3.5 text-[12px] font-bold uppercase tracking-[.12em]">
                <Sparkles size={15} />
                Style my fit
              </Link>
              <Link href="/feed" className="sy-cta-secondary px-4 py-3.5 text-[12px] font-bold uppercase tracking-[.12em]">
                <Flame size={14} />
                Feed
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              <HeroMetric label="Saved" value={savedCount} href="/saved" />
              <HeroMetric label="Closet" value={closetCount} href="/wardrobe" />
              <HeroMetric label="Wish" value={wishlistCount} href="/wardrobe?status=wishlist" />
              <HeroMetric label="Liked" value={likedFeedCount} href="/feed" />
            </div>
          </div>
        </section>

        {/* Recent outfits */}
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between px-4">
            <div>
              <div className="sy-eyebrow">Recent</div>
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
                    className="group relative h-[160px] w-[124px] flex-none overflow-hidden rounded-[20px] border border-white/12 bg-black/24 shadow-[0_14px_30px_rgba(0,0,0,.32)] transition active:scale-95 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_20px_38px_rgba(246,48,107,.4)] motion-safe:transition-all motion-safe:duration-200"
                  >
                    {cover ? (
                      <ProductImage
                        product={cover}
                        transparentOnly
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
              <div className="sy-eyebrow">Recently added</div>
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
                  className="group relative h-[110px] w-[94px] flex-none overflow-hidden rounded-[18px] border border-white/12 bg-black/24 shadow-[0_10px_22px_rgba(0,0,0,.28)] transition active:scale-95 hover:-translate-y-1 hover:border-accent/60 motion-safe:transition-all motion-safe:duration-200"
                >
                  <ProductImage
                    product={item.product}
                    transparentOnly
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
              <div className="sy-eyebrow">Catalog spotlight</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Real pieces to act on</div>
            </div>
          </div>
          {basicSuggestions.length === 0 ? (
            <div className="mx-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[12px] leading-relaxed text-muted-2">
                Style a fit or browse the feed and your picks will show up here.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {basicSuggestions.map((product) => {
                const outboundUrl = getProductOutboundUrl(product);
                const exact = isExactProductUrl(outboundUrl);
                return (
                <article
                  key={`basic-${product.id}`}
                  className="sy-lift group w-[152px] flex-none overflow-hidden rounded-card border border-hairline-2 bg-surface-1 shadow-card transition hover:border-accent/50"
                  data-home-real-piece
                >
                  <button
                    type="button"
                    onClick={() => buildAround(product)}
                    className="block w-full text-left"
                    aria-label={`Build around ${product.name}`}
                  >
                    <div className="sy-studio relative h-[150px]">
                      <ProductImage
                        product={product}
                        transparentOnly
                        wrapperClassName="h-full w-full bg-transparent"
                        className="h-full w-full object-contain p-3"
                      />
                      <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-white backdrop-blur-md">
                        {product.category}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-accent">{product.brand}</div>
                      <div className="mt-1 line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-snug text-ink">{product.name}</div>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-[14px] font-bold text-ink">{formatPrice(product.priceCents)}</span>
                        <span className="truncate text-[9px] font-medium uppercase tracking-[.08em] text-muted">{merchantHost(product)}</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => buildAround(product)}
                      className="sy-cta-primary flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-[.1em]"
                    >
                      Build
                    </button>
                    <button
                      type="button"
                      aria-label="Save to wishlist"
                      onClick={() => {
                        addToWishlist(product, 'catalog');
                        showToast('Added to wishlist');
                      }}
                      className="sy-press grid h-9 w-9 flex-none place-items-center rounded-full border border-hairline-2 text-muted-2 transition hover:border-accent/50 hover:text-accent"
                    >
                      <Heart size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Add to closet"
                      onClick={() => {
                        addToCloset(product, 'catalog');
                        showToast('Added to closet');
                      }}
                      className="sy-press grid h-9 w-9 flex-none place-items-center rounded-full border border-hairline-2 text-muted-2 transition hover:border-accent/50 hover:text-accent"
                    >
                      <ShoppingBag size={15} />
                    </button>
                    <a
                      href={outboundUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open real product link"
                      data-home-product-link-kind={exact ? 'exact' : 'blocked'}
                      className="sy-press grid h-9 w-9 flex-none place-items-center rounded-full border border-accent/35 bg-accent-soft text-accent transition hover:border-accent/60"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="h-6" />
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

function HeroMetric({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="sy-press rounded-2xl border border-white/10 bg-black/20 px-2 py-2.5 text-center transition hover:border-accent/40"
    >
      <div className="font-serif text-[22px] font-semibold leading-none text-ink">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[.14em] text-muted">{label}</div>
    </Link>
  );
}
