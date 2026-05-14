'use client';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, Bookmark, ExternalLink, LoaderCircle, Lock, Send, Shirt, SlidersHorizontal, Sparkles, WalletCards } from 'lucide-react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mannequin, type FitVariant } from '@/components/Mannequin';
import { SearchSheet } from '@/components/SearchSheet';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { ProductImage } from '@/components/ProductImage';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { useWardrobe } from '@/store/wardrobe';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { hydrateItemsFromCatalog } from '@/lib/catalog';
import { calculateBudgetStatus, calculateOutfitScore } from '@/lib/catalog-health';
import { getProductOutboundUrl } from '@/lib/product-links';
import { filterRenderableProducts, isRenderableProduct } from '@/lib/product-image-quality';
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
  streetwear: ['hat', 'outer', 'top', 'bottom', 'shoes', 'eyewear'],
  clean: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  gym: ['top', 'bottom', 'shoes', 'outer', 'hat', 'bag'],
  athletic: ['top', 'bottom', 'shoes', 'outer', 'hat', 'bag'],
  cozy: ['outer', 'top', 'bottom', 'shoes', 'hat', 'bag'],
  date: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  office: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  work: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  vacation: ['hat', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  travel: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  edgy: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  techwear: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  preppy: ['outer', 'top', 'bottom', 'shoes', 'eyewear'],
  'old-money': ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  campus: ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat'],
  premium: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
};
const FULL_GENERATOR_SLOTS: Record<VibeId, Category[]> = {
  night: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  street: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  streetwear: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  clean: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  gym: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'],
  athletic: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'],
  cozy: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'],
  date: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  office: ['outer', 'top', 'bottom', 'shoes', 'bag'],
  work: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  vacation: ['hat', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  travel: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  edgy: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  techwear: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  preppy: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  'old-money': ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  campus: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  premium: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
};

function defaultGenerationSlotsForVibe(vibe: VibeId): Category[] {
  return FULL_GENERATOR_SLOTS[vibe] || STARTER_GENERATOR_SLOTS[vibe] || ['top', 'bottom', 'shoes', 'bag'];
}

const FIT_VARIANT_MAP: Record<FitVariant, Partial<Record<VibeId, VibeId>>> = {
  casual: {
    night: 'clean',
    street: 'cozy',
    clean: 'cozy',
    gym: 'cozy',
    cozy: 'cozy',
    date: 'clean',
    office: 'clean',
    vacation: 'cozy',
    edgy: 'street',
    preppy: 'clean',
  },
  elevated: {
    night: 'night',
    street: 'office',
    clean: 'office',
    gym: 'clean',
    cozy: 'office',
    date: 'night',
    office: 'office',
    vacation: 'date',
    edgy: 'night',
    preppy: 'office',
  },
  bold: {
    night: 'edgy',
    street: 'street',
    clean: 'edgy',
    gym: 'street',
    cozy: 'street',
    date: 'night',
    office: 'edgy',
    vacation: 'street',
    edgy: 'edgy',
    preppy: 'street',
  },
};

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
const SWIPE_HINT_STORAGE_KEY = 'sylistly-builder-swipe-hint-v1';
const BUILD_SECTION_TABS = ['build', 'settings', 'refine', 'details'] as const;
type BuildSectionTab = typeof BUILD_SECTION_TABS[number];

const BUILD_SECTION_LABELS: Record<BuildSectionTab, string> = {
  build: 'Build',
  settings: 'Controls',
  refine: 'Refine',
  details: 'Details',
};

const BUILD_OVERLAY_TABS = ['settings', 'refine', 'details'] as const;
type WardrobeGenerationMode = 'catalog' | 'wardrobe' | 'mixed';

const WARDROBE_GENERATION_MODES: Array<{ value: WardrobeGenerationMode; label: string; helper: string }> = [
  { value: 'catalog', label: 'Catalog', helper: 'Shop-ready picks' },
  { value: 'wardrobe', label: 'Closet only', helper: 'Use what you own' },
  { value: 'mixed', label: 'Closet + suggested', helper: 'Fill the gaps' },
];

function formatMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

function BuilderSignal({ label, value, helper, tone = 'default' }: { label: string; value: string; helper?: string; tone?: 'default' | 'accent' | 'warn' }) {
  return (
    <div className={`rounded-2xl border px-2 py-2.5 text-left ${tone === 'accent' ? 'border-accent/30 bg-accent/10' : tone === 'warn' ? 'border-[#ffb38a]/30 bg-[#ff8a4a]/10' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className="text-[8px] uppercase tracking-[.14em] text-muted">{label}</div>
      <div className={`mt-1 font-serif text-[16px] font-semibold ${tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-[#ffb38a]' : 'text-ink'}`}>{value}</div>
      {helper ? <div className="mt-0.5 truncate text-[9px] text-muted">{helper}</div> : null}
    </div>
  );
}

function lookAllowanceCents(
  budget: GeneratorBudget,
  customBudgetCents: number | null,
  selectedSlotCount: number,
): number | null {
  if (budget === 'any') return null;
  const perItemMax = budget === 'custom' ? customBudgetCents : getBudgetMaxCents(budget);
  if (!perItemMax || perItemMax <= 0) return null;
  return perItemMax * Math.max(1, selectedSlotCount);
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

const VARIANT_COPY: Record<FitVariant, { title: string; blurb: string }> = {
  casual: { title: 'Casual', blurb: 'Relax the look' },
  elevated: { title: 'Elevated', blurb: 'Sharpen the silhouette' },
  bold: { title: 'Bold', blurb: 'Push contrast and statement' },
};

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

function BuilderPageContent({
  quickSlot,
  quickQuery,
  quickVibe,
  quickFrame,
  quickSlots,
}: {
  quickSlot: string | null;
  quickQuery: string | null;
  quickVibe: string | null;
  quickFrame: string | null;
  quickSlots: string | null;
}) {
  const { items, count, clear, replaceItems } = useFit();
  const skinTone = useProfile((state) => state.profile.skinTone);
  const bodyType = useProfile((state) => state.profile.bodyType);
  const setBodyType = useProfile((state) => state.setBodyType);
  const saveLocalFit = useSavedFits((state) => state.saveFit);
  const postFitToFeed = useSocialFeed((state) => state.postFit);
  const wardrobeItems = useWardrobe((state) => state.items);
  const [searchFor, setSearchFor] = useState<Category | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<VibeId>('clean');
  const [selectedGenerationSlots, setSelectedGenerationSlots] = useState<Category[]>(() =>
    defaultGenerationSlotsForVibe('clean'),
  );
  const [generatorBudget, setGeneratorBudget] = useState<GeneratorBudget>('under250');
  const [customBudgetInput, setCustomBudgetInput] = useState('');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [recentGeneratedIds, setRecentGeneratedIds] = useState<string[]>([]);
  const [boardDragging, setBoardDragging] = useState(false);
  const [activeEditSlot, setActiveEditSlot] = useState<Category | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState<'save' | 'pass' | null>(null);
  const [dragIntent, setDragIntent] = useState<'save' | 'pass' | null>(null);
  const [swipeCoachLabel, setSwipeCoachLabel] = useState<'save' | 'pass' | null>(null);
  const [swipeHintDismissed, setSwipeHintDismissed] = useState(true);
  const [swipeHintRunCount, setSwipeHintRunCount] = useState(0);
  const [saveBurst, setSaveBurst] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeBuildOverlay, setActiveBuildOverlay] = useState<Exclude<BuildSectionTab, 'build'> | null>(null);
  const [lockedSlots, setLockedSlots] = useState<Category[]>([]);
  const [postVisibility, setPostVisibility] = useState<'public' | 'private'>('public');
  const [postCaption, setPostCaption] = useState('');
  const [postOccasion, setPostOccasion] = useState('Casual');
  const [addToStory, setAddToStory] = useState(true);
  const [wardrobeMode, setWardrobeMode] = useState<WardrobeGenerationMode>('mixed');
  const boardControls = useAnimation();
  const router = useRouter();
  const n = count();
  const renderItems = hasMounted ? items : {};
  const renderN = hasMounted ? n : 0;
  const total = Object.values(renderItems).reduce((sum, product) => sum + (product?.priceCents || 0), 0);
  const totalDisplay = `$${(total / 100).toFixed(2)}`;
  const activeVibe = VIBES.find((vibe) => vibe.id === selectedVibe) || VIBES[0];
  const generatorFrame: GeneratorFrame =
    bodyType === 'custom' ? 'androgynous' : bodyType;
  const analysis = useMemo(() => analyzeOutfit(renderItems, activeVibe.label), [renderItems, activeVibe.label]);
  const [bagLayer, setBagLayer] = useState<'front' | 'behind'>('front');
  const customBudgetCents = customBudgetInput ? Number(customBudgetInput) * 100 : null;
  const allowanceCents = lookAllowanceCents(generatorBudget, customBudgetCents, selectedGenerationSlots.length || renderN || 1);
  const allowanceDeltaCents = allowanceCents === null ? null : allowanceCents - total;
  const wardrobeProducts = useMemo(
    () => Object.values(wardrobeItems)
      .filter((item) => item.status === 'owned' || item.status === 'similar')
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => item.product),
    [wardrobeItems],
  );
  const wardrobeProductsByCategory = useMemo(() => {
    const grouped = new Map<Category, Product[]>();
    for (const product of wardrobeProducts) {
      const current = grouped.get(product.category) || [];
      current.push(product);
      grouped.set(product.category, current);
    }
    return grouped;
  }, [wardrobeProducts]);
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
  const wardrobeProductIds = useMemo(() => new Set(wardrobeProducts.map((product) => product.id)), [wardrobeProducts]);
  const outfitScore = useMemo(() => calculateOutfitScore(renderItems, wardrobeProductIds), [renderItems, wardrobeProductIds]);
  const builderBudgetStatus = useMemo(() => calculateBudgetStatus(total, generatorBudget), [total, generatorBudget]);

  useBodyScrollLock(Boolean(activeBuildOverlay || checkoutProducts));

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const seen = window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY) === '1';
    setSwipeHintDismissed(seen);
    if (seen) return;
    const timeout = window.setTimeout(() => void playSwipeHint(), 850);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (swipeHintDismissed || swipeHintRunCount >= 2 || boardDragging || generatorLoading || searchFor) return;
    const timeout = window.setTimeout(() => void playSwipeHint(), 6500);
    return () => window.clearTimeout(timeout);
  }, [boardDragging, generatorLoading, searchFor, swipeHintDismissed, swipeHintRunCount]);

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
    const changed = Object.entries(hydrated).some(([slot, product]) => product !== items[slot as Category]);
    if (changed) {
      replaceItems(hydrated);
    }
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

  function closeSearchSheet() {
    setSearchFor(null);
    setActiveEditSlot(null);
    if (quickSlot || quickQuery) router.replace('/build');
  }

  async function runCategorySearch(category: Category, query: string, avoidIds: string[] = []): Promise<Product | null> {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, category, frame: generatorFrame, priceMax: activePriceMax }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Search failed.');
    }
    const products = Array.isArray(data.products) ? filterRenderableProducts(data.products.filter(Boolean) as Product[]) : [];
    const avoidSet = new Set(avoidIds);
    const preferred = products.filter((product) => !avoidSet.has(product.id));
    const eligible = preferred.length ? preferred : products;
    const pool = eligible.slice(0, Math.min(12, eligible.length));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
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

      const closetSeedSlots = targetSlots.filter((slot) => !nextItems[slot]);
      if (wardrobeMode !== 'catalog') {
        for (const slot of closetSeedSlots) {
          const match = wardrobeProductsByCategory.get(slot)?.find((product) => !currentProductIds.includes(product.id));
          if (!match) continue;
          nextItems[slot] = match;
          addedCount += 1;
        }
      }

      const unresolvedApiTargetSlots = targetSlots.filter((slot) => !nextItems[slot]);
      if (wardrobeMode === 'wardrobe') {
        if (!addedCount) {
          setStatusMessage('Your Closet does not have enough matching pieces for the selected categories yet.');
          return;
        }

        replaceItems(nextItems);
        setRecentGeneratedIds((current) => {
          const freshIds = Object.values(nextItems)
            .filter((product): product is Product => Boolean(product))
            .map((product) => product.id);
          return Array.from(new Set([...freshIds, ...current])).slice(0, 72);
        });
        setStatusMessage(
          unresolvedApiTargetSlots.length
            ? `Built from Closet with ${addedCount} piece${addedCount !== 1 ? 's' : ''}. Add ${unresolvedApiTargetSlots.map((slot) => CATEGORY_LABELS[slot]).join(', ')} to your Closet to finish this mode.`
            : `Built a Closet-only ${workingVibe.label.toLowerCase()} fit with ${addedCount} piece${addedCount !== 1 ? 's' : ''}.`,
        );
        return;
      }

      if (!unresolvedApiTargetSlots.length) {
        replaceItems(nextItems);
        setStatusMessage(`Seeded this fit from your Closet. Switch to Catalog if you want more shopping picks.`);
        return;
      }

      const lookResponse = await fetch('/api/look', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vibe: vibeId,
          frame: generatorFrame,
          budget: generatorBudget,
          customMaxCents: customBudgetCents,
          seed: Date.now(),
          avoidProductIds: Array.from(new Set([
            ...recentGeneratedIds,
            ...(mode === 'starter' || mode === 'refresh' || mode === 'full' ? currentProductIds : []),
          ])),
          mode,
          currentItems: items,
          targetSlots: unresolvedApiTargetSlots,
        }),
      });
      const lookData = await lookResponse.json();

      if (lookResponse.ok && lookData.products && typeof lookData.products === 'object') {
        for (const [slot, product] of Object.entries(lookData.products) as Array<[Category, Product]>) {
          if (!unresolvedApiTargetSlots.includes(slot)) continue;
          if (!isRenderableProduct(product)) continue;
          nextItems[slot] = product;
          addedCount += 1;
        }

        if (lookData.collection?.label) {
          collectionLabel = lookData.collection.label as string;
        }
        if (lookData.assistantMode === 'ai-assisted') {
          assistantLabel = ' with AI stylist assist';
        }
      }

      const unresolvedSlots = unresolvedApiTargetSlots.filter((slot) => !nextItems[slot]);
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
            ),
          })),
        );

        for (const result of results) {
          if (result.status !== 'fulfilled' || !isRenderableProduct(result.value.product)) continue;
          nextItems[result.value.slot] = result.value.product;
          addedCount += 1;
        }
      }

      if (!addedCount) {
        setStatusMessage('No strong starter pieces came back for that vibe. Try another vibe or search a slot manually.');
        return;
      }

      replaceItems(nextItems);
      setRecentGeneratedIds((current) => {
        const freshIds = Object.values(nextItems)
          .filter((product): product is Product => Boolean(product))
          .map((product) => product.id);
        return Array.from(new Set([...freshIds, ...current])).slice(0, 72);
      });
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
    }
  }

  async function generateVariant(variant: FitVariant) {
    const mappedVibe = FIT_VARIANT_MAP[variant][selectedVibe] || selectedVibe;
    if (mappedVibe !== selectedVibe) {
      setSelectedVibe(mappedVibe);
    }

    await generateLook('full', {
      vibeId: mappedVibe,
      sourceLabel: `${variant.charAt(0).toUpperCase() + variant.slice(1)} pass.`,
    });
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

  function seedFromWardrobe() {
    if (!wardrobeProducts.length) {
      setStatusMessage('Add owned or similar pieces in Closet first.');
      setActiveBuildOverlay('settings');
      return;
    }

    const targetSlots = selectedGenerationSlots.length ? selectedGenerationSlots : CATEGORY_ORDER;
    const nextItems: Partial<Record<Category, Product>> = { ...items };
    let addedCount = 0;

    for (const slot of targetSlots) {
      if (lockedSlotSet.has(slot) && nextItems[slot]) continue;
      const match = wardrobeProductsByCategory.get(slot)?.find((product) => product.id !== nextItems[slot]?.id);
      if (!match) continue;
      nextItems[slot] = match;
      addedCount += 1;
    }

    if (!addedCount) {
      setStatusMessage('Your Closet has pieces, but none match the selected categories yet.');
      return;
    }

    replaceItems(nextItems);
    setStatusMessage(`Seeded ${addedCount} selected slot${addedCount !== 1 ? 's' : ''} from your Closet.`);
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
            ? `Saved locally as "${localFit.title}". Cloud sync can turn on once Supabase is wired.`
            : 'Save is not wired all the way yet. Finish Supabase setup to store fits.',
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
    const caption = postCaption.trim();
    const posted = postFitToFeed(items, {
      title: caption || `${postOccasion} ${activeVibe.label} fit`,
      caption: caption || undefined,
      vibe: activeVibe.label,
      occasion: postOccasion,
      story: addToStory,
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
      setSaveBurst(true);
      window.setTimeout(() => setSaveBurst(false), 850);
      setStatusMessage(saved ? `Saved "${saved.title}". Loading the next ${activeVibe.label.toLowerCase()} look.` : 'Saved this look. Loading the next variation.');
    } else if (direction === 'left') {
      setStatusMessage(`Passed. Loading another ${activeVibe.label.toLowerCase()} look.`);
    }

    await generateLook(hasCurrentFit ? 'refresh' : 'full', {
      sourceLabel: direction === 'right' ? 'Saved swipe.' : 'Pass swipe.',
    });
  }

  function dismissSwipeHint(persist = false) {
    if (persist) {
      window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, '1');
    }
    setSwipeHintDismissed(true);
    setSwipeCoachLabel(null);
  }

  async function playSwipeHint() {
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
    setSaveBurst(true);
    window.setTimeout(() => setSaveBurst(false), 850);
    setStatusMessage(saved ? `Saved "${saved.title}".` : 'Saved this fit.');
  }

  const activeSwipeCue = swipeFeedback || dragIntent || swipeCoachLabel;

  return (
    <main className="relative mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <header className="flex items-center justify-between px-4 pb-2.5 pt-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-surface-2 text-ink transition hover:border-accent"
          aria-label="Back"
        >
          <ArrowUpRight size={15} className="rotate-[225deg]" />
        </button>
        <div className="text-center">
          <div className="font-serif text-[18px] font-semibold leading-none text-ink">
            Sylistly <em className="italic text-accent">Builder</em>
          </div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.16em] text-muted">
            Build. Refine. Wear.
          </div>
        </div>
        <button
          onClick={saveFit}
          disabled={renderN === 0}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold ${
            renderN > 0 ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-hairline-2 text-muted-2'
          }`}
        >
          <Bookmark size={12} /> Save fit
        </button>
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
                    : 'border-white/10 bg-black/28 text-white/42'
                }`}
              >
                Pass
              </div>
              <div
                className={`pointer-events-none absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] transition ${
                  activeSwipeCue === 'save'
                    ? 'border-accent bg-accent text-white shadow-pink-glow'
                    : 'border-accent/20 bg-accent/10 text-white/48'
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

            <div className="grid grid-cols-3 gap-2.5 px-0.5">
              <button
                type="button"
                onClick={() => setActiveBuildOverlay('settings')}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/18 bg-black/58 px-3 py-3.5 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_14px_34px_rgba(0,0,0,.3)] backdrop-blur-md transition active:scale-[.98]"
              >
                <SlidersHorizontal size={13} />
                Controls
              </button>
              <button
                type="button"
                onClick={seedFromWardrobe}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/18 bg-black/58 px-3 py-3.5 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_14px_34px_rgba(0,0,0,.3)] backdrop-blur-md transition active:scale-[.98]"
              >
                <Shirt size={13} />
                Closet
              </button>
              <button
                type="button"
                onClick={() => void generateLook('full', { sourceLabel: 'Board controls.' })}
                disabled={generatorLoading || selectedGenerationSlots.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-3.5 text-[11px] font-black uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-[.98] disabled:bg-black/45 disabled:text-white/45 disabled:shadow-none"
              >
                {generatorLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center gap-3 text-center">
              <div className="flex flex-wrap justify-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-white/80">{activeVibe.label}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-white/80">{generatorFrame === 'androgynous' ? 'Any Frame' : generatorFrame}</span>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-accent">Score {outfitScore.total}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-white/80">{outfitScore.completeness}% complete</span>
                <span
                  className={`rounded-full border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] ${
                    allowanceDeltaCents !== null && allowanceDeltaCents < 0
                      ? 'border-[#ffb38a]/40 bg-[#ff8a4a]/10 text-[#ffb38a]'
                      : 'border-white/10 bg-white/[0.04] text-white/80'
                  }`}
                >
                  {allowanceDeltaCents === null
                    ? totalDisplay
                    : allowanceDeltaCents >= 0
                    ? `${totalDisplay} · ${builderBudgetStatus.label}`
                    : `${totalDisplay} · ${builderBudgetStatus.label}`}
                </span>
              </div>
              <div className="text-[11px] font-medium leading-relaxed text-muted-2">
                <span className="text-white/70">Swipe left</span> to pass / <span className="text-white/70">Swipe right</span> to save / <span className="text-white/70">Tap</span> any slot to refine
              </div>
              <div className="grid w-full grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void performBoardSwipe('left')}
                  disabled={generatorLoading}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2 transition active:scale-[.98] hover:border-white/25 hover:text-ink disabled:opacity-50"
                >
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => void performBoardSwipe('right')}
                  disabled={generatorLoading || renderN === 0}
                  className="rounded-full border border-accent/50 bg-accent/14 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white shadow-[0_0_18px_rgba(232,54,93,.2)] transition active:scale-[.98] hover:bg-accent hover:shadow-pink-glow disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#141210]/92 p-3 shadow-[0_18px_42px_rgba(0,0,0,.2)]">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveBuildOverlay('refine')}
                className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-3 text-[10px] font-black uppercase tracking-[.12em] text-muted-2 transition hover:border-accent/50 hover:text-ink"
              >
                Refine
              </button>
              <button
                type="button"
                onClick={() => setActiveBuildOverlay('details')}
                className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-3 text-[10px] font-black uppercase tracking-[.12em] text-muted-2 transition hover:border-accent/50 hover:text-ink"
              >
                Details
              </button>
              <button
                type="button"
                onClick={shopAll}
                disabled={renderN === 0}
                className="rounded-full bg-accent px-2 py-3 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-pink-glow transition hover:bg-accent-hot disabled:bg-white/[0.04] disabled:text-muted disabled:shadow-none"
              >
                Shop
              </button>
            </div>
          </section>

          {statusMessage ? (
            <div className="rounded-[20px] border border-hairline bg-surface-2 px-4 py-3 text-[11px] leading-relaxed text-muted-2">
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
            <BuildSettingsPanel
              selectedVibe={selectedVibe}
              onSelectVibe={setSelectedVibe}
              generatorBudget={generatorBudget}
              onSetGeneratorBudget={setGeneratorBudget}
              customBudgetInput={customBudgetInput}
              onSetCustomBudgetInput={setCustomBudgetInput}
              generatorFrame={generatorFrame}
              onSetFrame={setBodyType}
              selectedGenerationSlots={selectedGenerationSlots}
              onToggleGenerationSlot={toggleGenerationSlot}
              onUseVibeDefaults={() => setSelectedGenerationSlots(defaultGenerationSlotsForVibe(selectedVibe))}
              onSelectAll={() => setSelectedGenerationSlots(CATEGORY_ORDER)}
              allowanceCents={allowanceCents}
              allowanceDeltaCents={allowanceDeltaCents}
              totalCents={total}
              wardrobeCount={wardrobeProducts.length}
              wardrobeMode={wardrobeMode}
              onSetWardrobeMode={setWardrobeMode}
              onSeedFromWardrobe={seedFromWardrobe}
              onOpenTryOn={() => router.push('/try-on')}
              onGenerate={() => void generateLook('full', { sourceLabel: 'Control panel.' })}
              generatorLoading={generatorLoading}
            />
          ) : activeBuildOverlay === 'refine' ? (
            <div className="flex flex-col gap-3">
              <FocusedRefinePanel
                items={renderItems}
                activeCategory={refineFocusCategory}
                lockedSlots={lockedSlots}
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
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                    <label className="block text-[10px] font-bold uppercase tracking-[.16em] text-muted">
                      Caption
                      <textarea
                        value={postCaption}
                        onChange={(event) => setPostCaption(event.target.value.slice(0, 140))}
                        placeholder="Add a caption..."
                        className="mt-2 min-h-[72px] w-full resize-none rounded-2xl border border-white/10 bg-black/18 px-3 py-2 text-[13px] font-medium normal-case tracking-normal text-ink outline-none placeholder:text-muted focus:border-accent"
                      />
                    </label>
                    <div className="mt-3">
                      <div className="text-[10px] font-bold uppercase tracking-[.16em] text-muted">Occasion</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {['Casual', 'Work', 'Date', 'Night', 'Travel'].map((occasion) => (
                          <button
                            key={occasion}
                            type="button"
                            onClick={() => setPostOccasion(occasion)}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] ${
                              postOccasion === occasion
                                ? 'bg-accent text-white shadow-pink-glow'
                                : 'border border-white/10 bg-white/[0.04] text-muted-2'
                            }`}
                          >
                            {occasion}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddToStory((value) => !value)}
                      className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-left"
                    >
                      <span>
                        <span className="block text-[11px] font-bold text-ink">Add to style story</span>
                        <span className="mt-0.5 block text-[10px] text-muted">Show this fit as a temporary creator post.</span>
                      </span>
                      <span className={`h-6 w-11 rounded-full p-0.5 transition ${addToStory ? 'bg-accent' : 'bg-white/16'}`}>
                        <span className={`block h-5 w-5 rounded-full bg-white transition ${addToStory ? 'translate-x-5' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  </div>
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
    </main>
  );
}

function BuildSettingsPanel({
  selectedVibe,
  onSelectVibe,
  generatorBudget,
  onSetGeneratorBudget,
  customBudgetInput,
  onSetCustomBudgetInput,
  generatorFrame,
  onSetFrame,
  selectedGenerationSlots,
  onToggleGenerationSlot,
  onUseVibeDefaults,
  onSelectAll,
  allowanceCents,
  allowanceDeltaCents,
  totalCents,
  wardrobeCount,
  wardrobeMode,
  onSetWardrobeMode,
  onSeedFromWardrobe,
  onOpenTryOn,
  onGenerate,
  generatorLoading,
}: {
  selectedVibe: VibeId;
  onSelectVibe: (vibe: VibeId) => void;
  generatorBudget: GeneratorBudget;
  onSetGeneratorBudget: (budget: GeneratorBudget) => void;
  customBudgetInput: string;
  onSetCustomBudgetInput: (value: string) => void;
  generatorFrame: GeneratorFrame;
  onSetFrame: (frame: 'masc' | 'fem' | 'androgynous') => void;
  selectedGenerationSlots: Category[];
  onToggleGenerationSlot: (category: Category) => void;
  onUseVibeDefaults: () => void;
  onSelectAll: () => void;
  allowanceCents: number | null;
  allowanceDeltaCents: number | null;
  totalCents: number;
  wardrobeCount: number;
  wardrobeMode: WardrobeGenerationMode;
  onSetWardrobeMode: (mode: WardrobeGenerationMode) => void;
  onSeedFromWardrobe: () => void;
  onOpenTryOn: () => void;
  onGenerate: () => void;
  generatorLoading: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))] p-4 shadow-[0_18px_42px_rgba(0,0,0,.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[.18em] text-muted">Live controls</div>
            <div className="mt-1 font-serif text-[24px] font-semibold leading-tight text-ink">
              Adjust without leaving the preview
            </div>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
            <SlidersHorizontal size={18} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-center">
            <div className="text-[8px] uppercase tracking-[.14em] text-muted">Current</div>
            <div className="mt-1 font-serif text-[18px] font-semibold text-ink">{formatMoney(totalCents)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-center">
            <div className="text-[8px] uppercase tracking-[.14em] text-muted">Allowance</div>
            <div className="mt-1 font-serif text-[18px] font-semibold text-ink">
              {allowanceCents === null ? 'Open' : formatMoney(allowanceCents)}
            </div>
          </div>
          <div className={`rounded-2xl border px-2 py-2.5 text-center ${
            allowanceDeltaCents === null || allowanceDeltaCents >= 0
              ? 'border-accent/25 bg-accent/10'
              : 'border-[#ffb38a]/30 bg-[#ff8a4a]/10'
          }`}>
            <div className="text-[8px] uppercase tracking-[.14em] text-muted">Status</div>
            <div className={`mt-1 font-serif text-[18px] font-semibold ${
              allowanceDeltaCents === null || allowanceDeltaCents >= 0 ? 'text-accent' : 'text-[#ffb38a]'
            }`}>
              {allowanceDeltaCents === null
                ? 'Flexible'
                : allowanceDeltaCents >= 0
                ? 'In budget'
                : 'Over'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenTryOn}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
        >
          <Sparkles size={13} className="text-accent" />
          Open Dressing Room
        </button>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[.18em] text-muted">Style frame</div>
            <div className="mt-1 text-[13px] text-muted-2">This directly filters the generated clothing pool.</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { value: 'masc', label: 'Male' },
            { value: 'fem', label: 'Female' },
            { value: 'androgynous', label: 'Neutral' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSetFrame(option.value as 'masc' | 'fem' | 'androgynous')}
              className={`rounded-2xl border px-3 py-3 text-[11px] font-bold uppercase tracking-[.12em] transition ${
                generatorFrame === option.value
                  ? 'border-accent bg-accent text-white shadow-pink-glow'
                  : 'border-hairline bg-surface-2 text-muted-2'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-surface-1 p-4">
        <div className="text-[10px] uppercase tracking-[.18em] text-muted">Vibe</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {VIBES.map((vibe) => (
            <button
              key={vibe.id}
              type="button"
              onClick={() => onSelectVibe(vibe.id)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                selectedVibe === vibe.id
                  ? 'border-accent bg-accent/15 text-ink shadow-[0_0_18px_rgba(232,54,93,.24)]'
                  : 'border-hairline bg-surface-2 text-muted-2'
              }`}
            >
              <div className="text-[12px] font-bold">{vibe.label}</div>
              <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted">{vibe.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[.18em] text-muted">Budget allowance</div>
            <div className="mt-1 text-[13px] text-muted-2">Set a per-piece cap, then Sylistly shows the full look allowance.</div>
          </div>
          <WalletCards size={18} className="text-accent" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
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
              onClick={() => onSetGeneratorBudget(option.value as GeneratorBudget)}
              className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] transition ${
                generatorBudget === option.value
                  ? 'bg-accent text-white shadow-pink-glow'
                  : 'border border-hairline bg-surface-2 text-muted-2'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {generatorBudget === 'custom' ? (
          <label className="mt-3 flex items-center gap-2 rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[12px] text-ink">
            <span className="text-muted">$</span>
            <input
              value={customBudgetInput}
              onChange={(event) => onSetCustomBudgetInput(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="180"
              className="w-full bg-transparent outline-none"
            />
            <span className="text-[10px] uppercase tracking-[.12em] text-muted">per piece</span>
          </label>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[.18em] text-muted">Categories</div>
            <div className="mt-1 text-[13px] text-muted-2">Choose which slots regenerate next.</div>
          </div>
          <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-accent">
            {selectedGenerationSlots.length}/8
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((category) => {
            const selected = selectedGenerationSlots.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => onToggleGenerationSlot(category)}
                className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] transition ${
                  selected
                    ? 'border-accent bg-accent/15 text-ink shadow-[0_0_16px_rgba(232,54,93,.22)]'
                    : 'border-hairline bg-surface-2 text-muted-2'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onUseVibeDefaults}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2"
          >
            Vibe defaults
          </button>
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2"
          >
            Select all
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-accent/25 bg-accent/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[.18em] text-accent">Wardrobe source</div>
            <div className="mt-1 font-serif text-[21px] font-semibold text-ink">Generate from Closet</div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
              {wardrobeCount
                ? `${wardrobeCount} owned or similar piece${wardrobeCount !== 1 ? 's' : ''} can seed this board.`
                : 'Add owned or similar pieces in Closet to unlock wardrobe-first looks.'}
            </p>
          </div>
          <Shirt size={19} className="shrink-0 text-accent" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {WARDROBE_GENERATION_MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSetWardrobeMode(option.value)}
              className={`rounded-2xl border px-2 py-3 text-left transition ${
                wardrobeMode === option.value
                  ? 'border-accent bg-accent text-white shadow-pink-glow'
                  : 'border-white/10 bg-white/[0.04] text-muted-2'
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-[.1em]">{option.label}</span>
              <span className={`mt-1 block text-[9px] leading-snug ${wardrobeMode === option.value ? 'text-white/76' : 'text-muted'}`}>
                {option.helper}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[.9fr_1.1fr] gap-2">
          <button
            type="button"
            onClick={onSeedFromWardrobe}
            disabled={!wardrobeCount}
            className="rounded-full border border-accent/45 bg-accent/12 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-accent disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-muted"
          >
            Seed board
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generatorLoading || !selectedGenerationSlots.length}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow disabled:bg-white/[0.06] disabled:text-muted disabled:shadow-none"
          >
            {generatorLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Generate look
          </button>
        </div>
      </div>
    </section>
  );
}

function FocusedRefinePanel({
  items,
  activeCategory,
  lockedSlots,
  onFocusCategory,
  onToggleLock,
  onOpenSearch,
}: {
  items: Partial<Record<Category, Product>>;
  activeCategory: Category;
  lockedSlots: Category[];
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
        <div className="flex w-max gap-2 pr-2">
          {CATEGORY_ORDER.map((category) => {
            const product = items[category];
            const active = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onFocusCategory(category)}
                className={`relative w-[68px] flex-none rounded-[16px] border p-1.5 text-left transition ${
                  active || lockedSlots.includes(category)
                    ? 'border-accent bg-accent/12 shadow-[0_0_18px_rgba(232,54,93,.26)]'
                    : 'border-white/8 bg-white/[0.035] hover:border-accent/45'
                }`}
              >
                {lockedSlots.includes(category) ? (
                  <span className="absolute right-1 top-1 z-10 grid h-4 w-4 place-items-center rounded-full bg-accent text-white">
                    <Lock size={9} strokeWidth={3} />
                  </span>
                ) : null}
                <div className={`grid aspect-square place-items-center overflow-hidden rounded-[12px] ${
                  product ? 'bg-[linear-gradient(180deg,#fbfaf8_0%,#f2ebe5_100%)]' : 'bg-white/[0.05]'
                }`}>
                  {product ? (
                    <PanelPreviewImage
                      product={product}
                      category={category}
                      wrapperClassName="h-full w-full"
                      modeClassName="h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    <span className="text-lg text-muted">+</span>
                  )}
                </div>
                <div className={`mt-1 truncate text-[8px] font-bold uppercase tracking-[.1em] ${
                  active ? 'text-accent' : 'text-muted'
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
              category={activeCategory}
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
              className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] transition ${
                activeLocked
                  ? 'border-accent bg-accent text-white shadow-[0_8px_18px_rgba(232,54,93,.34)]'
                  : 'border-[#d8c7b8] bg-white/85 text-[#6c5c52] hover:border-accent hover:text-accent'
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
                {activeProduct.priceCents ? `$${(activeProduct.priceCents / 100).toLocaleString('en-US')}` : 'Price pending'}
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
    <div className="fixed inset-0 z-50 mx-auto flex h-[100dvh] max-w-[480px] items-end bg-black/46 backdrop-blur-[2px]">
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

function SelectedPiecesPanel({
  analysis,
  items,
  onOpenSearch,
}: {
  analysis: OutfitAnalysis;
  items: Partial<Record<Category, Product>>;
  onOpenSearch: (category: Category) => void;
}) {
  const stackEntries = CATEGORY_ORDER.filter((category) => items[category]).map((category) => ({
    category,
    product: items[category]!,
  }));

  return (
    <section className="rounded-[24px] border border-white/8 bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="font-serif text-[18px] font-semibold text-[#fff6f0]">Selected Pieces</div>
          <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[9px] font-semibold text-[#d7c8bf]">
            {stackEntries.length}/8
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenSearch(analysis.primaryGap || 'top')}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-accent transition hover:text-white"
        >
          Edit
          <ArrowUpRight size={11} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 min-[390px]:grid-cols-6">
        {stackEntries.length ? (
          stackEntries.map(({ category, product }) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onOpenSearch(category)}
              className="group min-w-0 text-left"
            >
              <div className="relative aspect-square overflow-hidden rounded-[12px] bg-[linear-gradient(180deg,#fbfaf8_0%,#f2ebe5_100%)] ring-1 ring-[#efe4da] transition group-hover:ring-accent/50">
                <PanelPreviewImage
                  product={product}
                  category={category}
                  modeClassName="h-full w-full object-contain p-1.5"
                  wrapperClassName="h-full w-full"
                />
                <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#181513] text-[10px] leading-none text-white">
                  x
                </span>
              </div>
              <div className="mt-1 min-w-0">
                <div className="truncate text-[8px] uppercase tracking-[.08em] text-[#a69489]">{CATEGORY_LABELS[category]}</div>
                <div className="truncate text-[9px] text-[#fff4ee]">{product.brand}</div>
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full rounded-[18px] border border-dashed border-white/10 bg-[#141210] px-3 py-5 text-center text-[11px] leading-relaxed text-[#c8b9ae]">
            Add pieces from the tray to build your selected stack.
          </div>
        )}
      </div>
    </section>
  );
}

function FitDiagnosticsPanel({
  analysis,
  bagLayer,
  onOpenSearch,
  onToggleBagLayer,
}: {
  analysis: OutfitAnalysis;
  bagLayer: 'front' | 'behind';
  onOpenSearch: (category: Category) => void;
  onToggleBagLayer: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-white/8 bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-serif text-[18px] font-semibold text-[#fff6f0]">Fit Diagnostics</div>
          <div className="mt-1 text-[11px] leading-relaxed text-[#a8968b]">
            Real-time feedback to elevate your look.
          </div>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-accent bg-accent/10 text-center shadow-pink-glow">
          <div>
            <div className="font-serif text-[18px] font-semibold leading-none text-white">{analysis.score}</div>
            <div className="text-[7px] uppercase tracking-[.08em] text-accent">Fit</div>
          </div>
        </div>
      </div>

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

      <div className="mt-3 flex flex-wrap gap-2">
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
  category,
  wrapperClassName,
  modeClassName,
}: {
  product: Product;
  category: Category;
  wrapperClassName: string;
  modeClassName: string;
}) {
  return (
    <div className={wrapperClassName}>
      <ProductImage
        product={product}
        category={category}
        cutout
        size="lg"
        wrapperClassName="h-full w-full"
        className={modeClassName}
        loading="lazy"
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
      quickSlot={searchParams.get('slot')}
      quickQuery={searchParams.get('query')}
      quickVibe={searchParams.get('vibe')}
      quickFrame={searchParams.get('frame')}
      quickSlots={searchParams.get('slots')}
    />
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderPageContent quickSlot={null} quickQuery={null} quickVibe={null} quickFrame={null} quickSlots={null} />}>
      <BuilderPageWithSearchParams />
    </Suspense>
  );
}
