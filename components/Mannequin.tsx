'use client';
import type { CSSProperties } from 'react';
import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';
import { proxiedImageUrl } from '@/lib/image-url';

interface Props {
  items: Partial<Record<Category, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
}

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
    headLeft: 33,
    headWidth: 54,
    torsoLeft: 22,
    torsoWidth: 76,
    torsoHeight: 74,
    armLeft: 6,
    armRight: 97,
    armHeight: 70,
    legLeft: 28,
    legRight: 65,
    legWidth: 29,
    hipTop: 128,
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
    torsoHeight: 68,
    armLeft: 13,
    armRight: 90,
    armHeight: 64,
    legLeft: 32,
    legRight: 62,
    legWidth: 26,
    hipTop: 122,
  },
};

const MARKERS: Array<{ category: Category; label: string; className: string }> = [
  { category: 'hat', label: 'Hat', className: 'right-5 top-[78px]' },
  { category: 'outer', label: 'Outer', className: 'left-4 top-[154px]' },
  { category: 'top', label: 'Top', className: 'right-3 top-[174px]' },
  { category: 'bottom', label: 'Bottom', className: 'left-4 top-[266px]' },
  { category: 'shoes', label: 'Shoes', className: 'right-8 bottom-[52px]' },
  { category: 'bag', label: 'Bag', className: 'right-4 top-[256px]' },
];

function frameLabel(frame: GeneratorFrame): string {
  if (frame === 'masc') return 'Menswear frame';
  if (frame === 'fem') return 'Womenswear frame';
  return 'Neutral frame';
}

export function Mannequin({ items, skinTone, bodyType = 'androgynous' }: Props) {
  const mannequinStyle = skinTone
    ? ({ '--skin': skinTone } as CSSProperties)
    : undefined;
  const layout = BODY_LAYOUT[bodyType];
  const filled = Object.values(items).filter(Boolean).length;
  const heroItem = items.outer || items.top || items.bottom || items.shoes || null;

  return (
    <div
      className="relative h-[430px] w-full overflow-hidden rounded-[28px] border border-hairline bg-black"
      style={mannequinStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,.12),transparent_28%),radial-gradient(circle_at_50%_58%,rgba(232,54,93,.16),transparent_42%),linear-gradient(180deg,#151411,#090908_70%,#050505)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute left-1/2 top-12 h-[300px] w-[250px] -translate-x-1/2 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-20 h-[340px] w-[320px] -translate-x-1/2 rounded-full border border-accent/20" />
      <div className="absolute left-8 top-24 h-[260px] w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
      <div className="absolute right-8 top-24 h-[260px] w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

      <div className="absolute left-4 top-4 z-20 max-w-[150px] rounded-2xl border border-hairline bg-black/50 p-3 backdrop-blur-md">
        <div className="text-[9px] uppercase tracking-[.16em] text-muted">Fit profile</div>
        <div className="mt-1 font-serif text-[17px] font-semibold text-ink">{frameLabel(bodyType)}</div>
        <div className="mt-1 text-[11px] leading-snug text-muted-2">
          {heroItem ? `${heroItem.brand} leads this look.` : 'Tap a slot below to place the first piece.'}
        </div>
      </div>

      <div className="absolute right-4 top-4 z-20 rounded-2xl border border-hairline bg-black/50 px-3 py-2 text-right backdrop-blur-md">
        <div className="font-serif text-[22px] font-semibold leading-none text-ink">{filled}/8</div>
        <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-muted">slots</div>
      </div>

      <div
        className="absolute left-1/2 top-[78px] z-10 h-[270px] w-[120px]"
        style={{ transform: 'translateX(-50%) scale(1.28)', transformOrigin: 'top center' }}
      >
        <div className="absolute left-1/2 top-[52px] h-[246px] w-[158px] -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />
        <div
          className="absolute top-0 rounded-[24px_24px_14px_14px] skin shadow-[inset_-3px_-4px_10px_rgba(0,0,0,.22)]"
          style={{ left: layout.headLeft, width: layout.headWidth, height: 50 }}
        />
        <div
          className="absolute top-[46px] rounded skin"
          style={{ left: layout.headLeft + layout.headWidth / 2 - 7, width: 14, height: 12 }}
        />
        <div
          className="absolute top-[56px] rounded-[10px_10px_16px_16px] skin shadow-[inset_-3px_-4px_10px_rgba(0,0,0,.22)]"
          style={{ left: layout.torsoLeft, width: layout.torsoWidth, height: layout.torsoHeight }}
        />
        <div
          className="absolute top-[58px] rounded-[8px_6px_12px_12px] skin rotate-[5deg]"
          style={{ left: layout.armLeft, width: 17, height: layout.armHeight }}
        />
        <div
          className="absolute top-[58px] rounded-[6px_8px_12px_12px] skin -rotate-[5deg]"
          style={{ left: layout.armRight, width: 17, height: layout.armHeight }}
        />
        <div className="absolute rounded-[8px] skin" style={{ top: layout.hipTop - 2, left: layout.armLeft - 2, width: 17, height: 15 }} />
        <div className="absolute rounded-[8px] skin" style={{ top: layout.hipTop - 2, left: layout.armRight + 2, width: 17, height: 15 }} />
        <div
          className="absolute rounded-[6px_6px_12px_12px] skin"
          style={{ top: layout.hipTop, left: layout.legLeft, width: layout.legWidth, height: 104 }}
        />
        <div
          className="absolute rounded-[6px_6px_12px_12px] skin"
          style={{ top: layout.hipTop, left: layout.legRight, width: layout.legWidth, height: 104 }}
        />
        <div className="absolute rounded-[4px_4px_10px_10px] skin" style={{ top: 226, left: layout.legLeft - 5, width: 35, height: 14 }} />
        <div className="absolute rounded-[4px_4px_10px_10px] skin" style={{ top: 226, left: layout.legRight - 4, width: 35, height: 14 }} />

        {items.top && (
          <Overlay style={{ top: 54, left: 10, width: 100, height: 86, zIndex: 5 }} src={proxiedImageUrl(items.top.imageUrl)} variant="top" />
        )}
        {items.bottom && (
          <Overlay style={{ top: 122, left: 17, width: 86, height: 116, zIndex: 4 }} src={proxiedImageUrl(items.bottom.imageUrl)} variant="bottom" />
        )}
        {items.outer && (
          <Overlay style={{ top: 48, left: 0, width: 120, height: 118, zIndex: 7 }} src={proxiedImageUrl(items.outer.imageUrl)} variant="outer" />
        )}
        {items.hat && (
          <Overlay style={{ top: -9, left: 24, width: 72, height: 36, zIndex: 9 }} src={proxiedImageUrl(items.hat.imageUrl)} variant="hat" />
        )}
        {items.shoes && (
          <Overlay style={{ top: 232, left: 12, width: 96, height: 34, zIndex: 8 }} src={proxiedImageUrl(items.shoes.imageUrl)} variant="shoes" />
        )}
        {items.bag && (
          <Overlay style={{ top: 128, left: 92, width: 42, height: 58, zIndex: 8 }} src={proxiedImageUrl(items.bag.imageUrl)} variant="bag" />
        )}
        {items.eyewear && (
          <Overlay style={{ top: 15, left: 30, width: 60, height: 24, zIndex: 10 }} src={proxiedImageUrl(items.eyewear.imageUrl)} variant="eyewear" />
        )}
        {items.jewelry && (
          <Overlay style={{ top: 52, left: 42, width: 38, height: 28, zIndex: 10 }} src={proxiedImageUrl(items.jewelry.imageUrl)} variant="jewelry" />
        )}
      </div>

      <div className="absolute bottom-12 left-1/2 h-7 w-[176px] -translate-x-1/2 rounded-full bg-black/60 blur-md" />
      <div className="absolute bottom-12 left-1/2 h-4 w-[120px] -translate-x-1/2 rounded-full border border-white/10 bg-white/10" />
      <div className="absolute bottom-6 left-1/2 h-3 w-[190px] -translate-x-1/2 rounded-full bg-accent/10 blur" />

      {MARKERS.map((marker) => {
        const hasItem = Boolean(items[marker.category]);
        return (
          <div
            key={marker.category}
            className={`absolute z-20 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[.12em] backdrop-blur-md ${marker.className} ${
              hasItem
                ? 'border-accent/70 bg-accent/20 text-ink shadow-pink-glow'
                : 'border-hairline bg-black/40 text-muted-2'
            }`}
          >
            {marker.label}
          </div>
        );
      })}
    </div>
  );
}

