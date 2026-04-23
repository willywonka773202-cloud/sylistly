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
  eyewear: 'scale(1.1)',
  hat: 'scale(1.12)',
  outer: 'scale(1.1)',
  top: 'scale(1.14)',
  bottom: 'scale(1.12)',
  bag: 'scale(1.1)',
  jewelry: 'scale(1.08)',
  shoes: 'scale(1.1)',
};

const FRAME_LABELS: Record<GeneratorFrame, string> = {
  masc: 'Menswear edit',
  fem: 'Womenswear edit',
  androgynous: 'Neutral edit',
};

const BOARD_LAYOUT: BoardLayout = {
  className: 'left-1/2 top-[78px] h-[344px] w-[326px] -translate-x-1/2',
  imageClassName: 'drop-shadow-[0_12px_22px_rgba(0,0,0,.12)]',
  order: ['eyewear', 'hat', 'outer', 'top', 'bottom', 'bag', 'jewelry', 'shoes'],
  placements: {
    eyewear: 'left-[34px] top-[22px] h-[30px] w-[80px] -rotate-[2deg]',
    hat: 'right-[34px] top-[24px] h-[30px] w-[84px] rotate-[2deg]',
    outer: 'left-[18px] top-[62px] h-[142px] w-[138px] -rotate-[2deg]',
    top: 'right-[18px] top-[60px] h-[112px] w-[104px] rotate-[1deg]',
    bottom: 'left-1/2 top-[166px] h-[148px] w-[122px] -translate-x-1/2',
    bag: 'left-[20px] top-[222px] h-[76px] w-[70px] -rotate-[2deg]',
    jewelry: 'right-[34px] top-[214px] h-[28px] w-[28px]',
    shoes: 'left-1/2 bottom-[18px] h-[48px] w-[146px] -translate-x-1/2 -rotate-[2deg]',
  },
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
  return (
    <div
      className={`absolute overflow-hidden rounded-[34px] border border-[#ebe1da] bg-white shadow-[0_22px_46px_rgba(84,54,43,.12)] ${layout.className}`}
    >
      <div className="absolute inset-[10px] rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#fdfaf7_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.28),transparent_18%,transparent_82%,rgba(237,228,221,.28))]" />

      {layout.order.map((category, index) => {
        const product = items[category];
        const placement = layout.placements[category];
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
        style={{ mixBlendMode: 'multiply', transform: PRODUCT_SCALE[category] || 'scale(1.14)' }}
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
