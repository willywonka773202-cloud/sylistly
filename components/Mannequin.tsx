'use client';

import { useState, type CSSProperties } from 'react';
import { proxiedImageUrl } from '@/lib/image-url';
import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';

interface Props {
  items: Partial<Record<Category, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
}

const FRAME_LABELS: Record<GeneratorFrame, string> = {
  masc: 'Menswear edit',
  fem: 'Womenswear edit',
  androgynous: 'Neutral edit',
};

const CENTER_ORDER: Category[] = ['top', 'bottom', 'shoes'];
const LEFT_RAIL_ORDER: Category[] = ['hat', 'outer', 'top', 'bag'];
const RIGHT_RAIL_ORDER: Category[] = ['eyewear', 'jewelry', 'bottom', 'shoes'];
type Placement = { className: string; style?: CSSProperties };

export function Mannequin({ items, skinTone, bodyType = 'androgynous' }: Props) {
  const count = Object.values(items).filter(Boolean).length;
  const hasItems = count > 0;
  const warmGlow = skinTone || '#edd7cc';
  const centerPlacements = resolveCenterPlacements(items);
  const leftRail = LEFT_RAIL_ORDER.filter((category) => items[category]);
  const rightRail = RIGHT_RAIL_ORDER.filter((category) => items[category]);

  return (
    <div
      className="relative h-[520px] w-full overflow-hidden rounded-[30px] border border-[#ebe0d8] bg-[#f7f2ee]"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 12%, rgba(255,255,255,.94), transparent 28%), radial-gradient(circle at 50% 62%, ${hexToRgba(warmGlow, 0.14)}, transparent 34%), linear-gradient(180deg, #fbf8f5 0%, #f4ece6 56%, #eee3dc 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,.74),transparent_56%)]" />
      <div className="absolute -left-10 top-36 h-40 w-40 rounded-full bg-white/45 blur-3xl" />
      <div className="absolute -right-10 top-28 h-44 w-44 rounded-full bg-[#f3e2da]/52 blur-3xl" />

      <div className="absolute left-4 top-4 z-20">
        <div className="text-[10px] uppercase tracking-[.22em] text-[#7e6f67]">Fit board</div>
        <div className="mt-1 font-serif text-[24px] font-semibold leading-none text-[#2f2723]">
          Outfit <em className="italic text-accent">preview</em>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-20 rounded-full border border-black/5 bg-white/78 px-3 py-2 shadow-[0_8px_20px_rgba(84,54,43,.08)] backdrop-blur">
        <div className="text-[10px] uppercase tracking-[.18em] text-[#8f7d73]">{FRAME_LABELS[bodyType]}</div>
        <div className="mt-1 font-serif text-[19px] font-semibold leading-none text-[#2f2723]">
          {count}/8
        </div>
      </div>

      <div className="absolute left-1/2 top-[70px] h-[390px] w-[360px] -translate-x-1/2 overflow-hidden rounded-[34px] border border-[#ebe1da] bg-white shadow-[0_22px_46px_rgba(84,54,43,.12)]">
        <div className="absolute inset-[12px] rounded-[28px] bg-[linear-gradient(180deg,#ffffff_0%,#fdfaf7_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.3),transparent_18%,transparent_82%,rgba(237,228,221,.22))]" />

        <div className="absolute left-[16px] top-[46px] z-10 flex w-[92px] flex-col gap-4">
          {leftRail.map((category) => (
            <SideCard key={category} category={category} product={items[category]!} />
          ))}
        </div>

        <div className="absolute right-[16px] top-[46px] z-10 flex w-[92px] flex-col gap-4">
          {rightRail.map((category) => (
            <SideCard key={category} category={category} product={items[category]!} />
          ))}
        </div>

        <div className="absolute left-1/2 top-[20px] z-0 h-[326px] w-[188px] -translate-x-1/2 overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#f1f0ef_0%,#ffffff_38%,#f3f1ef_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.82),transparent_32%)]" />
          <div className="absolute left-1/2 top-[26px] h-[64px] w-[60px] -translate-x-1/2 rounded-[24px] bg-[#e9e5e2]/85 blur-[2px]" />
          <div className="absolute left-1/2 top-[72px] h-[138px] w-[96px] -translate-x-1/2 rounded-[36px] bg-[#efebe8]/92 blur-[2px]" />
          <div className="absolute left-1/2 top-[204px] h-[96px] w-[88px] -translate-x-1/2 rounded-[34px] bg-[#f0ece9]/90 blur-[2px]" />
          <div className="absolute left-1/2 bottom-[10px] h-[13px] w-[112px] -translate-x-1/2 rounded-full bg-[#d9d0ca]/52 blur-[6px]" />

          {CENTER_ORDER.map((category, index) => {
            const product = items[category];
            const placement = centerPlacements[category];
            if (!product || !placement) return null;
            return (
              <div
                key={`${category}-${product.id}`}
                className={`absolute ${placement.className}`}
                style={{ zIndex: index + 1, ...(placement.style || {}) }}
              >
                <PreviewImage
                  product={product}
                  category={category}
                  modeClassName={centerImageClassName(category)}
                  wrapperClassName="h-full w-full"
                  blend={category !== 'bag' && category !== 'jewelry'}
                />
              </div>
            );
          })}
        </div>

        {!hasItems ? (
          <div className="absolute left-1/2 top-[158px] z-30 w-[178px] -translate-x-1/2 rounded-[22px] border border-white/70 bg-white/88 px-4 py-3 text-center shadow-[0_12px_30px_rgba(84,54,43,.1)] backdrop-blur">
            <div className="font-serif text-[18px] font-semibold text-[#2f2723]">Start styling</div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#7f6f66]">
              Add pieces and Sylistly will compose them into a cleaner fit board.
            </div>
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-5 left-4 z-20 rounded-full border border-black/5 bg-white/78 px-3 py-1.5 text-[10px] uppercase tracking-[.18em] text-[#7f6d64] shadow-[0_8px_20px_rgba(84,54,43,.08)] backdrop-blur">
        {count ? `${count} product${count !== 1 ? 's' : ''} in look` : 'Waiting for pieces'}
      </div>
    </div>
  );
}

function SideCard({ category, product }: { category: Category; product: Product }) {
  const cardHeight =
    category === 'bag' ? 'h-[116px]'
    : category === 'shoes' ? 'h-[100px]'
    : category === 'eyewear' || category === 'jewelry' ? 'h-[78px]'
    : 'h-[92px]';

  const imageClass =
    category === 'bag' ? 'h-full w-full object-contain p-0.5'
    : category === 'shoes' ? 'h-full w-full object-contain object-bottom p-1.5'
    : category === 'eyewear' ? 'h-full w-full object-contain p-2'
    : 'h-full w-full object-contain p-1.5';

  return (
    <div className="rounded-[18px] border border-[#eee7e0] bg-[#fbfaf8]/96 p-3 shadow-[0_10px_18px_rgba(84,54,43,.06)]">
      <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#b09d93]">
        {category === 'bag' ? 'Bag' : category}
      </div>
      <div className={`mt-2 flex items-center justify-center overflow-hidden rounded-[14px] bg-white ${cardHeight}`}>
        <PreviewImage
          product={product}
          category={category}
          wrapperClassName="h-full w-full"
          modeClassName={imageClass}
          blend={false}
        />
      </div>
    </div>
  );
}

function PreviewImage({
  product,
  category,
  wrapperClassName,
  modeClassName,
  blend,
}: {
  product: Product;
  category: Category;
  wrapperClassName: string;
  modeClassName: string;
  blend: boolean;
}) {
  const [imageMode, setImageMode] = useState<'cutout' | 'plain' | 'fallback'>(() =>
    product.imageUrl ? 'cutout' : 'fallback',
  );

  const src =
    imageMode === 'fallback' || !product.imageUrl
      ? overlayFallback(product.brand)
      : imageMode === 'cutout'
      ? proxiedImageUrl(product.imageUrl, { cutout: true, category })
      : proxiedImageUrl(product.imageUrl);

  return (
    <div className={wrapperClassName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        className={modeClassName}
        style={{
          mixBlendMode: blend ? 'multiply' : 'normal',
          filter: blend ? 'drop-shadow(0 12px 20px rgba(0,0,0,.12))' : 'drop-shadow(0 10px 18px rgba(0,0,0,.08))',
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageMode((current) => (current === 'cutout' ? 'plain' : 'fallback'))}
      />
    </div>
  );
}

function resolveCenterPlacements(items: Partial<Record<Category, Product>>): Partial<Record<Category, Placement>> {
  const hasTop = Boolean(items.top);
  const hasBottom = Boolean(items.bottom);
  const hasShoes = Boolean(items.shoes);

  const topBase = 2;
  const bottomTop = hasTop ? 128 : 90;

  return {
    top: hasTop
      ? { className: 'left-1/2 h-[164px] w-[182px] -translate-x-1/2', style: { top: topBase } }
      : undefined,
    bottom: hasBottom
      ? { className: 'left-1/2 h-[174px] w-[146px] -translate-x-1/2', style: { top: bottomTop } }
      : undefined,
    shoes: hasShoes ? { className: 'left-1/2 bottom-[-2px] h-[60px] w-[152px] -translate-x-1/2' } : undefined,
  };
}

function centerImageClassName(category: Category): string {
  if (category === 'bag') return 'h-full w-full object-contain p-0.5';
  if (category === 'jewelry') return 'h-full w-full object-contain p-1';
  if (category === 'eyewear') return 'h-full w-full object-contain';
  if (category === 'shoes') return 'h-full w-full object-contain object-bottom';
  return 'h-full w-full object-contain';
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(232, 54, 93, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function overlayFallback(label: string): string {
  const safeLabel = label.slice(0, 10).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 220">
      <rect width="180" height="220" rx="24" fill="#ffffff" />
      <rect x="10" y="10" width="160" height="200" rx="20" fill="#f4ebe4" />
      <circle cx="90" cy="80" r="34" fill="#e8365d" opacity="0.12" />
      <rect x="46" y="128" width="88" height="12" rx="6" fill="#cdb9ad" />
      <text x="90" y="170" text-anchor="middle" fill="#5d4a42" font-family="Arial, sans-serif" font-size="16" font-weight="700">${safeLabel}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
