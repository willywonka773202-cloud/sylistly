'use client';

import { ProductImage } from '@/components/ProductImage';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

/**
 * Worn-silhouette flat lay — the outfit arranged as if an invisible person is
 * wearing it: headwear up top, outer + top layered side-by-side at the torso,
 * bottoms flowing down the middle, shoes at the feet, bag/jewelry floating at
 * the sides. Subtle rotations + drop shadows give each piece weight; pieces
 * settle in with a dress-order stagger when the card becomes active.
 */

interface Zone {
  left: number;
  top: number;
  w: number;
  h: number;
  z: number;
  rot: number;
}

/** The order a person gets dressed — drives the entrance stagger. */
const DRESS_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'hat', 'eyewear', 'bag', 'jewelry'];

function zonesFor(hasOuter: boolean, hasHeadwear: boolean): Partial<Record<Category, Zone>> {
  const torsoTop = hasHeadwear ? 20 : 8;
  const bottomTop = torsoTop + 27; // pants tuck up under the torso layers
  const shoesTop = Math.min(86.5, bottomTop + 34);
  return {
    hat: { left: 36, top: 1, w: 28, h: 13, z: 30, rot: 0 },
    eyewear: { left: 39, top: 14.5, w: 22, h: 7.5, z: 31, rot: 1.5 },
    outer: { left: 1, top: torsoTop, w: 51, h: 37, z: 21, rot: -2 },
    top: hasOuter
      ? { left: 45, top: torsoTop + 1.5, w: 49, h: 36, z: 22, rot: 2 }
      : { left: 27, top: torsoTop, w: 46, h: 38, z: 22, rot: 0 },
    jewelry: { left: 3.5, top: torsoTop + 31, w: 14, h: 10, z: 33, rot: -6 },
    bag: { left: 77, top: torsoTop + 28, w: 21, h: 18, z: 26, rot: 4 },
    bottom: { left: 28, top: bottomTop, w: 42, h: 40, z: 12, rot: 0 },
    shoes: { left: 37, top: shoesTop, w: 27, h: 12.5, z: 18, rot: -2 },
  };
}

export function WornFlatlay({
  items,
  active = true,
  loading = 'lazy',
  className = '',
}: {
  items: Partial<Record<Category, Product>> | Product[];
  /** When the card snaps into view, pieces settle in with a stagger. */
  active?: boolean;
  loading?: 'lazy' | 'eager';
  className?: string;
}) {
  const list = Array.isArray(items)
    ? items
    : Object.values(items).filter((product): product is Product => Boolean(product));
  const products = list.filter((product) => isEditorialCutoutProduct(product));
  const byCategory = new Map(products.map((product) => [product.category, product]));
  if (products.length < 3) return null;

  const zones = zonesFor(byCategory.has('outer'), byCategory.has('hat') || byCategory.has('eyewear'));
  const staggered = DRESS_ORDER.map((category) => byCategory.get(category)).filter(
    (product): product is Product => Boolean(product),
  );

  return (
    <div
      role="img"
      aria-label={`Outfit of ${products.length} pieces laid out as worn`}
      className={`relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF5EF_100%)] ${className}`}
    >
      {/* floor shadow under the shoes grounds the whole silhouette */}
      <div
        aria-hidden
        className="absolute bottom-[2.5%] left-1/2 h-[3.5%] w-[56%] -translate-x-1/2 rounded-[100%] bg-[#1c120d]/[.07] blur-md"
        style={{ zIndex: 5 }}
      />
      {staggered.map((product, index) => {
        const zone = zones[product.category];
        if (!zone) return null;
        return (
          <div
            key={product.id}
            className="absolute"
            style={{
              left: `${zone.left}%`,
              top: `${zone.top}%`,
              width: `${zone.w}%`,
              height: `${zone.h}%`,
              zIndex: zone.z,
              transform: `rotate(${zone.rot}deg)`,
            }}
          >
            <div
              className={active ? 'sy-piece-in h-full w-full' : 'h-full w-full opacity-0'}
              style={active ? { animationDelay: `${index * 70}ms` } : undefined}
            >
              <ProductImage
                product={product}
                transparentOnly
                loading={loading}
                wrapperClassName="h-full w-full"
                className="h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(24,12,10,.16)]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
