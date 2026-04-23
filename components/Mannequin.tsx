'use client';

import type { CSSProperties } from 'react';
import { proxiedImageUrl } from '@/lib/image-url';
import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';

interface Props {
  items: Partial<Record<Category, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
}

type Tone = { base: string; edge: string; glow: string };

const FRAME_COPY: Record<
  GeneratorFrame,
  {
    label: string;
    shoulder: string;
    torso: string;
    hips: string;
    topWidth: string;
    outerWidth: string;
    bottomWidth: string;
    leftLeg: string;
    rightLeg: string;
    bagAnchor: string;
  }
> = {
  masc: {
    label: 'Menswear frame',
    shoulder: 'w-[146px]',
    torso: 'w-[96px]',
    hips: 'w-[102px]',
    topWidth: 'w-[164px]',
    outerWidth: 'w-[184px]',
    bottomWidth: 'w-[124px]',
    leftLeg: 'left-[69px]',
    rightLeg: 'right-[69px]',
    bagAnchor: 'left-[18px]',
  },
  fem: {
    label: 'Womenswear frame',
    shoulder: 'w-[118px]',
    torso: 'w-[76px]',
    hips: 'w-[88px]',
    topWidth: 'w-[144px]',
    outerWidth: 'w-[170px]',
    bottomWidth: 'w-[110px]',
    leftLeg: 'left-[77px]',
    rightLeg: 'right-[77px]',
    bagAnchor: 'left-[28px]',
  },
  androgynous: {
    label: 'Neutral frame',
    shoulder: 'w-[130px]',
    torso: 'w-[84px]',
    hips: 'w-[94px]',
    topWidth: 'w-[154px]',
    outerWidth: 'w-[176px]',
    bottomWidth: 'w-[116px]',
    leftLeg: 'left-[73px]',
    rightLeg: 'right-[73px]',
    bagAnchor: 'left-[23px]',
  },
};

const BODY_MARKERS: Array<{ category: Category; label: string; className: string }> = [
  { category: 'hat', label: 'Hat', className: 'left-1/2 top-[18px] -translate-x-1/2' },
  { category: 'eyewear', label: 'Eyewear', className: 'left-[24px] top-[52px]' },
  { category: 'jewelry', label: 'Jewelry', className: 'right-[20px] top-[88px]' },
  { category: 'outer', label: 'Outer', className: 'left-[18px] top-[152px]' },
  { category: 'top', label: 'Top', className: 'right-[18px] top-[176px]' },
  { category: 'bag', label: 'Bag', className: 'left-[18px] top-[276px]' },
  { category: 'bottom', label: 'Bottom', className: 'left-[30px] bottom-[72px]' },
  { category: 'shoes', label: 'Shoes', className: 'right-[24px] bottom-[42px]' },
];

const ACCESSORY_CATEGORIES: Array<{ category: Category; label: string }> = [
  { category: 'bag', label: 'Bag' },
  { category: 'eyewear', label: 'Eyewear' },
  { category: 'jewelry', label: 'Jewelry' },
];

const SWATCH_POSITIONS: Record<'hat' | 'top' | 'outer' | 'bottom' | 'shoes', string> = {
  hat: 'right-[-4px] top-[4px] h-[28px] w-[28px] rounded-full',
  top: 'right-[6px] top-[12px] h-[42px] w-[34px] rounded-2xl',
  outer: 'right-[10px] top-[18px] h-[48px] w-[36px] rounded-2xl',
  bottom: 'right-[8px] top-[18px] h-[46px] w-[34px] rounded-2xl',
  shoes: 'left-1/2 top-[2px] h-[28px] w-[54px] -translate-x-1/2 rounded-full',
};

const COLOR_SWATCHES: Record<string, string> = {
  black: '#191817',
  white: '#f2ede6',
  cream: '#d9ccb6',
  beige: '#b79e79',
  tan: '#a57d5b',
  brown: '#6e4e39',
  grey: '#6d7278',
  gray: '#6d7278',
  silver: '#939aa6',
  gold: '#b08d42',
  navy: '#2a3955',
  blue: '#45658d',
  red: '#83353d',
  pink: '#b86e82',
  green: '#54624e',
  olive: '#5a634e',
};

