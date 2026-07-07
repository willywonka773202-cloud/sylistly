'use client';

import { ProductImage } from '@/components/ProductImage';
import PlatePieceFloat from '@/components/PlatePieceFloat';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

/**
 * Editorial COLLAGE flat-lay — a tight, curated Polyvore/Pinterest-style set.
 * Pieces are packed CLOSE so they fill the frame (no sparse plate), each in its
 * own fixed cell so they read as separate-but-cohesive, not a muddy pile: hat +
 * glasses across the top, jacket + top as the torso cluster, bottoms + bag in
 * the mid, shoes + a little jewelry at the foot. Hero garments are largest; the
 * tiered shadows keep neighbouring pieces cleanly distinct. Slight rotations
 * give it the hand-arranged moodboard feel. Pieces settle in with a dress-order
 * stagger when the card is active.
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
 * DYNAMIC collage pack (Pinterest-masonry). Only the pieces actually present
 * are laid out, so the set is always TIGHT and FULL — never scattered with the
 * gaps a fixed grid leaves when a slot is empty. Pieces are balanced across two
 * columns (hero garments first, by weight) and each column packs top→bottom to
 * fill the height; bigger `weight` = a taller cell = a larger piece. A little
 * per-cell rotation + horizontal nudge gives the hand-arranged moodboard feel;
 * the tiered shadows keep neighbours distinct. No two cells overlap.
 */
const COLLAGE_WEIGHT: Record<Category, number> = {
  top: 1.55,
  bottom: 1.5,
  outer: 1.4,
  bag: 1.0,
  shoes: 0.88,
  hat: 0.64,
  eyewear: 0.52,
  jewelry: 0.54,
};
// Hero garments placed first so the two columns balance around them.
const COLLAGE_ORDER: Category[] = ['top', 'bottom', 'outer', 'bag', 'shoes', 'hat', 'eyewear', 'jewelry'];

function computeCollage(
  present: Set<Category>,
  /** % of plate height to keep clear at the BOTTOM (e.g. for a caption overlay
   *  that sits over the plate, as on the feed). Pieces pack into the region
   *  above it so the whole outfit stays VISIBLE instead of hiding behind the
   *  caption. 0 = use the full height (Discover/Saved label outside the plate). */
  bottomReserve = 0,
): Partial<Record<Category, Zone>> {
  const ordered = COLLAGE_ORDER.filter((category) => present.has(category));
  // 4+ pieces → two brick-staggered columns (a packed moodboard). 3 or fewer →
  // a single centred column (a clean stacked trio reads better than a lopsided
  // 1-vs-2 split). Greedy balance drops each next-biggest piece into the shorter column.
  const twoCols = ordered.length >= 4;
  const columns: Category[][] = [[], []];
  if (twoCols) {
    const weights = [0, 0];
    for (const category of ordered) {
      const target = weights[0] <= weights[1] ? 0 : 1;
      columns[target].push(category);
      weights[target] += COLLAGE_WEIGHT[category];
    }
  } else {
    columns[0] = ordered;
  }
  const TOP = 2;
  const BOTTOM = 98 - Math.max(0, Math.min(60, bottomReserve));
  const GAP = 1.6;
  const colWidth = twoCols ? 48 : 76;
  const colLeft = twoCols ? [2, 50] : [12, 12];
  const colStagger = twoCols ? [0, 7] : [0, 0];
  const layout: Partial<Record<Category, Zone>> = {};
  columns.forEach((column, ci) => {
    if (!column.length) return;
    const sum = column.reduce((acc, category) => acc + COLLAGE_WEIGHT[category], 0) || 1;
    const start = TOP + colStagger[ci];
    const usable = BOTTOM - start - GAP * Math.max(0, column.length - 1);
    let cursor = start;
    column.forEach((category, ri) => {
      const h = (COLLAGE_WEIGHT[category] / sum) * usable;
      const swing = (ri + ci) % 2 === 0 ? -1 : 1;
      layout[category] = {
        left: colLeft[ci] + swing * 1.5,
        top: cursor,
        w: colWidth,
        h,
        // small accessories ride above larger garments where they brush past
        z: 12 + (COLLAGE_WEIGHT[category] < 0.8 ? 20 : 0) + ri,
        rot: swing * 4,
      };
      cursor += h + GAP;
    });
  });
  return layout;
}

/** Pieces that sit ON TOP of others get the deeper, softer shadow tier. */
const LIFTED = new Set<Category>(['top', 'shoes', 'hat', 'eyewear', 'bag', 'jewelry']);

/**
 * Plate backdrops. `greige` is the editorial Pinterest plate (the feed default).
 * `spotlight` is a warm STUDIO-GREY stage for hero reveals (the Daily Drop):
 * a mid-tone seamless backdrop (the photographer's trick) so BOTH white/cream
 * AND black/dark garments separate cleanly — neither vanishes the way they do on
 * an all-light (greige) or all-dark plate. Edges fall off darker for drama.
 */
