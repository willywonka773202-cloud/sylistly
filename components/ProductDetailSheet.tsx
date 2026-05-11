'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Bookmark, RotateCcw, ShoppingBag, Shirt } from 'lucide-react';
import { BottomSheet } from '@/components/AppPrimitives';
import { ProductImage } from '@/components/ProductImage';
import { ProductTile } from '@/components/ProductTile';
import { calculateOutfitTotal, formatPrice } from '@/lib/catalog-health';
import { getProductOutboundUrl } from '@/lib/product-links';
import type { Category, Product } from '@/lib/types';

export function ProductDetailSheet({
  open,
  title,
  products,
  selectedProduct,
  onClose,
  onAddToCloset,
  onUseInBuilder,
  onSaveOutfit,
}: {
  open: boolean;
  title: string;
  products: Product[];
  selectedProduct?: Product | null;
  onClose: () => void;
  onAddToCloset?: (product: Product) => void;
  onUseInBuilder?: (product: Product) => void;
  onSaveOutfit?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeProduct = useMemo(() => {
    const preferredId = selectedProduct?.id || selectedId;
    return products.find((product) => product.id === preferredId) || products[0] || null;
  }, [products, selectedId, selectedProduct?.id]);
  const items = useMemo(
    () => Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>,
    [products],
  );
  const shopUrl = activeProduct ? getProductOutboundUrl(activeProduct) : '';

  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onSaveOutfit}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white"
          >
            <Bookmark size={13} />
            Save
          </button>
          <button
            type="button"
            onClick={() => activeProduct && onUseInBuilder?.(activeProduct)}
            disabled={!activeProduct}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-accent disabled:opacity-50"
          >
            <RotateCcw size={13} />
            Builder
          </button>
          <a
            href={shopUrl || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!shopUrl}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white ${
              shopUrl ? 'bg-accent shadow-pink-glow' : 'pointer-events-none bg-white/10 opacity-55'
            }`}
          >
            <ShoppingBag size={13} />
            Shop
          </a>
        </div>
      }
    >
      {activeProduct ? (
        <div className="grid grid-cols-[116px_1fr] gap-3">
          <div className="h-[148px] overflow-hidden rounded-[24px] border border-[#eadfd5] bg-[#fff7ef]">
            <ProductImage product={activeProduct} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-3" size="lg" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[.14em] text-accent">{activeProduct.brand}</div>
            <div className="mt-1 font-serif text-[23px] font-semibold leading-[1.02] text-white">{activeProduct.name}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-white/64">
                {activeProduct.category}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-white/64">
                {formatPrice(activeProduct.priceCents)}
              </span>
              {activeProduct.vibes?.slice(0, 1).map((vibe) => (
                <span key={vibe} className="rounded-full border border-accent/22 bg-accent/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-accent">
                  {vibe}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onAddToCloset?.(activeProduct)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white"
            >
              <Shirt size={13} />
              Add to closet
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-white/52">Shop the fit</div>
          <div className="text-[12px] font-semibold text-accent">{formatPrice(calculateOutfitTotal(items))}</div>
        </div>
        <div className="mt-3 space-y-2">
          {products.map((product) => (
            <ProductTile
              key={product.id}
              product={product}
              compact
              actionLabel={getProductOutboundUrl(product) ? 'Shop' : 'Use'}
              onClick={() => setSelectedId(product.id)}
            />
          ))}
        </div>
      </div>

      {activeProduct && !shopUrl ? (
        <div className="mt-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-3 text-[12px] leading-relaxed text-white/56">
          Retail link unavailable for this catalog item. The piece stays in the outfit and can still be saved, remixed, or added to closet.
        </div>
      ) : activeProduct ? (
        <a
          href={shopUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-white/68"
        >
          Open retailer
          <ArrowUpRight size={13} />
        </a>
      ) : null}
    </BottomSheet>
  );
}

