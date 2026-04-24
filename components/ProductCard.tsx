'use client';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Product } from '@/lib/types';
import { proxiedImageUrl } from '@/lib/image-url';

interface Props {
  product: Product;
  selected?: boolean;
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

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'retailer';
  }
}

function isSearchLikeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /search|query|q=|searchTerm|Ntt/i.test(`${parsed.pathname} ${parsed.search}`);
  } catch {
    return false;
  }
}

export function ProductCard({ product: p, selected = false, onClick }: Props) {
  const buyUrl = p.retailerUrl || p.affiliateUrl || '#';
  const [imgFailed, setImgFailed] = useState(false);
  const imageSrc =
    imgFailed || !p.imageUrl
      ? fallbackImage(p)
      : proxiedImageUrl(p.imageUrl, { cutout: true, category: p.category });
  const retailHost = getHost(buyUrl);
  const searchLike = isSearchLikeUrl(buyUrl);

  function openItem(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!buyUrl || buyUrl === '#') return;
    window.open(buyUrl, '_blank', 'noopener,noreferrer');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick();
  }

  return (
    <article className={`overflow-hidden rounded-2xl border bg-surface-2 transition hover:-translate-y-0.5 hover:border-hairline-2 ${
      selected ? 'border-accent shadow-pink-glow' : 'border-hairline'
    }`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="flex w-full cursor-pointer items-stretch gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <div className="relative flex h-[112px] w-[96px] flex-none items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-hairline">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,.08),transparent_45%)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={`${p.brand} ${p.name}`}
            className="relative h-[92%] w-[92%] object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,.35)]"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
          {selected ? (
            <div className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-[9px] font-bold text-white">
              OK
            </div>
          ) : null}
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
                searchLike
                  ? 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20'
              }`}>
                {searchLike ? 'Retailer search' : 'Direct retailer'}
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
          {selected ? 'Added' : 'Add to fit'}
        </button>
        <button
          type="button"
          className="inline-flex rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-medium text-accent transition hover:bg-accent hover:text-white"
          onClick={openItem}
        >
          Open {retailHost}
        </button>
      </div>
    </article>
  );
}
