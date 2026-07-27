'use client';

import {
  ArrowRight,
  Check,
  ChevronLeft,
  Compass,
  Heart,
  Layers,
  LayoutGrid,
  Lock,
  RotateCcw,
  Share,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import dynamic from 'next/dynamic';
import { HapticTap } from '@/components/HapticTap';
import { InAppBrowser } from '@/components/InAppBrowser';
import { PiecePeek } from '@/components/PiecePeek';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { ProductImage } from '@/components/ProductImage';
import { TasteMapAxis } from '@/components/TasteMapAxis';
import { WornFlatlay } from '@/components/WornFlatlay';
import { track } from '@/lib/analytics';
import { fetchAiLook } from '@/lib/ai-look-client';
import { VIBE_META, lookProducts, type ScrollLook } from '@/lib/look-helpers';
import type { GenState } from '@/lib/compose-look';
import { hasExactProductLink, isEditorialCutoutProduct } from '@/lib/product-image-quality';
import { feedback, isMuted, setMuted } from '@/lib/feedback';
import { prefersReducedMotion } from '@/lib/visual-capability';
import { safeStorageSet } from '@/lib/safe-storage';
import { encodeLookSlug } from '@/lib/share-codes';
import { lookRarity } from '@/lib/look-rarity';
import { bumpDaily, consumeLevelUp, type LevelState } from '@/lib/stylist-xp';
import CelebrationBurst from '@/components/CelebrationBurst';
import { getProductOutboundUrl } from '@/lib/product-links';
import { colorSwatch, derivePalette } from '@/lib/color-harmony';
import { tidyNote } from '@/lib/note-format';
import { saveIdentity, type StyleAnswers, type StyleIdentity } from '@/lib/style-identity';
import type { Category, Product } from '@/lib/types';
import { VIBES, type GeneratorFrame, type VibeId } from '@/lib/vibes';
import { useCheckout } from '@/store/checkout';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';

// Onboarding only renders for NEW users — lazy-load it so it's not in the feed
// bundle for the (far more common) returning-user path. ssr:false: it's gated on
// client state (hasMounted + showOnboarding) and never renders on the server.
const Onboarding = dynamic(() => import('@/components/Onboarding').then((m) => m.Onboarding), {
  ssr: false,
});

// The look engine pulls all three catalog JSONs (~1.3MB). Load it lazily, AFTER
// first paint, so the catalog never enters the feed's First Load JS. The server
// pre-computes the opening deck; the client needs the engine only to deal MORE
// looks (swipe top-up, re-roll, single-slot swap) — every call site is post-mount.
type LookEngine = typeof import('@/lib/compose-look');
let lookEnginePromise: Promise<LookEngine> | null = null;
function loadLookEngine(): Promise<LookEngine> {
  return (lookEnginePromise ??= import('@/lib/compose-look'));
}

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

// Position each real vibe on the minimal → daring taste axis. This drives the
// on-card map marker and makes swiping feel like exploring a world, not paging
// through an undifferentiated catalog.
const TASTE_POSITION: Record<VibeId, number> = {
  clean: 24,
  preppy: 31,
  office: 37,
  cozy: 42,
  vacation: 48,
  gym: 52,
  street: 61,
  date: 67,
  night: 72,
  edgy: 84,
};
const SEEN_AI_KEY = 'sylistly.seen-ai-looks.v1';
/** Handoff from /browse: "style this piece" locks it into the scroll. */
const PENDING_LOCK_KEY = 'sylistly.pending-lock.v1';

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
// Live-AI enhancement: how many Claude composes run at once, and how many
// consecutive non-AI responses (no credits / capped / rate-limited) before we
// stop trying for the session so we don't hammer a dead account.
const MAX_AI_CONCURRENT = 2;
const AI_FAIL_LIMIT = 3;

function lookTotalCents(items: Partial<Record<Category, Product>>): number {
  return lookProducts(items).reduce((sum, product) => sum + (product.priceCents || 0), 0);
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// The catalog-backed look engine (composeScrollLook + generation) now lives in
// lib/compose-look, loaded lazily off the First Load JS path — see loadLookEngine.

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

/** The fit's colour story as swatches — Syli looks carry a curated palette;
 *  engine looks derive theirs. Shared by the caption dots AND the love-burst,
 *  so a loved fit celebrates in its OWN colours. */
function lookSwatches(look: ScrollLook): { word: string; hex: string }[] {
  const products = lookProducts(look.items);
  const words = look.palette?.length
    ? look.palette
    : derivePalette(products.map((p) => `${p.name} ${(p.colors || []).join(' ')}`).join(' ').toLowerCase());
  return words
    .map((word) => ({ word, hex: colorSwatch(word) }))
    .filter((s): s is { word: string; hex: string } => Boolean(s.hex))
    .slice(0, 5);
}

export interface FeedProps {
  /** Server-rendered opening deck (deterministic, no personalization). */
  initialLooks: ScrollLook[];
  /** Generation cursor after the opening deck — the client resumes from here. */
  initialCursor: GenState;
  /** Per-vibe story-rail thumbnails, server-computed (seed 7). */
  initialVibeThumbs: Array<[VibeId, Product]>;
}

export function Feed({ initialLooks, initialCursor, initialVibeThumbs }: FeedProps) {
  const router = useRouter();
  const saveFit = useSavedFits((state) => state.saveFit);
  const replaceItems = useFit((state) => state.replaceItems);
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
  // Scroll feed: each card carries its own Save/Pass state by look key. savedKeys
  // fills the heart, passedKeys dims the card, burstKey fires the love-burst.
  // matchPop drives the centre "it's a fit" celebration on save.
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [passedKeys, setPassedKeys] = useState<Set<string>>(new Set());
  const [burstKey, setBurstKey] = useState<string | null>(null);
  const [matchPop, setMatchPop] = useState<ScrollLook | null>(null);
  const [levelUp, setLevelUp] = useState<LevelState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [undoPass, setUndoPass] = useState<ScrollLook | null>(null);
  const [peek, setPeek] = useState<{ look: ScrollLook; product: Product } | null>(null);
  const [shopSheet, setShopSheet] = useState<{ title: string; products: CheckoutProduct[] } | null>(null);
  // The in-app browser sheet — the retailer page opens here (partial overlay).
  const [browse, setBrowse] = useState<Product | null>(null);

  // Seed/index/recent resume from the server's opening-deck cursor, so the
  // client continues generation exactly where the server-rendered looks left off.
  const seedRef = useRef(initialCursor.seed);
  const indexRef = useRef(initialCursor.index);
  const recentIdsRef = useRef<string[]>(initialCursor.recentIds);
  // True until the first post-mount re-roll. While true AND the deck is still the
  // androgynous/all baseline, keep the server looks and skip loading the engine.
  const baselineRef = useRef(true);
  const locksRef = useRef(lockedItems);
  const disabledRef = useRef(disabledSlots);
  const vibeLikesRef = useRef<Record<string, number>>({});
  const vibePassesRef = useRef<Record<string, number>>({});
  const seenAiIdsRef = useRef<Set<string>>(new Set());
  const toastTimer = useRef<number | null>(null);
  const matchTimer = useRef<number | null>(null);
  const levelUpTimer = useRef<number | null>(null);
  const undoTimer = useRef<number | null>(null);
  const burstTimer = useRef<number | null>(null);
  // The scroll container (for top-up + scroll-to-top on re-roll) and a guard so a
  // burst of scroll events fires only one top-up fetch at a time.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  // Looks already counted as viewed / marked AI-seen, so the analytics+seen pass
  // processes each card once as it's dealt (not every render).
  const processedKeysRef = useRef<Set<string>>(new Set());
  // Live-AI enhancement: every dealt card (that isn't already a baked Syli look)
  // gets a genuine Claude-styled look swapped in. Track which keys are done /
  // in-flight, a rolling seed, and a circuit-breaker so a no-credit / capped
  // account stops hammering after a few failed attempts.
  const aiDoneKeysRef = useRef<Set<string>>(new Set());
  const aiInFlightRef = useRef<Set<string>>(new Set());
  const aiSeedRef = useRef(1009);
  const aiFailStreakRef = useRef(0);
  const aiDisabledRef = useRef(false);

  // Clear any pending timers on unmount so they never fire on a torn-down
  // component (e.g. saving then navigating away mid-timeout).
  useEffect(() => {
    return () => {
      [toastTimer, matchTimer, levelUpTimer, undoTimer, burstTimer].forEach((timer) => {
        if (timer.current) window.clearTimeout(timer.current);
      });
    };
  }, []);

  locksRef.current = lockedItems;
  disabledRef.current = disabledSlots;

  /** Representative thumbnail per vibe for the story rail — server-computed
   *  (deterministic, seed 7) and handed in, so it needs no catalog client-side. */
  const vibeThumbs = useMemo(() => new Map(initialVibeThumbs), [initialVibeThumbs]);

  // Deal more looks via the lazy-loaded engine, marshalling the generation cursor
  // (seed/index/recent…) in and back out of the component refs. Every caller is
  // post-mount, so awaiting the engine chunk never blocks first paint.
  const gen = useCallback(
    async (count: number, useFrame: GeneratorFrame, filter: VibeId | 'all'): Promise<ScrollLook[]> => {
      const engine = await loadLookEngine();
      const result = engine.generateLooks(
        count,
        useFrame,
        filter,
        {
          seed: seedRef.current,
          index: indexRef.current,
          recentIds: recentIdsRef.current,
          vibeLikes: vibeLikesRef.current,
          vibePasses: vibePassesRef.current,
          seenAiIds: Array.from(seenAiIdsRef.current),
        },
        locksRef.current,
        disabledRef.current,
      );
      seedRef.current = result.state.seed;
      indexRef.current = result.state.index;
      recentIdsRef.current = result.state.recentIds;
      return result.looks;
    },
    [],
  );

  // First paint shows the server-rendered opening deck (handed in as props) — no
  // catalog ships to get real looks on screen; the engine loads on first re-roll.
  const [looks, setLooks] = useState<ScrollLook[]>(initialLooks);

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
  // The opening deck already IS the androgynous/all baseline, so a fresh visitor
  // with no personalization keeps the server looks and never fetches the engine
  // chunk — the catalog only downloads once the deck is personalized or the user
  // swipes past the opening cards.
  useEffect(() => {
    if (!hasMounted) return;
    const isBaseline = frame === 'androgynous' && vibeFilter === 'all'
      && disabledSlots.size === 0
      && Object.keys(locksRef.current).length === 0
      && Object.keys(vibeLikesRef.current).length === 0;
    if (baselineRef.current && isBaseline) { baselineRef.current = false; return; }
    baselineRef.current = false;
    let cancelled = false;
    recentIdsRef.current = [];
    void gen(6, frame, vibeFilter).then((fresh) => {
      if (cancelled) return;
      if (fresh.length >= 3) { resetFeed(fresh); return; }
      // Thin-inventory vibe (e.g. gym): the engine couldn't fill the feed, so a
      // tap would otherwise dead-end on stale looks. Back-fill from the broad
      // "For you" pool and say so honestly — never a silent no-op.
      // ponytail: real fix is gym inventory + the AI generator; this is the floor.
      if (vibeFilter === 'all') { if (fresh.length) resetFeed(fresh); return; }
      void gen(6, frame, 'all').then((broad) => {
        if (cancelled) return;
        const merged = [...fresh, ...broad];
        if (!merged.length) return;
        resetFeed(merged);
        showToast(`Still stocking ${VIBE_META.get(vibeFilter)?.label || 'these'} fits — showing related looks`);
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, vibeFilter, disabledSlots, hasMounted]);

  // Fire view analytics + mark AI looks seen once per look, as cards are dealt
  // into the scroll. ponytail: counts a look viewed when dealt, not when it
  // scrolls into view — a per-card IntersectionObserver is the precise upgrade.
  useEffect(() => {
    let changed = false;
    for (const look of looks) {
      if (processedKeysRef.current.has(look.key)) continue;
      processedKeysRef.current.add(look.key);
      track('look_viewed', { vibe: look.vibe, pieces: lookProducts(look.items).length, source: look.source });
      if (look.source === 'syli' && look.aiId && !seenAiIdsRef.current.has(look.aiId)) {
        seenAiIdsRef.current.add(look.aiId);
        changed = true;
      }
    }
    if (changed) {
      safeStorageSet(SEEN_AI_KEY, JSON.stringify(Array.from(seenAiIdsRef.current).slice(-300)));
    }
  }, [looks]);

  // ── Live-AI styling: swap a genuine Claude-composed look into EVERY dealt card
  // (goal: real smart AI for every scroll/swipe). The deterministic look shows
  // instantly; the AI look swaps in by key when it lands, earning the "Styled by
  // Syli" badge. A rolling window of MAX_AI_CONCURRENT composes runs at once.
  // ponytail: circuit-breaker disables it after AI_FAIL_LIMIT non-AI responses
  // (no credits / capped) so a dead account isn't hammered for all 60 cards.
  useEffect(() => {
    if (!hasMounted || aiDisabledRef.current || typeof window === 'undefined') return;
    let cancelled = false;

    const pump = () => {
      if (cancelled || aiDisabledRef.current) return;
      for (const look of looks) {
        if (aiInFlightRef.current.size >= MAX_AI_CONCURRENT) break;
        if (aiDoneKeysRef.current.has(look.key) || aiInFlightRef.current.has(look.key)) continue;
        // Baked Syli looks are already genuine AI — don't re-spend on them.
        if (look.source === 'syli') { aiDoneKeysRef.current.add(look.key); continue; }
        aiInFlightRef.current.add(look.key);
        const seed = (aiSeedRef.current += 7);
        void fetchAiLook({ key: look.key, vibe: look.vibe, frame, seed, avoidProductIds: recentIdsRef.current })
          .then((aiLook) => {
            aiInFlightRef.current.delete(look.key);
            aiDoneKeysRef.current.add(look.key); // attempted — never retry this card
            if (cancelled) return;
            if (aiLook) {
              aiFailStreakRef.current = 0;
              const ids = lookProducts(aiLook.items).map((p) => p.id);
              recentIdsRef.current = [...recentIdsRef.current, ...ids].slice(-80);
              // Swap in place by key; keep the user's save/pass state untouched.
              setLooks((prev) => prev.map((l) => (l.key === look.key ? aiLook : l)));
            } else {
              aiFailStreakRef.current += 1;
              if (aiFailStreakRef.current >= AI_FAIL_LIMIT) aiDisabledRef.current = true;
            }
            pump(); // fill the freed concurrency slot
          });
      }
    };
    pump();
    return () => { cancelled = true; };
  }, [looks, frame, hasMounted]);

  const showToast = useCallback((message: string) => {
    setUndoPass(null); // a normal toast supersedes the undo affordance
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  // ── The scroll feed: reset + top-up + love / pass ──────────────────────────
  /** Replace the whole feed (vibe/frame change, lock re-deal): swap looks, clear
   *  per-card Save/Pass state, and jump back to the top. */
  function resetFeed(fresh: ScrollLook[]) {
    setLooks(fresh);
    setSavedKeys(new Set());
    setPassedKeys(new Set());
    processedKeysRef.current = new Set();
    scrollRef.current?.scrollTo({ top: 0 });
  }

  /** Infinite scroll: deal a few more fits when the user nears the bottom. The
   *  ref-guard keeps a flurry of scroll events to a single in-flight fetch. */
  function loadMore() {
    if (loadingMoreRef.current || looks.length >= MAX_LOOKS) return;
    loadingMoreRef.current = true;
    void gen(3, frame, vibeFilter)
      .then((fresh) => {
        if (fresh.length) setLooks((prev) => (prev.length < MAX_LOOKS ? [...prev, ...fresh] : prev));
      })
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }

  // Scroll parallax: as a card travels the viewport its plate rotates slightly
  // (±7°) around X, and the pieces' translateZ depth layers shift against each
  // other — real 3D parallax during the scroll gesture. Snap-scroll returns the
  // centered card to 0°, so at rest nothing is skewed. rAF-throttled, vars only.
  const parallaxRaf = useRef<number | null>(null);
  function applyScrollParallax(el: HTMLDivElement) {
    if (parallaxRaf.current != null || prefersReducedMotion()) return;
    parallaxRaf.current = requestAnimationFrame(() => {
      parallaxRaf.current = null;
      const mid = el.clientHeight / 2;
      for (const card of el.querySelectorAll<HTMLElement>('article')) {
        const r = card.getBoundingClientRect();
        if (r.bottom < -80 || r.top > el.clientHeight + 80) continue; // offscreen
        const progress = Math.max(-0.6, Math.min(0.6, (r.top + r.height / 2 - mid) / el.clientHeight));
        card.style.setProperty('--sy-srx', `${(progress * 7).toFixed(2)}deg`);
      }
    });
  }

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    applyScrollParallax(el);
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 900) loadMore();
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
   * Undo the last pass: un-dim the card and reverse the vibe down-weight — so a
   * mis-tap never skews "For you". The card stays in place; only its passed mark
   * and the recorded down-weight are reverted.
   */
  function undoLastPass(look: ScrollLook) {
    dismissUndo();
    vibePassesRef.current[look.vibe] = Math.max(0, (vibePassesRef.current[look.vibe] || 0) - 1);
    safeStorageSet(VIBE_PASSES_KEY, JSON.stringify(vibePassesRef.current));
    setPassedKeys((prev) => {
      const next = new Set(prev);
      next.delete(look.key);
      return next;
    });
    feedback.swipe();
    track('look_pass_undone', { vibe: look.vibe });
  }

  /** Save it — keep the fit, lift the vibe, celebrate. Idempotent per card:
   *  saveFit doesn't dedupe, so guard on savedKeys to avoid duplicate records. */
  function onLove(look: ScrollLook) {
    if (savedKeys.has(look.key)) return;
    dismissUndo(); // a save supersedes the previous pass's undo window
    const record = saveFit(look.items, look.vibe);
    vibeLikesRef.current[look.vibe] = (vibeLikesRef.current[look.vibe] || 0) + 1;
    safeStorageSet(VIBE_LIKES_KEY, JSON.stringify(vibeLikesRef.current));
    feedback.like();
    bumpDaily('likes'); // XP + the "like 3 fits" daily quest
    if (record) bumpDaily('saves'); // XP + the "save a fit" quest
    celebrateIfLeveledUp();
    track('look_loved', { vibe: look.vibe, pieces: lookProducts(look.items).length, source: look.source });
    setSavedKeys((prev) => new Set(prev).add(look.key));
    setBurstKey(look.key); // love-burst in the fit's own palette, on this card
    if (burstTimer.current) window.clearTimeout(burstTimer.current);
    burstTimer.current = window.setTimeout(() => setBurstKey(null), 800);
    setMatchPop(look);
    if (matchTimer.current) window.clearTimeout(matchTimer.current);
    matchTimer.current = window.setTimeout(() => setMatchPop(null), 1500);
  }

  /** Share — native share sheet with a stable /look/ URL the recipient can
   *  open, remix, and shop. Clipboard fallback on desktop. */
  async function onShare(look: ScrollLook) {
    const slug = encodeLookSlug(look.items);
    if (!slug) return;
    const url = `${window.location.origin}/look/${slug}`;
    track('look_shared', { vibe: look.vibe });
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Sylistly', text: 'Check this fit', url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Link copied — send it to someone');
      }
    } catch {
      // user closed the share sheet — not an error
    }
  }

  /** Pass — lower that vibe (honest down-weight), dim the card. */
  function onPass(look: ScrollLook) {
    if (passedKeys.has(look.key)) return;
    vibePassesRef.current[look.vibe] = (vibePassesRef.current[look.vibe] || 0) + 1;
    safeStorageSet(VIBE_PASSES_KEY, JSON.stringify(vibePassesRef.current));
    feedback.swipe();
    bumpDaily('looksViewed'); // XP for moving through fits (capped per day)
    celebrateIfLeveledUp();
    track('look_passed', { vibe: look.vibe });
    setPassedKeys((prev) => new Set(prev).add(look.key));
    // Brief window to undo a mis-tap (also reverses the down-weight above).
    setUndoPass(look);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoPass(null), 4500);
  }

  /**
   * Lock = "keep this piece." Locks persist into every future card; cards after
   * the current one are re-dealt so the very next swipe already honors the lock.
   */
  /** Re-deal the whole feed so every card honors the new locks / slot prefs. */
  function redeal() {
    void gen(6, frame, vibeFilter).then((fresh) => {
      if (fresh.length) resetFeed(fresh);
    });
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
  async function swapPiece(look: ScrollLook, category: Category) {
    const { buildCatalogLook } = await loadLookEngine();
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

  function remixDirection(look: ScrollLook) {
    replaceItems(look.items);
    feedback.reveal(1);
    track('taste_map_remixed', { vibe: look.vibe, pieces: lookProducts(look.items).length });
    router.push(`/build?vibe=${look.vibe}&frame=${frame}`);
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
    void gen(4, answers.frame, 'all').then((fresh) => {
      if (fresh.length) resetFeed(fresh);
    });
  }

  function skipOnboarding() {
    safeStorageSet(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
  }

  const lockCount = Object.keys(lockedItems).length;

  return (
    <main className="sy-game-screen relative mx-auto flex h-[var(--app-h,100dvh)] max-w-[480px] flex-col overflow-hidden bg-bg">
      <h1 className="sr-only">Sylistly Taste Map — explore real clothes, remix a direction, save or shop the complete fit</h1>
      <div aria-hidden className="sy-game-grid pointer-events-none absolute inset-0 z-0 opacity-45" />

      {/* Screen-reader announcements for the otherwise visual-only celebrations
          (love save, level-up) + toasts — so SR users get the same feedback. */}
      <div className="sr-only" role="status" aria-live="polite">
        {(() => {
          if (levelUp) return `Level up — you're now a ${levelUp.title}`;
          if (matchPop) return 'Saved to your looks';
          if (toast) return toast;
          // Announce the lead look so the feed isn't silent on load; each card is
          // also individually labelled/navigable for screen-reader scrolling.
          const top = looks[0];
          if (!top) return '';
          const label = VIBE_META.get(top.vibe)?.label || top.vibe;
          return `${looks.length} fits in your feed. Top: ${label} look, ${formatPrice(lookTotalCents(top.items))}`;
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

      {/* Game HUD: compact wordmark, map tools, and real-product style lanes. */}
      <header className="relative z-30 shrink-0 pb-2 pt-[calc(env(safe-area-inset-top)+10px)]">
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
              <Compass size={15} className="self-center text-accent" aria-hidden />
            )}
            <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
            <span className="font-serif text-[17px] font-semibold italic leading-none text-ink">
              Taste <span className="text-accent">map</span>
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

        {/* Tune panel: switch accessory slots off ("never hats") */}
        {tuneOpen ? (
          <div className="mx-4 mt-3 animate-sy-rise rounded-card border border-hairline bg-surface-1/95 p-3 backdrop-blur-xl">
            <p className="text-eyebrow font-extrabold uppercase text-muted">Style lane</p>
            <div className="sy-edge-fade-x mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button type="button" onClick={() => setVibeFilter('all')} aria-pressed={vibeFilter === 'all'} className={`sy-press inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[11px] font-bold ${vibeFilter === 'all' ? 'border-accent bg-accent text-white' : 'border-hairline-2 bg-surface-2 text-muted-2'}`}>
                <Sparkles size={13} /> For you
              </button>
              {VIBES.map((vibe) => {
                const thumb = vibeThumbs.get(vibe.id);
                return (
                  <button key={vibe.id} type="button" onClick={() => { setVibeFilter(vibe.id); track('vibe_selected', { vibe: vibe.id }); }} aria-pressed={vibeFilter === vibe.id} className={`sy-press inline-flex h-9 shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[11px] font-bold ${vibeFilter === vibe.id ? 'border-accent/70 bg-accent-soft text-ink' : 'border-hairline bg-surface-2 text-muted-2'}`}>
                    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[#d9d0c4]">
                      {thumb ? <ProductImage product={thumb} transparentOnly loading="eager" wrapperClassName="h-[82%] w-[82%]" className="h-full w-full object-contain" /> : null}
                    </span>
                    {vibe.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-eyebrow font-extrabold uppercase text-muted">Generate with</p>
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

      {/* The fit feed — a normal vertical scroll. Save a fit to keep it, pass to
          see fewer like it; tap any piece to shop. */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        key={vibeFilter}
        className="sy-deck-in relative z-10 min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain px-4 scrollbar-hide"
      >
        {looks.map((look, lookIndex) => {
            const meta = VIBE_META.get(look.vibe);
            const products = lookProducts(look.items);
            const leftProducts = lookProducts(looks[(lookIndex - 1 + looks.length) % looks.length]?.items || {});
            const rightProducts = lookProducts(looks[(lookIndex + 1) % looks.length]?.items || {});
            const total = lookTotalCents(look.items);
            const exactCount = products.filter((product) => hasExactProductLink(product)).length;
            const rarity = lookRarity(look.items, look.source);
            const swatches = lookSwatches(look);
            const saved = savedKeys.has(look.key);
            const passed = passedKeys.has(look.key);
            return (
              <article
                key={look.key}
                aria-label={`${meta?.label || look.vibe} look, ${formatPrice(total)}`}
                className={`relative h-full w-full shrink-0 snap-start snap-always transition-[opacity,filter] duration-300 ${passed ? 'opacity-40 saturate-[.4]' : ''}`}
              >
                <div className="relative h-full w-full">
                  {/* Rarity aura — real tiers only */}
                  {rarity.level >= 1 ? (
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
                  {rarity.tier === 'heat' && !prefersReducedMotion() ? (
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
                      rarity.level >= 2
                        ? { boxShadow: `0 0 0 1.5px ${rarity.hue}aa, 0 30px 70px -24px ${rarity.hue}55` }
                        : undefined
                    }
                  >
                    <div className="absolute inset-x-0 bottom-0 top-[104px]">
                      <WornFlatlay
                        items={products}
                        loading="lazy"
                        plate="spotlight"
                        depth
                        bottomReserve={38}
                        className="h-full w-full"
                        onPieceClick={(product) => setPeek({ look, product })}
                      />
                    </div>

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

                    <div className="absolute inset-x-3 top-12 z-20 rounded-2xl border border-white/10 bg-[rgba(9,8,10,.58)] px-3 py-2 backdrop-blur-xl">
                      <TasteMapAxis
                        position={TASTE_POSITION[look.vibe]}
                        leftProduct={leftProducts[0]}
                        rightProduct={rightProducts[0]}
                        label={meta?.label || 'Your lane'}
                        compact
                      />
                    </div>

                    {/* Frosted-glass caption — lifted above the floating bottom nav (full-bleed card) */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-[280px] bg-[linear-gradient(180deg,transparent,rgba(13,13,15,.72)_92%)]"
                    />
                    <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-10 rounded-[22px] bg-[rgba(9,8,10,.68)] p-4 ring-1 ring-white/10 backdrop-blur-2xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-accent">Why this fits your taste</p>
                          <div className="mt-1.5 flex items-baseline gap-2.5">
                        <h2 className="font-serif text-[30px] font-semibold italic leading-[.95] text-ink">
                          {meta?.label || 'The look'}
                        </h2>
                        <span className="rounded-full border border-money/35 bg-money/10 px-2.5 py-1 text-[12px] font-bold text-money">
                          {formatPrice(total)}
                        </span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-champagne/35 bg-champagne-soft px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-champagne">
                          {exactCount}/{products.length} live
                        </span>
                      </div>
                      {swatches.length >= 2 ? (
                        <div
                          className="mt-2 flex items-center gap-1.5"
                          aria-label={`Color palette: ${swatches.map((s) => s.word).join(', ')}`}
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
                      <p className="mt-1.5 line-clamp-2 max-w-[48ch] text-[12.5px] leading-snug text-muted-2">
                        {look.source === 'syli' ? (
                          <span className="font-bold uppercase tracking-[.12em] text-champagne">Syli · </span>
                        ) : null}
                        {look.source === 'syli' && look.note ? tidyNote(look.note) : syliNote(look)}
                      </p>
                      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                        <button
                          type="button"
                          onClick={() => remixDirection(look)}
                          className="sy-press sy-cta-scan inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-4 text-[11px] font-extrabold uppercase tracking-[.14em] text-white shadow-pink-glow"
                        >
                          <WandSparkles size={15} />
                          Remix this direction
                          <ArrowRight size={14} />
                        </button>
                        <div className="flex items-center gap-1.5">
                          <HapticTap
                            ariaLabel="Shop the look"
                            onTap={() => shop(look)}
                            disabled={false}
                            className="sy-press grid h-11 w-11 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink"
                          >
                            <ShoppingBag size={17} />
                          </HapticTap>
                          <HapticTap
                            ariaLabel={saved ? 'Saved to your looks' : 'Save this fit'}
                            onTap={() => onLove(look)}
                            disabled={false}
                            className={`sy-press grid h-11 w-11 place-items-center rounded-full border ${
                              saved ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-accent/60 bg-surface-2/80 text-accent'
                            }`}
                          >
                            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
                          </HapticTap>
                        </div>
                      </div>
                    </div>

                    {/* Love-burst — celebrates a saved fit in its OWN palette */}
                    {burstKey === look.key ? (
                      <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
                        <span className="absolute h-24 w-24 rounded-full border-2 border-accent" style={{ animation: 'sy-ring-burst .55s ease-out both' }} />
                        <Heart size={84} fill="currentColor" className="text-accent drop-shadow-[0_0_24px_rgba(255,45,109,.7)]" style={{ animation: 'sy-heart-pop .6s ease-out both' }} />
                        {swatches.map((s, i) => {
                          const angle = (i / Math.max(1, swatches.length)) * Math.PI * 2 + (i % 2) * 0.26;
                          const dist = 54 + (i % 4) * 14;
                          return (
                            <span
                              key={`burst-${s.word}-${i}`}
                              className="absolute h-2 w-2 rounded-full"
                              style={{
                                background: s.hex,
                                '--dx': `${Math.round(Math.cos(angle) * dist)}px`,
                                '--dy': `${Math.round(Math.sin(angle) * dist)}px`,
                                '--rot': `${180 + i * 30}deg`,
                                animation: `sy-confetti .64s cubic-bezier(.2,.7,.3,1) ${i * 18}ms both`,
                              } as React.CSSProperties}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  {/* Secondary social gestures stay available without covering
                      the garments. They appear as a compact edge utility. */}
                  <div className="absolute right-4 top-[156px] z-30 flex flex-col gap-2">
                    <HapticTap ariaLabel="Pass — see fewer like this" onTap={() => onPass(look)} disabled={passed} className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-[rgba(13,13,15,.58)] text-muted-2 backdrop-blur-md disabled:opacity-40">
                      <X size={15} />
                    </HapticTap>
                    <HapticTap ariaLabel="Share this fit" onTap={() => onShare(look)} disabled={false} className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-[rgba(13,13,15,.58)] text-ink backdrop-blur-md">
                      <Share size={14} />
                    </HapticTap>
                  </div>
                </div>
              </article>
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
