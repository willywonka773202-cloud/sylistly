'use client';
import { type KeyboardEvent, type MouseEvent } from 'react';
import type { Product } from '@/lib/types';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isRenderableProduct } from '@/lib/product-image-quality';

interface Props {
  product: Product;
  selected?: boolean;
  onClick: () => void;
}

function formatPrice(priceCents: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString()}`;
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'retailer';
  }
}

export function ProductCard({ product: p, selected = false, onClick }: Props) {
  if (!isRenderableProduct(p)) return null;

  const buyUrl = getProductOutboundUrl(p);
  const retailHost = getHost(buyUrl);

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
    <article className={`overflow-hidden rounded-[20px] border bg-[#f8f3ed] shadow-[0_10px_26px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 ${
      selected ? 'border-accent shadow-pink-glow' : 'border-[#e2d7cd]'
    }`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="flex min-h-[118px] w-full cursor-pointer items-center gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <div className="relative flex h-[96px] w-[112px] flex-none items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,#fffdfa_0%,#f1e8df_100%)] ring-1 ring-[#efe4da] min-[390px]:h-[108px] min-[390px]:w-[124px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.92),transparent_38%)]" />
          <div className="absolute inset-x-4 bottom-3 h-4 rounded-full bg-[#d8cdc4]/35 blur-[6px]" />
          <ProductImage
            product={p}
            wrapperClassName="relative h-full w-full"
            className="relative h-full w-full object-contain p-2 drop-shadow-[0_12px_18px_rgba(0,0,0,.24)]"
          />
          {selected ? (
            <div className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-[9px] font-bold text-white">
              OK
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#8a7b72]">{p.brand}</div>
          <div className="mt-1 line-clamp-2 font-serif text-[15px] font-semibold leading-[1.18] text-[#191513]">
            {p.name}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-[#191513]">{formatPrice(p.priceCents)}</div>
          <button
            type="button"
            onClick={openItem}
            title={`Open ${retailHost}`}
            className="mt-2 inline-flex max-w-full rounded-full bg-[#efe5dc] px-2.5 py-1 text-[9px] text-[#8a7b72] transition hover:bg-[#e8d8ca] hover:text-[#191513]"
          >
            <span className="truncate">{p.retailer}</span>
          </button>
        </div>
        <button
          type="button"
          aria-label={selected ? 'Added to fit' : 'Add to fit'}
          className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent text-[24px] font-light leading-none text-white shadow-pink-glow transition hover:bg-accent-hot"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          {selected ? 'OK' : '+'}
        </button>
      </div>
    </article>
  );
}
