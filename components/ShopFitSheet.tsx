'use client';

import { Bookmark, RotateCcw, Shirt, ShoppingBag } from 'lucide-react';
import { BottomSheet } from '@/components/AppPrimitives';
import { ProductRail } from '@/components/ProductRail';
import { ProductTile } from '@/components/ProductTile';
import { calculateOutfitTotal, formatPrice } from '@/lib/catalog-health';
import { getProductOutboundUrl } from '@/lib/product-links';
import type { Category, Product } from '@/lib/types';

export function ShopFitSheet({
  open,
  title,
  products,
  onClose,
  onAddToCloset,
  onUseInBuilder,
  onSaveOutfit,
}: {
  open: boolean;
  title: string;
  products: Product[];
  onClose: () => void;
  onAddToCloset?: (product: Product) => void;
  onUseInBuilder?: (product: Product) => void;
  onSaveOutfit?: () => void;
}) {
  const items = Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
  const total = calculateOutfitTotal(items);
  const missingLinks = products.filter((product) => !getProductOutboundUrl(product)).length;

  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={onSaveOutfit} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white">
            <Bookmark size={13} /> Save
          </button>
          <button type="button" onClick={() => products.forEach((product) => onAddToCloset?.(product))} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-accent">
            <Shirt size={13} /> Closet
          </button>
          <button type="button" onClick={() => products[0] && onUseInBuilder?.(products[0])} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow">
            <RotateCcw size={13} /> Builder
          </button>
        </div>
      }
    >
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-white/52">Shop the fit</div>
            <div className="mt-1 font-serif text-[28px] font-semibold text-white">{formatPrice(total)}</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-white/60">
            {products.length} pieces
          </div>
        </div>
        <ProductRail products={products} onProductClick={onUseInBuilder} className="mt-4" />
        {missingLinks ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-white/56">
            {missingLinks} item{missingLinks === 1 ? '' : 's'} can be saved or added to closet but do not have retailer links yet.
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {products.map((product) => (
          <div key={product.id} className="grid grid-cols-[1fr_auto] gap-2">
            <ProductTile product={product} compact actionLabel={getProductOutboundUrl(product) ? 'Shop' : 'Use'} onClick={() => onUseInBuilder?.(product)} />
            <a
              href={getProductOutboundUrl(product) || undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!getProductOutboundUrl(product)}
              className={`grid h-full min-h-[72px] w-14 place-items-center rounded-[20px] ${getProductOutboundUrl(product) ? 'bg-accent text-white shadow-pink-glow' : 'pointer-events-none bg-white/[0.06] text-white/30'}`}
            >
              <ShoppingBag size={16} />
            </a>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
