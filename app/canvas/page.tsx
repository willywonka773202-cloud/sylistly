'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Camera, Check, Copy, Grip, Images, Lock, Share2, Sparkles } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';

type CanvasMode = 'canvas' | 'try-on' | 'share';

const MODES: Array<{ id: CanvasMode; label: string }> = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'try-on', label: 'Try-On' },
  { id: 'share', label: 'Share' },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function productsFromItems(items: Partial<Record<Category, Product>>): Product[] {
  return Object.values(items).filter((product): product is Product => Boolean(product));
}

function topSignal(products: Product[]): string {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const signal of [...(product.vibes || []), ...(product.occasions || []), product.category]) {
      if (!signal) continue;
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'custom outfit';
}

const CANVAS_TILE_CLASSES = [
  'left-[5%] top-[4%] h-[42%] w-[55%] rotate-[-2deg]',
  'right-[5%] top-[9%] h-[27%] w-[34%] rotate-[3deg]',
  'right-[9%] top-[39%] h-[25%] w-[34%] rotate-[-1deg]',
  'left-[10%] top-[49%] h-[25%] w-[38%] rotate-[2deg]',
  'left-[48%] top-[66%] h-[24%] w-[36%] rotate-[-3deg]',
  'left-[4%] bottom-[5%] h-[18%] w-[28%] rotate-[4deg]',
  'right-[3%] bottom-[4%] h-[18%] w-[28%] rotate-[1deg]',
  'left-[37%] bottom-[7%] h-[16%] w-[24%] rotate-[-1deg]',
];

