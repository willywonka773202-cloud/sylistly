'use client';

import { ArrowLeft, Camera, Check, Download, Image as ImageIcon, LoaderCircle, Lock, Sparkles, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';

const BODY_TYPE_OPTIONS = [
  { value: 'masc', label: 'Male frame' },
  { value: 'fem', label: 'Female frame' },
  { value: 'androgynous', label: 'Neutral frame' },
] as const;

function fitProducts(items: Partial<Record<Category, Product>>): Product[] {
  return CATEGORY_ORDER.map((category) => items[category]).filter((product): product is Product => Boolean(product));
}

export default function TryOnPage() {
  const router = useRouter();
  const items = useFit((state) => state.items);
  const bodyType = useProfile((state) => state.profile.bodyType);
  const setBodyType = useProfile((state) => state.setBodyType);
  const [selfieReady, setSelfieReady] = useState(false);
  const [bodyPhotoReady, setBodyPhotoReady] = useState(false);
  const [previewState, setPreviewState] = useState<'idle' | 'queued'>('idle');
  const products = useMemo(() => fitProducts(items), [items]);
  const totalCents = products.reduce((sum, product) => sum + product.priceCents, 0);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-10">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-10 w-10 place-items-center rounded-full border border-hairline bg-surface-2 text-ink"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-[.18em] text-muted">Dressing Room</div>
            <h1 className="font-serif text-[24px] font-semibold text-ink">AI Try-On</h1>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-black text-white shadow-pink-glow">
            S
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#f8f3ed_0%,#eee2d7_100%)] p-3 text-[#211b17] shadow-[0_28px_64px_rgba(0,0,0,.34)]">
          <div className="relative grid min-h-[430px] place-items-center overflow-hidden rounded-[28px] bg-[#fffaf5]">
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              <button className="grid h-11 w-11 place-items-center rounded-full border border-[#e4d8cf] bg-white/86 text-[#231d19]" aria-label="Download placeholder">
                <Download size={18} />
              </button>
              <button className="grid h-11 w-11 place-items-center rounded-full border border-[#e4d8cf] bg-white/86 text-[#231d19]" aria-label="Generate placeholder">
                {previewState === 'queued' ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
              </button>
            </div>

            {products.length ? (
              <div className="grid w-full max-w-[300px] grid-cols-2 gap-3 p-5">
                {products.slice(0, 6).map((product, index) => (
                  <div
                    key={product.id}
                    className={`grid place-items-center rounded-[22px] border border-[#eadfd5] bg-white shadow-[0_14px_30px_rgba(0,0,0,.12)] ${
                      index === 0 ? 'col-span-2 h-[150px]' : 'h-[106px]'
                    }`}
                  >
                    <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-8 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#1f1915] text-white">
                  <Sparkles size={24} />
                </div>
                <h2 className="mt-4 font-serif text-[28px] font-semibold leading-tight">Build a fit first</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[#74675f]">
                  Try-On previews use your current Builder outfit. Generate or load a fit, then come back to preview it here.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/build')}
                  className="mt-5 rounded-full bg-[#11100f] px-5 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-white"
                >
                  Open Builder
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/70 px-3 py-3">
              <div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#7a6c63]">AI credits</div>
              <div className="mt-1 font-serif text-[20px] font-semibold">Preview mode</div>
            </div>
            <div className="rounded-2xl bg-white/70 px-3 py-3">
              <div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#7a6c63]">Fit total</div>
              <div className="mt-1 font-serif text-[20px] font-semibold">${Math.round(totalCents / 100).toLocaleString()}</div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[30px] border border-white/10 bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
              <UserRound size={18} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[.18em] text-muted">Try-on profile</div>
              <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">Set up once, preview faster</h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <SetupRow
              icon={<Camera size={18} />}
              title="Selfie photo"
              helper="Face photo placeholder. Upload flow will connect when Try-On backend is wired."
              ready={selfieReady}
              onClick={() => setSelfieReady((value) => !value)}
            />
            <SetupRow
              icon={<ImageIcon size={18} />}
              title="Body photo"
              helper="Optional full-body photo placeholder for better future results."
              ready={bodyPhotoReady}
              onClick={() => setBodyPhotoReady((value) => !value)}
            />
          </div>

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[.18em] text-muted">Body frame</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {BODY_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBodyType(option.value)}
                  className={`rounded-2xl border px-2 py-3 text-[10px] font-bold uppercase tracking-[.1em] ${
                    bodyType === option.value
                      ? 'border-accent bg-accent text-white shadow-pink-glow'
                      : 'border-hairline bg-surface-2 text-muted-2'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[12px] leading-relaxed text-muted-2">
            <Lock size={15} className="mt-0.5 shrink-0 text-accent" />
            This profile is private to you. Real image upload and generation are intentionally disabled until the backend is connected.
          </div>

          <div className="mt-4 grid grid-cols-[1fr_.9fr] gap-2">
            <button
              type="button"
              onClick={() => setPreviewState('queued')}
              disabled={!products.length}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow disabled:bg-white/[0.06] disabled:text-muted disabled:shadow-none"
            >
              <Sparkles size={14} />
              Preview try-on
            </button>
            <button
              type="button"
              onClick={() => router.push('/build')}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-muted-2"
            >
              Edit fit
            </button>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function SetupRow({
  icon,
  title,
  helper,
  ready,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  ready: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-3 text-left"
    >
      <span className={`grid h-[54px] w-[54px] place-items-center rounded-2xl border ${
        ready ? 'border-accent bg-accent text-white' : 'border-hairline bg-surface-2 text-muted-2'
      }`}>
        {ready ? <Check size={18} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-ink">{title}</span>
        <span className="mt-1 block text-[11px] leading-relaxed text-muted-2">{helper}</span>
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[.12em] text-accent">
        {ready ? 'Ready' : 'Add'}
      </span>
    </button>
  );
}
