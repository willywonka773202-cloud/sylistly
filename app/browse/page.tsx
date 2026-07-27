'use client';

import { ChevronLeft, Heart, Search, WandSparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AmbientField } from '@/components/AmbientField';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { Reveal } from '@/components/Reveal';
import { track } from '@/lib/analytics';
import { CLIENT_CATALOG_PRODUCTS } from '@/lib/client-catalog';
import { hasExactProductLink, isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

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
  // Subscribe to the items array (not just the isInWishlist method) so toggling
  // a heart actually re-renders the grid — selecting only the method gives a
  // stable ref that never triggers a re-render on mutation.
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const removeItem = useWardrobe((state) => state.removeItem);
  const wishlistIds = useMemo(
    () => new Set(wardrobeItems.filter((item) => item.status === 'wishlist').map((item) => item.productId)),
    [wardrobeItems],
  );

  const [hasMounted, setHasMounted] = useState(false);
  const [filterId, setFilterId] = useState('all');
  const [query, setQuery] = useState('');
  // Page the grid — rendering all ~544 cutout cards at once is a heavy DOM
  // (slow mobile paint + sluggish hydration). Reveal in chunks instead.
  const PAGE = 48;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  // The product id whose wishlist heart is mid "save-pop" (one-shot bounce).
  const [poppedId, setPoppedId] = useState<string | null>(null);
  useEffect(() => setHasMounted(true), []);

  const allProducts = useMemo(
    () => CLIENT_CATALOG_PRODUCTS.filter((product) => isEditorialCutoutProduct(product)),
    [],
  );

  const filter = FILTERS.find((entry) => entry.id === filterId) || FILTERS[0];
  const products = useMemo(() => {
    const byCategory = filter.categories
      ? allProducts.filter((product) => filter.categories!.includes(product.category))
      : allProducts;
    // Normalise punctuation to spaces so "air-force" / "t-shirt" match "Air
    // Force" / "T Shirt", and so a stray symbol can't produce false negatives.
    const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const q = norm(query);
    if (!q) return byCategory;
    // Match brand, product name, or category — every term must appear somewhere,
    // so "black nike" narrows instead of widening.
    const terms = q.split(' ').filter(Boolean);
    return byCategory.filter((product) => {
      const haystack = norm(`${product.brand} ${product.name} ${product.category}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [allProducts, filter, query]);
  const visible = products.slice(0, visibleCount);

  function selectFilter(id: string) {
    setFilterId(id);
    setVisibleCount(PAGE); // reset paging when the category changes
  }

  function updateQuery(value: string) {
    setQuery(value);
    setVisibleCount(PAGE); // reset paging when the search changes
  }

  // Infinite scroll: auto-load the next page as the list nears the bottom. Uses a
  // capture-phase scroll listener + getBoundingClientRect (NOT IntersectionObserver,
  // which never fires in the headless preview). The "Load more" button stays as a
  // keyboard/fallback affordance. loadingMoreRef debounces the scroll burst to one
  // page per render; the sentinel moving out of range self-limits a fast fling.
  useEffect(() => {
    loadingMoreRef.current = false; // re-arm once the new page has rendered
  }, [visibleCount]);

  useEffect(() => {
    if (visible.length >= products.length) return;
    const maybeLoad = () => {
      if (loadingMoreRef.current) return;
      const el = sentinelRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().top <= window.innerHeight + 600) {
        loadingMoreRef.current = true;
        setVisibleCount((count) => Math.min(count + PAGE, products.length));
      }
    };
    maybeLoad();
    window.addEventListener('scroll', maybeLoad, { capture: true, passive: true });
    window.addEventListener('resize', maybeLoad, { passive: true });
    return () => {
      window.removeEventListener('scroll', maybeLoad, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', maybeLoad);
    };
  }, [visible.length, products.length, PAGE]);

  function styleThis(product: Product) {
    // Guard the lock-write so the tap always navigates even if storage is
    // blocked (matches the share-landing CTA) — a tap should never silently fail.
    try {
      window.localStorage.setItem(PENDING_LOCK_KEY, JSON.stringify(product));
    } catch {
      /* storage blocked — navigate anyway, no pre-lock */
    }
    track('browse_style_this', { category: product.category, brand: product.brand });
    router.push('/');
  }

  function toggleWishlist(product: Product) {
    if (wishlistIds.has(product.id)) {
      removeItem(product.id);
    } else {
      addToWishlist(product, 'manual');
      track('browse_wishlisted', { category: product.category, brand: product.brand });
    }
  }

  return (
    <main className="sy-game-screen relative mx-auto min-h-[100dvh] max-w-[480px] overflow-hidden bg-bg pb-[120px]">
      <h1 className="sr-only">Browse — every piece in the catalog</h1>
      <AmbientField className="opacity-55" />
      <div className="relative z-10">
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
            <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
            <span className="font-serif text-[17px] font-semibold italic leading-none text-ink">
              Live <span className="text-accent">wardrobe</span>
            </span>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {query.trim()
            ? `${products.length} result${products.length === 1 ? '' : 's'} for “${query.trim()}”`
            : `${products.length} pieces · tap one to lock it into your scroll`}
        </p>
      </header>

      {/* Search + category chips — sticky under the notch */}
      <div className="sticky top-0 z-20 bg-[linear-gradient(180deg,#0D0D0F_72%,transparent)] px-4 pb-4 pt-3">
        <div className="mb-2.5 flex items-center gap-2 rounded-full border border-hairline-2 bg-surface-1/90 px-3.5 py-2.5 backdrop-blur-xl focus-within:border-accent/60">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search brand or piece — adidas, denim, samba…"
            aria-label="Search pieces"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-ink outline-none placeholder:text-muted/70"
          />
          {query ? (
            <button
              type="button"
              onClick={() => updateQuery('')}
              aria-label="Clear search"
              className="sy-press grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
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
        {visible.map((product, i) => {
          const wishlisted = hasMounted && wishlistIds.has(product.id);
          const exact = hasExactProductLink(product);
          return (
            <Reveal key={product.id} delay={(i % 2) * 80}>
            <div
              className="group overflow-hidden rounded-card bg-surface-1 ring-1 ring-hairline transition hover:ring-accent/40"
              // Skip rendering off-screen cards on the long (~544-item) catalog
              // grid — faster paint/scroll. `auto` intrinsic-size remembers the
              // real height after first render, so there's no scroll jank.
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 240px' }}
            >
              <button
                type="button"
                onClick={() => styleThis(product)}
                aria-label={`Style a fit around ${product.brand} ${product.name}`}
                className="sy-press relative block w-full bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF5EF_100%)] p-4"
              >
                <ProductImage
                  product={product}
                  transparentOnly
                  loading={i < 6 ? 'eager' : 'lazy'}
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
                  onClick={() => {
                    if (!wishlisted) {
                      setPoppedId(product.id);
                      window.setTimeout(() => setPoppedId((cur) => (cur === product.id ? null : cur)), 450);
                    }
                    toggleWishlist(product);
                  }}
                  aria-pressed={wishlisted}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`sy-press grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                    wishlisted
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-hairline-2 bg-surface-2 text-muted'
                  }`}
                >
                  <Heart size={14} fill={wishlisted ? 'currentColor' : 'none'} className={poppedId === product.id ? 'sy-save-pop' : undefined} />
                </button>
              </div>
            </div>
            </Reveal>
          );
        })}
      </div>

      {products.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-hairline-2 bg-surface-2 text-muted">
            <Search size={22} />
          </div>
          <p className="font-serif text-[20px] font-semibold text-ink">
            No pieces match {query ? `“${query.trim()}”` : 'that'}
          </p>
          <p className="mx-auto mt-2 max-w-[30ch] text-[13px] leading-relaxed text-muted-2">
            Try a brand (adidas, SKIMS) or a piece (denim, hoodie, samba) — or switch category.
          </p>
          <button
            type="button"
            onClick={() => updateQuery('')}
            className="sy-press mt-5 rounded-full border border-hairline-2 bg-surface-2 px-5 py-2.5 text-[12px] font-bold uppercase tracking-[.14em] text-ink"
          >
            Clear search
          </button>
        </div>
      ) : null}

      {/* Sentinel — when this nears the viewport, the next page auto-loads */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

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
      </div>

      <BottomNav />
    </main>
  );
}
