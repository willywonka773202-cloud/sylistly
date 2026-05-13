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
  onImageAvailable?: () => void;
  onImageUnavailable?: () => void;
}

function formatPrice(priceCents: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString('en-US')}`;
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'retailer';
  }
}

export function ProductCard({ product: p, selected = false, onClick, onImageAvailable, onImageUnavailable }: Props) {
  function markImageAvailable() {
    onImageAvailable?.();
  }

  function markImageUnavailable() {
    onImageUnavailable?.();
  }

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
    <article className={`overflow-hidden rounded-[24px] border bg-[#f8f3ed] shadow-[0_12px_30px_rgba(0,0,0,.2)] transition hover:-translate-y-0.5 ${
      selected ? 'border-accent shadow-pink-glow' : 'border-[#e2d7cd]'
    }`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="grid min-h-[206px] w-full cursor-pointer grid-cols-[150px_1fr] gap-3.5 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60 min-[390px]:grid-cols-[168px_1fr]"
      >
        <div className="relative flex h-[178px] w-full flex-none items-center justify-center overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#fffdfa_0%,#f1e8df_100%)] ring-1 ring-[#efe4da] min-[390px]:h-[190px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.92),transparent_38%)]" />
          <div className="absolute inset-x-5 bottom-4 h-5 rounded-full bg-[#d8cdc4]/38 blur-[7px]" />
          <ProductImage
            product={p}
            wrapperClassName="relative h-full w-full"
            className="relative h-full w-full object-contain p-2.5 drop-shadow-[0_16px_22px_rgba(0,0,0,.24)]"
            onAvailable={markImageAvailable}
            onUnavailable={markImageUnavailable}
          />
          {selected ? (
            <div className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-[9px] font-bold text-white">
              OK
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col py-0.5">
          <div className="text-[9px] font-bold uppercase tracking-[.17em] text-[#8a7b72]">{p.brand}</div>
          <div className="mt-1.5 line-clamp-3 font-serif text-[17px] font-semibold leading-[1.12] text-[#191513]">
            {p.name}
          </div>
          <div className="mt-2 text-[15px] font-semibold text-[#191513]">{formatPrice(p.priceCents)}</div>
          <button
            type="button"
            onClick={openItem}
            title={`Open ${retailHost}`}
            className="mt-2 inline-flex max-w-full rounded-full bg-[#efe5dc] px-2.5 py-1.5 text-[9px] text-[#8a7b72] transition hover:bg-[#e8d8ca] hover:text-[#191513]"
          >
            <span className="truncate">{p.retailer}</span>
          </button>

          <button
            type="button"
            aria-label={selected ? 'Added to fit' : 'Swap into fit'}
            className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-accent px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.13em] text-white shadow-pink-glow transition hover:bg-accent-hot"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            {selected ? 'Selected' : 'Swap'}
          </button>
        </div>
      </div>
    </article>
  );
}
