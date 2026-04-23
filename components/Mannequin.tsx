'use client';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';
import { proxiedImageUrl } from '@/lib/image-url';

interface Props {
  items: Partial<Record<string, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
}

/**
 * CSS-div standing character + image overlays.
 * Phase 1 visualization. Replaceable with SVG / 3D later — API stays identical.
 */
const BODY_LAYOUT: Record<
  GeneratorFrame,
  {
    headLeft: number;
    headWidth: number;
    torsoLeft: number;
    torsoWidth: number;
    torsoHeight: number;
    armLeft: number;
    armRight: number;
    armHeight: number;
    legLeft: number;
    legRight: number;
    legWidth: number;
    hipTop: number;
  }
> = {
  masc: {
    headLeft: 35,
    headWidth: 50,
    torsoLeft: 24,
    torsoWidth: 72,
    torsoHeight: 70,
    armLeft: 10,
    armRight: 93,
    armHeight: 66,
    legLeft: 30,
    legRight: 64,
    legWidth: 28,
    hipTop: 124,
  },
  fem: {
    headLeft: 39,
    headWidth: 42,
    torsoLeft: 31,
    torsoWidth: 58,
    torsoHeight: 68,
    armLeft: 15,
    armRight: 88,
    armHeight: 64,
    legLeft: 34,
    legRight: 60,
    legWidth: 24,
    hipTop: 122,
  },
  androgynous: {
    headLeft: 37,
    headWidth: 46,
    torsoLeft: 30,
    torsoWidth: 60,
    torsoHeight: 66,
    armLeft: 14,
    armRight: 89,
    armHeight: 62,
    legLeft: 32,
    legRight: 62,
    legWidth: 26,
    hipTop: 120,
  },
};

export function Mannequin({ items, skinTone, bodyType = 'androgynous' }: Props) {
  const mannequinStyle = skinTone
    ? ({ '--skin': skinTone } as CSSProperties)
    : undefined;
  const layout = BODY_LAYOUT[bodyType];

  return (
    <div className="relative flex h-[360px] w-[150px] items-start justify-center" style={mannequinStyle}>
      {/* ground shadow */}
      <div className="absolute bottom-0 w-[70%] h-[16px] rounded-full bg-black/50 blur-md" />
      <div className="absolute bottom-0 w-[60%] h-[10px] rounded-full bg-accent/20 blur" />

      <div className="relative w-[120px] h-[360px]">
        <div
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
          style={{ top: layout.hipTop, left: layout.legLeft, width: layout.legWidth, height: 100 }}
        />
        <div
          className="absolute rounded-[6px_6px_10px_10px] skin"
          style={{ top: layout.hipTop, left: layout.legRight, width: layout.legWidth, height: 100 }}
        />
        <div className="absolute rounded-[4px_4px_10px_10px] skin" style={{ top: 218, left: layout.legLeft - 4, width: 34, height: 14 }} />
        <div className="absolute rounded-[4px_4px_10px_10px] skin" style={{ top: 218, left: layout.legRight - 4, width: 34, height: 14 }} />

        {/* Styled garment zones work better with normal shopping thumbnails than raw full-body cutouts. */}
        {items.outer && (
          <Overlay style={{ top: 48, left: 2, width: 116, height: 104 }} src={proxiedImageUrl(items.outer.imageUrl)} variant="outer" />
        )}
        {items.top && !items.outer && (
          <Overlay style={{ top: 56, left: 12, width: 96, height: 82 }} src={proxiedImageUrl(items.top.imageUrl)} variant="top" />
        )}
        {items.bottom && (
          <Overlay style={{ top: 118, left: 18, width: 84, height: 116 }} src={proxiedImageUrl(items.bottom.imageUrl)} variant="bottom" />
        )}
        {items.hat && (
          <Overlay style={{ top: -8, left: 28, width: 64, height: 34 }} src={proxiedImageUrl(items.hat.imageUrl)} variant="hat" />
        )}
        {items.shoes && (
          <Overlay style={{ top: 226, left: 20, width: 82, height: 34 }} src={proxiedImageUrl(items.shoes.imageUrl)} variant="shoes" />
        )}
        {items.bag && (
          <Overlay style={{ top: 132, left: 92, width: 36, height: 52 }} src={proxiedImageUrl(items.bag.imageUrl)} variant="bag" />
        )}
        {items.eyewear && (
          <Overlay style={{ top: 14, left: 31, width: 58, height: 24 }} src={proxiedImageUrl(items.eyewear.imageUrl)} variant="eyewear" />
        )}
        {items.jewelry && (
          <Overlay style={{ top: 52, left: 43, width: 36, height: 26 }} src={proxiedImageUrl(items.jewelry.imageUrl)} variant="jewelry" />
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
}: {
  style: React.CSSProperties;
  src: string;
  variant: 'outer' | 'top' | 'bottom' | 'hat' | 'shoes' | 'bag' | 'eyewear' | 'jewelry';
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
    <div className={`absolute z-10 pointer-events-none overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,.22)] ${frameClass}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
    </div>
  );
}

/* suppress unused Image warning — keep import for docs */
export const _Image = Image;
