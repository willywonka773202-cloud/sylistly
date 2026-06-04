'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Sparkles, ArrowRight, ShoppingBag, RefreshCw, X } from 'lucide-react';
import { useFit } from '@/store/fit';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';

interface SnapLook {
  category: Category;
  label: string;
  query: string;
  color?: string;
  products: Product[];
}

type Status = 'idle' | 'reading' | 'done' | 'error';

const READING_MESSAGES = [
  'Reading the look…',
  'Spotting each piece…',
  'Matching shoppable items…',
  'Pulling prices & retailers…',
];

function formatPrice(cents: number): string {
  if (!cents) return '';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

export default function SnapPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const setItem = useFit((s) => s.setItem);
  const replaceItems = useFit((s) => s.replaceItems);

  const [status, setStatus] = useState<Status>('idle');
  const [photo, setPhoto] = useState<string | null>(null);
  const [looks, setLooks] = useState<SnapLook[]>([]);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [error, setError] = useState<string>('');
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (status !== 'reading') return;
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % READING_MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, [status]);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setLooks([]);
    setPicks({});
    setMsgIndex(0);
    let dataUrl: string;
    try {
      dataUrl = await fileToDataUrl(file);
    } catch {
      setError('Could not read that image.');
      setStatus('error');
      return;
    }
    setPhoto(dataUrl);
    setStatus('reading');
    try {
      const res = await fetch('/api/snap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mediaType: file.type }),
      });
      const data = (await res.json()) as { looks?: SnapLook[]; error?: string };
      if (!res.ok || !data.looks?.length) {
        setError(data.error || 'No outfit detected. Try a clearer, full-look photo.');
        setStatus('error');
        return;
      }
      setLooks(data.looks);
      setStatus('done');
    } catch {
      setError('Something went wrong reading the look. Try again.');
      setStatus('error');
    }
  }, []);

  const reset = () => {
    setStatus('idle');
    setPhoto(null);
    setLooks([]);
    setPicks({});
    setError('');
  };

  const matched = looks.filter((l) => l.products.length > 0);
  const orderedLooks = [...matched].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );

  const pickedProduct = (look: SnapLook): Product | undefined =>
    look.products[picks[look.category] ?? 0];

  const totalCents = orderedLooks.reduce(
    (sum, look) => sum + (pickedProduct(look)?.priceCents || 0),
    0,
  );

  const buildThisLook = () => {
    const items: Partial<Record<Category, Product>> = {};
    for (const look of orderedLooks) {
      const p = pickedProduct(look);
      if (p) items[look.category] = p;
    }
    replaceItems(items);
    router.push('/build');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg text-ink">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent" />
          <h1 className="text-lg font-bold tracking-tight">Snap to Shop</h1>
        </div>
        {status !== 'idle' && (
          <button onClick={reset} className="rounded-full p-1.5 text-muted active:scale-90" aria-label="Start over">
            <X size={20} />
          </button>
        )}
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {/* IDLE */}
      {status === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-16 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative flex h-44 w-44 items-center justify-center rounded-[2rem] border border-hairline bg-white/[0.03]"
          >
            <div className="absolute inset-0 rounded-[2rem] shadow-pink-glow" />
            <Camera size={56} strokeWidth={1.3} className="text-accent" />
          </motion.div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold leading-tight">Shop any outfit<br />in seconds</h2>
            <p className="mx-auto max-w-[16rem] text-sm text-muted">
              Snap a photo of any look — a friend, a celeb, a screenshot — and we&apos;ll find every
              piece, ready to shop.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-base font-bold text-black shadow-pink-glow active:scale-[0.98]"
            >
              <Camera size={20} /> Snap a look
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl border border-hairline py-3 text-sm font-semibold text-muted active:scale-[0.98]"
            >
              Upload a photo
            </button>
          </div>
        </div>
      )}

      {/* READING */}
      {status === 'reading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-16">
          <div className="relative h-72 w-56 overflow-hidden rounded-3xl border border-hairline">
            {photo && <img src={photo} alt="Your look" className="h-full w-full object-cover" />}
            <motion.div
              className="absolute inset-x-0 h-24 bg-gradient-to-b from-accent/40 to-transparent"
              animate={{ top: ['-25%', '100%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-0 bg-bg/20" />
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <Sparkles size={15} className="text-accent" /> {READING_MESSAGES[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      {/* ERROR */}
      {status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-16 text-center">
          {photo && (
            <img src={photo} alt="" className="h-40 w-32 rounded-2xl border border-hairline object-cover opacity-60" />
          )}
          <p className="text-sm text-muted">{error}</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-bold text-black active:scale-95"
          >
            <Camera size={18} /> Try another photo
          </button>
        </div>
      )}

      {/* DONE */}
      {status === 'done' && (
        <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-40">
          <div className="mb-4 flex items-center gap-3 px-1">
            {photo && (
              <img src={photo} alt="Your look" className="h-16 w-12 rounded-lg border border-hairline object-cover" />
            )}
            <div>
              <p className="text-sm font-bold">We found {orderedLooks.length} pieces</p>
              <p className="text-xs text-muted">Tap an item to swap matches · Shop opens the retailer</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {orderedLooks.map((look) => {
              const active = picks[look.category] ?? 0;
              const product = look.products[active];
              if (!product) return null;
              return (
                <div key={look.category} className="rounded-2xl border border-hairline bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {look.category}
                    </span>
                    <span className="text-xs font-bold text-ink">{formatPrice(product.priceCents)}</span>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
                        }}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-sm font-semibold">{product.brand}</p>
                      <p className="line-clamp-2 text-xs text-muted">{product.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{product.retailer}</p>
                      <a
                        href={product.affiliateUrl || product.retailerUrl}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="mt-auto flex w-fit items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-black active:scale-95"
                      >
                        <ShoppingBag size={13} /> Shop
                      </a>
                    </div>
                  </div>

                  {look.products.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {look.products.map((alt, i) => (
                        <button
                          key={alt.id}
                          onClick={() => setPicks((p) => ({ ...p, [look.category]: i }))}
                          className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border ${
                            i === active ? 'border-accent' : 'border-hairline'
                          }`}
                          aria-label={`Swap to ${alt.brand}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={alt.imageUrl} alt={alt.name} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sticky shop-the-look bar */}
          <motion.div
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center gap-3 border-t border-hairline bg-bg/90 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl"
          >
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-wide text-muted">Full look</p>
              <p className="text-base font-bold">{formatPrice(totalCents)}</p>
            </div>
            <button
              onClick={buildThisLook}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-bold text-black shadow-pink-glow active:scale-[0.98]"
            >
              Build this look <ArrowRight size={17} />
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl border border-hairline p-3.5 text-muted active:scale-95"
              aria-label="Snap another"
            >
              <RefreshCw size={18} />
            </button>
          </motion.div>
        </div>
      )}
    </main>
  );
}
