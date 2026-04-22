'use client';
import { Suspense, useEffect, useState } from 'react';
import { Bookmark, ExternalLink, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mannequin } from '@/components/Mannequin';
import { SlotList } from '@/components/SlotList';
import { SearchSheet } from '@/components/SearchSheet';
import { BottomNav } from '@/components/BottomNav';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { VIBES, type GeneratorBudget, type VibeId, vibeSearchQuery } from '@/lib/vibes';

interface ShopLink {
  id: string;
  brand: string;
  name: string;
  retailer: string;
  url: string;
}

function BuilderPageContent({
  quickSlot,
  quickQuery,
}: {
  quickSlot: string | null;
  quickQuery: string | null;
}) {
  const { items, totalCents, count, clear, replaceItems } = useFit();
  const skinTone = useProfile((state) => state.profile.skinTone);
  const saveLocalFit = useSavedFits((state) => state.saveFit);
  const [searchFor, setSearchFor] = useState<Category | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shopLinks, setShopLinks] = useState<ShopLink[] | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<VibeId>('clean');
  const [generatorBudget, setGeneratorBudget] = useState<GeneratorBudget>('under250');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const router = useRouter();
  const total = totalCents();
  const n = count();
  const activeVibe = VIBES.find((vibe) => vibe.id === selectedVibe) || VIBES[0];

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    if (!quickSlot || !CATEGORY_ORDER.includes(quickSlot as Category)) return;
    setSearchFor(quickSlot as Category);
  }, [quickSlot]);

  function closeSearchSheet() {
    setSearchFor(null);
    if (quickSlot || quickQuery) router.replace('/');
  }

  async function runCategorySearch(category: Category, query: string): Promise<Product | null> {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, category }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Search failed.');
    }
    const [firstProduct] = Array.isArray(data.products) ? data.products : [];
    return firstProduct || null;
  }

  async function generateLook(mode: 'starter' | 'missing') {
    if (generatorLoading) return;

    const targetSlots = activeVibe.slots.filter((slot) => mode === 'starter' || !items[slot]);
    if (!targetSlots.length) {
      setStatusMessage('That vibe already filled all of its starter pieces. Try regenerate or switch vibes.');
      return;
    }

    setGeneratorLoading(true);
    setStatusMessage(null);

    try {
      const results = await Promise.allSettled(
        targetSlots.map(async (slot) => ({
          slot,
          product: await runCategorySearch(slot, vibeSearchQuery(selectedVibe, slot, generatorBudget)),
        })),
      );

      const nextItems = { ...items };
      let addedCount = 0;

      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value.product) continue;
        nextItems[result.value.slot] = result.value.product;
        addedCount += 1;
      }

      if (!addedCount) {
        setStatusMessage('No strong starter pieces came back for that vibe. Try another vibe or search a slot manually.');
        return;
      }

      replaceItems(nextItems);
      setStatusMessage(
        mode === 'starter'
          ? `Generated ${addedCount} starter piece${addedCount !== 1 ? 's' : ''} for ${activeVibe.label.toLowerCase()}.`
          : `Filled ${addedCount} missing piece${addedCount !== 1 ? 's' : ''} for ${activeVibe.label.toLowerCase()}.`,
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
        url: product.affiliateUrl || product.retailerUrl,
      }))
      .filter((product) => Boolean(product.url));

    if (!links.length) {
      setStatusMessage('Pick products first, then shop the look.');
      return;
    }

    setStatusMessage(null);
    setShopLinks(links);
  }

  return (
    <main className="flex flex-col h-[100dvh] max-w-[440px] mx-auto bg-bg">
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
        <div className="grid grid-cols-[162px_1fr] gap-3 px-4 pt-3.5">
          <div className="flex flex-col items-center gap-2.5">
            <div className="text-[9px] tracking-[.18em] text-muted uppercase">Your Fit</div>
            <Mannequin items={items} skinTone={skinTone} />
            <div className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[10px] uppercase tracking-[.14em] text-muted">
              Skin tone synced from profile
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline px-0.5 pb-0.5">
              <div className="font-serif font-semibold text-[17px]">Outfit <em className="italic text-accent">Builder</em></div>
              <div className="text-[10px] text-muted">{n} piece{n !== 1 ? 's' : ''}</div>
            </div>
            <div className="px-0.5 text-[11px] leading-relaxed text-muted-2">
              Pick a vibe to generate a starter fit, or tap any slot to search it manually. Saved fits still stay on this device.
            </div>
            <div className="rounded-[22px] border border-hairline bg-surface-1 p-3">
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
          </div>
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
          Shop full look {n > 0 && <span className="opacity-75 font-medium">· {n}</span>}
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
        onClose={closeSearchSheet}
      />

      {shopLinks ? (
        <>
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShopLinks(null)} />
          <div className="absolute inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-3xl border-t border-hairline-2 bg-surface-1 px-4 pb-6 pt-3">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between pb-3 pt-2">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-muted">Shop links</div>
                <div className="mt-1 font-serif text-lg font-semibold text-ink">
                  Open each <em className="italic text-accent">item</em>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShopLinks(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-muted-2"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {shopLinks.map((link) => (
                <div key={link.id} className="rounded-2xl border border-hairline bg-surface-2 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-[.14em] text-muted-2">{link.brand}</div>
                  <div className="mt-1 text-[13px] leading-tight text-ink">{link.name}</div>
                  <div className="mt-2 text-[10px] uppercase tracking-[.12em] text-muted">{link.retailer}</div>
                  <button
                    type="button"
                    onClick={() => window.location.assign(link.url)}
                    className="mt-3 inline-flex rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-medium text-accent transition hover:bg-accent hover:text-white"
                  >
                    Open item
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}

function BuilderPageWithSearchParams() {
  const searchParams = useSearchParams();
  return (
    <BuilderPageContent
      quickSlot={searchParams.get('slot')}
      quickQuery={searchParams.get('query')}
    />
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderPageContent quickSlot={null} quickQuery={null} />}>
      <BuilderPageWithSearchParams />
    </Suspense>
  );
}
