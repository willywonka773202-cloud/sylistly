'use client';

import { useEffect, useState } from 'react';
import { Footprints, Gem, Glasses, Layers, Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import { proxiedImageUrl } from '@/lib/image-url';
import { hasUsableProductImage } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

/**
 * Display mode system for product photography across the app.
 *
 * Every mode controls TWO surfaces: the outer `wrapper` (background +
 * shadow + radius) and the inner `image` (padding + object-fit).  The
 * goal is consistent, premium clothing display whether the original
 * source has a transparent cutout or a hard white retail background.
 *
 * We do NOT perform background removal here — that would require
 * server-side image processing we haven't shipped. Instead we rely on
 * (a) object-contain padding so products never get cropped, (b) soft
 * neutral / radial gradients so a hard white background blends into
 * the page instead of looking like a harsh box, and (c) consistent
 * shadows that make pieces feel like floating cutouts even when they
 * aren't truly transparent.
 *
 * Modes:
 *   default     — generic catalog tile, neutral warm background
 *   cutout      — floating product, transparent-feel, radial soft shadow under product
 *   closet      — premium closet grid tile (Wardrobe), clean light gradient, larger padding
 *   moodboard   — collage/outfit-board card, slight rotation-ready, dramatic soft shadow
 *   hero        — large feature image (feed/build hero), maximum breathing room
 *   thumbnail   — compact preview (chat, lists), tight padding, smaller shadow
 *
 * Callers can still pass `wrapperClassName` / `className` to override
 * any mode — the mode is just a strong sensible default.
 */
export type ProductImageDisplayMode =
  | 'default'
  | 'cutout'
  | 'closet'
  | 'moodboard'
  | 'hero'
  | 'thumbnail';

interface DisplayModeStyle {
  wrapper: string;
  image: string;
  /** Padding scale by category — accessories want less padding than tops/outer. */
  paddingByCategory?: Partial<Record<Category, string>>;
}

const MODE_STYLES: Record<ProductImageDisplayMode, DisplayModeStyle> = {
  default: {
    wrapper:
      'relative h-full w-full overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe8_100%)]',
    image: 'h-full w-full object-contain p-2.5',
  },
  cutout: {
    // Floating-product look: soft warm radial behind the piece, no hard
    // edges, drop-shadow under the image so it reads as elevated even on
    // images that have a baked-in white background.
    wrapper:
      'relative h-full w-full overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_50%_42%,#fffdf7_0%,#f5ece1_55%,#e8dccd_100%)] ring-1 ring-[#eadfd5]/55 shadow-[inset_0_1px_0_rgba(255,255,255,.6)]',
    image:
      'h-full w-full object-contain p-3.5 drop-shadow-[0_18px_18px_rgba(60,32,18,.18)]',
    paddingByCategory: {
      shoes: 'p-3 drop-shadow-[0_18px_18px_rgba(60,32,18,.22)]',
      jewelry: 'p-5 drop-shadow-[0_12px_14px_rgba(60,32,18,.16)]',
      eyewear: 'p-4 drop-shadow-[0_14px_16px_rgba(60,32,18,.16)]',
      hat: 'p-3.5 drop-shadow-[0_16px_18px_rgba(60,32,18,.2)]',
    },
  },
  closet: {
    // Premium closet tile: clean warm gradient, generous padding so
    // products feel like they're hanging in a real closet rather than
    // packed into a thumbnail.
    wrapper:
      'relative h-full w-full overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#fffaf2_0%,#f0e7da_100%)] ring-1 ring-[#e8dccd]/70 shadow-[inset_0_1px_0_rgba(255,255,255,.5)]',
    image: 'h-full w-full object-contain p-3 drop-shadow-[0_12px_14px_rgba(60,32,18,.14)]',
    paddingByCategory: {
      shoes: 'p-2.5 drop-shadow-[0_14px_16px_rgba(60,32,18,.18)]',
      jewelry: 'p-4 drop-shadow-[0_8px_10px_rgba(60,32,18,.12)]',
      eyewear: 'p-3.5 drop-shadow-[0_10px_12px_rgba(60,32,18,.14)]',
    },
  },
  moodboard: {
    // Outfit-board collage card: warm cream background, stronger soft
    // shadow so the piece pops off the moodboard without looking
    // photo-cropped.
    wrapper:
      'relative h-full w-full overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#fffdf6_0%,#f3e9da_100%)] ring-1 ring-[#eadfd5]/55 shadow-[inset_0_1px_0_rgba(255,255,255,.55)]',
    image:
      'h-full w-full object-contain p-3 drop-shadow-[0_20px_22px_rgba(60,32,18,.22)]',
    paddingByCategory: {
      shoes: 'p-2.5 drop-shadow-[0_22px_22px_rgba(60,32,18,.26)]',
      bag: 'p-3 drop-shadow-[0_18px_20px_rgba(60,32,18,.22)]',
    },
  },
  hero: {
    // Feature image — soft warm background, maximum breathing room,
    // strong but soft shadow so the hero feels editorial.
    wrapper:
      'relative h-full w-full overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_30%_25%,#fffdf6_0%,#f6ecdc_45%,#dac9b3_100%)] ring-1 ring-[#eadfd5]/60',
    image:
      'h-full w-full object-contain p-5 drop-shadow-[0_28px_28px_rgba(60,32,18,.26)]',
    paddingByCategory: {
      shoes: 'p-4 drop-shadow-[0_32px_30px_rgba(60,32,18,.3)]',
      bag: 'p-5 drop-shadow-[0_28px_28px_rgba(60,32,18,.26)]',
    },
  },
  thumbnail: {
    // Compact preview — used in chat bubbles, key-piece strips, lists.
    wrapper:
      'relative h-full w-full overflow-hidden rounded-[14px] bg-[linear-gradient(180deg,#fff8ee_0%,#efe4d4_100%)] ring-1 ring-[#eadfd5]/50',
    image: 'h-full w-full object-contain p-1.5',
  },
};

const TRANSPARENT_MODE_STYLES: Record<ProductImageDisplayMode, DisplayModeStyle> = {
  default: {
    wrapper: 'relative h-full w-full overflow-visible rounded-2xl bg-transparent',
    image: 'h-full w-full object-contain p-3 drop-shadow-[0_18px_18px_rgba(60,32,18,.2)]',
  },
  cutout: {
    wrapper: 'relative h-full w-full overflow-visible rounded-[24px] bg-transparent',
    image: 'h-full w-full object-contain p-3 drop-shadow-[0_22px_20px_rgba(60,32,18,.24)]',
    paddingByCategory: {
      shoes: 'p-2.5 drop-shadow-[0_22px_20px_rgba(60,32,18,.26)]',
      jewelry: 'p-4 drop-shadow-[0_14px_16px_rgba(60,32,18,.18)]',
      eyewear: 'p-3.5 drop-shadow-[0_14px_16px_rgba(60,32,18,.18)]',
      bag: 'p-3 drop-shadow-[0_20px_20px_rgba(60,32,18,.24)]',
    },
  },
  closet: {
    wrapper: 'relative h-full w-full overflow-visible rounded-[20px] bg-transparent',
    image: 'h-full w-full object-contain p-3.5 drop-shadow-[0_18px_18px_rgba(60,32,18,.18)]',
    paddingByCategory: {
      shoes: 'p-2.5 drop-shadow-[0_18px_18px_rgba(60,32,18,.2)]',
      jewelry: 'p-4 drop-shadow-[0_12px_14px_rgba(60,32,18,.14)]',
      eyewear: 'p-3.5 drop-shadow-[0_12px_14px_rgba(60,32,18,.14)]',
    },
  },
  moodboard: {
    wrapper: 'relative h-full w-full overflow-visible rounded-[22px] bg-transparent',
    image: 'h-full w-full object-contain p-3 drop-shadow-[0_26px_24px_rgba(60,32,18,.26)]',
    paddingByCategory: {
      shoes: 'p-2 drop-shadow-[0_28px_24px_rgba(60,32,18,.3)]',
      bag: 'p-2.5 drop-shadow-[0_24px_22px_rgba(60,32,18,.26)]',
    },
  },
  hero: {
    wrapper: 'relative h-full w-full overflow-visible rounded-[28px] bg-transparent',
    image: 'h-full w-full object-contain p-5 drop-shadow-[0_34px_32px_rgba(60,32,18,.3)]',
    paddingByCategory: {
      shoes: 'p-4 drop-shadow-[0_36px_34px_rgba(60,32,18,.32)]',
      bag: 'p-5 drop-shadow-[0_32px_30px_rgba(60,32,18,.28)]',
    },
  },
  thumbnail: {
    wrapper: 'relative h-full w-full overflow-visible rounded-[14px] bg-transparent',
    image: 'h-full w-full object-contain p-1.5 drop-shadow-[0_8px_10px_rgba(60,32,18,.16)]',
  },
};

export function getCleanProductImageUrl(product: Product, cutout = false): string {
  if (!hasUsableProductImage(product)) return '';
  return cutout
    ? proxiedImageUrl(product.imageUrl, { cutout: true, category: product.category })
    : proxiedImageUrl(product.imageUrl);
}

/**
 * Prefer a true transparent-background asset when one is present in the
 * catalog record. Modes that lean cutout/moodboard/hero get the most
 * benefit. Default/thumbnail/closet can also use it — there's no downside
 * for the user when it exists.
 *
 * If `imageTransparentUrl` is missing, returns null and callers fall back
 * to the proxied original `imageUrl`. We do NOT claim background removal
 * has happened just because we asked — only when the field actually
 * carries a URL.
 */
function pickTransparentUrl(product: Product): string | null {
  const candidate = product.imageTransparentUrl || product.imageCutoutUrl;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('data:')) return null;
  return trimmed;
}

