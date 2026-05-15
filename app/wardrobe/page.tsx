'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Heart,
  Layers,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { selectWardrobeItems, useWardrobe, type WardrobeItem } from '@/store/wardrobe';

const TABS = ['Clothes', 'Outfits', 'Collections'] as const;
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

export default function WardrobePage() {
  const items = useWardrobe(selectWardrobeItems);
  const removeItem = useWardrobe((state) => state.removeItem);
  const moveToCloset = useWardrobe((state) => state.moveToCloset);
  const moveToWishlist = useWardrobe((state) => state.moveToWishlist);
  const savedFits = useSavedFits((state) => state.fits);
  const replaceItems = useFit((state) => state.replaceItems);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('Clothes');
  const [filterLabel, setFilterLabel] = useState<string>('All');
  const [showWishlist, setShowWishlist] = useState(false);

  const closetItems = useMemo(() => items.filter((entry) => entry.status === 'closet'), [items]);
  const wishlistItems = useMemo(() => items.filter((entry) => entry.status === 'wishlist'), [items]);
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
  const categoriesCovered = new Set(closetItems.map((entry) => entry.product.category)).size;

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
            <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Your closet</div>
            <h1 className="mt-0.5 font-serif text-[26px] font-semibold leading-tight text-ink">
              Wardrobe
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowWishlist((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 ${
                showWishlist
                  ? 'border-accent bg-accent text-white shadow-pink-glow'
                  : 'border-white/14 bg-white/[0.06] text-white/80 hover:bg-white/12'
              }`}
            >
              <Heart size={12} fill={showWishlist ? 'currentColor' : 'none'} />
              {showWishlist ? 'Wishlist' : 'Closet'}
            </button>
            <div className="text-[10px] text-muted">
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
              className={`flex-1 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 ${
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
            onRemove={removeItem}
            onShop={shopProduct}
            onBuildAround={startBuildAround}
            onMove={(productId) => (showWishlist ? moveToCloset(productId) : moveToWishlist(productId))}
            isWishlist={showWishlist}
            totalCloset={totalCloset}
            categoriesCovered={categoriesCovered}
            estValueCents={estClosetValueCents}
            gapCategories={gapCategories}
          />
        ) : null}

        {tab === 'Outfits' ? <OutfitsTab fitsCount={savedFits.length} /> : null}

        {tab === 'Collections' ? (
          <CollectionsTab wishlistCount={wishlistItems.length} closetCount={totalCloset} />
        ) : null}
      </div>

      <BottomNav />
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
          <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Closet</div>
          <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{totalCloset}</div>
        </div>
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Categories</div>
          <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{categoriesCovered}/{CATEGORY_ORDER.length}</div>
        </div>
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[8px] font-bold uppercase tracking-[.16em] text-muted">Est. value</div>
          <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{estValueCents > 0 ? formatPrice(estValueCents) : '—'}</div>
        </div>
      </section>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_FILTERS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onFilter(option.label)}
            className={`flex-none rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 ${
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
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-accent">
            <Sparkles size={12} />
            Wardrobe gap
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-white/86">
            Missing: <strong className="text-white">{gapCategories.join(', ')}</strong>. Add pieces from
            <Link href="/feed" className="ml-1 underline decoration-accent decoration-[1.5px] underline-offset-2">/feed</Link> or
            <Link href="/build" className="ml-1 underline decoration-accent decoration-[1.5px] underline-offset-2">/build</Link>.
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
              : 'Add pieces from /feed, saved fits, or the /build catalog suggestions.'
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
              className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] shadow-[0_12px_28px_rgba(0,0,0,.26)]"
            >
              <button
                type="button"
                onClick={() => onRemove(item.productId)}
                className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/14 bg-black/55 text-white/85 backdrop-blur-md transition active:scale-90 hover:border-accent hover:text-accent"
                aria-label={`Remove ${item.product.brand} ${item.product.name}`}
              >
                <X size={13} />
              </button>
              <div className="aspect-square overflow-hidden bg-[linear-gradient(180deg,#fff7ef_0%,#f1e6da_100%)]">
                <ProductImage
                  product={item.product}
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-contain p-3 motion-safe:transition-transform motion-safe:duration-200 group-hover:scale-105"
                />
              </div>
              <div className="px-3 pb-3 pt-2">
                <div className="truncate text-[9px] font-bold uppercase tracking-[.16em] text-accent">{item.product.brand}</div>
                <div className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-tight text-ink">{item.product.name}</div>
                <div className="mt-0.5 text-[11px] text-muted">{formatPrice(item.product.priceCents)} · {item.product.category}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onMove(item.productId)}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-white/14 bg-white/[0.06] px-2 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:border-accent/55"
                    aria-label={isWishlist ? 'Move to closet' : 'Move to wishlist'}
                  >
                    {isWishlist ? <Bookmark size={10} /> : <Heart size={10} />}
                    {isWishlist ? 'Closet' : 'Wishlist'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuildAround(item.product)}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-accent/40 bg-accent/14 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-white transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-accent/22"
                    aria-label={`Build around ${item.product.name}`}
                  >
                    <Wand2 size={10} className="text-accent" />
                    Build
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onShop(item.product)}
                  className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-white/75 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:text-white"
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

function OutfitsTab({ fitsCount }: { fitsCount: number }) {
  if (fitsCount === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No saved outfits yet"
        body="Tap save on any feed card or build a fit to start your outfit library."
        primaryHref="/feed"
        primaryLabel="Browse feed"
        secondaryHref="/build"
        secondaryLabel="Open builder"
      />
    );
  }
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-center">
      <Layers size={28} className="mx-auto text-accent" />
      <div className="mt-2 font-serif text-[20px] font-semibold text-ink">Your saved fits live in /saved</div>
      <p className="mt-1 text-[12px] text-muted-2">
        We&apos;re consolidating the saved-fit detail view next sprint. For now, head to{' '}
        <Link href="/saved" className="underline decoration-accent decoration-[1.5px] underline-offset-2">/saved</Link>{' '}
        to remix or shop them.
      </p>
    </div>
  );
}

function CollectionsTab({ wishlistCount, closetCount }: { wishlistCount: number; closetCount: number }) {
  const cells: Array<{ label: string; count: number; description: string; href?: string }> = [
    { label: 'Wishlist', count: wishlistCount, description: 'Pieces saved to buy later', href: '/wardrobe' },
    { label: 'Closet', count: closetCount, description: 'Pieces you already own' },
    { label: 'Packing', count: 0, description: 'Coming next sprint — local trip checklists' },
    { label: 'Custom', count: 0, description: 'Coming next sprint — user-named collections' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_10px_24px_rgba(0,0,0,.18)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] font-bold uppercase tracking-[.18em] text-accent">{cell.label}</div>
            <div className="text-[11px] font-bold text-white/80">{cell.count}</div>
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-muted-2">{cell.description}</div>
        </div>
      ))}
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
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
        >
          {primaryLabel}
        </Link>
        {secondaryHref ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/14 bg-white/[0.06] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/85 transition active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
