'use client';

import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import {
  hasHighCategoryConfidence,
  isEditorialCutoutProduct,
  isFeedHeroCandidate,
  isRenderableProductForFeed,
  sortTransparentFeedRenderableProducts,
  productImageQualityScore,
} from '@/lib/product-image-quality';
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

const STACKED_FIT_ORDER: Category[] = ['bottom', 'top', 'outer', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

const STACKED_FIT_SLOT_STYLES: Record<Category, string> = {
  outer: 'left-[9%] top-[19%] h-[43%] w-[34%] rotate-[-7deg] z-[30]',
  top: 'left-[34%] top-[16%] h-[33%] w-[36%] rotate-[.5deg] z-[44]',
  bottom: 'left-[32%] top-[39%] h-[43%] w-[39%] rotate-[-.5deg] z-[34]',
  shoes: 'left-[26%] bottom-[2%] h-[18%] w-[50%] rotate-[1deg] z-[58]',
  bag: 'right-[5%] top-[37%] h-[28%] w-[26%] rotate-[5deg] z-[62]',
  hat: 'left-[39%] top-[2%] h-[15%] w-[26%] rotate-[-3deg] z-[70]',
  eyewear: 'right-[14%] top-[15%] h-[10%] w-[22%] rotate-[4deg] z-[72]',
  jewelry: 'right-[12%] top-[61%] h-[11%] w-[16%] rotate-[-5deg] z-[74]',
};

const STACKED_FIT_COMPACT_SLOT_STYLES: Record<Category, string> = {
  outer: 'left-[7%] top-[20%] h-[42%] w-[36%] rotate-[-7deg] z-[30]',
  top: 'left-[33%] top-[17%] h-[33%] w-[38%] rotate-[.5deg] z-[44]',
  bottom: 'left-[31%] top-[41%] h-[42%] w-[41%] rotate-[-.5deg] z-[34]',
  shoes: 'left-[23%] bottom-[1%] h-[19%] w-[55%] rotate-[1deg] z-[58]',
  bag: 'right-[3%] top-[39%] h-[28%] w-[28%] rotate-[5deg] z-[62]',
  hat: 'left-[38%] top-[2%] h-[15%] w-[28%] rotate-[-3deg] z-[70]',
  eyewear: 'right-[12%] top-[16%] h-[10%] w-[24%] rotate-[4deg] z-[72]',
  jewelry: 'right-[10%] top-[62%] h-[11%] w-[17%] rotate-[-5deg] z-[74]',
};

const STACKED_FIT_MOTION_CLASSES: Record<Category, string> = {
  outer: 'sy-fit-float-soft [animation-delay:-1.2s]',
  top: 'sy-fit-float [animation-delay:-.2s]',
  bottom: 'sy-fit-float-soft [animation-delay:-2.1s]',
  shoes: 'sy-fit-float-soft [animation-delay:-3.4s]',
  bag: 'sy-fit-float [animation-delay:-2.8s]',
  hat: 'sy-fit-float-soft [animation-delay:-.9s]',
  eyewear: 'sy-fit-float-soft [animation-delay:-2.5s]',
  jewelry: 'sy-fit-float [animation-delay:-3.1s]',
};

const STACKED_FIT_IMAGE_CLASSES: Record<Category, string> = {
  hat: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_20px_16px_rgba(0,0,0,.26)]',
  eyewear: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_16px_14px_rgba(0,0,0,.28)]',
  outer: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_38px_30px_rgba(0,0,0,.36)]',
  top: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_30px_24px_rgba(0,0,0,.3)]',
  bottom: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_34px_28px_rgba(0,0,0,.3)]',
  bag: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_28px_22px_rgba(0,0,0,.34)]',
  jewelry: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_16px_12px_rgba(0,0,0,.3)]',
  shoes: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_30px_20px_rgba(0,0,0,.34)]',
};

const FITS_AI_FLATLAY_ORDER: Category[] = ['bottom', 'top', 'outer', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];
// Grid display order — the lead category (top, else outer) fills the big 2x2
// hero cell; everything else flows into uniform cells after it.
const FLATLAY_GRID_ORDER: Category[] = ['top', 'outer', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

// Cohesive "worn silhouette" flat lay: a centered head-to-toe column (hat → top
// → bottom → shoes) with outerwear layered to the left and accessories tucked to
// the right. z-order is anatomical and CONSISTENT across every variant so the
// hat and accessories always sit ON TOP and never disappear behind a garment.
// Layering rule: bottom(20) < outer(30) < top(40) < shoes(55) < bag(60) <
// jewelry(64) < hat(70) < eyewear(74).
const FITS_AI_FLATLAY_SLOT_STYLES: Record<Category, string> = {
  hat: 'left-[35%] top-[1%] h-[18%] w-[30%] rotate-[-3deg] z-[70]',
  eyewear: 'right-[13%] top-[20%] h-[9%] w-[22%] rotate-[5deg] z-[74]',
  outer: 'left-[3%] top-[23%] h-[44%] w-[40%] rotate-[-6deg] z-[30]',
  top: 'left-[33%] top-[20%] h-[34%] w-[39%] rotate-[1deg] z-[40]',
  bottom: 'left-[32%] top-[47%] h-[40%] w-[40%] rotate-[-1deg] z-[20]',
  shoes: 'left-[27%] bottom-[2%] h-[19%] w-[46%] rotate-[1deg] z-[55]',
  bag: 'right-[3%] top-[45%] h-[31%] w-[27%] rotate-[5deg] z-[60]',
  jewelry: 'left-[7%] top-[70%] h-[12%] w-[16%] rotate-[-6deg] z-[64]',
};

// No outerwear: widen the top and recenter so the column stays balanced.
const FITS_AI_FLATLAY_NO_OUTER_SLOT_STYLES: Record<Category, string> = {
  outer: FITS_AI_FLATLAY_SLOT_STYLES.outer,
  hat: 'left-[35%] top-[1%] h-[18%] w-[30%] rotate-[-3deg] z-[70]',
  eyewear: 'right-[14%] top-[19%] h-[9%] w-[23%] rotate-[5deg] z-[74]',
  top: 'left-[29%] top-[18%] h-[37%] w-[42%] rotate-[.5deg] z-[40]',
  bottom: 'left-[30%] top-[48%] h-[40%] w-[40%] rotate-[-1deg] z-[20]',
  shoes: 'left-[27%] bottom-[2%] h-[19%] w-[46%] rotate-[1deg] z-[55]',
  bag: 'right-[4%] top-[44%] h-[30%] w-[26%] rotate-[5deg] z-[60]',
  jewelry: 'left-[8%] top-[40%] h-[12%] w-[16%] rotate-[-6deg] z-[64]',
};

const FITS_AI_FLATLAY_COMPACT_SLOT_STYLES: Record<Category, string> = {
  hat: 'left-[36%] top-[2%] h-[16%] w-[28%] rotate-[-3deg] z-[70]',
  eyewear: 'right-[13%] top-[20%] h-[8%] w-[23%] rotate-[5deg] z-[74]',
  outer: 'left-[3%] top-[24%] h-[42%] w-[40%] rotate-[-6deg] z-[30]',
  top: 'left-[33%] top-[21%] h-[33%] w-[40%] rotate-[1deg] z-[40]',
  bottom: 'left-[32%] top-[48%] h-[39%] w-[40%] rotate-[-1deg] z-[20]',
  shoes: 'left-[28%] bottom-[2%] h-[18%] w-[44%] rotate-[1deg] z-[55]',
  bag: 'right-[3%] top-[46%] h-[29%] w-[27%] rotate-[5deg] z-[60]',
  jewelry: 'left-[8%] top-[70%] h-[11%] w-[16%] rotate-[-6deg] z-[64]',
};

const FITS_AI_FLATLAY_SNEAKER_LED_SLOT_STYLES: Record<Category, string> = {
  outer: 'left-[9%] top-[34%] h-[34%] w-[34%] rotate-[-5deg] z-[28]',
  top: 'left-[12%] top-[16%] h-[30%] w-[34%] rotate-[2deg] z-[36]',
  bottom: 'right-[11%] top-[32%] h-[39%] w-[35%] rotate-[-.5deg] z-[22]',
  shoes: 'left-[19%] bottom-[2%] h-[25%] w-[62%] rotate-[1deg] z-[58]',
  bag: 'right-[8%] top-[10%] h-[23%] w-[27%] rotate-[5deg] z-[60]',
  hat: 'left-[39%] top-[2%] h-[16%] w-[29%] rotate-[-3deg] z-[70]',
  eyewear: 'right-[18%] top-[21%] h-[9%] w-[23%] rotate-[4deg] z-[74]',
  jewelry: 'left-[13%] top-[57%] h-[12%] w-[17%] rotate-[-6deg] z-[64]',
};

const FITS_AI_FLATLAY_HERO_TOP_SLOT_STYLES: Record<Category, string> = {
  outer: 'left-[10%] top-[18%] h-[42%] w-[39%] rotate-[-4deg] z-[28]',
  top: 'right-[14%] top-[11%] h-[44%] w-[43%] rotate-[1deg] z-[40]',
  bottom: 'left-[30%] top-[42%] h-[45%] w-[43%] rotate-[-.5deg] z-[22]',
  shoes: 'left-[20%] bottom-[0%] h-[25%] w-[60%] rotate-[1deg] z-[56]',
  bag: 'right-[4%] top-[43%] h-[29%] w-[28%] rotate-[5deg] z-[60]',
  hat: 'left-[34%] top-[2%] h-[16%] w-[31%] rotate-[-3deg] z-[70]',
  eyewear: 'right-[15%] top-[17%] h-[9%] w-[25%] rotate-[4deg] z-[74]',
  jewelry: 'left-[12%] top-[58%] h-[12%] w-[18%] rotate-[-6deg] z-[64]',
};

const FITS_AI_FLATLAY_IMAGE_CLASSES: Record<Category, string> = {
  hat: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_18px_15px_rgba(24,18,28,.18)]',
  eyewear: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_14px_12px_rgba(24,18,28,.18)]',
  outer: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_24px_22px_rgba(24,18,28,.2)]',
  top: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_23px_21px_rgba(24,18,28,.19)]',
  bottom: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_24px_22px_rgba(24,18,28,.18)]',
  bag: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_24px_20px_rgba(24,18,28,.2)]',
  jewelry: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_14px_12px_rgba(24,18,28,.17)]',
  shoes: 'h-full w-full object-contain object-center p-0 drop-shadow-[0_25px_18px_rgba(24,18,28,.22)]',
};

