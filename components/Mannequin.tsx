'use client';

import { proxiedImageUrl } from '@/lib/image-url';
import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';

interface Props {
  items: Partial<Record<Category, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
}

type BoardLayout = {
  className: string;
  imageClassName: string;
  placements: Partial<Record<Category, string>>;
  order: Category[];
};

const PRODUCT_SCALE: Partial<Record<Category, string>> = {
  eyewear: 'scale(1.08)',
  hat: 'scale(1.1)',
  outer: 'scale(1.08)',
  top: 'scale(1.12)',
  bottom: 'scale(1.08)',
  bag: 'scale(1.08)',
  jewelry: 'scale(1.1)',
  shoes: 'scale(0.96)',
};

const PRODUCT_POSITION: Partial<Record<Category, string>> = {
  eyewear: 'center center',
  hat: 'center center',
  outer: 'center top',
  top: 'center top',
  bottom: 'center top',
  bag: 'center center',
  jewelry: 'center center',
  shoes: 'center bottom',
};

const FRAME_LABELS: Record<GeneratorFrame, string> = {
  masc: 'Menswear edit',
  fem: 'Womenswear edit',
  androgynous: 'Neutral edit',
};

const BOARD_LAYOUT: BoardLayout = {
  className: 'left-1/2 top-[88px] h-[354px] w-[340px] -translate-x-1/2',
  imageClassName: 'drop-shadow-[0_12px_22px_rgba(0,0,0,.12)]',
  order: ['eyewear', 'hat', 'outer', 'top', 'bottom', 'bag', 'jewelry', 'shoes'],
  placements: {},
};

const EMPTY_HINTS = [
  { className: 'left-[34px] top-[54px] h-[88px] w-[74px] rotate-[-6deg]', label: 'Top' },
  { className: 'left-[48px] top-[150px] h-[126px] w-[82px] rotate-[2deg]', label: 'Bottom' },
  { className: 'left-[48px] bottom-[28px] h-[36px] w-[88px] rotate-[-4deg]', label: 'Shoes' },
];

