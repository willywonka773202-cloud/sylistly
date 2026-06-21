'use client';

import {
  Check,
  ChevronLeft,
  Heart,
  Layers,
  LayoutGrid,
  Lock,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import dynamic from 'next/dynamic';
import { FitDeck } from '@/components/FitDeck';
import { InAppBrowser } from '@/components/InAppBrowser';
import { PiecePeek } from '@/components/PiecePeek';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { ProductImage } from '@/components/ProductImage';
import { WornFlatlay } from '@/components/WornFlatlay';
import { getAiLook } from '@/lib/ai-look-library';
import { track } from '@/lib/analytics';
import { buildCatalogLook } from '@/lib/client-catalog';
import { getLibraryLook } from '@/lib/outfit-library';
import { hasExactProductLink, isEditorialCutoutProduct } from '@/lib/product-image-quality';
import { feedback, isMuted, setMuted } from '@/lib/feedback';
import { prefersReducedMotion } from '@/lib/visual-capability';
import { safeStorageSet } from '@/lib/safe-storage';
import { lookRarity } from '@/lib/look-rarity';
import { bumpDaily, consumeLevelUp, type LevelState } from '@/lib/stylist-xp';
import CelebrationBurst from '@/components/CelebrationBurst';
import { getProductOutboundUrl } from '@/lib/product-links';
import { colorSwatch, derivePalette } from '@/lib/color-harmony';
import { saveIdentity, type StyleAnswers, type StyleIdentity } from '@/lib/style-identity';
import type { Category, Product } from '@/lib/types';
import { VIBES, type GeneratorFrame, type VibeId } from '@/lib/vibes';
import { useCheckout } from '@/store/checkout';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';

// Onboarding only renders for NEW users — lazy-load it so it's not in the feed
// bundle for the (far more common) returning-user path. ssr:false: it's gated on
// client state (hasMounted + showOnboarding) and never renders on the server.
const Onboarding = dynamic(() => import('@/components/Onboarding').then((m) => m.Onboarding), {
  ssr: false,
});

const ONBOARDED_KEY = 'sylistly.onboarded.v1';
const SLOT_PREFS_KEY = 'sylistly.scroll-slots.v1';
const VIBE_LIKES_KEY = 'sylistly.vibe-likes.v1';
const VIBE_PASSES_KEY = 'sylistly.vibe-passes.v1';

// Mood-matched ambient hue per vibe — drives the soft top glow behind the deck
// so each lane feels like its own room. Muted/desaturated on purpose: the tint
// is atmospheric, the champagne/pink chrome still leads. 'all' = champagne.
const VIBE_HUE: Record<VibeId | 'all', string> = {
  all: '#C9A24B',
  night: '#6B5BA8',
  street: '#3E6B7A',
  clean: '#8A9A8E',
  gym: '#3FA67A',
  cozy: '#B57E45',
  date: '#B0496E',
  office: '#46587A',
  vacation: '#2FA0A8',
  edgy: '#9A3340',
  preppy: '#3F6E55',
};
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
        if (product && isCategorySane(product) && isEditorialCutoutProduct(product)) {
          sane[category as Category] = product;
        }
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
    if (
      product
      && !disabledSlots.has(category as Category)
      && isCategorySane(product)
      && isEditorialCutoutProduct(product)
    ) {
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
  const saveFit = useSavedFits((state) => state.saveFit);
  const setCheckout = useCheckout((state) => state.setCheckout);
  const profileFrame = useProfile((state) => state.profile.bodyType);
  const setBodyType = useProfile((state) => state.setBodyType);
  const setBudget = useProfile((state) => state.setBudget);
  const setVibesFromText = useProfile((state) => state.setVibesFromText);

  const frame: GeneratorFrame = profileFrame === 'custom' ? 'androgynous' : profileFrame;

  const [hasMounted, setHasMounted] = useState(false);
  // Cold-boot only (full reload, not in-app tab nav): the chrome rises in as the
  // splash lifts, so launch + app-assembly read as one take. Starts false to
  // match SSR (no hydration drift); flips on mount when sessionStorage is unset,
  // and the brief class-swap is hidden under the splash overlay.
  const [bootCold, setBootCold] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [vibeFilter, setVibeFilter] = useState<VibeId | 'all'>('all');
  const [tuneOpen, setTuneOpen] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [lockedItems, setLockedItems] = useState<Partial<Record<Category, Product>>>({});
  const [disabledSlots, setDisabledSlots] = useState<Set<Category>>(new Set());
  // The Tinder deck: topIndex points at the current card in `looks`; matchPop is
  // the look just loved (drives the "it's a fit" celebration).
  const [topIndex, setTopIndex] = useState(0);
  const [matchPop, setMatchPop] = useState<ScrollLook | null>(null);
  const [levelUp, setLevelUp] = useState<LevelState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [undoPass, setUndoPass] = useState<ScrollLook | null>(null);
  const [peek, setPeek] = useState<{ look: ScrollLook; product: Product } | null>(null);
  const [shopSheet, setShopSheet] = useState<{ title: string; products: CheckoutProduct[] } | null>(null);
  // The in-app browser sheet — the retailer page opens here (partial overlay).
  const [browse, setBrowse] = useState<Product | null>(null);

  const seedRef = useRef(101);
  const indexRef = useRef(0);
  const recentIdsRef = useRef<string[]>([]);
  const locksRef = useRef(lockedItems);
  const disabledRef = useRef(disabledSlots);
  const vibeLikesRef = useRef<Record<string, number>>({});
  const vibePassesRef = useRef<Record<string, number>>({});
  const seenAiIdsRef = useRef<Set<string>>(new Set());
  const toastTimer = useRef<number | null>(null);
  const matchTimer = useRef<number | null>(null);
  const levelUpTimer = useRef<number | null>(null);
  const undoTimer = useRef<number | null>(null);
  const undoNonceRef = useRef(0);

  // Clear any pending timers on unmount so they never fire on a torn-down
  // component (e.g. swiping then navigating away mid-timeout).
  useEffect(() => {
    return () => {
      [toastTimer, matchTimer, levelUpTimer, undoTimer].forEach((timer) => {
        if (timer.current) window.clearTimeout(timer.current);
      });
    };
  }, []);

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
      // Net taste signal: a right-swipe (love) lifts a vibe, a left-swipe (pass)
      // lowers it. The most-loved vibe gently steers the rotation; vibes the user
      // keeps passing are skipped. Honest on-device personalization.
      const vibeNet = (v: string) => (vibeLikesRef.current[v] || 0) - (vibePassesRef.current[v] || 0);
      const topLikedVibe = ([...new Set([
        ...Object.keys(vibeLikesRef.current),
        ...Object.keys(vibePassesRef.current),
      ])]
        .map((v) => [v, vibeNet(v)] as const)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])[0] || [])[0] as VibeId | undefined;
      while (fresh.length < count && attempts < count * 4) {
        attempts += 1;
        let vibe: VibeId;
        if (filter !== 'all') {
          vibe = filter;
        } else if (topLikedVibe && indexRef.current % 3 === 2) {
          vibe = topLikedVibe; // your loves gently steer the rotation
        } else {
          vibe = VIBE_ROTATION[indexRef.current % VIBE_ROTATION.length];
          if (vibeNet(vibe) <= -3) {
            // keeps getting passed → skip it for the next slot
            indexRef.current += 1;
            vibe = VIBE_ROTATION[indexRef.current % VIBE_ROTATION.length];
          }
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
    setMutedState(isMuted());
    if (typeof window === 'undefined') return;
    try {
      if (!window.sessionStorage.getItem('sy.booted')) {
        setBootCold(true);
        window.sessionStorage.setItem('sy.booted', '1');
      }
      if (!window.localStorage.getItem(ONBOARDED_KEY)) setShowOnboarding(true);
      const slots = JSON.parse(window.localStorage.getItem(SLOT_PREFS_KEY) || '[]') as Category[];
      if (slots.length) setDisabledSlots(new Set(slots));
      vibeLikesRef.current = JSON.parse(window.localStorage.getItem(VIBE_LIKES_KEY) || '{}');
      vibePassesRef.current = JSON.parse(window.localStorage.getItem(VIBE_PASSES_KEY) || '{}');
      // Cap on read too (writes already .slice(-300)) so a long session can't
      // grow the in-memory Set past the persisted bound.
      seenAiIdsRef.current = new Set(
        (JSON.parse(window.localStorage.getItem(SEEN_AI_KEY) || '[]') as string[]).slice(-300),
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
      /* storage blocked (private mode / strict webview) or corrupted prefs — start fresh */
    }
    // Run once on mount: restores a pending lock + toasts it. showToast is a
    // stable useCallback but is declared below this effect, so it can't go in
    // the deps array (TDZ) — and re-running on mount only is exactly the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Guard against a 0 reading (bfcache restore / pre-layout paint can report
    // innerHeight 0 on Safari): leaving --app-h unset falls back to the CSS
    // 100dvh, never a collapsed 0-height feed.
    const setHeight = () => {
      const h = window.innerHeight;
      if (h > 0) root.style.setProperty('--app-h', `${h}px`);
    };
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
    setLooks(makeLooks(6, frame, vibeFilter));
    setTopIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, vibeFilter, disabledSlots, hasMounted]);

  // The top card is the one in view — fire view analytics + mark AI looks seen.
  useEffect(() => {
    const look = looks[topIndex];
    if (!look) return;
    track('look_viewed', { vibe: look.vibe, pieces: lookProducts(look.items).length, source: look.source });
    if (look.source === 'syli' && look.aiId && !seenAiIdsRef.current.has(look.aiId)) {
      seenAiIdsRef.current.add(look.aiId);
      safeStorageSet(
        SEEN_AI_KEY,
        JSON.stringify(Array.from(seenAiIdsRef.current).slice(-300)),
      );
    }
  }, [topIndex, looks]);

  const showToast = useCallback((message: string) => {
    setUndoPass(null); // a normal toast supersedes the undo affordance
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  // ── The Tinder deck: advance + love / pass ─────────────────────────────────
  /** Move to the next card, topping the deck up before it runs dry. */
  function advance() {
    setLooks((prev) => {
      const remaining = prev.length - (topIndex + 1);
      return remaining < 4 && prev.length < MAX_LOOKS
        ? [...prev, ...makeLooks(3, frame, vibeFilter)]
        : prev;
    });
    setTopIndex((i) => i + 1);
  }

  /** Fire a real, earned level-up celebration when a tier is crossed (once). */
  function celebrateIfLeveledUp() {
    const lvl = consumeLevelUp();
    if (!lvl) return;
    setLevelUp(lvl);
    feedback.levelUp(); // dedicated triumphant fanfare (distinct from the Drop chime)
    if (levelUpTimer.current) window.clearTimeout(levelUpTimer.current);
    levelUpTimer.current = window.setTimeout(() => setLevelUp(null), 3400);
  }

  /** Clear the pending "undo the pass" affordance + its timer. */
  function dismissUndo() {
    setUndoPass(null);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  }

  /**
   * Undo the last pass: drop a fresh, swipeable copy of the look back at the top
   * of the deck and reverse the vibe down-weight — so a mis-swipe never loses a
   * fit you wanted OR skews "For you". Fresh key forces a new (un-flung) card.
   */
  function undoLastPass(look: ScrollLook) {
    dismissUndo();
    vibePassesRef.current[look.vibe] = Math.max(0, (vibePassesRef.current[look.vibe] || 0) - 1);
    safeStorageSet(VIBE_PASSES_KEY, JSON.stringify(vibePassesRef.current));
    undoNonceRef.current += 1;
    const restored: ScrollLook = { ...look, key: `${look.key}:undo${undoNonceRef.current}` };
    setLooks((prev) => {
      const next = [...prev];
      next.splice(Math.min(topIndex, next.length), 0, restored);
      return next;
    });
    feedback.swipe();
    track('look_pass_undone', { vibe: look.vibe });
  }

  /** Swipe RIGHT — love it: save the fit, lift the vibe, celebrate. */
  function onLove(look: ScrollLook) {
    dismissUndo(); // a love supersedes the previous pass's undo window
    const record = saveFit(look.items, look.vibe);
    vibeLikesRef.current[look.vibe] = (vibeLikesRef.current[look.vibe] || 0) + 1;
    safeStorageSet(VIBE_LIKES_KEY, JSON.stringify(vibeLikesRef.current));
    feedback.like();
    bumpDaily('likes'); // XP + the "like 3 fits" daily quest
    if (record) bumpDaily('saves'); // XP + the "save a fit" quest
    celebrateIfLeveledUp();
    track('look_loved', { vibe: look.vibe, pieces: lookProducts(look.items).length, source: look.source });
    setMatchPop(look);
    if (matchTimer.current) window.clearTimeout(matchTimer.current);
    matchTimer.current = window.setTimeout(() => setMatchPop(null), 1500);
    advance();
  }

  /** Swipe LEFT — pass: lower that vibe (honest down-weight), move on. */
  function onPass(look: ScrollLook) {
    vibePassesRef.current[look.vibe] = (vibePassesRef.current[look.vibe] || 0) + 1;
    safeStorageSet(VIBE_PASSES_KEY, JSON.stringify(vibePassesRef.current));
    feedback.swipe();
    bumpDaily('looksViewed'); // XP for moving through fits (capped per day)
    celebrateIfLeveledUp();
    track('look_passed', { vibe: look.vibe });
    advance();
    // Brief window to undo a mis-swipe (also reverses the down-weight above).
    setUndoPass(look);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoPass(null), 4500);
  }

  function onSwipe(look: ScrollLook, dir: 'right' | 'left') {
    if (dir === 'right') onLove(look);
    else onPass(look);
  }

  /**
   * Lock = "keep this piece." Locks persist into every future card; cards after
   * the current one are re-dealt so the very next swipe already honors the lock.
   */
  /** Keep the current card, re-deal everything after it so the very next swipe
   *  already honors the new locks / slot prefs. */
  function redeal() {
    setLooks((prev) => [...prev.slice(0, topIndex + 1), ...makeLooks(4, frame, vibeFilter)]);
  }

  function toggleLock(product: Product) {
    const currentlyLocked = lockedItems[product.category]?.id === product.id;
    const next = { ...lockedItems };
    if (currentlyLocked) delete next[product.category];
    else next[product.category] = product;
    setLockedItems(next);
    locksRef.current = next;
    track('lock_toggled', { category: product.category, locked: !currentlyLocked });
    redeal();
    showToast(
      currentlyLocked
        ? `Unlocked the ${CATEGORY_NOUN[product.category]}`
        : `Locked — every fit now styles around the ${CATEGORY_NOUN[product.category]}`,
    );
  }

  function clearLocks() {
    setLockedItems({});
    locksRef.current = {};
    redeal();
    showToast('Locks cleared');
  }

  /**
   * Swap a single piece in place — the "fix the one thing you don't like"
   * move (Pinterest/Doji's slot swap). Everything else freezes; only this
   * slot gets a fresh pick. The look drops the AI badge since it's now a
   * hand-edit, not a Claude-composed look.
   */
  function swapPiece(look: ScrollLook, category: Category) {
    const others: Partial<Record<Category, Product>> = {};
    for (const [cat, product] of Object.entries(look.items)) {
      if (cat !== category && product) others[cat as Category] = product;
    }
    const currentId = look.items[category]?.id;
    seedRef.current += 17;
    const built = buildCatalogLook({
      vibe: look.vibe,
      frame,
      budget: 'any',
      mode: 'full',
      seed: seedRef.current,
      lockedItems: others,
      currentItems: others,
      targetSlots: [category],
      avoidProductIds: [currentId, ...recentIdsRef.current].filter((id): id is string => Boolean(id)),
      transparentOnly: true,
    });
    const next = built.products[category];
    if (!next || next.id === currentId || !isEditorialCutoutProduct(next)) {
      showToast(`No other ${CATEGORY_NOUN[category]} to swap to`);
      return;
    }
    recentIdsRef.current = [...recentIdsRef.current, next.id].slice(-80);
    track('piece_swapped', { category, vibe: look.vibe });
    setLooks((prev) =>
      prev.map((entry) =>
        entry.key === look.key
          ? {
              ...entry,
              items: { ...entry.items, [category]: next },
              // Keep `gen` stable so the plate doesn't re-key/re-stagger — only
              // the one swapped piece (new product id) re-animates in place.
              source: 'engine' as const,
              note: undefined,
              aiId: undefined,
            }
          : entry,
      ),
    );
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
    const title = `${meta?.label || 'Sylistly'} fit`;
    setCheckout({ title, products });
    setShopSheet({ title, products }); // open the shop-the-look sheet in place (no route change)
  }

  function toggleSlot(category: Category) {
    setDisabledSlots((prev) => {
      const next = new Set(prev);
      const enabling = next.has(category);
      if (enabling) next.delete(category);
      else next.add(category);
      safeStorageSet(SLOT_PREFS_KEY, JSON.stringify(Array.from(next)));
      track('slot_toggled', { category, enabled: enabling });
      return next;
    });
  }

  function completeOnboarding(answers: StyleAnswers, identity: StyleIdentity) {
    safeStorageSet(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
    // Apply the quiz to the profile (steers generation) and persist the identity.
    setBodyType(answers.frame);
    setBudget(answers.budget);
    setVibesFromText(identity.vibes.join(', '));
    saveIdentity(answers, identity);
    // Seed the feed-steering weights so "For you" leans into the persona's
    // vibes from the very first scroll (primary vibe weighted highest).
    const seeded: Record<string, number> = {};
    identity.vibes.forEach((vibe, index) => {
      seeded[vibe] = identity.vibes.length - index;
    });
    vibeLikesRef.current = seeded;
    safeStorageSet(VIBE_LIKES_KEY, JSON.stringify(seeded));
    setVibeFilter('all');
    recentIdsRef.current = [];
    setLooks(makeLooks(4, answers.frame, 'all'));
  }

  function skipOnboarding() {
    safeStorageSet(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
  }

  const lockCount = Object.keys(lockedItems).length;

  return (
    <main className="relative mx-auto flex h-[var(--app-h,100dvh)] max-w-[480px] flex-col overflow-hidden bg-bg">
      <h1 className="sr-only">Sylistly — swipe right to love a fit, left to pass</h1>

      {/* Screen-reader announcements for the otherwise visual-only celebrations
          (love save, level-up) + toasts — so SR users get the same feedback. */}
      <div className="sr-only" role="status" aria-live="polite">
        {(() => {
          if (levelUp) return `Level up — you're now a ${levelUp.title}`;
          if (matchPop) return 'Saved to your looks';
          if (toast) return toast;
          // Announce the look itself on swipe-to-a-new-card — the core feed
          // interaction. Vibe + price varies per look so it re-announces each
          // swipe (not just on vibe change). Cards are also labelled/navigable.
          const top = looks[topIndex];
          if (!top) return '';
          const label = VIBE_META.get(top.vibe)?.label || top.vibe;
          return `Showing ${label} look, ${formatPrice(lookTotalCents(top.items))}`;
        })()}
      </div>

      {/* SR announce for the transient pass-undo affordance (its own always-present
          region so it doesn't override the look-announce above; both are polite). */}
      <div className="sr-only" role="status" aria-live="polite">
        {undoPass ? 'Passed. Undo available.' : ''}
      </div>

      {/* Vibe-reactive ambience — soft top glow that recolors with the active vibe */}
      <div
        aria-hidden
        className="sy-vibe-glow pointer-events-none absolute inset-0 z-0"
        style={{ backgroundColor: VIBE_HUE[vibeFilter] }}
      />

      {/* Top chrome: wordmark + tune, then the vibe story rail */}
      <header className="relative z-30 shrink-0 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className={`flex items-center justify-between px-4${bootCold ? ' sy-boot-1' : ''}`}>
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
            <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
            <span className="font-serif text-[17px] font-semibold italic leading-none text-ink">
              Fit <span className="text-accent">scroll</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/discover"
              aria-label="Discover complete looks"
              className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink backdrop-blur-md"
            >
              <Layers size={15} />
            </Link>
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
        <div className={`mt-3 flex gap-3 overflow-x-auto px-4 scrollbar-hide${bootCold ? ' sy-boot-2' : ''}`}>
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
                <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_36%_26%,#E0D5C0,#AC9F84)]">
                  <span aria-hidden className="absolute font-serif text-[19px] italic text-[#6f6045]/75">{vibe.label.charAt(0)}</span>
                  {thumb ? (
                    <ProductImage
                      product={thumb}
                      transparentOnly
                      loading="eager"
                      wrapperClassName="relative h-[78%] w-[78%]"
                      className="h-full w-full object-contain drop-shadow-[0_2px_5px_rgba(45,30,16,.42)]"
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
            <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
              <div>
                <p className="text-[12px] font-semibold text-ink">Sound &amp; haptics</p>
                <p className="text-[11px] text-muted">Taps, swipes, and the Drop reveal.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  setMutedState(next);
                  if (!next) feedback.tick(); // confirm it's on (and unlock audio)
                }}
                aria-pressed={!muted}
                aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
                className={`sy-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  muted ? 'border-hairline bg-surface-2 text-muted' : 'border-accent/60 bg-accent-soft text-accent'
                }`}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {muted ? 'Off' : 'On'}
              </button>
            </div>
          </div>
        ) : null}

        {/* Locks — every dealt fit styles around them; clear to free up. */}
        {lockCount > 0 ? (
          <div className="mt-2 flex items-center gap-2 px-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-ink">
              <Lock size={11} />
              {lockCount} locked — every fit styles around {lockCount === 1 ? 'it' : 'them'}
            </span>
            <button
              type="button"
              onClick={clearLocks}
              className="sy-press rounded-full border border-hairline-2 bg-surface-2/70 px-2.5 py-1 text-[11px] font-semibold text-muted-2"
            >
              Clear
            </button>
          </div>
        ) : null}
      </header>

      {/* The Tinder deck — swipe right to love, left to pass; tap a piece to shop */}
      <div key={vibeFilter} className="sy-deck-in relative z-10 min-h-0 flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+82px)] pt-1">
        <FitDeck
          cards={looks.slice(topIndex)}
          onSwipe={onSwipe}
          onShop={shop}
          renderCard={(look, isTop) => {
            const meta = VIBE_META.get(look.vibe);
            const products = lookProducts(look.items);
            const total = lookTotalCents(look.items);
            const exactCount = products.filter((product) => hasExactProductLink(product)).length;
            const rarity = lookRarity(look.items, look.source);
            // Colour story — Syli looks carry a curated palette; engine looks derive
            // theirs from the pieces. Render as swatch dots so the fit's palette is visible.
            const swatches = (look.palette?.length
              ? look.palette
              : derivePalette(products.map((p) => `${p.name} ${(p.colors || []).join(' ')}`).join(' ').toLowerCase()))
              .map((word) => ({ word, hex: colorSwatch(word) }))
              .filter((s): s is { word: string; hex: string } => Boolean(s.hex))
              .slice(0, 5);
            return (
              <div className="relative h-full w-full">
                {/* Rarity aura — only the top card, only for real tiers */}
                {isTop && rarity.level >= 1 ? (
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -inset-3 rounded-[40px] blur-2xl ${
                      rarity.level >= 2 ? 'sy-aura-breathe-strong' : 'sy-aura-breathe'
                    }`}
                    style={{
                      background:
                        rarity.level >= 2
                          ? `radial-gradient(60% 50% at 50% 42%, ${rarity.hue}3a, transparent 74%)`
                          : 'radial-gradient(58% 48% at 50% 42%, rgba(255,45,109,.18), transparent 74%)',
                    }}
                  />
                ) : null}
                {/* Heat-only ember drift — honest, ≤4 + 3px, hard-gated off reduced motion */}
                {isTop && rarity.tier === 'heat' && !prefersReducedMotion() ? (
                  <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-card-lg">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="sy-ember absolute bottom-6 h-[3px] w-[3px] rounded-full"
                        style={{
                          left: `${18 + i * 21}%`,
                          background: rarity.hue,
                          boxShadow: `0 0 6px ${rarity.hue}`,
                          animationDelay: `${i * 900}ms`,
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                <div
                  className="relative h-full w-full overflow-hidden rounded-card-lg bg-bg ring-1 ring-hairline shadow-card-strong"
                  style={
                    isTop && rarity.level >= 2
                      ? { boxShadow: `0 0 0 1.5px ${rarity.hue}aa, 0 30px 70px -24px ${rarity.hue}55` }
                      : undefined
                  }
                >
                  <WornFlatlay
                    items={products}
                    active={isTop}
                    loading="eager"
                    plate="spotlight"
                    depth
                    bottomReserve={30}
                    className="h-full w-full"
                    onPieceClick={isTop ? (product) => setPeek({ look, product }) : undefined}
                  />

                  {/* Badges — top-left */}
                  <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5">
                    {look.source === 'syli' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-white shadow-pink-glow">
                        <Sparkles size={11} />
                        Styled by Syli
                      </span>
                    ) : null}
                    {rarity.level >= 1 ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.14em] backdrop-blur-md"
                        style={{
                          borderColor: rarity.hue,
                          color: rarity.hue,
                          background: 'rgba(13,13,15,.55)',
                          boxShadow: `0 0 14px ${rarity.hue}66`,
                        }}
                      >
                        {rarity.tier === 'heat' ? '🔥 ' : ''}
                        {rarity.label}
                      </span>
                    ) : null}
                  </div>

                  {/* Frosted-glass caption — soft short fade + a glass panel so the outfit breathes above it */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-[linear-gradient(180deg,transparent,rgba(13,13,15,.6)_88%)]"
                  />
                  <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-[rgba(12,11,13,.5)] p-4 ring-1 ring-white/10 backdrop-blur-xl">
                    <div className="flex items-baseline gap-2.5">
                      <h2 className="font-serif text-[30px] font-semibold italic leading-[.95] text-ink">
                        {meta?.label || 'The look'}
                      </h2>
                      <span className="rounded-full border border-money/35 bg-money/10 px-2.5 py-1 text-[12px] font-bold text-money">
                        {formatPrice(total)}
                      </span>
                    </div>
                    {swatches.length >= 2 ? (
                      <div
                        className="mt-2 flex items-center gap-1.5"
                        aria-label={`Colour palette: ${swatches.map((s) => s.word).join(', ')}`}
                      >
                        {swatches.map((s, i) => (
                          <span
                            key={`${s.word}-${i}`}
                            className="sy-pop-in h-3 w-3 rounded-full ring-1 ring-white/30 shadow-[0_1px_3px_rgba(0,0,0,.4)]"
                            style={{ background: s.hex, animationDelay: `${i * 70}ms` }}
                          />
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-1.5 max-w-[42ch] text-[12.5px] leading-snug text-muted-2">
                      {look.source === 'syli' ? (
                        <span className="font-bold uppercase tracking-[.12em] text-champagne">Syli · </span>
                      ) : null}
                      {look.source === 'syli' && look.note ? look.note : syliNote(look)}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-muted">
                      {products.length} pieces · {exactCount}/{products.length} shoppable · tap a piece to shop
                    </p>
                  </div>
                </div>
              </div>
            );
          }}
        />
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

      {/* Undo a mis-passed fit — restores it to the top + reverses the down-weight */}
      {undoPass ? (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+128px)] z-40 flex justify-center">
          <span className="pointer-events-auto flex animate-sy-rise items-center gap-3 rounded-full border border-hairline-2 bg-surface-2/95 py-1.5 pl-4 pr-1.5 text-[12px] font-semibold text-ink shadow-card backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-muted-2">
              <RotateCcw size={13} className="text-muted" />
              Passed
            </span>
            <button
              type="button"
              onClick={() => undoLastPass(undoPass)}
              className="sy-press rounded-full bg-accent px-3 py-1 text-[12px] font-bold text-white shadow-pink-glow"
            >
              Undo
            </button>
          </span>
        </div>
      ) : null}

      {/* Shop-the-look sheet — slides up in place; shop every piece grouped by retailer */}
      {shopSheet ? (
        <CheckoutSheet open title={shopSheet.title} products={shopSheet.products} onClose={() => setShopSheet(null)} />
      ) : null}

      {/* Shop-the-look peek — tap any garment on the plate */}
      {peek ? (
        <PiecePeek
          product={peek.product}
          locked={lockedItems[peek.product.category]?.id === peek.product.id}
          onShop={() => {
            setBrowse(peek.product); // open the retailer in the in-app browser sheet
            setPeek(null);
          }}
          onSwap={() => {
            swapPiece(peek.look, peek.product.category);
            setPeek(null);
          }}
          onLock={() => {
            toggleLock(peek.product);
            setPeek(null);
          }}
          onClose={() => setPeek(null)}
        />
      ) : null}

      {/* In-app browser — the retailer page in a partial, drag-to-dismiss sheet */}
      {browse ? <InAppBrowser product={browse} onClose={() => setBrowse(null)} /> : null}

      {/* "It's a fit" — the love-swipe celebration (your action, honestly) */}
      {matchPop ? (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
          <div className="sy-pop-in flex flex-col items-center gap-2 rounded-[26px] border border-accent/40 bg-[rgba(13,13,15,.72)] px-9 py-7 text-center shadow-pink-glow backdrop-blur-xl">
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
              <span className="sy-ring-burst absolute inset-0 rounded-full border-2 border-accent/70" />
              <Heart size={30} fill="currentColor" />
            </span>
            <p className="font-serif text-[26px] italic leading-none text-ink">It&rsquo;s a fit</p>
            <p className="text-[11px] font-bold uppercase tracking-[.22em] text-champagne">Saved to your looks</p>
          </div>
        </div>
      ) : null}

      {/* Level-up — a real, EARNED tier crossing. Champagne (achievement), not
          pink (action), so it reads distinctly from the "It's a fit" love-pop. */}
      {levelUp ? (
        <>
          <CelebrationBurst level={3} hue="#E7C79B" origin={{ x: 0.5, y: 0.42 }} zIndex={45} />
          <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center">
            <div className="sy-pop-in flex flex-col items-center gap-2 rounded-[26px] border border-champagne/40 bg-[rgba(13,13,15,.78)] px-9 py-7 text-center shadow-[0_0_64px_rgba(231,199,155,.42)] backdrop-blur-xl">
              <span className="relative grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,#E7C79B,#B8945E)] text-bg shadow-[0_0_30px_rgba(231,199,155,.55)]">
                <span className="sy-ring-burst absolute inset-0 rounded-full border-2 border-champagne/70" />
                <Sparkles size={28} />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[.24em] text-champagne">Level {levelUp.level} unlocked</p>
              <p className="font-serif text-[26px] italic leading-none text-ink">{levelUp.title}</p>
              <p className="text-[11px] text-muted">
                {levelUp.nextTitle ? `Next: ${levelUp.nextTitle}` : '★ Top tier'}
              </p>
            </div>
          </div>
        </>
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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`sy-press flex shrink-0 flex-col items-center gap-1 transition-transform duration-300 ease-[cubic-bezier(.34,1.46,.54,1)] ${
        active ? 'scale-[1.07]' : 'scale-100'
      }`}
    >
      <span className={`relative grid h-[56px] w-[56px] place-items-center rounded-full p-[2.5px] ${active ? 'shadow-pink-glow' : ''}`}>
        {active ? (
          <span
            aria-hidden
            className="sy-ring-spin absolute inset-0 rounded-full"
            style={{ background: 'conic-gradient(from 0deg,#FF2D6D,#FF5C8A,#E7C79B,#FF8FB0,#FF2D6D)' }}
          />
        ) : (
          <span aria-hidden className="absolute inset-0 rounded-full bg-hairline-2" />
        )}
        <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-bg">
          {children}
        </span>
      </span>
      <span className={`max-w-[64px] truncate text-[10px] font-semibold transition-colors ${active ? 'text-ink' : 'text-muted'}`}>
        {label}
      </span>
    </button>
  );
}

