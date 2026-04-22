'use client';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { Product } from '@/lib/types';

interface Props {
  items: Partial<Record<string, Product>>;
  skinTone?: string;
}

/**
 * CSS-div standing character + image overlays.
 * Phase 1 visualization. Replaceable with SVG / 3D later — API stays identical.
 */
export function Mannequin({ items, skinTone }: Props) {
  const mannequinStyle = skinTone
    ? ({ '--skin': skinTone } as CSSProperties)
    : undefined;

  return (
    <div className="relative flex h-[360px] w-[150px] items-start justify-center" style={mannequinStyle}>
      {/* ground shadow */}
      <div className="absolute bottom-0 w-[70%] h-[16px] rounded-full bg-black/50 blur-md" />
      <div className="absolute bottom-0 w-[60%] h-[10px] rounded-full bg-accent/20 blur" />

      <div className="relative w-[120px] h-[360px]">
        <div className="absolute top-0 left-[37px] w-[46px] h-[48px] rounded-[22px_22px_12px_12px] skin shadow-[inset_-3px_-4px_10px_rgba(0,0,0,.22)]" />
        <div className="absolute top-[46px] left-[53px] w-[14px] h-[10px] rounded skin" />
        <div className="absolute top-[56px] left-[30px] w-[60px] h-[66px] rounded-[9px_9px_14px_14px] skin shadow-[inset_-3px_-4px_10px_rgba(0,0,0,.22)]" />
        <div className="absolute top-[58px] left-[14px] w-[17px] h-[62px] rounded-[8px_6px_10px_10px] skin rotate-[4deg]" />
        <div className="absolute top-[58px] left-[89px] w-[17px] h-[62px] rounded-[6px_8px_10px_10px] skin -rotate-[4deg]" />
        <div className="absolute top-[118px] left-[12px] w-[17px] h-[15px] rounded-[8px] skin" />
        <div className="absolute top-[118px] left-[91px] w-[17px] h-[15px] rounded-[8px] skin" />
        <div className="absolute top-[120px] left-[32px] w-[26px] h-[100px] rounded-[6px_6px_10px_10px] skin" />
        <div className="absolute top-[120px] left-[62px] w-[26px] h-[100px] rounded-[6px_6px_10px_10px] skin" />
        <div className="absolute top-[218px] left-[28px] w-[34px] h-[14px] rounded-[4px_4px_10px_10px] skin" />
        <div className="absolute top-[218px] left-[58px] w-[34px] h-[14px] rounded-[4px_4px_10px_10px] skin" />

        {/* Styled garment zones work better with normal shopping thumbnails than raw full-body cutouts. */}
        {items.outer && (
          <Overlay style={{ top: 48, left: 2, width: 116, height: 104 }} src={items.outer.imageUrl} variant="outer" />
        )}
        {items.top && !items.outer && (
          <Overlay style={{ top: 56, left: 12, width: 96, height: 82 }} src={items.top.imageUrl} variant="top" />
        )}
        {items.bottom && (
          <Overlay style={{ top: 118, left: 18, width: 84, height: 116 }} src={items.bottom.imageUrl} variant="bottom" />
        )}
        {items.hat && (
          <Overlay style={{ top: -8, left: 28, width: 64, height: 34 }} src={items.hat.imageUrl} variant="hat" />
        )}
        {items.shoes && (
          <Overlay style={{ top: 226, left: 20, width: 82, height: 34 }} src={items.shoes.imageUrl} variant="shoes" />
        )}
        {items.bag && (
          <Overlay style={{ top: 132, left: 92, width: 36, height: 52 }} src={items.bag.imageUrl} variant="bag" />
        )}
        {items.eyewear && (
          <Overlay style={{ top: 14, left: 31, width: 58, height: 24 }} src={items.eyewear.imageUrl} variant="eyewear" />
        )}
        {items.jewelry && (
          <Overlay style={{ top: 52, left: 43, width: 36, height: 26 }} src={items.jewelry.imageUrl} variant="jewelry" />
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
    <div className={`absolute pointer-events-none overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,.22)] ${frameClass}`} style={style}>
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
