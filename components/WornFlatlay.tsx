'use client';

import { ProductImage } from '@/components/ProductImage';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

/**
 * Worn-silhouette flat lay — the outfit arranged as if an invisible person is
 * wearing it. Every slot has a FIXED band and size regardless of which pieces
 * the outfit contains, so the silhouette never jumps or resizes between looks:
 * headwear up top, a centered torso (jacket behind, tee in front), bottoms
 * tucked under, shoes grounded at the feet, bag + jewelry floating at the
 * sides. Pieces settle in with a dress-order stagger when the card is active.
 */

interface Zone {
  /** left edge, % of plate width */
  left: number;
  /** top edge, % of plate height */
  top: number;
  w: number;
  h: number;
  z: number;
  rot: number;
}

/** The order a person gets dressed — drives the entrance stagger. */
const DRESS_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'hat', 'eyewear', 'bag', 'jewelry'];

/**
 * Fixed placement — identical for every outfit. A missing piece just leaves its
 * band empty; nothing else moves. Centered torso/bottom/shoes form the spine;
 * hat/eyewear stack on top; bag + jewelry float at the sides. (object-contain
 * keeps each cutout proportional within its box, so wide shoes and tall pants
 * both read at a consistent, intentional scale.)
 */
const ZONES: Record<Category, Zone> = {
  hat:     { left: 37, top: 1,  w: 26, h: 11, z: 30, rot: 0 },
  eyewear: { left: 41, top: 12, w: 18, h: 6.5, z: 31, rot: 1.5 },
  outer:   { left: 21, top: 17, w: 58, h: 33, z: 18, rot: -1 },
  top:     { left: 32, top: 20, w: 36, h: 28, z: 24, rot: 1 },
  jewelry: { left: 2,  top: 40, w: 14, h: 11, z: 33, rot: -5 },
  bag:     { left: 76, top: 43, w: 22, h: 18, z: 26, rot: 4 },
  bottom:  { left: 31, top: 47, w: 38, h: 31, z: 12, rot: 0 },
  shoes:   { left: 27, top: 79, w: 46, h: 18, z: 20, rot: -1 },
};

/** Pieces that sit ON TOP of others get the deeper, softer shadow tier. */
const LIFTED = new Set<Category>(['top', 'shoes', 'hat', 'eyewear', 'bag', 'jewelry']);

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

  const staggered = DRESS_ORDER.map((category) => byCategory.get(category)).filter(
    (product): product is Product => Boolean(product),
  );

  return (
    <div
      role="img"
      aria-label={`Outfit of ${products.length} pieces laid out as worn`}
      className={`relative overflow-hidden bg-[radial-gradient(125%_92%_at_50%_36%,#FFFDF9_0%,#F5F0E7_74%,#ECE5D8_100%)] ${className}`}
    >
      {/* contact shadow under the shoes — grounds the silhouette so pieces sit
          ON the plate rather than floating */}
      <div
        aria-hidden
        className="absolute bottom-[3%] left-1/2 h-[4%] w-[46%] -translate-x-1/2 rounded-[100%] bg-[#3a2418]/20 blur-[10px]"
        style={{ zIndex: 5 }}
      />
      {staggered.map((product, index) => {
        const zone = ZONES[product.category];
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
              className={active ? 'sy-piece-in h-full w-full' : 'h-full w-full'}
              style={active ? { animationDelay: `${index * 70}ms` } : undefined}
            >
              <ProductImage
                product={product}
                transparentOnly
                loading={loading}
                wrapperClassName="h-full w-full"
                className={`h-full w-full object-contain ${
                  LIFTED.has(product.category) ? 'sy-piece-shadow-lifted' : 'sy-piece-shadow'
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