const FEED_SUPPORT_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];
const BOOT_TERMS = ['boot', 'boots', 'chelsea', 'ugg'];
const LOW_PROFILE_SHOE_TERMS = ['samba', 'sneaker', 'sneakers', 'trainer', 'trainers', 'court shoe', 'running shoe'];
const FLAT_SHOE_TERMS = ['loafer', 'loafers', 'flat', 'flats', 'sandal', 'sandals', 'slide', 'slides', 'mule', 'mules'];
const HEEL_TERMS = ['heel', 'heels', 'pump', 'pumps', 'slingback', 'stiletto'];
const CAP_TERMS = ['baseball cap', 'dad cap', 'cap'];
const BEANIE_TERMS = ['beanie', 'watch cap', 'skullcap'];
const BUCKET_HAT_TERMS = ['bucket hat', 'bucket'];
const WIDE_HAT_TERMS = ['sun hat', 'straw hat', 'wide brim', 'wide-brim'];
const TOTE_TERMS = ['tote', 'shopper'];
const MINI_BAG_TERMS = ['mini', 'micro', 'pouch', 'wallet', 'clutch'];
const SHORT_BOTTOM_TERMS = ['short', 'shorts', 'skort', 'mini skirt'];
const SKIRT_BOTTOM_TERMS = ['skirt', 'midi skirt', 'maxi skirt', 'slip skirt'];
const LONG_BOTTOM_TERMS = ['jean', 'jeans', 'pant', 'pants', 'trouser', 'trousers', 'wide leg', 'wide-leg'];
const JEWELRY_SMALL_TERMS = ['ring', 'earring', 'earrings', 'bracelet'];
const JEWELRY_TALL_TERMS = ['necklace', 'chain', 'pendant'];

type FeedLayoutVariant = 'hero-left' | 'hero-top' | 'sneaker-led';

type FeedContext = {
  formulaId?: string;
  formulaLabel?: string;
  layoutVariant?: FeedLayoutVariant;
};

type OutfitPresentation = 'flatlay' | 'stacked' | 'silhouette' | 'studio';

const SNEAKER_LED_FORMULAS = new Set([
  'streetwear-sneaker-led',
  'campus-cozy',
  'gym-training',
  'active-errands',
  'techwear-utility',
]);

const HERO_TOP_FORMULAS = new Set([
  'vacation-resort',
  'travel-airport',
  'date-polished',
  'night-out',
]);

export function outfitBoardProducts(items: Partial<Record<Category, Product>> | Product[]): Product[] {
  const products = Array.isArray(items) ? items : BOARD_ORDER.map((category) => items[category]).filter(Boolean);
  return sortTransparentFeedRenderableProducts(products.filter((product): product is Product => Boolean(product)));
}

