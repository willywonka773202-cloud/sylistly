'use client';
import dynamic from 'next/dynamic';
import {
  Bookmark,
  Check,
  ExternalLink,
  Heart,
  Pencil,
  RotateCcw,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { CheckoutProduct } from '@/components/CheckoutSheet';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { Reveal } from '@/components/Reveal';
import { WornFlatlay } from '@/components/WornFlatlay';
import { colorSwatch, derivePalette } from '@/lib/color-harmony';
import { track } from '@/lib/analytics';
import { encodeLookSlug } from '@/lib/share-code-encode';
import { useFit } from '@/store/fit';
import { useSavedFits, type SavedFitRecord } from '@/store/saved-fits';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl, getShoppableUrl } from '@/lib/product-links';
import { hasExactProductLink, hasTransparentProductImage, isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
import { getStyleOwnedVerification, isVerifiedStyleOwnedProduct } from '@/lib/style-owned-product';
import type { Category, Product } from '@/lib/types';
import { VIBES, type VibeId } from '@/lib/vibes';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';
import { useDialogBehavior } from '@/lib/use-dialog-behavior';
import { isOwnedCheckoutProductId } from '@/lib/checkout';

// Collections ARE the real vibes (one source of truth — no invented "Travel"/
// "Work"). A fit's collection is the vibe it was generated under; legacy fits
// saved before we persisted the vibe fall back to title inference.
type Collection = string;
const VIBE_LABEL = Object.fromEntries(VIBES.map((vibe) => [vibe.id, vibe.label])) as Record<VibeId, string>;
const VIBE_LABEL_ORDER = VIBES.map((vibe) => vibe.label);
const REQUIRED_SHOP_CATEGORIES: Category[] = ['top', 'bottom', 'shoes'];

const CheckoutSheet = dynamic(
  () => import('@/components/CheckoutSheet').then((module) => module.CheckoutSheet),
  { ssr: false, loading: () => null },
);

function isStyleOwnedSavedSnapshot(product?: Product | null): product is Product {
  return Boolean(product && getStyleOwnedVerification(product));
}

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

// Legacy fallback (fits saved before the vibe was persisted): infer a REAL
// vibe label from product titles. Every result is a genuine vibe, never an
// invented bucket.
function inferVibeLabel(fit: SavedFitRecord): string {
  const products = Object.values(fit.items).filter((p): p is Product => Boolean(p));
  if (products.length === 0) return 'Clean';
  const titles = products.map((p) => `${p.brand} ${p.name}`).join(' ').toLowerCase();

  const hasAthletic = /\b(athletic|sport|training|gym|jogger|legging|hoodie|sweatpant|track)\b/.test(titles);
  const hasStreet = /\b(streetwear|cargo|graphic|sneaker|carhartt|stussy|dickies)\b/.test(titles);
  const hasFormal = /\b(trouser|blazer|loafer|button[- ]down|oxford|suit|dress shirt)\b/.test(titles);
  const hasDate = /\b(heel|dress|jewelry|leather skirt|sequin|satin|silk)\b/.test(titles);
  const hasTravel = /\b(linen|sandal|chino|polo|sun hat|tote)\b/.test(titles);

  if (hasAthletic) return 'Gym';
  if (hasStreet && !hasFormal) return 'Streetwear';
  if (hasFormal && !hasAthletic) return 'Office';
  if (hasDate) return 'Date night';
  if (hasTravel) return 'Vacation';
  return 'Clean';
}

// The fit's vibe — honest when persisted, inferred for legacy saves.
function collectionOf(fit: SavedFitRecord): string {
  return fit.vibe ? (VIBE_LABEL[fit.vibe] ?? inferVibeLabel(fit)) : inferVibeLabel(fit);
}

export default function SavedPage() {
  const fits = useSavedFits((state) => state.fits);
  const removeFit = useSavedFits((state) => state.removeFit);
  const replaceItems = useFit((state) => state.replaceItems);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const removeWardrobeItem = useWardrobe((state) => state.removeItem);
  const router = useRouter();

  const [view, setView] = useState<'fits' | 'pieces'>('fits');
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>('Saved fit');
  const [checkoutLookId, setCheckoutLookId] = useState<string | undefined>();
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<Collection>('All');
  const [detailFitId, setDetailFitId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ count: number } | null>(null);
  const [catalogResolution, setCatalogResolution] = useState<Map<string, Product>>(new Map());
  const [catalogRefreshState, setCatalogRefreshState] = useState<'loading' | 'ready' | 'error'>('loading');

  const catalogIds = useMemo(() => Array.from(new Set([
    ...fits.flatMap((fit) => Object.values(fit.items)
      .filter((product): product is Product => Boolean(product) && !isVerifiedStyleOwnedProduct(product))
      .map((product) => product.id)),
    ...wardrobeItems
      .filter((item) => !isVerifiedStyleOwnedProduct(item.product))
      .map((item) => item.productId),
  ])).sort(), [fits, wardrobeItems]);

  // Saved records intentionally keep their original visual snapshot. Commerce
  // actions re-resolve IDs through the strict published catalog after every
  // refresh, so an old price or unavailable item can never masquerade as live.
  useEffect(() => {
    const controller = new AbortController();
    if (!catalogIds.length) {
      setCatalogResolution(new Map());
      setCatalogRefreshState('ready');
      return () => controller.abort();
    }
    setCatalogRefreshState('loading');
    const batches: string[][] = [];
    for (let index = 0; index < catalogIds.length; index += 64) batches.push(catalogIds.slice(index, index + 64));
    void Promise.all(batches.map(async (ids) => {
      const response = await fetch(`/api/catalog?ids=${encodeURIComponent(ids.join(','))}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('catalog_refresh_failed');
      const payload = await response.json() as { products?: Product[] };
      return Array.isArray(payload.products) ? payload.products : [];
    })).then((groups) => {
      if (controller.signal.aborted) return;
      const products = groups.flat();
      setCatalogResolution(new Map(products.map((product) => [product.id, product])));
      setCatalogRefreshState('ready');
    }).catch(() => {
      if (controller.signal.aborted) return;
      setCatalogResolution(new Map());
      setCatalogRefreshState('error');
    });
    return () => controller.abort();
  }, [catalogIds]);

  // Resolve commerce from every saved slot, independently of whether its
  // snapshot can currently render. An image failure may change the preview,
  // but it must never make an incomplete fit appear complete or shoppable.
  const displayFits = useMemo(
    () =>
      fits
        .map((fit) => {
          const intendedEntries = Object.entries(fit.items).filter(
            (entry): entry is [Category, Product] => Boolean(entry[1]),
          );
          const intendedProducts = intendedEntries.map(([, product]) => product);
          const visualEntries = intendedEntries.filter(([, product]) => (
            (hasTransparentProductImage(product) && isHighConfidenceRenderableProduct(product))
            || isStyleOwnedSavedSnapshot(product)
          ) && !failedImageIds.has(product.id));
          const visualItems = Object.fromEntries(visualEntries) as Partial<Record<Category, Product>>;
          const visualProducts = visualEntries.map(([, product]) => product);
          const currentEntries = intendedEntries.flatMap(([category, snapshot]) => {
            const current = isVerifiedStyleOwnedProduct(snapshot)
              ? snapshot
              : catalogResolution.get(snapshot.id);
            return current ? [[category, current] as [Category, Product]] : [];
          });
          const currentItems = Object.fromEntries(currentEntries) as Partial<Record<Category, Product>>;
          const currentProducts = currentEntries.map(([, product]) => product);
          const purchasableProducts = currentProducts.filter((product) => (
            !isOwnedCheckoutProductId(product.id)
            && hasExactProductLink(product)
            && Boolean(getProductOutboundUrl(product))
          ));
          const currentTotalCents = purchasableProducts.reduce((sum, product) => sum + product.priceCents, 0);
          const unavailableCount = Math.max(0, intendedProducts.length - currentProducts.length);
          const missingCoreCategories = REQUIRED_SHOP_CATEGORIES.filter((category) => !currentItems[category]);
          const purchasableCount = purchasableProducts.length;
          const commerceReady = catalogRefreshState === 'ready'
            && intendedProducts.length > 0
            && unavailableCount === 0
            && missingCoreCategories.length === 0
            && purchasableCount > 0;
          const collection = collectionOf(fit);
          const swatches = derivePalette(
            visualProducts.map((p) => `${p.name} ${(p.colors || []).join(' ')}`).join(' ').toLowerCase(),
          )
            .map((word) => ({ word, hex: colorSwatch(word) }))
            .filter((s): s is { word: string; hex: string } => Boolean(s.hex))
            .slice(0, 4);
          return {
            fit,
            intendedProducts,
            visualItems,
            visualProducts,
            currentItems,
            currentProducts,
            currentTotalCents,
            purchasableCount,
            unavailableCount,
            missingCoreCategories,
            commerceReady,
            collection,
            swatches,
          };
        })
        .filter(({ intendedProducts }) => intendedProducts.length > 0),
    [fits, failedImageIds, catalogResolution, catalogRefreshState],
  );

  const stats = useMemo(() => {
    const totalFits = displayFits.length;
    if (totalFits === 0) {
      return { totalFits: 0, avgPriceCents: 0, topCollection: null as Collection | null, topCategory: null as Category | null };
    }
    const fullyVerifiedFits = displayFits.filter((entry) => entry.commerceReady);
    const totalCents = fullyVerifiedFits.reduce((sum, entry) => sum + entry.currentTotalCents, 0);
    const collectionCounts = new Map<Collection, number>();
    const categoryCounts = new Map<Category, number>();
    for (const entry of displayFits) {
      collectionCounts.set(entry.collection, (collectionCounts.get(entry.collection) || 0) + 1);
      for (const product of entry.intendedProducts) {
        categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
      }
    }
    const topCollection =
      Array.from(collectionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topCategory =
      Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return {
      totalFits,
      avgPriceCents: fullyVerifiedFits.length ? Math.round(totalCents / fullyVerifiedFits.length) : 0,
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

  // Only show chips for vibes the user actually has saved, in canonical VIBES
  // order — no empty/invented buckets.
  const orderedCollections = useMemo(() => {
    const present = new Set(displayFits.map((entry) => entry.collection));
    return ['All', ...VIBE_LABEL_ORDER.filter((label) => present.has(label))];
  }, [displayFits]);

  const visibleFits = useMemo(
    () => (activeFilter === 'All' ? displayFits : displayFits.filter((entry) => entry.collection === activeFilter)),
    [displayFits, activeFilter],
  );

  const currentWardrobeItems = useMemo(() => wardrobeItems.flatMap((item) => {
    const current = isVerifiedStyleOwnedProduct(item.product)
      ? item.product
      : catalogResolution.get(item.productId);
    return current ? [{ ...item, product: current }] : [];
  }), [wardrobeItems, catalogResolution]);
  const withheldReferenceCount = useMemo(() => {
    const unavailableFitPieces = displayFits.reduce((sum, entry) => sum + entry.unavailableCount, 0);
    return unavailableFitPieces + Math.max(0, wardrobeItems.length - currentWardrobeItems.length);
  }, [displayFits, wardrobeItems.length, currentWardrobeItems.length]);

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
      .filter((product) => !isOwnedCheckoutProductId(product.id))
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
    setCheckoutLookId(fit.id);
    setCheckoutProducts(items);
  }

  function savePieces(products: Product[]) {
    let added = 0;
    const productIds: string[] = [];
    for (const product of products) {
      if (isOwnedCheckoutProductId(product.id)) continue;
      addToWishlist(product, 'saved-fit');
      added += 1;
      productIds.push(product.id);
    }
    track('pieces_saved', {
      count: added,
      productIds,
      surface: 'saved',
      from: 'saved-fit',
    });
    setConfirmation({ count: added });
  }

  // Auto-dismiss the confirmation toast — effect-managed so the timer is
  // cleared on unmount (never setState on a torn-down component).
  useEffect(() => {
    if (!confirmation) return;
    const id = window.setTimeout(() => setConfirmation(null), 1600);
    return () => window.clearTimeout(id);
  }, [confirmation]);

  return (
    <PlaceholderScreen
      eyebrow="Saved wardrobe"
      title="Looks worth"
      accent="keeping"
      description="Revisit complete outfits, remix the styling, or shop the exact pieces you saved."
      maxWidthClassName="w-full max-w-none"
    >
      {confirmation ? (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+92px)] z-[60] mx-auto flex justify-center px-4 lg:left-[260px]">
          <div role="status" aria-live="polite" className="animate-sy-rise inline-flex items-center gap-2 rounded-full border border-accent/45 bg-[#1c0f15]/95 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_18px_44px_rgba(255,45,109,.55)] backdrop-blur-md">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
              <Check size={13} strokeWidth={3} />
            </span>
            {`Saved ${confirmation.count} piece${confirmation.count === 1 ? '' : 's'}`}
          </div>
        </div>
      ) : null}

      {/* Fits / Pieces toggle */}
      <div role="group" aria-label="Saved wardrobe view" className="sy-fade-up mb-4 grid grid-cols-2 gap-1 rounded-full border border-hairline bg-surface-1 p-1 lg:max-w-[360px]">
        {(['fits', 'pieces'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setView(tab)}
            aria-pressed={view === tab}
            className={`sy-press min-h-11 rounded-full py-2.5 text-[12px] font-bold uppercase tracking-[.12em] transition ${
              view === tab ? 'bg-accent text-bg shadow-pink-glow' : 'text-muted-2'
            }`}
          >
            {tab === 'fits' ? `Fits${displayFits.length ? ` (${displayFits.length})` : ''}` : `Pieces${currentWardrobeItems.length ? ` (${currentWardrobeItems.length})` : ''}`}
          </button>
        ))}
      </div>

      {catalogRefreshState === 'loading' ? (
        <p role="status" aria-live="polite" className="mb-4 rounded-card border border-hairline bg-surface-1 px-4 py-3 text-[12px] text-muted-2">
          Verifying current prices and availability for your saved wardrobe…
        </p>
      ) : catalogRefreshState === 'error' ? (
        <p role="alert" className="mb-4 rounded-card border border-[#dec889]/45 bg-[#dec889]/10 px-4 py-3 text-[12px] text-ink">
          Current retailer status could not be verified. Your saved references are still here, but shopping actions are withheld until verification succeeds.
        </p>
      ) : withheldReferenceCount > 0 ? (
        <p role="status" className="mb-4 rounded-card border border-[#dec889]/45 bg-[#dec889]/10 px-4 py-3 text-[12px] text-ink">
          {withheldReferenceCount} saved piece{withheldReferenceCount === 1 ? '' : 's'} no longer has fresh availability evidence. It remains in the saved visual, but is excluded from prices and shopping actions.
        </p>
      ) : null}

      {view === 'pieces' ? (
        <PiecesGrid items={currentWardrobeItems} onRemove={removeWardrobeItem} />
      ) : displayFits.length === 0 ? (
        <SavedEmptyState />
      ) : (
        <div className="sy-stagger grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
          <SavedStats stats={stats} />
          <CollectionFilters
            collections={orderedCollections}
            activeFilter={activeFilter}
            onChange={setActiveFilter}
            counts={collectionCounts}
          />
          <SavedActionPanel />
          {visibleFits.length === 0 ? (
            <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 text-center lg:col-start-1 lg:row-start-2">
              <p className="text-[12px] leading-relaxed text-muted-2">
                No saved fits match <strong className="text-white">{activeFilter}</strong> yet. Switch back to
                <button
                  type="button"
                  onClick={() => setActiveFilter('All')}
                  className="ml-1 inline-flex min-h-11 items-center text-accent underline decoration-accent decoration-[1.5px] underline-offset-2"
                >
                  All
                </button>{' '}
                or save more looks from{' '}
                <Link href="/" className="inline-flex min-h-11 items-center text-accent underline decoration-accent decoration-[1.5px] underline-offset-2">
                  For You
                </Link>
                .
              </p>
            </section>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:col-start-1 lg:row-start-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-4">
              {visibleFits.map(({ fit, intendedProducts, visualItems, visualProducts, currentProducts, currentTotalCents, purchasableCount, unavailableCount, collection, swatches }, i) => (
                <Reveal key={fit.id} as="div" delay={(i % 2) * 80}>
                <button
                  type="button"
                  aria-label={`Open saved fit ${fit.title}`}
                  onClick={() => setDetailFitId(fit.id)}
                  className="group relative block w-full overflow-hidden rounded-card border border-hairline bg-surface-1 text-left shadow-card transition active:scale-[0.97] motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-1 hover:border-accent/55 hover:shadow-[0_22px_44px_rgba(255,45,109,.28)]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {visualProducts.length >= 3 ? (
                      <WornFlatlay items={visualItems} active={false} loading={i < 2 ? 'eager' : 'lazy'} className="h-full w-full" />
                    ) : visualProducts.length === 0 ? (
                      <div className="grid h-full place-items-center bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)] px-5 text-center text-[11px] leading-relaxed text-[#6f625a]">
                        Saved preview temporarily unavailable
                      </div>
                    ) : (
                      <div className="grid h-full grid-cols-2 gap-1.5 bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)] p-3">
                        {visualProducts.slice(0, 4).map((product) => (
                          <ProductImage
                            key={`${fit.id}-tile-${product.id}`}
                            product={product}
                            transparentOnly={!isStyleOwnedSavedSnapshot(product)}
                            loading={i < 2 ? 'eager' : 'lazy'}
                            wrapperClassName="h-full w-full"
                            className="h-full w-full object-contain"
                            onUnavailable={(failedProduct) =>
                              setFailedImageIds((current) => new Set(current).add(failedProduct.id))
                            }
                          />
                        ))}
                      </div>
                    )}
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.14em] text-white backdrop-blur-md">
                      {collection}
                    </div>
                    {/* champagne light-rake on the above-fold cards, matching Discover */}
                    {i < 4 ? (
                      <span aria-hidden className="sy-card-sheen" style={{ animationDelay: `${i * 85 + 220}ms` }} />
                    ) : null}
                  </div>
                  <div className="px-3 pb-3 pt-2.5">
                    <div className="line-clamp-1 font-serif text-[15px] font-semibold italic leading-tight text-ink">
                      {fit.title}
                    </div>
                    {swatches.length >= 2 ? (
                      <div
                        className="mt-1.5 flex items-center gap-1.5"
                        aria-label={`Color palette: ${swatches.map((s) => s.word).join(', ')}`}
                      >
                        {swatches.map((s, di) => (
                          <span
                            key={`${s.word}-${di}`}
                            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                            style={{ background: s.hex }}
                          />
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                      <span>{currentProducts.length}/{intendedProducts.length} verified{unavailableCount ? ` · ${unavailableCount} withheld` : ''}</span>
                      <span className="font-bold text-accent">{purchasableCount ? `${formatPrice(currentTotalCents)}${unavailableCount ? ' subtotal' : ''}` : 'Owned only'}</span>
                    </div>
                  </div>
                </button>
                </Reveal>
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
          intendedCount={detail.intendedProducts.length}
          currentProducts={detail.currentProducts}
          currentTotalCents={detail.currentTotalCents}
          purchasableCount={detail.purchasableCount}
          unavailableCount={detail.unavailableCount}
          missingCoreCategories={detail.missingCoreCategories}
          commerceReady={detail.commerceReady}
          catalogRefreshState={catalogRefreshState}
          collection={detail.collection}
          onClose={() => setDetailFitId(null)}
          onLoadInBuilder={() => loadInBuilder(detail.currentItems)}
          onShop={() => {
            if (detail.commerceReady) shopAll(detail.fit, detail.currentProducts);
          }}
          onSavePieces={() => savePieces(detail.currentProducts)}
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
        lookId={checkoutLookId}
        products={checkoutProducts || []}
        onClose={() => { setCheckoutProducts(null); setCheckoutLookId(undefined); }}
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
    <section aria-labelledby="saved-summary-heading" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-start-2 lg:row-start-1 lg:grid-cols-2">
      <h2 id="saved-summary-heading" className="sr-only">Saved wardrobe summary</h2>
      <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5 motion-safe:animate-[pulse_.6s_ease-out_1]">
        <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Saved</div>
        <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{stats.totalFits}</div>
      </div>
      <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
        <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Avg verified</div>
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
  collections,
  activeFilter,
  onChange,
  counts,
}: {
  collections: string[];
  activeFilter: Collection;
  onChange: (filter: Collection) => void;
  counts: Map<Collection, number>;
}) {
  return (
    <div role="group" aria-label="Filter saved fits by vibe" className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide lg:col-start-1 lg:row-start-1 lg:self-center">
      {collections.map((label) => {
        const active = activeFilter === label;
        const count = counts.get(label) || 0;
        const hasMatches = count > 0;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label)}
            disabled={!hasMatches && label !== 'All'}
            aria-pressed={active}
            className={`min-h-11 flex-none rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] transition active:scale-[0.95] motion-safe:transition-all motion-safe:duration-200 ${
              active
                ? 'scale-[1.06] border-accent bg-accent text-bg shadow-[0_8px_22px_rgba(255,45,109,.5)] ring-1 ring-white/30'
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

interface WardrobePiece {
  id: string;
  productId: string;
  product: Product;
}

/** Saved individual pieces (the wishlist) — each shoppable, removable. */
function PiecesGrid({ items, onRemove }: { items: WardrobePiece[]; onRemove: (productId: string) => void }) {
  if (items.length === 0) {
    return (
      <section className="sy-card-strong rounded-[26px] p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent shadow-pink-glow">
          <Heart size={22} />
        </div>
        <h2 className="mt-3 font-serif text-[22px] font-semibold text-ink">No saved pieces yet</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
          Tap the heart on any piece in Browse, or save the pieces from a fit — they all land here, ready to shop.
        </p>
        <Link
          href="/browse"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-bg shadow-pink-glow transition active:scale-[0.97]"
        >
          <Sparkles size={11} />
          Browse pieces
        </Link>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map(({ product }) => {
        const owned = isOwnedCheckoutProductId(product.id);
        const url = owned
          ? ''
          : getShoppableUrl(product, {
              surface: 'saved-piece',
              subId: product.id,
            });
        const exact = !owned && hasExactProductLink(product);
        return (
          <div
            key={product.id}
            className="group relative overflow-hidden rounded-card border border-hairline bg-surface-1 shadow-card"
          >
            <button
              type="button"
              onClick={() => onRemove(product.id)}
              aria-label={`Remove ${product.brand} ${product.name}`}
              className="sy-press absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full border border-hairline-2 bg-bg/70 text-muted backdrop-blur-md transition hover:text-ink"
            >
              <X size={13} />
            </button>
            <div className="bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)] p-4">
              <ProductImage
                product={product}
                transparentOnly={!isStyleOwnedSavedSnapshot(product)}
                wrapperClassName="h-[140px] w-full"
                className="h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(24,12,10,.12)]"
              />
            </div>
            <div className="px-3 pb-3 pt-2.5">
              <p className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-muted">{product.brand}</p>
              <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-ink">{product.name}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-accent">
                  {formatPrice(product.priceCents || 0)}
                  {exact ? <><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-money" /><span className="sr-only">Exact product page</span></> : null}
                </span>
                {owned ? (
                  <span className="inline-flex min-h-11 items-center rounded-full border border-champagne/30 bg-champagne/10 px-3 py-1.5 text-[10px] font-bold text-champagne">
                    Owned
                  </span>
                ) : (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer sponsored"
                    onClick={() =>
                      track('shop_link_clicked', {
                        brand: product.brand,
                        productId: product.id,
                        retailer: product.retailer,
                        priceCents: product.priceCents,
                        exact,
                        attributed: true,
                        surface: 'saved-pieces',
                      })
                    }
                    className="sy-press inline-flex min-h-11 items-center gap-1 rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-bold text-accent transition hover:bg-accent hover:text-bg"
                  >
                    Shop
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SavedActionPanel() {
  return (
    <section className="rounded-[20px] border border-dashed border-white/12 bg-white/[0.025] p-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-2">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent/12 text-accent">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Saved actions</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-2">Open a fit to remix it in the builder or shop every piece in one tap.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/build"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-bg shadow-pink-glow transition active:scale-95"
            >
              <Wand2 size={11} />
              Remix a look
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.055] px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white/82 transition active:scale-95 hover:border-accent/45"
            >
              <Sparkles size={11} />
              For You
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
  intendedCount,
  currentProducts,
  currentTotalCents,
  purchasableCount,
  unavailableCount,
  missingCoreCategories,
  commerceReady,
  catalogRefreshState,
  collection,
  onClose,
  onLoadInBuilder,
  onShop,
  onSavePieces,
  onRemove,
  onProductFailed,
}: {
  fit: SavedFitRecord;
  visualItems: Partial<Record<Category, Product>>;
  visualProducts: Product[];
  intendedCount: number;
  currentProducts: Product[];
  currentTotalCents: number;
  purchasableCount: number;
  unavailableCount: number;
  missingCoreCategories: Category[];
  commerceReady: boolean;
  catalogRefreshState: 'loading' | 'ready' | 'error';
  collection: Collection;
  onClose: () => void;
  onLoadInBuilder: () => void;
  onShop: () => void;
  onSavePieces: () => void;
  onRemove: () => void;
  onProductFailed: (product: Product) => void;
}) {
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [editingTitle, setEditingTitle] = useState(false);
  const renameFit = useSavedFits((s) => s.renameFit);
  const dialogRef = useDialogBehavior<HTMLElement>(onClose);
  function commitTitle(value: string) {
    const next = value.trim().slice(0, 40);
    if (next && next !== fit.title) renameFit(fit.id, next);
    setEditingTitle(false);
  }
  // Encode only an exact recipient-resolvable fit. Device-only owned anchors
  // intentionally withhold sharing instead of publishing a partial look.
  const shareSlug = encodeLookSlug(visualItems);
  const shareUnavailableReason = shareSlug
    ? null
    : visualProducts.some((product) => product.id.startsWith('owned-'))
      ? 'Sharing is unavailable because this fit includes a piece saved only on this device.'
      : 'Sharing needs a complete top, bottom, and shoes.';
  async function handleShare() {
    if (!shareSlug || typeof window === 'undefined') return;
    const url = `${window.location.origin}/look/${shareSlug}`;
    const text = `My ${fit.title} on Sylistly`;
    track('saved_fit_shared', {
      lookId: fit.id,
      pieces: visualProducts.length,
      productIds: visualProducts.map((product) => product.id),
      surface: 'saved',
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Sylistly', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareState('copied');
        window.setTimeout(() => setShareState('idle'), 1600);
      }
    } catch {
      /* share sheet dismissed, or clipboard blocked — no-op */
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/65 backdrop-blur-sm lg:items-center lg:justify-center lg:p-8 lg:pl-[292px]">
      <button type="button" className="absolute inset-0" aria-label="Close saved fit" onClick={onClose} />
      <article ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="saved-fit-dialog-title" tabIndex={-1} className="sy-sheet-enter relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-22px_60px_rgba(0,0,0,.6)] outline-none lg:grid lg:max-w-[980px] lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] lg:gap-x-5 lg:rounded-[30px] lg:p-5">
        <h2 id="saved-fit-dialog-title" className="sr-only">Saved fit: {fit.title}</h2>
        <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20 lg:col-span-2" />

        <div className="flex items-start justify-between gap-3 lg:col-span-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[8px] font-bold uppercase tracking-[.22em] text-accent">
              <span className="inline-flex items-center gap-1">
                <Bookmark size={11} />
                Saved fit · {collection}
              </span>
            </div>
            {editingTitle ? (
              <input
                autoFocus
                defaultValue={fit.title}
                maxLength={40}
                aria-label="Rename this fit"
                onBlur={(event) => commitTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                  else if (event.key === 'Escape') setEditingTitle(false);
                }}
                className="mt-1 w-full border-b border-accent/50 bg-transparent font-serif text-[24px] font-semibold leading-tight text-ink outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                aria-label={`Rename fit, currently ${fit.title}`}
                className="group mt-1 flex min-h-11 items-start gap-1.5 text-left"
              >
                <span className="line-clamp-2 font-serif text-[24px] font-semibold leading-tight text-ink">{fit.title}</span>
                <Pencil size={13} className="mt-2 flex-none text-muted-2 transition group-hover:text-accent" />
              </button>
            )}
            <div className="mt-1 text-[11px] text-muted-2">
              {currentProducts.length}/{intendedCount} currently verified · <span className="font-semibold text-accent">{purchasableCount ? `${formatPrice(currentTotalCents)}${unavailableCount ? ' verified shop subtotal' : ' shop total'}` : 'No items to buy'}</span> · saved {formatDate(fit.createdAt)}
            </div>
            {catalogRefreshState === 'loading' ? (
              <p role="status" aria-live="polite" className="mt-2 text-[11px] leading-relaxed text-[#dec889]">
                Checking every saved piece before shopping is enabled…
              </p>
            ) : catalogRefreshState === 'error' ? (
              <p role="alert" className="mt-2 text-[11px] leading-relaxed text-[#dec889]">
                Shopping is withheld because current retailer status could not be verified.
              </p>
            ) : unavailableCount ? (
              <p role="status" className="mt-2 text-[11px] leading-relaxed text-[#dec889]">
                {unavailableCount} saved piece{unavailableCount === 1 ? '' : 's'} is shown as a reference but withheld from shopping until it can be freshly verified or replaced.
              </p>
            ) : missingCoreCategories.length ? (
              <p role="status" className="mt-2 text-[11px] leading-relaxed text-[#dec889]">
                Add a current {missingCoreCategories.join(', ')} {missingCoreCategories.length === 1 ? 'piece' : 'set'} in Remix before shopping this as a complete fit.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 flex-none place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 lg:col-start-2 lg:row-start-3">
          <DetailStat label="Pieces" value={`${currentProducts.length}/${intendedCount}`} />
          <DetailStat label={unavailableCount ? 'Shop subtotal' : 'Shop total'} value={purchasableCount ? formatPrice(currentTotalCents) : 'Owned'} />
          <DetailStat label="Saved" value={formatDate(fit.createdAt).split(',')[0]} />
        </div>

        {/* Large preview — same worn plate as the scroll */}
        <div className="mt-4 overflow-hidden rounded-card-lg ring-1 ring-hairline lg:col-start-1 lg:row-span-6 lg:row-start-3">
          {visualProducts.length >= 3 ? (
            <WornFlatlay items={visualItems} active={false} className="aspect-[4/5] w-full" />
          ) : visualProducts.length === 0 ? (
            <div className="grid aspect-[4/5] place-items-center bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)] px-8 text-center text-[12px] leading-relaxed text-[#6f625a]">
              The saved fit is intact, but its preview images are temporarily unavailable.
            </div>
          ) : (
            <div className="grid aspect-[4/5] grid-cols-2 gap-2 bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)] p-4">
              {visualProducts.slice(0, 4).map((product) => (
                <ProductImage
                  key={`${fit.id}-detail-${product.id}`}
                  product={product}
                  transparentOnly={!isStyleOwnedSavedSnapshot(product)}
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-contain"
                  onUnavailable={onProductFailed}
                />
              ))}
            </div>
          )}
        </div>

        {/* Key pieces strip */}
        <div className="mt-4 lg:col-start-2 lg:row-start-4">
          <div className="text-[8px] font-bold uppercase tracking-[.18em] text-muted">Key pieces</div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {Object.entries(visualItems).map(([category, product]) =>
              product ? (
                <div
                  key={`${fit.id}-piece-${product.id}`}
                  className="flex h-[64px] w-[180px] flex-none items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] p-1.5"
                >
                  <div className="h-full w-[60px] flex-none overflow-hidden">
                  <ProductImage product={product} displayMode="thumbnail" transparentOnly={!isStyleOwnedSavedSnapshot(product)} />
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
        <div className="mt-4 grid grid-cols-2 gap-2 lg:col-start-2 lg:row-start-5">
          <button
            type="button"
            onClick={onLoadInBuilder}
            disabled={!currentProducts.length}
            className="sy-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D_0%,#FF5C8A_60%,#FF2D6D_100%)] bg-[length:200%_100%] bg-left px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-bg shadow-[0_14px_32px_rgba(255,45,109,.5)] transition hover:bg-right active:scale-[0.97] motion-safe:transition-all motion-safe:duration-300 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw size={13} />
            Open in Remix
          </button>
          <button
            type="button"
            onClick={onShop}
            disabled={!commerceReady}
            aria-describedby={!commerceReady ? 'saved-shop-readiness' : undefined}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-white/90 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ShoppingBag size={13} />
            Shop fit
          </button>
        </div>
        <span id="saved-shop-readiness" className="sr-only">
          {commerceReady
            ? 'Every intended saved item and the required top, bottom, and shoes are currently verified.'
            : 'Shop fit is available only after every intended saved item and a top, bottom, and shoes are currently verified.'}
        </span>

        {/* Save the individual pieces to your Pieces tab */}
        <button
          type="button"
          onClick={onSavePieces}
          disabled={!currentProducts.length}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/12 px-3 py-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-white transition active:scale-[0.97] hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-45 lg:col-start-2 lg:row-start-6"
        >
          <Heart size={13} className="text-accent" />
          Save these pieces
        </button>

        {/* Share the fit as a DB-free /look link — a growth loop for saved fits */}
        {shareSlug ? (
          <button
            type="button"
            onClick={handleShare}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-white/90 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55 hover:text-white lg:col-start-2 lg:row-start-7"
          >
            {shareState === 'copied' ? <Check size={13} className="text-money" /> : <Share2 size={13} />}
            {shareState === 'copied' ? 'Link copied' : 'Share this fit'}
          </button>
        ) : shareUnavailableReason ? (
          <p className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] leading-relaxed text-muted-2 lg:col-start-2 lg:row-start-7">
            {shareUnavailableReason}
          </p>
        ) : null}
        <span className="sr-only" role="status" aria-live="polite">
          {shareState === 'copied' ? 'Fit link copied to clipboard.' : ''}
        </span>

        {/* Secondary actions */}
        <div className="mt-2 lg:col-start-2 lg:row-start-8">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-red-400/55 hover:text-red-300"
          >
            <Trash2 size={12} />
            Remove from saved
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
      <div className="sy-glow-breathe mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent shadow-pink-glow">
        <Bookmark size={22} />
      </div>
      <h2 className="mt-3 font-serif text-[22px] font-semibold text-ink">No saved fits yet</h2>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
        Save a look from the scroll or build one yourself — every fit lands here ready to remix, shop, or pull pieces from.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-bg shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
        >
          <Sparkles size={11} />
          Open For You
        </Link>
        <Link
          href="/build"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/14 bg-white/[0.06] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
        >
          <Wand2 size={11} />
          Open Remix
        </Link>
      </div>
    </section>
  );
}
