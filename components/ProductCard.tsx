'use client';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Product } from '@/lib/types';

interface Props {
  product: Product;
  onClick: () => void;
}

function formatPrice(priceCents: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString()}`;
}

function fallbackImage(product: Product): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="36" fill="#0f0f0e" />
      <rect x="18" y="18" width="284" height="284" rx="28" fill="#e8365d" opacity="0.14" />
      <rect x="92" y="76" width="136" height="112" rx="28" fill="#fffefb" opacity="0.9" />
      <rect x="108" y="206" width="104" height="14" rx="7" fill="#fffefb" opacity="0.85" />
      <text x="28" y="276" fill="#fffefb" font-family="Arial, sans-serif" font-size="22" font-weight="700">${product.brand.replace(/&/g, '&amp;')}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function ProductCard({ product: p, onClick }: Props) {
  const buyUrl = p.affiliateUrl || p.retailerUrl;
  const [imgFailed, setImgFailed] = useState(false);
  const imageSrc = imgFailed || !p.imageUrl ? fallbackImage(p) : p.imageUrl;

  function openItem(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    window.location.assign(buyUrl);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick();
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-hairline bg-surface-2 transition hover:-translate-y-0.5 hover:border-hairline-2">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="flex w-full cursor-pointer items-stretch gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <div className="flex h-[112px] w-[96px] flex-none items-center justify-center rounded-2xl bg-black ring-1 ring-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={`${p.brand} ${p.name}`}
            className="h-[82%] w-[82%] object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[.14em] text-muted-2">{p.brand}</div>
              <div className="mt-1 line-clamp-3 text-[13px] leading-[1.25] text-ink">
                {p.name}
              </div>
            </div>
            <div className="rounded-full bg-surface-3 px-2.5 py-1 text-[13px] font-semibold text-ink">
              {formatPrice(p.priceCents)}
            </div>
          </div>

          <div className="mt-auto pt-3">
            <div className="text-[10px] uppercase tracking-[.12em] text-muted">{p.retailer}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-[.16em] ${
                p.trusted === false
                  ? 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20'
              }`}>
                {p.trusted === false ? 'Expanded result' : 'Trusted retailer'}
              </span>
              <span className="text-[10px] text-muted-2">Tap to add to your fit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 pb-3">
        <button
          type="button"
          className="inline-flex rounded-full bg-accent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-white transition hover:bg-accent-hot"
          onClick={onClick}
        >
          Add to fit
        </button>
        <button
          type="button"
          className="inline-flex rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-medium text-accent transition hover:bg-accent hover:text-white"
          onClick={openItem}
        >
          View item
        </button>
      </div>
    </article>
  );
}