export function OutfitBoard({
  items,
  className = '',
  onImageUnavailable,
  variant = 'builder',
  feedContext,
}: {
  items: Partial<Record<Category, Product>> | Product[];
  className?: string;
  onImageUnavailable?: (product: Product) => void;
  variant?: 'builder' | 'feed';
  feedContext?: FeedContext;
}) {
  const products = outfitBoardProducts(items);
  const byCategory = new Map(products.map((product) => [product.category, product]));
  const visibleSlots = BOARD_ORDER.filter((category) => byCategory.has(category));

  if (visibleSlots.length < 3) return null;
  if (variant === 'feed') {
    return (
      <FeedOutfitBoard
        products={products}
        byCategory={byCategory}
        className={className}
        onImageUnavailable={onImageUnavailable}
        feedContext={feedContext}
      />
    );
  }

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
            className={`absolute overflow-visible rounded-[22px] bg-transparent ${SLOT_STYLES[category]}`}
          >
            <ProductImage
              product={product}
              transparentOnly
              wrapperClassName="h-full w-full overflow-visible bg-transparent"
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

export function OutfitLookCard({
  items,
  title,
  subtitle,
  className = '',
  compact = false,
  tilt = false,
  productLinks = true,
  showMeta = false,
  loading = 'lazy',
  onImageUnavailable,
  feedContext,
  presentation = 'flatlay',
}: {
  items: Partial<Record<Category, Product>> | Product[];
  title?: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
  tilt?: boolean;
  productLinks?: boolean;
  showMeta?: boolean;
  loading?: 'lazy' | 'eager';
  onImageUnavailable?: (product: Product) => void;
  feedContext?: FeedContext;
  presentation?: OutfitPresentation;
}) {
  // Every presentation renders bare cutouts on a light canvas (flat lay /
  // stacked / studio), so only surface clean garment cutouts — never a
  // full-body model photo or a product whose cutout is missing/low quality.
  // (This is what makes the flat-lay / Pinterest look read as clean.)
  const products = outfitBoardProducts(items).filter((product) => isEditorialCutoutProduct(product));
  const byCategory = new Map(products.map((product) => [product.category, product]));
  const visibleSlots = BOARD_ORDER.filter((category) => byCategory.has(category));

  if (visibleSlots.length < 3) return null;

  const label = [title, subtitle].filter(Boolean).join(' ') || 'Assembled outfit';

  if (presentation === 'stacked') {
    return (
      <StackedFitCanvas
        products={products}
        title={title}
        subtitle={subtitle}
        className={`${tilt ? 'rotate-[-1deg]' : ''} ${className}`}
        compact={compact}
        productLinks={productLinks}
        showMeta={showMeta}
        loading={loading}
        ariaLabel={label}
        onImageUnavailable={onImageUnavailable}
      />
    );
  }

  if (presentation === 'silhouette') {
    return (
      <SilhouetteFitCard
        products={products}
        title={title}
        subtitle={subtitle}
        className={`${tilt ? 'rotate-[-1deg]' : ''} ${className}`}
        productLinks={productLinks}
        showMeta={showMeta}
        loading={loading}
        ariaLabel={label}
        onImageUnavailable={onImageUnavailable}
      />
    );
  }

  if (presentation === 'studio') {
    // Only place clean GARMENT cutouts on the form (isEditorialCutoutProduct
    // excludes body-model/full-body/bad-cutout images) so the studio is never
    // gappy and never shows a stray model photo. If there aren't enough for a
    // complete look, fall through to the flat lay, which composes a sparse set
    // more gracefully than a dress form with holes.
    const studioProducts = products.filter((product) => isEditorialCutoutProduct(product));
    if (studioProducts.length >= 3) {
      return (
        <StudioFitCard
          products={studioProducts}
          title={title}
          subtitle={subtitle}
          className={`${tilt ? 'rotate-[-1deg]' : ''} ${className}`}
          productLinks={productLinks}
          showMeta={showMeta}
          loading={loading}
          ariaLabel={label}
          onImageUnavailable={onImageUnavailable}
        />
      );
    }
  }

  return (
    <FitsAiOutfitCanvas
      products={products}
      title={title}
      subtitle={subtitle}
      className={`${tilt ? 'rotate-[-1deg]' : ''} ${className}`}
      compact={compact}
      productLinks={productLinks}
      showMeta={showMeta}
      loading={loading}
      ariaLabel={label}
      onImageUnavailable={onImageUnavailable}
      feedContext={feedContext}
    />
  );
}

export function StackedFitCanvas({
  products,
  title,
  subtitle,
  className = '',
  compact = false,
  productLinks = true,
  showMeta = false,
  loading = 'lazy',
  ariaLabel,
  onImageUnavailable,
}: {
  products: Product[];
  title?: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
  productLinks?: boolean;
  showMeta?: boolean;
  loading?: 'lazy' | 'eager';
  ariaLabel?: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const byCategory = new Map(products.map((product) => [product.category, product]));
  const renderSlots = STACKED_FIT_ORDER.filter((category) => byCategory.has(category)).slice(0, compact ? 7 : 8);
  const slotStyles = compact ? STACKED_FIT_COMPACT_SLOT_STYLES : STACKED_FIT_SLOT_STYLES;
  const label = ariaLabel || [title, subtitle].filter(Boolean).join(' ') || 'Layered transparent outfit';

  if (renderSlots.length < 3) return null;

  return (
    <article
      className={`relative isolate h-full min-h-[180px] overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.07)_0%,rgba(255,255,255,.025)_50%,rgba(255,255,255,.045)_100%)] shadow-[0_30px_76px_rgba(0,0,0,.38)] ${className}`}
      aria-label={label}
      data-stacked-fit-canvas
      data-stacked-fit-count={renderSlots.length}
      data-stacked-fit-transparent="true"
      data-fit-scale-system="silhouette-v3"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,.12),transparent_42%),linear-gradient(140deg,rgba(255,255,255,.13)_0%,transparent_34%,rgba(0,0,0,.2)_100%)]" />
      <div className="pointer-events-none absolute left-[30%] top-[11%] h-[78%] w-[43%] rounded-full border border-white/[.055] bg-white/[.025] blur-[1px]" />
      <div className="pointer-events-none absolute left-[5%] top-[18%] h-[48%] w-[36%] rounded-[42px] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.06),transparent_68%)]" />
      <div className="pointer-events-none absolute right-[4%] top-[32%] h-[42%] w-[30%] rounded-[42px] bg-[radial-gradient(circle_at_50%_45%,rgba(246,48,107,.1),transparent_68%)]" />
      <div className="pointer-events-none absolute inset-x-[19%] bottom-[5%] h-[17%] rounded-full bg-black/35 blur-2xl" />
      <div className="pointer-events-none absolute inset-x-[25%] bottom-[2%] h-px bg-white/10" />

      {renderSlots.map((category) => {
        const product = byCategory.get(category);
        if (!product) return null;
        return (
          <ProductTileLink
            key={`${category}-${product.id}-stacked`}
            product={product}
            className={`absolute block overflow-visible transition-transform duration-200 ease-out hover:scale-[1.035] ${slotStyles[category]}`}
            disabled={!productLinks}
            fitSlot={category}
          >
            <span className={`block h-full w-full overflow-visible bg-transparent ${STACKED_FIT_MOTION_CLASSES[category]}`}>
              <ProductImage
                product={product}
                transparentOnly
                loading={loading}
                displayMode={compact ? 'thumbnail' : 'moodboard'}
                wrapperClassName="h-full w-full overflow-visible bg-transparent"
                className={stackedFitImageClass(product)}
                onUnavailable={onImageUnavailable}
              />
            </span>
            <span className="sr-only">{product.brand} {product.name}</span>
          </ProductTileLink>
        );
      })}

      {showMeta && (title || subtitle) ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[22px] border border-white/10 bg-black/42 px-3 py-2 text-white shadow-[0_14px_32px_rgba(0,0,0,.28)] backdrop-blur-md">
          {subtitle ? (
            <div className="truncate text-[8px] font-black uppercase tracking-[.18em] text-accent">{subtitle}</div>
          ) : null}
          {title ? <div className="mt-0.5 truncate text-[14px] font-semibold tracking-tight">{title}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

export function FitsAiOutfitCanvas({
  products,
  title,
  subtitle,
  className = '',
  productLinks = false,
  compact = false,
  showMeta = false,
  loading = 'lazy',
  ariaLabel,
  onImageUnavailable,
  feedContext,
}: {
  products: Product[];
  title?: string;
  subtitle?: string;
  className?: string;
  productLinks?: boolean;
  compact?: boolean;
  showMeta?: boolean;
  loading?: 'lazy' | 'eager';
  ariaLabel?: string;
  onImageUnavailable?: (product: Product) => void;
  feedContext?: FeedContext;
}) {
  const byCategory = new Map(products.map((product) => [product.category, product]));
  // Center the hero (top, else outer — usually the on-model shot) with the
  // remaining pieces flanking it in left + right columns. The "model + pieces"
  // editorial look, identical on every fit: each piece is contained, nothing
  // overlaps, and a full-body photo simply fills the tall center column.
  const ordered = FLATLAY_GRID_ORDER.filter((category) => byCategory.has(category)).slice(0, compact ? 7 : 9);
  const [heroCategory, ...flankCategories] = ordered;
  const leftCategories = flankCategories.filter((_, i) => i % 2 === 0);
  const rightCategories = flankCategories.filter((_, i) => i % 2 === 1);
  const label = ariaLabel || [title, subtitle].filter(Boolean).join(' ') || 'Editorial transparent outfit flat lay';

  if (ordered.length < 3) return null;

  const renderPiece = (category: Category, isHero: boolean) => {
    const product = byCategory.get(category);
    if (!product) return null;
    return (
      <ProductTileLink
        key={`${category}-${product.id}-fits-ai`}
        product={product}
        className={`group relative flex min-h-0 min-w-0 items-center justify-center overflow-visible transition-transform duration-200 ease-out hover:scale-[1.04] ${isHero ? 'h-full w-full' : 'w-full flex-1'}`}
        disabled={!productLinks}
      >
        <ProductImage
          product={product}
          transparentOnly
          loading={loading}
          displayMode="moodboard"
          wrapperClassName="flex h-full w-full items-center justify-center overflow-visible bg-transparent"
          className={`h-full w-full object-contain ${isHero ? 'p-0.5 drop-shadow-[0_18px_20px_rgba(0,0,0,.16)]' : 'p-0 drop-shadow-[0_10px_12px_rgba(0,0,0,.14)]'}`}
          onUnavailable={onImageUnavailable}
        />
        <span className="sr-only">{product.brand} {product.name}</span>
      </ProductTileLink>
    );
  };

  return (
    <article
      className={`relative isolate h-full min-h-[220px] overflow-hidden rounded-[30px] border border-[#ece7df] bg-[linear-gradient(180deg,#fff_0%,#fbfaf7_58%,#f4efe8_100%)] shadow-[0_24px_54px_rgba(42,28,21,.14)] ${className}`}
      aria-label={label}
      data-fits-ai-canvas
      data-fits-ai-canvas-count={ordered.length}
      data-fits-ai-transparent="true"
      data-fits-ai-layout="center-hero"
      data-fits-ai-formula={feedContext?.formulaId || 'unknown'}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(255,248,240,.92)_0%,rgba(255,255,255,0)_62%)]" />
      <div className="pointer-events-none absolute inset-x-[24%] bottom-[6%] h-px bg-black/5" />
      <div className={`relative flex h-full w-full items-stretch ${compact ? 'gap-1 px-2 py-2.5' : 'gap-1.5 px-3 py-3.5'}`}>
        <div className="flex w-[33%] flex-col items-center justify-center gap-1.5">
          {leftCategories.map((category) => renderPiece(category, false))}
        </div>
        <div className="flex w-[34%] items-center justify-center">
          {heroCategory ? renderPiece(heroCategory, true) : null}
        </div>
        <div className="flex w-[33%] flex-col items-center justify-center gap-1.5">
          {rightCategories.map((category) => renderPiece(category, false))}
        </div>
      </div>

      {showMeta && (title || subtitle) ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[20px] border border-black/5 bg-white/72 px-3 py-2 text-[#171118] shadow-[0_14px_32px_rgba(40,28,54,.1)] backdrop-blur-md">
          {subtitle ? (
            <div className="truncate text-[8px] font-black uppercase tracking-[.18em] text-accent">{subtitle}</div>
          ) : null}
          {title ? <div className="mt-0.5 truncate text-[14px] font-semibold tracking-tight">{title}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

// ─────────────────────────────────────────────────────────
// Ghost-mannequin / silhouette outfit card
// ─────────────────────────────────────────────────────────

// Zone geometry: percentage of the card container.
// Outer is widest (shoulder-to-shoulder + arm area); top sits inside it;
// bottom continues below the waist; shoes anchor the bottom.
// z-order: bottom(20) < outer(30) < top(40) < shoes(55) < bag(60) < jewelry(64) < hat(70) < eyewear(74)
const SILHOUETTE_SLOT: Record<Category, string> = {
  outer:   'left-[3%]  top-[18%] h-[42%] w-[94%] z-[30]',
  top:     'left-[20%] top-[20%] h-[32%] w-[60%] z-[40]',
  bottom:  'left-[21%] top-[47%] h-[34%] w-[58%] z-[20]',
  shoes:   'left-[15%] top-[78%] h-[22%] w-[70%] z-[55]',
  bag:     'left-[65%] top-[27%] h-[30%] w-[32%] z-[60]',
  hat:     'left-[29%] top-[0%]  h-[18%] w-[42%] z-[70]',
  eyewear: 'left-[31%] top-[7%]  h-[10%] w-[38%] z-[74]',
  jewelry: 'left-[33%] top-[13%] h-[9%]  w-[34%] z-[64]',
};

// Slight per-slot drop shadows so items feel layered / 3-D
const SILHOUETTE_SHADOW: Record<Category, string> = {
  outer:   'drop-shadow-[0_28px_22px_rgba(0,0,0,.28)]',
  top:     'drop-shadow-[0_22px_18px_rgba(0,0,0,.26)]',
  bottom:  'drop-shadow-[0_24px_18px_rgba(0,0,0,.22)]',
  shoes:   'drop-shadow-[0_18px_14px_rgba(0,0,0,.3)]',
  bag:     'drop-shadow-[0_20px_16px_rgba(0,0,0,.28)]',
  hat:     'drop-shadow-[0_14px_12px_rgba(0,0,0,.22)]',
  eyewear: 'drop-shadow-[0_10px_8px_rgba(0,0,0,.18)]',
  jewelry: 'drop-shadow-[0_10px_8px_rgba(0,0,0,.18)]',
};

// Minimal SVG mannequin body — ghost silhouette, 8 % opacity
function MannequinSvg() {
  return (
    <svg
      viewBox="0 0 100 220"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="h-full w-full"
    >
      {/* head */}
      <ellipse cx="50" cy="14" rx="14.5" ry="16" />
      {/* neck */}
      <path d="M44.5 28.5 L55.5 28.5 L57 37 L43 37 Z" />
      {/* left shoulder / arm */}
      <path d="M43 37 L38 37 Q22 40 16 52 L18 100 Q24 97 30 100 L34 46 Z" />
      {/* right shoulder / arm */}
      <path d="M57 37 L62 37 Q78 40 84 52 L82 100 Q76 97 70 100 L66 46 Z" />
      {/* torso center */}
      <path d="M38 37 L62 37 L64 100 L36 100 Z" />
      {/* waist → hip flare */}
      <path d="M34 100 L66 100 L70 118 L30 118 Z" />
      {/* left leg */}
      <path d="M30 118 L50 118 L51 205 L28 205 Z" />
      {/* right leg */}
      <path d="M50 118 L70 118 L72 205 L49 205 Z" />
      {/* left foot */}
      <ellipse cx="40" cy="208" rx="13" ry="5.5" />
      {/* right foot */}
      <ellipse cx="60" cy="208" rx="13" ry="5.5" />
    </svg>
  );
}

const SILHOUETTE_RENDER_ORDER: Category[] = ['bottom', 'outer', 'top', 'shoes', 'bag', 'jewelry', 'hat', 'eyewear'];

export function SilhouetteFitCard({
  products,
  title,
  subtitle,
  className = '',
  productLinks = true,
  showMeta = false,
  loading = 'lazy',
  ariaLabel,
  onImageUnavailable,
}: {
  products: Product[];
  title?: string;
  subtitle?: string;
  className?: string;
  productLinks?: boolean;
  showMeta?: boolean;
  loading?: 'lazy' | 'eager';
  ariaLabel?: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const byCategory = new Map(products.map((p) => [p.category, p]));
  const renderSlots = SILHOUETTE_RENDER_ORDER.filter((cat) => byCategory.has(cat));
  const label = ariaLabel || [title, subtitle].filter(Boolean).join(' ') || 'Outfit on mannequin';

  if (renderSlots.length < 3) return null;

  return (
    <article
      className={`relative isolate h-full min-h-[260px] overflow-hidden rounded-[30px] border border-[#ede5da] bg-[linear-gradient(175deg,#fffdf9_0%,#f7f0e8_55%,#ede4d8_100%)] shadow-[0_24px_54px_rgba(42,28,21,.18)] ${className}`}
      aria-label={label}
      data-silhouette-fit-card
      data-silhouette-count={renderSlots.length}
    >
      {/* ambient glow layers */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,rgba(255,245,230,.88)_0%,transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-[22%] bottom-[6%] h-[14%] rounded-full bg-[#2d1a10]/8 blur-2xl" />

      {/* ghost mannequin body */}
      <div
        className="pointer-events-none absolute inset-x-[26%] top-[2%] h-[94%] opacity-[0.07]"
        style={{ fill: '#6b4f3a' }}
      >
        <MannequinSvg />
      </div>

      {/* clothing items layered on the body */}
      {renderSlots.map((category) => {
        const product = byCategory.get(category);
        if (!product) return null;
        const outboundUrl = productLinks ? getProductOutboundUrl(product) : null;
        const imageEl = (
          <ProductImage
            product={product}
            transparentOnly
            loading={loading}
            displayMode="moodboard"
            wrapperClassName="h-full w-full overflow-visible bg-transparent"
            className={`h-full w-full object-contain p-0 ${SILHOUETTE_SHADOW[category]}`}
            onUnavailable={onImageUnavailable}
          />
        );
        return outboundUrl ? (
          <a
            key={`${category}-${product.id}-sil`}
            href={outboundUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Shop ${product.brand} ${product.name}`}
            className={`absolute block overflow-visible transition-transform duration-200 ease-out hover:scale-[1.03] ${SILHOUETTE_SLOT[category]}`}
          >
            {imageEl}
          </a>
        ) : (
          <div
            key={`${category}-${product.id}-sil`}
            className={`absolute overflow-visible ${SILHOUETTE_SLOT[category]}`}
          >
            {imageEl}
          </div>
        );
      })}

      {/* meta overlay */}
      {showMeta && (title || subtitle) ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[20px] border border-black/6 bg-white/70 px-3 py-2 text-[#171118] shadow-[0_12px_28px_rgba(40,28,54,.12)] backdrop-blur-md">
          {subtitle ? (
            <div className="truncate text-[8px] font-black uppercase tracking-[.18em] text-accent">{subtitle}</div>
          ) : null}
          {title ? <div className="mt-0.5 truncate text-[14px] font-semibold tracking-tight">{title}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

// ─────────────────────────────────────────────────────────
// Studio "retail display" presentation
// Garments worn on a tailor's dress form (centre-left); shoes + bag float on
// cream pedestals (right rail); hat/eyewear/jewelry sit as accents. Cream studio
// backdrop + spotlight + soft floor shadow → the editorial look from the mockups.
// ─────────────────────────────────────────────────────────

// Worn garments are CENTRED on the form (the form spans ~22-66% horizontally).
const STUDIO_WORN_SLOT: Partial<Record<Category, string>> = {
  outer:  'left-[13%] top-[15%] h-[52%] w-[62%] z-[30]',
  top:    'left-[24%] top-[17%] h-[42%] w-[40%] z-[40]',
  bottom: 'left-[25%] top-[46%] h-[40%] w-[38%] z-[20]',
};

const STUDIO_ACCENT_SLOT: Partial<Record<Category, string>> = {
  hat:     'left-[30%] top-[1%]  h-[16%] w-[28%] z-[70]',
  eyewear: 'left-[32%] top-[8%]  h-[8%]  w-[24%] z-[74]',
  jewelry: 'left-[34%] top-[14%] h-[7%]  w-[20%] z-[64]',
};

// Right-rail pedestals: { item placement, pedestal-disc placement }.
const STUDIO_PEDESTAL: Partial<Record<Category, { item: string; disc: string }>> = {
  bag:   { item: 'right-[6%] top-[22%] h-[24%] w-[28%] z-[60]', disc: 'right-[4%] top-[44%] h-[7%] w-[32%]' },
  shoes: { item: 'right-[5%] top-[56%] h-[17%] w-[33%] z-[60]', disc: 'right-[3%] top-[71%] h-[7%] w-[36%]' },
};

const STUDIO_RENDER_ORDER: Category[] = ['bottom', 'outer', 'top', 'jewelry', 'hat', 'eyewear', 'bag', 'shoes'];

// Tailor's dress form + thin gold stand. Subtle so it reads as a display even
// when a garment cutout doesn't perfectly align to it.
function DressFormSvg() {
  const torso = 'M45 30 Q31 31 28 45 Q25 61 31 79 Q34 92 40 100 L60 100 Q66 92 69 79 Q75 61 72 45 Q69 31 55 30 Z';
  return (
    <svg viewBox="0 0 100 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-full w-full">
      <defs>
        <linearGradient id="dressFormShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f0e3cf" />
          <stop offset="55%" stopColor="#e6d6bd" />
          <stop offset="100%" stopColor="#d4bf9f" />
        </linearGradient>
      </defs>
      {/* neck stub */}
      <path d="M46 18 L54 18 L55 30 L45 30 Z" fill="#e2d0b6" />
      {/* slim tailor's dress form: rounded shoulders → narrow waist, lit from the left */}
      <path d={torso} fill="url(#dressFormShade)" />
      <path d={torso} fill="none" stroke="#c6ad8c" strokeWidth="0.6" />
      {/* gold stand + base */}
      <rect x="48.7" y="100" width="2.6" height="92" rx="1.3" fill="#c9a45a" />
      <ellipse cx="50" cy="195" rx="17" ry="4.6" fill="#c9a45a" />
      <ellipse cx="50" cy="193.4" rx="17" ry="4.6" fill="#ddb96f" />
    </svg>
  );
}

function StudioPedestal({ className }: { className: string }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden="true">
      <div className="absolute inset-0 rounded-[50%] bg-[radial-gradient(ellipse_at_50%_38%,#fffdf9,#efe4d4_72%,#e3d4bf)] shadow-[0_14px_26px_rgba(60,42,28,.22)]" />
      <div className="absolute inset-x-[8%] top-[-3px] h-[6px] rounded-[50%] bg-white/70 blur-[1px]" />
    </div>
  );
}

export function StudioFitCard({
  products,
  title,
  subtitle,
  className = '',
  productLinks = true,
  showMeta = false,
  loading = 'lazy',
  ariaLabel,
  onImageUnavailable,
}: {
  products: Product[];
  title?: string;
  subtitle?: string;
  className?: string;
  productLinks?: boolean;
  showMeta?: boolean;
  loading?: 'lazy' | 'eager';
  ariaLabel?: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const byCategory = new Map(products.map((p) => [p.category, p]));
  const renderSlots = STUDIO_RENDER_ORDER.filter((cat) => byCategory.has(cat));
  const label = ariaLabel || [title, subtitle].filter(Boolean).join(' ') || 'Outfit studio display';

  if (renderSlots.length < 3) return null;

  return (
    <article
      className={`relative isolate h-full min-h-[300px] overflow-hidden rounded-[30px] border border-[#ece2d4] bg-[linear-gradient(180deg,#fffdf9_0%,#f8f1e8_52%,#ece0d0_100%)] shadow-[0_24px_56px_rgba(42,28,21,.2)] ${className}`}
      aria-label={label}
      data-studio-fit-card
      data-studio-count={renderSlots.length}
    >
      {/* spotlight + floor */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_44%_18%,rgba(255,248,236,.95)_0%,transparent_56%)]" />
      <div className="pointer-events-none absolute inset-x-[12%] bottom-[5%] h-[12%] rounded-[50%] bg-[#3a2414]/12 blur-2xl" />

      {/* dress form behind the worn garments (centre-left; right rail is for pedestals) */}
      <div className="pointer-events-none absolute left-[19%] top-[3%] h-[94%] w-[46%] drop-shadow-[0_18px_24px_rgba(60,42,28,.14)]">
        <DressFormSvg />
      </div>

      {/* pedestals (behind their items) */}
      {(['bag', 'shoes'] as const).map((cat) =>
        byCategory.has(cat) && STUDIO_PEDESTAL[cat] ? <StudioPedestal key={`ped-${cat}`} className={STUDIO_PEDESTAL[cat]!.disc} /> : null,
      )}

      {renderSlots.map((category) => {
        const product = byCategory.get(category);
        if (!product) return null;
        const placement = STUDIO_WORN_SLOT[category] || STUDIO_ACCENT_SLOT[category] || STUDIO_PEDESTAL[category]?.item;
        if (!placement) return null;
        const outboundUrl = productLinks ? getProductOutboundUrl(product) : null;
        const imageEl = (
          <ProductImage
            product={product}
            transparentOnly
            loading={loading}
            displayMode="moodboard"
            wrapperClassName="h-full w-full overflow-visible bg-transparent"
            className="h-full w-full object-contain p-0 drop-shadow-[0_20px_18px_rgba(0,0,0,.24)]"
            onUnavailable={onImageUnavailable}
          />
        );
        return outboundUrl ? (
          <a
            key={`${category}-${product.id}-studio`}
            href={outboundUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Shop ${product.brand} ${product.name}`}
            className={`absolute block overflow-visible transition-transform duration-200 ease-out hover:scale-[1.03] ${placement}`}
          >
            {imageEl}
          </a>
        ) : (
          <div key={`${category}-${product.id}-studio`} className={`absolute overflow-visible ${placement}`}>
            {imageEl}
          </div>
        );
      })}

      {showMeta && (title || subtitle) ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[20px] border border-black/6 bg-white/75 px-3 py-2 text-[#171118] shadow-[0_12px_28px_rgba(40,28,54,.12)] backdrop-blur-md">
          {subtitle ? <div className="truncate text-[8px] font-black uppercase tracking-[.18em] text-accent">{subtitle}</div> : null}
          {title ? <div className="mt-0.5 truncate text-[14px] font-semibold tracking-tight">{title}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

function isSneakerLedFormula(formulaId?: string): boolean {
  if (!formulaId) return false;
  return SNEAKER_LED_FORMULAS.has(formulaId);
}

function isHeroTopFormula(formulaId?: string): boolean {
  if (!formulaId) return false;
  return HERO_TOP_FORMULAS.has(formulaId);
}

function pickFeedLayoutVariant(
  formulaId: string | undefined,
  byCategory: Map<Category, Product>,
  hero: Product | null,
): FeedLayoutVariant {
  if (hero?.category === 'shoes') return 'sneaker-led';
  if (isSneakerLedFormula(formulaId) && byCategory.has('shoes')) return 'sneaker-led';
  if (isHeroTopFormula(formulaId)) return 'hero-top';
  return 'hero-left';
}

function chooseFeedHero(
  products: Product[],
  byCategory: Map<Category, Product>,
  context: FeedContext | undefined,
): Product | null {
  const sneakerLed = isSneakerLedFormula(context?.formulaId);
  // Sneaker-led formulas: shoes can lead the visual frame when the shoe
  // is a strong, high-confidence product. Without this, every gym /
  // streetwear / techwear card falls back to outer/top hero and the
  // formula's intent is invisible.
  if (sneakerLed) {
    const shoes = byCategory.get('shoes');
    if (shoes && isRenderableProductForFeed(shoes) && hasHighCategoryConfidence(shoes, 'shoes')) {
      return shoes;
    }
  }

  for (const category of ['outer', 'top', 'bottom'] as const) {
    const product = byCategory.get(category);
    if (product && isFeedHeroCandidate(product)) return product;
  }

  // Quality-scored fallback over renderable, hero-eligible products only.
  // No unconditional final fallback — we'd rather return null and let the
  // board hide than show a weak hero.
  const scored = products
    .filter(isRenderableProductForFeed)
    .filter((product) => isFeedHeroCandidate(product) || (sneakerLed && product.category === 'shoes'))
    .map((product) => ({ product, score: productImageQualityScore(product) + heroCategoryBoost(product.category, sneakerLed) }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.product ?? null;
}

function heroCategoryBoost(category: Category, sneakerLed: boolean): number {
  if (sneakerLed && category === 'shoes') return 20;
  if (category === 'outer') return 18;
  if (category === 'top') return 14;
  if (category === 'bottom') return 6;
  return 0;
}

function productText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.category,
    product.retailer,
    ...(product.searchTerms || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
  ].join(' ').toLowerCase();
}

function productHasTerm(product: Product, terms: string[]): boolean {
  const text = ` ${productText(product).replace(/[^a-z0-9]+/g, ' ')} `;
  return terms.some((term) => {
    const normalizedTerm = term.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return Boolean(normalizedTerm) && text.includes(` ${normalizedTerm} `);
  });
}

function adjustedShoeImageClass(product: Product, base: string, surface: 'stacked' | 'flatlay' | 'feed'): string {
  if (productHasTerm(product, BOOT_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[11%] scale-[.72]`;
    if (surface === 'flatlay') return `${base} translate-y-[10%] scale-[.74]`;
    return `${base} translate-y-[10%] scale-[.78]`;
  }
  if (productHasTerm(product, HEEL_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[8%] scale-[.82]`;
    if (surface === 'flatlay') return `${base} translate-y-[7%] scale-[.86]`;
    return `${base} translate-y-[7%] scale-[.88]`;
  }
  if (productHasTerm(product, FLAT_SHOE_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[7%] scale-[.86]`;
    if (surface === 'flatlay') return `${base} translate-y-[6%] scale-[.9]`;
    return `${base} translate-y-[7%] scale-[.9]`;
  }
  if (productHasTerm(product, LOW_PROFILE_SHOE_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[6%] scale-[.88]`;
    if (surface === 'flatlay') return `${base} translate-y-[6%] scale-[.93]`;
    return `${base} translate-y-[7%] scale-[.92]`;
  }
  if (surface === 'feed') return `${base} translate-y-[7%] scale-[.84]`;
  if (surface === 'flatlay') return `${base} translate-y-[7%] scale-[.88]`;
  return `${base} translate-y-[7%] scale-[.88]`;
}

function adjustedHatImageClass(product: Product, base: string, surface: 'stacked' | 'flatlay' | 'feed'): string {
  if (productHasTerm(product, BEANIE_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[5%] scale-[.9]`;
    return `${base} translate-y-[4%] scale-[.94]`;
  }
  if (productHasTerm(product, WIDE_HAT_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[4%] scale-[.82]`;
    return `${base} translate-y-[4%] scale-[.88]`;
  }
  if (productHasTerm(product, BUCKET_HAT_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[4%] scale-[.96]`;
    return `${base} translate-y-[4%] scale-[1]`;
  }
  if (productHasTerm(product, CAP_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[4%] scale-[1.04]`;
    return `${base} translate-y-[4%] scale-[1.08]`;
  }
  if (surface === 'feed') return `${base} translate-y-[4%] scale-[.92]`;
  return `${base} translate-y-[3%] scale-[.98]`;
}

function adjustedBagImageClass(product: Product, base: string, surface: 'stacked' | 'flatlay' | 'feed'): string {
  if (productHasTerm(product, TOTE_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[3%] scale-[.78]`;
    if (surface === 'flatlay') return `${base} translate-y-[3%] scale-[.82]`;
    return `${base} translate-y-[3%] scale-[.84]`;
  }
  if (productHasTerm(product, MINI_BAG_TERMS)) {
    if (surface === 'feed') return `${base} scale-[1]`;
    return `${base} scale-[1.04]`;
  }
  if (surface === 'feed') return `${base} scale-[.9]`;
  if (surface === 'flatlay') return `${base} scale-[.92]`;
  return `${base} scale-[.94]`;
}

function adjustedBottomImageClass(product: Product, base: string, surface: 'stacked' | 'flatlay' | 'feed'): string {
  if (productHasTerm(product, SHORT_BOTTOM_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[-2%] scale-[.78]`;
    if (surface === 'flatlay') return `${base} translate-y-[-3%] scale-[.82]`;
    return `${base} translate-y-[-2%] scale-[.84]`;
  }
  if (productHasTerm(product, SKIRT_BOTTOM_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[1%] scale-[.9]`;
    if (surface === 'flatlay') return `${base} translate-y-[1%] scale-[.94]`;
    return `${base} translate-y-[1%] scale-[.96]`;
  }
  if (productHasTerm(product, LONG_BOTTOM_TERMS)) {
    if (surface === 'feed') return `${base} translate-y-[2%] scale-[.98]`;
    if (surface === 'flatlay') return `${base} translate-y-[1%] scale-[1]`;
    return `${base} translate-y-[1%] scale-[1.02]`;
  }
  return base;
}

function adjustedJewelryImageClass(product: Product, base: string, surface: 'stacked' | 'flatlay' | 'feed'): string {
  if (productHasTerm(product, JEWELRY_SMALL_TERMS)) {
    if (surface === 'feed') return `${base} scale-[.68]`;
    if (surface === 'flatlay') return `${base} scale-[.72]`;
    return `${base} scale-[.74]`;
  }
  if (productHasTerm(product, JEWELRY_TALL_TERMS)) {
    if (surface === 'feed') return `${base} scale-[.78]`;
    if (surface === 'flatlay') return `${base} scale-[.84]`;
    return `${base} scale-[.86]`;
  }
  if (surface === 'feed') return `${base} scale-[.76]`;
  if (surface === 'flatlay') return `${base} scale-[.8]`;
  return `${base} scale-[.82]`;
}

function stackedFitImageClass(product: Product): string {
  const base = STACKED_FIT_IMAGE_CLASSES[product.category];
  if (product.category === 'shoes') {
    return adjustedShoeImageClass(product, base, 'stacked');
  }
  if (product.category === 'hat') {
    return adjustedHatImageClass(product, base, 'stacked');
  }
  if (product.category === 'bag') {
    return adjustedBagImageClass(product, base, 'stacked');
  }
  if (product.category === 'bottom') {
    return adjustedBottomImageClass(product, base, 'stacked');
  }
  if (product.category === 'jewelry') {
    return adjustedJewelryImageClass(product, base, 'stacked');
  }
  if (product.category === 'eyewear') return `${base} scale-[.84]`;
  return base;
}

function flatlayImageClass(product: Product): string {
  const base = FITS_AI_FLATLAY_IMAGE_CLASSES[product.category];
  if (product.category === 'shoes') {
    return adjustedShoeImageClass(product, base, 'flatlay');
  }
  if (product.category === 'hat') {
    return adjustedHatImageClass(product, base, 'flatlay');
  }
  if (product.category === 'bag') {
    return adjustedBagImageClass(product, base, 'flatlay');
  }
  if (product.category === 'bottom') {
    return adjustedBottomImageClass(product, base, 'flatlay');
  }
  if (product.category === 'jewelry') {
    return adjustedJewelryImageClass(product, base, 'flatlay');
  }
  if (product.category === 'eyewear') return `${base} scale-[.84]`;
  return base;
}

function feedTileImageClass(product: Product, role: 'hero' | 'support'): string {
  const shadow = role === 'hero'
    ? 'drop-shadow-[0_34px_26px_rgba(0,0,0,.28)]'
    : 'drop-shadow-[0_24px_20px_rgba(0,0,0,.24)]';
  const base = `h-full w-full object-contain p-0 ${shadow}`;

  if (product.category === 'shoes') {
    return adjustedShoeImageClass(product, base, 'feed');
  }
  if (product.category === 'hat') {
    return adjustedHatImageClass(product, base, 'feed');
  }
  if (product.category === 'bag') {
    return adjustedBagImageClass(product, base, 'feed');
  }
  if (product.category === 'bottom') {
    return adjustedBottomImageClass(product, base, 'feed');
  }
  if (product.category === 'jewelry') {
    return adjustedJewelryImageClass(product, base, 'feed');
  }
  if (product.category === 'eyewear') return `${base} scale-[.82]`;
  return base;
}

function FeedOutfitBoard({
  products,
  byCategory,
  className,
  onImageUnavailable,
  feedContext,
}: {
  products: Product[];
  byCategory: Map<Category, Product>;
  className: string;
  onImageUnavailable?: (product: Product) => void;
  feedContext?: FeedContext;
}) {
  const hero = chooseFeedHero(products, byCategory, feedContext);
  if (!hero) return null;

  const layoutVariant = pickFeedLayoutVariant(feedContext?.formulaId, byCategory, hero);

  const support = FEED_SUPPORT_ORDER
    .map((category) => byCategory.get(category))
    .filter((product): product is Product => Boolean(product))
    .filter((product) => product.id !== hero.id);

  if (support.length < 2) return null;

  if (layoutVariant === 'sneaker-led') {
    return (
      <FeedShellSneakerLed
        hero={hero}
        support={support}
        className={className}
        onImageUnavailable={onImageUnavailable}
      />
    );
  }
  if (layoutVariant === 'hero-top') {
    return (
      <FeedShellHeroTop
        hero={hero}
        support={support}
        className={className}
        onImageUnavailable={onImageUnavailable}
      />
    );
  }
  return (
    <FeedShellHeroLeft
      hero={hero}
      support={support}
      className={className}
      onImageUnavailable={onImageUnavailable}
    />
  );
}

function FeedFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[34px] border border-white/14 bg-[radial-gradient(circle_at_22%_15%,rgba(255,245,226,.35),transparent_32%),linear-gradient(135deg,#fbf8f1_0%,#eadccc_54%,#c3a996_100%)] p-3 shadow-[0_32px_80px_rgba(0,0,0,.45)] ${className}`}
      data-feed-scale-system="silhouette-v2"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.36),transparent_36%,rgba(28,18,13,.18)_100%)]" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function HeroTile({
  product,
  onImageUnavailable,
}: {
  product: Product;
  onImageUnavailable?: (product: Product) => void;
}) {
  return (
    <article className="relative h-full w-full overflow-visible rounded-[28px] bg-transparent">
      <ProductTileLink product={product} className="block h-full w-full overflow-visible">
        <ProductImage
          product={product}
          transparentOnly
          loading="eager"
          wrapperClassName="h-full w-full overflow-visible bg-transparent"
          className={feedTileImageClass(product, 'hero')}
          onUnavailable={onImageUnavailable}
        />
      </ProductTileLink>
      <HeroBrandCaption product={product} />
    </article>
  );
}

function SupportTile({
  product,
  rotation = '',
  onImageUnavailable,
}: {
  product: Product;
  rotation?: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  return (
    <article
      className={`relative h-full w-full overflow-visible rounded-[22px] bg-transparent ${rotation}`}
    >
      <ProductTileLink product={product} className="block h-full w-full overflow-visible">
        <ProductImage
          product={product}
          transparentOnly
          wrapperClassName="h-full w-full overflow-visible bg-transparent"
          className={feedTileImageClass(product, 'support')}
          onUnavailable={onImageUnavailable}
        />
      </ProductTileLink>
    </article>
  );
}

function ProductTileLink({
  product,
  className,
  disabled = false,
  fitSlot,
  children,
}: {
  product: Product;
  className?: string;
  disabled?: boolean;
  fitSlot?: Category;
  children: React.ReactNode;
}) {
  const outboundUrl = getProductOutboundUrl(product);
  if (disabled || !outboundUrl) {
    return <div className={className} data-stacked-fit-slot={fitSlot}>{children}</div>;
  }
  return (
    <a
      href={outboundUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Shop ${product.brand} ${product.name}`}
      className={className}
      data-product-link={product.id}
      data-stacked-fit-slot={fitSlot}
    >
      {children}
    </a>
  );
}

function HeroBrandCaption({ product }: { product: Product }) {
  return (
    <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
      <div className="max-w-[78%] rounded-full bg-black/55 px-2.5 py-1 text-white shadow-[0_8px_18px_rgba(0,0,0,.22)] backdrop-blur-md">
        <div className="truncate text-[10px] font-semibold tracking-tight">{product.brand}</div>
      </div>
    </div>
  );
}

function FeedShellHeroLeft({
  hero,
  support,
  className,
  onImageUnavailable,
}: {
  hero: Product;
  support: Product[];
  className: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const supportTiles = support.slice(0, 4);
  const rotations = ['rotate-[.8deg]', 'rotate-[-1deg]', 'rotate-[-.5deg]', 'rotate-[1deg]'];
  return (
    <FeedFrame className={className}>
      <div className="grid h-full grid-cols-[1.18fr_.82fr] gap-2.5">
        <HeroTile product={hero} onImageUnavailable={onImageUnavailable} />
        <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-2">
          {supportTiles.map((product, index) => (
            <SupportTile
              key={`${product.category}-${product.id}`}
              product={product}
              rotation={rotations[index] || ''}
              onImageUnavailable={onImageUnavailable}
            />
          ))}
        </div>
      </div>
    </FeedFrame>
  );
}

function FeedShellHeroTop({
  hero,
  support,
  className,
  onImageUnavailable,
}: {
  hero: Product;
  support: Product[];
  className: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const supportTiles = support.slice(0, 4);
  const rotations = ['rotate-[.6deg]', 'rotate-[-.6deg]', 'rotate-[.4deg]', 'rotate-[-.4deg]'];
  return (
    <FeedFrame className={className}>
      <div className="grid h-full grid-rows-[1.4fr_.85fr] gap-2.5">
        <HeroTile product={hero} onImageUnavailable={onImageUnavailable} />
        <div className={`grid min-h-0 gap-2 ${supportTiles.length === 4 ? 'grid-cols-4' : supportTiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {supportTiles.map((product, index) => (
            <SupportTile
              key={`${product.category}-${product.id}`}
              product={product}
              rotation={rotations[index] || ''}
              onImageUnavailable={onImageUnavailable}
            />
          ))}
        </div>
      </div>
    </FeedFrame>
  );
}

function FeedShellSneakerLed({
  hero,
  support,
  className,
  onImageUnavailable,
}: {
  hero: Product;
  support: Product[];
  className: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  // Hero is intentionally the shoe (or whatever the chooser picked) and
  // sits large on the right. The left column stacks top + bottom / outer
  // so the shoe gets the editorial weight without losing the rest of the
  // outfit.
  const STACK_ORDER: Category[] = ['outer', 'top', 'bottom', 'bag', 'hat', 'eyewear', 'jewelry'];
  const stack = STACK_ORDER
    .map((category) => support.find((product) => product.category === category))
    .filter((product): product is Product => Boolean(product))
    .slice(0, 3);

  const overflow = support.filter((product) => !stack.includes(product) && product.id !== hero.id).slice(0, 2);

  return (
    <FeedFrame className={className}>
      <div className="grid h-full grid-cols-[.78fr_1.22fr] gap-2.5">
        <div className="grid min-h-0 grid-rows-3 gap-2">
          {stack.map((product, index) => (
            <SupportTile
              key={`${product.category}-${product.id}`}
              product={product}
              rotation={index === 0 ? 'rotate-[-1deg]' : index === 1 ? 'rotate-[.8deg]' : 'rotate-[-.6deg]'}
              onImageUnavailable={onImageUnavailable}
            />
          ))}
        </div>
        <div className="grid min-h-0 grid-rows-[1.6fr_.85fr] gap-2">
          <HeroTile product={hero} onImageUnavailable={onImageUnavailable} />
          {overflow.length ? (
            <div className={`grid min-h-0 gap-2 ${overflow.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {overflow.map((product, index) => (
                <SupportTile
                  key={`${product.category}-${product.id}`}
                  product={product}
                  rotation={index === 0 ? 'rotate-[.5deg]' : 'rotate-[-.5deg]'}
                  onImageUnavailable={onImageUnavailable}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </FeedFrame>
  );
}
