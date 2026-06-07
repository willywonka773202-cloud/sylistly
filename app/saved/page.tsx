'use client';
import dynamic from 'next/dynamic';
import {
  Bookmark,
  Check,
  Heart,
  Layers,
  RotateCcw,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CheckoutProduct } from '@/components/CheckoutSheet';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useFit } from '@/store/fit';
import { useSavedFits, type SavedFitRecord } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { hasTransparentProductImage, isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useWardrobe } from '@/store/wardrobe';

const COLLECTIONS = ['All', 'Clean', 'Streetwear', 'Gym', 'Date', 'Travel', 'Work'] as const;
type Collection = (typeof COLLECTIONS)[number];

const CheckoutSheet = dynamic(
  () => import('@/components/CheckoutSheet').then((module) => module.CheckoutSheet),
  { ssr: false, loading: () => null },
);

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function formatCompactPrice(cents: number): string {
  if (!cents) return '—';
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${Math.round(dollars / 100) / 10}k`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

// Heuristic collection inference from real product titles + categories.
// No fake tags — every classification is derived from what's actually
// in the saved fit. `All` is the bucket for fits we can't confidently
// classify; default fallback is `Clean` only when at least one normal
// outfit term is present.
function inferCollection(fit: SavedFitRecord): Collection {
  const products = Object.values(fit.items).filter((p): p is Product => Boolean(p));
  if (products.length === 0) return 'All';
  const titles = products.map((p) => `${p.brand} ${p.name}`).join(' ').toLowerCase();

  const hasAthletic = /\b(athletic|sport|training|gym|jogger|legging|hoodie|sweatpant|track)\b/.test(titles);
  const hasStreet = /\b(streetwear|cargo|graphic|sneaker|carhartt|stussy|dickies)\b/.test(titles);
  const hasFormal = /\b(trouser|blazer|loafer|button[- ]down|oxford|suit|dress shirt)\b/.test(titles);
  const hasDate = /\b(heel|dress|jewelry|leather skirt|sequin|satin|silk)\b/.test(titles);
  const hasTravel = /\b(linen|sandal|chino|polo|sun hat|tote)\b/.test(titles);

  if (hasAthletic) return 'Gym';
  if (hasStreet && !hasFormal) return 'Streetwear';
  if (hasFormal && !hasAthletic) return 'Work';
  if (hasDate) return 'Date';
  if (hasTravel) return 'Travel';
  return 'Clean';
}

export default function SavedPage() {
  const fits = useSavedFits((state) => state.fits);
  const removeFit = useSavedFits((state) => state.removeFit);
  const postFit = useSocialFeed((state) => state.postFit);
  const replaceItems = useFit((state) => state.replaceItems);
  const addToCloset = useWardrobe((state) => state.addToCloset);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const router = useRouter();

  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>('Saved fit');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<Collection>('All');
  const [detailFitId, setDetailFitId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: 'closet' | 'wishlist'; count: number } | null>(null);

  // Compute renderable view per fit once. Used by the grid, the
  // collection filter, and the stats card so collection-inference
  // operates on the same product set the user actually sees.
  const displayFits = useMemo(
    () =>
      fits
        .map((fit) => {
          const visualEntries = Object.entries(fit.items).filter(
            (entry): entry is [Category, Product] =>
              hasTransparentProductImage(entry[1]) && isHighConfidenceRenderableProduct(entry[1]) && !failedImageIds.has(entry[1].id),
          );
          const visualItems = Object.fromEntries(visualEntries) as Partial<Record<Category, Product>>;
          const visualProducts = visualEntries.map(([, product]) => product);
          const collection = inferCollection(fit);
          return { fit, visualItems, visualProducts, collection };
        })
        .filter(({ visualProducts }) => visualProducts.length > 0),
    [fits, failedImageIds],
  );

  const stats = useMemo(() => {
    const totalFits = displayFits.length;
    if (totalFits === 0) {
      return { totalFits: 0, avgPriceCents: 0, topCollection: null as Collection | null, topCategory: null as Category | null };
    }
    const totalCents = displayFits.reduce((sum, entry) => sum + entry.fit.totalCents, 0);
    const collectionCounts = new Map<Collection, number>();
    const categoryCounts = new Map<Category, number>();
    for (const entry of displayFits) {
      collectionCounts.set(entry.collection, (collectionCounts.get(entry.collection) || 0) + 1);
      for (const product of entry.visualProducts) {
        categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
      }
    }
    const topCollection =
      Array.from(collectionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topCategory =
      Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return {
      totalFits,
      avgPriceCents: Math.round(totalCents / totalFits),
      topCollection,
      topCategory,
    };
  }, [displayFits]);

  // Collection bucket → counts. Drives the filter chip badges so a chip
  // with 0 matches is visually quieter than one with matches.
  const collectionCounts = useMemo(() => {
    const counts = new Map<Collection, number>();
    counts.set('All', displayFits.length);
    for (const entry of displayFits) {
      counts.set(entry.collection, (counts.get(entry.collection) || 0) + 1);
    }
    return counts;
  }, [displayFits]);

  const visibleFits = useMemo(
    () => (activeFilter === 'All' ? displayFits : displayFits.filter((entry) => entry.collection === activeFilter)),
    [displayFits, activeFilter],
  );

  const detail = detailFitId
    ? displayFits.find((entry) => entry.fit.id === detailFitId) ?? null
    : null;

  function loadInBuilder(visualItems: Partial<Record<Category, Product>>) {
    replaceItems(visualItems);
    setDetailFitId(null);
    router.push('/build');
  }

  function shopAll(fit: SavedFitRecord, products: Product[]) {
    const items = products
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    setCheckoutTitle(fit.title);
    setCheckoutProducts(items);
  }

  function addAllToCloset(products: Product[]) {
    let added = 0;
    for (const product of products) {
      addToCloset(product, 'saved-fit');
      added += 1;
    }
    setConfirmation({ kind: 'closet', count: added });
    window.setTimeout(() => setConfirmation(null), 1600);
  }

  function addAllToWishlist(products: Product[]) {
    let added = 0;
    for (const product of products) {
      addToWishlist(product, 'saved-fit');
      added += 1;
    }
    setConfirmation({ kind: 'wishlist', count: added });
    window.setTimeout(() => setConfirmation(null), 1600);
  }

  return (
    <PlaceholderScreen
      eyebrow="Saved"
      title="Fits"
      accent="saved"
      description="Saved looks persist locally and can be remixed in Builder, shopped, or added to your closet."
    >
      {confirmation ? (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+92px)] z-[60] mx-auto flex max-w-[480px] justify-center px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/45 bg-[#1c0f15]/95 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_18px_44px_rgba(246,48,107,.55)] backdrop-blur-md">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
              <Check size={13} strokeWidth={3} />
            </span>
            Added {confirmation.count} piece{confirmation.count === 1 ? '' : 's'} to {confirmation.kind === 'closet' ? 'closet' : 'wishlist'}
          </div>
        </div>
      ) : null}

      {displayFits.length === 0 ? (
        <SavedEmptyState />
      ) : (
        <div className="grid gap-4">
          <SavedStats stats={stats} />
          <CollectionFilters
            activeFilter={activeFilter}
            onChange={setActiveFilter}
            counts={collectionCounts}
          />
          <SavedActionPanel />
          {visibleFits.length === 0 ? (
            <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 text-center">
              <p className="text-[12px] leading-relaxed text-muted-2">
                No saved fits match <strong className="text-white">{activeFilter}</strong> yet. Switch back to
                <button
                  type="button"
                  onClick={() => setActiveFilter('All')}
                  className="ml-1 text-accent underline decoration-accent decoration-[1.5px] underline-offset-2"
                >
                  All
                </button>{' '}
                or save more looks from{' '}
                <Link href="/feed" className="text-accent underline decoration-accent decoration-[1.5px] underline-offset-2">
                  /feed
                </Link>
                .
              </p>
            </section>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleFits.map(({ fit, visualProducts, collection }) => (
                <button
                  key={fit.id}
                  type="button"
                  aria-label={`Open saved fit ${fit.title}`}
                  onClick={() => setDetailFitId(fit.id)}
                  className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,#171512_0%,#0f0e0d_100%)] text-left shadow-[0_14px_30px_rgba(0,0,0,.32)] transition active:scale-[0.97] motion-safe:transition-all motion-safe:duration-200 hover:-translate-y-1 hover:border-accent/55 hover:shadow-[0_22px_44px_rgba(246,48,107,.32)]"
                >
                  <div className="relative aspect-[3/4] grid grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden bg-[#fff7ef] p-1.5">
                    {visualProducts.slice(0, 6).map((product, index) => (
                      <div
                        key={`${fit.id}-tile-${product.id}`}
                        className={`overflow-hidden rounded-[12px] bg-white/80 ring-1 ring-[#eadfd5] ${index === 0 ? 'row-span-2' : ''}`}
                      >
                        <ProductImage
                          product={product}
                          transparentOnly
                          wrapperClassName="h-full w-full"
                          className="h-full w-full object-contain p-1.5 motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.04]"
                          onUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                        />
                      </div>
                    ))}
                    <div className="absolute left-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.14em] text-white backdrop-blur-md">
                      {collection}
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-2">
                    <div className="line-clamp-1 font-serif text-[14px] font-semibold leading-tight text-[#fff5ee]">{fit.title}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-2">
                      <span>{visualProducts.length} pieces</span>
                      <span className="font-semibold text-accent">{formatPrice(fit.totalCents)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {detail ? (
        <SavedDetailSheet
          fit={detail.fit}
          visualItems={detail.visualItems}
          visualProducts={detail.visualProducts}
          collection={detail.collection}
          onClose={() => setDetailFitId(null)}
          onLoadInBuilder={() => loadInBuilder(detail.visualItems)}
          onShop={() => shopAll(detail.fit, detail.visualProducts)}
          onPost={() => {
            postFit(detail.visualItems, { title: detail.fit.title, vibe: detail.collection.toLowerCase(), visibility: 'public' });
            setDetailFitId(null);
          }}
          onAddAllToCloset={() => addAllToCloset(detail.visualProducts)}
          onAddAllToWishlist={() => addAllToWishlist(detail.visualProducts)}
          onRemove={() => {
            removeFit(detail.fit.id);
            setDetailFitId(null);
          }}
          onProductFailed={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
        />
      ) : null}

      {checkoutProducts ? (
      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
      ) : null}
    </PlaceholderScreen>
  );
}

