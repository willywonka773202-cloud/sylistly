'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bookmark, ExternalLink, LoaderCircle, Sparkles, X, 
  Flame, Zap, Shield, Crown, Heart, Share2, RefreshCw, ChevronDown, TrendingUp
} from 'lucide-react';
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
  OCCASIONS, STYLE_SCORES,
  type OccasionId, type StyleScoreType,
  type GeneratorBudget, type GeneratorFrame,
} from '@/lib/occasions';

const GENERATOR_BUDGETS: { value: GeneratorBudget; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'under100', label: 'Under $100' },
  { value: 'under250', label: 'Under $250' },
  { value: 'under500', label: 'Under $500' },
];

const STYLE_FRAMES: { value: GeneratorFrame; label: string; icon: React.ElementType }[] = [
  { value: 'masc', label: 'Masculine', icon: Shield },
  { value: 'fem', label: 'Feminine', icon: Heart },
  { value: 'androgynous', label: 'Neutral', icon: Zap },
];

function calculateStyleScore(items: Partial<Record<Category, Product>>): Record<StyleScoreType, number> {
  const count = Object.keys(items).filter(Boolean).length;
  if (count === 0) return { ...STYLE_SCORES, ...{ confidence: 0, trendiness: 0, balance: 0 }};

  const hasOuter = Boolean(items.outer);
  const hasTop = Boolean(items.top);
  const hasBottom = Boolean(items.bottom);
  const hasShoes = Boolean(items.shoes);
  const total = Object.values(items).filter(Boolean).length;

  const completeness = Math.min(100, Math.round((total / 4) * 100));
  const hasAccessories = Boolean(items.bag || items.jewelry || items.hat || items.eyewear);
  
  return {
    completeness,
    confidence: completeness > 50 && hasTop && hasBottom ? 85 + Math.random() * 15 : Math.round(completeness * 0.8),
    trendiness: 70 + Math.random() * 30,
    balance: hasOuter ? 80 : hasTop && hasBottom ? 75 : 50,
    attractiveness: hasAccessories ? 85 + Math.random() * 15 : 60 + Math.random() * 25,
    rarity: 60 + Math.random() * 30,
  };
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Exceptional', color: 'text-crown' };
  if (score >= 75) return { label: 'Strong', color: 'text-emerald' };
  if (score >= 60) return { label: 'Solid', color: 'text-blue-400' };
  if (score >= 40) return { label: 'Developing', color: 'text-amber-400' };
  return { label: 'Starting', color: 'text-muted' };
}

