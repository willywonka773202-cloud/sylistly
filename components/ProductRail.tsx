'use client';

import { ProductImage } from '@/components/ProductImage';
import { formatPrice } from '@/lib/catalog-health';
import type { Product } from '@/lib/types';

export function ProductRail({
  products,
  onProductClick,
  className = '',
  max = 8,
}: {
  products: Product[];
  onProductClick?: (product: Product) => void;
  className?: string;
  max?: number;
}) {
  const visibleProducts = products.slice(0, max);
  if (!visibleProducts.length) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${className}`}>
      {visibleProducts.map((product) => (
        <button
          key={product.id}
          type="button"
          onClick={() => onProductClick?.(product)}
          className="group w-[72px] flex-none overflow-hidden rounded-[18px] border border-[#eadfd5] bg-[#fff7ef] p-1.5 text-left shadow-[0_12px_28px_rgba(0,0,0,.22)] transition active:scale-[.97]"
          aria-label={`View ${product.brand} ${product.name}`}
        >
          <div className="h-[68px] overflow-hidden rounded-[14px] bg-white">
            <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5 transition group-active:scale-95" />
          </div>
          <div className="mt-1 truncate text-[8px] font-black uppercase tracking-[.1em] text-[#7d695f]">{product.category}</div>
          <div className="truncate text-[10px] font-bold text-[#221d19]">{product.brand}</div>
          <div className="text-[9px] font-semibold text-[#a13b67]">{formatPrice(product.priceCents)}</div>
        </button>
      ))}
    </div>
  );
}