const PLATE: Record<'greige' | 'spotlight', string> = {
  greige: 'bg-[radial-gradient(135%_115%_at_50%_18%,#F4F0E8_0%,#ECE6DB_56%,#DED4C3_100%)]',
  spotlight: 'bg-[radial-gradient(115%_85%_at_50%_26%,#46413b_0%,#2a2622_45%,#141211_100%)]',
};

export function WornFlatlay({
  items,
  active = true,
  loading = 'lazy',
  className = '',
  plate = 'greige',
  depth = false,
  bottomReserve = 0,
  onPieceClick,
}: {
  items: Partial<Record<Category, Product>> | Product[];
  /** When the card snaps into view, pieces settle in with a stagger. */
  active?: boolean;
  loading?: 'lazy' | 'eager';
  className?: string;
  /** Backdrop variant — `spotlight` is the dark hero stage for reveals. */
  plate?: 'greige' | 'spotlight';
  /** Float the garment layer as a true 3D group (perspective + per-piece
   *  translateZ + a subtle vitrine sway). Pure CSS — used on the feed plate. */
  depth?: boolean;
  /** % of plate height to keep clear at the bottom for a caption overlay that
   *  sits over the plate (the feed). Keeps the whole outfit above the caption. */
  bottomReserve?: number;
  /** When set, each garment becomes a tappable "shop the look" hotspot. */
  onPieceClick?: (product: Product) => void;
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
  const layout = computeCollage(new Set(byCategory.keys()), bottomReserve);

  return (
    <div
      role="img"
      aria-label={`Outfit of ${products.length} pieces arranged as a collage`}
      className={`relative overflow-hidden ${PLATE[plate]} ${className}`}
      style={depth ? { perspective: '1100px' } : undefined}
    >
      {plate === 'spotlight' ? (
        <>
          {/* champagne key light from above */}
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(72% 46% at 50% 13%, rgba(231,199,155,.17), transparent 62%)' }} />
          {/* glowing floor the pieces rest on */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%]" style={{ background: 'radial-gradient(78% 72% at 50% 100%, rgba(231,199,155,.10), transparent 72%)' }} />
          {/* vignette for vitrine drama */}
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(125% 105% at 50% 42%, transparent 54%, rgba(0,0,0,.55) 100%)' }} />
        </>
      ) : null}
      {depth ? <span aria-hidden data-on={active ? 'true' : 'false'} className="sy-plate-rake pointer-events-none absolute inset-0 z-[60]" /> : null}
      {depth ? <span aria-hidden className="sy-plate-sheen pointer-events-none absolute inset-0 z-[55]" /> : null}
      <div className={depth ? 'sy-vitrine-tilt absolute inset-0' : 'contents'}>
      <div className={depth ? 'sy-plate-breath sy-vitrine absolute inset-0' : 'contents'}>
      {staggered.map((product, index) => {
        const zone = layout[product.category];
        if (!zone) return null;
        const image = (
          <ProductImage
            product={product}
            transparentOnly
            loading={loading}
            wrapperClassName="h-full w-full"
            className={`h-full w-full object-contain ${
              LIFTED.has(product.category) ? 'sy-piece-shadow-lifted' : 'sy-piece-shadow'
            }`}
          />
        );
        // Depth-layered levitation: foreground pieces (high z) drift furthest,
        // each on its own period with a negative delay so the plate is mid-
        // motion on arrival and no two pieces ever bob in sync.
        const drift = {
          '--drift-amp': `${(2.2 + Math.min(zone.z, 33) * 0.11).toFixed(1)}px`,
          '--drift-x': `${(index % 2 === 0 ? 1 : -1) * (1 + (index % 3) * 0.6)}px`,
          '--drift-rot': `${(0.45 + (index % 3) * 0.35).toFixed(2)}deg`,
          '--drift-dur': `${(5.6 + ((index * 1.7) % 3.4)).toFixed(1)}s`,
          '--drift-delay': `${(-(index * 1.9) % 6).toFixed(1)}s`,
        } as React.CSSProperties;
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
              transform: `rotate(${zone.rot}deg)${depth ? ` translateZ(${Math.max(-45, Math.min(55, (zone.z - 16) * 3.2))}px)` : ''}`,
            }}
          >
            <div
              className={active ? 'sy-piece-dress h-full w-full' : 'h-full w-full'}
              style={active ? { animationDelay: `${Math.round(60 + index * index * 9)}ms` } : undefined}
            >
            <div className="sy-drift h-full w-full" style={drift}>
              {onPieceClick ? (
                <PlatePieceFloat
                  onActivate={() => onPieceClick(product)}
                  label={`Shop the ${product.brand} ${product.category}`}
                  disabled={!active}
                  idleFloat={LIFTED.has(product.category) ? 3 : 0}
                  maxTilt={10}
                  lift={LIFTED.has(product.category) ? 34 : 22}
                  shadowColor={plate === 'spotlight' ? 'rgba(0,0,0,.5)' : 'rgba(34,18,10,0.42)'}
                  className="sy-press block h-full w-full"
                >
                  {image}
                </PlatePieceFloat>
              ) : (
                image
              )}
            </div>
            </div>
          </div>
        );
      })}
      </div>
      </div>
    </div>
  );
}