export default function CanvasPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [mode, setMode] = useState<CanvasMode>('canvas');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setHasMounted(true), []);

  const currentItems = useFit((state) => state.items);
  const savedFits = useSavedFits((state) => state.fits);

  const source = useMemo(() => {
    if (!hasMounted) return { label: 'Loading local outfit', products: [] as Product[], totalCents: 0, kind: 'Local' };
    const currentProducts = productsFromItems(currentItems);
    if (currentProducts.length > 0) {
      return {
        label: 'Current build',
        products: currentProducts,
        totalCents: currentProducts.reduce((sum, product) => sum + product.priceCents, 0),
        kind: 'Builder',
      };
    }
    const latest = savedFits[0];
    if (!latest) return { label: 'No outfit selected', products: [] as Product[], totalCents: 0, kind: 'Empty' };
    return {
      label: latest.title,
      products: productsFromItems(latest.items),
      totalCents: latest.totalCents,
      kind: 'Saved',
    };
  }, [currentItems, hasMounted, savedFits]);

  const sourceSignal = useMemo(() => topSignal(source.products), [source.products]);
  const shareCaption = useMemo(() => {
    const brands = Array.from(new Set(source.products.map((product) => product.brand))).slice(0, 4);
    const categories = Array.from(new Set(source.products.map((product) => product.category))).slice(0, 5);
    return `Sylistly ${source.label}: ${brands.join(', ') || 'real catalog pieces'} across ${categories.join(', ') || 'outfit slots'}. Total ${formatPrice(source.totalCents)}.`;
  }, [source.label, source.products, source.totalCents]);

  function localShare() {
    setToast('Local share card prepared');
    window.setTimeout(() => setToast(null), 1800);
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(shareCaption);
      setToast('Caption copied');
    } catch {
      setToast('Caption ready to copy manually');
    }
    window.setTimeout(() => setToast(null), 1800);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <header className="border-b border-hairline px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[.24em] text-accent">Canvas</div>
            <h1 className="mt-0.5 font-serif text-[26px] font-semibold leading-tight text-ink">Try-On shell</h1>
          </div>
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-muted">
            Local only
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        <section className="rounded-[28px] border border-white/12 bg-[radial-gradient(circle_at_20%_0%,rgba(246,48,107,.2),transparent_40%),linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03))] p-4 shadow-[0_24px_60px_rgba(0,0,0,.34)]">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
              <Images size={20} />
            </span>
            <div>
              <div className="font-serif text-[21px] font-semibold leading-tight text-ink">{source.label}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
                Uses your real Builder outfit first, then your newest saved fit. No AI photo is generated in this local shell.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <ContextPill label="Pieces" value={source.products.length.toString()} />
            <ContextPill label="Total" value={source.totalCents > 0 ? formatPrice(source.totalCents) : '$0'} />
            <ContextPill label="Signal" value={sourceSignal} />
          </div>
          <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-muted-2">
            Source: <strong className="text-white">{source.kind}</strong>. Canvas and Share are local. Try-On is future-disabled until a real image backend is connected.
          </div>
        </section>

        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] transition active:scale-[0.97] ${
                mode === item.id ? 'bg-accent text-white shadow-pink-glow' : 'text-white/65 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {source.products.length === 0 ? (
          <section className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.04] p-5 text-center">
            <Sparkles size={26} className="mx-auto text-accent" />
            <div className="mt-3 font-serif text-[21px] font-semibold text-ink">No outfit to render yet</div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
              Build an outfit or save a fit, then Canvas will render a real product board.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/build" className="rounded-full bg-accent px-3 py-2.5 text-[10px] font-black uppercase tracking-[.14em] text-white shadow-pink-glow">
                Open Builder
              </Link>
              <Link href="/saved" className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-2.5 text-[10px] font-black uppercase tracking-[.14em] text-white">
                Saved Fits
              </Link>
            </div>
          </section>
        ) : null}

        {source.products.length > 0 && mode === 'canvas' ? (
          <section className="mt-5">
            <div className="mb-2 px-1">
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Moodboard</div>
              <div className="font-serif text-[20px] font-semibold leading-tight text-ink">Product collage</div>
            </div>
            <div className="relative h-[500px] overflow-hidden rounded-[30px] border border-[#eadfd5] bg-[radial-gradient(circle_at_28%_18%,#fffdf8_0%,#fff7ef_48%,#ead7c7_100%)] p-3 shadow-[0_24px_58px_rgba(0,0,0,.36)]">
              <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[8px] font-black uppercase tracking-[.18em] text-white backdrop-blur-md">
                {sourceSignal}
              </div>
              <div className="absolute bottom-4 left-4 max-w-[58%] rounded-[18px] bg-white/78 px-3 py-2 text-[#191513] shadow-[0_16px_32px_rgba(70,45,28,.16)] backdrop-blur-md">
                <div className="text-[8px] font-black uppercase tracking-[.16em] text-[#8a4b5c]">Outfit title</div>
                <div className="mt-0.5 line-clamp-2 font-serif text-[16px] font-semibold leading-tight">{source.label}</div>
                <div className="mt-1 text-[11px] font-bold">{formatPrice(source.totalCents)}</div>
              </div>
              {source.products.slice(0, 8).map((product, index) => (
                <div
                  key={product.id}
                  className={`absolute overflow-hidden rounded-[22px] bg-white/82 shadow-[0_18px_36px_rgba(89,55,32,.18)] ring-1 ring-[#eadfd5] ${CANVAS_TILE_CLASSES[index] || CANVAS_TILE_CLASSES[7]}`}
                >
                  <ProductImage
                    product={product}
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-contain p-2.5 drop-shadow-[0_16px_20px_rgba(0,0,0,.22)]"
                  />
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/82 text-[#6d5b50] shadow-[0_8px_18px_rgba(0,0,0,.12)]">
                    <Grip size={12} />
                  </span>
                  <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-white backdrop-blur-md">
                    {product.category}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {source.products.length > 0 && mode === 'try-on' ? (
          <section className="mt-5 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,#171412_0%,#0f0e0d_100%)] p-4 shadow-[0_24px_58px_rgba(0,0,0,.36)]">
            <div className="grid h-[380px] place-items-center rounded-[26px] border border-dashed border-white/18 bg-white/[0.035] px-6 text-center">
              <div>
                <Camera size={32} className="mx-auto text-accent" />
                <div className="mt-3 font-serif text-[24px] font-semibold text-ink">AI try-on needs a real backend</div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
                  Sylistly is not generating a fake try-on photo here. A future backend would need user image upload, consent controls, product masking, model selection, and generated image storage before this button can be enabled.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2.5 text-[10px] font-black uppercase tracking-[.14em] text-muted"
                >
                  <Lock size={12} />
                  Generate image disabled
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {source.products.length > 0 && mode === 'share' ? (
          <section className="mt-5 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,#171412_0%,#0f0e0d_100%)] p-4 shadow-[0_24px_58px_rgba(0,0,0,.36)]">
            <div className="rounded-[26px] border border-[#eadfd5] bg-[#fff7ef] p-3 text-[#191513]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[.18em] text-[#8a4b5c]">Sylistly share card</div>
                  <div className="mt-1 font-serif text-[23px] font-semibold">{source.label}</div>
                </div>
                <div className="rounded-full bg-[#191513] px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-white">
                  {formatPrice(source.totalCents)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {source.products.slice(0, 8).map((product) => (
                  <div key={`share-${product.id}`} className="aspect-square overflow-hidden rounded-[16px] bg-white ring-1 ring-[#eadfd5]">
                    <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5" />
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={localShare}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[11px] font-black uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-[0.98]"
            >
              <Share2 size={14} />
              Prepare local share card
            </button>
            <button
              type="button"
              onClick={copyCaption}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-3 text-[11px] font-black uppercase tracking-[.14em] text-white/86 transition active:scale-[0.98] hover:border-accent/50"
            >
              <Copy size={14} />
              Copy caption
            </button>
          </section>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed inset-x-0 bottom-[86px] z-[70] mx-auto flex max-w-[480px] justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-accent/35 bg-[#15110f]/95 px-4 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow-[0_14px_42px_rgba(246,48,107,.35)] backdrop-blur-md">
            <Check size={13} className="text-accent" />
            {toast}
          </div>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}

function ContextPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[8px] font-black uppercase tracking-[.18em] text-muted">{label}</div>
      <div className="mt-1 truncate font-serif text-[16px] font-semibold leading-none text-ink">{value}</div>
    </div>
  );
}
