'use client';

import { type ComponentType } from 'react';
import { Footprints, Glasses, Hand, PackageSearch, Shirt, ShoppingBag, Watch } from 'lucide-react';
import { proxiedImageUrl } from '@/lib/image-url';
import { CATEGORY_ORDER, type Category } from '@/lib/types';
import { useFit } from '@/store/fit';

const ICONS: Record<Category, ComponentType<{ size?: number }>> = {
  hat: PackageSearch,
  outer: Shirt,
  top: Shirt,
  bottom: Hand,
  shoes: Footprints,
  bag: ShoppingBag,
  eyewear: Glasses,
  jewelry: Watch,
};

const LABELS: Record<Category, string> = {
  hat: 'Hat',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

function thumbFallback(label: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="18" fill="#0f0f0e" />
      <rect x="8" y="8" width="80" height="80" rx="14" fill="#e8365d" opacity="0.15" />
      <circle cx="48" cy="38" r="18" fill="#fffefb" opacity="0.9" />
      <rect x="24" y="62" width="48" height="8" rx="4" fill="#fffefb" opacity="0.75" />
      <text x="48" y="86" text-anchor="middle" fill="#fffefb" font-family="Arial, sans-serif" font-size="11" font-weight="700">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

interface Props {
  onOpenSearch: (cat: Category) => void;
}

export function SlotList({ onOpenSearch }: Props) {
  const { items, removeItem } = useFit();

  return (
    <div className="overflow-x-auto pb-1 scrollbar-hide">
      <div className="flex min-w-max gap-3">
        {CATEGORY_ORDER.map((cat) => {
          const p = items[cat];
          const Icon = ICONS[cat];

          return (
            <button
              key={cat}
              type="button"
              onClick={() => onOpenSearch(cat)}
              className={`relative flex w-[144px] flex-none flex-col rounded-[24px] border p-3 text-left transition ${
                p
                  ? 'border-accent/35 bg-[linear-gradient(180deg,rgba(232,54,93,.08),rgba(255,255,255,.02))] shadow-[0_18px_34px_rgba(0,0,0,.18)]'
                  : 'border-hairline bg-surface-1 hover:border-hairline-2'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[9px] uppercase tracking-[.18em] text-muted">{LABELS[cat]}</div>
                {p ? (
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      removeItem(cat);
                    }}
                    className="grid h-5 w-5 place-items-center rounded-full bg-surface-3 text-[10px] text-muted-2 transition hover:bg-accent hover:text-white"
                  >
                    x
                  </span>
                ) : null}
              </div>

              <div className={`mt-3 flex h-[98px] items-center justify-center overflow-hidden rounded-[20px] ${
                p ? 'bg-[linear-gradient(180deg,#fbfaf8_0%,#f2ebe5_100%)] ring-1 ring-[#efe4da]' : 'bg-surface-3'
              }`}>
                {p ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxiedImageUrl(p.imageUrl)}
                    alt=""
                    className="h-full w-full object-contain p-2.5"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.src = thumbFallback(p.brand);
                    }}
                  />
                ) : (
                  <div className="grid place-items-center text-muted">
                    <Icon size={22} />
                  </div>
                )}
              </div>

              <div className="mt-3 min-h-[54px]">
                {p ? (
                  <>
                    <div className="truncate text-[10px] uppercase tracking-[.14em] text-muted-2">{p.brand}</div>
                    <div className="mt-1 line-clamp-2 text-[12px] font-medium leading-[1.25] text-ink">{p.name}</div>
                  </>
                ) : (
                  <>
                    <div className="text-[12px] font-medium text-ink">Add {LABELS[cat].toLowerCase()}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-muted-2">Tap to browse the catalog and place it in the board.</div>
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                {p ? (
                  <div className="font-serif text-[15px] font-semibold text-ink">
                    ${(p.priceCents / 100).toLocaleString()}
                  </div>
                ) : (
                  <div className="text-[10px] uppercase tracking-[.16em] text-muted">Open slot</div>
                )}
                <div className="rounded-full border border-hairline px-2.5 py-1 text-[10px] uppercase tracking-[.16em] text-muted-2">
                  {p ? 'Swap' : 'Browse'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
