'use client';

import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  Heart,
  Layers,
  LayoutGrid,
  Lock,
  RefreshCw,
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
import type { CheckoutProduct } from '@/components/CheckoutSheet';
import { ProductImage } from '@/components/ProductImage';
import { WornFlatlay } from '@/components/WornFlatlay';
import { useAppViewportLock } from '@/lib/use-app-viewport-lock';
import { track } from '@/lib/analytics';
import { fetchAiLook } from '@/lib/ai-look-client';
import { VIBE_META, lookProducts, type ScrollLook } from '@/lib/look-helpers';
import type { GenState } from '@/lib/compose-look';
import { hasExactProductLink, isEditorialCutoutProduct } from '@/lib/product-image-quality';
import { feedback, isMuted, setMuted } from '@/lib/feedback';
import { prefersReducedMotion } from '@/lib/visual-capability';
import { safeStorageGet, safeStorageSet } from '@/lib/safe-storage';
import { encodeLookSlug } from '@/lib/share-code-encode';
import { bumpDaily, consumeLevelUp, type LevelState } from '@/lib/stylist-xp';
import CelebrationBurst from '@/components/CelebrationBurst';
import { getProductOutboundUrl } from '@/lib/product-links';
import { colorSwatch, derivePalette } from '@/lib/color-harmony';
import { tidyNote } from '@/lib/note-format';
import { saveIdentity, type StyleAnswers, type StyleIdentity } from '@/lib/style-identity';
import type { Category, Product, Profile } from '@/lib/types';
import { VIBES, type GeneratorBudget, type GeneratorFrame, type VibeId } from '@/lib/vibes';
import { useCheckout } from '@/store/checkout';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { isVerificationFresh } from '@/lib/verification-freshness';
import {
  buildTasteRankingSignals,
  emptyTasteRankingSignals,
  loadTasteProfile,
  recordTasteSignal,
  scoreLookForTaste,
  tasteVibeCounters,
  undoTasteSignal,
  type TasteSignalInput,
  type TasteStorage,
} from '@/lib/taste-profile';

// Onboarding only renders for NEW users — lazy-load it so it's not in the feed
// bundle for the (far more common) returning-user path. ssr:false: it's gated on
// client state (hasMounted + showOnboarding) and never renders on the server.
const Onboarding = dynamic(() => import('@/components/Onboarding').then((m) => m.Onboarding), {
  ssr: false,
});

// These three commerce surfaces are interaction-only overlays. Keeping them
// out of the opening feed chunk makes the first useful look cheaper without
// changing any shopping behavior once a person asks for it.
const CheckoutSheet = dynamic(
  () => import('@/components/CheckoutSheet').then((module) => module.CheckoutSheet),
  { ssr: false, loading: () => null },
);
const PiecePeek = dynamic(
  () => import('@/components/PiecePeek').then((module) => module.PiecePeek),
  { ssr: false, loading: () => null },
);
const InAppBrowser = dynamic(
  () => import('@/components/InAppBrowser').then((module) => module.InAppBrowser),
  { ssr: false, loading: () => null },
);

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
const FIRST_USEFUL_LOOK_KEY = 'sylistly.analytics.first-useful-look.v1';
const FEED_TASTE_STORAGE: TasteStorage = {
  getItem: safeStorageGet,
  setItem: safeStorageSet,
};

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
// Live-AI enhancement is deliberately opt-in. The deterministic engine is the
// complete, buyable product; remote styling may enhance a card but must never
// make initial render speed or reliability depend on a model provider.
const LIVE_AI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LIVE_AI_LOOKS === 'true';
// How many Claude composes run at once, and how many
// consecutive non-AI responses (no credits / capped / rate-limited) before we
// stop trying for the session so we don't hammer a dead account.
const MAX_AI_CONCURRENT = 1;
const AI_FAIL_LIMIT = 3;

type ProfileBudget = NonNullable<Profile['stylePrefs']['budget']>;

/** One honest total-look ceiling per persisted profile tier. The UI and the
 * generator share this map so a visible budget promise can never become merely
 * decorative chrome. */
const FEED_BUDGETS: Record<
  ProfileBudget,
  { label: string; budget: GeneratorBudget; customMaxCents?: number; maxTotalCents: number | null }
> = {
  low: { label: 'Under $250', budget: 'under250', maxTotalCents: 25_000 },
  mid: { label: 'Under $500', budget: 'under500', maxTotalCents: 50_000 },
  high: { label: 'Under $1,000', budget: 'custom', customMaxCents: 100_000, maxTotalCents: 100_000 },
  luxury: { label: 'Any budget', budget: 'any', maxTotalCents: null },
};

function lookTotalCents(items: Partial<Record<Category, Product>>): number {
  return lookProducts(items).reduce((sum, product) => sum + (product.priceCents || 0), 0);
}

function isCompleteBuyableItems(items: Partial<Record<Category, Product>>): boolean {
  const products = lookProducts(items);
  return Boolean(
    items.top
      && items.bottom
      && items.shoes
      && products.length >= 3
      && products.every((product) => (
        product.inStock !== false
        && hasExactProductLink(product)
        && hasFreshPositiveAvailability(product)
      )),
  );
}

function hasFreshPositiveAvailability(product: Product, now = Date.now()): boolean {
  return (product.availabilityState === 'in_stock' || product.availabilityState === 'available')
    && isVerificationFresh(product.lastVerifiedAt, 24 * 60 * 60 * 1000, now);
}

