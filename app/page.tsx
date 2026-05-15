'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bookmark,
  ChevronRight,
  Crown,
  Flame,
  Heart,
  Layers,
  Plus,
  Search,
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
import { useWardrobe } from '@/store/wardrobe';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function fitCoverProduct(fit: SavedFitRecord): Product | null {
  const items = fit.items;
  return items.outer || items.top || items.bottom || items.shoes || Object.values(items).find(Boolean) || null;
}

export default function HomePage() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  const savedFits = useSavedFits((state) => state.fits);
  const wardrobeItems = useWardrobe((state) => state.items);
  const feedPosts = useSocialFeed((state) => state.posts);
  const currentFitItems = useFit((state) => state.items);

  // Counts derive from real state — never seeded, never inflated.
  const savedCount = hasMounted ? savedFits.length : 0;
  const closetCount = hasMounted ? wardrobeItems.filter((entry) => entry.status === 'closet').length : 0;
  const wishlistCount = hasMounted ? wardrobeItems.filter((entry) => entry.status === 'wishlist').length : 0;
  const likedFeedCount = hasMounted ? feedPosts.filter((post) => post.liked).length : 0;
  const currentFitCount = hasMounted
    ? Object.values(currentFitItems).filter(Boolean).length
    : 0;

  const recentSavedFits = hasMounted ? savedFits.slice(0, 6) : [];
  const recentWardrobe = useMemo(
    () => (hasMounted ? wardrobeItems.slice(0, 6) : []),
    [wardrobeItems, hasMounted],
  );

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
              className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-white/80 transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
              aria-label="Search (coming later)"
              disabled
            >
              <Search size={16} />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-white/80 transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
              aria-label="Notifications (coming later)"
              disabled
            >
              <Bell size={16} />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-accent/45 bg-accent/14 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-accent transition active:scale-95 motion-safe:transition-transform motion-safe:duration-150 hover:bg-accent/22"
              aria-label="Pro coming later"
              disabled
            >
              <Crown size={11} />
              Pro
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Quick profile row */}
        <section className="px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <QuickStat label="Your style" hint="Open feed" href="/feed" icon={Flame} count={likedFeedCount} unit="liked" />
            <QuickStat label="Saved" hint="Open saved fits" href="/saved" icon={Bookmark} count={savedCount} unit="fits" />
            <QuickStat label="Closet" hint="Open wardrobe" href="/wardrobe" icon={Layers} count={closetCount} unit="pieces" />
            <QuickStat label="Wishlist" hint="Open wishlist" href="/wardrobe" icon={Heart} count={wishlistCount} unit="pieces" />
            <QuickStat label="AI Stylist" hint="Beta — coming later" disabled icon={Wand2} count={0} unit="beta" />
          </div>
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
              body={closetCount > 0 ? `${closetCount} pieces ready` : 'Add pieces to your closet first.'}
              onClick={() => router.push('/wardrobe')}
              disabled={closetCount === 0}
            />
            <StylistCard
              icon={Wand2}
              eyebrow="Insight"
              title="Rate my fit"
              body={
                currentFitCount > 0
                  ? `${currentFitCount} pieces in builder — open Fit Insight.`
                  : 'Generate a fit first to rate it.'
              }
              onClick={() => router.push('/build')}
              disabled={currentFitCount === 0}
            />
            <StylistCard
              icon={Flame}
              eyebrow="Discover"
              title="Browse the feed"
              body={`${feedPosts.length} catalog-backed fits ready.`}
              onClick={() => router.push('/feed')}
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
            <ShortcutTile label="Try On" disabled />
            <ShortcutTile label="Stylist" disabled />
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

        {/* Basics you may have */}
        <section className="mt-6 pb-6">
          <div className="mb-2 flex items-center justify-between px-4">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Basics</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">You may have these</div>
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
                <button
                  key={`basic-${product.id}`}
                  type="button"
                  onClick={() => {
                    const url = getProductOutboundUrl(product);
                    if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="group relative h-[140px] w-[110px] flex-none overflow-hidden rounded-[20px] border border-white/12 bg-[#fff7ef] shadow-[0_12px_28px_rgba(0,0,0,.28)] transition active:scale-95 hover:-translate-y-1 hover:border-accent/60 motion-safe:transition-all motion-safe:duration-200"
                  aria-label={`Shop ${product.brand} ${product.name}`}
                >
                  <ProductImage
                    product={product}
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-contain p-2"
                  />
                  <div className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.12em] text-white backdrop-blur-md">
                    {product.category}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,.78)_100%)]" />
                  <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 truncate text-[9px] font-bold uppercase tracking-[.14em] text-white">
                    {formatPrice(product.priceCents)}
                  </div>
                </button>
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
                  Generate a polished card from your latest saved fit — local-only for now, no fake cloud generation.
                </p>
                <button
                  type="button"
                  disabled={savedCount === 0}
                  onClick={() => router.push('/saved')}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 disabled:opacity-50 disabled:active:scale-100"
                >
                  <Plus size={11} />
                  {savedCount > 0 ? 'Open saved fits' : 'Save a fit first'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
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
