'use client';

import { useState } from 'react';
import { proxiedImageUrl } from '@/lib/image-url';
import type { Product } from '@/lib/types';

export function getCleanProductImageUrl(product: Product, cutout = true): string {
  if (!product.imageUrl) return '';
  return cutout
    ? proxiedImageUrl(product.imageUrl, { cutout: true, category: product.category })
    : proxiedImageUrl(product.imageUrl);
}

export function ProductImage({ product, className, wrapperClassName }: { product: Product; className?: string; wrapperClassName?: string }) {
  const [cutout, setCutout] = useState(true);
  const src = getCleanProductImageUrl(product, cutout);

  return (
    <div className={wrapperClassName || 'relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe8_100%)]'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={className || 'h-full w-full object-contain p-2.5'}
        onError={() => setCutout(false)}
      />
    </div>
  );
}
