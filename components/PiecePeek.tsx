'use client';

import { ExternalLink, Lock, RefreshCw, X } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { wrapAffiliate } from '@/lib/affiliate';
import { track } from '@/lib/analytics';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import type { Product } from '@/lib/types';

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function merchantName(product: Product): string {
  if (product.retailer) return product.retailer;
  try {
    return new URL(getProductOutboundUrl(product)).hostname.replace(/^www\./, '');
  } catch {
    return 'retailer';
  }
}

/**
 * Shop-the-look peek — tapping a garment on the plate opens this. Primary
 * action is Shop (the commercial goal; affiliate-wrapped + tracked); Swap
 * and Lock are secondary so the peek doubles as the per-piece control surface.
 */
export function PiecePeek({
  product,
  locked,
  onShop,
  onSwap,
  onLock,
  onClose,
}: {
  product: Product;
  locked: boolean;
  onShop: () => void;
  onSwap: () => void;
  onLock: () => void;
  onClose: () => void;
}) {
  const url = wrapAffiliate(getProductOutboundUrl(product));
  const exact = hasExactProductLink(product);

  return (
    <div className="fixed inset-0 z-[80] mx-auto flex max-w-[480px] items-end">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="sy-sheet-enter relative z-10 w-full rounded-t-sheet border border-hairline-2 bg-surface-1 p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-float">
        <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-hairline-2" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sy-press absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-hairline-2 bg-surface-2 text-muted"
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-3.5">
          <span className="grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-card bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)]">
            <ProductImage
              product={product}
              transparentOnly
              wrapperClassName="h-[72px] w-[72px]"
              className="h-[72px] w-[72px] object-contain"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow font-extrabold uppercase text-champagne">{product.brand}</p>
            <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-tight text-ink">{product.name}</p>
            <p className="mt-1.5 flex items-center gap-2 text-[15px] font-bold text-accent">
              {formatPrice(product.priceCents || 0)}
              {exact ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.1em] text-money">
                  <span className="h-1.5 w-1.5 rounded-full bg-money" />
                  shoppable
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noreferrer sponsored"
          onClick={() => {
            track('shop_link_clicked', {
              brand: product.brand,
              retailer: product.retailer,
              priceCents: product.priceCents,
              exact,
              wrapped: url !== getProductOutboundUrl(product),
              surface: 'piece-peek',
            });
            onShop();
          }}
          className="sy-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-4 py-3.5 text-[14px] font-bold text-white shadow-pink-glow"
        >
          Shop at {merchantName(product)}
          <ExternalLink size={15} />
        </a>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSwap}
            className="sy-press inline-flex items-center justify-center gap-2 rounded-full border border-hairline-2 bg-surface-2 px-4 py-3 text-[13px] font-semibold text-ink"
          >
            <RefreshCw size={14} className="text-accent" />
            Swap piece
          </button>
          <button
            type="button"
            onClick={onLock}
            aria-pressed={locked}
            className={`sy-press inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[13px] font-semibold transition ${
              locked
                ? 'border-accent bg-accent-soft text-ink'
                : 'border-hairline-2 bg-surface-2 text-ink'
            }`}
          >
            <Lock size={14} className="text-accent" />
            {locked ? 'Locked' : 'Lock it'}
          </button>
        </div>
      </div>
    </div>
  );
}