function lookItemFingerprint(items: Partial<Record<Category, Product>>): string {
  return Object.entries(items)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, product]) => `${category}:${product?.id || '-'}`)
    .join('|');
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
  const profileSizes = useProfile((state) => state.profile.sizes);
  const profilePrefs = useProfile((state) => state.profile.stylePrefs);
  const profileBudget = profilePrefs.budget || 'mid';
  const setBodyType = useProfile((state) => state.setBodyType);
  const setBudget = useProfile((state) => state.setBudget);
  const setFitPreference = useProfile((state) => state.setFitPreference);
  const setPalettePreference = useProfile((state) => state.setPalettePreference);
  const setVibesFromText = useProfile((state) => state.setVibesFromText);

  const frame: GeneratorFrame = profileFrame === 'custom' ? 'androgynous' : profileFrame;
  const budgetSpec = FEED_BUDGETS[profileBudget];
  const generationPreferences = useMemo(() => {
    const paletteTerms: Record<NonNullable<Profile['stylePrefs']['palette']>, string[]> = {
      neutral: ['neutral', 'cream', 'grey', 'tan', 'beige', 'ivory'],
      dark: ['black', 'charcoal', 'noir'],
      earth: ['olive', 'brown', 'rust', 'tan', 'earth'],
      bold: ['bright', 'color', 'contrast', 'statement'],
    };
    return {
      preferredBrands: profilePrefs.brands,
      preferredRetailers: profilePrefs.retailers,
      preferredColors: profilePrefs.colors,
      preferredTerms: [
        ...(profilePrefs.fit ? [profilePrefs.fit] : []),
        ...(profilePrefs.palette ? paletteTerms[profilePrefs.palette] : []),
        ...(profilePrefs.materials || []),
        ...(profilePrefs.occasions || []),
      ],
      excludedBrands: profilePrefs.excludedBrands,
      excludedRetailers: profilePrefs.excludedRetailers,
      excludedTerms: profilePrefs.excludedTerms,
      preferredSizes: {
        top: profileSizes.top,
        outer: profileSizes.top,
        bottom: profileSizes.bottom?.waist ? String(profileSizes.bottom.waist) : undefined,
        shoes: profileSizes.shoe,
      },
      priceTolerancePct: profilePrefs.priceTolerancePct,
    };
  }, [profilePrefs, profileSizes]);

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
  const [shopSheet, setShopSheet] = useState<{ title: string; lookId: string; products: CheckoutProduct[] } | null>(null);
  const [feedStatus, setFeedStatus] = useState<'ready' | 'loading' | 'withheld'>('ready');
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
  const tasteSignalsRef = useRef(emptyTasteRankingSignals());
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
  const firstUsefulLookTrackedRef = useRef(false);
  const feedExperienceStartedAtRef = useRef<number | null>(null);
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
        {
          budget: budgetSpec.budget,
          customMaxCents: budgetSpec.customMaxCents,
          maxTotalCents: budgetSpec.maxTotalCents,
          preferences: {
            ...generationPreferences,
            taste: tasteSignalsRef.current,
          },
        },
      );
      seedRef.current = result.state.seed;
      indexRef.current = result.state.index;
      recentIdsRef.current = result.state.recentIds;
      return result.looks;
    },
    [budgetSpec.budget, budgetSpec.customMaxCents, budgetSpec.maxTotalCents, generationPreferences],
  );

  // First paint shows the server-rendered opening deck (handed in as props) — no
  // catalog ships to get real looks on screen; the engine loads on first re-roll.
  const [looks, setLooks] = useState<ScrollLook[]>(initialLooks);

  useEffect(() => {
    setHasMounted(true);
    feedExperienceStartedAtRef.current = performance.now();
    setMutedState(isMuted());
    if (typeof window === 'undefined') return;
    const tasteProfile = loadTasteProfile(FEED_TASTE_STORAGE);
    tasteSignalsRef.current = buildTasteRankingSignals(tasteProfile);
    const vibeCounters = tasteVibeCounters(tasteSignalsRef.current);
    vibeLikesRef.current = vibeCounters.likes;
    vibePassesRef.current = vibeCounters.passes;
    // Keep SSR/first paint byte-light and hydration-stable. Once mounted, a
    // returning user's already-rendered opening cards are stably reordered by
    // local taste evidence—no eager catalog-engine import or deck replacement.
    if (tasteSignalsRef.current.evidenceCount) {
      setLooks((current) => current
        .map((look, index) => ({
          look,
          index,
          score: scoreLookForTaste(lookProducts(look.items), look.vibe, tasteSignalsRef.current),
        }))
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map(({ look }) => look));
    }
    try {
      if (!window.sessionStorage.getItem('sy.booted')) {
        setBootCold(true);
        window.sessionStorage.setItem('sy.booted', '1');
      }
      if (!window.localStorage.getItem(ONBOARDED_KEY)) setShowOnboarding(true);
      const slots = JSON.parse(window.localStorage.getItem(SLOT_PREFS_KEY) || '[]') as Category[];
      if (slots.length) setDisabledSlots(new Set(slots));
      firstUsefulLookTrackedRef.current = window.sessionStorage.getItem(FIRST_USEFUL_LOOK_KEY) === '1';
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
        if (
          product?.id
          && product?.category
          && product.inStock !== false
          && hasExactProductLink(product)
          && isEditorialCutoutProduct(product)
          && hasFreshPositiveAvailability(product)
        ) {
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

  // iOS one-card-per-swipe lock — see lib/use-app-viewport-lock.ts.
  useAppViewportLock();

  // Re-roll the deck when frame, vibe filter, or slot prefs change (post-mount).
  // The opening deck already IS the androgynous/all baseline, so a fresh visitor
  // with no personalization keeps the server looks and never fetches the engine
  // chunk — the catalog only downloads once the deck is personalized or the user
  // swipes past the opening cards.
  useEffect(() => {
    if (!hasMounted) return;
    const isBaseline = frame === 'androgynous' && vibeFilter === 'all'
      && profileBudget === 'mid'
      && disabledSlots.size === 0
      && Object.keys(locksRef.current).length === 0;
    if (baselineRef.current && isBaseline) { baselineRef.current = false; return; }
    baselineRef.current = false;
    let cancelled = false;
    setFeedStatus('loading');
    recentIdsRef.current = [];
    void (async () => {
      try {
        const fresh = await gen(6, frame, vibeFilter);
        if (cancelled) return;
        if (fresh.length >= 3) { resetFeed(fresh); setFeedStatus('ready'); return; }
        // Thin-inventory vibe (e.g. gym): the engine couldn't fill the feed, so a
        // tap would otherwise dead-end on stale looks. Back-fill from the broad
        // "For you" pool and say so honestly — never a silent no-op.
        if (vibeFilter === 'all') {
          resetFeed(fresh);
          setFeedStatus(fresh.length ? 'ready' : 'withheld');
          return;
        }
        const broad = await gen(6, frame, 'all');
        if (cancelled) return;
        const merged = [...fresh, ...broad];
        if (!merged.length) {
          resetFeed([]);
          setFeedStatus('withheld');
          return;
        }
        resetFeed(merged);
        setFeedStatus('ready');
        showToast(`Still stocking ${VIBE_META.get(vibeFilter)?.label || 'these'} fits — showing related looks`);
      } catch {
        if (cancelled) return;
        setFeedStatus('withheld');
        showToast('Recommendations are temporarily unavailable. Try again.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, vibeFilter, disabledSlots, hasMounted, profileBudget, generationPreferences]);

  // A look earns an impression only after most of its card is actually visible.
  // Dealing six cards is not the same thing as a person seeing six looks.
  useEffect(() => {
    if (!hasMounted || showOnboarding) return;
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const byKey = new Map(looks.map((look) => [look.key, look]));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.62) continue;
          const key = (entry.target as HTMLElement).dataset.lookKey;
          const look = key ? byKey.get(key) : undefined;
          if (!look || processedKeysRef.current.has(look.key)) continue;
          processedKeysRef.current.add(look.key);
          const fullyBuyable = isCompleteBuyableItems(look.items);
          track('look_impression', {
            lookId: look.aiId || look.key,
            surface: 'feed',
            vibe: look.vibe,
            pieces: lookProducts(look.items).length,
            totalCents: lookTotalCents(look.items),
            source: look.source,
            budget: profileBudget,
            fullyBuyable,
          });
          if (fullyBuyable && !firstUsefulLookTrackedRef.current) {
            firstUsefulLookTrackedRef.current = true;
            try {
              window.sessionStorage.setItem(FIRST_USEFUL_LOOK_KEY, '1');
            } catch {
              // A blocked session store must not suppress the activation event.
            }
            track('first_useful_look_viewed', {
              lookId: look.aiId || look.key,
              surface: 'feed',
              vibe: look.vibe,
              budget: profileBudget,
              fullyBuyable: true,
              timeToFirstUsefulLookMs: Math.max(
                0,
                Math.round(performance.now() - (feedExperienceStartedAtRef.current ?? performance.now())),
              ),
            });
          }
          if (look.source === 'syli' && look.aiId && !seenAiIdsRef.current.has(look.aiId)) {
            seenAiIdsRef.current.add(look.aiId);
            safeStorageSet(SEEN_AI_KEY, JSON.stringify(Array.from(seenAiIdsRef.current).slice(-300)));
          }
          observer.unobserve(entry.target);
        }
      },
      { root, threshold: [0.62] },
    );
    root.querySelectorAll<HTMLElement>('article[data-look-key]').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [hasMounted, looks, profileBudget, showOnboarding]);

  // ── Optional live-AI styling: the deterministic look remains the product.
  // When explicitly enabled, a genuine Claude-composed look may swap in by key
  // after it lands, earning the "Styled by Syli" badge. A rolling window of
  // MAX_AI_CONCURRENT composes runs at once.
  // ponytail: circuit-breaker disables it after AI_FAIL_LIMIT non-AI responses
  // (no credits / capped) so a dead account isn't hammered for all 60 cards.
  useEffect(() => {
    if (!LIVE_AI_ENABLED || !hasMounted || aiDisabledRef.current || typeof window === 'undefined') return;
    // A live AI response is a full-look replacement. Never let it erase a
    // user's lock, disabled slot, or hand-picked replacement.
    if (Object.keys(lockedItems).length > 0 || disabledSlots.size > 0) return;
    let cancelled = false;
    const controllers = new Set<AbortController>();

    const pump = () => {
      if (cancelled || aiDisabledRef.current) return;
      for (const look of looks) {
        if (aiInFlightRef.current.size >= MAX_AI_CONCURRENT) break;
        if (aiDoneKeysRef.current.has(look.key) || aiInFlightRef.current.has(look.key)) continue;
        // Baked Syli looks are already genuine AI — don't re-spend on them.
        if (look.source === 'syli') { aiDoneKeysRef.current.add(look.key); continue; }
        aiInFlightRef.current.add(look.key);
        const controller = new AbortController();
        controllers.add(controller);
        const requestedFingerprint = lookItemFingerprint(look.items);
        const seed = (aiSeedRef.current += 7);
        void fetchAiLook({
          key: look.key,
          vibe: look.vibe,
          frame,
          budget: budgetSpec.budget,
          customMaxCents: budgetSpec.customMaxCents,
          seed,
          avoidProductIds: recentIdsRef.current,
        }, controller.signal)
          .then((aiLook) => {
            controllers.delete(controller);
            aiInFlightRef.current.delete(look.key);
            aiDoneKeysRef.current.add(look.key); // attempted — never retry this card
            if (cancelled) return;
            const withinBudget = !aiLook
              || budgetSpec.maxTotalCents == null
              || lookTotalCents(aiLook.items) <= budgetSpec.maxTotalCents;
            if (aiLook && withinBudget && isCompleteBuyableItems(aiLook.items)) {
              aiFailStreakRef.current = 0;
              const ids = lookProducts(aiLook.items).map((p) => p.id);
              recentIdsRef.current = [...recentIdsRef.current, ...ids].slice(-80);
              // Swap only if the exact card is still untouched. A piece swap or
              // other edit may have landed while this network request was in flight.
              setLooks((prev) => prev.map((entry) => (
                entry.key === look.key && lookItemFingerprint(entry.items) === requestedFingerprint
                  ? aiLook
                  : entry
              )));
            } else {
              aiFailStreakRef.current += 1;
              if (aiFailStreakRef.current >= AI_FAIL_LIMIT) aiDisabledRef.current = true;
            }
            pump(); // fill the freed concurrency slot
          });
      }
    };
    pump();
    return () => {
      cancelled = true;
      controllers.forEach((controller) => controller.abort());
    };
  }, [looks, frame, hasMounted, budgetSpec.budget, budgetSpec.customMaxCents, budgetSpec.maxTotalCents, lockedItems, disabledSlots]);

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
      .catch(() => {
        showToast('More verified looks are temporarily unavailable');
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

  /** Refresh both ranking adapters from the one local-first taste model. */
  function syncTasteProfile(profile: ReturnType<typeof loadTasteProfile>) {
    const signals = buildTasteRankingSignals(profile);
    const vibeCounters = tasteVibeCounters(signals);
    tasteSignalsRef.current = signals;
    vibeLikesRef.current = vibeCounters.likes;
    vibePassesRef.current = vibeCounters.passes;
  }

  function recordFeedTaste(input: TasteSignalInput) {
    if (typeof window === 'undefined') return;
    syncTasteProfile(recordTasteSignal(FEED_TASTE_STORAGE, input).profile);
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
    if (typeof window !== 'undefined') {
      syncTasteProfile(undoTasteSignal(FEED_TASTE_STORAGE, {
        action: 'pass',
        contextId: `feed:${look.key}`,
      }).profile);
    }
    setPassedKeys((prev) => {
      const next = new Set(prev);
      next.delete(look.key);
      return next;
    });
    feedback.swipe();
    track('look_pass_undone', { lookId: look.aiId || look.key, vibe: look.vibe, surface: 'feed' });
  }

  /** Save it — keep the fit, lift the vibe, celebrate. Idempotent per card:
   *  saveFit doesn't dedupe, so guard on savedKeys to avoid duplicate records. */
  function onLove(look: ScrollLook) {
    if (savedKeys.has(look.key)) return;
    dismissUndo(); // a save supersedes the previous pass's undo window
    const record = saveFit(look.items, look.vibe);
    recordFeedTaste({
      action: 'save',
      vibe: look.vibe,
      products: lookProducts(look.items),
      contextId: `feed:${look.key}`,
    });
    feedback.like();
    bumpDaily('likes'); // XP + the "like 3 fits" daily quest
    if (record) bumpDaily('saves'); // XP + the "save a fit" quest
    celebrateIfLeveledUp();
    track('look_loved', {
      lookId: look.aiId || look.key,
      surface: 'feed',
      vibe: look.vibe,
      pieces: lookProducts(look.items).length,
      totalCents: lookTotalCents(look.items),
      source: look.source,
    });
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
    if (!slug) {
      const hasDeviceOnlyPiece = Object.values(look.items).some((product) => product?.id.startsWith('owned-'));
      showToast(
        hasDeviceOnlyPiece
          ? 'Sharing is off for this look because it includes a piece saved only on this device.'
          : 'Sharing needs a complete top, bottom, and shoes.',
      );
      return;
    }
    const url = `${window.location.origin}/look/${slug}`;
    track('look_shared', { lookId: look.aiId || look.key, surface: 'feed', vibe: look.vibe });
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
    recordFeedTaste({
      action: 'pass',
      vibe: look.vibe,
      products: lookProducts(look.items),
      contextId: `feed:${look.key}`,
    });
    feedback.swipe();
    bumpDaily('looksViewed'); // XP for moving through fits (capped per day)
    celebrateIfLeveledUp();
    track('look_passed', { lookId: look.aiId || look.key, surface: 'feed', vibe: look.vibe });
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
    void gen(6, frame, vibeFilter)
      .then((fresh) => {
        if (fresh.length) resetFeed(fresh);
      })
      .catch(() => showToast('Could not refresh this look right now'));
  }

  function toggleLock(product: Product) {
    const currentlyLocked = lockedItems[product.category]?.id === product.id;
    const next = { ...lockedItems };
    if (currentlyLocked) delete next[product.category];
    else next[product.category] = product;
    setLockedItems(next);
    locksRef.current = next;
    track('lock_toggled', { productId: product.id, category: product.category, locked: !currentlyLocked, surface: 'feed' });
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
    const previousProduct = look.items[category];
    const currentId = previousProduct?.id;
    track('piece_replacement_started', {
      lookId: look.aiId || look.key,
      productId: currentId,
      category,
      vibe: look.vibe,
      surface: 'feed',
    });
    let engine: LookEngine;
    try {
      engine = await loadLookEngine();
    } catch {
      track('piece_replacement_failed', {
        lookId: look.aiId || look.key,
        productId: currentId,
        category,
        vibe: look.vibe,
        surface: 'feed',
        error_code: 'look_engine_unavailable',
      });
      showToast('Replacement is temporarily unavailable');
      return;
    }
    const { buildCatalogLook } = engine;
    const others: Partial<Record<Category, Product>> = {};
    for (const [cat, product] of Object.entries(look.items)) {
      if (cat !== category && product) others[cat as Category] = product;
    }
    const targetSlots = Array.from(new Set<Category>([
      ...(Object.keys(look.items) as Category[]),
      'top',
      'bottom',
      'shoes',
    ]));
    seedRef.current += 17;
    const built = buildCatalogLook({
      vibe: look.vibe,
      frame,
      budget: budgetSpec.budget,
      customMaxCents: budgetSpec.customMaxCents,
      mode: 'full',
      seed: seedRef.current,
      lockedItems: others,
      currentItems: others,
      targetSlots,
      avoidProductIds: [currentId, ...recentIdsRef.current].filter((id): id is string => Boolean(id)),
      transparentOnly: true,
      maxTotalCents: budgetSpec.maxTotalCents,
      requireCompleteBuyable: true,
      preferences: {
        ...generationPreferences,
        taste: tasteSignalsRef.current,
      },
    });
    const next = built.products[category];
    const mergedItems = next ? { ...look.items, [category]: next } : look.items;
    const mergedWithinBudget = budgetSpec.maxTotalCents == null
      || lookTotalCents(mergedItems) <= budgetSpec.maxTotalCents;
    if (
      !next
      || next.id === currentId
      || !isEditorialCutoutProduct(next)
      || !built.buyability.ok
      || !mergedWithinBudget
      || !isCompleteBuyableItems(mergedItems)
    ) {
      track('piece_replacement_failed', {
        lookId: look.aiId || look.key,
        productId: currentId,
        category,
        vibe: look.vibe,
        surface: 'feed',
        error_code: 'no_compatible_in_budget_replacement',
      });
      showToast(`No other ${CATEGORY_NOUN[category]} to swap to`);
      return;
    }
    recentIdsRef.current = [...recentIdsRef.current, next.id].slice(-80);
    recordFeedTaste({
      action: 'replacement',
      vibe: look.vibe,
      products: [next],
      rejectedProducts: previousProduct ? [previousProduct] : [],
      contextId: `feed:${look.key}:${category}`,
    });
    track('piece_swapped', {
      lookId: look.aiId || look.key,
      surface: 'feed',
      category,
      previousProductId: currentId,
      productId: next.id,
      vibe: look.vibe,
      previousTotalCents: lookTotalCents(look.items),
      totalCents: lookTotalCents(mergedItems),
    });
    setLooks((prev) =>
      prev.map((entry) =>
        entry.key === look.key
          ? {
              ...entry,
              items: mergedItems,
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
    recordFeedTaste({
      action: 'shop',
      vibe: look.vibe,
      products: lookProducts(look.items),
      contextId: `feed:${look.key}`,
    });
    track('look_shopped', {
      lookId: look.aiId || look.key,
      surface: 'feed',
      vibe: look.vibe,
      totalCents: lookTotalCents(look.items),
      pieces: products.length,
      productIds: products.map((product) => product.id),
    });
    const title = `${meta?.label || 'Sylistly'} fit`;
    setCheckout({ title, lookId: look.aiId || look.key, products });
    setShopSheet({ title, lookId: look.aiId || look.key, products }); // open the shop-the-look sheet in place (no route change)
  }

  function remixDirection(look: ScrollLook) {
    replaceItems(look.items);
    feedback.reveal(1);
    recordFeedTaste({
      action: 'remix',
      vibe: look.vibe,
      products: lookProducts(look.items),
      contextId: `feed:${look.key}`,
    });
    track('taste_map_remixed', {
      lookId: look.aiId || look.key,
      surface: 'feed',
      vibe: look.vibe,
      pieces: lookProducts(look.items).length,
      totalCents: lookTotalCents(look.items),
    });
    const remixBudget = budgetSpec.maxTotalCents == null
      ? 'any'
      : String(Math.round(budgetSpec.maxTotalCents / 100));
    router.push(`/build?vibe=${look.vibe}&frame=${frame}&budget=${remixBudget}`);
  }

  function toggleSlot(category: Category) {
    setDisabledSlots((prev) => {
      const next = new Set(prev);
      const enabling = next.has(category);
      if (enabling) next.delete(category);
      else next.add(category);
      safeStorageSet(SLOT_PREFS_KEY, JSON.stringify(Array.from(next)));
      track('slot_toggled', { category, enabled: enabling, surface: 'feed' });
      return next;
    });
  }

  function completeOnboarding(answers: StyleAnswers, identity: StyleIdentity) {
    safeStorageSet(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
    // Apply the quiz to the profile (steers generation) and persist the identity.
    setBodyType(answers.frame);
    setBudget(answers.budget);
    setFitPreference(answers.fit);
    setPalettePreference(answers.palette);
    setVibesFromText(identity.vibes.join(', '));
    saveIdentity(answers, identity);
    // Seed the shared on-device taste model so Feed and Build use the same
    // primary-vibe evidence from the first recommendation onward.
    identity.vibes.forEach((vibe, index) => {
      recordFeedTaste({
        action: 'onboarding',
        vibe,
        strength: identity.vibes.length - index,
        contextId: `onboarding:${vibe}`,
      });
    });
    setVibeFilter('all');
    recentIdsRef.current = [];
  }

  function skipOnboarding() {
    safeStorageSet(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
  }

  const lockCount = Object.keys(lockedItems).length;
  const visibleLookCount = looks.filter((look) => {
    if (!isCompleteBuyableItems(look.items)) return false;
    return budgetSpec.maxTotalCents == null || lookTotalCents(look.items) <= budgetSpec.maxTotalCents;
  }).length;

  return (
    <main className="sy-game-screen relative mx-auto flex h-[100svh] max-w-[480px] flex-col overflow-hidden bg-bg lg:max-w-none lg:px-6 lg:py-5 xl:px-10">
      <h1 className="sr-only">Sylistly For You — complete outfits with exact retailer links within your budget</h1>
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

      {/* A quiet commerce header: the product and its budget promise lead. */}
      <header className="relative z-30 shrink-0 pb-2 pt-[calc(env(safe-area-inset-top)+10px)] lg:rounded-[28px] lg:border lg:border-hairline lg:bg-surface-1/70 lg:px-5 lg:py-3 lg:backdrop-blur-xl">
        <div className={`flex items-center justify-between gap-3 px-4 lg:px-0${bootCold ? ' sy-boot-1' : ''}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            {vibeFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setVibeFilter('all')}
                aria-label="Back to For you"
                className="sy-press grid h-11 w-11 self-center place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink"
              >
                <ChevronLeft size={15} />
              </button>
            ) : (
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_16px_rgba(255,45,109,.7)]" />
            )}
            <span className="shrink-0 text-[12px] font-black uppercase tracking-[.22em] text-ink sy-sheen">Sylistly</span>
            <span className="truncate font-serif text-[18px] font-semibold italic leading-none text-ink">
              {vibeFilter === 'all' ? 'For you' : VIBE_META.get(vibeFilter)?.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/discover"
              aria-label="Discover complete looks"
              className="sy-press hidden min-h-11 items-center gap-2 rounded-full border border-hairline-2 bg-surface-2/80 px-4 text-[12px] font-bold text-ink backdrop-blur-md lg:inline-flex"
            >
              <Layers size={15} />
              Discover
            </Link>
            <Link
              href="/browse"
              aria-label="Browse every piece"
              className="sy-press hidden min-h-11 items-center gap-2 rounded-full border border-hairline-2 bg-surface-2/80 px-4 text-[12px] font-bold text-ink backdrop-blur-md lg:inline-flex"
            >
              <LayoutGrid size={15} />
              Browse pieces
            </Link>
            <button
              type="button"
              onClick={() => setTuneOpen((open) => !open)}
              aria-expanded={tuneOpen}
              aria-controls="feed-tuning-panel"
              aria-label={`Outfit budget: ${budgetSpec.label}. Tune recommendations`}
              className="sy-press inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-2 bg-surface-2/80 px-3 text-[12px] font-bold text-ink backdrop-blur-md"
            >
              <span>{budgetSpec.label}</span>
              {tuneOpen ? <X size={15} /> : <SlidersHorizontal size={15} />}
            </button>
          </div>
        </div>

        {/* Tune panel: budget first, then taste and optional-piece controls. */}
        {tuneOpen ? (
          <div id="feed-tuning-panel" role="region" aria-labelledby="feed-tuning-title" className="mx-4 mt-3 max-h-[min(68svh,580px)] animate-sy-rise overflow-y-auto rounded-card border border-hairline bg-surface-1/95 p-4 shadow-float backdrop-blur-xl lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-x-6">
            <h2 id="feed-tuning-title" className="sr-only">Tune recommendations</h2>
            <div>
              <p id="feed-budget-label" className="text-eyebrow font-extrabold uppercase text-muted">Whole-outfit budget</p>
              <div role="group" aria-labelledby="feed-budget-label" className="mt-2 grid grid-cols-2 gap-2">
                {(Object.entries(FEED_BUDGETS) as Array<[ProfileBudget, (typeof FEED_BUDGETS)[ProfileBudget]]>).map(([value, option]) => {
                  const active = value === profileBudget;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setBudget(value);
                        track('feed_budget_changed', { budget: value, maxTotalCents: option.maxTotalCents, surface: 'feed' });
                      }}
                      aria-pressed={active}
                      className={`sy-press min-h-11 rounded-full border px-3 text-[12px] font-bold transition ${
                        active
                          ? 'border-accent bg-accent text-bg shadow-pink-glow'
                          : 'border-hairline-2 bg-surface-2 text-muted-2'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                This ceiling applies to the entire look, not to each item.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
                <Link href="/discover" className="sy-press inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-hairline-2 bg-surface-2 text-[12px] font-bold text-ink">
                  <Layers size={15} /> Discover
                </Link>
                <Link href="/browse" className="sy-press inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-hairline-2 bg-surface-2 text-[12px] font-bold text-ink">
                  <LayoutGrid size={15} /> Browse
                </Link>
              </div>
            </div>
            <div>
            <p id="feed-style-lane-label" className="text-eyebrow font-extrabold uppercase text-muted">Style lane</p>
            <div role="group" aria-labelledby="feed-style-lane-label" className="sy-edge-fade-x mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button type="button" onClick={() => { setVibeFilter('all'); track('vibe_selected', { vibe: 'all', surface: 'feed' }); }} aria-pressed={vibeFilter === 'all'} className={`sy-press inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-[11px] font-bold ${vibeFilter === 'all' ? 'border-accent bg-accent text-bg' : 'border-hairline-2 bg-surface-2 text-muted-2'}`}>
                <Sparkles size={13} /> For you
              </button>
              {VIBES.map((vibe) => {
                const thumb = vibeThumbs.get(vibe.id);
                return (
                  <button key={vibe.id} type="button" onClick={() => { setVibeFilter(vibe.id); track('vibe_selected', { vibe: vibe.id, surface: 'feed' }); }} aria-pressed={vibeFilter === vibe.id} className={`sy-press inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[11px] font-bold ${vibeFilter === vibe.id ? 'border-accent/70 bg-accent-soft text-ink' : 'border-hairline bg-surface-2 text-muted-2'}`}>
                    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[#d9d0c4]">
                      {thumb ? <ProductImage product={thumb} transparentOnly loading="eager" wrapperClassName="h-[82%] w-[82%]" className="h-full w-full object-contain" /> : null}
                    </span>
                    {vibe.label}
                  </button>
                );
              })}
            </div>
            <p id="feed-optional-slots-label" className="mt-3 text-eyebrow font-extrabold uppercase text-muted">Generate with</p>
            <div role="group" aria-labelledby="feed-optional-slots-label" className="mt-2 flex flex-wrap gap-2">
              {OPTIONAL_SLOTS.map((slot) => {
                const enabled = !disabledSlots.has(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    aria-pressed={enabled}
                    className={`sy-press min-h-11 rounded-full border px-3.5 py-2 text-[12px] font-semibold capitalize transition ${
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
              Switched-off accessories stop appearing in new fits. Top, bottoms, and shoes always stay complete.
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
                aria-label="Sound and haptics"
                className={`sy-press inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  muted ? 'border-hairline bg-surface-2 text-muted' : 'border-accent/60 bg-accent-soft text-accent'
                }`}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {muted ? 'Off' : 'On'}
              </button>
            </div>
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
              className="sy-press min-h-11 rounded-full border border-hairline-2 bg-surface-2/70 px-2.5 py-1 text-[11px] font-semibold text-muted-2"
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
        // NO transform/filter/animation on this element. `sy-deck-in` lived here
        // and its `fill: both` left `transform: matrix(1,…)` on the scroller
        // permanently — Safari then renders the scrolled content through that
        // transform while scroll math stays in layout px, so the feed never
        // locks to a card and momentum feels detached. app/template.tsx already
        // animates the screen in via `sy-route-enter`, one level up and outside
        // the scroll container, so nothing is lost visually.
        className="relative z-10 min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain px-4 scrollbar-hide lg:px-0"
      >
        {visibleLookCount === 0 ? (
          <div className="grid h-full min-h-[520px] place-items-center px-5">
            <section role="status" className="w-full max-w-[560px] rounded-[30px] border border-hairline bg-surface-1 p-7 text-center shadow-card-strong">
              {feedStatus === 'loading' ? (
                <>
                  <RefreshCw size={24} className="mx-auto animate-spin text-accent" />
                  <h2 className="mt-4 font-serif text-[26px] font-semibold italic text-ink">Restyling to your budget</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-2">Checking every piece before this look reaches your feed.</p>
                </>
              ) : (
                <>
                  <BadgeCheck size={25} className="mx-auto text-champagne" />
                  <h2 className="mt-4 font-serif text-[26px] font-semibold italic text-ink">No complete look clears every check</h2>
                  <p className="mx-auto mt-2 max-w-[42ch] text-[13px] leading-relaxed text-muted-2">
                    {lockCount
                      ? `This locked piece cannot form a complete ${budgetSpec.label.toLowerCase()} outfit from the verified catalog yet.`
                      : `We withheld partial or over-budget results instead of showing a look you cannot fully shop.`}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {lockCount ? (
                      <button type="button" onClick={clearLocks} className="min-h-11 rounded-full bg-accent px-5 text-[12px] font-bold text-bg">Clear locked piece</button>
                    ) : null}
                    <button type="button" onClick={() => setTuneOpen(true)} className="min-h-11 rounded-full border border-hairline-2 bg-surface-2 px-5 text-[12px] font-bold text-ink">Change budget</button>
                    <Link href="/browse" className="inline-flex min-h-11 items-center rounded-full border border-champagne/40 px-5 text-[12px] font-bold text-ink">Browse reviewed pieces</Link>
                  </div>
                </>
              )}
            </section>
          </div>
        ) : null}
        {looks.map((look) => {
            const meta = VIBE_META.get(look.vibe);
            const products = lookProducts(look.items);
            const isCompleteBuyable = isCompleteBuyableItems(look.items);
            if (!isCompleteBuyable) return null;
            const total = lookTotalCents(look.items);
            if (budgetSpec.maxTotalCents != null && total > budgetSpec.maxTotalCents) return null;
            const budgetRemaining = budgetSpec.maxTotalCents == null
              ? null
              : budgetSpec.maxTotalCents - total;
            const swatches = lookSwatches(look);
            const saved = savedKeys.has(look.key);
            const passed = passedKeys.has(look.key);
            const freshVerified = products.every((product) => hasFreshPositiveAvailability(product));
            return (
              <article
                key={look.key}
                data-look-key={look.key}
                aria-label={`${meta?.label || look.vibe} look, ${formatPrice(total)}`}
                className={`relative h-full w-full shrink-0 snap-start snap-always transition-[opacity,filter] duration-300 lg:py-3 ${passed ? 'opacity-40 saturate-[.4]' : ''}`}
              >
                <div className="relative h-full w-full lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:overflow-hidden lg:rounded-[32px] lg:border lg:border-hairline lg:bg-surface-1/90 lg:shadow-card-strong">
                  <div
                    className="relative h-full w-full overflow-hidden rounded-card-lg bg-bg ring-1 ring-hairline shadow-card-strong lg:rounded-none lg:shadow-none lg:ring-0"
                  >
                    <div className="absolute inset-0">
                      <WornFlatlay
                        items={products}
                        loading="lazy"
                        plate="spotlight"
                        depth
                        bottomReserve={33}
                        className="h-full w-full"
                        onPieceClick={(product) => setPeek({ look, product })}
                      />
                    </div>

                    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-3 lg:inset-x-5 lg:top-5">
                      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-money/35 bg-[rgba(9,16,12,.78)] px-3 text-[11px] font-bold text-money backdrop-blur-xl">
                        <BadgeCheck size={14} />
                        {freshVerified ? 'Verified available today' : 'Complete outfit'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-[rgba(9,8,10,.62)] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2 backdrop-blur-xl">
                        Tap a piece to replace
                      </span>
                    </div>

                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-[360px] bg-[linear-gradient(180deg,transparent_0%,rgba(13,13,15,.42)_28%,rgba(13,13,15,.9)_62%,rgba(11,11,13,.99)_100%)] lg:hidden"
                    />
                    <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+82px)] z-10 lg:hidden">
                      {look.source === 'syli' ? (
                        <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-champagne/40 bg-champagne-soft px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.16em] text-champagne">
                          <Sparkles size={10} /> Styled by Syli
                        </span>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-accent">{meta?.blurb || 'Styled for you'}</p>
                          <h2 className="mt-1 font-serif text-[29px] font-semibold italic leading-none text-ink">
                            {meta?.label || 'The look'}
                          </h2>
                        </div>
                        <span className="shrink-0 font-serif text-[28px] font-semibold leading-none text-ink">{formatPrice(total)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1.5 text-money">
                          <BadgeCheck size={14} /> Complete · {products.length}/{products.length} exact links
                        </span>
                        {freshVerified ? <span className="text-money">Stock verified today</span> : null}
                        {budgetRemaining != null && budgetRemaining >= 0 ? (
                          <span className="text-muted-2">{formatPrice(budgetRemaining)} under budget</span>
                        ) : (
                          <span className="text-muted-2">Exact retailer pages</span>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 max-w-[48ch] text-[12.5px] leading-snug text-muted-2">
                        {look.source === 'syli' && look.note ? tidyNote(look.note) : syliNote(look)}
                      </p>
                      <div className="mt-3 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
                        <button
                          type="button"
                          onClick={() => shop(look)}
                          className="sy-press inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[12px] font-extrabold text-bg shadow-pink-glow"
                        >
                          <ShoppingBag size={16} /> Shop items
                          <ArrowRight size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remixDirection(look)}
                          className="sy-press inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-champagne/45 bg-[rgba(13,13,15,.64)] px-4 text-[12px] font-bold text-ink"
                        >
                          <WandSparkles size={15} /> Remix
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-3 divide-x divide-hairline text-[11px] font-semibold text-muted-2">
                        <button type="button" onClick={() => onLove(look)} aria-pressed={saved} className={`sy-press inline-flex min-h-11 items-center justify-center gap-1.5 ${saved ? 'text-accent' : ''}`}>
                          <Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save look'}
                        </button>
                        <button type="button" onClick={() => onPass(look)} disabled={passed} className="sy-press inline-flex min-h-11 items-center justify-center gap-1.5 disabled:opacity-45">
                          <X size={16} /> Not for me
                        </button>
                        <button type="button" onClick={() => onShare(look)} className="sy-press inline-flex min-h-11 items-center justify-center gap-1.5">
                          <Share size={15} /> Share
                        </button>
                      </div>
                    </div>

                    {/* Love-burst — celebrates a saved fit in its OWN palette */}
                    {burstKey === look.key ? (
                      <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
                        <span className="sy-motion-optional absolute h-24 w-24 rounded-full border-2 border-accent" style={{ animation: 'sy-ring-burst .55s ease-out both' }} />
                        <Heart size={84} fill="currentColor" className="sy-motion-optional text-accent drop-shadow-[0_0_24px_rgba(255,45,109,.7)]" style={{ animation: 'sy-heart-pop .6s ease-out both' }} />
                        {swatches.map((s, i) => {
                          const angle = (i / Math.max(1, swatches.length)) * Math.PI * 2 + (i % 2) * 0.26;
                          const dist = 54 + (i % 4) * 14;
                          return (
                            <span
                              key={`burst-${s.word}-${i}`}
                              className="sy-motion-optional absolute h-2 w-2 rounded-full"
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

                  <aside className="hidden min-h-0 flex-col border-l border-hairline bg-[rgba(18,18,21,.96)] p-6 lg:flex xl:p-8">
                    <p className="text-eyebrow font-extrabold uppercase text-accent">{meta?.blurb || 'Styled for you'}</p>
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-serif text-[36px] font-semibold italic leading-none text-ink">{meta?.label || 'The look'}</h2>
                        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-money">
                          <BadgeCheck size={15} /> Complete · {products.length}/{products.length} exact links
                        </p>
                        {freshVerified ? <p className="mt-1 text-[11px] font-semibold text-money">Stock verified today</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="font-serif text-[34px] font-semibold leading-none text-ink">{formatPrice(total)}</p>
                        {budgetRemaining != null && budgetRemaining >= 0 ? (
                          <p className="mt-2 text-[12px] font-semibold text-money">{formatPrice(budgetRemaining)} under budget</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-4 text-[14px] leading-relaxed text-muted-2">
                      {look.source === 'syli' && look.note ? tidyNote(look.note) : syliNote(look)}
                    </p>

                    <div className="mt-5 min-h-0 flex-1 overflow-y-auto border-y border-hairline py-2 scrollbar-hide">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center gap-3 border-b border-hairline py-3 last:border-b-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-muted">{CATEGORY_NOUN[product.category]}</p>
                            <p className="mt-1 truncate text-[13px] font-bold text-ink">{product.brand}</p>
                            <p className="truncate text-[12px] text-muted-2">{product.name}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[12px] font-bold text-ink">{formatPrice(product.priceCents)}</p>
                            <button
                              type="button"
                              onClick={() => swapPiece(look, product.category)}
                              className="sy-press mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline-2 px-3 text-[11px] font-bold text-muted-2 hover:border-accent/60 hover:text-ink"
                              aria-label={`Replace ${CATEGORY_NOUN[product.category]}`}
                            >
                              <RefreshCw size={13} /> Replace
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-2">
                      <button type="button" onClick={() => shop(look)} className="sy-press inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[13px] font-extrabold text-bg shadow-pink-glow">
                        <ShoppingBag size={17} /> Shop items <ArrowRight size={15} />
                      </button>
                      <button type="button" onClick={() => remixDirection(look)} className="sy-press inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-champagne/45 bg-surface-2 px-4 text-[13px] font-bold text-ink">
                        <WandSparkles size={16} /> Remix
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 divide-x divide-hairline text-[12px] font-semibold text-muted-2">
                      <button type="button" onClick={() => onLove(look)} aria-pressed={saved} className={`sy-press inline-flex min-h-11 items-center justify-center gap-1.5 ${saved ? 'text-accent' : ''}`}>
                        <Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}
                      </button>
                      <button type="button" onClick={() => onPass(look)} disabled={passed} className="sy-press inline-flex min-h-11 items-center justify-center gap-1.5 disabled:opacity-45">
                        <X size={16} /> Pass
                      </button>
                      <button type="button" onClick={() => onShare(look)} className="sy-press inline-flex min-h-11 items-center justify-center gap-1.5">
                        <Share size={15} /> Share
                      </button>
                    </div>
                  </aside>
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
              className="sy-press min-h-11 rounded-full bg-accent px-3 py-1 text-[12px] font-bold text-bg shadow-pink-glow"
            >
              Undo
            </button>
          </span>
        </div>
      ) : null}

      {/* Shop-the-look sheet — slides up in place; shop every piece grouped by retailer */}
      {shopSheet ? (
        <CheckoutSheet open title={shopSheet.title} lookId={shopSheet.lookId} products={shopSheet.products} onClose={() => setShopSheet(null)} />
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
