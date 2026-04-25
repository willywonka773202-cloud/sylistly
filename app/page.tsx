'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bookmark, ExternalLink, LoaderCircle, Sparkles, 
  RefreshCw, ChevronDown, Plus, X, Share2
} from 'lucide-react';
import { Mannequin } from '@/components/Mannequin';
import { SearchSheet } from '@/components/SearchSheet';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { BuilderHeader } from '@/components/BuilderHeader';
import { CategoryList } from '@/components/CategoryList';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { hydrateItemsFromCatalog } from '@/lib/catalog';
import { 
  OCCASIONS,
  type OccasionId, 
  type GeneratorBudget, type GeneratorFrame,
} from '@/lib/occasions';
import { DripMeter } from '@/components/DripMeter';
import { GenderSelector } from '@/components/GenderSelector';

const BUDGETS: { value: GeneratorBudget; label: string; max: number }[] = [
  { value: 'any', label: 'Any', max: 0 },
  { value: 'under100', label: '$100', max: 100 },
  { value: 'under250', label: '$250', max: 250 },
  { value: 'under500', label: '$500', max: 500 },
];

function BuilderPageContent({
  quickOccasion,
}: {
  quickOccasion: string | null;
}) {
  const { items, totalCents, count, clear, replaceItems } = useFit();
  const skinTone = useProfile((state) => state.profile.skinTone);
  const bodyType = useProfile((state) => state.profile.bodyType);
  const saveLocalFit = useSavedFits((state) => state.saveFit);
  const [searchFor, setSearchFor] = useState<Category | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<OccasionId>('night');
  const [generatorBudget, setGeneratorBudget] = useState<GeneratorBudget>('under250');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [showOccasionPicker, setShowOccasionPicker] = useState(false);
  const router = useRouter();

  const total = totalCents();
  const n = count();
  const activeOccasion = OCCASIONS.find((o) => o.id === selectedOccasion) || OCCASIONS[0];
  const generatorFrame: GeneratorFrame = bodyType === 'custom' ? 'androgynous' : bodyType;

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    const hydrated = hydrateItemsFromCatalog(items);
    const changed = Object.entries(hydrated).some(([slot, product]) => product !== items[slot as Category]);
    if (changed) replaceItems(hydrated);
  }, [items, replaceItems]);

  useEffect(() => {
    if (!quickOccasion) return;
    if (OCCASIONS.some((o) => o.id === quickOccasion)) {
      setSelectedOccasion(quickOccasion as OccasionId);
    }
  }, [quickOccasion]);

  async function runCategorySearch(category: Category, query: string): Promise<Product | null> {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, category }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Search failed.');
    const [firstProduct] = Array.isArray(data.products) ? data.products : [];
    return firstProduct || null;
  }

  async function generateLook() {
    if (generatorLoading) return;
    const targetSlots = activeOccasion.slots;
    if (!targetSlots.length) return;

    setGeneratorLoading(true);
    setStatusMessage(null);

    try {
      const nextItems = { ...items };
      let addedCount = 0;

      const lookResponse = await fetch('/api/look', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vibe: selectedOccasion,
          frame: generatorFrame,
          budget: generatorBudget,
          mode: 'starter',
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
      }

      if (addedCount === 0) {
        setStatusMessage('No pieces generated. Try another occasion.');
        return;
      }

      replaceItems(nextItems);
      setStatusMessage(`Generated ${addedCount} pieces for ${activeOccasion.label.toLowerCase()}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Error generating');
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
        setStatusMessage(localFit ? `Saved locally` : 'Save unavailable');
        return;
      }
      if (d.id) {
        setStatusMessage(localFit ? `Saved locally & synced` : 'Fit saved');
      }
    } catch {
      setStatusMessage(localFit ? 'Saved locally' : 'Save failed');
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
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));

    if (!links.length) {
      setStatusMessage('Add pieces first');
      return;
    }
    setCheckoutProducts(links);
  }

  function handleSlotClick(slot: Category) {
    setSearchFor(slot);
  }

  function handleRemoveSlot(slot: Category) {
    replaceItems({ ...items, [slot]: undefined });
  }

  return (
    <main className="flex flex-col h-[100dvh] max-w-[440px] mx-auto bg-bg overflow-hidden">
      <BuilderHeader 
        itemCount={n} 
        totalAmount={total} 
        onSave={saveFit} 
      />

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <AnimatePresence mode="wait">
          {n === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8"
            >
              <div className="rounded-2xl bg-surface-2 border border-hairline p-6 text-center">
                <Sparkles className="w-10 h-10 text-accent mx-auto mb-3" />
                <div className="font-serif text-xl font-semibold">
                  Build Your <span className="text-accent italic">Vibe</span>
                </div>
                <p className="text-sm text-muted mt-2">Select occasion & generate</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="filled"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4"
            >
              <div className="flex gap-4 items-start">
                <Mannequin items={items} skinTone={skinTone} bodyType={generatorFrame} />
                <CategoryList 
                  items={items} 
                  onSlotClick={handleSlotClick} 
                  onRemoveSlot={handleRemoveSlot} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DripMeter items={items} />

        <div className="space-y-3 mt-4">
          <button
            onClick={() => setShowOccasionPicker(!showOccasionPicker)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-hairline"
          >
            <div className="flex items-center gap-2">
              <activeOccasion.icon className="w-5 h-5 text-accent" />
              <span className="font-semibold">{activeOccasion.label}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted transition ${showOccasionPicker ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showOccasionPicker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="grid grid-cols-4 gap-2"
              >
                {OCCASIONS.map((occasion) => (
                  <button
                    key={occasion.id}
                    onClick={() => { setSelectedOccasion(occasion.id); setShowOccasionPicker(false); }}
                    className={`p-2 rounded-xl border text-center ${
                      selectedOccasion === occasion.id
                        ? 'bg-accent border-accent text-white'
                        : 'bg-surface-2 border-hairline text-muted'
                    }`}
                  >
                    <occasion.icon className="w-5 h-5 mx-auto" />
                    <span className="text-[10px] block mt-1">{occasion.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <button
              onClick={generateLook}
              disabled={generatorLoading}
              className="flex-1 py-3 rounded-xl bg-accent text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              {generatorLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generate
            </button>
            <button
              onClick={clear}
              disabled={n === 0}
              className="px-4 py-3 rounded-xl bg-surface-2 border border-hairline text-muted"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {BUDGETS.map((budget) => (
              <button
                key={budget.value}
                onClick={() => setGeneratorBudget(budget.value)}
                className={`py-2 rounded-lg text-xs font-medium ${
                  generatorBudget === budget.value
                    ? 'bg-white text-black'
                    : 'bg-surface-2 text-muted border border-hairline'
                }`}
              >
                {budget.label}
              </button>
            ))}
          </div>

          <GenderSelector />
        </div>

        <div className="mt-4 pt-4 border-t border-hairline">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3">Quick add</div>
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => handleSlotClick(cat)}
                className="shrink-0 w-20 h-20 rounded-xl border border-hairline flex flex-col items-center justify-center gap-1 bg-surface-2 hover:border-accent/50 transition-colors"
              >
                <span className="text-lg text-accent">+</span>
                <span className="text-[10px] text-muted capitalize">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[68px] left-0 right-0 p-4 bg-gradient-to-t from-bg via-bg to-transparent">
        {statusMessage && (
          <div className="mb-2 text-center text-xs text-muted">{statusMessage}</div>
        )}
        <button
          onClick={shopAll}
          disabled={n === 0}
          className="w-full py-3.5 rounded-xl bg-emerald text-bg font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          Shop full look ({n}) <ExternalLink size={16} />
        </button>
      </div>

      <BottomNav />
      <SearchSheet open={!!searchFor} category={searchFor} onClose={() => setSearchFor(null)} />
      <CheckoutSheet open={Boolean(checkoutProducts)} title="Your fit" products={checkoutProducts || []} onClose={() => setCheckoutProducts(null)} />
    </main>
  );
}

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <BuilderPageContent quickOccasion={null} />;
}