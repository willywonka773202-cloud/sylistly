'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Bookmark, ExternalLink, Layers, LoaderCircle, Lock, Plus, RotateCcw, Send, SlidersHorizontal, Sparkles } from 'lucide-react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mannequin } from '@/components/Mannequin';
import { SearchSheet } from '@/components/SearchSheet';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import {
  collectOutfitProductIds,
  getClientCatalogProducts,
  getBrandOrMerchant,
  getOutfitBrandCounts,
  getShoeId,
  hydrateItemsFromCatalog,
  outfitFullSignature,
  outfitRequiredSignature,
} from '@/lib/client-catalog';
import { getProductOutboundUrl } from '@/lib/product-links';
import { hasFrameMismatch } from '@/lib/frame-inference';
import {
  getTransparentProductImageUrl,
  hasHighCategoryConfidence,
  hasExactProductLink,
  hasTransparentProductImage,
  isEditorialCutoutProduct,
  productImageQualityScore,
  sortTransparentFeedRenderableProducts,
} from '@/lib/product-image-quality';
import {
  VIBES,
  getBudgetMaxCents,
  type GeneratorBudget,
  type GeneratorFrame,
  type VibeId,
  vibeSearchQuery,
} from '@/lib/vibes';

const EDITORIAL_LOADING_LINES = [
  'Balancing silhouette...',
  'Matching tones...',
  'Placing accessories...',
  'Polishing the board...',
];

const MISSING_GENERATOR_PRIORITY: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'eyewear', 'jewelry', 'hat'];
const STARTER_GENERATOR_SLOTS: Record<VibeId, Category[]> = {
  night: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  street: ['hat', 'outer', 'top', 'bottom', 'shoes', 'eyewear'],
  clean: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  gym: ['top', 'bottom', 'shoes', 'outer', 'hat', 'bag'],
  cozy: ['outer', 'top', 'bottom', 'shoes', 'hat', 'bag'],
  date: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  office: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  vacation: ['hat', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  edgy: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  preppy: ['outer', 'top', 'bottom', 'shoes', 'eyewear'],
};
const FULL_GENERATOR_SLOTS: Record<VibeId, Category[]> = {
  night: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  street: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  clean: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  gym: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'],
  cozy: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'],
  date: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  office: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  vacation: ['hat', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  edgy: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  preppy: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
};

function isBuildReadyProduct(product?: Product | null): product is Product {
  return Boolean(product && isEditorialCutoutProduct(product) && hasExactProductLink(product));
}

function isBuildReadySlotProduct(product: Product | null | undefined, slot: Category): product is Product {
  return Boolean(
    product
    && product.category === slot
    && isBuildReadyProduct(product)
    && hasHighCategoryConfidence(product, slot),
  );
}

function slotProductText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.retailer,
    ...(product.searchTerms || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
  ].join(' ').toLowerCase();
}

function slotCandidateScore(product: Product, query: string): number {
  const queryTerms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
  const text = slotProductText(product);
  const queryHits = queryTerms.filter((term) => text.includes(term)).length;
  return productImageQualityScore(product)
    + queryHits * 8
    + (hasExactProductLink(product) ? 40 : 0)
    + (hasTransparentProductImage(product) ? 30 : 0);
}

function brandConcentrationPenalty(
  product: Product,
  recentBrandCounts: Record<string, number> = {},
  draftItems: Partial<Record<Category, Product>> = {},
): number {
  const brand = getBrandOrMerchant(product);
  if (!brand) return 0;
  const recentCount = recentBrandCounts[brand] || 0;
  const draftCount = Object.values(draftItems)
    .filter((item): item is Product => Boolean(item))
    .filter((item) => item.id !== product.id && getBrandOrMerchant(item) === brand)
    .length;
  return recentCount * 72
    + Math.max(0, recentCount - 1) * 90
    + draftCount * 260
    + Math.max(0, draftCount - 1) * 320;
}

function buildSlotCandidateRankScore(
  product: Product,
  query: string,
  recentBrandCounts: Record<string, number> = {},
  draftItems: Partial<Record<Category, Product>> = {},
): number {
  return slotCandidateScore(product, query) - brandConcentrationPenalty(product, recentBrandCounts, draftItems);
}

function pickBuildSlotCandidate(
  products: Product[],
  slot: Category,
  query: string,
  avoidIds: string[] = [],
  recentBrandCounts: Record<string, number> = {},
  draftItems: Partial<Record<Category, Product>> = {},
): Product | null {
  const avoidSet = new Set(avoidIds);
  const slotReady = products
    .filter((product) => isBuildReadySlotProduct(product, slot))
    .sort((left, right) =>
      buildSlotCandidateRankScore(right, query, recentBrandCounts, draftItems)
      - buildSlotCandidateRankScore(left, query, recentBrandCounts, draftItems),
    );

  const fresh = slotReady.filter((product) => !avoidSet.has(product.id));
  const pool = fresh.length ? fresh : slotReady;
  const shortList = pool.slice(0, Math.min(8, pool.length));
  if (!shortList.length) return null;

  const totalWeight = shortList.reduce((sum, product, index) => sum + Math.max(1, 14 - index * 2 + Math.max(0, buildSlotCandidateRankScore(product, query, recentBrandCounts, draftItems) / 25)), 0);
  let roll = Math.random() * totalWeight;
  for (let index = 0; index < shortList.length; index += 1) {
    const product = shortList[index];
    roll -= Math.max(1, 14 - index * 2 + Math.max(0, buildSlotCandidateRankScore(product, query, recentBrandCounts, draftItems) / 25));
    if (roll <= 0) return product;
  }
  return shortList[0];
}

function mergeBuildCandidates(...candidateGroups: Product[][]): Product[] {
  const productsById = new Map<string, Product>();
  for (const product of candidateGroups.flat()) {
    if (!product?.id || productsById.has(product.id)) continue;
    productsById.set(product.id, product);
  }
  return Array.from(productsById.values());
}

function filterBuildContextProducts(products: Product[], frame: GeneratorFrame, priceMax?: number | null): Product[] {
  const maxCents = typeof priceMax === 'number' && Number.isFinite(priceMax) && priceMax > 0
    ? priceMax * 100
    : null;

  return products.filter((product) => {
    if (maxCents && product.priceCents > maxCents) return false;
    if (hasFrameMismatch(product, frame)) return false;
    return true;
  });
}

function defaultGenerationSlotsForVibe(vibe: VibeId): Category[] {
  return FULL_GENERATOR_SLOTS[vibe] || STARTER_GENERATOR_SLOTS[vibe] || ['top', 'bottom', 'shoes', 'bag'];
}

type BuilderPreferenceKind = 'save' | 'pass';

interface BuilderPreferenceHistory {
  events: Array<{
    kind: BuilderPreferenceKind;
    vibe: VibeId;
    productIds: string[];
    categories: Category[];
    createdAt: number;
  }>;
  vibes: Partial<Record<VibeId, { saved: number; passed: number }>>;
  categories: Partial<Record<Category, { saved: number; passed: number }>>;
  products: Record<string, { saved: number; passed: number }>;
}

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Headwear',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

const CATEGORY_PRIORITY: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];
const NEUTRAL_COLORS = new Set(['black', 'white', 'cream', 'ivory', 'beige', 'stone', 'grey', 'gray', 'charcoal', 'tan', 'brown', 'navy']);
const SWIPE_HINT_STORAGE_KEY = 'sylistly-builder-swipe-hint-v2';
const BUILDER_PREFERENCES_STORAGE_KEY = 'sylistly-builder-preferences-v1';

/**
 * Stable signature for an outfit-items map, keyed by category + product id.
 *
 * Used to decide whether two `Partial<Record<Category, Product>>` values
 * represent the same outfit even when their object references differ — e.g.
 * after `hydrateItemsFromCatalog` spreads fresh `{ ...product, ...catalogProduct }`
 * shells on every call. Comparing signatures prevents an effect that calls
 * `replaceItems(hydrated)` from looping forever on referentially-new but
 * semantically-identical results.
 */
function itemSignature(items: Partial<Record<Category, Product>>): string {
  return Object.entries(items)
    .sort(([leftCat], [rightCat]) => leftCat.localeCompare(rightCat))
    .map(([cat, product]) => `${cat}:${product?.id ?? ''}`)
    .join('|');
}

type BuildSectionTab = 'build' | 'settings' | 'refine' | 'details';

const BUILD_SECTION_LABELS: Record<BuildSectionTab, string> = {
  build: 'Build',
  settings: 'Settings',
  refine: 'Refine',
  details: 'Details',
};

const BUILD_OVERLAY_TABS = ['settings', 'refine', 'details'] as const;

function recordBuilderPreferenceEvent(
  kind: BuilderPreferenceKind,
  productsBySlot: Partial<Record<Category, Product>>,
  vibe: VibeId,
) {
  if (typeof window === 'undefined') return;
  const entries = Object.entries(productsBySlot).filter((entry): entry is [Category, Product] => Boolean(entry[1]));
  if (!entries.length) return;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(BUILDER_PREFERENCES_STORAGE_KEY) || '{}') as Partial<BuilderPreferenceHistory>;
    const history: BuilderPreferenceHistory = {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      vibes: parsed.vibes || {},
      categories: parsed.categories || {},
      products: parsed.products || {},
    };
    const counterKey = kind === 'save' ? 'saved' : 'passed';

    history.events.unshift({
      kind,
      vibe,
      productIds: entries.map(([, product]) => product.id),
      categories: entries.map(([category]) => category),
      createdAt: Date.now(),
    });
    history.events = history.events.slice(0, 120);

    history.vibes[vibe] = history.vibes[vibe] || { saved: 0, passed: 0 };
    history.vibes[vibe]![counterKey] += 1;

    for (const [category, product] of entries) {
      history.categories[category] = history.categories[category] || { saved: 0, passed: 0 };
      history.categories[category]![counterKey] += 1;
      history.products[product.id] = history.products[product.id] || { saved: 0, passed: 0 };
      history.products[product.id][counterKey] += 1;
    }

    window.localStorage.setItem(BUILDER_PREFERENCES_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Local preference tracking should never block save/pass/generation flows.
  }
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.body.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

interface OutfitAnalysis {
  score: number;
  colorHarmony: number;
  silhouette: number;
  layering: number;
  proportions: number;
  palette: string[];
  styleDna: string[];
  missing: Category[];
  primaryGap: Category | null;
  harmonyLabel: string;
  silhouetteLabel: string;
  balanceLabel: string;
  upgradeNote: string;
  crowding: {
    upper: 'calm' | 'balanced' | 'crowded';
    mid: 'calm' | 'balanced' | 'crowded';
    lower: 'calm' | 'balanced' | 'crowded';
  };
}

