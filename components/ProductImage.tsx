'use client';

import { useEffect, useState } from 'react';
import { Footprints, Gem, Glasses, Layers, Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import { proxiedImageUrl } from '@/lib/image-url';
import { hasUsableProductImage } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

export function getCleanProductImageUrl(product: Product, cutout = false): string {
  if (!hasUsableProductImage(product)) return '';
  return cutout
    ? proxiedImageUrl(product.imageUrl, { cutout: true, category: product.category })
    : proxiedImageUrl(product.imageUrl);
}

export function ProductImage({
  product,
  className,
  wrapperClassName,
  loading = 'lazy',
  onAvailable,
  onUnavailable,
}: {
  product: Product;
  className?: string;
  wrapperClassName?: string;
  loading?: 'lazy' | 'eager';
  onAvailable?: (product: Product) => void;
  onUnavailable?: (product: Product) => void;
}) {
  const [imageOk, setImageOk] = useState(hasUsableProductImage(product));
  const [cutout, setCutout] = useState(false);
  const src = getCleanProductImageUrl(product, cutout);

  useEffect(() => {
    setImageOk(hasUsableProductImage(product));
    setCutout(false);
  }, [product.id, product.imageUrl]);

  if (!imageOk || !src) {
    return (
      <div className={wrapperClassName || 'relative h-full w-full overflow-hidden rounded-2xl'}>
        <CategoryFallback product={product} className={className} />
      </div>
    );
  }

  return (
    <div className={wrapperClassName || 'relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe8_100%)]'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        loading={loading}
        referrerPolicy="no-referrer"
        className={className || 'h-full w-full object-contain p-2.5'}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth < 32 || image.naturalHeight < 32) {
            setImageOk(false);
            return;
          }
          onAvailable?.(product);
        }}
        onError={() => {
          if (cutout) {
            setCutout(false);
            return;
          }
          setImageOk(false);
        }}
      />
    </div>
  );
}

const FALLBACK_COPY: Record<Category, { label: string; className: string; icon: typeof Shirt }> = {
  top: {
    label: 'Top',
    className: 'from-[#fff4ef] via-[#f9d8d0] to-[#d88b83] text-[#7d2d34]',
    icon: Shirt,
  },
  bottom: {
    label: 'Bottom',
    className: 'from-[#f4f7fb] via-[#d7e1ee] to-[#8ea2bd] text-[#223a55]',
    icon: Layers,
  },
  shoes: {
    label: 'Shoes',
    className: 'from-[#faf7f2] via-[#ded5c9] to-[#9b9285] text-[#3f3933]',
    icon: Footprints,
  },
  outer: {
    label: 'Outer',
    className: 'from-[#f7f1e8] via-[#ccd0cf] to-[#687277] text-[#273033]',
    icon: Layers,
  },
  bag: {
    label: 'Bag',
    className: 'from-[#fff5db] via-[#f1c983] to-[#b9792e] text-[#603814]',
    icon: ShoppingBag,
  },
  jewelry: {
    label: 'Jewelry',
    className: 'from-[#fff0f7] via-[#eab8d4] to-[#9a6390] text-[#56264d]',
    icon: Gem,
  },
  eyewear: {
    label: 'Eyewear',
    className: 'from-[#f7f4ef] via-[#d9d4ca] to-[#8b8275] text-[#332e29]',
    icon: Glasses,
  },
  hat: {
    label: 'Hat',
    className: 'from-[#f9f0df] via-[#dfc499] to-[#a56d36] text-[#563311]',
    icon: Sparkles,
  },
};

function CategoryFallback({ product, className }: { product: Product; className?: string }) {
  const fallback = FALLBACK_COPY[product.category] || FALLBACK_COPY.top;
  const Icon = fallback.icon;
  return (
    <div className={`grid h-full w-full place-items-center bg-gradient-to-br ${fallback.className} ${className || ''}`}>
      <div className="flex max-w-full flex-col items-center justify-center gap-2 px-2 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-current/20 bg-white/38 shadow-[0_10px_30px_rgba(0,0,0,.12)]">
          <Icon size={21} strokeWidth={1.8} />
        </div>
        <div className="text-[10px] font-black uppercase tracking-[.18em]">{fallback.label}</div>
        <div className="line-clamp-2 max-w-[13ch] text-[9px] font-semibold leading-tight opacity-78">
          {product.brand}
        </div>
      </div>
    </div>
  );
}