export function Mannequin({ items, skinTone, bodyType = 'androgynous' }: Props) {
  const mannequinStyle = skinTone ? ({ '--skin': skinTone } as CSSProperties) : undefined;
  const frame = FRAME_COPY[bodyType];
  const filled = Object.values(items).filter(Boolean).length;
  const heroItem = items.outer || items.top || items.bottom || items.shoes || items.bag || null;

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-[30px] border border-hairline bg-black" style={mannequinStyle}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,.12),transparent_22%),radial-gradient(circle_at_50%_56%,rgba(232,54,93,.14),transparent_42%),linear-gradient(180deg,#161412,#080808_74%,#030303)]" />
      <div className="absolute inset-0 opacity-[.1] [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="absolute left-1/2 top-14 h-[324px] w-[250px] -translate-x-1/2 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-24 h-[304px] w-[200px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />

      <div className="absolute left-4 top-4 z-30 max-w-[156px] rounded-2xl border border-hairline bg-black/55 p-3 shadow-[0_18px_50px_rgba(0,0,0,.32)] backdrop-blur-md">
        <div className="text-[9px] uppercase tracking-[.16em] text-muted">Fit profile</div>
        <div className="mt-1 font-serif text-[17px] font-semibold text-ink">{frame.label}</div>
        <div className="mt-1 text-[11px] leading-snug text-muted-2">
          {heroItem ? `${heroItem.brand} drives the avatar styling pass.` : 'Pick pieces and the preview stages them directly on the avatar.'}
        </div>
      </div>

      <div className="absolute right-4 top-4 z-30 rounded-2xl border border-hairline bg-black/55 px-3 py-2 text-right shadow-[0_18px_50px_rgba(0,0,0,.32)] backdrop-blur-md">
        <div className="font-serif text-[22px] font-semibold leading-none text-ink">{filled}/8</div>
        <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-muted">styled</div>
      </div>

      <div className="absolute left-1/2 top-[42px] z-10 h-[346px] w-[230px] -translate-x-1/2">
        <div className="absolute left-1/2 top-[300px] h-10 w-[182px] -translate-x-1/2 rounded-full bg-black/60 blur-md" />
        <div className="absolute left-1/2 top-[314px] h-5 w-[132px] -translate-x-1/2 rounded-full border border-white/10 bg-white/10" />
        <GhostOutline frame={frame} />

        <PaperDollLayer product={items.hat} category="hat" className="left-1/2 top-[10px] h-[34px] w-[94px] -translate-x-1/2" />
        <AccessoryOverlay product={items.eyewear} category="eyewear" className="left-1/2 top-[22px] h-[38px] w-[86px] -translate-x-1/2" />
        <AccessoryOverlay product={items.jewelry} category="jewelry" className="left-1/2 top-[72px] h-[34px] w-[74px] -translate-x-1/2" />
        <PaperDollLayer product={items.top} category="top" className={`left-1/2 top-[78px] h-[132px] -translate-x-1/2 ${frame.topWidth}`} />
        <PaperDollLayer product={items.outer} category="outer" className={`left-1/2 top-[68px] h-[160px] -translate-x-1/2 ${frame.outerWidth}`} />
        <PaperDollLayer product={items.bottom} category="bottom" className={`left-1/2 top-[190px] h-[150px] -translate-x-1/2 ${frame.bottomWidth}`} />
        <PaperDollLayer product={items.shoes} category="shoes" className="left-1/2 top-[312px] h-[38px] w-[132px] -translate-x-1/2" />
        <AccessoryOverlay product={items.bag} category="bag" className={`${frame.bagAnchor} top-[164px] h-[108px] w-[82px]`} />

        <div className="pointer-events-none absolute left-1/2 top-[334px] z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[9px] uppercase tracking-[.18em] text-white/60 backdrop-blur">
          Floating outfit preview
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-30 flex items-end justify-between gap-3">
        <div className="flex max-w-[170px] gap-2">
          {ACCESSORY_CATEGORIES.map((entry) => (
            <AccessoryTile key={entry.category} label={entry.label} category={entry.category} product={items[entry.category]} />
          ))}
        </div>
        <Lookboard items={items} />
      </div>

      {BODY_MARKERS.map((marker) => {
        const hasItem = Boolean(items[marker.category]);
        return (
          <div
            key={marker.category}
            className={`absolute z-30 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[.12em] backdrop-blur-md ${marker.className} ${
              hasItem ? 'border-accent/70 bg-accent/20 text-ink shadow-pink-glow' : 'border-hairline bg-black/35 text-muted-2'
            }`}
          >
            {marker.label}
          </div>
        );
      })}
    </div>
  );
}

