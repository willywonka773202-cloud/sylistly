'use client';

import { ArrowRight, Bookmark, Flame, Plus, Shirt, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { useWardrobe } from '@/store/wardrobe';
import { filterFeedRenderableProducts } from '@/lib/product-image-quality';
import type { Product } from '@/lib/types';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export default function HomePage() {
  const router = useRouter();
  const profile = useProfile((state) => state.profile);
  const savedFits = useSavedFits((state) => state.fits);
  const posts = useSocialFeed((state) => state.posts);
  const ownedItems = useWardrobe((state) => state.ownedItems);
  const replaceItems = useFit((state) => state.replaceItems);

  const profileFrame = profile.bodyType === 'custom' ? 'androgynous' : profile.bodyType;
  const profileVibes = profile.stylePrefs.vibes || [];

  const recentFits = savedFits.slice(0, 6);
  const recentWardrobe = ownedItems.slice(0, 8);
  const trendingPosts = posts
    .filter((post) => filterFeedRenderableProducts(
      Object.values(post.items).filter((p): p is Product => Boolean(p)),
    ).length >= 3)
    .sort((a, b) => {
      const aText = [a.vibe, a.title, ...a.tags].join(' ').toLowerCase();
      const bText = [b.vibe, b.title, ...b.tags].join(' ').toLowerCase();
      const aVibeMatch = profileVibes.some((v) => aText.includes(v.toLowerCase())) ? 12 : 0;
      const bVibeMatch = profileVibes.some((v) => bText.includes(v.toLowerCase())) ? 12 : 0;
      const aFrameMatch = !a.frameBias || a.frameBias === 'any' || a.frameBias === profileFrame ? 6 : 0;
      const bFrameMatch = !b.frameBias || b.frameBias === 'any' || b.frameBias === profileFrame ? 6 : 0;
      return (b.likeCount + bVibeMatch + bFrameMatch) - (a.likeCount + aVibeMatch + aFrameMatch);
    })
    .slice(0, 4);

  const hasContent = recentFits.length > 0 || recentWardrobe.length > 0;

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto pb-6 pt-[calc(env(safe-area-inset-top)+20px)]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-5">
          <div>
            <div className="font-serif text-[32px] font-semibold leading-none text-ink">
              Sylistly
            </div>
            <p className="mt-1 text-[11px] text-muted">Build. Discover. Wear.</p>
          </div>
          <button
            onClick={() => router.push('/build')}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.1em] text-white shadow-pink-glow"
          >
            <Plus size={13} />
            Build
          </button>
        </div>

        {/* Quick action cards */}
        <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {[
            { label: 'Fit Feed', sub: 'Swipe looks', icon: Flame, href: '/feed', accent: true },
            { label: 'Builder', sub: 'Create outfit', icon: Sparkles, href: '/build', accent: false },
            { label: 'Discover', sub: 'Style library', icon: Bookmark, href: '/discover', accent: false },
            { label: 'Try On', sub: 'Preview fit', icon: Shirt, href: '/try-on', accent: false },
          ].map(({ label, sub, icon: Icon, href, accent }) => (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className={`flex w-[110px] flex-none flex-col items-start rounded-[24px] border p-3.5 text-left transition active:scale-[0.97] ${
                accent
                  ? 'border-accent/35 bg-accent/12 shadow-pink-glow'
                  : 'border-white/10 bg-[#151311]'
              }`}
            >
              <div className={`grid h-9 w-9 place-items-center rounded-[14px] ${accent ? 'bg-accent text-white' : 'bg-white/[0.07] text-muted-2'}`}>
                <Icon size={17} />
              </div>
              <div className="mt-3 font-semibold text-[13px] text-ink leading-none">{label}</div>
              <div className="mt-1 text-[10px] text-muted-2">{sub}</div>
            </button>
          ))}
        </div>

        {/* Onboarding CTA — shown when no wardrobe */}
        {!hasContent && (
          <div className="mx-4 mt-5 rounded-[28px] border border-accent/25 bg-[radial-gradient(circle_at_top_right,rgba(232,54,93,.12),transparent_40%),linear-gradient(180deg,#161412_0%,#0d0c0b_100%)] p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[16px] bg-accent/15 text-accent">
                <Shirt size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-[20px] font-semibold text-ink leading-tight">Set up your wardrobe</h2>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-2">
                  Add pieces you already own so we can build outfits around your wardrobe.
                </p>
                <button
                  onClick={() => router.push('/onboarding')}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.1em] text-white shadow-pink-glow"
                >
                  <Plus size={12} />
                  Add suggested basics
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent outfits */}
        {recentFits.length > 0 && (
          <section className="mt-6 px-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-accent">Your fits</div>
                <h2 className="mt-0.5 font-serif text-[22px] font-semibold text-ink">Recent outfits</h2>
              </div>
              <button onClick={() => router.push('/saved')} className="flex items-center gap-1 text-[11px] text-muted-2 transition hover:text-accent">
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {recentFits.map((fit) => {
                const products = Object.values(fit.items).filter((p): p is Product => Boolean(p)).slice(0, 4);
                return (
                  <button
                    key={fit.id}
                    type="button"
                    onClick={() => { replaceItems(fit.items); router.push('/build'); }}
                    className="w-[140px] flex-none overflow-hidden rounded-[20px] border border-white/10 bg-[#151311] text-left shadow-[0_14px_28px_rgba(0,0,0,.24)] transition active:scale-[0.97]"
                  >
                    <div className="m-1.5 grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-[14px] border border-[#eadfd5] bg-[#fff8f2]" style={{ height: 110 }}>
                      {products.map((product, i) => (
                        <div key={product.id} className={`overflow-hidden rounded-[10px] bg-white/70 ${i === 0 ? 'row-span-2' : ''}`}>
                          <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1" />
                        </div>
                      ))}
                    </div>
                    <div className="px-2 pb-2">
                      <p className="line-clamp-1 text-[11px] font-semibold text-ink">{fit.title}</p>
                      <p className="text-[9px] text-muted mt-0.5">{formatPrice(fit.totalCents)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Wardrobe recents */}
        {recentWardrobe.length > 0 && (
          <section className="mt-6 px-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-accent">Your clothes</div>
                <h2 className="mt-0.5 font-serif text-[22px] font-semibold text-ink">Recently added</h2>
              </div>
              <button onClick={() => router.push('/profile')} className="flex items-center gap-1 text-[11px] text-muted-2 transition hover:text-accent">
                Wardrobe <ArrowRight size={12} />
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
              {recentWardrobe.map((item) => (
                <div key={item.productId} className="w-[80px] flex-none overflow-hidden rounded-[18px] border border-white/10 bg-[#151311]">
                  <div className="aspect-square overflow-hidden rounded-[14px] m-1 border border-[#eadfd5] bg-[#fff8f2]">
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain p-1.5" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="px-1.5 pb-2">
                    <p className="line-clamp-1 text-[9px] font-semibold text-ink">{item.brand}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending from feed */}
        {trendingPosts.length > 0 && (
          <section className="mt-6 px-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-accent">Community</div>
                <h2 className="mt-0.5 font-serif text-[22px] font-semibold text-ink">Trending fits</h2>
              </div>
              <button onClick={() => router.push('/feed')} className="flex items-center gap-1 text-[11px] text-muted-2 transition hover:text-accent">
                Feed <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {trendingPosts.map((post) => {
                const products = filterFeedRenderableProducts(
                  Object.values(post.items).filter((p): p is Product => Boolean(p)),
                ).slice(0, 4);
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => router.push('/feed')}
                    className="overflow-hidden rounded-[20px] border border-white/10 bg-[#151311] text-left shadow-[0_14px_28px_rgba(0,0,0,.22)] transition active:scale-[0.97]"
                  >
                    <div className="m-1.5 grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-[14px] border border-[#eadfd5] bg-[#fff8f2]" style={{ height: 120 }}>
                      {products.map((product, i) => (
                        <div key={product.id} className={`overflow-hidden rounded-[10px] bg-white/70 ${i === 0 ? 'row-span-2' : ''}`}>
                          <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1" />
                        </div>
                      ))}
                    </div>
                    <div className="px-2 pb-2.5">
                      <p className="line-clamp-1 text-[12px] font-semibold text-ink">{post.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted">
                        <span>♥ {post.likeCount}</span>
                        <span>{post.vibe}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Share your style CTA */}
        <div className="mx-4 mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#161412_0%,#0d0c0b_100%)] p-5 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-[18px] bg-accent/12 text-accent">
            <Sparkles size={20} />
          </div>
          <h2 className="mt-3 font-serif text-[22px] font-semibold text-ink">Share your style</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
            Build a fit in the Builder, then post it to the community feed.
          </p>
          <button
            onClick={() => router.push('/build')}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
          >
            <Sparkles size={13} />
            Open Builder
          </button>
        </div>

      </div>

      <BottomNav />
    </main>
  );
}