// Picks the single most useful next action based on real builder state.
// All hints are concrete instructions that map to controls already on
// the page — no aspirational copy.  Returning null is allowed: when the
// fit is healthy, the next-best block hides instead of forcing chatter.
function computeNextBestAction(
  items: Partial<Record<Category, Product>>,
  lockedSlots: Category[],
  itemCount: number,
): { label: string; hint: string } | null {
  if (itemCount === 0) {
    return {
      label: 'Generate your first look',
      hint: 'Tap Quick Fit below to pull a starter outfit for the selected vibe.',
    };
  }
  if (!items.shoes) {
    return {
      label: 'Add shoes to anchor the fit',
      hint: 'Shoes finish the silhouette — tap Fill Missing to slot them in.',
    };
  }
  if (!items.bottom) {
    return {
      label: 'Add bottoms to ground the look',
      hint: 'A bottom locks in the proportions — tap Fill Missing.',
    };
  }
  if (!items.top) {
    return {
      label: 'Add a top to balance the fit',
      hint: 'A top anchors the upper half — tap Fill Missing.',
    };
  }
  if (lockedSlots.length === 0) {
    return {
      label: 'Lock your favorite piece',
      hint: 'Tap any slot, then Lock to keep that piece while you remix the rest.',
    };
  }
  if (itemCount >= 7) {
    return {
      label: 'Try Fuller Fit for variation',
      hint: 'You have a rich outfit — Fuller Fit shuffles unlocked pieces for new combos.',
    };
  }
  return {
    label: 'Remix to refine',
    hint: 'Tap Remix to swap your unlocked pieces while locked items stay put.',
  };
}