function SavedStats({
  stats,
}: {
  stats: {
    totalFits: number;
    avgPriceCents: number;
    topCollection: Collection | null;
    topCategory: Category | null;
  };
}) {
  return (
    <section className="grid grid-cols-4 gap-2">
      <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5 motion-safe:animate-[pulse_.6s_ease-out_1]">
        <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Saved</div>
        <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{stats.totalFits}</div>
      </div>
      <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
        <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Avg fit</div>
        <div className="mt-0.5 whitespace-nowrap font-serif text-[18px] font-semibold leading-none text-ink">
          {formatCompactPrice(stats.avgPriceCents)}
        </div>
      </div>
      <div className="rounded-[16px] border border-accent/30 bg-accent/10 p-2.5">
        <div className="text-[8px] font-bold uppercase tracking-[.16em] text-accent">Top vibe</div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-white">{stats.topCollection || '—'}</div>
      </div>
      <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
        <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Most worn</div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">{stats.topCategory || '—'}</div>
      </div>
    </section>
  );
}

function CollectionFilters({
  activeFilter,
  onChange,
  counts,
}: {
  activeFilter: Collection;
  onChange: (filter: Collection) => void;
  counts: Map<Collection, number>;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {COLLECTIONS.map((label) => {
        const active = activeFilter === label;
        const count = counts.get(label) || 0;
        const hasMatches = count > 0;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label)}
            disabled={!hasMatches && label !== 'All'}
            className={`flex-none rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] transition active:scale-[0.95] motion-safe:transition-all motion-safe:duration-200 ${
              active
                ? 'scale-[1.06] border-accent bg-accent text-white shadow-[0_8px_22px_rgba(246,48,107,.5)] ring-1 ring-white/30'
                : hasMatches
                ? 'border-white/12 bg-white/[0.04] text-white/80 hover:border-accent/55 hover:bg-white/[0.08]'
                : 'cursor-not-allowed border-white/8 bg-white/[0.02] text-muted opacity-50'
            }`}
          >
            <span>{label}</span>
            {hasMatches && label !== 'All' ? (
              <span className={`ml-1.5 inline-block rounded-full px-1 text-[8px] ${active ? 'bg-white/25' : 'bg-white/12'}`}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SavedActionPanel() {
  return (
    <section className="rounded-[20px] border border-dashed border-white/12 bg-white/[0.025] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent/12 text-accent">
          <Layers size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Saved actions</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-2">Turn saved fits into the next build, feed post, or shopping session.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Link
              href="/build"
              className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-95"
            >
              Build
            </Link>
            <Link
              href="/feed"
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.055] px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white/82 transition active:scale-95 hover:border-accent/45"
            >
              Feed
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.055] px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white/82 transition active:scale-95 hover:border-accent/45"
            >
              Shop
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SavedDetailSheet({
  fit,
  visualItems,
  visualProducts,
  collection,
  onClose,
  onLoadInBuilder,
  onShop,
  onPost,
  onAddAllToCloset,
  onAddAllToWishlist,
  onRemove,
  onProductFailed,
}: {
  fit: SavedFitRecord;
  visualItems: Partial<Record<Category, Product>>;
  visualProducts: Product[];
  collection: Collection;
  onClose: () => void;
  onLoadInBuilder: () => void;
  onShop: () => void;
  onPost: () => void;
  onAddAllToCloset: () => void;
  onAddAllToWishlist: () => void;
  onRemove: () => void;
  onProductFailed: (product: Product) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/65 backdrop-blur-sm">
      <button className="absolute inset-0" aria-label="Close saved fit" onClick={onClose} />
      <article className="sy-sheet-enter relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-22px_60px_rgba(0,0,0,.6)]">
        <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.22em] text-accent">
              <Bookmark size={11} />
              Saved fit · {collection}
            </div>
            <h2 className="mt-1 line-clamp-2 font-serif text-[24px] font-semibold leading-tight text-ink">{fit.title}</h2>
            <div className="mt-1 text-[11px] text-muted-2">
              {visualProducts.length} pieces · <span className="font-semibold text-accent">{formatPrice(fit.totalCents)}</span> · saved {formatDate(fit.createdAt)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 flex-none place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <DetailStat label="Pieces" value={visualProducts.length.toString()} />
          <DetailStat label="Total" value={formatPrice(fit.totalCents)} />
          <DetailStat label="Saved" value={formatDate(fit.createdAt).split(',')[0]} />
        </div>

        {/* Large preview */}
        <div className="mt-4 rounded-[24px] border border-[#eadfd5] bg-[#fff7ef] p-2">
          <div className="grid h-[300px] grid-cols-2 grid-rows-3 gap-2 overflow-hidden rounded-[20px] bg-[#fffaf5] p-2">
            {visualProducts.slice(0, 6).map((product, index) => (
              <div
                key={`${fit.id}-detail-${product.id}`}
                className={`overflow-hidden rounded-[14px] ${index === 0 ? 'row-span-2' : ''}`}
              >
                <ProductImage
                  product={product}
                  transparentOnly
                  displayMode="moodboard"
                  onUnavailable={onProductFailed}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Key pieces strip */}
        <div className="mt-4">
          <div className="text-[8px] font-bold uppercase tracking-[.18em] text-muted">Key pieces</div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {Object.entries(visualItems).map(([category, product]) =>
              product ? (
                <div
                  key={`${fit.id}-piece-${product.id}`}
                  className="flex h-[64px] w-[180px] flex-none items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] p-1.5"
                >
                  <div className="h-full w-[60px] flex-none overflow-hidden">
                    <ProductImage product={product} displayMode="thumbnail" transparentOnly />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[8px] font-bold uppercase tracking-[.14em] text-accent">{category}</div>
                    <div className="line-clamp-2 text-[10px] font-semibold leading-tight text-ink">{product.brand}</div>
                    <div className="truncate text-[10px] text-muted">{formatPrice(product.priceCents)}</div>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>

        {/* Primary actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onLoadInBuilder}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#f6306b_0%,#ff7099_60%,#f6306b_100%)] bg-[length:200%_100%] bg-left px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow-[0_14px_32px_rgba(246,48,107,.5)] transition hover:bg-right active:scale-[0.97] motion-safe:transition-all motion-safe:duration-300"
          >
            <RotateCcw size={13} />
            Remix in Builder
          </button>
          <button
            type="button"
            onClick={onShop}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-white/90 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55 hover:text-white"
          >
            <ShoppingBag size={13} />
            Shop fit
          </button>
        </div>

        {/* Cross-store actions */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onAddAllToCloset}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/12 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-accent/20"
          >
            <Layers size={12} className="text-accent" />
            Add all to closet
          </button>
          <button
            type="button"
            onClick={onAddAllToWishlist}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55"
          >
            <Heart size={12} className="text-accent" />
            Add to wishlist
          </button>
        </div>

        {/* Secondary actions */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPost}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/75 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/45 hover:text-white"
          >
            <Send size={12} />
            Post to feed
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-red-400/55 hover:text-red-300"
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      </article>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="text-[8px] font-black uppercase tracking-[.16em] text-muted">{label}</div>
      <div className="mt-1 truncate font-serif text-[16px] font-semibold leading-none text-ink">{value}</div>
    </div>
  );
}

function SavedEmptyState() {
  return (
    <section className="sy-card-strong rounded-[26px] p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent shadow-pink-glow">
        <Bookmark size={22} />
      </div>
      <h2 className="mt-3 font-serif text-[22px] font-semibold text-ink">No saved fits yet</h2>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
        Save a look from the feed or build one in Builder — every fit lands here ready to remix, shop, or move to your closet.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Link
          href="/feed"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
        >
          <Sparkles size={11} />
          Browse feed
        </Link>
        <Link
          href="/build"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/14 bg-white/[0.06] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
        >
          <Wand2 size={11} />
          Open builder
        </Link>
        <Link
          href="/discover"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/14 bg-white/[0.06] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
        >
          <ShoppingBag size={11} />
          Discover
        </Link>
      </div>
    </section>
  );
}
