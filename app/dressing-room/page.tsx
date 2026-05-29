'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, ExternalLink, LoaderCircle, Sparkles, RefreshCw, ChevronDown, Plus, X } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { Mannequin } from '@/components/Mannequin';
import { SearchSheet } from '@/components/SearchSheet';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { DripMeter } from '@/components/DripMeter';
import { GenderSelector } from '@/components/GenderSelector';
import { PremiumButton } from '@/components/Primitives';
import { successToast } from '@/components/Toast';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { CATEGORY_ORDER, CATEGORY_LABELS, type Category, type Product } from '@/lib/types';
import { hydrateItemsFromCatalog } from '@/lib/catalog';
import { OCCASIONS, type OccasionId, type GeneratorBudget, type GeneratorFrame } from '@/lib/occasions';

const BUDGETS: { value: GeneratorBudget; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'under100', label: '$100' },
  { value: 'under250', label: '$250' },
  { value: 'under500', label: '$500' },
];

export default function DressingRoomPage() {
  const { items, totalCents, count, clear, replaceItems } = useFit();
  const skinTone = useProfile((state) => state.profile.skinTone);
  const bodyType = useProfile((state) => state.profile.bodyType);
  const saveLocalFit = useSavedFits((state) => state.saveFit);
  const [searchFor, setSearchFor] = useState<Category | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<OccasionId>('night');
  const [generatorBudget, setGeneratorBudget] = useState<GeneratorBudget>('under250');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [showOccasionPicker, setShowOccasionPicker] = useState(false);

  const total = totalCents();
  const n = count();
  const activeOccasion = OCCASIONS.find((o) => o.id === selectedOccasion) || OCCASIONS[0];
  const generatorFrame: GeneratorFrame = bodyType === 'custom' ? 'androgynous' : bodyType;

  useEffect(() => {
    const hydrated = hydrateItemsFromCatalog(items);
    const changed = Object.entries(hydrated).some(([slot, product]) => product !== items[slot as Category]);
    if (changed) replaceItems(hydrated);
  }, [items, replaceItems]);

  async function generateLook() {
    if (generatorLoading) return;
    setGeneratorLoading(true);
    try {
      const res = await fetch('/api/look', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vibe: selectedOccasion, frame: generatorFrame, budget: generatorBudget, mode: 'starter', currentItems: items }),
      });
      const data = await res.json();
      if (res.ok && data.products && typeof data.products === 'object') {
        const next = { ...items };
        let added = 0;
        for (const [slot, product] of Object.entries(data.products) as Array<[Category, Product]>) {
          if (!product) continue;
          next[slot] = product;
          added += 1;
        }
        if (added) {
          replaceItems(next);
          successToast(`Generated ${added} pieces for ${activeOccasion.label.toLowerCase()}`);
        } else successToast('No pieces generated. Try another occasion.');
      } else successToast('Generator unavailable right now.');
    } catch {
      successToast('Error generating look.');
    } finally {
      setGeneratorLoading(false);
    }
  }

  function saveFit() {
    if (!n) return;
    const localFit = saveLocalFit(items);
    successToast(localFit ? 'Saved to your looks' : 'Nothing to save');
  }

  function shopAll() {
    if (!n) return;
    const links = Object.values(items)
      .filter((p): p is Product => Boolean(p))
      .map((p) => ({ id: p.id, brand: p.brand, name: p.name, retailer: p.retailer, url: p.affiliateUrl || p.retailerUrl, priceCents: p.priceCents }))
      .filter((p) => Boolean(p.url));
    if (!links.length) {
      successToast('Add pieces first');
      return;
    }
    setCheckoutProducts(links);
  }

  return (
    <AppShell
      showTabBar={false}
      pad={false}
      header={
        <AppHeader
          title="Dressing Room"
          kicker="Shop a full look"
          back
          right={
            <button onClick={saveFit} disabled={n === 0} className={`grid place-items-center w-10 h-10 rounded-full border ${n > 0 ? 'bg-ink text-cream border-ink' : 'bg-surface-1 text-muted border-hairline'}`} aria-label="Save">
              <Bookmark size={17} />
            </button>
          }
        />
      }
    >
      <div className="px-5 pt-3 pb-40">
        {/* mannequin + slots */}
        <div className="rounded-3xl bg-surface-1 border border-hairline p-4">
          {n === 0 ? (
            <div className="text-center py-6">
              <Sparkles className="w-9 h-9 text-accent mx-auto mb-2" />
              <div className="font-display text-xl text-ink">Build a full look</div>
              <p className="text-sm text-muted mt-1">Pick an occasion and generate a shoppable outfit.</p>
            </div>
          ) : (
            <div className="flex gap-4 items-start">
              <Mannequin items={items} skinTone={skinTone} bodyType={generatorFrame} />
              <div className="flex-1 space-y-1.5">
                {CATEGORY_ORDER.map((cat) => {
                  const product = items[cat];
                  return (
                    <button key={cat} onClick={() => setSearchFor(cat)} className={`w-full h-10 rounded-xl border flex items-center justify-between px-2.5 transition-colors ${product ? 'bg-surface-2 border-hairline-2' : 'bg-surface-1 border-hairline'}`}>
                      {product ? (
                        <>
                          <span className="flex items-center gap-2 min-w-0">
                            <img src={product.imageUrl} alt="" className="w-6 h-6 object-contain rounded" />
                            <span className="text-[11px] text-muted-2 truncate">{product.brand}</span>
                          </span>
                          <span onClick={(e) => { e.stopPropagation(); replaceItems({ ...items, [cat]: undefined }); }} className="grid place-items-center w-5 h-5 rounded-full bg-surface-3 text-ink-soft"><X size={11} /></span>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-muted">{CATEGORY_LABELS[cat]}</span>
                          <Plus className="w-3.5 h-3.5 text-muted" />
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3"><DripMeter items={items} /></div>

        {/* occasion + generate */}
        <div className="mt-4 space-y-3">
          <button onClick={() => setShowOccasionPicker((v) => !v)} className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface-1 border border-hairline">
            <span className="flex items-center gap-2">
              <activeOccasion.icon className="w-5 h-5 text-ink" />
              <span className="font-semibold text-ink">{activeOccasion.label}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-muted transition ${showOccasionPicker ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showOccasionPicker && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="grid grid-cols-4 gap-2 overflow-hidden">
                {OCCASIONS.map((o) => (
                  <button key={o.id} onClick={() => { setSelectedOccasion(o.id); setShowOccasionPicker(false); }} className={`p-2.5 rounded-2xl border text-center ${selectedOccasion === o.id ? 'bg-ink border-ink text-cream' : 'bg-surface-1 border-hairline text-muted-2'}`}>
                    <o.icon className="w-5 h-5 mx-auto" />
                    <span className="text-[10px] block mt-1">{o.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <PremiumButton size="lg" className="flex-1" onClick={generateLook} disabled={generatorLoading} icon={generatorLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}>
              Generate
            </PremiumButton>
            <button onClick={clear} disabled={n === 0} className="grid place-items-center w-14 h-14 rounded-2xl bg-surface-1 border border-hairline text-muted-2 disabled:opacity-40"><RefreshCw size={18} /></button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {BUDGETS.map((b) => (
              <button key={b.value} onClick={() => setGeneratorBudget(b.value)} className={`py-2.5 rounded-xl text-[13px] font-medium ${generatorBudget === b.value ? 'bg-ink text-cream' : 'bg-surface-1 text-muted-2 border border-hairline'}`}>
                {b.label}
              </button>
            ))}
          </div>

          <GenderSelector />
        </div>

        <div className="mt-5">
          <div className="text-2xs uppercase tracking-editorial text-muted mb-2">Quick add</div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORY_ORDER.map((cat) => (
              <button key={cat} onClick={() => setSearchFor(cat)} className="shrink-0 w-20 h-20 rounded-2xl border border-hairline bg-surface-1 flex flex-col items-center justify-center gap-1">
                <Plus className="w-4 h-4 text-ink" />
                <span className="text-[10px] text-muted">{CATEGORY_LABELS[cat]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* shop bar */}
      <div className="fixed bottom-0 inset-x-0 z-30">
        <div className="mx-auto max-w-[440px] px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 glass border-t border-hairline">
          <PremiumButton fullWidth size="lg" onClick={shopAll} disabled={n === 0} iconRight={<ExternalLink size={18} />}>
            Shop full look {n > 0 ? `· $${(total / 100).toFixed(0)}` : ''}
          </PremiumButton>
        </div>
      </div>

      <SearchSheet open={!!searchFor} category={searchFor} onClose={() => setSearchFor(null)} />
      <CheckoutSheet open={Boolean(checkoutProducts)} title="Your fit" products={checkoutProducts || []} onClose={() => setCheckoutProducts(null)} />
    </AppShell>
  );
}