function BuilderPageContent({
  quickSlot,
  quickQuery,
  quickVibe,
  quickFrame,
  quickSlots,
  quickLock,
  quickSource,
}: {
  quickSlot: string | null;
  quickQuery: string | null;
  quickVibe: string | null;
  quickFrame: string | null;
  quickSlots: string | null;
  quickLock: string | null;
  quickSource: string | null;
}) {
  const { items, totalCents, count, clear, replaceItems } = useFit();
  const skinTone = useProfile((state) => state.profile.skinTone);
  const bodyType = useProfile((state) => state.profile.bodyType);
  const setBodyType = useProfile((state) => state.setBodyType);
  const stylePrefs = useProfile((state) => state.profile.stylePrefs);
  const saveLocalFit = useSavedFits((state) => state.saveFit);
  const postFitToFeed = useSocialFeed((state) => state.postFit);
  const [searchFor, setSearchFor] = useState<Category | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stylingNote, setStylingNote] = useState<{ notes?: string; palette?: string[] } | null>(null);
  const [editorialConfigured, setEditorialConfigured] = useState(false);
  const [editorialLoading, setEditorialLoading] = useState(false);
  const [editorialImage, setEditorialImage] = useState<string | null>(null);
  const [editorialError, setEditorialError] = useState<string | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<VibeId>('clean');
  const [selectedGenerationSlots, setSelectedGenerationSlots] = useState<Category[]>(() =>
    defaultGenerationSlotsForVibe('clean'),
  );
  const [generatorBudget, setGeneratorBudget] = useState<GeneratorBudget>('under250');
  const [customBudgetInput, setCustomBudgetInput] = useState('');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  // True while the instant deterministic fit is shown and the AI-styled look is
  // still composing in the background (optimistic generation).
  const [aiRefining, setAiRefining] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [recentGeneratedIds, setRecentGeneratedIds] = useState<string[]>([]);
  const recentRequiredComboRef = useRef<string[]>([]);
  const recentFullComboRef = useRef<string[]>([]);
  const recentShoeIdsRef = useRef<string[]>([]);
  const recentBrandCountsRef = useRef<Record<string, number>>({});
  const recentFormulaIdsRef = useRef<string[]>([]);
  const [boardDragging, setBoardDragging] = useState(false);
  const [activeEditSlot, setActiveEditSlot] = useState<Category | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState<'save' | 'pass' | null>(null);
  const [dragIntent, setDragIntent] = useState<'save' | 'pass' | null>(null);
  const [swipeCoachLabel, setSwipeCoachLabel] = useState<'save' | 'pass' | null>(null);
  const [swipeHintDismissed, setSwipeHintDismissed] = useState(false);
  const [swipeHintRunCount, setSwipeHintRunCount] = useState(0);
  const [saveBurst, setSaveBurst] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeBuildOverlay, setActiveBuildOverlay] = useState<Exclude<BuildSectionTab, 'build'> | null>(null);
  const [lockedSlots, setLockedSlots] = useState<Category[]>([]);
  // Tracks which slots were updated in the most recent successful generate.
  // Used only for a one-shot visual glow on the slot pills; cleared after
  // ~1.4s. State is set inside the user-triggered generateLook callback —
  // NOT inside a useEffect that depends on `items` — so it can't loop.
  const [recentChangedSlots, setRecentChangedSlots] = useState<Category[]>([]);
  const recentChangedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickSourceProcessedRef = useRef(false);
  const [postVisibility, setPostVisibility] = useState<'public' | 'private'>('public');
  const boardControls = useAnimation();
  const router = useRouter();
  const total = totalCents();
  const n = count();
  const renderItems = useMemo<Partial<Record<Category, Product>>>(() => (hasMounted ? items : {}), [hasMounted, items]);
  const renderN = hasMounted ? n : 0;
  const totalDisplay = `$${(total / 100).toFixed(2)}`;
  const activeVibe = VIBES.find((vibe) => vibe.id === selectedVibe) || VIBES[0];
  const generatorFrame: GeneratorFrame =
    bodyType === 'custom' ? 'androgynous' : bodyType;
  const analysis = useMemo(() => analyzeOutfit(renderItems, activeVibe.label), [renderItems, activeVibe.label]);
  const [bagLayer, setBagLayer] = useState<'front' | 'behind'>('front');
  const customBudgetCents = customBudgetInput ? Number(customBudgetInput) * 100 : null;
  const activePriceMax =
    generatorBudget === 'any'
      ? null
      : generatorBudget === 'custom'
      ? customBudgetInput
        ? Number(customBudgetInput)
        : null
      : getBudgetMaxCents(generatorBudget) / 100;
  const refineFocusCategory =
    activeEditSlot ||
    CATEGORY_ORDER.find((category) => renderItems[category]) ||
    analysis.primaryGap ||
    'top';
  const lockedSlotSet = useMemo(() => new Set(lockedSlots), [lockedSlots]);

  const playSwipeHint = useCallback(async () => {
    if (generatorLoading || boardDragging || searchFor) return;
    if (window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY) === '1') {
      setSwipeHintDismissed(true);
      return;
    }

    setSwipeHintRunCount((current) => current + 1);
    setSwipeCoachLabel('pass');
    await boardControls.start({
      x: -30,
      rotate: -1.6,
      transition: { type: 'spring', stiffness: 170, damping: 18 },
    });
    setSwipeCoachLabel('save');
    await boardControls.start({
      x: 34,
      rotate: 1.8,
      transition: { type: 'spring', stiffness: 170, damping: 18 },
    });
    await boardControls.start({
      x: 0,
      rotate: 0,
      transition: { type: 'spring', stiffness: 220, damping: 20 },
    });
    setSwipeCoachLabel(null);
  }, [boardControls, boardDragging, generatorLoading, searchFor]);

  useBodyScrollLock(Boolean(activeBuildOverlay || checkoutProducts));

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Is the optional AI editorial-photo feature available? (only show the button if so)
  useEffect(() => {
    let active = true;
    fetch('/api/editorial-look')
      .then((res) => res.json())
      .then((data) => { if (active) setEditorialConfigured(Boolean(data?.configured)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const seen = window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY) === '1';
    setSwipeHintDismissed(seen);
    if (seen) return;
    const timeout = window.setTimeout(() => void playSwipeHint(), 850);
    return () => window.clearTimeout(timeout);
  }, [playSwipeHint]);

  useEffect(() => {
    if (swipeHintDismissed || swipeHintRunCount >= 2 || boardDragging || generatorLoading || searchFor) return;
    const timeout = window.setTimeout(() => void playSwipeHint(), 6500);
    return () => window.clearTimeout(timeout);
  }, [boardDragging, generatorLoading, playSwipeHint, searchFor, swipeHintDismissed, swipeHintRunCount]);

  useEffect(() => {
    if (!generatorLoading) {
      setLoadingPhraseIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingPhraseIndex((current) => (current + 1) % EDITORIAL_LOADING_LINES.length);
    }, 1150);

    return () => window.clearInterval(interval);
  }, [generatorLoading]);

  useEffect(() => {
    const hydrated = hydrateItemsFromCatalog(items);
    // hydrateItemsFromCatalog returns a fresh `{ ...product, ...catalogProduct }`
    // object for every slot every call, so a referential `!==` check is
    // always true and `replaceItems(hydrated)` would loop forever
    // (re-runs effect → fresh refs → replaceItems → re-runs → …). Compare
    // stable category:id signatures instead so the effect only writes when
    // the underlying outfit actually changed.
    if (itemSignature(items) === itemSignature(hydrated)) return;
    replaceItems(hydrated);
  }, [items, replaceItems]);

  useEffect(() => {
    setLockedSlots((current) => {
      const next = current.filter((category) => Boolean(items[category]));
      return next.length === current.length ? current : next;
    });
  }, [items]);

  useEffect(() => {
    if (!quickSlot || !CATEGORY_ORDER.includes(quickSlot as Category)) return;
    setSearchFor(quickSlot as Category);
  }, [quickSlot]);

  useEffect(() => {
    if (!quickVibe) return;
    if (VIBES.some((vibe) => vibe.id === quickVibe)) {
      setSelectedVibe(quickVibe as VibeId);
    }
  }, [quickVibe]);

  useEffect(() => {
    if (quickSourceProcessedRef.current) return;
    if (quickSource !== 'syli') return;
    if (!hasMounted || n === 0) return;
    setStatusMessage(`Loaded ${n} Syli recommendation${n === 1 ? '' : 's'} into Builder. Lock any piece you love, then remix or save.`);
    quickSourceProcessedRef.current = true;
    router.replace('/build');
  }, [hasMounted, n, quickSource, router]);

  useEffect(() => {
    if (quickSlots) return;
    setSelectedGenerationSlots(defaultGenerationSlotsForVibe(selectedVibe));
  }, [quickSlots, selectedVibe]);

  useEffect(() => {
    if (quickFrame === 'masc' || quickFrame === 'fem' || quickFrame === 'androgynous') {
      setBodyType(quickFrame);
    }
  }, [quickFrame, setBodyType]);

  useEffect(() => {
    if (!quickSlots) return;
    const slots = quickSlots
      .split(',')
      .filter((slot): slot is Category => CATEGORY_ORDER.includes(slot as Category));
    if (slots.length) setSelectedGenerationSlots(CATEGORY_ORDER.filter((slot) => slots.includes(slot)));
  }, [quickSlots]);

  // `?lock=<category>` from feed's "Build around hero" — lock the hero
  // category on first mount once the matching product is actually present.
  // Guarded by a ref so it runs at most once per navigation; without the
  // ref, the effect could re-lock after the user manually unlocks.
  const quickLockProcessedRef = useRef(false);
  useEffect(() => {
    if (!hasMounted) return;
    if (quickLockProcessedRef.current) return;
    if (!quickLock || !CATEGORY_ORDER.includes(quickLock as Category)) return;
    const category = quickLock as Category;
    if (!items[category]) return;
    setLockedSlots((current) => (current.includes(category) ? current : [...current, category]));
    quickLockProcessedRef.current = true;
  }, [quickLock, hasMounted, items]);

  // First-run onboarding hand-off: once the user's picked vibe is applied,
  // auto-generate their very first fit so they land on a finished look — not an
  // empty board. Fires once; the vibe-match guard avoids a default-vibe race.
  const onboardingGenRef = useRef(false);
  useEffect(() => {
    if (onboardingGenRef.current) return;
    if (quickSource !== 'onboarding') return;
    if (!hasMounted || n > 0 || generatorLoading) return;
    if (quickVibe && VIBES.some((vibe) => vibe.id === quickVibe) && selectedVibe !== quickVibe) return;
    onboardingGenRef.current = true;
    void generateLook('full', { sourceLabel: 'Your first fit — styled from your vibe.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickSource, hasMounted, n, generatorLoading, selectedVibe, quickVibe]);

  function closeSearchSheet() {
    setSearchFor(null);
    setActiveEditSlot(null);
    if (quickSlot || quickQuery) router.replace('/');
  }

  async function runCategorySearch(
    category: Category,
    query: string,
    avoidIds: string[] = [],
    draftItems: Partial<Record<Category, Product>> = items,
  ): Promise<Product | null> {
    const catalogFallbackProducts = filterBuildContextProducts(getClientCatalogProducts(80, category), generatorFrame, activePriceMax);
    const catalogCandidate = pickBuildSlotCandidate(
      catalogFallbackProducts,
      category,
      query,
      avoidIds,
      recentBrandCountsRef.current,
      draftItems,
    );
    if (catalogCandidate) return catalogCandidate;

    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        category,
        frame: generatorFrame,
        priceMax: activePriceMax,
        transparentOnly: true,
        exactOnly: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Search failed.');
    }
    const searchProducts = Array.isArray(data.products)
      ? filterBuildContextProducts(sortTransparentFeedRenderableProducts(data.products.filter(Boolean) as Product[]), generatorFrame, activePriceMax)
      : [];
    const products = mergeBuildCandidates(searchProducts, catalogFallbackProducts);
    return pickBuildSlotCandidate(
      products,
      category,
      query,
      avoidIds,
      recentBrandCountsRef.current,
      draftItems,
    );
  }

  async function generateLook(
    mode: 'starter' | 'missing' | 'full' | 'refresh',
    options?: { vibeId?: VibeId; sourceLabel?: string },
  ) {
    if (generatorLoading) return;
    if (generatorBudget === 'custom' && (!customBudgetCents || customBudgetCents <= 0)) {
      setStatusMessage('Enter a custom max price first.');
      return;
    }

    const vibeId = options?.vibeId || selectedVibe;
    const workingVibe = VIBES.find((vibe) => vibe.id === vibeId) || activeVibe;
    const generationSlots =
      vibeId === selectedVibe
        ? selectedGenerationSlots
        : defaultGenerationSlotsForVibe(vibeId);
    const lockedItems = Object.fromEntries(
      CATEGORY_ORDER
        .filter((slot) => lockedSlotSet.has(slot) && items[slot])
        .map((slot) => [slot, items[slot]]),
    ) as Partial<Record<Category, Product>>;

    if (!generationSlots.length) {
      setStatusMessage('Select at least one preview slot before generating.');
      return;
    }

    const targetSlots = (
      mode === 'full' || mode === 'refresh' || mode === 'starter'
        ? generationSlots
        : mode === 'missing'
        ? Array.from(new Set([
            ...MISSING_GENERATOR_PRIORITY.filter((slot) => generationSlots.includes(slot)),
            ...generationSlots,
            ...workingVibe.slots.filter((slot) => generationSlots.includes(slot)),
          ]))
        : generationSlots
    ).filter((slot) => !lockedSlotSet.has(slot) && (mode !== 'missing' || !items[slot]));
    if (!targetSlots.length) {
      setStatusMessage(
        Object.keys(lockedItems).length
          ? 'Unlock at least one selected item to generate a new variation.'
          : 'That vibe already filled all of its starter pieces. Try regenerate or switch vibes.',
      );
      return;
    }

    setGeneratorLoading(true);
    setStatusMessage(null);

    try {
      const nextItems: Partial<Record<Category, Product>> = mode === 'missing' ? { ...items } : { ...lockedItems };
      let addedCount = 0;
      let collectionLabel: string | null = null;
      let assistantLabel: string | null = null;
      const currentProductIds = Object.values(items)
        .filter((product): product is Product => Boolean(product))
        .map((product) => product.id);
      const lockedProductIds = new Set(
        Object.values(lockedItems)
          .filter((product): product is Product => Boolean(product))
          .map((product) => product.id),
      );
      const avoidProductIds = Array.from(new Set([
        ...recentGeneratedIds.filter((id) => !lockedProductIds.has(id)),
        ...(mode === 'starter' || mode === 'refresh' || mode === 'full' ? currentProductIds.filter((id) => !lockedProductIds.has(id)) : []),
      ]));
      const avoidedGeneratedIds = new Set(avoidProductIds);

      const lookBody = {
        vibe: vibeId,
        frame: generatorFrame,
        budget: generatorBudget,
        customMaxCents: customBudgetCents,
        seed: Date.now(),
        avoidProductIds,
        avoidComboSignatures: [
          ...recentRequiredComboRef.current,
          ...recentFullComboRef.current,
        ],
        recentShoeIds: recentShoeIdsRef.current.filter((id) => !lockedProductIds.has(id)),
        recentBrandCounts: recentBrandCountsRef.current,
        recentFormulaIds: recentFormulaIdsRef.current,
        diversityStrength: 'high',
        mode,
        currentItems: items,
        lockedItems,
        targetSlots,
        profile: {
          skinTone,
          bodyType,
          preferredBrands: stylePrefs?.brands,
          preferredVibes: stylePrefs?.vibes,
          budgetTier: stylePrefs?.budget,
        },
      };

      // OPTIMISTIC: drop an instant deterministic fit onto the board first, then
      // let the AI-styled look (Sonnet, ~15s) swap in below — so generation never
      // blocks on a spinner. Applies to EVERY regenerate path (full / refresh /
      // swipe / starter / missing). The base matches the main pass below so locks
      // (and, for `missing`, the existing pieces) are honored.
      try {
        const fastBase: Partial<Record<Category, Product>> = mode === 'missing' ? { ...items } : { ...lockedItems };
        const fastRes = await fetch('/api/look', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...lookBody, fast: true }),
        });
        const fastData = await fastRes.json();
        if (fastRes.ok && fastData?.products && typeof fastData.products === 'object') {
          const fastItems: Partial<Record<Category, Product>> = { ...fastBase };
          for (const [slot, product] of Object.entries(fastData.products) as Array<[Category, Product]>) {
            if (!targetSlots.includes(slot)) continue;
            if (!isBuildReadySlotProduct(product, slot)) continue;
            fastItems[slot] = product;
          }
          if (Object.keys(fastItems).length >= 3) {
            replaceItems(fastItems);
            setGeneratorLoading(false); // board is on screen — hide the full-board spinner
            setAiRefining(true); // show the "refining" badge until the AI look lands
          }
        }
      } catch {
        /* deterministic preview is best-effort — fall through to the blocking AI path */
      }

      const lookResponse = await fetch('/api/look', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lookBody),
      });
      const lookData = await lookResponse.json();

      if (lookResponse.ok && lookData.products && typeof lookData.products === 'object') {
        for (const [slot, product] of Object.entries(lookData.products) as Array<[Category, Product]>) {
          if (!targetSlots.includes(slot)) continue;
          if (avoidedGeneratedIds.has(product.id) && !lockedProductIds.has(product.id)) continue;
          if (!isBuildReadySlotProduct(product, slot)) continue;
          nextItems[slot] = product;
          addedCount += 1;
        }

        if (lookData.collection?.label) {
          collectionLabel = lookData.collection.label as string;
        }
        if (lookData.assistantMode === 'ai-styled' || lookData.assistantMode === 'ai-assisted') {
          assistantLabel = ' styled by Syli';
          setStylingNote(
            (typeof lookData.stylingNotes === 'string' && lookData.stylingNotes.trim())
              || (Array.isArray(lookData.palette) && lookData.palette.length)
              ? {
                  notes: typeof lookData.stylingNotes === 'string' ? lookData.stylingNotes : undefined,
                  palette: Array.isArray(lookData.palette) ? lookData.palette.slice(0, 5).map(String) : undefined,
                }
              : null,
          );
        } else {
          setStylingNote(null);
        }
        if (lookData.formula?.id && typeof lookData.formula.id === 'string') {
          recentFormulaIdsRef.current = Array.from(new Set([lookData.formula.id, ...recentFormulaIdsRef.current])).slice(0, 10);
        }
      }

      const unresolvedSlots = targetSlots.filter((slot) => !nextItems[slot]);
      if (unresolvedSlots.length) {
        const results = await Promise.allSettled(
          unresolvedSlots.map(async (slot) => ({
              slot,
              product: await runCategorySearch(
              slot,
              vibeSearchQuery(vibeId, slot, generatorBudget, generatorFrame, customBudgetCents),
              Array.from(new Set([
                ...recentGeneratedIds,
                ...(mode === 'starter' || mode === 'refresh' || mode === 'full' ? currentProductIds : []),
                ...Object.values(nextItems)
                  .filter((product): product is Product => Boolean(product))
                  .map((product) => product.id),
              ])),
              nextItems,
            ),
          })),
        );

        for (const result of results) {
          if (result.status !== 'fulfilled' || !isBuildReadySlotProduct(result.value.product, result.value.slot)) continue;
          nextItems[result.value.slot] = result.value.product;
          addedCount += 1;
        }
      }

      if (!addedCount) {
        setStatusMessage('No strong starter pieces came back for that vibe. Try another vibe or search a slot manually.');
        return;
      }

      replaceItems(nextItems);
      // Surface which slots actually moved so the slot pills can play a
      // brief glow. Capture diff vs the `items` snapshot we read at the
      // top of generateLook (closure value, not post-replace).
      const changedSlots: Category[] = CATEGORY_ORDER.filter((slot) => {
        const prevId = items[slot]?.id;
        const nextId = nextItems[slot]?.id;
        return nextId && prevId !== nextId;
      });
      if (recentChangedTimeoutRef.current) {
        clearTimeout(recentChangedTimeoutRef.current);
        recentChangedTimeoutRef.current = null;
      }
      setRecentChangedSlots(changedSlots);
      if (changedSlots.length > 0) {
        recentChangedTimeoutRef.current = setTimeout(() => {
          setRecentChangedSlots([]);
          recentChangedTimeoutRef.current = null;
        }, 1400);
      }
      setRecentGeneratedIds((current) => {
        const freshIds = collectOutfitProductIds(nextItems).filter((id) => !lockedProductIds.has(id));
        return Array.from(new Set([...freshIds, ...current])).slice(0, 72);
      });
      const requiredSignature = outfitRequiredSignature(nextItems);
      const fullSignature = outfitFullSignature(nextItems);
      recentRequiredComboRef.current = Array.from(new Set([requiredSignature, ...recentRequiredComboRef.current])).slice(0, 18);
      recentFullComboRef.current = Array.from(new Set([fullSignature, ...recentFullComboRef.current])).slice(0, 18);
      const shoeId = getShoeId(nextItems);
      if (shoeId && !lockedProductIds.has(shoeId)) {
        recentShoeIdsRef.current = Array.from(new Set([shoeId, ...recentShoeIdsRef.current])).slice(0, 12);
      }
      const brandCounts = getOutfitBrandCounts(nextItems);
      const nextBrandCounts = { ...recentBrandCountsRef.current };
      for (const [brand, count] of Object.entries(brandCounts)) {
        nextBrandCounts[brand] = Math.min(12, (nextBrandCounts[brand] || 0) + count);
      }
      recentBrandCountsRef.current = Object.fromEntries(
        Object.entries(nextBrandCounts)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 28),
      );
      const sourceLead = options?.sourceLabel ? `${options.sourceLabel} ` : '';
      setStatusMessage(
        mode === 'starter'
          ? `${sourceLead}Generated ${addedCount} selected starter piece${addedCount !== 1 ? 's' : ''} for ${workingVibe.label.toLowerCase()}${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`
          : mode === 'missing'
          ? `${sourceLead}Filled ${addedCount} missing piece${addedCount !== 1 ? 's' : ''} for ${workingVibe.label.toLowerCase()}${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`
          : mode === 'full'
          ? `${sourceLead}Built a selected ${workingVibe.label.toLowerCase()} fit with ${addedCount} refreshed picks${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`
          : `${sourceLead}Refreshed ${addedCount} pieces for ${workingVibe.label.toLowerCase()}${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not generate a look right now.');
    } finally {
      setGeneratorLoading(false);
      setAiRefining(false);
    }
  }

  async function generateFromSettings(mode: 'starter' | 'missing' | 'full' | 'refresh') {
    setActiveBuildOverlay(null);
    await generateLook(mode);
  }

  function toggleGenerationSlot(category: Category) {
    setSelectedGenerationSlots((current: Category[]) =>
      current.includes(category)
        ? current.filter((slot) => slot !== category)
        : CATEGORY_ORDER.filter((slot) => [...current, category].includes(slot)),
    );
  }

  function toggleLockedSlot(category: Category) {
    if (!items[category]) return;
    setLockedSlots((current) =>
      current.includes(category)
        ? current.filter((slot) => slot !== category)
        : CATEGORY_ORDER.filter((slot) => slot === category || current.includes(slot)),
    );
  }

  function clearFit() {
    clear();
    setLockedSlots([]);
    setActiveEditSlot(null);
  }

  function openBoardSlot(category: Category) {
    if (boardDragging) return;
    dismissSwipeHint();
    setActiveEditSlot(category);
    setActiveBuildOverlay('refine');
    setSearchFor(category);
  }

  async function saveFit() {
    if (!n) return;
    const localFit = saveLocalFit(items);
    recordBuilderPreferenceEvent('save', items, selectedVibe);
    setStatusMessage(
      localFit
        ? `Saved to your fits as "${localFit.title}".`
        : 'Saved to your fits.',
    );
    const ids = Object.fromEntries(
      Object.entries(items).map(([k, v]) => [k, v?.id]).filter(([, id]) => id),
    );
    try {
      const res = await fetch('/api/fit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: ids }),
      });
      const d = await res.json();
      if (!res.ok) {
        setStatusMessage(
          localFit
            ? `Saved "${localFit.title}" to your fits.`
            : 'Could not save that fit just now — please try again.',
        );
        return;
      }
      if (d.id) {
        setStatusMessage(
          localFit
            ? `Saved "${localFit.title}" locally and synced fit ${d.id.slice(0, 8)}.`
            : `Saved fit ${d.id.slice(0, 8)}.`,
        );
      }
    } catch {
      setStatusMessage(
        localFit
          ? `Saved locally as "${localFit.title}". Cloud save is unavailable right now.`
          : 'Could not save this fit right now.',
      );
    }
  }

  async function shopAll() {
    if (!n) return;
    const selectedProducts = Object.values(items).filter((product): product is Product => Boolean(product));
    const links = selectedProducts
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));

    if (!links.length) {
      setStatusMessage('Pick products first, then shop the look.');
      return;
    }

    setStatusMessage(null);
    setCheckoutProducts(links);
  }

  function postCurrentFit() {
    const posted = postFitToFeed(items, {
      title: `${activeVibe.label} fit`,
      vibe: activeVibe.label,
      visibility: postVisibility,
    });
    setStatusMessage(
      posted
        ? `Posted "${posted.title}" to Fit Feed as ${postVisibility}.`
        : 'Build a fit before posting to Fit Feed.',
    );
  }

  function focusRefineCategory(category: Category) {
    setActiveEditSlot(category);
    setActiveBuildOverlay('refine');
  }

  function openFocusedSearch(category: Category) {
    setActiveEditSlot(category);
    setSearchFor(category);
  }

  async function generateNextSwipeFit(direction: 'left' | 'right') {
    if (generatorLoading) return;
    const hasCurrentFit = n > 0;
    if (direction === 'right' && hasCurrentFit) {
      const saved = saveLocalFit(items);
      recordBuilderPreferenceEvent('save', items, selectedVibe);
      setSaveBurst(true);
      window.setTimeout(() => setSaveBurst(false), 850);
      setStatusMessage(saved ? `Saved "${saved.title}". Loading the next ${activeVibe.label.toLowerCase()} look.` : 'Saved this look. Loading the next variation.');
    } else if (direction === 'left') {
      if (hasCurrentFit) recordBuilderPreferenceEvent('pass', items, selectedVibe);
      setStatusMessage(`Passed. Loading another ${activeVibe.label.toLowerCase()} look.`);
    }

    await generateLook(hasCurrentFit ? 'refresh' : 'full', {
      sourceLabel: direction === 'right' ? 'Saved look.' : 'Passed look.',
    });
  }

  function dismissSwipeHint(persist = false) {
    if (persist) {
      window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, '1');
    }
    setSwipeHintDismissed(true);
    setSwipeCoachLabel(null);
  }

  async function performBoardSwipe(direction: 'left' | 'right') {
    if (generatorLoading) return;
    dismissSwipeHint(true);
    setBoardDragging(true);
    setActiveEditSlot(null);
    setDragIntent(null);
    setSwipeFeedback(direction === 'right' ? 'save' : 'pass');
    await boardControls.start({
      x: direction === 'right' ? 520 : -520,
      rotate: direction === 'right' ? 12 : -12,
      opacity: 0,
      scale: 0.97,
      transition: { type: 'spring', stiffness: 240, damping: 24 },
    });
    await generateNextSwipeFit(direction);
    boardControls.set({
      x: direction === 'right' ? -56 : 56,
      rotate: direction === 'right' ? -4 : 4,
      opacity: 0,
      scale: 0.98,
    });
    await boardControls.start({
      x: 0,
      rotate: 0,
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 230, damping: 24 },
    });
    setSwipeFeedback(null);
    setBoardDragging(false);
  }

  async function handleBoardDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (generatorLoading) {
      await boardControls.start({ x: 0, rotate: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 26 } });
      setDragIntent(null);
      setBoardDragging(false);
      return;
    }

    const saveSwipe = info.offset.x > 105 || info.velocity.x > 650;
    const passSwipe = info.offset.x < -105 || info.velocity.x < -650;

    if (saveSwipe) {
      await performBoardSwipe('right');
      return;
    }

    if (passSwipe) {
      await performBoardSwipe('left');
      return;
    }

    await boardControls.start({ x: 0, rotate: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 26 } });
    setDragIntent(null);
    window.setTimeout(() => setBoardDragging(false), 80);
  }

  function handleBoardDoubleTap() {
    if (boardDragging || n === 0) return;
    dismissSwipeHint(true);
    const saved = saveLocalFit(items);
    recordBuilderPreferenceEvent('save', items, selectedVibe);
    setSaveBurst(true);
    window.setTimeout(() => setSaveBurst(false), 850);
    setStatusMessage(saved ? `Saved "${saved.title}".` : 'Saved this fit.');
  }

  const activeSwipeCue = swipeFeedback || dragIntent || swipeCoachLabel;
  const nextBuildAction = computeNextBestAction(renderItems, lockedSlots, renderN);
  const builderProducts = Object.values(renderItems).filter((product): product is Product => Boolean(product));

  const makeEditorial = async () => {
    if (editorialLoading || builderProducts.length < 2) return;
    setEditorialError(null);
    setEditorialImage(null);
    setEditorialLoading(true);
    try {
      const res = await fetch('/api/editorial-look', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          products: builderProducts,
          vibe: activeVibe.label,
          frame: generatorFrame,
          stylingNotes: stylingNote?.notes,
          palette: stylingNote?.palette,
        }),
      });
      const data = await res.json();
      if (data?.ok && data.image) setEditorialImage(data.image as string);
      else setEditorialError(data?.reason === 'rate-limited' ? 'Too many requests — try again in a minute.' : 'Could not create the editorial photo. Try again.');
    } catch {
      setEditorialError('Could not create the editorial photo. Try again.');
    } finally {
      setEditorialLoading(false);
    }
  };
  const builderTransparentCount = builderProducts.filter(hasTransparentProductImage).length;
  const builderLinkedCount = builderProducts.filter((product) => Boolean(getProductOutboundUrl(product))).length;
  const builderExactLinkedCount = builderProducts.filter(hasExactProductLink).length;

  return (
    <main
      className="relative mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg"
      data-build-route="true"
      data-build-product-count={builderProducts.length}
      data-build-transparent-count={builderTransparentCount}
      data-build-linked-count={builderLinkedCount}
      data-build-exact-linked-count={builderExactLinkedCount}
    >
      <header className="relative flex items-center justify-between px-4 pb-2.5 pt-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="relative z-10 grid h-9 w-9 place-items-center rounded-full border border-hairline bg-surface-2 text-ink transition hover:border-accent"
          aria-label="Back"
        >
          <ArrowUpRight size={15} className="rotate-[225deg]" />
        </button>
        <div className="pointer-events-none absolute left-1/2 top-10 z-0 w-[160px] -translate-x-1/2 text-center min-[380px]:w-[190px]">
          <div className="truncate font-serif text-[17px] font-semibold leading-none text-ink min-[380px]:text-[18px]">
            Sylistly <em className="italic text-accent">Builder</em>
          </div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.16em] text-muted">
            Build. Refine. Wear.
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveBuildOverlay('settings')}
            className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-surface-2 text-ink transition hover:border-accent"
            aria-label="Generation settings"
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            onClick={saveFit}
            disabled={renderN === 0}
            className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold min-[380px]:flex min-[380px]:w-auto min-[380px]:gap-1.5 min-[380px]:px-3.5 min-[380px]:py-2 ${
              renderN > 0 ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-hairline-2 text-muted-2'
            }`}
          >
            <Bookmark size={12} /> <span className="hidden min-[380px]:inline">Save</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pb-56 pt-2">
          <section className="flex flex-col gap-3">
            <div className="relative">
              {saveBurst ? (
                <div className="pointer-events-none absolute -inset-4 z-0 rounded-[38px] bg-accent/25 blur-2xl" />
              ) : null}
              <div
                className={`pointer-events-none absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] transition ${
                  activeSwipeCue === 'pass'
                    ? 'border-white/25 bg-black/78 text-white shadow-[0_12px_30px_rgba(0,0,0,.32)]'
                    : 'border-white/10 bg-black/28 text-white/42 opacity-0'
                }`}
              >
                Pass
              </div>
              <div
                className={`pointer-events-none absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] transition ${
                  activeSwipeCue === 'save'
                    ? 'border-accent bg-accent text-white shadow-pink-glow'
                    : 'border-accent/20 bg-accent/10 text-white/48 opacity-0'
                }`}
              >
                Save
              </div>
              <motion.div
                animate={boardControls}
                className="relative z-10 touch-pan-y"
                drag="x"
                dragConstraints={{ left: -220, right: 220 }}
                dragElastic={0.12}
                dragTransition={{ bounceStiffness: 260, bounceDamping: 22 }}
                onDragStart={() => {
                  dismissSwipeHint();
                  setBoardDragging(true);
                  setActiveEditSlot(null);
                }}
                onDrag={(_, info) => {
                  setDragIntent(info.offset.x > 22 ? 'save' : info.offset.x < -22 ? 'pass' : null);
                }}
                onDragEnd={(event, info) => void handleBoardDragEnd(event, info)}
                onDoubleClick={handleBoardDoubleTap}
                whileDrag={{ rotate: 2, scale: 0.985 }}
              >
                {swipeFeedback ? (
                  <div
                    className={`pointer-events-none absolute left-5 top-5 z-30 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[.18em] shadow-[0_14px_34px_rgba(0,0,0,.28)] ${
                      swipeFeedback === 'save'
                        ? 'rotate-[-8deg] border-accent bg-accent text-white shadow-pink-glow'
                        : 'rotate-[8deg] border-white/18 bg-black/72 text-white'
                    }`}
                  >
                    {swipeFeedback === 'save' ? 'Saved' : 'Pass'}
                  </div>
                ) : null}
                {saveBurst ? (
                  <div className="pointer-events-none absolute right-5 top-5 z-30 grid h-11 w-11 animate-pulse place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                    <Bookmark size={17} fill="currentColor" />
                  </div>
                ) : null}
                {generatorLoading ? (
                  <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 rounded-[34px] bg-[#0a0707]/74 backdrop-blur-md">
                    <div className="relative grid h-24 w-24 place-items-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent/35" />
                      <span className="absolute inset-3 rounded-full bg-accent/20" />
                      <LoaderCircle size={44} className="relative animate-spin text-white drop-shadow-[0_0_22px_rgba(246,48,107,.9)]" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-[.24em] text-accent">Styling your fit</div>
                      <div className="mt-1 max-w-[80%] font-serif text-[18px] font-semibold leading-tight text-white">
                        {EDITORIAL_LOADING_LINES[loadingPhraseIndex]}
                      </div>
                    </div>
                  </div>
                ) : null}
                {aiRefining && !generatorLoading ? (
                  <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2">
                    <div className="sy-enter flex items-center gap-1.5 rounded-full border border-accent/40 bg-[#0a0707]/82 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow backdrop-blur-md">
                      <Sparkles size={12} className="animate-pulse text-accent" />
                      Syli is styling your fit&hellip;
                    </div>
                  </div>
                ) : null}
                {stylingNote && !aiRefining && !generatorLoading ? (
                  <div className="pointer-events-none absolute left-4 top-4 z-30">
                    <div className="sy-enter flex items-center gap-1.5 rounded-full border border-accent/35 bg-[#0a0707]/78 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-white shadow-[0_8px_20px_rgba(0,0,0,.32)] backdrop-blur-md">
                      <Sparkles size={11} className="text-accent" />
                      Styled by Syli
                    </div>
                  </div>
                ) : null}
                <Mannequin
                  items={renderItems}
                  skinTone={skinTone}
                  bodyType={generatorFrame}
                  vibeLabel={activeVibe.label}
                  vibeBlurb={activeVibe.blurb}
                  selectedGenerationSlots={selectedGenerationSlots}
                  lockedSlots={lockedSlots}
                  onToggleSlotLock={toggleLockedSlot}
                  onOpenSlot={openBoardSlot}
                  slotInteractionDisabled={boardDragging || generatorLoading}
                  activeEditSlot={activeEditSlot}
                />
              </motion.div>
            </div>
            <div className="border-t border-hairline px-1 pt-4">
              <div className="mb-3 flex items-center justify-center rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[.13em] text-white shadow-[0_10px_28px_rgba(246,48,107,.18)]">
                Drag the fit sideways · left passes · right saves
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-left">
                  <div className="text-[10px] font-black uppercase tracking-[.18em] text-accent">Generate</div>
                  <div className="mt-1 truncate text-[12px] font-semibold text-ink">
                    {activeVibe.label} · {selectedGenerationSlots.length} slots · {renderN ? totalDisplay : 'ready'}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted">
                    Tap any slot to swap it, or swipe the card back and forth for the next look. Settings controls the categories.
                    {lockedSlots.length ? ` ${lockedSlots.length} locked.` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveBuildOverlay('settings')}
                  className="inline-flex flex-none items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] text-muted-2 transition hover:border-accent/60 hover:text-ink"
                >
                  <SlidersHorizontal size={12} />
                  Settings
                </button>
              </div>
              <div className="mt-3 grid grid-cols-[.9fr_1.3fr_.9fr] gap-2">
                <button
                  type="button"
                  onClick={() => void performBoardSwipe('left')}
                  disabled={generatorLoading}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2 transition hover:border-white/25 hover:text-ink disabled:opacity-50"
                >
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => void generateLook('full', { sourceLabel: 'Selected slots.' })}
                  disabled={generatorLoading || selectedGenerationSlots.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#f6306b_0%,#ff7099_60%,#f6306b_100%)] bg-[length:200%_100%] bg-left px-3 py-2.5 text-[10px] font-black uppercase tracking-[.14em] text-white shadow-[0_12px_30px_rgba(246,48,107,.42)] transition hover:bg-right active:scale-[0.97] motion-safe:transition-all motion-safe:duration-300 disabled:opacity-60 disabled:active:scale-100"
                >
                  {generatorLoading ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Build
                </button>
                <button
                  type="button"
                  onClick={() => void performBoardSwipe('right')}
                  disabled={generatorLoading || renderN === 0}
                  className="rounded-full border border-accent/50 bg-accent/14 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white shadow-[0_0_18px_rgba(232,54,93,.2)] transition hover:bg-accent hover:shadow-pink-glow disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </section>


          <section className="rounded-[28px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035))] p-3 shadow-[0_18px_42px_rgba(40,20,24,.16)]">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveBuildOverlay('refine')}
                className="rounded-full border border-hairline bg-surface-2 px-3 py-3 text-[10px] font-black uppercase tracking-[.14em] text-muted-2 transition hover:border-accent/50 hover:text-ink active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
              >
                Refine
              </button>
              <button
                type="button"
                onClick={() => setActiveBuildOverlay('details')}
                className="rounded-full border border-hairline bg-surface-2 px-3 py-3 text-[10px] font-black uppercase tracking-[.14em] text-muted-2 transition hover:border-accent/50 hover:text-ink active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
              >
                Details
              </button>
              <button
                type="button"
                onClick={shopAll}
                disabled={renderN === 0}
                className="rounded-full bg-accent px-3 py-3 text-[10px] font-black uppercase tracking-[.14em] text-white shadow-pink-glow transition hover:bg-accent-hot active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150 disabled:bg-white/[0.04] disabled:text-muted disabled:shadow-none disabled:active:scale-100"
              >
                Shop
              </button>
            </div>
          </section>

          {stylingNote && (stylingNote.notes || stylingNote.palette?.length) ? (
            <div className="sy-enter overflow-hidden rounded-card border border-accent/25 bg-[radial-gradient(120%_80%_at_12%_-10%,rgba(255,59,99,.16),transparent_46%),linear-gradient(180deg,rgba(251,247,242,.06),rgba(251,247,242,.02))] p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
                  <Sparkles size={13} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[.16em] text-accent">Syli&rsquo;s take</span>
                <span className="ml-auto rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.16em] text-accent">AI-styled</span>
              </div>
              {stylingNote.notes ? (
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">{stylingNote.notes}</p>
              ) : null}
              {stylingNote.palette?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stylingNote.palette.map((color) => (
                    <span key={color} className="sy-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.1em]">
                      {color}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {editorialConfigured && builderProducts.length >= 2 ? (
            <button
              type="button"
              onClick={makeEditorial}
              disabled={editorialLoading}
              className="sy-press inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/35 bg-accent-soft px-4 py-3 text-[12px] font-bold uppercase tracking-[.12em] text-accent transition hover:border-accent/60 disabled:opacity-60"
            >
              <Sparkles size={14} />
              {editorialLoading ? 'Creating editorial photo…' : 'Make it editorial'}
            </button>
          ) : null}

          {editorialError ? (
            <div className="rounded-[20px] border border-hairline bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-muted-2">{editorialError}</div>
          ) : null}

          {statusMessage ? (
            <div className="rounded-[20px] border border-hairline bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-muted-2">
              {statusMessage}
            </div>
          ) : null}
        </div>
      </div>

      {activeBuildOverlay ? (
        <BuildOverlay
          activeTab={activeBuildOverlay}
          onChangeTab={setActiveBuildOverlay}
          onClose={() => setActiveBuildOverlay(null)}
        >
          {activeBuildOverlay === 'settings' ? (
            <div className="flex flex-col gap-3">
              <section className="rounded-[30px] border-2 border-accent/35 bg-[radial-gradient(circle_at_18%_12%,rgba(246,48,107,.18),transparent_44%),linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.025))] p-4 shadow-[0_24px_56px_rgba(246,48,107,.18)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.22em] text-accent">Generation</div>
                    <div className="mt-1 font-serif text-[22px] font-semibold leading-tight text-ink">
                      {activeVibe.label} <em className="italic text-accent">build logic</em>
                    </div>
                    <div className="mt-1 text-[12px] leading-relaxed text-muted-2">
                      Choose what the next fit is allowed to change. Locked pieces stay put.
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-right">
                    <div className="text-[9px] uppercase tracking-[.16em] text-muted">Filled</div>
                    <div className="mt-0.5 text-[13px] font-semibold text-ink">{renderN}/8</div>
                  </div>
                </div>

                {nextBuildAction ? (
                  <div className="mt-4 flex items-start gap-2.5 rounded-[18px] border border-accent/35 bg-accent/10 px-3 py-2.5">
                    <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-accent text-white">
                      <Sparkles size={11} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Next best</div>
                      <div className="mt-0.5 text-[12px] font-semibold leading-snug text-white/92">{nextBuildAction.label}</div>
                      <div className="mt-0.5 text-[11px] leading-relaxed text-white/72">{nextBuildAction.hint}</div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void generateFromSettings('starter')}
                    disabled={generatorLoading}
                    className="group flex items-center gap-2.5 rounded-[18px] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] p-2.5 text-left transition hover:border-accent/55 disabled:opacity-60"
                  >
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent/18 text-accent transition group-hover:bg-accent group-hover:text-white">
                      {generatorLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </span>
                    <span className="min-w-0 leading-none">
                      <span className="block text-[11px] font-bold text-ink">Quick Fit</span>
                      <span className="mt-0.5 block text-[9px] uppercase tracking-[.14em] text-muted">Starter</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateFromSettings('missing')}
                    disabled={generatorLoading}
                    className="group flex items-center gap-2.5 rounded-[18px] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] p-2.5 text-left transition hover:border-accent/55 disabled:opacity-60"
                  >
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent/18 text-accent transition group-hover:bg-accent group-hover:text-white">
                      {generatorLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
                    </span>
                    <span className="min-w-0 leading-none">
                      <span className="block text-[11px] font-bold text-ink">Fill Missing</span>
                      <span className="mt-0.5 block text-[9px] uppercase tracking-[.14em] text-muted">Empty slots</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateFromSettings('refresh')}
                    disabled={generatorLoading || renderN === 0}
                    className="group flex items-center gap-2.5 rounded-[18px] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] p-2.5 text-left transition hover:border-accent/55 disabled:opacity-60"
                  >
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent/18 text-accent transition group-hover:bg-accent group-hover:text-white">
                      {generatorLoading ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    </span>
                    <span className="min-w-0 leading-none">
                      <span className="block text-[11px] font-bold text-ink">Remix</span>
                      <span className="mt-0.5 block text-[9px] uppercase tracking-[.14em] text-muted">Unlocked</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateFromSettings('full')}
                    disabled={generatorLoading}
                    className="group flex items-center gap-2.5 rounded-[18px] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] p-2.5 text-left transition hover:border-accent/55 disabled:opacity-60"
                  >
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent/18 text-accent transition group-hover:bg-accent group-hover:text-white">
                      {generatorLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Layers size={14} />}
                    </span>
                    <span className="min-w-0 leading-none">
                      <span className="block text-[11px] font-bold text-ink">Fuller Fit</span>
                      <span className="mt-0.5 block text-[9px] uppercase tracking-[.14em] text-muted">More pieces</span>
                    </span>
                  </button>
                </div>
              </section>

              <section className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.18em] text-muted">Vibe</div>
                    <div className="mt-1 text-[12px] text-muted-2">{activeVibe.blurb}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGenerationSlots(defaultGenerationSlotsForVibe(selectedVibe))}
                    className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-accent"
                  >
                    Defaults
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {VIBES.map((vibe) => (
                    <button
                      key={vibe.id}
                      type="button"
                      onClick={() => setSelectedVibe(vibe.id)}
                      className={`rounded-full px-3.5 py-2 text-[11px] font-semibold transition active:scale-95 ${
                        selectedVibe === vibe.id
                          ? 'bg-accent text-white shadow-pink-glow'
                          : 'border border-hairline bg-surface-2 text-muted-2 hover:text-ink'
                      }`}
                    >
                      {vibe.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="text-[10px] font-black uppercase tracking-[.18em] text-muted">Budget</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { value: 'any', label: 'Any' },
                      { value: 'under100', label: '< $100' },
                      { value: 'under250', label: '< $250' },
                      { value: 'under500', label: '< $500' },
                      { value: 'custom', label: 'Custom' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setGeneratorBudget(option.value as GeneratorBudget)}
                        className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition active:scale-95 ${
                          generatorBudget === option.value
                            ? 'bg-white text-black'
                            : 'border border-hairline bg-surface-2 text-muted'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {generatorBudget === 'custom' ? (
                  <label className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-ink">
                    <span className="font-bold uppercase tracking-[.14em] text-muted">Custom max</span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted">$</span>
                      <input
                        value={customBudgetInput}
                        onChange={(event) => {
                          setGeneratorBudget('custom');
                          setCustomBudgetInput(event.target.value.replace(/[^\d]/g, '').slice(0, 4));
                        }}
                        inputMode="numeric"
                        placeholder="180"
                        className="w-16 bg-transparent text-right outline-none"
                      />
                    </span>
                  </label>
                ) : null}
              </section>

              <section className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="text-[10px] font-black uppercase tracking-[.18em] text-muted">Style frame</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { value: 'masc', label: 'Male' },
                      { value: 'fem', label: 'Female' },
                      { value: 'androgynous', label: 'Neutral' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setBodyType(option.value as GeneratorFrame)}
                        className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition active:scale-95 ${
                          generatorFrame === option.value
                            ? 'bg-white text-black'
                            : 'border border-hairline bg-surface-2 text-muted'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.18em] text-muted">Generated slots</div>
                    <div className="mt-1 text-[12px] text-muted-2">
                      {selectedGenerationSlots.length} selected. Locked slots are protected.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGenerationSlots(CATEGORY_ORDER)}
                    className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-muted-2"
                  >
                    All
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {CATEGORY_ORDER.map((category) => {
                    const selected = selectedGenerationSlots.includes(category);
                    const locked = lockedSlots.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleGenerationSlot(category)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.1em] transition ${
                          selected
                            ? 'border-accent bg-accent/15 text-white shadow-[0_0_16px_rgba(232,54,93,.24)]'
                            : 'border-white/10 bg-white/[0.03] text-muted-2 hover:border-accent/60 hover:text-ink'
                        }`}
                      >
                        {locked ? <Lock size={9} /> : null}
                        {CATEGORY_LABELS[category]}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : activeBuildOverlay === 'refine' ? (
            <div className="flex flex-col gap-3">
              <FocusedRefinePanel
                items={renderItems}
                activeCategory={refineFocusCategory}
                lockedSlots={lockedSlots}
                recentChangedSlots={recentChangedSlots}
                onFocusCategory={focusRefineCategory}
                onToggleLock={toggleLockedSlot}
                onOpenSearch={openFocusedSearch}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <FitDiagnosticsPanel
                analysis={analysis}
                bagLayer={bagLayer}
                onOpenSearch={setSearchFor}
                onToggleBagLayer={() => setBagLayer((value) => (value === 'front' ? 'behind' : 'front'))}
                lockedSlots={lockedSlots}
                itemCount={renderN}
                vibeLabel={activeVibe.label}
              />
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))] p-4 shadow-[0_18px_42px_rgba(0,0,0,.18)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[.18em] text-muted">Shopping summary</div>
                    <div className="mt-1 font-serif text-[21px] font-semibold text-ink">{totalDisplay}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-muted-2">
                      {renderN > 0 ? `${renderN} image-backed piece${renderN !== 1 ? 's' : ''} ready to shop.` : 'Build a fit first, then shop the full look.'}
                    </div>
                  </div>
                  <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-accent">
                    {renderN}/8
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button
                    onClick={shopAll}
                    disabled={renderN === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-accent py-3.5 text-sm font-semibold text-white shadow-pink-glow transition hover:bg-accent-hot disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:shadow-none"
                  >
                    Shop full look {renderN > 0 && <span className="opacity-75 font-medium">- {renderN}</span>}
                    <ExternalLink size={14} />
                  </button>
                  <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2">
                    {(['public', 'private'] as const).map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => setPostVisibility(visibility)}
                        className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] transition ${
                          postVisibility === visibility
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-white/10 bg-white/[0.04] text-muted-2'
                        }`}
                      >
                        {visibility}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={postCurrentFit}
                      disabled={renderN === 0}
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink disabled:opacity-40"
                    >
                      <Send size={12} />
                      Post
                    </button>
                  </div>
                  <button onClick={clearFit} className="w-full rounded-xl py-2 text-xs text-muted transition hover:text-ink">
                    Clear fit
                  </button>
                </div>
              </div>
            </div>
          )}
        </BuildOverlay>
      ) : null}

      <BottomNav />

      <SearchSheet
        open={!!searchFor}
        category={searchFor}
        initialQuery={searchFor ? quickQuery : null}
        frame={generatorFrame}
        priceMax={activePriceMax}
        onClose={closeSearchSheet}
      />

      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title="Your fit"
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />

      {editorialImage ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
          onClick={() => setEditorialImage(null)}
          role="dialog"
          aria-label="Editorial look"
        >
          <div className="sy-sheet-enter relative w-full max-w-[440px]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Editorial · {activeVibe.label}</span>
              <button type="button" onClick={() => setEditorialImage(null)} className="sy-press rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-muted-2">
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={editorialImage} alt="AI editorial photo of the outfit" className="w-full rounded-card-lg border border-white/10 shadow-float" />
            <a
              href={editorialImage}
              download="sylistly-editorial.png"
              className="sy-cta-secondary mt-3 w-full px-4 py-3 text-[12px] font-bold uppercase tracking-[.12em]"
            >
              Save photo
            </a>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FocusedRefinePanel({
  items,
  activeCategory,
  lockedSlots,
  recentChangedSlots = [],
  onFocusCategory,
  onToggleLock,
  onOpenSearch,
}: {
  items: Partial<Record<Category, Product>>;
  activeCategory: Category;
  lockedSlots: Category[];
  recentChangedSlots?: Category[];
  onFocusCategory: (category: Category) => void;
  onToggleLock: (category: Category) => void;
  onOpenSearch: (category: Category) => void;
}) {
  const activeProduct = items[activeCategory];
  const activeLocked = Boolean(activeProduct && lockedSlots.includes(activeCategory));
  const activeIndex = CATEGORY_ORDER.indexOf(activeCategory);
  const previousCategory = CATEGORY_ORDER[(activeIndex - 1 + CATEGORY_ORDER.length) % CATEGORY_ORDER.length];
  const nextCategory = CATEGORY_ORDER[(activeIndex + 1) % CATEGORY_ORDER.length];
  const shopUrl = activeProduct ? getProductOutboundUrl(activeProduct) : '';

  function openShop() {
    if (!shopUrl || shopUrl === '#') return;
    window.open(shopUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="rounded-[30px] border border-hairline bg-surface-1 p-4 shadow-[0_18px_42px_rgba(0,0,0,.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[.18em] text-muted">Focused refine</div>
          <div className="mt-1 font-serif text-[22px] font-semibold leading-tight text-ink">
            Editing <em className="italic text-accent">{CATEGORY_LABELS[activeCategory]}</em>
          </div>
        </div>
        <div className="rounded-full border border-accent/35 bg-accent/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-accent">
          {Object.values(items).filter(Boolean).length}/8
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex min-w-full w-max justify-center gap-2 pr-2">
          {CATEGORY_ORDER.map((category) => {
            const product = items[category];
            const active = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onFocusCategory(category)}
                className={`relative w-[68px] flex-none rounded-[16px] border-2 p-1.5 text-left transition active:scale-95 motion-safe:transition-all motion-safe:duration-200 ${
                  lockedSlots.includes(category)
                    ? 'border-accent bg-accent/18 ring-2 ring-accent/45 shadow-[0_0_28px_rgba(232,54,93,.55)] scale-[1.04]'
                    : active
                    ? 'border-accent bg-accent/12 shadow-[0_0_18px_rgba(232,54,93,.26)]'
                    : 'border-white/8 bg-white/[0.035] hover:border-accent/45'
                } ${recentChangedSlots.includes(category) ? 'motion-safe:animate-[pulse_.7s_ease-out_1] ring-2 ring-accent/70 shadow-[0_0_26px_rgba(232,54,93,.65)]' : ''}`}
              >
                {lockedSlots.includes(category) ? (
                  <span className="absolute -right-1.5 -top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_rgba(232,54,93,.65)] ring-2 ring-[#0e0c0b]">
                    <Lock size={11} strokeWidth={3} />
                  </span>
                ) : null}
                <div className={`grid aspect-square place-items-center overflow-hidden rounded-[12px] ${
                  product ? 'bg-[linear-gradient(180deg,#fbfaf8_0%,#f2ebe5_100%)]' : 'bg-white/[0.05]'
                }`}>
                  {product ? (
                    <PanelPreviewImage
                      product={product}
                      wrapperClassName="h-full w-full"
                      modeClassName="h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-0.5 px-1">
                      <span className="text-base font-bold text-accent/70">+</span>
                      <span className="text-[8px] font-bold uppercase tracking-[.08em] text-muted">Add</span>
                    </div>
                  )}
                </div>
                <div className={`mt-1 truncate text-[8px] font-bold uppercase tracking-[.1em] ${
                  active ? 'text-accent' : product ? 'text-white/65' : 'text-muted'
                }`}>
                  {CATEGORY_LABELS[category]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[#171412]">
        <div className="relative m-2.5 grid h-[190px] place-items-center overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#fffaf0_0%,#f0e4d6_100%)] ring-1 ring-[#efe4da]">
          <div className="absolute left-3 top-3 z-10 rounded-full bg-[#181513]/78 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white">
            {CATEGORY_LABELS[activeCategory]}
          </div>
          {activeProduct ? (
            <PanelPreviewImage
              product={activeProduct}
              wrapperClassName="relative h-full w-full"
              modeClassName="h-full w-full object-contain p-5 drop-shadow-[0_18px_24px_rgba(0,0,0,.18)]"
            />
          ) : (
            <div className="px-6 text-center">
              <div className="font-serif text-[20px] font-semibold text-[#201915]">No {CATEGORY_LABELS[activeCategory].toLowerCase()} yet</div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#8b7c72]">Browse image-backed pieces for this slot.</div>
            </div>
          )}
          {activeProduct ? (
            <button
              type="button"
              onClick={() => onToggleLock(activeCategory)}
              className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] transition active:scale-90 motion-safe:transition-all motion-safe:duration-200 ${
                activeLocked
                  ? 'scale-[1.06] border-accent bg-accent text-white shadow-[0_10px_28px_rgba(232,54,93,.55)] ring-2 ring-white/30'
                  : 'border-[#d8c7b8] bg-white/90 text-[#6c5c52] hover:border-accent hover:text-accent'
              }`}
            >
              <Lock size={11} strokeWidth={2.7} />
              {activeLocked ? 'Locked' : 'Lock'}
            </button>
          ) : null}
        </div>

        <div className="px-4 pb-4 pt-1">
          {activeProduct ? (
            <>
              <div className="truncate text-[10px] font-bold uppercase tracking-[.18em] text-[#a9998f]">{activeProduct.brand}</div>
              <div className="mt-1 line-clamp-2 font-serif text-[21px] font-semibold leading-tight text-ink">{activeProduct.name}</div>
              <div className="mt-1 text-[12px] text-muted">
                {activeProduct.priceCents ? `$${(activeProduct.priceCents / 100).toLocaleString()}` : 'Price pending'}
              </div>
            </>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onFocusCategory(previousCategory)}
              className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2 transition hover:border-accent/50 hover:text-ink"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onFocusCategory(nextCategory)}
              className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2 transition hover:border-accent/50 hover:text-ink"
            >
              Next
            </button>
          </div>
          <div className="mt-2 grid grid-cols-[1.2fr_1fr] gap-2">
            <button
              type="button"
              onClick={() => onOpenSearch(activeCategory)}
              className="rounded-full bg-accent px-3 py-3 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow transition hover:bg-accent-hot"
            >
              {activeProduct ? 'Swap' : 'Browse'}
            </button>
            <button
              type="button"
              onClick={openShop}
              disabled={!activeProduct || !shopUrl || shopUrl === '#'}
              className="inline-flex items-center justify-center gap-1 rounded-full bg-white/[0.06] px-3 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2 transition hover:bg-white/[0.1] disabled:opacity-35"
            >
              Shop
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuildOverlay({
  activeTab,
  children,
  onChangeTab,
  onClose,
}: {
  activeTab: Exclude<BuildSectionTab, 'build'>;
  children: ReactNode;
  onChangeTab: (tab: Exclude<BuildSectionTab, 'build'>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] mx-auto flex h-[100dvh] max-w-[480px] items-end bg-black/46 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close build panel"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <motion.section
        initial={{ y: 38, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 38, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative z-10 flex max-h-[calc(100dvh-56px)] min-h-0 w-full flex-col overflow-hidden rounded-t-[34px] border border-white/12 bg-[#0f0d0c] pb-[env(safe-area-inset-bottom)] shadow-[0_-22px_60px_rgba(0,0,0,.46)]"
      >
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025))] px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/18" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[.18em] text-muted">Build panel</div>
              <div className="mt-1 font-serif text-[21px] font-semibold text-ink">
                {BUILD_SECTION_LABELS[activeTab]}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2 transition hover:border-accent hover:text-ink"
              aria-label="Close"
            >
              x
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {BUILD_OVERLAY_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onChangeTab(tab)}
                className={`rounded-full px-3 py-2.5 text-[10px] font-black uppercase tracking-[.14em] transition ${
                  activeTab === tab
                    ? 'bg-accent text-white shadow-pink-glow'
                    : 'border border-white/10 bg-white/[0.04] text-muted-2 hover:border-accent/50 hover:text-ink'
                }`}
              >
                {BUILD_SECTION_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pb-6 pt-4">
          {children}
        </div>
      </motion.section>
    </div>
  );
}

function FitDiagnosticsPanel({
  analysis,
  bagLayer,
  onOpenSearch,
  onToggleBagLayer,
  lockedSlots,
  itemCount,
  vibeLabel,
}: {
  analysis: OutfitAnalysis;
  bagLayer: 'front' | 'behind';
  onOpenSearch: (category: Category) => void;
  onToggleBagLayer: () => void;
  lockedSlots: Category[];
  itemCount: number;
  vibeLabel: string;
}) {
  if (itemCount === 0) {
    return (
      <section className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/12 text-accent">
          <Sparkles size={20} />
        </div>
        <div className="mt-3 font-serif text-[20px] font-semibold text-[#fff6f0]">Fit insight</div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#a8968b]">
          Generate a look first to see styling notes — pick a vibe, tap <em className="not-italic text-accent">Generate starter look</em>, then come back here for a breakdown.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-white/8 bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-serif text-[18px] font-semibold text-[#fff6f0]">Fit insight</div>
          <div className="mt-1 text-[11px] leading-relaxed text-[#a8968b]">
            {vibeLabel} · {itemCount} piece{itemCount === 1 ? '' : 's'} · real-time feedback.
          </div>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-accent bg-accent/10 text-center shadow-pink-glow">
          <div>
            <div className="font-serif text-[18px] font-semibold leading-none text-white">{analysis.score}</div>
            <div className="text-[7px] uppercase tracking-[.08em] text-accent">Fit</div>
          </div>
        </div>
      </div>

      {lockedSlots.length > 0 ? (
        <div className="mt-3 rounded-[18px] border border-accent/40 bg-accent/8 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-accent">
            <Lock size={11} strokeWidth={2.8} />
            {lockedSlots.length} locked piece{lockedSlots.length === 1 ? '' : 's'}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-[#e8d9cf]">
            {lockedSlots.join(', ')} will stay put — tap <em className="not-italic text-accent">Generate</em> to swap everything else around them.
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricChip label="Color harmony" value={analysis.colorHarmony} detail={analysis.harmonyLabel} />
        <MetricChip label="Silhouette" value={analysis.silhouette} detail={analysis.silhouetteLabel} />
        <MetricChip label="Occasion match" value={analysis.layering} detail={analysis.styleDna[0] || 'Styled'} />
        <MetricChip label="Budget fit" value={analysis.proportions} detail="On target" />
      </div>

      <div className="mt-3 rounded-[18px] border border-white/8 bg-[#141210] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <HeatChip label="Upper" value={analysis.crowding.upper} />
            <HeatChip label="Mid" value={analysis.crowding.mid} />
            <HeatChip label="Lower" value={analysis.crowding.lower} />
          </div>
          <button
            type="button"
            onClick={onToggleBagLayer}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] uppercase tracking-[.16em] text-[#d7c6bc] transition hover:border-accent"
          >
            Bag {bagLayer === 'front' ? 'front' : 'behind'}
          </button>
        </div>
        <div className="mt-3 text-[11px] leading-relaxed text-[#c7b8ae]">{analysis.upgradeNote}</div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {analysis.missing.length ? (
          analysis.missing.slice(0, 2).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onOpenSearch(category)}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#f5e8df] transition hover:border-accent"
            >
              Add {category}
            </button>
          ))
        ) : (
          <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#d8c9c0]">
            Fully styled
          </span>
        )}
      </div>
    </section>
  );
}

function MetricChip({ label, value, detail }: { label: string; value: number; detail: string }) {
  const isStrong = value >= 74;
  return (
    <div className="rounded-[16px] border border-white/8 bg-[#141210] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[9px] uppercase tracking-[.14em] text-[#a8968b]">{label}</div>
        <div className={isStrong ? 'text-[9px] font-semibold text-emerald-300' : 'text-[9px] font-semibold text-accent'}>
          {isStrong ? 'Great' : 'Refine'}
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#e8365d_0%,#ffc9d4_100%)]" style={{ width: `${Math.max(8, Math.min(100, value))}%` }} />
      </div>
      <div className="mt-1 truncate text-[10px] text-[#c7b8ae]">{detail}</div>
    </div>
  );
}

function HeatChip({
  label,
  value,
}: {
  label: string;
  value: 'calm' | 'balanced' | 'crowded';
}) {
  const styles =
    value === 'crowded'
      ? 'border-rose-400/35 bg-rose-500/12 text-rose-100'
      : value === 'balanced'
      ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
      : 'border-white/10 bg-white/[0.05] text-[#eee2da]';

  return (
    <div className={`rounded-[18px] border px-2.5 py-2 text-center ${styles}`}>
      <div className="text-[9px] uppercase tracking-[.18em]">{label}</div>
      <div className="mt-1 text-[11px] font-semibold capitalize">{value}</div>
    </div>
  );
}

function PanelPreviewImage({
  product,
  wrapperClassName,
  modeClassName,
}: {
  product: Product;
  wrapperClassName: string;
  modeClassName: string;
}) {
  const [imageOk, setImageOk] = useState(hasTransparentProductImage(product));

  const src = imageOk ? getTransparentProductImageUrl(product) || '' : '';

  useEffect(() => {
    setImageOk(hasTransparentProductImage(product));
  }, [product]);

  if (!src) return null;

  return (
    <div className={wrapperClassName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        className={modeClassName}
        style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,.08))' }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageOk(false)}
      />
    </div>
  );
}

function analyzeOutfit(
  items: Partial<Record<Category, Product>>,
  vibeLabel: string,
): OutfitAnalysis {
  const selected = CATEGORY_ORDER
    .map((category) => ({ category, product: items[category] }))
    .filter((entry): entry is { category: Category; product: Product } => Boolean(entry.product));
  const count = selected.length;
  const missing = CATEGORY_PRIORITY.filter((category) => !items[category]);
  const palette = extractPalette(selected.map((entry) => entry.product));
  const accentColors = palette.filter((color) => !NEUTRAL_COLORS.has(color.toLowerCase()));
  const colorHarmony =
    count === 0 ? 52 :
    accentColors.length <= 1 ? 92 :
    accentColors.length === 2 ? 82 :
    accentColors.length === 3 ? 70 : 58;
  const silhouette =
    (items.top ? 28 : 0) +
    (items.bottom ? 28 : 0) +
    (items.shoes ? 18 : 0) +
    (items.outer ? 16 : 0) +
    (items.hat || items.eyewear ? 8 : 0);
  const layering =
    (items.top ? 28 : 0) +
    (items.outer ? 22 : 0) +
    (items.bag ? 16 : 0) +
    (items.jewelry || items.eyewear ? 12 : 0) +
    (items.hat ? 8 : 0);
  const proportions =
    (items.top ? 30 : 0) +
    (items.bottom ? 30 : 0) +
    (items.shoes ? 20 : 0) +
    (items.outer ? 10 : 0) +
    (items.bag ? 8 : 0);
  const completeness = Math.round((count / CATEGORY_ORDER.length) * 100);
  const score = clamp(Math.round(completeness * 0.34 + colorHarmony * 0.22 + silhouette * 0.2 + layering * 0.12 + proportions * 0.12), 48, 99);

  const dnaPool = new Map<string, number>();
  dnaPool.set(vibeLabel, 3);
  for (const entry of selected) {
    for (const tag of [...metadataList(entry.product, 'vibes'), ...metadataList(entry.product, 'styles')]) {
      const normalized = titleCase(tag);
      dnaPool.set(normalized, (dnaPool.get(normalized) || 0) + 1);
    }
  }

  const styleDna = Array.from(dnaPool.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([tag]) => tag);

  const crowd = getCrowding(items);
  const crowding = {
    upper: crowd.upper >= 4 ? 'crowded' : crowd.upper >= 2 ? 'balanced' : 'calm',
    mid: crowd.mid >= 3 ? 'crowded' : crowd.mid >= 2 ? 'balanced' : 'calm',
    lower: crowd.lower >= 3 ? 'crowded' : crowd.lower >= 2 ? 'balanced' : 'calm',
  } as const;

  const balanceLabel =
    count >= 6 ? 'Editorial balance locked' :
    count >= 4 ? 'Strong canvas, finish the gaps' :
    count >= 2 ? 'Base silhouette forming' : 'Canvas still open';

  const silhouetteLabel =
    items.outer && items.top && items.bottom ? 'Layered editorial column' :
    items.top && items.bottom && items.shoes ? 'Clean full-body stack' :
    items.top && items.bottom ? 'Core silhouette in progress' :
    'Studio placement pending';

  const harmonyLabel =
    colorHarmony >= 86 ? 'Color harmony locked' :
    colorHarmony >= 74 ? 'Palette balanced' :
    'Palette needs a cleaner lane';

  const upgradeNote =
    missing.length
      ? `The board reads strongest through the center. Add ${CATEGORY_LABELS[missing[0]].toLowerCase()} next to tighten the composition.`
      : crowding.upper === 'crowded'
      ? 'Upper-body styling is getting busy. Let the hat, eyewear, and outerwear breathe or keep the bag lower on the side-body lane.'
      : items.bag && !items.outer
      ? 'A sharper outer layer would give the bag a cleaner shoulder relationship and make the silhouette feel more premium.'
      : 'The canvas is balanced. Use one-tap polish or generate a bolder variant to push it into a stronger editorial direction.';

  return {
    score,
    colorHarmony,
    silhouette: clamp(silhouette, 44, 98),
    layering: clamp(layering, 38, 96),
    proportions: clamp(proportions, 40, 96),
    palette,
    styleDna,
    missing,
    primaryGap: missing[0] || null,
    harmonyLabel,
    silhouetteLabel,
    balanceLabel,
    upgradeNote,
    crowding,
  };
}

function getCrowding(items: Partial<Record<Category, Product>>) {
  return {
    upper: [items.hat, items.eyewear, items.top, items.outer, items.jewelry].filter(Boolean).length,
    mid: [items.outer, items.top, items.bag, items.jewelry].filter(Boolean).length,
    lower: [items.bottom, items.shoes, items.bag].filter(Boolean).length,
  };
}

function extractPalette(products: Product[]): string[] {
  const counts = new Map<string, number>();

  for (const product of products) {
    for (const color of metadataList(product, 'colors')) {
      const token = color.toLowerCase();
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    for (const token of tokenize(`${product.name} ${product.brand}`)) {
      if (isColorToken(token)) {
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }
  }

  if (!counts.size) return ['Black', 'Cream'];
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([color]) => titleCase(color));
}

function metadataList(product: Product, key: 'colors' | 'styles' | 'vibes' | 'keywords'): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isColorToken(token: string): boolean {
  return [
    'black',
    'white',
    'cream',
    'grey',
    'gray',
    'charcoal',
    'navy',
    'blue',
    'pink',
    'red',
    'green',
    'brown',
    'tan',
    'beige',
    'silver',
    'gold',
    'olive',
    'stone',
  ].includes(token);
}

function BuilderPageWithSearchParams() {
  const searchParams = useSearchParams();
  return (
    <BuilderPageContent
      quickSlot={searchParams?.get('slot') ?? null}
      quickQuery={searchParams?.get('query') ?? null}
      quickVibe={searchParams?.get('vibe') ?? null}
      quickFrame={searchParams?.get('frame') ?? null}
      quickSlots={searchParams?.get('slots') ?? null}
      quickLock={searchParams?.get('lock') ?? null}
      quickSource={searchParams?.get('source') ?? null}
    />
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderPageContent quickSlot={null} quickQuery={null} quickVibe={null} quickFrame={null} quickSlots={null} quickLock={null} quickSource={null} />}>
      <BuilderPageWithSearchParams />
    </Suspense>
  );
}