function GhostOutline({
  frame,
}: {
  frame: {
    shoulder: string;
    torso: string;
    hips: string;
    leftLeg: string;
    rightLeg: string;
  };
}) {
  return (
    <>
      <div className="absolute left-1/2 top-[2px] z-[1] h-[56px] w-[52px] -translate-x-1/2 rounded-[24px_24px_18px_18px] border border-dashed border-white/12 bg-white/[0.015]" />
      <div className="absolute left-1/2 top-[58px] z-[1] h-[16px] w-[16px] -translate-x-1/2 rounded-full border border-dashed border-white/10" />
      <div className={`absolute left-1/2 top-[74px] z-[1] h-[24px] -translate-x-1/2 rounded-full border border-dashed border-white/10 ${frame.shoulder}`} />
      <div className={`absolute left-1/2 top-[90px] z-[1] h-[104px] -translate-x-1/2 rounded-[28px_28px_20px_20px] border border-dashed border-white/10 ${frame.torso}`} />
      <div className="absolute left-[39px] top-[90px] z-[1] h-[124px] w-[24px] rotate-[6deg] rounded-[14px] border border-dashed border-white/10" />
      <div className="absolute right-[39px] top-[90px] z-[1] h-[124px] w-[24px] -rotate-[6deg] rounded-[14px] border border-dashed border-white/10" />
      <div className={`absolute left-1/2 top-[188px] z-[1] h-[44px] -translate-x-1/2 rounded-[18px_18px_28px_28px] border border-dashed border-white/10 ${frame.hips}`} />
      <div className={`absolute top-[224px] z-[1] h-[114px] w-[32px] rounded-[13px_13px_18px_18px] border border-dashed border-white/10 ${frame.leftLeg}`} />
      <div className={`absolute top-[224px] z-[1] h-[114px] w-[32px] rounded-[13px_13px_18px_18px] border border-dashed border-white/10 ${frame.rightLeg}`} />
      <div className="absolute left-[54px] top-[324px] z-[1] h-[17px] w-[58px] rounded-[10px_6px_14px_14px] border border-dashed border-white/10" />
      <div className="absolute right-[54px] top-[324px] z-[1] h-[17px] w-[58px] rounded-[6px_10px_14px_14px] border border-dashed border-white/10" />
    </>
  );
}

function PaperDollLayer({
  product,
  category,
  className,
}: {
  product?: Product;
  category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes';
  className: string;
}) {
  if (!product) return null;

  const variant = detectVariant(product, category);
  const tone = productTone(product, category);

  return (
    <div className={`pointer-events-none absolute ${className}`}>
      <div className="absolute inset-[7%] rounded-[26px] bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,.05),transparent_55%)] opacity-60" />
      <svg viewBox="0 0 100 100" className="relative z-10 h-full w-full overflow-visible drop-shadow-[0_14px_22px_rgba(0,0,0,.28)]">
        {renderGarmentSvg(category, variant, tone)}
      </svg>
      <GarmentPreviewBadge product={product} category={category} />
      <div className="absolute bottom-1 left-1/2 z-20 max-w-[76%] -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-center text-[7px] uppercase tracking-[.16em] text-white/70 backdrop-blur">
        {product.brand}
      </div>
    </div>
  );
}

