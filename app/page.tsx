'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bookmark, ExternalLink, LoaderCircle, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mannequin, type FitVariant } from '@/components/Mannequin';
import { SlotList } from '@/components/SlotList';
import { SearchSheet } from '@/components/SearchSheet';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { hydrateItemsFromCatalog } from '@/lib/catalog';
import { getProductOutboundUrl } from '@/lib/product-links';
import { proxiedImageUrl } from '@/lib/image-url';
import { filterRenderableProducts, hasUsableProductImage, isRenderableProduct } from '@/lib/product-image-quality';
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
  const { items, totalCents, count, clear, replaceItems } = useFit();
  const skinTone = useProfile((state) => state.profile.skinTone);
  const bodyType = useProfile((state) => state.profile.bodyType);
  const setBodyType = useProfile((state) => state.setBodyType);
  const saveLocalFit = useSavedFits((state) => state.saveFit);
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
  const router = useRouter();
  const total = totalCents();
  const n = count();
  const activeVibe = VIBES.find((vibe) => vibe.id === selectedVibe) || VIBES[0];
  const generatorFrame: GeneratorFrame =
    bodyType === 'custom' ? 'androgynous' : bodyType;
  const analysis = useMemo(() => analyzeOutfit(items, activeVibe.label), [items, activeVibe.label]);
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

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

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
    if (quickSlot || quickQuery) router.replace('/');
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
    ).filter((slot) => mode !== 'missing' || !items[slot]);
    if (!targetSlots.length) {
      setStatusMessage('That vibe already filled all of its starter pieces. Try regenerate or switch vibes.');
      return;
    }

    setGeneratorLoading(true);
    setStatusMessage(null);

    try {
      const nextItems: Partial<Record<Category, Product>> = mode === 'missing' ? { ...items } : {};
      let addedCount = 0;
      let collectionLabel: string | null = null;
      let assistantLabel: string | null = null;
      const currentProductIds = Object.values(items)
        .filter((product): product is Product => Boolean(product))
        .map((product) => product.id);

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
          targetSlots,
        }),
      });
      const lookData = await lookResponse.json();

      if (lookResponse.ok && lookData.products && typeof lookData.products === 'object') {
        for (const [slot, product] of Object.entries(lookData.products) as Array<[Category, Product]>) {
          if (!targetSlots.includes(slot)) continue;
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
          disabled={n === 0}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold ${
            n > 0 ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-hairline-2 text-muted-2'
          }`}
        >
          <Bookmark size={12} /> Save fit
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pb-56 pt-2">
          <section className="flex flex-col gap-3">
            <Mannequin
              items={items}
              skinTone={skinTone}
              bodyType={generatorFrame}
              vibeLabel={activeVibe.label}
              vibeBlurb={activeVibe.blurb}
              selectedGenerationSlots={selectedGenerationSlots}
              onToggleGenerationSlot={toggleGenerationSlot}
            />
            <div className="border-t border-hairline px-1 pt-4 text-center">
              <div className="text-[12px] font-medium text-muted-2">
                Tap slots to include in next generation
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[.16em] text-muted">
                Selected {selectedGenerationSlots.length} of {CATEGORY_ORDER.length} categories
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedGenerationSlots(defaultGenerationSlotsForVibe(selectedVibe))}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#f2e7df] transition hover:border-accent hover:text-ink"
                >
                  Use vibe defaults
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGenerationSlots(CATEGORY_ORDER)}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#f2e7df] transition hover:border-accent hover:text-ink"
                >
                  Select all
                </button>
              </div>
              <button
                type="button"
                onClick={() => void generateLook('full', { sourceLabel: 'Selected slots.' })}
                disabled={generatorLoading || selectedGenerationSlots.length === 0}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-4 text-[12px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow transition hover:bg-accent-hot disabled:opacity-60"
              >
                {generatorLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Build selected fit
              </button>
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))] p-5 shadow-[0_24px_56px_rgba(0,0,0,.24)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-muted">
                    <Sparkles size={12} className="text-accent" />
                    Outfit generator
                  </div>
                  <div className="mt-2 font-serif text-[25px] font-semibold leading-[1.04] text-ink">
                    {activeVibe.label} <em className="italic text-accent">starter look</em>
                  </div>
                  <div className="mt-2 text-[13px] leading-relaxed text-muted-2">
                    {activeVibe.blurb}. Generates the key pieces first, then you can swap anything slot by slot.
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-right">
                  <div className="text-[9px] uppercase tracking-[.18em] text-muted">
                    {generatorLoading ? EDITORIAL_LOADING_LINES[loadingPhraseIndex] : 'AI pass - ready'}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {VIBES.map((vibe) => (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => setSelectedVibe(vibe.id)}
                    className={`rounded-full px-3.5 py-2 text-[11px] font-semibold transition ${
                      selectedVibe === vibe.id
                        ? 'bg-accent text-white shadow-pink-glow'
                        : 'border border-hairline bg-surface-2 text-muted-2 hover:text-ink'
                    }`}
                  >
                    {vibe.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[.14em] text-muted">Budget</div>
                <div className="flex flex-wrap justify-end gap-2">
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
                      className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
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
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[.14em] text-muted">Custom max</div>
                  <label className="flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-[11px] text-ink">
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
                  </label>
                </div>
              ) : null}

                {generatorBudget === 'custom' ? (
                <div className="mt-2 text-[11px] text-muted-2">
                  {customBudgetInput
                    ? `Generating pieces at or below $${customBudgetInput} each.`
                    : 'Set a per-item max price for generated pieces.'}
                </div>
              ) : null}

              {generatorLoading ? (
                <div className="mt-3 rounded-[18px] border border-accent/20 bg-accent/10 px-3 py-2 text-[11px] text-[#ffe7ee]">
                  {EDITORIAL_LOADING_LINES[loadingPhraseIndex]}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[.14em] text-muted">Style frame</div>
                <div className="flex flex-wrap justify-end gap-2">
                  {[
                    { value: 'masc', label: 'Male' },
                    { value: 'fem', label: 'Female' },
                    { value: 'androgynous', label: 'Neutral' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBodyType(option.value as 'masc' | 'fem' | 'androgynous')}
                      className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
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

              <div className="mt-6 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => void generateLook('starter')}
                  disabled={generatorLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-4 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow disabled:opacity-60"
                >
                  {generatorLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Generate starter look
                </button>
                <button
                  type="button"
                  onClick={() => void generateLook('missing')}
                  disabled={generatorLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/70 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-ink transition hover:bg-accent/10 disabled:opacity-60"
                >
                  <Sparkles size={13} />
                  Fill missing pieces
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void generateLook('refresh')}
                  disabled={generatorLoading}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink disabled:opacity-60"
                >
                  Refresh look
                </button>
                <button
                  type="button"
                  onClick={() => void generateLook('full')}
                  disabled={generatorLoading}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink disabled:opacity-60"
                >
                  Build fuller fit
                </button>
              </div>
            </div>
            <div className="rounded-[30px] border border-hairline bg-surface-1 p-5 shadow-[0_18px_42px_rgba(0,0,0,.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[.18em] text-muted">Item tray</div>
                  <div className="mt-1 font-serif text-[18px] font-semibold text-ink">
                    Swap and refine <em className="italic text-accent">slot by slot</em>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-[.16em] text-muted">{CATEGORY_ORDER.length} zones</div>
              </div>
              <div className="mt-3">
                <SlotList onOpenSearch={setSearchFor} />
              </div>
            </div>
            <SelectedPiecesPanel
              analysis={analysis}
              items={items}
              onOpenSearch={setSearchFor}
            />
            <FitDiagnosticsPanel
              analysis={analysis}
              bagLayer={bagLayer}
              onOpenSearch={setSearchFor}
              onToggleBagLayer={() => setBagLayer((value) => (value === 'front' ? 'behind' : 'front'))}
            />
            <div className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-[24px] border border-white/10 bg-bg/90 p-2 shadow-[0_18px_44px_rgba(0,0,0,.42)] backdrop-blur">
              {statusMessage ? (
                <div className="rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-muted-2">
                  {statusMessage}
                </div>
              ) : null}
              <button
                onClick={shopAll}
                disabled={n === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-accent py-3.5 text-sm font-semibold text-white shadow-pink-glow transition hover:bg-accent-hot disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:shadow-none"
              >
                Shop full look {n > 0 && <span className="opacity-75 font-medium">- {n}</span>}
                <ExternalLink size={14} />
              </button>
              <button onClick={clear} className="w-full rounded-xl py-1.5 text-xs text-muted transition hover:text-ink">
                Clear fit
              </button>
            </div>
          </section>
        </div>
      </div>

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
  const [imageMode, setImageMode] = useState<'cutout' | 'plain' | 'hidden'>(() =>
    hasUsableProductImage(product) ? 'cutout' : 'hidden',
  );

  const src =
    imageMode === 'hidden' || !hasUsableProductImage(product)
      ? ''
      : imageMode === 'cutout'
      ? proxiedImageUrl(product.imageUrl, { cutout: true, category })
      : proxiedImageUrl(product.imageUrl);

  useEffect(() => {
    setImageMode(hasUsableProductImage(product) ? 'cutout' : 'hidden');
  }, [product.id, product.imageUrl]);

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
        onError={() => setImageMode((current) => (current === 'cutout' ? 'plain' : 'hidden'))}
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

function overlayFallback(label: string): string {
  const safeLabel = label.slice(0, 10).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 220">
      <rect width="180" height="220" rx="24" fill="#ffffff" />
      <rect x="10" y="10" width="160" height="200" rx="20" fill="#f4ebe4" />
      <circle cx="90" cy="80" r="34" fill="#e8365d" opacity="0.12" />
      <rect x="46" y="128" width="88" height="12" rx="6" fill="#cdb9ad" />
      <text x="90" y="170" text-anchor="middle" fill="#5d4a42" font-family="Arial, sans-serif" font-size="16" font-weight="700">${safeLabel}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
