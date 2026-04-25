'use client';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';
import { proxiedImageUrl } from '@/lib/image-url';
import { motion } from 'framer-motion';

interface Props {
  items: Partial<Record<string, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
  previewItem?: Product | null;
  previewCategory?: string | null;
}

const BODY_LAYOUT: Record<
  GeneratorFrame,
  {
    headLeft: number;
    headWidth: number;
    headTop: number;
    torsoLeft: number;
    torsoWidth: number;
    torsoHeight: number;
    torsoTop: number;
    armLeft: number;
    armRight: number;
    armHeight: number;
    armTop: number;
    legLeft: number;
    legRight: number;
    legWidth: number;
    legTop: number;
    hipTop: number;
    footTop: number;
    neckTop: number;
    eyeTop: number;
  }
> = {
  masc: {
    headLeft: 35,
    headWidth: 50,
    headTop: 0,
    torsoLeft: 24,
    torsoWidth: 72,
    torsoHeight: 70,
    torsoTop: 46,
    armLeft: 10,
    armRight: 93,
    armHeight: 66,
    armTop: 48,
    legLeft: 30,
    legRight: 64,
    legWidth: 28,
    legTop: 124,
    hipTop: 124,
    footTop: 220,
    neckTop: 46,
    eyeTop: 12,
  },
  fem: {
    headLeft: 39,
    headWidth: 42,
    headTop: 2,
    torsoLeft: 31,
    torsoWidth: 58,
    torsoHeight: 68,
    torsoTop: 48,
    armLeft: 15,
    armRight: 88,
    armHeight: 64,
    armTop: 50,
    legLeft: 34,
    legRight: 60,
    legWidth: 24,
    legTop: 124,
    hipTop: 122,
    footTop: 218,
    neckTop: 48,
    eyeTop: 14,
  },
  androgynous: {
    headLeft: 37,
    headWidth: 46,
    headTop: 1,
    torsoLeft: 30,
    torsoWidth: 60,
    torsoHeight: 66,
    torsoTop: 47,
    armLeft: 14,
    armRight: 89,
    armHeight: 62,
    armTop: 49,
    legLeft: 32,
    legRight: 62,
    legWidth: 26,
    legTop: 123,
    hipTop: 121,
    footTop: 219,
    neckTop: 47,
    eyeTop: 13,
  },
};

function getOverlayStyle(
  category: string,
  layout: ReturnType<typeof BODY_LAYOUT[string]>
): React.CSSProperties {
  const styles: Record<string, React.CSSProperties> = {
    hat: {
      top: layout.headTop - 6,
      left: layout.headLeft - 7,
      width: layout.headWidth + 14,
      height: 32,
    },
    outer: {
      top: layout.torsoTop - 4,
      left: layout.torsoLeft - 6,
      width: layout.torsoWidth + 12,
      height: layout.torsoHeight + 16,
    },
    top: {
      top: layout.torsoTop,
      left: layout.torsoLeft,
      width: layout.torsoWidth,
      height: layout.torsoHeight,
    },
    bottom: {
      top: layout.legTop - 4,
      left: layout.torsoLeft,
      width: layout.torsoWidth,
      height: layout.footTop - layout.legTop + 20,
    },
    shoes: {
      top: layout.footTop - 2,
      left: layout.legLeft - 6,
      width: layout.torsoWidth + 12,
      height: 28,
    },
    bag: {
      top: layout.torsoTop + layout.torsoHeight * 0.4,
      left: layout.armRight - 4,
      width: 38,
      height: 54,
    },
    eyewear: {
      top: layout.eyeTop,
      left: layout.headLeft - 4,
      width: layout.headWidth + 8,
      height: 22,
    },
    jewelry: {
      top: layout.neckTop + 4,
      left: layout.torsoLeft + layout.torsoWidth * 0.2,
      width: layout.torsoWidth * 0.6,
      height: 24,
    },
  };
  return styles[category] || styles.top;
}

