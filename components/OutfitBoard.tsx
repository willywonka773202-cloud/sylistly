'use client';

import { ProductImage } from '@/components/ProductImage';
import { isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

const BOARD_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

const SLOT_STYLES: Record<Category, string> = {
  outer: 'left-[4%] top-[14%] h-[38%] w-[33%] rotate-[-2deg]',
  top: 'left-[35%] top-[8%] h-[31%] w-[34%] rotate-[1deg]',
  bottom: 'left-[31%] top-[39%] h-[37%] w-[38%] rotate-[-1deg]',
  shoes: 'left-[26%] bottom-[3%] h-[18%] w-[47%] rotate-[1deg]',
  bag: 'right-[4%] top-[37%] h-[29%] w-[28%] rotate-[2deg]',
  hat: 'left-[5%] top-[3%] h-[18%] w-[28%] rotate-[-3deg]',
  eyewear: 'right-[4%] top-[7%] h-[18%] w-[28%] rotate-[3deg]',
  jewelry: 'right-[9%] bottom-[16%] h-[17%] w-[23%] rotate-[-2deg]',
};

const IMAGE_PADDING: Record<Category, string> = {
  outer: 'p-2',
  top: 'p-2',
  bottom: 'p-2',
  shoes: 'p-1.5',
  bag: 'p-2',
  hat: 'p-1.5',
  eyewear: 'p-2',
  jewelry: 'p-2.5',
};

export function outfitBoardProducts(items: Partial<Record<Category, Product>> | Product[]): Product[] {
  const products = Array.isArray(items) ? items : BOARD_ORDER.map((category) => items[category]).filter(Boolean);
  return products.filter((product): product is Product => isHighConfidenceRenderableProduct(product));
}

export function OutfitBoard({
  items,
  className = '',
  onImageUnavailable,
}: {
  items: Partial<Record<Category, Product>> | Product[];
  className?: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const products = outfitBoardProducts(items);
  const byCategory = new Map(products.map((product) => [product.category, product]));
  const visibleSlots = BOARD_ORDER.filter((category) => byCategory.has(category));

  if (visibleSlots.length < 3) return null;

  return (
    <div className={`relative overflow-hidden rounded-[32px] border border-[#eadfd5] bg-[radial-gradient(circle_at_30%_18%,#fffdf8_0%,#fff7ec_45%,#f2e4d7_100%)] shadow-[0_28px_70px_rgba(0,0,0,.38)] ${className}`}>
      <div className="absolute inset-3 rounded-[26px] border border-[#eadfd5]/80 bg-white/24" />
      <div className="absolute left-5 top-5 text-[8px] font-bold uppercase tracking-[.22em] text-[#9a7460]">Outfit formula</div>
      {visibleSlots.map((category) => {
        const product = byCategory.get(category);
        if (!product) return null;
        return (
          <div
            key={`${category}-${product.id}`}
            className={`absolute overflow-hidden rounded-[22px] bg-white/58 shadow-[0_16px_28px_rgba(99,68,45,.13)] ring-1 ring-[#eadfd5]/80 backdrop-blur-sm ${SLOT_STYLES[category]}`}
          >
            <ProductImage
              product={product}
              wrapperClassName="h-full w-full"
              className={`h-full w-full object-contain ${IMAGE_PADDING[category]}`}
              onUnavailable={onImageUnavailable}
            />
          </div>
        );
      })}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent_0%,rgba(236,219,203,.42)_100%)]" />
    </div>
  );
}
