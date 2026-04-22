'use client';
import Image from 'next/image';
import type { Product } from '@/lib/types';

interface Props {
  items: Partial<Record<string, Product>>;
}

/**
 * CSS-div standing character + image overlays.
 * Phase 1 visualization. Replaceable with SVG / 3D later — API stays identical.
 */
export function Mannequin({ items }: Props) {
  return (
    <div className="relative w-[150px] h-[360px] flex justify-center items-start">
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

        {/* Overlays — product images with bg removed. Placeholder gradients until images load. */}
        {items.outer && (
          <Overlay style={{ top: 52, left: 6, width: 108, height: 98 }} src={items.outer.imageUrl} />
        )}
        {items.top && !items.outer && (
          <Overlay style={{ top: 55, left: 12, width: 96, height: 74 }} src={items.top.imageUrl} />
        )}
        {items.bottom && (
          <Overlay style={{ top: 120, left: 30, width: 60, height: 100 }} src={items.bottom.imageUrl} />
        )}
        {items.hat && (
          <Overlay style={{ top: -6, left: 32, width: 56, height: 30 }} src={items.hat.imageUrl} />
        )}
        {items.shoes && (
          <Overlay style={{ top: 210, left: 25, width: 72, height: 26 }} src={items.shoes.imageUrl} />
        )}
        {items.bag && (
          <Overlay style={{ top: 134, left: 96, width: 30, height: 38 }} src={items.bag.imageUrl} />
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
}: {
  style: React.CSSProperties;
  src: string;
}) {
  return (
    <div className="absolute pointer-events-none animate-in fade-in" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
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
