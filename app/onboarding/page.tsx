'use client';

import { Check, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ProductImage';
import { ALL_CATALOG_PRODUCTS } from '@/lib/catalog';
import { isRenderableProduct } from '@/lib/product-image-quality';
import { useProfile } from '@/store/profile';
import { useWardrobe } from '@/store/wardrobe';

const ONBOARDING_CATEGORIES = [
  { label: 'Tops', category: 'top' as const, hint: 'T-shirts, blouses, knits' },
  { label: 'Bottoms', category: 'bottom' as const, hint: 'Jeans, trousers, skirts' },
  { label: 'Shoes', category: 'shoes' as const, hint: 'Sneakers, boots, loafers' },
  { label: 'Outerwear', category: 'outer' as const, hint: 'Jackets, coats, blazers' },
  { label: 'Bags', category: 'bag' as const, hint: 'Totes, crossbodys, backpacks' },
] as const;

function getSuggestedBasics() {
  const byCategory: Partial<Record<string, ReturnType<typeof ALL_CATALOG_PRODUCTS.filter>>> = {};
  for (const { category } of ONBOARDING_CATEGORIES) {
    byCategory[category] = ALL_CATALOG_PRODUCTS
      .filter((p) => p.category === category)
      .filter(isRenderableProduct)
      .filter((p) => p.imageQuality === 'good' || p.priceCents > 0)
      .sort((a, b) => (b.priceCents > 0 ? 1 : 0) - (a.priceCents > 0 ? 1 : 0))
      .slice(0, 6);
  }
  return byCategory;
}

const SUGGESTED = getSuggestedBasics();

const BODY_TYPE_OPTIONS = [
  { value: 'fem' as const, label: 'Women\'s', desc: 'Femme-forward pieces' },
  { value: 'masc' as const, label: 'Men\'s', desc: 'Masc-forward pieces' },
  { value: 'androgynous' as const, label: 'Neutral', desc: 'Gender-fluid picks' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const setBodyType = useProfile((state) => state.setBodyType);
  const bodyType = useProfile((state) => state.profile.bodyType);
  const addToWardrobe = useWardrobe((state) => state.addItem);
  const removeFromWardrobe = useWardrobe((state) => state.removeItem);
  const isOwned = useWardrobe((state) => state.hasItem);
  const [step, setStep] = useState<'frame' | 'basics'>('frame');
  const [activeCategory, setActiveCategory] = useState<string>('top');
  const ownedCount = useWardrobe((state) => state.ownedItems.length);

  function finish() {
    router.replace('/feed');
  }

  const categoryProducts = SUGGESTED[activeCategory] || [];

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-[calc(env(safe-area-inset-top)+24px)]">

        {/* Step: Frame selection */}
        {step === 'frame' && (
          <>
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-[22px] bg-accent/12 text-accent">
                <Sparkles size={24} />
              </div>
              <h1 className="mt-4 font-serif text-[32px] font-semibold leading-tight text-ink">
                Welcome to <em className="italic text-accent">Sylistly</em>
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-2">
                Let&apos;s set up your style profile so we can generate outfits that actually fit you.
              </p>
            </div>

            <div className="mt-8">
              <div className="text-[9px] uppercase tracking-[.2em] text-muted mb-3 text-center">
                Your style frame
              </div>
              <div className="flex flex-col gap-2.5">
                {BODY_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBodyType(option.value)}
                    className={`flex items-center gap-4 rounded-[22px] border p-4 text-left transition ${
                      bodyType === option.value
                        ? 'border-accent bg-accent/12 shadow-pink-glow'
                        : 'border-white/10 bg-white/[0.03] hover:border-accent/50'
                    }`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-[16px] ${
                      bodyType === option.value ? 'border-accent bg-accent text-white' : 'border-white/15 bg-white/[0.06] text-muted-2'
                    }`}>
                      {option.value === 'fem' ? '♀' : option.value === 'masc' ? '♂' : '✦'}
                    </div>
                    <div>
                      <div className="font-semibold text-[15px] text-ink">{option.label}</div>
                      <div className="text-[12px] text-muted-2 mt-0.5">{option.desc}</div>
                    </div>
                    {bodyType === option.value && (
                      <Check size={16} className="ml-auto text-accent shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep('basics')}
              className="mt-8 w-full rounded-full bg-accent py-4 text-[12px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
            >
              Continue — Add basics
            </button>
            <button
              type="button"
              onClick={finish}
              className="mt-3 w-full py-2 text-[11px] text-muted-2 transition hover:text-muted"
            >
              Skip setup
            </button>
          </>
        )}

        {/* Step: Add basics */}
        {step === 'basics' && (
          <>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-[9px] uppercase tracking-[.2em] text-accent">Step 2</div>
                <h1 className="mt-0.5 font-serif text-[28px] font-semibold leading-tight text-ink">
                  Add your <em className="italic text-accent">basics</em>
                </h1>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-2">
                  Tap the + to mark pieces you already own. We&apos;ll use these to build smarter outfits.
                </p>
              </div>
              {ownedCount > 0 && (
                <div className="shrink-0 rounded-[14px] border border-accent/25 bg-accent/10 px-3 py-2 text-center">
                  <div className="font-serif text-[20px] font-semibold text-accent">{ownedCount}</div>
                  <div className="text-[8px] uppercase tracking-[.14em] text-muted">added</div>
                </div>
              )}
            </div>

            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {ONBOARDING_CATEGORIES.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setActiveCategory(cat.category)}
                  className={`flex-none rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[.1em] transition ${
                    activeCategory === cat.category
                      ? 'bg-accent text-white shadow-pink-glow'
                      : 'border border-white/10 bg-white/[0.04] text-muted-2'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Products grid */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {categoryProducts.map((product) => {
                const owned = isOwned(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => owned ? removeFromWardrobe(product.id) : addToWardrobe(product)}
                    className={`group relative overflow-hidden rounded-[20px] border text-left transition ${
                      owned
                        ? 'border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,.2)]'
                        : 'border-white/10 bg-[#151311] hover:border-accent/40'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden rounded-[16px] m-1.5 border border-[#eadfd5] bg-[#fff8f2]">
                      <ProductImage
                        product={product}
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-2"
                      />
                    </div>
                    <div className="px-2 pb-2.5">
                      <p className="line-clamp-1 text-[10px] font-semibold text-ink">{product.brand}</p>
                      <p className="line-clamp-1 text-[9px] text-muted">${(product.priceCents / 100).toLocaleString()}</p>
                    </div>
                    <div className={`absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border text-[9px] transition ${
                      owned
                        ? 'border-emerald-400/50 bg-emerald-500 text-white'
                        : 'border-white/20 bg-[#1a1614] text-muted-2 group-hover:border-accent group-hover:text-accent'
                    }`}>
                      {owned ? <Check size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-[1fr_.75fr] gap-2.5">
              <button
                type="button"
                onClick={finish}
                className="rounded-full bg-accent py-4 text-[12px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
              >
                {ownedCount > 0 ? `Done — ${ownedCount} piece${ownedCount !== 1 ? 's' : ''} added` : 'Done'}
              </button>
              <button
                type="button"
                onClick={() => setStep('frame')}
                className="rounded-full border border-white/10 bg-white/[0.04] py-4 text-[11px] font-semibold text-muted-2 transition hover:text-ink"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
