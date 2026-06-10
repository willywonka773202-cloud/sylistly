'use client';

import {
  Bookmark,
  Check,
  Lock,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  WandSparkles,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { Onboarding } from '@/components/Onboarding';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { buildCatalogLook } from '@/lib/client-catalog';
import { getLibraryLook } from '@/lib/outfit-library';
import { getProductOutboundUrl } from '@/lib/product-links';
import type { Category, Product } from '@/lib/types';
import { VIBES, type GeneratorFrame, type VibeId } from '@/lib/vibes';
import { useCheckout } from '@/store/checkout';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';

const ONBOARDED_KEY = 'sylistly.onboarded.v1';

/** Curated rotation so consecutive cards feel like turning magazine pages. */
const VIBE_ROTATION: VibeId[] = [
  'street', 'clean', 'night', 'cozy', 'date', 'edgy', 'office', 'preppy', 'vacation', 'gym',
];

const VIBE_META = new Map(VIBES.map((vibe) => [vibe.id, vibe]));

const CATEGORY_NOUN: Record<Category, string> = {
  hat: 'hat',
  outer: 'layer',
  top: 'top',
  bottom: 'bottoms',
  shoes: 'shoes',
  bag: 'bag',
  eyewear: 'frames',
  jewelry: 'jewelry',
};

const MAX_LOOKS = 60;

interface ScrollLook {
  key: string;
  vibe: VibeId;
  items: Partial<Record<Category, Product>>;
  /** bumped on every restyle so the plate can remount with a fade */
  gen: number;
}

function lookProducts(items: Partial<Record<Category, Product>>): Product[] {
  return Object.values(items).filter((product): product is Product => Boolean(product));
}

function lookTotalCents(items: Partial<Record<Category, Product>>): number {
  return lookProducts(items).reduce((sum, product) => sum + (product.priceCents || 0), 0);
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/**
 * One look, instantly: pre-generated library first (best coordination scores),
 * live client-side compose as fallback — and always live compose when pieces
 * are locked, because locks are the one thing the library can't honor.
 */
function composeScrollLook(
  vibe: VibeId,
  frame: GeneratorFrame,
  seed: number,
  avoidProductIds: string[],
  lockedItems?: Partial<Record<Category, Product>>,
): Partial<Record<Category, Product>> | null {
  const hasLocks = lockedItems && Object.keys(lockedItems).length > 0;
  if (!hasLocks) {
    const library = getLibraryLook(vibe, frame, { seed, avoidProductIds });
    if (library) return library.products;
  }
  const built = buildCatalogLook({
    vibe,
    frame,
    budget: 'any',
    mode: 'full',
    seed,
    avoidProductIds,
    lockedItems,
    currentItems: lockedItems,
    // Same gate the pre-generated library passes through — clean garment
    // cutouts only, never a model photo on the plate.
    transparentOnly: true,
  });
  return lookProducts(built.products).length >= 3 ? built.products : null;
}

/** Honest stylist note derived from what's actually in the look. */
function syliNote(look: ScrollLook): string {
  const meta = VIBE_META.get(look.vibe);
  const products = lookProducts(look.items);
  if (!products.length || !meta) return '';
  const hero = products.reduce((best, candidate) =>
    (candidate.priceCents || 0) > (best.priceCents || 0) ? candidate : best,
  );
  const blurb = meta.blurb.charAt(0).toUpperCase() + meta.blurb.slice(1);
  return `${blurb} — anchored by the ${hero.brand} ${CATEGORY_NOUN[hero.category] || 'piece'}.`;
}

export default function ScrollPage() {
  const router = useRouter();
  const replaceItems = useFit((state) => state.replaceItems);
  const saveFit = useSavedFits((state) => state.saveFit);
  const setCheckout = useCheckout((state) => state.setCheckout);
  const profileFrame = useProfile((state) => state.profile.bodyType);
  const setBodyType = useProfile((state) => state.setBodyType);

  const frame: GeneratorFrame = profileFrame === 'custom' ? 'androgynous' : profileFrame;

  const [hasMounted, setHasMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [vibeFilter, setVibeFilter] = useState<VibeId | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [locks, setLocks] = useState<Record<string, Category[]>>({});
  const [toast, setToast] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const seedRef = useRef(101);
  const indexRef = useRef(0);
  const recentIdsRef = useRef<string[]>([]);
  const toastTimer = useRef<number | null>(null);

  const makeLooks = useCallback(
    (count: number, useFrame: GeneratorFrame, filter: VibeId | 'all'): ScrollLook[] => {
      const fresh: ScrollLook[] = [];
      let attempts = 0;
      while (fresh.length < count && attempts < count * 4) {
        attempts += 1;
        const vibe = filter === 'all' ? VIBE_ROTATION[indexRef.current % VIBE_ROTATION.length] : filter;
        indexRef.current += 1;
        seedRef.current += 17;
        const items = composeScrollLook(vibe, useFrame, seedRef.current, recentIdsRef.current);
        if (!items) continue;
        const ids = lookProducts(items).map((product) => product.id);
        recentIdsRef.current = [...recentIdsRef.current, ...ids].slice(-80);
        fresh.push({ key: `look-${seedRef.current}`, vibe, items, gen: 0 });
      }
      return fresh;
    },
    [],
  );

  // Deterministic first render (default frame, no filter) so SSR HTML and the
  // first client paint match; personalization re-rolls after mount.
  const [looks, setLooks] = useState<ScrollLook[]>(() => makeLooks(4, 'androgynous', 'all'));

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem(ONBOARDED_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  // Re-roll the deck when the user's frame or vibe filter changes (post-mount).
  useEffect(() => {
    if (!hasMounted) return;
    recentIdsRef.current = [];
    setLocks({});
    setLooks(makeLooks(4, frame, vibeFilter));
    scrollerRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, vibeFilter, hasMounted]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * 2) {
      setLooks((prev) =>
        prev.length >= MAX_LOOKS ? prev : [...prev, ...makeLooks(3, frame, vibeFilter)],
      );
    }
  }

  function toggleLock(lookKey: string, category: Category) {
    setLocks((prev) => {
      const current = prev[lookKey] || [];
      const next = current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category];
      return { ...prev, [lookKey]: next };
    });
  }

  function restyle(look: ScrollLook) {
    const lockedCategories = locks[look.key] || [];
    const lockedItems: Partial<Record<Category, Product>> = {};
    for (const category of lockedCategories) {
      const product = look.items[category];
      if (product) lockedItems[category] = product;
    }
    const lockedIds = new Set(Object.values(lockedItems).map((product) => product?.id));
    seedRef.current += 17;
    const avoid = recentIdsRef.current.filter((id) => !lockedIds.has(id));
    const items = composeScrollLook(look.vibe, frame, seedRef.current, avoid, lockedItems);
    if (!items) {
      showToast('No fresh take found — try unlocking a piece');
      return;
    }
    recentIdsRef.current = [
      ...recentIdsRef.current,
      ...lookProducts(items).map((product) => product.id),
    ].slice(-80);
    setLooks((prev) =>
      prev.map((entry) =>
        entry.key === look.key ? { ...entry, items, gen: entry.gen + 1 } : entry,
      ),
    );
  }

  function save(look: ScrollLook) {
    const record = saveFit(look.items);
    showToast(record ? 'Saved to your looks' : 'Could not save this one');
  }

  function remix(look: ScrollLook) {
    replaceItems(look.items);
    router.push('/build');
  }

  function shop(look: ScrollLook) {
    const meta = VIBE_META.get(look.vibe);
    const products = lookProducts(look.items)
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    setCheckout({ title: `${meta?.label || 'Sylistly'} fit`, products });
    router.push('/checkout');
  }

  async function share(look: ScrollLook) {
    const meta = VIBE_META.get(look.vibe);
    const products = lookProducts(look.items);
    const text = `${meta?.label || 'A'} fit on Sylistly — ${products
      .slice(0, 3)
      .map((product) => product.brand)
      .join(', ')} + ${Math.max(0, products.length - 3)} more, ${formatPrice(lookTotalCents(look.items))} total.`;
    const url = typeof window !== 'undefined' ? window.location.origin : 'https://sylistly.com';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Sylistly', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      showToast('Copied to clipboard');
    } catch {
      /* user dismissed the share sheet */
    }
  }

  function completeOnboarding(pickedFrame: GeneratorFrame, vibe: VibeId) {
    window.localStorage.setItem(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
    setBodyType(pickedFrame);
    setVibeFilter(vibe);
  }

  function skipOnboarding() {
    window.localStorage.setItem(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
  }

  return (
    <main className="relative mx-auto h-[100dvh] max-w-[480px] overflow-hidden bg-bg">
      <h1 className="sr-only">Sylistly — endless outfits from real products</h1>

      {/* Top chrome */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-6 rounded-full bg-accent" aria-hidden />
          <span className="text-eyebrow font-extrabold uppercase text-champagne">Sylistly</span>
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((open) => !open)}
          aria-expanded={filterOpen}
          aria-label="Filter vibes"
          className="sy-press pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink backdrop-blur-md"
        >
          {filterOpen ? <X size={17} /> : <SlidersHorizontal size={17} />}
        </button>
      </header>

      {/* Vibe filter rail */}
      {filterOpen ? (
        <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+62px)] z-30 animate-sy-rise px-4">
          <div className="flex gap-2 overflow-x-auto rounded-card border border-hairline bg-surface-1/90 p-2 backdrop-blur-xl scrollbar-hide">
            <VibeChip
              label="For you"
              active={vibeFilter === 'all'}
              onClick={() => { setVibeFilter('all'); setFilterOpen(false); }}
            />
            {VIBES.map((vibe) => (
              <VibeChip
                key={vibe.id}
                label={vibe.label}
                active={vibeFilter === vibe.id}
                onClick={() => { setVibeFilter(vibe.id); setFilterOpen(false); }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* The scroll */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-hide"
      >
        {looks.map((look, index) => {
          const meta = VIBE_META.get(look.vibe);
          const products = lookProducts(look.items);
          const lockedCategories = locks[look.key] || [];
          const total = lookTotalCents(look.items);
          return (
            <section
              key={look.key}
              aria-label={`${meta?.label || 'Outfit'} look`}
              className="relative h-[100dvh] snap-start snap-always overflow-hidden"
            >
              {/* Atmosphere: alternating accent/champagne spotlight + film grain */}
              <div
                aria-hidden
                className={`absolute inset-0 ${
                  index % 2 === 0
                    ? 'bg-[radial-gradient(120%_72%_at_50%_24%,rgba(255,59,99,.09),transparent_62%)]'
                    : 'bg-[radial-gradient(120%_72%_at_50%_24%,rgba(231,199,155,.08),transparent_62%)]'
                }`}
              />
              <div aria-hidden className="sy-grain absolute inset-0 opacity-[.05] mix-blend-overlay" />

              {/* The plate */}
              <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+58px)] bottom-[268px]">
                <div
                  key={`${look.key}-gen-${look.gen}`}
                  className="h-full animate-sy-fade overflow-hidden rounded-card-lg ring-1 ring-hairline shadow-card-strong"
                >
                  <OutfitLookCard
                    items={products}
                    presentation="flatlay"
                    productLinks={false}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Legibility gradient */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[320px] bg-[linear-gradient(180deg,transparent,rgba(10,10,12,.88)_58%,#0A0A0C_92%)]"
              />

              {/* Right action rail */}
              <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+196px)] right-3 z-20 flex flex-col items-center gap-3.5">
                <RailAction label="Save" onClick={() => save(look)}>
                  <Bookmark size={19} />
                </RailAction>
                <RailAction label="Remix in builder" onClick={() => remix(look)} accent>
                  <WandSparkles size={19} />
                </RailAction>
                <RailAction label={`Shop all pieces, ${formatPrice(total)} total`} onClick={() => shop(look)}>
                  <ShoppingBag size={19} />
                </RailAction>
                <RailAction label="Share" onClick={() => share(look)}>
                  <Share2 size={19} />
                </RailAction>
              </div>

              {/* Meta */}
              <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-10 px-4 pr-[72px]">
                <p className="text-eyebrow font-extrabold uppercase text-champagne">Syli&apos;s note</p>
                <p className="mt-1 max-w-[34ch] text-[13px] font-medium leading-snug text-muted-2">
                  {syliNote(look)}
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <h2 className="font-serif text-[34px] font-semibold italic leading-[.95] text-ink">
                    {meta?.label || 'The look'}
                  </h2>
                  <span className="text-[14px] font-bold text-money">{formatPrice(total)}</span>
                </div>

                {/* Piece chips — tap to lock, then restyle around what you love */}
                <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
                  {products.map((product) => {
                    const locked = lockedCategories.includes(product.category);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => toggleLock(look.key, product.category)}
                        aria-pressed={locked}
                        aria-label={`${locked ? 'Unlock' : 'Lock'} ${product.brand} ${CATEGORY_NOUN[product.category]}`}
                        className={`sy-press flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 backdrop-blur-md transition ${
                          locked
                            ? 'border-accent bg-accent-soft text-ink shadow-pink-glow'
                            : 'border-hairline-2 bg-surface-2/70 text-muted-2'
                        }`}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-ink/95">
                          <ProductImage
                            product={product}
                            wrapperClassName="h-6 w-6"
                            className="h-6 w-6 object-contain"
                            transparentOnly
                          />
                        </span>
                        <span className="text-[11px] font-semibold capitalize">
                          {CATEGORY_NOUN[product.category]}
                        </span>
                        <span className="text-[11px] font-medium text-muted">
                          {formatPrice(product.priceCents || 0)}
                        </span>
                        {locked ? <Lock size={11} className="text-accent" /> : null}
                      </button>
                    );
                  })}
                </div>

                {lockedCategories.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => restyle(look)}
                    className="sy-press mt-3 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3B63,#FF6E8A)] px-4 py-2.5 text-[13px] font-bold text-white shadow-pink-glow"
                  >
                    <WandSparkles size={15} />
                    Restyle around {lockedCategories.length} locked
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-40 flex justify-center">
          <span className="flex animate-sy-rise items-center gap-1.5 rounded-full border border-hairline-2 bg-surface-2/95 px-4 py-2 text-[12px] font-semibold text-ink shadow-card backdrop-blur-md">
            <Check size={13} className="text-money" />
            {toast}
          </span>
        </div>
      ) : null}

      {hasMounted && showOnboarding ? (
        <Onboarding onComplete={completeOnboarding} onSkip={skipOnboarding} />
      ) : null}

      <BottomNav />
    </main>
  );
}

function VibeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`sy-press shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
        active ? 'bg-accent text-white shadow-pink-glow' : 'bg-surface-3 text-muted-2'
      }`}
    >
      {label}
    </button>
  );
}

function RailAction({
  label,
  onClick,
  accent = false,
  children,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`sy-press grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md transition active:scale-90 ${
        accent
          ? 'border-accent/50 bg-accent text-white shadow-pink-glow'
          : 'border-hairline-2 bg-surface-2/70 text-ink'
      }`}
    >
      {children}
    </button>
  );
}