export function Mannequin({ items, skinTone, bodyType = 'androgynous', previewItem, previewCategory }: Props) {
  const mannequinStyle = skinTone
    ? ({ '--skin': skinTone } as CSSProperties)
    : undefined;
  const layout = BODY_LAYOUT[bodyType];

  const getDisplayItems = () => {
    if (previewItem && previewCategory) {
      return { ...items, [previewCategory]: previewItem };
    }
    return items;
  };

  const displayItems = getDisplayItems();

  return (
    <div className="relative flex h-[360px] w-[140px] shrink-0 items-start justify-center" style={mannequinStyle}>
      <div className="absolute bottom-0 w-[70%] h-[16px] rounded-full bg-black/50 blur-md" />
      <div className="absolute bottom-0 w-[60%] h-[10px] rounded-full bg-accent/20 blur" />

      <div className="relative w-[120px] h-[360px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute top-0 rounded-[24px_24px_14px_14px] skin shadow-[inset_-3px_-4px_10px_rgba(0,0,0,.22)]"
          style={{ left: layout.headLeft, width: layout.headWidth, height: 50 }}
        />
        <div
          className="absolute top-[46px] rounded skin"
          style={{ left: layout.headLeft + layout.headWidth / 2 - 7, width: 14, height: 10 }}
        />
        <div
          className="absolute top-[56px] rounded-[10px_10px_16px_16px] skin shadow-[inset_-3px_-4px_10px_rgba(0,0,0,.22)]"
          style={{ left: layout.torsoLeft, width: layout.torsoWidth, height: layout.torsoHeight }}
        />
        <div
          className="absolute top-[58px] rounded-[8px_6px_10px_10px] skin rotate-[4deg]"
          style={{ left: layout.armLeft, width: 17, height: layout.armHeight }}
        />
        <div
          className="absolute top-[58px] rounded-[6px_8px_10px_10px] skin -rotate-[4deg]"
          style={{ left: layout.armRight, width: 17, height: layout.armHeight }}
        />
        <div className="absolute rounded-[8px] skin" style={{ top: layout.hipTop - 2, left: layout.armLeft - 2, width: 17, height: 15 }} />
        <div className="absolute rounded-[8px] skin" style={{ top: layout.hipTop - 2, left: layout.armRight + 2, width: 17, height: 15 }} />
        <div
          className="absolute rounded-[6px_6px_10px_10px] skin"
          style={{ top: layout.legTop, left: layout.legLeft, width: layout.legWidth, height: 100 }}
        />
        <div
          className="absolute rounded-[6px_6px_10px_10px] skin"
          style={{ top: layout.legTop, left: layout.legRight, width: layout.legWidth, height: 100 }}
        />
        <div className="absolute rounded-[4px_4px_10px_10px] skin" style={{ top: layout.footTop, left: layout.legLeft - 4, width: 34, height: 14 }} />
        <div className="absolute rounded-[4px_4px_10px_10px] skin" style={{ top: layout.footTop, left: layout.legRight - 4, width: 34, height: 14 }} />

        {displayItems.outer && (
          <Overlay 
            style={getOverlayStyle('outer', layout)} 
            src={proxiedImageUrl(displayItems.outer.imageUrl)} 
            variant="outer" 
            isPreview={previewCategory === 'outer'}
          />
        )}
        {displayItems.top && !displayItems.outer && (
          <Overlay 
            style={getOverlayStyle('top', layout)} 
            src={proxiedImageUrl(displayItems.top.imageUrl)} 
            variant="top" 
            isPreview={previewCategory === 'top'}
          />
        )}
        {displayItems.bottom && (
          <Overlay 
            style={getOverlayStyle('bottom', layout)} 
            src={proxiedImageUrl(displayItems.bottom.imageUrl)} 
            variant="bottom" 
            isPreview={previewCategory === 'bottom'}
          />
        )}
        {displayItems.hat && (
          <Overlay 
            style={getOverlayStyle('hat', layout)} 
            src={proxiedImageUrl(displayItems.hat.imageUrl)} 
            variant="hat" 
            isPreview={previewCategory === 'hat'}
          />
        )}
        {displayItems.shoes && (
          <Overlay 
            style={getOverlayStyle('shoes', layout)} 
            src={proxiedImageUrl(displayItems.shoes.imageUrl)} 
            variant="shoes" 
            isPreview={previewCategory === 'shoes'}
          />
        )}
        {displayItems.bag && (
          <Overlay 
            style={getOverlayStyle('bag', layout)} 
            src={proxiedImageUrl(displayItems.bag.imageUrl)} 
            variant="bag" 
            isPreview={previewCategory === 'bag'}
          />
        )}
        {displayItems.eyewear && (
          <Overlay 
            style={getOverlayStyle('eyewear', layout)} 
            src={proxiedImageUrl(displayItems.eyewear.imageUrl)} 
            variant="eyewear" 
            isPreview={previewCategory === 'eyewear'}
          />
        )}
        {displayItems.jewelry && (
          <Overlay 
            style={getOverlayStyle('jewelry', layout)} 
            src={proxiedImageUrl(displayItems.jewelry.imageUrl)} 
            variant="jewelry" 
            isPreview={previewCategory === 'jewelry'}
          />
        )}
      </div>
    </div>
  );
}