function BuilderPageContent({
  quickSlot,
  quickQuery,
  quickOccasion,
  quickFrame,
}: {
  quickSlot: string | null;
  quickQuery: string | null;
  quickOccasion: string | null;
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
  const [selectedOccasion, setSelectedOccasion] = useState<OccasionId>('night');
  const [generatorBudget, setGeneratorBudget] = useState<GeneratorBudget>('under250');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [showOccasionPicker, setShowOccasionPicker] = useState(false);
  const router = useRouter();
  const total = totalCents();
  const n = count();
  const activeOccasion = OCCASIONS.find((o) => o.id === selectedOccasion) || OCCASIONS[0];
  const generatorFrame: GeneratorFrame = bodyType === 'custom' ? 'androgynous' : bodyType;
  const styleScores = calculateStyleScore(items);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    const hydrated = hydrateItemsFromCatalog(items);
    const changed = Object.entries(hydrated).some(([slot, product]) => product !== items[slot as Category]);
    if (changed) replaceItems(hydrated);
  }, [items, replaceItems]);

  useEffect(() => {
    if (!quickSlot || !CATEGORY_ORDER.includes(quickSlot as Category)) return;
    setSearchFor(quickSlot as Category);
  }, [quickSlot]);

  useEffect(() => {
    if (!quickOccasion) return;
    if (OCCASIONS.some((o) => o.id === quickOccasion)) {
      setSelectedOccasion(quickOccasion as OccasionId);
    }
  }, [quickOccasion]);

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
      body: JSON.stringify({ query, category }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Search failed.');
    const [firstProduct] = Array.isArray(data.products) ? data.products : [];
    return firstProduct || null;
  }

  async function generateLook(mode: 'starter' | 'missing') {
    if (generatorLoading) return;
    const targetSlots = activeOccasion.slots.filter((slot) => mode === 'starter' || !items[slot]);
    if (!targetSlots.length) {
      setStatusMessage('All slots filled for this vibe. Switch occasions or generate fresh.');
      return;
    }

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
      }

      const unresolvedSlots = targetSlots.filter((slot) => !nextItems[slot]);
      if (unresolvedSlots.length) {
        const results = await Promise.allSettled(
          unresolvedSlots.map(async (slot) => ({
            slot,
            product: await runCategorySearch(slot, `${activeOccasion.label} ${slot}`),
          })),
        );
        for (const result of results) {
          if (result.status !== 'fulfilled' || !result.value.product) continue;
          nextItems[result.value.slot] = result.value.product;
          addedCount += 1;
        }
      }

      if (!addedCount) {
        setStatusMessage('No pieces generated. Try another occasion or search manually.');
        return;
      }

      replaceItems(nextItems);
      setStatusMessage(
        mode === 'starter'
          ? `Generated ${addedCount} piece${addedCount !== 1 ? 's' : ''} for ${activeOccasion.label.toLowerCase()} vibes.`
          : `Filled ${addedCount} missing piece${addedCount !== 1 ? 's' : ''}.`
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not generate look right now.');
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
            : 'Save is not wired all the way yet.'
        );
        return;
      }
      if (d.id) {
        setStatusMessage(localFit ? `Saved "${localFit.title}" and synced.` : `Saved fit ${d.id.slice(0, 8)}.`);
      }
    } catch {
      setStatusMessage(localFit ? `Saved locally as "${localFit.title}".` : 'Could not save right now.');
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
      setStatusMessage('Pick products first, then shop the look.');
      return;
    }

    setStatusMessage(null);
    setCheckoutProducts(links);
  }

  return (
    <main className="flex flex-col h-[100dvh] max-w-[440px] mx-auto bg-bg overflow-hidden">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-4 pb-3"
      >
        <div className="flex items-center gap-3">
          <motion.div 
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-hot grid place-items-center shadow-pink-glow"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="text-white w-5 h-5" />
          </motion.div>
          <div>
            <div className="font-serif font-bold text-lg tracking-tight">sylistly</div>
            <div className="text-[9px] tracking-widest text-muted uppercase">Build Your Vibe</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {n > 0 ? (
            <motion.div 
              key="has-items"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-3"
            >
              <div className="text-right">
                <div className="text-[9px] tracking-[.1em] text-muted uppercase">Total</div>
                <div className="font-serif italic font-semibold text-xl text-emerald">
                  ${(total / 100).toLocaleString()}
                </div>
              </div>
              <motion.button
                onClick={saveFit}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2.5 rounded-full bg-surface-2 border border-hairline"
              >
                <Bookmark size={16} className="text-accent" />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="no-items"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-right"
            >
              <div className="text-[9px] tracking-[.1em] text-muted uppercase">Create</div>
              <div className="font-serif italic font-semibold text-xl text-muted">Start below</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <AnimatePresence mode="wait">
          {n === 0 ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="py-8"
            >
              <div className="rounded-3xl bg-gradient-to-b from-surface-1 to-surface-2 border border-hairline p-6 text-center">
                <motion.div 
                  className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Sparkles className="w-10 h-10 text-accent" />
                </motion.div>
                <div className="font-serif text-2xl font-semibold mb-2">
                  Ready to <span className="text-accent italic">slay</span>?
                </div>
                <div className="text-muted text-sm leading-relaxed mb-5">
                  Generate looks built for compliments.<br />
                  Pick an occasion below and let AI style you.
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mannequin-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4"
            >
              <div className="flex items-start gap-4">
                <Mannequin items={items} skinTone={skinTone} bodyType={generatorFrame} />
                <div className="flex-1 space-y-3">
                  <div className="rounded-2xl bg-surface-1 border border-hairline p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-widest text-muted">Style Score</div>
                      <div className="text-[10px] text-muted">{n} pieces</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['confidence', 'attractiveness', 'trendiness', 'balance'] as StyleScoreType[]).map((metric) => (
                        <div key={metric} className="flex items-center justify-between">
                          <span className="text-[9px] text-muted capitalize">{metric}</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                              <motion.div 
                                className={`h-full rounded-full ${getScoreLabel(styleScores[metric]).color.replace('text-', 'bg-')}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${styleScores[metric]}%` }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                              />
                            </div>
                            <span className={`text-[10px] font-semibold ${getScoreLabel(styleScores[metric]).color}`}>
                              {Math.round(styleScores[metric])}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {STYLE_FRAMES.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setBodyType(value as 'masc' | 'fem' | 'androgynous')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-medium transition ${
                          generatorFrame === value
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface-1 border-hairline text-muted'
                        }`}
                      >
                        <Icon size={12} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layout className="space-y-4">
          <motion.div 
            layout
            className="rounded-2xl bg-surface-1 border border-hairline overflow-hidden"
          >
            <button
              onClick={() => setShowOccasionPicker(!showOccasionPicker)}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                  <activeOccasion.icon className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-widest text-muted">Occasion</div>
                  <div className="font-semibold text-base">{activeOccasion.label}</div>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-muted transition-transform ${showOccasionPicker ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showOccasionPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    {OCCASIONS.map((occasion) => (
                      <button
                        key={occasion.id}
                        onClick={() => { setSelectedOccasion(occasion.id); setShowOccasionPicker(false); }}
                        className={`flex items-center gap-2 p-3 rounded-xl border transition ${
                          selectedOccasion === occasion.id
                            ? 'bg-accent/10 border-accent text-ink'
                            : 'bg-surface-2 border-hairline text-muted hover:border-hairline-2'
                        }`}
                      >
                        <occasion.icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{occasion.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div 
            layout
            className="rounded-2xl bg-surface-1 border border-hairline p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-[10px] uppercase tracking-widest text-muted">Generator</span>
              </div>
              <div className="text-[11px] text-muted-2">{activeOccasion.slots.length} slots</div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {activeOccasion.slots.map((slot) => (
                <span
                  key={slot}
                  className="px-2.5 py-1 rounded-full bg-surface-2 text-[9px] uppercase tracking-wider text-muted"
                >
                  {slot}
                </span>
              ))}
            </div>

            <div className="mb-4">
              <div className="text-[9px] uppercase tracking-widest text-muted mb-2">Budget</div>
              <div className="flex gap-1.5 flex-wrap">
                {GENERATOR_BUDGETS.map((budget) => (
                  <button
                    key={budget.value}
                    onClick={() => setGeneratorBudget(budget.value)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition ${
                      generatorBudget === budget.value
                        ? 'bg-ink text-bg'
                        : 'bg-surface-2 text-muted border border-hairline'
                    }`}
                  >
                    {budget.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                onClick={() => void generateLook('starter')}
                disabled={generatorLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-accent to-accent-hot text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-pink-glow"
              >
                {generatorLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Zap size={14} />}
                Generate
              </motion.button>
              <motion.button
                onClick={() => void generateLook('missing')}
                disabled={generatorLoading || n === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-3 rounded-xl bg-surface-2 text-muted text-xs font-medium border border-hairline flex items-center gap-2"
              >
                <RefreshCw size={14} />
              </motion.button>
            </div>
          </motion.div>

          <SlotList onOpenSearch={setSearchFor} />
        </motion.div>
      </div>

      <motion.div 
        layout
        className="absolute bottom-[68px] left-0 right-0 p-4 bg-gradient-to-t from-bg via-bg to-transparent"
      >
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 rounded-xl bg-surface-1 border border-hairline px-4 py-3 text-center text-xs text-muted"
          >
            {statusMessage}
          </motion.div>
        )}
        <div className="flex gap-2">
          <motion.button
            onClick={shopAll}
            disabled={n === 0}
            whileHover={{ scale: n === 0 ? 1 : 1.02 }}
            whileTap={{ scale: n === 0 ? 1 : 0.98 }}
            className="flex-1 py-3.5 rounded-xl bg-emerald text-bg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Shop full look <ExternalLink size={14} />
          </motion.button>
          {n > 0 && (
            <motion.button
              onClick={clear}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-3.5 rounded-xl bg-surface-2 border border-hairline text-muted text-sm"
            >
              Clear
            </motion.button>
          )}
        </div>
      </motion.div>

      <BottomNav />

      <SearchSheet
        open={!!searchFor}
        category={searchFor}
        initialQuery={searchFor ? quickQuery : null}
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
      quickOccasion={searchParams.get('occasion')}
      quickFrame={searchParams.get('frame')}
    />
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderPageContent quickSlot={null} quickQuery={null} quickOccasion={null} quickFrame={null} />}>
      <BuilderPageWithSearchParams />
    </Suspense>
  );
}