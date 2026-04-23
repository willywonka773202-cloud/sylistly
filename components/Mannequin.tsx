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

const FRAME_LABELS: Record<GeneratorFrame, string> = {
  masc: 'Menswear edit',
  fem: 'Womenswear edit',
  androgynous: 'Neutral edit',
};

const BOARD_LAYOUT: BoardLayout = {
  className: 'left-1/2 top-[58px] h-[338px] w-[248px] -translate-x-1/2',
  imageClassName: 'drop-shadow-[0_14px_24px_rgba(0,0,0,.14)]',
  order: ['eyewear', 'hat', 'outer', 'top', 'bottom', 'bag', 'jewelry', 'shoes'],
  placements: {
    eyewear: 'left-[40px] top-[14px] h-[30px] w-[72px] -rotate-[2deg]',
    hat: 'right-[30px] top-[16px] h-[28px] w-[74px] rotate-[3deg]',
    outer: 'left-[24px] top-[54px] h-[142px] w-[126px] -rotate-[2deg]',
    top: 'right-[22px] top-[42px] h-[112px] w-[96px] rotate-[2deg]',
    bottom: 'left-1/2 top-[146px] h-[146px] w-[112px] -translate-x-1/2',
    bag: 'right-[30px] top-[178px] h-[78px] w-[64px] rotate-[4deg]',
    jewelry: 'right-[28px] top-[244px] h-[28px] w-[28px]',
    shoes: 'left-1/2 bottom-[18px] h-[50px] w-[132px] -translate-x-1/2 -rotate-[3deg]',
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
      className="relative h-[432px] w-full overflow-hidden rounded-[30px] border border-[#e9d8ce] bg-[#f2e8e2]"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 12%, rgba(255,255,255,.82), transparent 30%), radial-gradient(circle at 50% 56%, ${hexToRgba(warmGlow, 0.24)}, transparent 34%), linear-gradient(180deg, #f8f1ec 0%, #efe3dc 44%, #e7d9d0 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,.55),transparent_56%)]" />
      <div className="absolute -left-8 top-28 h-40 w-40 rounded-full bg-white/55 blur-3xl" />
      <div className="absolute -right-8 top-20 h-44 w-44 rounded-full bg-[#f1d9d7]/60 blur-3xl" />

      <div className="absolute left-4 top-4 z-20">
        <div className="text-[10px] uppercase tracking-[.22em] text-[#7e6f67]">Fit board</div>
        <div className="mt-1 font-serif text-[24px] font-semibold leading-none text-[#2f2723]">
          Editorial <em className="italic text-accent">preview</em>
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
        <div className="absolute left-1/2 top-[160px] z-30 w-[164px] -translate-x-1/2 rounded-[24px] border border-white/70 bg-white/86 px-4 py-3 text-center shadow-[0_12px_30px_rgba(84,54,43,.12)] backdrop-blur">
          <div className="font-serif text-[18px] font-semibold text-[#2f2723]">Start styling</div>
          <div className="mt-1 text-[11px] leading-relaxed text-[#7f6f66]">
            Add pieces below and Sylistly will lay them out as a clean shopping board.
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-4 z-20 rounded-full border border-black/5 bg-white/74 px-3 py-1.5 text-[10px] uppercase tracking-[.18em] text-[#7f6d64] shadow-[0_8px_20px_rgba(84,54,43,.08)] backdrop-blur">
        {count ? `${count} product${count !== 1 ? 's' : ''} in look` : 'Waiting for pieces'}
      </div>
    </div>
  );
}

function FitBoard({ layout, items, hasItems }: { layout: BoardLayout; items: Partial<Record<Category, Product>>; hasItems: boolean }) {
  return (
    <div
      className={`absolute overflow-hidden rounded-[34px] border border-black/5 bg-white/94 shadow-[0_22px_46px_rgba(84,54,43,.12)] ${layout.className}`}
    >
      <div className="absolute inset-[10px] rounded-[26px] bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,.95),rgba(255,255,255,.72)_34%,rgba(244,238,234,.98)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.35),transparent_24%,transparent_78%,rgba(231,220,214,.4))]" />

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
              className={`absolute rounded-[24px] border border-dashed border-[#d9cac1] bg-[#faf6f2]/82 ${hint.className}`}
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
        src={proxiedImageUrl(product.imageUrl)}
        alt={`${product.brand} ${product.name}`}
        className={`h-full w-full object-contain ${imageClassName}`}
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
