'use client';
import { Suspense, useEffect, useState } from 'react';
import { Bookmark, ExternalLink, LoaderCircle, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mannequin } from '@/components/Mannequin';
import { SlotList } from '@/components/SlotList';
import { SearchSheet } from '@/components/SearchSheet';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { hydrateItemsFromCatalog } from '@/lib/catalog';
import {
  VIBES,
  getBudgetMaxCents,
  type GeneratorBudget,
  type GeneratorFrame,
  type VibeId,
  vibeSearchQuery,
} from '@/lib/vibes';

function BuilderPageContent({
  quickSlot,
  quickQuery,
  quickVibe,
  quickFrame,
}: {
  quickSlot: string | null;
  quickQuery: string | null;
  quickVibe: string | null;
  quickFrame: string | null;
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
  const [generatorBudget, setGeneratorBudget] = useState<GeneratorBudget>('under250');
  const [customBudgetInput, setCustomBudgetInput] = useState('');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [recentGeneratedIds, setRecentGeneratedIds] = useState<string[]>([]);
  const router = useRouter();
  const total = totalCents();
  const n = count();
  const activeVibe = VIBES.find((vibe) => vibe.id === selectedVibe) || VIBES[0];
  const generatorFrame: GeneratorFrame =
    bodyType === 'custom' ? 'androgynous' : bodyType;
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
    if (quickFrame === 'masc' || quickFrame === 'fem' || quickFrame === 'androgynous') {
      setBodyType(quickFrame);
    }
  }, [quickFrame, setBodyType]);

  function closeSearchSheet() {
    setSearchFor(null);
    if (quickSlot || quickQuery) router.replace('/');
  }

  async function runCategorySearch(category: Category, query: string): Promise<Product | null> {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, category, frame: generatorFrame, priceMax: activePriceMax }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Search failed.');
    }
    const [firstProduct] = Array.isArray(data.products) ? data.products : [];
    return firstProduct || null;
  }

  async function generateLook(mode: 'starter' | 'missing' | 'full' | 'refresh') {
    if (generatorLoading) return;
    if (generatorBudget === 'custom' && (!customBudgetCents || customBudgetCents <= 0)) {
      setStatusMessage('Enter a custom max price first.');
      return;
    }

    const targetSlots = (
      mode === 'full'
        ? CATEGORY_ORDER
        : mode === 'refresh'
        ? Array.from(new Set([...activeVibe.slots, ...CATEGORY_ORDER.filter((slot) => items[slot])]))
        : activeVibe.slots
    ).filter((slot) => mode !== 'missing' || !items[slot]);
    if (!targetSlots.length) {
      setStatusMessage('That vibe already filled all of its starter pieces. Try regenerate or switch vibes.');
      return;
    }

    setGeneratorLoading(true);
    setStatusMessage(null);

    try {
      const nextItems = { ...items };
      let addedCount = 0;
      let collectionLabel: string | null = null;
      let assistantLabel: string | null = null;

      const lookResponse = await fetch('/api/look', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vibe: selectedVibe,
          frame: generatorFrame,
          budget: generatorBudget,
          customMaxCents: customBudgetCents,
          seed: Date.now(),
          avoidProductIds: recentGeneratedIds,
          mode,
          currentItems: items,
        }),
      });
      const lookData = await lookResponse.json();

      if (lookResponse.ok && lookData.products && typeof lookData.products === 'object') {
        for (const [slot, product] of Object.entries(lookData.products) as Array<[Category, Product]>) {
          if (!product) continue;
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
              vibeSearchQuery(selectedVibe, slot, generatorBudget, generatorFrame, customBudgetCents),
            ),
          })),
        );

        for (const result of results) {
          if (result.status !== 'fulfilled' || !result.value.product) continue;
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
      setStatusMessage(
        mode === 'starter'
          ? `Generated ${addedCount} starter piece${addedCount !== 1 ? 's' : ''} for ${activeVibe.label.toLowerCase()}${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`
          : mode === 'missing'
          ? `Filled ${addedCount} missing piece${addedCount !== 1 ? 's' : ''} for ${activeVibe.label.toLowerCase()}${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`
          : mode === 'full'
          ? `Built a fuller ${activeVibe.label.toLowerCase()} fit with ${addedCount} refreshed picks${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`
          : `Refreshed ${addedCount} pieces for ${activeVibe.label.toLowerCase()}${collectionLabel ? ` using ${collectionLabel.toLowerCase()}` : ''}${assistantLabel || ''}.`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not generate a look right now.');
    } finally {
      setGeneratorLoading(false);
    }
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
        url: product.retailerUrl || product.affiliateUrl || '',
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
      <header className="flex items-center justify-between pt-11 pb-2.5 px-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent grid place-items-center text-white font-black text-lg shadow-pink-glow" style={{ fontFamily: 'Impact, sans-serif' }}>S</div>
          <div className="font-serif font-bold text-[17px]">sylistly</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] tracking-[.14em] text-muted uppercase">Your fit</div>
          <div className={`font-serif italic font-semibold text-xl mt-0.5 ${total === 0 ? 'text-muted' : 'text-ink'}`}>
            ${(total / 100).toLocaleString()}
          </div>
        </div>
        <button
          onClick={saveFit}
          disabled={n === 0}
          className={`px-3.5 py-2 rounded-full border text-xs font-medium flex items-center gap-1.5 ${
            n > 0 ? 'text-accent border-accent' : 'text-muted-2 border-hairline-2'
          }`}
        >
          <Bookmark size={12} /> Save
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-4 pb-4 pt-3.5">
          <section className="rounded-[30px] border border-hairline bg-surface-1 p-3 shadow-[0_24px_60px_rgba(0,0,0,.28)]">
            <div className="mb-3 flex items-start justify-between gap-3 px-1">
              <div>
                <div className="text-[9px] tracking-[.18em] text-muted uppercase">Styling board</div>
                <div className="mt-1 font-serif text-[22px] font-semibold text-ink">
                  Live fit <em className="italic text-accent">layout</em>
                </div>
              </div>
              <div className="rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-right">
                <div className="font-serif text-[22px] font-semibold leading-none text-ink">
                  {Math.round((n / CATEGORY_ORDER.length) * 100)}%
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-muted">
                  {n} styled
                </div>
              </div>
            </div>
            <Mannequin items={items} skinTone={skinTone} bodyType={generatorFrame} />
            <div className="mt-3 flex flex-wrap gap-2 px-1">
              <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[10px] uppercase tracking-[.14em] text-muted">
                {generatorFrame === 'masc' ? 'Menswear' : generatorFrame === 'fem' ? 'Womenswear' : 'Neutral'} bias
              </span>
              <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[10px] uppercase tracking-[.14em] text-muted">
                {activeVibe.label}
              </span>
              <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[10px] uppercase tracking-[.14em] text-muted">
                {n ? `${n} item${n !== 1 ? 's' : ''} placed` : 'No items placed'}
              </span>
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <div className="flex justify-between items-baseline px-0.5 pb-0.5">
              <div className="font-serif font-semibold text-[20px]">Outfit <em className="italic text-accent">Builder</em></div>
              <div className="text-[10px] text-muted">{n} piece{n !== 1 ? 's' : ''}</div>
            </div>
            <div className="px-0.5 text-[12px] leading-relaxed text-muted-2">
              Generate a starter fit from the free Sylistly catalog, then tap any slot to swap pieces manually.
            </div>
            <div className="rounded-[24px] border border-hairline bg-surface-1 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-muted">
                    <Sparkles size={12} className="text-accent" />
                    Outfit generator
                  </div>
                  <div className="mt-1 font-serif text-[18px] font-semibold text-ink">
                    {activeVibe.label} <em className="italic text-accent">starter look</em>
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted-2">
                    {activeVibe.blurb}. Generates the key pieces first, then you can swap anything slot by slot.
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {VIBES.map((vibe) => (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => setSelectedVibe(vibe.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                      selectedVibe === vibe.id
                        ? 'bg-accent text-white shadow-pink-glow'
                        : 'border border-hairline bg-surface-2 text-muted-2 hover:text-ink'
                    }`}
                  >
                    {vibe.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
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
                      className={`rounded-full px-3 py-1 text-[10px] font-medium transition ${
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

              <div className="mt-3 flex items-center justify-between gap-2">
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
                      className={`rounded-full px-3 py-1 text-[10px] font-medium transition ${
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

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generateLook('starter')}
                  disabled={generatorLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white disabled:opacity-60"
                >
                  {generatorLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Generate starter look
                </button>
                <button
                  type="button"
                  onClick={() => void generateLook('missing')}
                  disabled={generatorLoading}
                  className="rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink disabled:opacity-60"
                >
                  Fill missing pieces
                </button>
                <button
                  type="button"
                  onClick={() => void generateLook('refresh')}
                  disabled={generatorLoading}
                  className="rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink disabled:opacity-60"
                >
                  Refresh look
                </button>
                <button
                  type="button"
                  onClick={() => void generateLook('full')}
                  disabled={generatorLoading}
                  className="rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink disabled:opacity-60"
                >
                  Build fuller fit
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {activeVibe.slots.map((slot) => (
                  <span
                    key={slot}
                    className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[10px] uppercase tracking-[.12em] text-muted"
                  >
                    {slot}
                  </span>
                ))}
              </div>
            </div>
            <SlotList onOpenSearch={setSearchFor} />
          </section>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-hairline flex flex-col gap-2">
        {statusMessage ? (
          <div className="rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-muted-2">
            {statusMessage}
          </div>
        ) : null}
        <button
          onClick={shopAll}
          disabled={n === 0}
          className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-pink-glow disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:cursor-not-allowed hover:bg-accent-hot transition"
        >
          Shop full look {n > 0 && <span className="opacity-75 font-medium">- {n}</span>}
          <ExternalLink size={14} />
        </button>
        <button onClick={clear} className="w-full py-2.5 rounded-xl text-xs text-muted hover:text-ink transition">
          Clear fit
        </button>
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

function BuilderPageWithSearchParams() {
  const searchParams = useSearchParams();
  return (
    <BuilderPageContent
      quickSlot={searchParams.get('slot')}
      quickQuery={searchParams.get('query')}
      quickVibe={searchParams.get('vibe')}
      quickFrame={searchParams.get('frame')}
    />
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderPageContent quickSlot={null} quickQuery={null} quickVibe={null} quickFrame={null} />}>
      <BuilderPageWithSearchParams />
    </Suspense>
  );
}
