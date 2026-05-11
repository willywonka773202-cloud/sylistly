'use client';

import { ProductImage } from '@/components/ProductImage';
import { calculateOutfitTotal, getOutfitProducts, formatPrice } from '@/lib/catalog-health';
import type { Category, Product } from '@/lib/types';

export function OutfitThumbnail({
  items,
  title,
  subtitle,
  className = '',
  onClick,
}: {
  items: Partial<Record<Category, Product>>;
  title?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}) {
  const products = getOutfitProducts(items).slice(0, 5);
  const hero = products[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045] text-left shadow-[0_18px_46px_rgba(0,0,0,.24)] transition active:scale-[.985] ${className}`}
    >
      <div className="relative h-44 bg-[#fff7ef]">
        {hero ? (
          <ProductImage product={hero} wrapperClassName="absolute inset-0 h-full w-full" className="h-full w-full object-contain p-5" size="lg" />
        ) : (
          <div className="grid h-full place-items-center text-[11px] font-bold uppercase tracking-[.16em] text-[#7c6b61]">
            Build fit
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 flex gap-2">
          {products.slice(1, 5).map((product) => (
            <div key={product.id} className="h-12 w-11 overflow-hidden rounded-2xl border border-[#eadfd5] bg-white shadow-[0_8px_18px_rgba(0,0,0,.16)]">
              <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5" size="sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="p-3">
        <div className="line-clamp-1 font-serif text-[18px] font-semibold leading-tight text-white">{title || 'Catalog outfit'}</div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-white/52">
          <span>{subtitle || `${products.length} pieces`}</span>
          <span>{formatPrice(calculateOutfitTotal(items))}</span>
        </div>
      </div>
    </button>
  );
}