function overlayFallback(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 220">
      <rect width="180" height="220" rx="24" fill="#0f0f0e" />
      <rect x="14" y="14" width="152" height="192" rx="18" fill="#e8365d" opacity="0.14" />
      <circle cx="90" cy="82" r="34" fill="#fffefb" opacity="0.9" />
      <rect x="46" y="132" width="88" height="12" rx="6" fill="#fffefb" opacity="0.78" />
      <rect x="58" y="154" width="64" height="10" rx="5" fill="#fffefb" opacity="0.38" />
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function Overlay({
  style,
  src,
  variant,
  isPreview,
}: {
  style: React.CSSProperties;
  src: string;
  variant: 'outer' | 'top' | 'bottom' | 'hat' | 'shoes' | 'bag' | 'eyewear' | 'jewelry';
  isPreview?: boolean;
}) {
  const frameClass = {
    outer: 'rounded-[20px] bg-black/18 ring-1 ring-white/10 backdrop-blur-[2px]',
    top: 'rounded-[18px_18px_26px_26px] bg-black/12 ring-1 ring-white/10 backdrop-blur-[2px]',
    bottom: 'rounded-[18px_18px_24px_24px] bg-black/16 ring-1 ring-white/10 backdrop-blur-[2px]',
    hat: 'rounded-[18px] bg-black/10 ring-1 ring-white/10 backdrop-blur-[2px]',
    shoes: 'rounded-[18px] bg-black/16 ring-1 ring-white/10 backdrop-blur-[2px]',
    bag: 'rounded-[16px] bg-black/16 ring-1 ring-white/10 backdrop-blur-[2px]',
    eyewear: 'rounded-[999px] bg-black/10 ring-1 ring-white/10 backdrop-blur-[2px]',
    jewelry: 'rounded-[999px] bg-black/8 ring-1 ring-white/10 backdrop-blur-[2px]',
  }[variant];

  const imageClass = {
    outer: 'h-full w-full object-contain p-1.5 drop-shadow-[0_8px_14px_rgba(0,0,0,.35)]',
    top: 'h-full w-full object-contain p-1.5 drop-shadow-[0_8px_14px_rgba(0,0,0,.3)]',
    bottom: 'h-full w-full object-contain p-1 drop-shadow-[0_8px_14px_rgba(0,0,0,.32)]',
    hat: 'h-full w-full object-contain p-0.5 drop-shadow-[0_4px_10px_rgba(0,0,0,.3)]',
    shoes: 'h-full w-full object-contain p-0.5 drop-shadow-[0_4px_10px_rgba(0,0,0,.3)]',
    bag: 'h-full w-full object-contain p-1 drop-shadow-[0_6px_12px_rgba(0,0,0,.3)]',
    eyewear: 'h-full w-full object-contain p-0.5 opacity-95',
    jewelry: 'h-full w-full object-contain p-0.5 opacity-90',
  }[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`absolute z-10 pointer-events-none overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,.22)] ${frameClass} ${
        isPreview ? 'ring-2 ring-accent animate-pulse-slow' : ''
      }`}
      style={style}
    >
      <img
        src={src}
        alt=""
        className={imageClass}
        style={{ mixBlendMode: 'normal' }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.src = overlayFallback();
        }}
      />
    </motion.div>
  );
}

/* suppress unused Image warning — keep import for docs */
export const _Image = Image;
