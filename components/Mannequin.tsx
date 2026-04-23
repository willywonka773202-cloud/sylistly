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

const FRAME_COPY: Record<GeneratorFrame, { label: string; shoulder: string; waist: string }> = {
  masc: {
    label: 'Menswear frame',
    shoulder: 'w-[138px]',
    waist: 'w-[88px]',
  },
  fem: {
    label: 'Womenswear frame',
    shoulder: 'w-[116px]',
    waist: 'w-[74px]',
  },
  androgynous: {
    label: 'Neutral frame',
    shoulder: 'w-[124px]',
    waist: 'w-[80px]',
  },
};

const BODY_MARKERS: Array<{ category: Category; label: string; className: string }> = [
  { category: 'hat', label: 'Hat', className: 'left-[50%] top-[18px] -translate-x-1/2' },
  { category: 'outer', label: 'Outer', className: 'left-6 top-[150px]' },
  { category: 'top', label: 'Top', className: 'right-6 top-[168px]' },
  { category: 'bottom', label: 'Bottom', className: 'left-7 top-[284px]' },
  { category: 'shoes', label: 'Shoes', className: 'right-8 bottom-[44px]' },
];

const ACCESSORY_CATEGORIES: Array<{ category: Category; label: string }> = [
  { category: 'bag', label: 'Bag' },
  { category: 'eyewear', label: 'Eyewear' },
  { category: 'jewelry', label: 'Jewelry' },
];

