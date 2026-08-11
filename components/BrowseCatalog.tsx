'use client';

import { BadgeCheck, ChevronLeft, Heart, Search, SlidersHorizontal, WandSparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AmbientField } from '@/components/AmbientField';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { track } from '@/lib/analytics';
import type { CatalogFacets } from '@/lib/catalog-query';
import type { Category, Product } from '@/lib/types';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

const PENDING_LOCK_KEY = 'sylistly.pending-lock.v1';
const PAGE_SIZE = 48;

const FILTERS: Array<{ id: 'all' | Category; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'outer', label: 'Outerwear' },
  { id: 'bag', label: 'Bags' },
  { id: 'hat', label: 'Headwear' },
  { id: 'eyewear', label: 'Eyewear' },
  { id: 'jewelry', label: 'Jewelry' },
];

const PRICE_OPTIONS = [
  { value: '', label: 'Any price' },
  { value: '10000', label: 'Under $100' },
  { value: '25000', label: 'Under $250' },
  { value: '50000', label: 'Under $500' },
  { value: '100000', label: 'Under $1,000' },
];

interface CatalogResponse {
  products: Product[];
  total: number;
  nextOffset: number | null;
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function BrowseCatalog({
  initialProducts,
  initialTotal,
  facets,
}: {
  initialProducts: Product[];
  initialTotal: number;
  facets: CatalogFacets;
}) {
  const router = useRouter();
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const removeItem = useWardrobe((state) => state.removeItem);
  const wishlistIds = useMemo(
    () => new Set(wardrobeItems.filter((item) => item.status === 'wishlist').map((item) => item.productId)),
    [wardrobeItems],
  );

  const [hasMounted, setHasMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialProducts.length < initialTotal ? initialProducts.length : null,
  );
  const [category, setCategory] = useState<'all' | Category>('all');
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [retailer, setRetailer] = useState('');
  const [color, setColor] = useState('');
  const [maxPriceCents, setMaxPriceCents] = useState('');
  const [sort, setSort] = useState('featured');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poppedId, setPoppedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryRequestRef = useRef(0);

  useEffect(() => setHasMounted(true), []);

  const makeParams = useCallback((offset = 0) => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE), sort });
    if (query.trim()) params.set('q', query.trim());
    if (category !== 'all') params.set('category', category);
    if (brand) params.set('brand', brand);
    if (retailer) params.set('retailer', retailer);
    if (color) params.set('color', color);
    if (maxPriceCents) params.set('maxPriceCents', maxPriceCents);
    return params;
  }, [brand, category, color, maxPriceCents, query, retailer, sort]);

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    const requestId = ++queryRequestRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalog?${makeParams(offset).toString()}`);
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      const payload = await response.json() as CatalogResponse;
      if (requestId !== queryRequestRef.current) return;
      setProducts((current) => append ? [...current, ...payload.products] : payload.products);
      setTotal(payload.total);
      setNextOffset(payload.nextOffset);
      if (!append && query.trim()) {
        track('search_performed', {
          query: query.trim(),
          resultCount: payload.total,
          surface: 'browse',
        });
      }
      if (!append && payload.total === 0) {
        track('search_empty_results', {
          query: query.trim(), category, brand, retailer, color, maxPriceCents,
          resultCount: 0,
          surface: 'browse',
        });
      }
    } catch (cause) {
      if (requestId !== queryRequestRef.current) return;
      setError(cause instanceof Error ? cause.message : 'Catalog unavailable');
    } finally {
      if (requestId === queryRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [brand, category, color, makeParams, maxPriceCents, query, retailer]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(0, false), query.trim() ? 240 : 0);
    return () => window.clearTimeout(timer);
  }, [loadPage, query]);

  useEffect(() => {
    if (nextOffset == null || !sentinelRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !loading && !loadingMore) {
        void loadPage(nextOffset, true);
      }
    }, { rootMargin: '700px 0px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadPage, loading, loadingMore, nextOffset]);

  function styleThis(product: Product) {
    try {
      window.localStorage.setItem(PENDING_LOCK_KEY, JSON.stringify(product));
    } catch {
      // The main flow still works if private browsing blocks storage.
    }
    track('browse_style_this', {
      productId: product.id, category: product.category, brand: product.brand, surface: 'browse',
    });
    router.push('/');
  }

  function toggleWishlist(product: Product) {
    if (wishlistIds.has(product.id)) {
      removeItem(product.id);
      track('product_unsaved', { productId: product.id, surface: 'browse' });
    } else {
      addToWishlist(product, 'manual');
      setPoppedId(product.id);
      window.setTimeout(() => setPoppedId((current) => current === product.id ? null : current), 450);
      track('product_saved', {
        productId: product.id, category: product.category, brand: product.brand, surface: 'browse',
      });
    }
  }

  function updateFilter(name: string, value: string, apply: () => void) {
    apply();
    track('catalog_filter_changed', { filter: name, value: value || 'all', surface: 'browse' });
  }

  function clearFilters() {
    setQuery('');
    setCategory('all');
    setBrand('');
    setRetailer('');
    setColor('');
    setMaxPriceCents('');
    setSort('featured');
    track('catalog_filters_cleared', { surface: 'browse' });
  }

  const hasFilters = Boolean(query || category !== 'all' || brand || retailer || color || maxPriceCents);

  return (
    <main className="sy-game-screen relative min-h-[100dvh] overflow-x-hidden bg-bg pb-[120px] lg:pb-12">
      <AmbientField className="opacity-55" />
      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pt-[calc(env(safe-area-inset-top)+14px)] lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                aria-label="Back to For You"
                className="sy-press grid h-11 w-11 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink lg:hidden"
              >
                <ChevronLeft size={17} />
              </Link>
              <div>
                <p className="text-eyebrow font-extrabold uppercase text-accent">Exact retailer pages</p>
                <h1 className="mt-1 font-serif text-[34px] font-semibold italic leading-none text-ink lg:text-[48px]">
                  Browse the wardrobe
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-muted-2 lg:text-[15px]">
              Every piece here has a reviewed cutout and an exact product destination. Save it or build a complete look around it.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-money/30 bg-money/10 px-3 py-2 text-[11px] font-bold text-money">
            <BadgeCheck size={14} /> {total} exact-linked {total === 1 ? 'piece' : 'pieces'}
          </div>
        </header>

        <div className="mt-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <aside aria-labelledby="catalog-filters-heading" className="lg:sticky lg:top-6 lg:h-fit lg:rounded-[28px] lg:border lg:border-hairline lg:bg-surface-1 lg:p-5">
            <h2 id="catalog-filters-heading" className="sr-only">Catalog filters</h2>
            <div className="flex items-center gap-2 rounded-full border border-hairline-2 bg-surface-1/90 px-4 py-3 backdrop-blur-xl focus-within:border-accent/60 lg:bg-surface-2">
              <Search size={16} className="shrink-0 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Brand, color, or piece"
                aria-label="Search catalog"
                className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-ink outline-none placeholder:text-muted/70"
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-muted">
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide lg:mx-0 lg:grid lg:grid-cols-2 lg:px-0">
              {FILTERS.map((entry) => {
                const active = category === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => updateFilter('category', entry.id, () => setCategory(entry.id))}
                    aria-pressed={active}
                    className={`sy-press min-h-11 shrink-0 rounded-full px-3 text-[12px] font-semibold transition lg:rounded-xl ${
                      active ? 'bg-accent text-bg shadow-pink-glow' : 'border border-hairline bg-surface-2 text-muted-2'
                    }`}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              <FilterSelect label="Brand" value={brand} onChange={(value) => updateFilter('brand', value, () => setBrand(value))} options={facets.brands} />
              <FilterSelect label="Retailer" value={retailer} onChange={(value) => updateFilter('retailer', value, () => setRetailer(value))} options={facets.retailers} />
              <FilterSelect label="Color" value={color} onChange={(value) => updateFilter('color', value, () => setColor(value))} options={facets.colors} />
              <label className="rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                Price
                <select value={maxPriceCents} onChange={(event) => updateFilter('price', event.target.value, () => setMaxPriceCents(event.target.value))} className="mt-1 block w-full bg-transparent text-[12px] font-semibold normal-case tracking-normal text-ink outline-none">
                  {PRICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="col-span-2 rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted lg:col-span-1">
                Sort
                <select value={sort} onChange={(event) => updateFilter('sort', event.target.value, () => setSort(event.target.value))} className="mt-1 block w-full bg-transparent text-[12px] font-semibold normal-case tracking-normal text-ink outline-none">
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="newest">Newest first</option>
                </select>
              </label>
            </div>

            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="sy-press mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-hairline-2 text-[12px] font-bold text-muted-2">
                <SlidersHorizontal size={14} /> Clear filters
              </button>
            ) : null}
          </aside>

          <section className="mt-5 min-w-0 lg:mt-0" aria-labelledby="browse-results-heading" aria-busy={loading}>
            <h2 id="browse-results-heading" className="sr-only">Catalog results</h2>
            <div className="mb-4 flex items-center justify-between gap-4">
              <p role="status" aria-live="polite" className="text-[12px] font-semibold text-muted-2">
                {loading ? 'Finding pieces…' : `${total} ${total === 1 ? 'result' : 'results'}`}
                {query.trim() ? ` for “${query.trim()}”` : ''}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-[.14em] text-money">Exact product pages</span>
            </div>

            {error ? (
              <div role="alert" className="rounded-[24px] border border-accent/30 bg-accent-soft p-6 text-center">
                <p className="font-serif text-[21px] font-semibold text-ink">The wardrobe did not load.</p>
                <p className="mt-2 text-[13px] text-muted-2">{error}</p>
                <button type="button" onClick={() => void loadPage(0, false)} className="mt-4 min-h-11 rounded-full bg-accent px-5 text-[12px] font-bold text-bg">Try again</button>
              </div>
            ) : null}

            {!error && products.length ? (
              <div className={`grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-45' : 'opacity-100'}`}>
                {products.map((product, index) => {
                  const wishlisted = hasMounted && wishlistIds.has(product.id);
                  return (
                    <article key={product.id} className="group overflow-hidden rounded-[22px] border border-hairline bg-surface-1 shadow-card motion-safe:transition motion-safe:hover:-translate-y-1 hover:border-accent/45 hover:shadow-card-strong">
                      <button type="button" onClick={() => styleThis(product)} aria-label={`Build a look around ${product.brand} ${product.name}`} className="sy-press relative block w-full bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)] p-4">
                        <ProductImage product={product} transparentOnly loading={index < 8 ? 'eager' : 'lazy'} wrapperClassName="h-[138px] w-full lg:h-[180px]" className="h-full w-full object-contain drop-shadow-[0_12px_16px_rgba(24,12,10,.14)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.04]" />
                        <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-bg/85 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.1em] text-ink opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <WandSparkles size={11} className="text-accent" /> Style this
                        </span>
                      </button>
                      <div className="flex items-start justify-between gap-2 p-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-muted">{product.brand}</p>
                          <h2 className="mt-1 line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-snug text-ink">{product.name}</h2>
                          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-accent">
                            {formatPrice(product.priceCents)} <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-money" />
                            <span className="sr-only">Exact product page</span>
                          </p>
                          <p className="mt-1 truncate text-[10px] text-muted">{product.retailer}</p>
                        </div>
                        <button type="button" onClick={() => toggleWishlist(product)} aria-pressed={wishlisted} aria-label={wishlisted ? `Remove ${product.brand} ${product.name} from saved pieces` : `Save ${product.brand} ${product.name}`} className={`sy-press grid h-11 w-11 shrink-0 place-items-center rounded-full border ${wishlisted ? 'border-accent bg-accent-soft text-accent' : 'border-hairline-2 bg-surface-2 text-muted'}`}>
                          <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} className={poppedId === product.id ? 'sy-save-pop' : undefined} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!error && !loading && products.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-hairline-2 bg-surface-1 px-6 py-16 text-center">
                <Search size={24} className="mx-auto text-muted" />
                <p className="mt-4 font-serif text-[22px] font-semibold text-ink">No exact matches yet</p>
                <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-muted-2">Try a broader color, brand, or price. We only show pieces with exact retailer destinations.</p>
                <button type="button" onClick={clearFilters} className="mt-5 min-h-11 rounded-full bg-accent px-5 text-[12px] font-bold text-bg">Clear filters</button>
              </div>
            ) : null}

            <div ref={sentinelRef} aria-hidden className="h-px w-full" />
            {nextOffset != null ? (
              <div className="mt-6 flex justify-center">
                <button type="button" onClick={() => void loadPage(nextOffset, true)} disabled={loadingMore} className="sy-press min-h-11 rounded-full border border-hairline-2 bg-surface-2 px-6 text-[12px] font-bold text-ink disabled:opacity-60">
                  {loadingMore ? 'Loading…' : `Load more (${total - products.length} left)`}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full bg-transparent text-[12px] font-semibold normal-case tracking-normal text-ink outline-none">
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
