'use client';

import { ChevronLeft, Heart, WandSparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { track } from '@/lib/analytics';
import { CLIENT_CATALOG_PRODUCTS } from '@/lib/client-catalog';
import { hasExactProductLink, isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useWardrobe } from '@/store/wardrobe';

const PENDING_LOCK_KEY = 'sylistly.pending-lock.v1';

const FILTERS: Array<{ id: string; label: string; categories: Category[] | null }> = [
  { id: 'all', label: 'All', categories: null },
  { id: 'top', label: 'Tops', categories: ['top'] },
  { id: 'bottom', label: 'Bottoms', categories: ['bottom'] },
  { id: 'shoes', label: 'Shoes', categories: ['shoes'] },
  { id: 'outer', label: 'Outerwear', categories: ['outer'] },
  { id: 'bag', label: 'Bags', categories: ['bag'] },
  { id: 'accessories', label: 'Accessories', categories: ['hat', 'eyewear', 'jewelry'] },
];

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/**
 * Browse — every clean piece in the catalog, by category. Tapping a piece
 * locks it into the scroll ("style this"), the heart saves it to the
 * wishlist. This is the catalog as a shop window for the lock mechanic.
 */
export default function BrowsePage() {
  const router = useRouter();
  const isInWishlist = useWardrobe((state) => state.isInWishlist);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const removeItem = useWardrobe((state) => state.removeItem);

  const [hasMounted, setHasMounted] = useState(false);
  const [filterId, setFilterId] = useState('all');
  // Page the grid — rendering all ~544 cutout cards at once is a heavy DOM
  // (slow mobile paint + sluggish hydration). Reveal in chunks instead.
  const PAGE = 48;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  useEffect(() => setHasMounted(true), []);

  const allProducts = useMemo(
    () => CLIENT_CATALOG_PRODUCTS.filter((product) => isEditorialCutoutProduct(product)),
    [],
  );

  const filter = FILTERS.find((entry) => entry.id === filterId) || FILTERS[0];
  const products = useMemo(
    () =>
      filter.categories
        ? allProducts.filter((product) => filter.categories!.includes(product.category))
        : allProducts,
    [allProducts, filter],
  );
  const visible = products.slice(0, visibleCount);

  function selectFilter(id: string) {
    setFilterId(id);
    setVisibleCount(PAGE); // reset paging when the category changes
  }

  function styleThis(product: Product) {
    window.localStorage.setItem(PENDING_LOCK_KEY, JSON.stringify(product));
    track('browse_style_this', { category: product.category, brand: product.brand });
    router.push('/');
  }

  function toggleWishlist(product: Product) {
    if (isInWishlist(product.id)) {
      removeItem(product.id);
    } else {
      addToWishlist(product, 'manual');
      track('browse_wishlisted', { category: product.category, brand: product.brand });
    }
  }

  return (
    <main className="relative mx-auto min-h-[100dvh] max-w-[480px] bg-bg pb-[120px]">
      {/* Header */}
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to the scroll"
            className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="flex items-baseline gap-2">
            <span className="text-eyebrow font-extrabold uppercase text-champagne">Sylistly</span>
            <span className="font-serif text-[17px] font-semibold italic leading-none text-ink">
              Browse <span className="text-accent">pieces</span>
            </span>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {products.length} pieces · tap one to lock it into your scroll
        </p>
      </header>

      {/* Category chips — sticky under the notch */}
      <div className="sticky top-0 z-20 bg-[linear-gradient(180deg,#0D0D0F_72%,transparent)] px-4 pb-4 pt-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {FILTERS.map((entry) => {
            const active = entry.id === filterId;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectFilter(entry.id)}
                aria-pressed={active}
                className={`sy-press shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                  active ? 'bg-accent text-white shadow-pink-glow' : 'bg-surface-2 text-muted-2'
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 px-4">
        {visible.map((product) => {
          const wishlisted = hasMounted && isInWishlist(product.id);
          const exact = hasExactProductLink(product);
          return (
            <div
              key={product.id}
              className="group overflow-hidden rounded-card bg-surface-1 ring-1 ring-hairline transition hover:ring-accent/40"
            >
              <button
                type="button"
                onClick={() => styleThis(product)}
                aria-label={`Style a fit around ${product.brand} ${product.name}`}
                className="relative block w-full bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF5EF_100%)] p-4"
              >
                <ProductImage
                  product={product}
                  transparentOnly
                  wrapperClassName="h-[128px] w-full"
                  className="h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(24,12,10,.12)] transition-transform duration-300 group-hover:scale-[1.05]"
                />
                <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-bg/85 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-ink opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                  <WandSparkles size={10} className="text-accent" />
                  Style this
                </span>
              </button>
              <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                    {product.brand}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-ink">{product.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-accent">
                    {formatPrice(product.priceCents || 0)}
                    {exact ? (
                      <span aria-label="Shoppable" className="h-1.5 w-1.5 rounded-full bg-money" />
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  aria-pressed={wishlisted}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`sy-press grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                    wishlisted
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-hairline-2 bg-surface-2 text-muted'
                  }`}
                >
                  <Heart size={14} fill={wishlisted ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length < products.length ? (
        <div className="mt-5 flex justify-center px-4">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE)}
            className="sy-press rounded-full border border-hairline-2 bg-surface-2 px-6 py-3 text-[12px] font-bold uppercase tracking-[.14em] text-ink"
          >
            Load more ({products.length - visible.length} left)
          </button>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}