export function Mannequin({ items, skinTone, bodyType = 'androgynous' }: Props) {
  const filledItems = Object.entries(items).filter((entry): entry is [Category, Product] => Boolean(entry[1]));
  const count = filledItems.length;
  const hasItems = count > 0;
  const warmGlow = skinTone || '#edd7cc';

  return (
    <div
      className="relative h-[468px] w-full overflow-hidden rounded-[30px] border border-[#ebe0d8] bg-[#f7f2ee]"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 14%, rgba(255,255,255,.9), transparent 32%), radial-gradient(circle at 50% 58%, ${hexToRgba(warmGlow, 0.14)}, transparent 36%), linear-gradient(180deg, #faf7f4 0%, #f4ece6 50%, #eee4dd 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,.62),transparent_58%)]" />
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

      <FitBoard layout={BOARD_LAYOUT} items={items} hasItems={hasItems} />

      {!hasItems ? (
        <div className="absolute left-1/2 top-[184px] z-30 w-[174px] -translate-x-1/2 rounded-[24px] border border-white/70 bg-white/88 px-4 py-3 text-center shadow-[0_12px_30px_rgba(84,54,43,.1)] backdrop-blur">
          <div className="font-serif text-[18px] font-semibold text-[#2f2723]">Start styling</div>
          <div className="mt-1 text-[11px] leading-relaxed text-[#7f6f66]">
            Add pieces below and Sylistly will lay them out as a clean shopping board.
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-5 left-4 z-20 rounded-full border border-black/5 bg-white/78 px-3 py-1.5 text-[10px] uppercase tracking-[.18em] text-[#7f6d64] shadow-[0_8px_20px_rgba(84,54,43,.08)] backdrop-blur">
        {count ? `${count} product${count !== 1 ? 's' : ''} in look` : 'Waiting for pieces'}
      </div>
    </div>
  );
}

function FitBoard({ layout, items, hasItems }: { layout: BoardLayout; items: Partial<Record<Category, Product>>; hasItems: boolean }) {
  const placements = resolveBoardPlacements(items);

  return (
    <div
      className={`absolute overflow-hidden rounded-[34px] border border-[#ebe1da] bg-white shadow-[0_22px_46px_rgba(84,54,43,.12)] ${layout.className}`}
    >
      <div className="absolute inset-[10px] rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#fdfaf7_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.28),transparent_18%,transparent_82%,rgba(237,228,221,.28))]" />

      {layout.order.map((category, index) => {
        const product = items[category];
        const placement = placements[category];
        if (!product || !placement) return null;
        return (
          <BoardProduct
            key={`${category}-${product.id}`}
            product={product}
            category={category}
            className={placement}
            imageClassName={layout.imageClassName}
            zIndex={index + 1}
          />
        );
      })}

      {!hasItems
        ? EMPTY_HINTS.map((hint) => (
            <div
              key={hint.label}
              className={`absolute rounded-[24px] border border-dashed border-[#d9cac1] bg-[#fcfaf8]/92 ${hint.className}`}
            >
              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[.18em] text-[#b39d92]">
                {hint.label}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}

function BoardProduct({
  product,
  category,
  className,
  imageClassName,
  zIndex,
}: {
  product: Product;
  category: Category;
  className: string;
  imageClassName: string;
  zIndex: number;
}) {
  return (
    <div className={`absolute ${className}`} style={{ zIndex }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxiedImageUrl(product.imageUrl, { cutout: true, category })}
        alt={`${product.brand} ${product.name}`}
        className={`h-full w-full object-contain ${imageClassName}`}
        style={{
          mixBlendMode: 'multiply',
          transform: PRODUCT_SCALE[category] || 'scale(1.14)',
          objectPosition: PRODUCT_POSITION[category] || 'center center',
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.src = overlayFallback(product.brand);
        }}
      />
      {category === 'jewelry' ? <div className="absolute inset-0 rounded-full bg-white/8 blur-[2px]" /> : null}
    </div>
  );
}

function resolveBoardPlacements(items: Partial<Record<Category, Product>>): Partial<Record<Category, string>> {
  const hasTop = Boolean(items.top);
  const hasOuter = Boolean(items.outer);
  const hasBottom = Boolean(items.bottom);
  const hasBag = Boolean(items.bag);
  const hasJewelry = Boolean(items.jewelry);
  const hasUpperPair = hasTop && hasOuter;
  const hasAccessoryRow = Boolean(items.eyewear || items.hat);

  return {
    eyewear: items.eyewear ? 'left-[28px] top-[20px] h-[34px] w-[82px] -rotate-[3deg]' : undefined,
    hat: items.hat ? 'right-[28px] top-[18px] h-[42px] w-[94px] rotate-[2deg]' : undefined,
    outer: items.outer
      ? hasTop
        ? 'left-[18px] top-[76px] h-[126px] w-[132px] -rotate-[2deg]'
        : `left-1/2 ${hasAccessoryRow ? 'top-[72px]' : 'top-[62px]'} h-[146px] w-[156px] -translate-x-1/2 -rotate-[1deg]`
      : undefined,
    top: items.top
      ? hasOuter
        ? 'right-[18px] top-[82px] h-[98px] w-[108px] rotate-[1deg]'
        : `left-1/2 ${hasAccessoryRow ? 'top-[74px]' : 'top-[64px]'} h-[124px] w-[122px] -translate-x-1/2`
      : undefined,
    bottom: hasBottom ? 'left-1/2 top-[166px] h-[136px] w-[116px] -translate-x-1/2' : undefined,
    bag: hasBag
      ? hasBottom
        ? `left-[22px] ${hasUpperPair ? 'top-[232px]' : 'top-[220px]'} h-[74px] w-[74px] -rotate-[2deg]`
        : 'left-[26px] top-[206px] h-[76px] w-[74px] -rotate-[2deg]'
      : undefined,
    jewelry: hasJewelry
      ? hasBag
        ? 'right-[34px] top-[228px] h-[28px] w-[28px]'
        : 'right-[30px] top-[208px] h-[30px] w-[30px]'
      : undefined,
    shoes: items.shoes
      ? hasBottom
        ? 'left-1/2 bottom-[18px] h-[48px] w-[152px] -translate-x-1/2 -rotate-[1deg]'
        : 'left-1/2 bottom-[26px] h-[50px] w-[156px] -translate-x-1/2 -rotate-[1deg]'
      : undefined,
  };
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