export function Mannequin({ items, skinTone, bodyType = 'androgynous' }: Props) {
  const mannequinStyle = skinTone ? ({ '--skin': skinTone } as CSSProperties) : undefined;
  const frame = FRAME_COPY[bodyType];
  const filled = Object.values(items).filter(Boolean).length;
  const heroItem = items.outer || items.top || items.bottom || items.shoes || null;

  return (
    <div
      className="relative h-[430px] w-full overflow-hidden rounded-[30px] border border-hairline bg-black"
      style={mannequinStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,.14),transparent_24%),radial-gradient(circle_at_50%_54%,rgba(232,54,93,.18),transparent_44%),linear-gradient(180deg,#171612,#090908_70%,#040404)]" />
      <div className="absolute inset-0 opacity-[.17] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="absolute left-1/2 top-16 h-[314px] w-[242px] -translate-x-1/2 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-24 h-[292px] w-[188px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />

      <div className="absolute left-4 top-4 z-30 max-w-[150px] rounded-2xl border border-hairline bg-black/55 p-3 shadow-[0_18px_50px_rgba(0,0,0,.32)] backdrop-blur-md">
        <div className="text-[9px] uppercase tracking-[.16em] text-muted">Fit profile</div>
        <div className="mt-1 font-serif text-[17px] font-semibold text-ink">{frame.label}</div>
        <div className="mt-1 text-[11px] leading-snug text-muted-2">
          {heroItem ? `${heroItem.brand} anchors this preview.` : 'Add a piece to start building the look.'}
        </div>
      </div>

      <div className="absolute right-4 top-4 z-30 rounded-2xl border border-hairline bg-black/55 px-3 py-2 text-right shadow-[0_18px_50px_rgba(0,0,0,.32)] backdrop-blur-md">
        <div className="font-serif text-[22px] font-semibold leading-none text-ink">{filled}/8</div>
        <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-muted">slots</div>
      </div>

      <div className="absolute left-1/2 top-[58px] z-10 h-[330px] w-[210px] -translate-x-1/2">
        <div className="absolute left-1/2 top-[286px] h-10 w-[164px] -translate-x-1/2 rounded-full bg-black/60 blur-md" />
        <div className="absolute left-1/2 top-[298px] h-5 w-[120px] -translate-x-1/2 rounded-full border border-white/10 bg-white/10" />

        <div className="absolute left-1/2 top-0 z-20 h-[58px] w-[52px] -translate-x-1/2 rounded-[24px_24px_18px_18px] skin shadow-[inset_-4px_-5px_12px_rgba(0,0,0,.22),0_14px_24px_rgba(0,0,0,.28)]" />
        <div className="absolute left-1/2 top-[53px] z-10 h-[18px] w-[18px] -translate-x-1/2 rounded skin" />
        <div className={`absolute left-1/2 top-[70px] z-10 h-[28px] -translate-x-1/2 rounded-[999px] skin ${frame.shoulder}`} />
        <div className={`absolute left-1/2 top-[88px] z-10 h-[98px] -translate-x-1/2 rounded-[24px_24px_18px_18px] skin shadow-[inset_-5px_-6px_14px_rgba(0,0,0,.2)] ${frame.waist}`} />
        <div className="absolute left-[43px] top-[88px] z-10 h-[118px] w-[24px] rotate-[7deg] rounded-[14px] skin" />
        <div className="absolute right-[43px] top-[88px] z-10 h-[118px] w-[24px] -rotate-[7deg] rounded-[14px] skin" />
        <div className="absolute left-[39px] top-[198px] z-20 h-[20px] w-[20px] rounded-full skin" />
        <div className="absolute right-[39px] top-[198px] z-20 h-[20px] w-[20px] rounded-full skin" />
        <div className="absolute left-1/2 top-[178px] z-10 h-[42px] w-[92px] -translate-x-1/2 rounded-[18px_18px_26px_26px] skin" />
        <div className="absolute left-[72px] top-[212px] z-10 h-[112px] w-[32px] rounded-[13px_13px_18px_18px] skin" />
        <div className="absolute right-[72px] top-[212px] z-10 h-[112px] w-[32px] rounded-[13px_13px_18px_18px] skin" />
        <div className="absolute left-[58px] top-[318px] z-20 h-[17px] w-[54px] rounded-[10px_6px_14px_14px] skin" />
        <div className="absolute right-[58px] top-[318px] z-20 h-[17px] w-[54px] rounded-[6px_10px_14px_14px] skin" />

        <GarmentZone
          product={items.hat}
          label="Hat"
          className="left-1/2 top-[-10px] z-40 h-[42px] w-[86px] -translate-x-1/2 rounded-[18px]"
          imageClassName="p-1"
        />
        <GarmentZone
          product={items.top}
          label="Top"
          className="left-1/2 top-[76px] z-30 h-[114px] w-[112px] -translate-x-1/2 rounded-[24px_24px_28px_28px]"
        />
        <GarmentZone
          product={items.outer}
          label="Outer"
          className="left-1/2 top-[66px] z-40 h-[140px] w-[146px] -translate-x-1/2 rounded-[30px_30px_24px_24px]"
        />
        <GarmentZone
          product={items.bottom}
          label="Bottom"
          className="left-1/2 top-[176px] z-30 h-[146px] w-[104px] -translate-x-1/2 rounded-[22px_22px_30px_30px]"
        />
        <GarmentZone
          product={items.shoes}
          label="Shoes"
          className="left-1/2 top-[309px] z-40 h-[38px] w-[126px] -translate-x-1/2 rounded-[18px]"
          imageClassName="p-1"
        />
      </div>

      <div className="absolute bottom-4 left-4 z-30 flex max-w-[170px] gap-2">
        {ACCESSORY_CATEGORIES.map((entry) => (
          <AccessoryTile key={entry.category} label={entry.label} product={items[entry.category]} />
        ))}
      </div>

      {BODY_MARKERS.map((marker) => {
        const hasItem = Boolean(items[marker.category]);
        return (
          <div
            key={marker.category}
            className={`absolute z-30 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[.12em] backdrop-blur-md ${marker.className} ${
              hasItem
                ? 'border-accent/70 bg-accent/20 text-ink shadow-pink-glow'
                : 'border-hairline bg-black/35 text-muted-2'
            }`}
          >
            {marker.label}
          </div>
        );
      })}
    </div>
  );
}

function GarmentZone({
  product,
  label,
  className,
  imageClassName = 'p-2',
}: {
  product?: Product;
  label: string;
  className: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={`absolute overflow-hidden border shadow-[0_18px_42px_rgba(0,0,0,.38)] backdrop-blur-[2px] ${
        product ? 'border-white/18 bg-black/72' : 'border-dashed border-white/14 bg-black/20'
      } ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,.1),transparent_48%)]" />
      {product ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedImageUrl(product.imageUrl)}
            alt=""
            className={`relative h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,.42)] ${imageClassName}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.src = overlayFallback(product.brand);
            }}
          />
          <div className="absolute bottom-1 left-1 right-1 truncate rounded-full bg-black/70 px-2 py-0.5 text-center text-[8px] uppercase tracking-[.12em] text-white/70">
            {label}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[9px] uppercase tracking-[.14em] text-white/28">
          {label}
        </div>
      )}
    </div>
  );
}

function AccessoryTile({ label, product }: { label: string; product?: Product }) {
  return (
    <div
      className={`h-[56px] w-[48px] overflow-hidden rounded-2xl border ${
        product ? 'border-accent/35 bg-black/70 shadow-pink-glow' : 'border-dashed border-white/14 bg-black/25'
      }`}
      title={product ? `${product.brand} ${product.name}` : label}
    >
      {product ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedImageUrl(product.imageUrl)}
            alt=""
            className="h-[38px] w-full object-contain p-1.5"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.src = overlayFallback(product.brand);
            }}
          />
          <div className="truncate px-1 text-center text-[7px] uppercase tracking-[.1em] text-white/60">{label}</div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center px-1 text-center text-[7px] uppercase tracking-[.12em] text-white/30">
          {label}
        </div>
      )}
    </div>
  );
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
