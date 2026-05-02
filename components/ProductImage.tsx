'use client';

import { useEffect, useState } from 'react';
import { proxiedImageUrl } from '@/lib/image-url';
import { hasUsableProductImage } from '@/lib/product-image-quality';
import type { Product } from '@/lib/types';

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
  onUnavailable,
}: {
  product: Product;
  className?: string;
  wrapperClassName?: string;
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
    return null;
  }

  return (
    <div className={wrapperClassName || 'relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe8_100%)]'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={className || 'h-full w-full object-contain p-2.5'}
        onError={() => {
          if (cutout) {
            setCutout(false);
            return;
          }
          setImageOk(false);
          onUnavailable?.(product);
        }}
      />
    </div>
  );
}
