'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Check,
  Heart,
  Layers,
  Plus,
  ShoppingBag,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { ALL_CATALOG_PRODUCTS } from '@/lib/client-catalog';
import { isTransparentRenderableProduct } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits, type SavedFitRecord } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe, type WardrobeItem } from '@/store/wardrobe';

const TABS = ['Clothes', 'Insights', 'Outfits'] as const;
type Tab = (typeof TABS)[number];

const CATEGORY_FILTERS: Array<{ label: string; categories: Category[] | null }> = [
  { label: 'All', categories: null },
  { label: 'Tops', categories: ['top'] },
  { label: 'Bottoms', categories: ['bottom'] },
  { label: 'Shoes', categories: ['shoes'] },
  { label: 'Outerwear', categories: ['outer'] },
  { label: 'Accessories', categories: ['bag', 'hat', 'eyewear', 'jewelry'] },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function uniqueProducts(products: Product[], limit: number, excludedIds = new Set<string>()): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const product of products) {
    if (!isTransparentRenderableProduct(product)) continue;
    if (seen.has(product.id) || excludedIds.has(product.id)) continue;
    seen.add(product.id);
    out.push(product);
    if (out.length >= limit) break;
  }
  return out;
}

export default function WardrobePage() {
  const items = useWardrobe(selectWardrobeItems);
  const removeItem = useWardrobe((state) => state.removeItem);
  const moveToCloset = useWardrobe((state) => state.moveToCloset);
  const moveToWishlist = useWardrobe((state) => state.moveToWishlist);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const savedFits = useSavedFits((state) => state.fits);
  const feedPosts = useSocialFeed((state) => state.posts);
  const replaceItems = useFit((state) => state.replaceItems);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('Clothes');
  const [filterLabel, setFilterLabel] = useState<string>('All');
  const [showWishlist, setShowWishlist] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'wishlist') {
      setShowWishlist(true);
      setTab('Clothes');
      window.history.replaceState(null, '', '/wardrobe');
    }
    if (params.get('tab') === 'insights') {
      setTab('Insights');
      window.history.replaceState(null, '', '/wardrobe');
    }
  }, []);

  const displayableItems = useMemo(() => items.filter((entry) => isTransparentRenderableProduct(entry.product)), [items]);
  const closetItems = useMemo(() => displayableItems.filter((entry) => entry.status === 'closet'), [displayableItems]);
  const wishlistItems = useMemo(() => displayableItems.filter((entry) => entry.status === 'wishlist'), [displayableItems]);
  const visibleStatusItems = showWishlist ? wishlistItems : closetItems;

  const activeFilter = CATEGORY_FILTERS.find((option) => option.label === filterLabel) || CATEGORY_FILTERS[0];
  const filteredItems = useMemo(() => {
    if (!activeFilter.categories) return visibleStatusItems;
    const allowed = new Set(activeFilter.categories);
    return visibleStatusItems.filter((entry) => allowed.has(entry.product.category));
  }, [visibleStatusItems, activeFilter]);

  // Wardrobe gap = required categories with no closet entry. Pure read,
  // no fake suggestions — surfaces real holes the user can fill from the
  // existing /feed and /build flows.
  const gapCategories = useMemo<Category[]>(() => {
    const have = new Set(closetItems.map((entry) => entry.product.category));
    const required: Category[] = ['top', 'bottom', 'shoes', 'outer'];
    return required.filter((category) => !have.has(category));
  }, [closetItems]);

  const totalCloset = closetItems.length;
  const estClosetValueCents = closetItems.reduce((sum, entry) => sum + (entry.product.priceCents || 0), 0);
  const estWishlistValueCents = wishlistItems.reduce((sum, entry) => sum + (entry.product.priceCents || 0), 0);
  const categoriesCovered = new Set(closetItems.map((entry) => entry.product.category)).size;
  const wardrobeProductIds = useMemo(() => new Set(displayableItems.map((entry) => entry.productId)), [displayableItems]);
  const categoryDistribution = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      closet: closetItems.filter((entry) => entry.product.category === category).length,
      wishlist: wishlistItems.filter((entry) => entry.product.category === category).length,
    }));
  }, [closetItems, wishlistItems]);
  const topBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of displayableItems) {
      counts.set(entry.product.brand, (counts.get(entry.product.brand) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 5);
  }, [displayableItems]);
  const gapSuggestions = useMemo(() => {
    const feedProducts = feedPosts.flatMap((post) =>
      Object.values(post.items).filter((product): product is Product => Boolean(product)),
    );
    const topMissing = gapCategories.length ? gapCategories : CATEGORY_ORDER.filter((category) => !closetItems.some((entry) => entry.product.category === category));
    const suggestions = topMissing.flatMap((category) => {
      const fromFeed = feedProducts.filter((product) => product.category === category);
      const fromCatalog = ALL_CATALOG_PRODUCTS
        .filter((product) => product.category === category)
        .filter(isTransparentRenderableProduct)
        .sort((left, right) => {
          const leftScore = (left.imageQuality === 'good' ? 10 : 0) + (left.metadata?.featured ? 6 : 0) + (left.priceCents ? 2 : 0);
          const rightScore = (right.imageQuality === 'good' ? 10 : 0) + (right.metadata?.featured ? 6 : 0) + (right.priceCents ? 2 : 0);
          return rightScore - leftScore;
        });
      return uniqueProducts([...fromFeed, ...fromCatalog], 2, wardrobeProductIds);
    });
    return uniqueProducts(suggestions, 8, wardrobeProductIds);
  }, [closetItems, feedPosts, gapCategories, wardrobeProductIds]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function handleRemove(productId: string) {
    removeItem(productId);
    showToast('Removed from wardrobe');
  }

  function handleMove(productId: string) {
    if (showWishlist) {
      moveToCloset(productId);
      showToast('Moved to closet');
    } else {
      moveToWishlist(productId);
      showToast('Moved to wishlist');
    }
  }

  function saveSuggestion(product: Product) {
    addToWishlist(product, 'catalog');
    showToast('Added suggestion to wishlist');
  }

  function startBuildAround(product: Product) {
    // Drop the product into the active build slot and route to /build with
    // its category locked — same pattern feed uses for "Build around hero".
    replaceItems({ [product.category]: product } as Partial<Record<Category, Product>>);
    router.push(`/build?lock=${encodeURIComponent(product.category)}`);
  }

  function shopProduct(product: Product) {
    const url = getProductOutboundUrl(product);
    if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <header className="border-b border-hairline px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="sy-eyebrow">Your closet</div>
            <h1 className="mt-1 font-serif text-[26px] font-semibold leading-tight text-ink">
              Wardrobe
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowWishlist((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 ${
                showWishlist
                  ? 'border-accent bg-accent text-white shadow-pink-glow'
                  : 'border-white/14 bg-white/[0.06] text-white/80 hover:bg-white/12'
              }`}
            >
              <Heart size={12} fill={showWishlist ? 'currentColor' : 'none'} />
              {showWishlist ? 'Wishlist' : 'Closet'}
            </button>
            <div className="text-[11px] text-muted">
              {closetItems.length} closet · {wishlistItems.length} wishlist
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5">
          {TABS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(label)}
              className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 ${
                tab === label
                  ? 'bg-ink text-bg shadow-[0_8px_18px_rgba(0,0,0,.32)]'
                  : 'border border-white/12 bg-white/[0.04] text-white/65'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-3">
        {tab === 'Clothes' ? (
          <ClothesTab
            items={filteredItems}
            filterLabel={filterLabel}
            onFilter={setFilterLabel}
            onRemove={handleRemove}
            onShop={shopProduct}
            onBuildAround={startBuildAround}
            onMove={handleMove}
            isWishlist={showWishlist}
            totalCloset={totalCloset}
            categoriesCovered={categoriesCovered}
            estValueCents={estClosetValueCents}
            gapCategories={gapCategories}
          />
        ) : null}

        {tab === 'Insights' ? (
          <InsightsTab
            closetCount={closetItems.length}
            wishlistCount={wishlistItems.length}
            closetValueCents={estClosetValueCents}
            wishlistValueCents={estWishlistValueCents}
            categoryDistribution={categoryDistribution}
            topBrands={topBrands}
            missingCategories={gapCategories}
            suggestions={gapSuggestions}
            onWishlist={saveSuggestion}
            onBuildAround={startBuildAround}
            onShop={shopProduct}
          />
        ) : null}

        {tab === 'Outfits' ? <OutfitsTab fits={savedFits} /> : null}
      </div>

      <BottomNav />

      {toast ? (
        <div className="fixed inset-x-0 bottom-[86px] z-[70] mx-auto flex max-w-[480px] justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-accent/35 bg-[#15110f]/95 px-4 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow-[0_14px_42px_rgba(246,48,107,.35)] backdrop-blur-md">
            <Check size={13} className="text-accent" />
            {toast}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ClothesTab({
  items,
  filterLabel,
  onFilter,
  onRemove,
  onShop,
  onBuildAround,
  onMove,
  isWishlist,
  totalCloset,
  categoriesCovered,
  estValueCents,
  gapCategories,
}: {
  items: WardrobeItem[];
  filterLabel: string;
  onFilter: (label: string) => void;
  onRemove: (productId: string) => void;
  onShop: (product: Product) => void;
  onBuildAround: (product: Product) => void;
  onMove: (productId: string) => void;
  isWishlist: boolean;
  totalCloset: number;
  categoriesCovered: number;
  estValueCents: number;
  gapCategories: Category[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[.12em] text-muted">Closet</div>
          <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{totalCloset}</div>
        </div>
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[.12em] text-muted">Categories</div>
          <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{categoriesCovered}/{CATEGORY_ORDER.length}</div>
        </div>
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[.12em] text-muted">Est. value</div>
          <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{estValueCents > 0 ? formatPrice(estValueCents) : '—'}</div>
        </div>
      </section>

      <section className="rounded-[20px] border border-accent/25 bg-accent/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[.14em] text-accent">Closet coverage</div>
            <p className="mt-1 text-[12px] leading-relaxed text-white/84">
              {categoriesCovered}/{CATEGORY_ORDER.length} categories covered from real closet items.
            </p>
          </div>
          <div className="font-serif text-[24px] font-semibold text-white">
            {Math.round((categoriesCovered / CATEGORY_ORDER.length) * 100)}%
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-accent shadow-pink-glow"
            style={{ width: `${Math.max(8, Math.round((categoriesCovered / CATEGORY_ORDER.length) * 100))}%` }}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-1.5 pb-1">
        {CATEGORY_FILTERS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onFilter(option.label)}
            className={`flex-none rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 ${
              filterLabel === option.label
                ? 'bg-accent text-white shadow-pink-glow'
                : 'border border-white/12 bg-white/[0.04] text-white/70 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!isWishlist && gapCategories.length > 0 ? (
        <section className="rounded-[20px] border border-accent/30 bg-accent/10 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-accent">
            <Sparkles size={12} />
            Wardrobe gap
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-white/86">
            Missing: <strong className="text-white">{gapCategories.join(', ')}</strong>. Add pieces from
            <Link href="/feed" className="ml-1 underline decoration-accent decoration-[1.5px] underline-offset-2">the Feed</Link> or
            <Link href="/build" className="ml-1 underline decoration-accent decoration-[1.5px] underline-offset-2">Builder</Link>.
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={isWishlist ? Heart : Layers}
          title={isWishlist ? 'No wishlist items yet' : 'Your closet is empty'}
          body={
            isWishlist
              ? 'Tap the heart on any product to save it here for later.'
              : 'Add pieces from the Feed, your saved fits, or Builder suggestions.'
          }
          primaryHref="/feed"
          primaryLabel="Browse feed"
          secondaryHref="/build"
          secondaryLabel="Open builder"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="sy-lift sy-press group relative overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] shadow-[0_12px_28px_rgba(0,0,0,.26)] hover:border-accent/45"
            >
              <button
                type="button"
                onClick={() => onRemove(item.productId)}
                className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/14 bg-black/55 text-white/85 backdrop-blur-md transition active:scale-90 hover:border-accent hover:text-accent"
                aria-label={`Remove ${item.product.brand} ${item.product.name}`}
              >
                <X size={13} />
              </button>
              <div className="aspect-square overflow-hidden">
                <ProductImage
                  product={item.product}
                  transparentOnly
                  displayMode="closet"
                  className="h-full w-full object-contain p-3 drop-shadow-[0_12px_14px_rgba(60,32,18,.14)] motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.04]"
                />
              </div>
              <div className="px-3 pb-3 pt-2">
                <div className="truncate text-[11px] font-bold uppercase tracking-[.12em] text-accent">{item.product.brand}</div>
                <div className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-tight text-ink">{item.product.name}</div>
                <div className="mt-0.5 text-[11px] text-muted">{formatPrice(item.product.priceCents)} · {item.product.category}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onMove(item.productId)}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-white/14 bg-white/[0.06] px-2 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55"
                    aria-label={isWishlist ? 'Move to closet' : 'Move to wishlist'}
                  >
                    {isWishlist ? <Bookmark size={10} /> : <Heart size={10} />}
                    {isWishlist ? 'Closet' : 'Wishlist'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuildAround(item.product)}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-accent/40 bg-accent/14 px-2 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-white transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-accent/22"
                    aria-label={`Build around ${item.product.name}`}
                  >
                    <Wand2 size={10} className="text-accent" />
                    Build
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onShop(item.product)}
                  className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-white/75 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:text-white"
                >
                  <ShoppingBag size={10} />
                  Shop
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightsTab({
  closetCount,
  wishlistCount,
  closetValueCents,
  wishlistValueCents,
  categoryDistribution,
  topBrands,
  missingCategories,
  suggestions,
  onWishlist,
  onBuildAround,
  onShop,
}: {
  closetCount: number;
  wishlistCount: number;
  closetValueCents: number;
  wishlistValueCents: number;
  categoryDistribution: Array<{ category: Category; closet: number; wishlist: number }>;
  topBrands: Array<[string, number]>;
  missingCategories: Category[];
  suggestions: Product[];
  onWishlist: (product: Product) => void;
  onBuildAround: (product: Product) => void;
  onShop: (product: Product) => void;
}) {
  const maxCategoryCount = Math.max(1, ...categoryDistribution.map((entry) => entry.closet + entry.wishlist));
  const coveredCount = categoryDistribution.filter((entry) => entry.closet > 0).length;
  const coveragePercent = Math.round((coveredCount / CATEGORY_ORDER.length) * 100);

  return (
    <div className="flex flex-col gap-4">
      <section className="sy-card-strong rounded-[26px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[.14em] text-accent">Closet manager</div>
            <div className="mt-1 font-serif text-[22px] font-semibold leading-tight text-ink">
              {coveragePercent}% category coverage
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
              Insights are computed from pieces you added to closet and wishlist. Missing essentials stay visible until you fill them.
            </p>
          </div>
          <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-accent/18 text-accent">
            <BarChart3 size={19} />
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-accent shadow-pink-glow" style={{ width: `${Math.max(6, coveragePercent)}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.map((category) => {
            const covered = categoryDistribution.some((entry) => entry.category === category && entry.closet > 0);
            return (
              <span
                key={`coverage-${category}`}
                className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[.1em] ${
                  covered ? 'bg-accent text-white shadow-pink-glow' : 'border border-white/10 bg-white/[0.04] text-muted'
                }`}
              >
                {category}
              </span>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <InsightStat label="Closet pieces" value={closetCount.toString()} icon={Layers} />
        <InsightStat label="Wishlist" value={wishlistCount.toString()} icon={Heart} />
        <InsightStat label="Closet value" value={closetValueCents > 0 ? formatPrice(closetValueCents) : '$0'} icon={ShoppingBag} />
        <InsightStat label="Wishlist value" value={wishlistValueCents > 0 ? formatPrice(wishlistValueCents) : '$0'} icon={Bookmark} />
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-accent">
          <BarChart3 size={13} />
          Category distribution
        </div>
        <div className="mt-4 space-y-3">
          {categoryDistribution.map((entry) => {
            const total = entry.closet + entry.wishlist;
            const width = `${Math.max(6, Math.round((total / maxCategoryCount) * 100))}%`;
            return (
              <div key={entry.category}>
                <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[.1em] text-muted">
                  <span>{entry.category}</span>
                  <span>{entry.closet} closet · {entry.wishlist} wish</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-accent shadow-pink-glow" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] font-black uppercase tracking-[.14em] text-accent">Top brands</div>
          {topBrands.length === 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-2">Add closet or wishlist pieces to calculate real brand concentration.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {topBrands.map(([brand, count]) => (
                <span key={brand} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-white/85">
                  {brand} · {count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-accent/25 bg-accent/10 p-4">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-accent">
            <Sparkles size={13} />
            Gap assistant
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-white/85">
            {missingCategories.length > 0
              ? `Top missing closet categories: ${missingCategories.slice(0, 4).join(', ')}.`
              : 'Your required top, bottom, shoes, and outerwear categories are covered.'}
          </p>
          {missingCategories.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {missingCategories.slice(0, 5).map((category) => (
                <span key={`missing-${category}`} className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-black uppercase tracking-[.1em] text-white/82">
                  {category}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {suggestions.length > 0 ? (
        <section>
          <div className="mb-2 px-1">
            <div className="sy-eyebrow">Real suggestions</div>
            <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Fill the gaps</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {suggestions.map((product) => (
              <article
                key={product.id}
                className="w-[142px] flex-none overflow-hidden rounded-[20px] border border-white/12 bg-white/[0.055] shadow-[0_12px_28px_rgba(0,0,0,.28)]"
              >
                <button type="button" onClick={() => onBuildAround(product)} className="block w-full text-left">
                  <div className="relative h-[132px]">
                    <ProductImage product={product} displayMode="closet" transparentOnly />
                    <div className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.1em] text-white backdrop-blur-md">
                      {product.category}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-[11px] font-black uppercase tracking-[.1em] text-accent">{product.brand}</div>
                    <div className="mt-1 line-clamp-2 min-h-[30px] text-[11px] font-semibold leading-tight text-ink">{product.name}</div>
                    <div className="mt-1 text-[12px] font-bold text-white">{formatPrice(product.priceCents)}</div>
                  </div>
                </button>
                <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-2.5">
                  <button
                    type="button"
                    onClick={() => onWishlist(product)}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-white transition active:scale-95"
                  >
                    Wishlist
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuildAround(product)}
                    className="rounded-full bg-accent px-2 py-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-white shadow-pink-glow transition active:scale-95"
                  >
                    Build
                  </button>
                  <button
                    type="button"
                    onClick={() => onShop(product)}
                    className="col-span-2 rounded-full bg-white px-2 py-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-black transition active:scale-95"
                  >
                    Shop
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function InsightStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Plus;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[.12em] text-muted">{label}</div>
        <Icon size={13} className="text-accent" />
      </div>
      <div className="mt-2 font-serif text-[22px] font-semibold leading-none text-ink">{value}</div>
    </div>
  );
}

function FitPreviewCollage({ fit }: { fit: SavedFitRecord }) {
  const products = CATEGORY_ORDER.map((category) => fit.items[category]).filter(
    (product): product is Product => Boolean(product),
  ).slice(0, 6);

  return (
    <div className="sy-studio grid aspect-[3/4] grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden p-1.5">
      {products.map((product) => (
        <div key={product.id} className="overflow-hidden rounded-[10px]">
          <ProductImage product={product} displayMode="closet" transparentOnly />
        </div>
      ))}
    </div>
  );
}

function OutfitsTab({ fits }: { fits: SavedFitRecord[] }) {
  const preview = fits.slice(0, 4);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/saved" className="sy-press block">
        <section className="sy-card-strong rounded-card-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="sy-eyebrow">Saved outfits</div>
              <div className="mt-1 font-serif text-[22px] font-semibold leading-tight text-ink">
                {fits.length > 0 ? `${fits.length} saved ${fits.length === 1 ? 'fit' : 'fits'}` : 'Build your fit library'}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
                {fits.length > 0
                  ? 'Open Saved to remix, shop, or share the outfits you kept.'
                  : 'Save a look from the feed or the builder and it lands in your Saved tab.'}
              </p>
            </div>
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-accent/18 text-accent">
              <Bookmark size={19} />
            </span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[12px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow">
            View your saved outfits
            <ArrowRight size={14} />
          </div>
        </section>
      </Link>

      {preview.length > 0 ? (
        <section>
          <div className="mb-2 flex items-end justify-between gap-3 px-1">
            <div>
              <div className="sy-eyebrow">Recently saved</div>
              <div className="mt-0.5 font-serif text-[18px] font-semibold leading-tight text-ink">Your latest fits</div>
            </div>
            <Link
              href="/saved"
              className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[.12em] text-accent transition active:scale-[0.97]"
            >
              See all
              <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {preview.map((fit) => (
              <Link
                key={fit.id}
                href="/saved"
                className="sy-lift sy-press group block overflow-hidden rounded-card border border-hairline bg-surface-1 shadow-[0_12px_28px_rgba(0,0,0,.26)] hover:border-accent/45"
              >
                <FitPreviewCollage fit={fit} />
                <div className="px-3 pb-3 pt-2">
                  <div className="line-clamp-1 text-[12px] font-semibold leading-tight text-ink">{fit.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {fit.itemCount} {fit.itemCount === 1 ? 'piece' : 'pieces'} · {formatPrice(fit.totalCents)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Layers}
          title="No saved outfits yet"
          body="Tap save on any feed card or build a fit, then find it in your Saved tab."
          primaryHref="/feed"
          primaryLabel="Browse feed"
          secondaryHref="/build"
          secondaryLabel="Open builder"
        />
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  icon: typeof Plus;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
        <Icon size={20} />
      </div>
      <div className="mt-3 font-serif text-[20px] font-semibold text-ink">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-2">{body}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={primaryHref}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2.5 text-[11px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
        >
          {primaryLabel}
        </Link>
        {secondaryHref ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/14 bg-white/[0.06] px-3 py-2.5 text-[11px] font-bold uppercase tracking-[.12em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