export function ProductImage({
  product,
  className,
  wrapperClassName,
  loading = 'lazy',
  displayMode = 'default',
  onAvailable,
  onUnavailable,
}: {
  product: Product;
  /** Override the inner image className. Takes precedence over displayMode's image style. */
  className?: string;
  /** Override the outer wrapper className. Takes precedence over displayMode's wrapper style. */
  wrapperClassName?: string;
  loading?: 'lazy' | 'eager';
  /** Curated styling preset — applied when className/wrapperClassName not overridden. */
  displayMode?: ProductImageDisplayMode;
  onAvailable?: (product: Product) => void;
  onUnavailable?: (product: Product) => void;
}) {
  const [imageOk, setImageOk] = useState(hasUsableProductImage(product));
  const [cutoutTried, setCutoutTried] = useState(false);
  const [transparentFailed, setTransparentFailed] = useState(false);

  // Resolve which URL to actually fetch this render. We honestly prefer
  // a transparent asset when one exists in the catalog record — and we
  // surface that via a `data-image-kind` attribute on the <img>. If the
  // transparent URL fails to load, we transparently fall back to the
  // original (one-shot, tracked via state) so a broken cutout never
  // breaks the entire tile.
  const transparentUrl = !transparentFailed ? pickTransparentUrl(product) : null;
  const originalSrc = getCleanProductImageUrl(product, cutoutTried);
  const src = transparentUrl ?? originalSrc;
  const imageKind: 'transparent' | 'original' = transparentUrl ? 'transparent' : 'original';

  useEffect(() => {
    setImageOk(hasUsableProductImage(product));
    setCutoutTried(false);
    setTransparentFailed(false);
  }, [product.id, product.imageUrl]);

  const mode = MODE_STYLES[displayMode] ?? MODE_STYLES.default;
  const transparentMode = TRANSPARENT_MODE_STYLES[displayMode] ?? TRANSPARENT_MODE_STYLES.default;
  const activeMode = imageKind === 'transparent' ? transparentMode : mode;
  const resolvedWrapperClass = wrapperClassName || activeMode.wrapper;
  const resolvedImageClass =
    className || activeMode.paddingByCategory?.[product.category] || activeMode.image;

  if (!imageOk || !src) {
    return (
      <div className={resolvedWrapperClass} data-image-kind={imageKind} data-display-mode={displayMode}>
        <CategoryFallback product={product} className={className} />
      </div>
    );
  }

  return (
    <div className={resolvedWrapperClass} data-image-kind={imageKind} data-display-mode={displayMode}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        loading={loading}
        referrerPolicy="no-referrer"
        // `data-image-kind` is observable from devtools and route-smoke
        // checks — it proves whether a real transparent asset was
        // rendered, without making any user-facing cutout claim.
        data-image-kind={imageKind}
        className={resolvedImageClass}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth < 32 || image.naturalHeight < 32) {
            setImageOk(false);
            return;
          }
          onAvailable?.(product);
        }}
        onError={() => {
          // First fallback: if we tried the transparent asset and it
          // failed, switch to the original.  Tracked via state so we
          // don't loop.
          if (imageKind === 'transparent' && !transparentFailed) {
            setTransparentFailed(true);
            return;
          }
          if (cutoutTried) {
            setCutoutTried(false);
            return;
          }
          setImageOk(false);
          onUnavailable?.(product);
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
          Image unavailable
        </div>
      </div>
    </div>
  );
}