function GarmentPreviewBadge({
  product,
  category,
}: {
  product: Product;
  category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes';
}) {
  return (
    <div className={`absolute z-20 overflow-hidden border border-white/10 bg-transparent shadow-[0_10px_22px_rgba(0,0,0,.22)] ${SWATCH_POSITIONS[category]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxiedImageUrl(product.imageUrl)}
        alt=""
        className={`h-full w-full ${category === 'shoes' || category === 'hat' ? 'object-contain p-1' : 'object-cover'} bg-transparent`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.src = overlayFallback(product.brand);
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,.18))]" />
    </div>
  );
}

function AccessoryOverlay({
  product,
  category,
  className,
}: {
  product?: Product;
  category: 'bag' | 'eyewear' | 'jewelry';
  className: string;
}) {
  if (!product) return null;

  const tone = productTone(product, category);

  return (
    <div className={`pointer-events-none absolute z-20 ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible drop-shadow-[0_12px_18px_rgba(0,0,0,.24)]">
        {renderAccessorySvg(category, tone)}
      </svg>
      <div className={`absolute overflow-hidden border border-white/10 bg-transparent shadow-[0_10px_20px_rgba(0,0,0,.2)] ${category === 'bag' ? 'bottom-[6px] right-[2px] h-[38px] w-[32px] rounded-2xl' : category === 'eyewear' ? 'left-1/2 top-[8px] h-[22px] w-[34px] -translate-x-1/2 rounded-full' : 'left-1/2 top-[12px] h-[18px] w-[18px] -translate-x-1/2 rounded-full'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxiedImageUrl(product.imageUrl)}
          alt=""
          className="h-full w-full object-cover bg-transparent"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.src = overlayFallback(product.brand);
          }}
        />
      </div>
    </div>
  );
}

function renderGarmentSvg(category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes', variant: string, tone: Tone) {
  const stroke = tone.edge;
  const fill = tone.base;
  const fill2 = tone.glow;

  if (category === 'hat') {
    if (variant === 'beanie') {
      return (
        <>
          <path d="M24 58 C24 28, 76 28, 76 58 L76 70 L24 70 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <rect x="24" y="65" width="52" height="8" rx="4" fill={fill2} opacity="0.35" />
        </>
      );
    }
    if (variant === 'bucket') {
      return (
        <>
          <path d="M34 28 H66 L72 56 H28 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <ellipse cx="50" cy="58" rx="30" ry="8" fill={fill2} opacity="0.35" />
        </>
      );
    }
    return (
      <>
        <path d="M28 52 C28 30, 72 30, 72 52 L72 60 L28 60 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
        <path d="M18 58 C34 52, 66 52, 82 58 L70 68 H30 Z" fill={fill2} opacity="0.42" />
      </>
    );
  }

  if (category === 'top') {
    if (variant === 'tank') {
      return (
        <>
          <rect x="34" y="10" width="8" height="18" rx="4" fill={fill} stroke={stroke} strokeWidth="1.1" />
          <rect x="58" y="10" width="8" height="18" rx="4" fill={fill} stroke={stroke} strokeWidth="1.1" />
          <path d="M28 22 C38 12, 62 12, 72 22 L68 82 H32 Z" fill={fill} stroke={stroke} strokeWidth="1.3" />
          <path d="M40 24 Q50 34 60 24" fill="none" stroke={fill2} strokeWidth="1.2" opacity="0.45" />
        </>
      );
    }
    if (variant === 'shirt') {
      return (
        <>
          <path d="M18 28 L34 12 H66 L82 28 L72 42 L68 88 H32 L28 42 Z" fill={fill} stroke={stroke} strokeWidth="1.3" />
          <path d="M34 12 L44 28" stroke={fill2} strokeWidth="2" opacity="0.45" />
          <path d="M66 12 L56 28" stroke={fill2} strokeWidth="2" opacity="0.45" />
          <path d="M50 26 V84" stroke={fill2} strokeWidth="1.2" opacity="0.42" />
        </>
      );
    }
    if (variant === 'hoodie') {
      return (
        <>
          <path d="M22 28 L34 18 H66 L78 28 L70 42 L68 84 H32 L30 42 Z" fill={fill} stroke={stroke} strokeWidth="1.3" />
          <path d="M36 10 C42 2, 58 2, 64 10 L66 24 H34 Z" fill={fill2} opacity="0.34" stroke={stroke} strokeWidth="1.1" />
          <rect x="40" y="58" width="20" height="12" rx="6" fill={fill2} opacity="0.3" />
        </>
      );
    }
    if (variant === 'bodysuit') {
      return (
        <>
          <rect x="35" y="10" width="7" height="16" rx="4" fill={fill} stroke={stroke} strokeWidth="1.1" />
          <rect x="58" y="10" width="7" height="16" rx="4" fill={fill} stroke={stroke} strokeWidth="1.1" />
          <path d="M30 20 C40 12, 60 12, 70 20 L64 84 L56 96 H44 L36 84 Z" fill={fill} stroke={stroke} strokeWidth="1.3" />
        </>
      );
    }
    return (
      <>
        <path d="M14 30 L30 16 H70 L86 30 L76 44 L72 82 H28 L24 44 Z" fill={fill} stroke={stroke} strokeWidth="1.3" />
        <path d="M40 18 Q50 28 60 18" fill="none" stroke={fill2} strokeWidth="1.2" opacity="0.45" />
      </>
    );
  }

  if (category === 'outer') {
    if (variant === 'puffer') {
      return (
        <>
          <path d="M10 26 L28 12 H72 L90 26 L78 42 L74 94 H26 L22 42 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {[36, 48, 60, 72, 84].map((y) => <line key={y} x1="24" y1={y} x2="76" y2={y} stroke={fill2} strokeWidth="1.4" opacity="0.38" />)}
        </>
      );
    }
    if (variant === 'trench') {
      return (
        <>
          <path d="M18 20 L34 10 H66 L82 20 L74 34 L68 98 H32 L26 34 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          <path d="M34 10 L46 28" stroke={fill2} strokeWidth="2" opacity="0.45" />
          <path d="M66 10 L54 28" stroke={fill2} strokeWidth="2" opacity="0.45" />
          <rect x="34" y="54" width="32" height="6" rx="3" fill={fill2} opacity="0.34" />
        </>
      );
    }
    if (variant === 'blazer') {
      return (
        <>
          <path d="M16 24 L32 12 H68 L84 24 L74 40 L70 90 H30 L26 40 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          <path d="M34 14 L46 34" stroke={fill2} strokeWidth="2" opacity="0.48" />
          <path d="M66 14 L54 34" stroke={fill2} strokeWidth="2" opacity="0.48" />
          <line x1="50" y1="34" x2="50" y2="88" stroke={fill2} strokeWidth="1.2" opacity="0.42" />
        </>
      );
    }
    if (variant === 'bomber') {
      return (
        <>
          <path d="M12 28 L28 16 H72 L88 28 L78 42 L72 80 H28 L22 42 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
          <rect x="30" y="78" width="40" height="8" rx="4" fill={fill2} opacity="0.32" />
        </>
      );
    }
    return (
      <>
        <path d="M12 26 L30 12 H70 L88 26 L78 42 L72 92 H28 L22 42 Z" fill={fill} stroke={stroke} strokeWidth="1.4" />
        <path d="M40 14 Q50 28 60 14" fill="none" stroke={fill2} strokeWidth="1.2" opacity="0.42" />
      </>
    );
  }

  if (category === 'bottom') {
    if (variant === 'skirt') {
      return (
        <>
          <rect x="28" y="8" width="44" height="12" rx="6" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <path d="M30 18 H70 L82 78 H18 Z" fill={fill2} opacity="0.8" stroke={stroke} strokeWidth="1.2" />
        </>
      );
    }
    if (variant === 'shorts') {
      return (
        <>
          <rect x="24" y="8" width="52" height="12" rx="6" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <rect x="22" y="20" width="24" height="34" rx="8" fill={fill2} opacity="0.82" stroke={stroke} strokeWidth="1.2" />
          <rect x="54" y="20" width="24" height="34" rx="8" fill={fill2} opacity="0.82" stroke={stroke} strokeWidth="1.2" />
        </>
      );
    }
    if (variant === 'leggings') {
      return (
        <>
          <rect x="24" y="8" width="52" height="12" rx="6" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <rect x="30" y="18" width="14" height="72" rx="8" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <rect x="56" y="18" width="14" height="72" rx="8" fill={fill} stroke={stroke} strokeWidth="1.2" />
        </>
      );
    }
    return (
      <>
        <rect x="22" y="8" width="56" height="12" rx="6" fill={fill} stroke={stroke} strokeWidth="1.2" />
        <path d="M28 18 H48 L44 96 H26 Z" fill={fill2} opacity="0.84" stroke={stroke} strokeWidth="1.2" />
        <path d="M52 18 H72 L74 96 H56 Z" fill={fill2} opacity="0.84" stroke={stroke} strokeWidth="1.2" />
      </>
    );
  }

  if (variant === 'heels') {
    return (
      <>
        <path d="M18 62 C22 48, 36 46, 48 52 L46 68 H18 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
        <rect x="40" y="66" width="2" height="14" rx="1" fill={stroke} />
        <path d="M52 52 C64 46, 78 48, 82 62 H54 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
        <rect x="58" y="66" width="2" height="14" rx="1" fill={stroke} />
      </>
    );
  }
  if (variant === 'boots') {
    return (
      <>
        <rect x="18" y="22" width="20" height="40" rx="6" fill={fill} stroke={stroke} strokeWidth="1.2" />
        <path d="M12 54 H42 L44 72 H12 Z" fill={fill2} opacity="0.82" stroke={stroke} strokeWidth="1.2" />
        <rect x="62" y="22" width="20" height="40" rx="6" fill={fill} stroke={stroke} strokeWidth="1.2" />
        <path d="M58 54 H88 L88 72 H56 Z" fill={fill2} opacity="0.82" stroke={stroke} strokeWidth="1.2" />
      </>
    );
  }
  if (variant === 'clogs') {
    return (
      <>
        <path d="M12 56 C20 46, 36 44, 46 52 L46 70 H12 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
        <path d="M54 52 C64 44, 80 46, 88 56 H54 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
      </>
    );
  }
  return (
    <>
      <path d="M10 58 C20 46, 38 44, 48 52 L46 72 H10 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
      <path d="M52 52 C62 44, 80 46, 90 58 H54 Z" fill={fill} stroke={stroke} strokeWidth="1.2" />
    </>
  );
}

function renderAccessorySvg(category: 'bag' | 'eyewear' | 'jewelry', tone: Tone) {
  const stroke = tone.edge;
  const fill = tone.base;
  const fill2 = tone.glow;

  if (category === 'eyewear') {
    return (
      <>
        <rect x="16" y="38" width="26" height="18" rx="7" fill={fill} opacity="0.8" stroke={stroke} strokeWidth="1.4" />
        <rect x="58" y="38" width="26" height="18" rx="7" fill={fill} opacity="0.8" stroke={stroke} strokeWidth="1.4" />
        <rect x="42" y="44" width="16" height="4" rx="2" fill={fill2} opacity="0.75" />
        <path d="M16 42 L8 38" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M84 42 L92 38" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      </>
    );
  }

  if (category === 'jewelry') {
    return (
      <>
        <path d="M24 24 C28 46, 72 46, 76 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="50" cy="50" r="10" fill={fill2} opacity="0.88" stroke={stroke} strokeWidth="1.3" />
        <circle cx="50" cy="50" r="4" fill={fill} />
      </>
    );
  }

  return (
    <>
      <path d="M20 34 C24 16, 44 16, 50 34" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 34 C28 18, 54 18, 62 34 V74 C62 82, 56 88, 48 88 H22 C14 88, 8 82, 8 74 V46 C8 40, 12 34, 20 34 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <rect x="16" y="44" width="38" height="26" rx="10" fill={fill2} opacity="0.34" />
    </>
  );
}

function Lookboard({ items }: { items: Partial<Record<Category, Product>> }) {
  const display = [items.top, items.outer, items.bottom, items.shoes]
    .filter((product): product is Product => Boolean(product))
    .slice(0, 4);
  if (!display.length) return null;

  return (
    <div className="rounded-2xl border border-hairline bg-black/45 px-2 py-2 backdrop-blur-md">
      <div className="mb-1 text-[8px] uppercase tracking-[.18em] text-white/42">Lookboard</div>
      <div className="flex gap-1.5">
        {display.map((product) => (
          <div key={product.id} className="h-[46px] w-[38px] overflow-hidden rounded-xl border border-white/10 bg-black/35">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxiedImageUrl(product.imageUrl)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.src = overlayFallback(product.brand);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessoryTile({
  label,
  category,
  product,
}: {
  label: string;
  category: Category;
  product?: Product;
}) {
  const tone = product ? productTone(product, category) : null;
  return (
    <div
      className={`h-[58px] w-[50px] overflow-hidden rounded-2xl border ${product ? 'border-white/12 shadow-pink-glow' : 'border-dashed border-white/14 bg-black/25'}`}
      style={tone ? { background: `linear-gradient(180deg, ${withAlpha(tone.base, 0.84)} 0%, rgba(0,0,0,.78) 100%)` } : undefined}
      title={product ? `${product.brand} ${product.name}` : label}
    >
      {product ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedImageUrl(product.imageUrl)}
            alt=""
            className="h-[40px] w-full object-cover p-1.5"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.src = overlayFallback(product.brand);
            }}
          />
          <div className="truncate px-1 text-center text-[7px] uppercase tracking-[.1em] text-white/70">{label}</div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center px-1 text-center text-[7px] uppercase tracking-[.12em] text-white/30">
          {label}
        </div>
      )}
    </div>
  );
}

function detectVariant(product: Product, category: 'hat' | 'top' | 'outer' | 'bottom' | 'shoes'): string {
  const text = [
    product.brand,
    product.name,
    ...(Array.isArray(product.metadata?.styles) ? (product.metadata.styles as string[]) : []),
    ...(Array.isArray(product.metadata?.keywords) ? (product.metadata.keywords as string[]) : []),
  ].join(' ').toLowerCase();

  if (category === 'hat') {
    if (text.includes('beanie')) return 'beanie';
    if (text.includes('bucket')) return 'bucket';
    return 'cap';
  }
  if (category === 'top') {
    if (text.includes('hoodie') || text.includes('crewneck')) return 'hoodie';
    if (text.includes('bodysuit') || text.includes('square neck') || text.includes('corset')) return 'bodysuit';
    if (text.includes('shirt') || text.includes('oxford') || text.includes('button') || text.includes('cardigan') || text.includes('polo')) return 'shirt';
    if (text.includes('tank') || text.includes('rib') || text.includes('bra')) return 'tank';
    return 'tee';
  }
  if (category === 'outer') {
    if (text.includes('puffer') || text.includes('nuptse') || text.includes('supersnug')) return 'puffer';
    if (text.includes('trench') || text.includes('coat')) return 'trench';
    if (text.includes('blazer')) return 'blazer';
    if (text.includes('bomber') || text.includes('leather')) return 'bomber';
    return 'jacket';
  }
  if (category === 'bottom') {
    if (text.includes('skirt')) return 'skirt';
    if (text.includes('short')) return 'shorts';
    if (text.includes('legging') || text.includes('align') || text.includes('tennis')) return 'leggings';
    return 'pants';
  }
  if (text.includes('heel') || text.includes('pump') || text.includes('slingback')) return 'heels';
  if (text.includes('boot') || text.includes('ugg') || text.includes('martens')) return 'boots';
  if (text.includes('clog') || text.includes('birkenstock') || text.includes('boston')) return 'clogs';
  return 'sneakers';
}

function productTone(product: Product, fallbackCategory: Category): Tone {
  const base = pickAccentColor(product, fallbackCategory);
  return { base, edge: darken(base, 0.18), glow: lighten(base, 0.22) };
}

function pickAccentColor(product: Product, fallbackCategory: Category): string {
  const colors = Array.isArray(product.metadata?.colors) ? (product.metadata.colors as string[]) : [];
  for (const color of colors) {
    const normalized = String(color).toLowerCase();
    if (COLOR_SWATCHES[normalized]) return COLOR_SWATCHES[normalized];
  }

  const brand = product.brand.toLowerCase();
  if (brand.includes('nike') || brand.includes('jordan')) return '#6f5140';
  if (brand.includes('zara') || brand.includes('aritzia')) return '#7c6959';
  if (brand.includes('stussy') || brand.includes('carhartt')) return '#54463a';
  if (brand.includes('prada') || brand.includes('saint laurent')) return '#1c1c1e';
  if (brand.includes('lululemon') || brand.includes('alo')) return '#8d6c68';

  const fallback: Record<Category, string> = {
    hat: '#2a2a2e',
    outer: '#3b352f',
    top: '#4a433d',
    bottom: '#34363d',
    shoes: '#2f2b2b',
    bag: '#4b3f35',
    eyewear: '#2a292c',
    jewelry: '#7a6940',
  };
  return fallback[fallbackCategory];
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const value = Math.max(0, Math.min(255, Math.round(alpha * 255))).toString(16).padStart(2, '0');
  return `#${normalized}${value}`;
}

function lighten(hex: string, amount: number): string {
  return mix(hex, '#ffffff', amount);
}

function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

function mix(hex: string, target: string, amount: number): string {
  const from = parseHex(hex);
  const to = parseHex(target);
  if (!from || !to) return hex;
  return toHex(
    Math.round(from.r + (to.r - from.r) * amount),
    Math.round(from.g + (to.g - from.g) * amount),
    Math.round(from.b + (to.b - from.b) * amount),
  );
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function overlayFallback(label: string): string {
  const safeLabel = label.slice(0, 10).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 220">
      <rect width="180" height="220" rx="24" fill="#050505" />
      <rect x="14" y="14" width="152" height="192" rx="18" fill="#e8365d" opacity="0.14" />
      <circle cx="90" cy="82" r="34" fill="#fffefb" opacity="0.9" />
      <rect x="46" y="132" width="88" height="12" rx="6" fill="#fffefb" opacity="0.78" />
      <text x="90" y="170" text-anchor="middle" fill="#fffefb" font-family="Arial, sans-serif" font-size="16" font-weight="700">${safeLabel}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
