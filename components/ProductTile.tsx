'use client';

import { Check, Plus, ShoppingBag } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { formatPrice } from '@/lib/catalog-health';
import type { Product } from '@/lib/types';

export function ProductTile({
  product,
  status,
  actionLabel,
  compact = false,
  onClick,
}: {
  product?: Product | null;
  status?: 'owned' | 'similar' | 'wishlist' | 'suggested';
  actionLabel?: string;
  compact?: boolean;
  onClick?: () => void;
}) {
  if (!product) {
    return (
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 text-[12px] text-white/52">
        No catalog item selected.
      </div>
    );
  }

  const statusLabel = status
    ? status === 'owned'
      ? 'Owned'
      : status === 'wishlist'
        ? 'Wishlist'
        : status === 'similar'
          ? 'Similar'
          : 'Suggested'
    : product.category;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full gap-3 rounded-[22px] border border-white/10 bg-white/[0.045] p-2.5 text-left transition active:scale-[.985] ${
        compact ? 'items-center' : ''
      }`}
    >
      <div className={`${compact ? 'h-16 w-14' : 'h-24 w-20'} flex-none overflow-hidden rounded-[18px] border border-[#eadfd5] bg-[#fff7ef]`}>
        <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-2" />
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.14em] text-white/64">
            {statusLabel}
          </span>
          {status === 'owned' ? <Check size={12} className="text-accent" /> : null}
        </div>
        <div className="mt-1 line-clamp-1 text-[10px] font-black uppercase tracking-[.13em] text-white/78">{product.brand}</div>
        <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight text-white">{product.name}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-accent">{formatPrice(product.priceCents)}</span>
          {actionLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.12em] text-white">
              {actionLabel === 'Shop' ? <ShoppingBag size={10} /> : <Plus size={10} />}
              {actionLabel}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

