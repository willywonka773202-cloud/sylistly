'use client';

import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  Heart,
  LayoutGrid,
  Lock,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { Onboarding } from '@/components/Onboarding';
import { ProductImage } from '@/components/ProductImage';
import { WornFlatlay } from '@/components/WornFlatlay';
import { getAiLook } from '@/lib/ai-look-library';
import { track } from '@/lib/analytics';
import { buildCatalogLook } from '@/lib/client-catalog';
import { getLibraryLook } from '@/lib/outfit-library';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { encodeLookSlug } from '@/lib/share-codes';
import type { Category, Product } from '@/lib/types';
import { VIBES, type GeneratorFrame, type VibeId } from '@/lib/vibes';
import { useCheckout } from '@/store/checkout';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';

const ONBOARDED_KEY = 'sylistly.onboarded.v1';
const SLOT_PREFS_KEY = 'sylistly.scroll-slots.v1';
const VIBE_LIKES_KEY = 'sylistly.vibe-likes.v1';
const SEEN_AI_KEY = 'sylistly.seen-ai-looks.v1';
/** Handoff from /browse: "style this piece" locks it into the scroll. */
const PENDING_LOCK_KEY = 'sylistly.pending-lock.v1';

/** Curated rotation so consecutive cards feel like turning magazine pages. */
const VIBE_ROTATION: VibeId[] = [
  'street', 'clean', 'night', 'cozy', 'date', 'edgy', 'office', 'preppy', 'vacation', 'gym',
];

const VIBE_META = new Map(VIBES.map((vibe) => [vibe.id, vibe]));

/** Accessory slots the user can switch off ("never generate hats"). */
const OPTIONAL_SLOTS: Category[] = ['hat', 'eyewear', 'jewelry', 'bag'];

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
  gen: number;
  /** 'syli' = genuinely Claude-composed (from the baked AI library). */
  source: 'syli' | 'engine';
  /** Claude's real styling note — only present on 'syli' looks. */
  note?: string;
  /** The baked library id — marked seen only when the card is viewed. */
  aiId?: string;
  /** Claude's palette words ('navy', 'cream') — rendered as swatch dots. */
  palette?: string[];
}

/** Palette-word → swatch hex for the WHY row dots (unknown words skipped). */
const PALETTE_HEX: Record<string, string> = {
  black: '#16161A', white: '#F6F2EC', ivory: '#F1EAD9', cream: '#F0E6D4',
  grey: '#8E8E96', gray: '#8E8E96', charcoal: '#3C3C44', silver: '#C8C8D2',
  navy: '#1F2A44', blue: '#3B5BA5', denim: '#46618C', tan: '#C9A77C',
  beige: '#D9C3A3', camel: '#B98C55', khaki: '#A39264', taupe: '#A99685',
  brown: '#6F4A2F', chocolate: '#4E3220', espresso: '#3B2418',
  olive: '#6B6B3F', green: '#3F6B4A', sage: '#9CAD8E', red: '#B3322E',
  burgundy: '#6E1F2E', oxblood: '#4A1118', wine: '#5C1F33', pink: '#E58CA6',
  blush: '#E8B4BC', gold: '#C9A227', mustard: '#C9962B', orange: '#C76B2E',
  rust: '#A0522D', purple: '#6C4E8E', lavender: '#A98FC9', neutral: '#B9AFA2',
};

function lookProducts(items: Partial<Record<Category, Product>>): Product[] {
  return Object.values(items).filter((product): product is Product => Boolean(product));
}

