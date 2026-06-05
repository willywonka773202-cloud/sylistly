'use client';

import Link from 'next/link';
import { ArrowLeft, Images, Shirt, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { OutfitCanvasEditor } from '@/components/OutfitCanvasEditor';
import { isExactProductUrl } from '@/lib/checkout';
import { getProductOutboundUrl } from '@/lib/product-links';
import { sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import { getStylistStarterProducts } from '@/lib/client-catalog';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';

function productsFromItems(items: Partial<Record<Category, Product>>): Product[] {
  return sortTransparentFeedRenderableProducts(
    Object.values(items).filter((product): product is Product => Boolean(product)),
  );
}

function starterProducts(): Product[] {
  return getStylistStarterProducts(8);
}

function topSignal(products: Product[]): string {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const signal of [...(product.vibes || []), ...(product.occasions || []), product.category]) {
      if (!signal) continue;
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || 'editorial';
}

function productLinkStats(products: Product[]): { exactCount: number; linkedCount: number } {
  const linkedProducts = products.filter((product) => Boolean(getProductOutboundUrl(product)));
  return {
    exactCount: linkedProducts.filter((product) => isExactProductUrl(getProductOutboundUrl(product))).length,
    linkedCount: linkedProducts.length,
  };
}

export default function CanvasPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const currentItems = useFit((state) => state.items);
  const savedFits = useSavedFits((state) => state.fits);
  const feedPosts = useSocialFeed((state) => state.posts);

  useEffect(() => setHasMounted(true), []);

  const source = useMemo(() => {
    if (!hasMounted) {
      return {
        label: 'Editorial starter',
        products: starterProducts(),
        source: 'Starter',
      };
    }

    const currentProducts = productsFromItems(currentItems);
    if (currentProducts.length >= 3) {
      return {
        label: 'Current fit',
        products: currentProducts,
        source: 'Builder',
      };
    }

    const latest = savedFits.find((fit) => productsFromItems(fit.items).length >= 3);
    if (latest) {
      return {
        label: latest.title,
        products: productsFromItems(latest.items),
        source: 'Saved',
      };
    }

    const starterPost = feedPosts.find((post) => productsFromItems(post.items).length >= 3);
    if (starterPost) {
      return {
        label: starterPost.title,
        products: productsFromItems(starterPost.items),
        source: 'Feed starter',
      };
    }

    return {
      label: 'Editorial starter',
      products: starterProducts(),
      source: 'Starter',
    };
  }, [currentItems, feedPosts, hasMounted, savedFits]);

  const signal = useMemo(() => topSignal(source.products), [source.products]);
  const linkStats = useMemo(() => productLinkStats(source.products), [source.products]);

  return (
    <main
      className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-[#080807] text-white"
      data-canvas-page
      data-canvas-source-link-quality={`${linkStats.exactCount}/${linkStats.linkedCount}`}
      data-canvas-source-pieces={source.products.length}
    >
      <header className="flex-none px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/feed"
            aria-label="Back to feed"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/86 shadow-[0_12px_32px_rgba(0,0,0,.28)]"
          >
            <ArrowLeft size={19} />
          </Link>
          <div className="text-center">
            <div className="text-[8px] font-black uppercase tracking-[.22em] text-accent">Creation platform</div>
            <h1 className="mt-0.5 font-serif text-[25px] font-semibold leading-none text-ink">Editor</h1>
          </div>
          <Link
            href="/build"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/86 shadow-[0_12px_32px_rgba(0,0,0,.28)]"
            aria-label="Open outfit builder"
          >
            <Shirt size={18} />
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-32">
        <section className="mb-4 rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.18),transparent_36%),linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.025))] p-4 shadow-[0_24px_60px_rgba(0,0,0,.3)]">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
              <Images size={20} />
            </span>
            <div className="min-w-0">
              <div className="font-serif text-[22px] font-semibold leading-tight text-ink">Manual outfit editor</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
                Drag, rotate, resize, duplicate, layer, and auto-arrange real linked products into an editorial collage.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white/68">
              {source.source}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white/68">
              {source.products.length} pieces
            </span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-emerald-100">
              {linkStats.exactCount}/{linkStats.linkedCount} exact
            </span>
            <span className="rounded-full border border-accent/34 bg-accent/12 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-accent">
              {signal}
            </span>
          </div>
        </section>

        {source.products.length >= 3 ? (
          <OutfitCanvasEditor products={source.products} title={source.label} signal={signal} />
        ) : (
          <section className="grid min-h-[54dvh] place-items-center rounded-[32px] border border-white/10 bg-white/[0.04] px-8 text-center">
            <div>
              <Sparkles className="mx-auto text-accent" size={34} />
              <h2 className="mt-4 font-serif text-[27px] font-semibold text-ink">No outfit loaded yet</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
                Build or save an outfit with real linked cutout pieces, then Editor becomes your Polyvore-style workspace.
              </p>
              <Link
                href="/build"
                className="mt-5 inline-flex rounded-full bg-accent px-5 py-3 text-[11px] font-black uppercase tracking-[.14em] text-white shadow-pink-glow"
              >
                Build an outfit
              </Link>
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
