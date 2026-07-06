'use client';

import { ProductImage } from '@/components/ProductImage';
import { isTransparentRenderableProduct } from '@/lib/product-image-quality';
import type { Product } from '@/lib/types';
import type { OutfitPost } from '@/store/posts';

/** Read-only render of a composed post — pieces at their hand-arranged %
 *  placements. Shared by the profile grid thumbnails and the full-size viewer. */
export function PostCanvas({ post, className }: { post: OutfitPost; className?: string }) {
  const pieces = (Object.values(post.items) as Array<Product | undefined>).filter(
    (product): product is Product => Boolean(product && isTransparentRenderableProduct(product)),
  );

  return (
    <div
      className={`relative overflow-hidden bg-[radial-gradient(130%_100%_at_50%_0%,rgba(231,199,155,.09),transparent_55%),linear-gradient(180deg,rgba(20,19,22,.92),rgba(12,11,13,.94))] ${className || ''}`}
      style={{ aspectRatio: '4 / 5' }}
    >
      {pieces.map((product) => {
        const place = post.layout[product.id] || { xPct: 50, yPct: 50, scale: 1, z: 1 };
        return (
          <div
            key={product.id}
            className="absolute h-[42%] w-[42%]"
            style={{
              left: `${place.xPct}%`,
              top: `${place.yPct}%`,
              zIndex: place.z,
              transform: `translate(-50%, -50%) scale(${place.scale})`,
              filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.4))',
            }}
          >
            <ProductImage product={product} transparentOnly displayMode="cutout" className="h-full w-full object-contain" />
          </div>
        );
      })}
    </div>
  );
}