function lookTotalCents(items: Partial<Record<Category, Product>>): number {
  return lookProducts(items).reduce((sum, product) => sum + (product.priceCents || 0), 0);
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function densityLabel(pieceCount: number): string {
  if (pieceCount >= 7) return 'full styling';
  if (pieceCount >= 6) return 'layered';
  if (pieceCount >= 5) return 'capsule';
  return 'essentials';
}

/**
 * Cheap title-vs-category sanity gate: a bucket hat tagged as a "top" (real
 * catalog bug) wrecks the worn silhouette. The durable fix is the vision
 * enrichment pass; until then, obviously miscategorized garments stay off
 * the plate.
 */
const GARMENT_SLOTS = new Set<Category>(['top', 'bottom', 'outer']);
const NON_GARMENT_TERMS = /\b(bucket hat|beanie|cap|hat|sunglasses|eyeglass|necklace|earring|bracelet|tote|handbag)\b/i;

function isCategorySane(product: Product): boolean {
  if (!GARMENT_SLOTS.has(product.category)) return true;
  return !NON_GARMENT_TERMS.test(product.name || '');
}

/**
 * One look, instantly: pre-generated library when nothing is pinned (best
 * coordination scores), live client-side compose whenever the user has locked
 * pieces or switched slots off — the two things the library can't honor.
 */
function composeScrollLook(
  vibe: VibeId,
  frame: GeneratorFrame,
  seed: number,
  avoidProductIds: string[],
  lockedItems: Partial<Record<Category, Product>>,
  disabledSlots: Set<Category>,
): Partial<Record<Category, Product>> | null {
  const hasLocks = Object.keys(lockedItems).length > 0;
  const hasSlotPrefs = disabledSlots.size > 0;
  if (!hasLocks && !hasSlotPrefs) {
    const library = getLibraryLook(vibe, frame, { seed, avoidProductIds });
    if (library) {
      const sane: Partial<Record<Category, Product>> = {};
      for (const [category, product] of Object.entries(library.products)) {
        if (product && isCategorySane(product)) sane[category as Category] = product;
      }
      if (lookProducts(sane).length >= 3) return sane;
    }
  }
  const vibeSlots = VIBE_META.get(vibe)?.slots || [];
  const targetSlots = vibeSlots.filter((slot) => !disabledSlots.has(slot));
  const built = buildCatalogLook({
    vibe,
    frame,
    budget: 'any',
    mode: 'full',
    seed,
    avoidProductIds,
    lockedItems: hasLocks ? lockedItems : undefined,
    currentItems: hasLocks ? lockedItems : undefined,
    targetSlots: targetSlots.length >= 3 ? targetSlots : undefined,
    transparentOnly: true,
  });
  const products: Partial<Record<Category, Product>> = {};
  for (const [category, product] of Object.entries(built.products)) {
    if (product && !disabledSlots.has(category as Category) && isCategorySane(product)) {
      products[category as Category] = product;
    }
  }
  return lookProducts(products).length >= 3 ? products : null;
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
  const [tuneOpen, setTuneOpen] = useState(false);
  const [lockedItems, setLockedItems] = useState<Partial<Record<Category, Product>>>({});
  const [disabledSlots, setDisabledSlots] = useState<Set<Category>>(new Set());
  const [likedKeys, setLikedKeys] = useState<Set<string>>(new Set());
  const [burstKey, setBurstKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [whyOpenKey, setWhyOpenKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const seedRef = useRef(101);
  const indexRef = useRef(0);
  const recentIdsRef = useRef<string[]>([]);
  const locksRef = useRef(lockedItems);
  const disabledRef = useRef(disabledSlots);
  const vibeLikesRef = useRef<Record<string, number>>({});
  const seenAiIdsRef = useRef<Set<string>>(new Set());
  const toastTimer = useRef<number | null>(null);

  locksRef.current = lockedItems;
  disabledRef.current = disabledSlots;

  /** Representative thumbnail per vibe for the story rail (deterministic). */
  const vibeThumbs = useMemo(() => {
    const thumbs = new Map<VibeId, Product>();
    for (const vibe of VIBES) {
      const look = getLibraryLook(vibe.id, 'androgynous', { seed: 7 });
      if (!look) continue;
      const byCat = look.products;
      const pick = byCat.top || byCat.outer || byCat.shoes || lookProducts(byCat)[0];
      if (pick) thumbs.set(vibe.id, pick);
    }
    return thumbs;
  }, []);

  const makeLooks = useCallback(
    (count: number, useFrame: GeneratorFrame, filter: VibeId | 'all'): ScrollLook[] => {
      const fresh: ScrollLook[] = [];
      // Batch-local picks: dedupes within this deal WITHOUT mutating the
      // persistent seen-set (makeLooks runs inside state initializers, which
      // React StrictMode double-invokes — side effects here would silently
      // consume the AI library). Looks are marked seen only when VIEWED.
      const batchPicked = new Set<string>();
      let attempts = 0;
      const topLikedVibe = (Object.entries(vibeLikesRef.current).sort((a, b) => b[1] - a[1])[0] ||
        [])[0] as VibeId | undefined;
      while (fresh.length < count && attempts < count * 4) {
        attempts += 1;
        let vibe: VibeId;
        if (filter !== 'all') {
          vibe = filter;
        } else if (topLikedVibe && indexRef.current % 3 === 2) {
          vibe = topLikedVibe; // your hearts gently steer the rotation
        } else {
          vibe = VIBE_ROTATION[indexRef.current % VIBE_ROTATION.length];
        }
        indexRef.current += 1;
        seedRef.current += 17;
        const lockedIds = new Set(
          Object.values(locksRef.current).map((product) => product?.id).filter(Boolean),
        );
        const avoid = recentIdsRef.current.filter((id) => !lockedIds.has(id));

        // Claude-baked looks first (only when nothing is pinned — locks and
        // slot prefs need the live engine). The badge is earned, never faked.
        if (lockedIds.size === 0 && disabledRef.current.size === 0) {
          const aiLook = getAiLook(filter === 'all' ? vibe : filter, useFrame, {
            seed: seedRef.current,
            seenLookIds: new Set([...seenAiIdsRef.current, ...batchPicked]),
            avoidProductIds: avoid,
          });
          if (aiLook) {
            batchPicked.add(aiLook.id);
            const ids = lookProducts(aiLook.products).map((product) => product.id);
            recentIdsRef.current = [...recentIdsRef.current, ...ids].slice(-80);
            fresh.push({
              key: `look-${seedRef.current}`,
              vibe: aiLook.vibe,
              items: aiLook.products,
              gen: 0,
              source: 'syli',
              note: aiLook.note,
              aiId: aiLook.id,
              palette: aiLook.palette,
            });
            continue;
          }
        }

        const items = composeScrollLook(
          vibe, useFrame, seedRef.current, avoid, locksRef.current, disabledRef.current,
        );
        if (!items) continue;
        const ids = lookProducts(items).map((product) => product.id);
        recentIdsRef.current = [...recentIdsRef.current, ...ids].slice(-80);
        fresh.push({ key: `look-${seedRef.current}`, vibe, items, gen: 0, source: 'engine' });
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
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(ONBOARDED_KEY)) setShowOnboarding(true);
    try {
      const slots = JSON.parse(window.localStorage.getItem(SLOT_PREFS_KEY) || '[]') as Category[];
      if (slots.length) setDisabledSlots(new Set(slots));
      vibeLikesRef.current = JSON.parse(window.localStorage.getItem(VIBE_LIKES_KEY) || '{}');
      seenAiIdsRef.current = new Set(
        JSON.parse(window.localStorage.getItem(SEEN_AI_KEY) || '[]') as string[],
      );
      // "Style this piece" arriving from /browse — lock it before the deck deals.
      const pendingRaw = window.localStorage.getItem(PENDING_LOCK_KEY);
      if (pendingRaw) {
        window.localStorage.removeItem(PENDING_LOCK_KEY);
        const product = JSON.parse(pendingRaw) as Product;
        if (product?.id && product?.category) {
          const next = { [product.category]: product } as Partial<Record<Category, Product>>;
          setLockedItems(next);
          locksRef.current = next;
          showToast(`Locked — every fit styles around the ${CATEGORY_NOUN[product.category]}`);
        }
      }
    } catch {
      /* corrupted prefs — start fresh */
    }
  }, []);

  // iOS one-swipe-per-card fix. The dynamic Safari toolbar makes `100dvh`
  // sections taller than the visible area on first load, so a swipe first
  // collapses the toolbar instead of advancing — the "two swipes per card"
  // bug. We (a) lock the document so the toolbar stops resizing mid-scroll,
  // and (b) size the shell to the *measured* visible height so each slide
  // exactly fills the screen and snaps cleanly.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sy-app-locked');
    const setHeight = () => root.style.setProperty('--app-h', `${window.innerHeight}px`);
    setHeight();
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    return () => {
      root.classList.remove('sy-app-locked');
      root.style.removeProperty('--app-h');
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
    };
  }, []);

  // Re-roll the deck when frame, vibe filter, or slot prefs change (post-mount).
  useEffect(() => {
    if (!hasMounted) return;
    recentIdsRef.current = [];
    setLooks(makeLooks(4, frame, vibeFilter));
    setActiveKey(null);
    scrollerRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, vibeFilter, disabledSlots, hasMounted]);

  // Which card is on screen — drives the settle-in stagger + view analytics.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute('data-look-key');
            if (key) setActiveKey(key);
          }
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-look-key]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [looks]);

  useEffect(() => {
    if (!activeKey) return;
    const look = looks.find((entry) => entry.key === activeKey);
    if (!look) return;
    track('look_viewed', { vibe: look.vibe, pieces: lookProducts(look.items).length, source: look.source });
    // Mark a baked AI look as seen only once it has actually been on screen.
    if (look.source === 'syli' && look.aiId && !seenAiIdsRef.current.has(look.aiId)) {
      seenAiIdsRef.current.add(look.aiId);
      window.localStorage.setItem(
        SEEN_AI_KEY,
        JSON.stringify(Array.from(seenAiIdsRef.current).slice(-300)),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

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

  /**
   * Lock = "keep this piece as I scroll." Locks persist into every future
   * card; cards below the current one are re-dealt so the very next swipe
   * already honors the lock.
   */
  function toggleLock(look: ScrollLook, product: Product) {
    const currentlyLocked = lockedItems[product.category]?.id === product.id;
    const next = { ...lockedItems };
    if (currentlyLocked) delete next[product.category];
    else next[product.category] = product;
    setLockedItems(next);
    locksRef.current = next;
    track('lock_toggled', { category: product.category, locked: !currentlyLocked });
    setLooks((prev) => {
      const index = prev.findIndex((entry) => entry.key === look.key);
      return index === -1 ? prev : prev.slice(0, index + 1);
    });
    showToast(
      currentlyLocked
        ? `Unlocked the ${CATEGORY_NOUN[product.category]}`
        : `Locked — keep scrolling, the ${CATEGORY_NOUN[product.category]} stays`,
    );
  }

  function clearLocks(look: ScrollLook) {
    setLockedItems({});
    locksRef.current = {};
    setLooks((prev) => {
      const index = prev.findIndex((entry) => entry.key === look.key);
      return index === -1 ? prev : prev.slice(0, index + 1);
    });
    showToast('Locks cleared');
  }

  function restyle(look: ScrollLook) {
    seedRef.current += 17;
    const lockedIds = new Set(Object.values(lockedItems).map((product) => product?.id));
    const avoid = recentIdsRef.current.filter((id) => !lockedIds.has(id));
    const items = composeScrollLook(
      look.vibe, frame, seedRef.current, avoid, lockedItems, disabledSlots,
    );
    if (!items) {
      showToast('No fresh take found — try unlocking a piece');
      return;
    }
    recentIdsRef.current = [
      ...recentIdsRef.current,
      ...lookProducts(items).map((product) => product.id),
    ].slice(-80);
    track('look_restyled', { vibe: look.vibe, locks: Object.keys(lockedItems).length });
    // A restyled look came from the live engine — it no longer carries
    // Claude's badge or note.
    setLooks((prev) =>
      prev.map((entry) =>
        entry.key === look.key
          ? { ...entry, items, gen: entry.gen + 1, source: 'engine' as const, note: undefined, aiId: undefined }
          : entry,
      ),
    );
  }

  function like(look: ScrollLook) {
    const already = likedKeys.has(look.key);
    setLikedKeys((prev) => {
      const next = new Set(prev);
      if (already) next.delete(look.key);
      else next.add(look.key);
      return next;
    });
    if (!already) {
      vibeLikesRef.current[look.vibe] = (vibeLikesRef.current[look.vibe] || 0) + 1;
      window.localStorage.setItem(VIBE_LIKES_KEY, JSON.stringify(vibeLikesRef.current));
      setBurstKey(look.key);
      window.setTimeout(() => setBurstKey((key) => (key === look.key ? null : key)), 650);
      track('look_liked', { vibe: look.vibe });
    }
  }

  function save(look: ScrollLook) {
    const record = saveFit(look.items);
    track('look_saved', { vibe: look.vibe, pieces: lookProducts(look.items).length });
    showToast(record ? 'Saved to your looks' : 'Could not save this one');
  }

  function remix(look: ScrollLook) {
    replaceItems(look.items);
    track('look_remixed', { vibe: look.vibe });
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
    track('look_shopped', {
      vibe: look.vibe,
      totalCents: lookTotalCents(look.items),
      pieces: products.length,
    });
    setCheckout({ title: `${meta?.label || 'Sylistly'} fit`, products });
    router.push('/checkout');
  }

  async function share(look: ScrollLook) {
    const meta = VIBE_META.get(look.vibe);
    const products = lookProducts(look.items);
    const text = `${meta?.label || 'A'} fit on Sylistly — ${products.length} real pieces, ${formatPrice(lookTotalCents(look.items))} total, every one shoppable.`;
    // Every fit gets its own page with a real preview image — AI looks by
    // library id, everything else encoded piece-by-piece.
    const slug = look.aiId || encodeLookSlug(look.items);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sylistly.com';
    const url = slug ? `${origin}/look/${slug}` : origin;
    track('look_shared', { vibe: look.vibe, source: look.source });
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Sylistly', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      showToast('Fit link copied');
    } catch {
      /* user dismissed the share sheet */
    }
  }

  function toggleSlot(category: Category) {
    setDisabledSlots((prev) => {
      const next = new Set(prev);
      const enabling = next.has(category);
      if (enabling) next.delete(category);
      else next.add(category);
      window.localStorage.setItem(SLOT_PREFS_KEY, JSON.stringify(Array.from(next)));
      track('slot_toggled', { category, enabled: enabling });
      return next;
    });
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

  const lockCount = Object.keys(lockedItems).length;

  return (
    <main className="relative mx-auto h-[var(--app-h,100dvh)] max-w-[480px] overflow-hidden bg-bg">
      <h1 className="sr-only">Sylistly — endless outfits from real products</h1>

      {/* Top chrome: wordmark + tune, then the vibe story rail */}
      <header className="absolute inset-x-0 top-0 z-30 bg-[linear-gradient(180deg,rgba(13,13,15,.94)_0%,rgba(13,13,15,.78)_70%,transparent_100%)] pb-5 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            {vibeFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setVibeFilter('all')}
                aria-label="Back to For you"
                className="sy-press grid h-7 w-7 self-center place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink"
              >
                <ChevronLeft size={15} />
              </button>
            ) : (
              <span className="h-[2px] w-6 self-center rounded-full bg-accent" aria-hidden />
            )}
            <span className="text-eyebrow font-extrabold uppercase text-champagne">Sylistly</span>
            <span className="font-serif text-[17px] font-semibold italic leading-none text-ink">
              Fit <span className="text-accent">scroll</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/browse"
              aria-label="Browse every piece"
              className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink backdrop-blur-md"
            >
              <LayoutGrid size={15} />
            </Link>
            <button
              type="button"
              onClick={() => setTuneOpen((open) => !open)}
              aria-expanded={tuneOpen}
              aria-label="Tune what gets generated"
              className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink backdrop-blur-md"
            >
              {tuneOpen ? <X size={15} /> : <SlidersHorizontal size={15} />}
            </button>
          </div>
        </div>

        {/* Story rail — pink gradient rings, real product thumbs */}
        <div className="mt-3 flex gap-3 overflow-x-auto px-4 scrollbar-hide">
          <StoryCircle
            label="For you"
            active={vibeFilter === 'all'}
            onClick={() => { setVibeFilter('all'); track('vibe_selected', { vibe: 'all' }); }}
          >
            <span className="grid h-full w-full place-items-center rounded-full bg-[radial-gradient(circle_at_32%_26%,#FF7CA0,rgba(255,45,109,.6)_56%,rgba(120,30,52,.8))] text-white">
              <Sparkles size={19} />
            </span>
          </StoryCircle>
          {VIBES.map((vibe) => {
            const thumb = vibeThumbs.get(vibe.id);
            return (
              <StoryCircle
                key={vibe.id}
                label={vibe.label}
                active={vibeFilter === vibe.id}
                onClick={() => { setVibeFilter(vibe.id); track('vibe_selected', { vibe: vibe.id }); }}
              >
                <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#FBF7F2]">
                  {thumb ? (
                    <ProductImage
                      product={thumb}
                      transparentOnly
                      wrapperClassName="h-[78%] w-[78%]"
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </span>
              </StoryCircle>
            );
          })}
        </div>

        {/* Tune panel: switch accessory slots off ("never hats") */}
        {tuneOpen ? (
          <div className="mx-4 mt-3 animate-sy-rise rounded-card border border-hairline bg-surface-1/95 p-3 backdrop-blur-xl">
            <p className="text-eyebrow font-extrabold uppercase text-muted">Generate with</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTIONAL_SLOTS.map((slot) => {
                const enabled = !disabledSlots.has(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    aria-pressed={enabled}
                    className={`sy-press rounded-full border px-3.5 py-2 text-[12px] font-semibold capitalize transition ${
                      enabled
                        ? 'border-accent/60 bg-accent-soft text-ink'
                        : 'border-hairline bg-surface-2 text-muted line-through'
                    }`}
                  >
                    {CATEGORY_NOUN[slot]}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Switched-off pieces stop appearing in new fits. Core four (top, bottoms, shoes, layer) always style.
            </p>
          </div>
        ) : null}
      </header>

      {/* The scroll */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-hide"
      >
        {looks.map((look, index) => {
          const meta = VIBE_META.get(look.vibe);
          const products = lookProducts(look.items);
          const total = lookTotalCents(look.items);
          const exactCount = products.filter((product) => hasExactProductLink(product)).length;
          const isActive = activeKey ? activeKey === look.key : index === 0;
          const liked = likedKeys.has(look.key);
          const whyOpen = whyOpenKey === look.key;
          return (
            <section
              key={look.key}
              data-look-key={look.key}
              aria-label={`${meta?.label || 'Outfit'} look`}
              className="relative h-[var(--app-h,100dvh)] snap-start snap-always overflow-hidden"
            >
              {/* Atmosphere: alternating accent/champagne spotlight + film grain */}
              <div
                aria-hidden
                className={`absolute inset-0 ${
                  index % 2 === 0
                    ? 'bg-[radial-gradient(120%_72%_at_50%_24%,rgba(255,45,109,.09),transparent_62%)]'
                    : 'bg-[radial-gradient(120%_72%_at_50%_24%,rgba(231,199,155,.08),transparent_62%)]'
                }`}
              />
              <div aria-hidden className="sy-grain absolute inset-0 opacity-[.05] mix-blend-overlay" />

              {/* The plate — worn silhouette */}
              <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+156px)] bottom-[248px]">
                <div
                  key={`${look.key}-gen-${look.gen}`}
                  className="relative h-full animate-sy-fade overflow-hidden rounded-card-lg ring-1 ring-hairline shadow-card-strong"
                >
                  <WornFlatlay
                    items={products}
                    active={isActive}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    className="h-full w-full"
                  />
                  {burstKey === look.key ? (
                    <span className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
                      <Heart
                        size={110}
                        fill="currentColor"
                        className="animate-ping text-accent drop-shadow-[0_0_28px_rgba(255,45,109,.85)]"
                      />
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Legibility gradient */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px] bg-[linear-gradient(180deg,transparent,rgba(13,13,15,.9)_58%,#0D0D0F_92%)]"
              />

              {/* Right action rail */}
              <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+186px)] right-3 z-20 flex flex-col items-center gap-3">
                <RailAction label={liked ? 'Unlike' : 'Like — trains your taste'} onClick={() => like(look)} filled={liked}>
                  <Heart size={19} fill={liked ? 'currentColor' : 'none'} />
                </RailAction>
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
              <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-10 px-4 pr-[70px]">
                {/* Formula pill + WHY (+ the earned AI badge) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWhyOpenKey(whyOpen ? null : look.key)}
                    aria-expanded={whyOpen}
                    className="sy-press inline-flex items-center gap-2 rounded-full border border-hairline-2 bg-surface-2/80 py-1.5 pl-1.5 pr-3 backdrop-blur-md"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
                      <Sparkles size={12} />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-accent">Formula</span>
                    <span className="text-[12px] font-semibold text-ink">
                      {look.vibe} / {densityLabel(products.length)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2">
                      Why
                      <ChevronDown size={11} className={`transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {look.source === 'syli' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-white shadow-pink-glow">
                      <Sparkles size={11} />
                      Styled by Syli
                    </span>
                  ) : null}
                </div>
                {whyOpen ? (
                  <div className="mt-2 animate-sy-rise">
                    <p className="max-w-[36ch] text-[13px] font-medium leading-snug text-muted-2">
                      <span className="font-bold uppercase tracking-[.14em] text-champagne">Syli&apos;s note · </span>
                      {look.source === 'syli' && look.note ? look.note : syliNote(look)}
                    </p>
                    {look.source === 'syli' && look.palette?.length ? (
                      <span className="mt-2 flex items-center gap-1.5" aria-label={`Palette: ${look.palette.join(', ')}`}>
                        {look.palette.map((name) => {
                          const hex = PALETTE_HEX[name.toLowerCase()];
                          return hex ? (
                            <span
                              key={name}
                              title={name}
                              className="h-3.5 w-3.5 rounded-full ring-1 ring-hairline-2"
                              style={{ backgroundColor: hex }}
                            />
                          ) : null;
                        })}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-2 flex items-baseline gap-3">
                  <h2 className="font-serif text-[32px] font-semibold italic leading-[.95] text-ink">
                    {meta?.label || 'The look'}
                  </h2>
                  <span className="rounded-full border border-money/35 bg-money/10 px-2.5 py-1 text-[12px] font-bold text-money">
                    {formatPrice(total)}
                  </span>
                  <span className="text-[11px] font-semibold text-muted">
                    {exactCount}/{products.length} shoppable
                  </span>
                </div>

                {/* Piece chips — tap to lock; locked pieces ride along as you scroll */}
                <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
                  {products.map((product) => {
                    const locked = lockedItems[product.category]?.id === product.id;
                    const exact = hasExactProductLink(product);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => toggleLock(look, product)}
                        aria-pressed={locked}
                        aria-label={`${locked ? 'Unlock' : 'Lock'} ${product.brand} ${CATEGORY_NOUN[product.category]}`}
                        className={`sy-press flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 backdrop-blur-md transition ${
                          locked
                            ? 'border-accent bg-accent-soft text-ink shadow-pink-glow'
                            : 'border-hairline-2 bg-surface-2/70 text-muted-2'
                        }`}
                      >
                        <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-ink/95">
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
                        {exact ? <span aria-label="Shoppable" className="h-1.5 w-1.5 rounded-full bg-money" /> : null}
                        {locked ? <Lock size={11} className="text-accent" /> : null}
                      </button>
                    );
                  })}
                </div>

                {lockCount > 0 ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => restyle(look)}
                      className="sy-press inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-4 py-2.5 text-[13px] font-bold text-white shadow-pink-glow"
                    >
                      <WandSparkles size={15} />
                      New take with {lockCount} locked
                    </button>
                    <button
                      type="button"
                      onClick={() => clearLocks(look)}
                      className="sy-press rounded-full border border-hairline-2 bg-surface-2/70 px-3.5 py-2.5 text-[12px] font-semibold text-muted-2 backdrop-blur-md"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+128px)] z-40 flex justify-center">
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

function StoryCircle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="sy-press flex shrink-0 flex-col items-center gap-1">
      <span
        className={`grid h-[56px] w-[56px] place-items-center rounded-full p-[2.5px] ${
          active
            ? 'bg-[linear-gradient(140deg,#FF2D6D_0%,#FF5C8A_45%,#E7C79B_100%)] shadow-pink-glow'
            : 'bg-hairline-2'
        }`}
      >
        <span className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-bg">
          {children}
        </span>
      </span>
      <span className={`max-w-[64px] truncate text-[10px] font-semibold ${active ? 'text-ink' : 'text-muted'}`}>
        {label}
      </span>
    </button>
  );
}

function RailAction({
  label,
  onClick,
  accent = false,
  filled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  filled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`sy-press grid h-11 w-11 place-items-center rounded-full border backdrop-blur-md transition active:scale-90 ${
        accent
          ? 'border-accent/50 bg-accent text-white shadow-pink-glow'
          : filled
            ? 'border-accent bg-accent-soft text-accent shadow-pink-glow'
            : 'border-hairline-2 bg-surface-2/70 text-ink'
      }`}
    >
      {children}
    </button>
  );
}