function overlayFallback(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 220">
      <rect width="180" height="220" rx="24" fill="#050505" />
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
  style: CSSProperties;
  src: string;
  variant: 'outer' | 'top' | 'bottom' | 'hat' | 'shoes' | 'bag' | 'eyewear' | 'jewelry';
}) {
  const frameClass = {
    outer: 'rounded-[22px] bg-black/30 ring-1 ring-white/10',
    top: 'rounded-[18px_18px_28px_28px] bg-black/25 ring-1 ring-white/10',
    bottom: 'rounded-[18px_18px_24px_24px] bg-black/25 ring-1 ring-white/10',
    hat: 'rounded-[18px] bg-black/20 ring-1 ring-white/10',
    shoes: 'rounded-[18px] bg-black/25 ring-1 ring-white/10',
    bag: 'rounded-[16px] bg-black/30 ring-1 ring-white/10',
    eyewear: 'rounded-[999px] bg-black/20 ring-1 ring-white/10',
    jewelry: 'rounded-[999px] bg-black/20 ring-1 ring-white/10',
  }[variant];

  const imageClass = {
    outer: 'h-full w-full object-contain p-1.5',
    top: 'h-full w-full object-contain p-1.5',
    bottom: 'h-full w-full object-contain p-1',
    hat: 'h-full w-full object-contain p-0.5',
    shoes: 'h-full w-full object-contain p-0.5',
    bag: 'h-full w-full object-contain p-1',
    eyewear: 'h-full w-full object-contain p-0.5 opacity-95',
    jewelry: 'h-full w-full object-contain p-0.5 opacity-90',
  }[variant];

  return (
    <div
      className={`absolute pointer-events-none overflow-hidden shadow-[0_16px_32px_rgba(0,0,0,.32)] backdrop-blur-[2px] ${frameClass}`}
      style={style}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,.08),transparent_48%)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`relative drop-shadow-[0_10px_16px_rgba(0,0,0,.35)] ${imageClass}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.src = overlayFallback();
        }}
      />
    </div>
  );
}
