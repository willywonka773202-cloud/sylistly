'use client';
import { useFit } from '@/store/fit';
import { CATEGORY_ORDER, type Category } from '@/lib/types';
import { Shirt, Footprints, ShoppingBag, Watch, Glasses, PackageSearch, Hand } from 'lucide-react';
import { proxiedImageUrl } from '@/lib/image-url';

const ICONS: Record<Category, React.ComponentType<{ size?: number }>> = {
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
  hat: 'Hat', outer: 'Outer', top: 'Top', bottom: 'Bottom',
  shoes: 'Shoes', bag: 'Bag', eyewear: 'Eyewear', jewelry: 'Jewelry',
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
    <div className="flex flex-col gap-2">
      {CATEGORY_ORDER.map((cat) => {
        const p = items[cat];
        const Icon = ICONS[cat];
        return (
          <button
            key={cat}
            onClick={() => onOpenSearch(cat)}
            className={`flex items-center gap-2.5 px-2.5 py-2 bg-surface-1 border rounded-xl min-h-[52px] transition ${
              p ? 'border-accent/35' : 'border-hairline hover:border-hairline-2'
            }`}
          >
            <div className={`w-[30px] h-[30px] rounded-md grid place-items-center flex-none ${p ? 'bg-black border border-hairline-2' : 'bg-surface-3'}`}>
              {p ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proxiedImageUrl(p.imageUrl)}
                  alt=""
                  className="w-6 h-6 object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.src = thumbFallback(p.brand);
                  }}
                />
              ) : (
                <Icon size={16} />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left flex flex-col gap-0.5">
              <div className="text-[9px] tracking-[.15em] text-muted uppercase">{LABELS[cat]}</div>
              {p ? (
                <div className="truncate text-[12.5px] font-medium text-ink">
                  <span className="text-[10px] tracking-wider text-muted-2 uppercase mr-1">{p.brand}</span>
                  {p.name}
                </div>
              ) : (
                <div className="text-[12.5px] text-muted">Add a {LABELS[cat].toLowerCase()}</div>
              )}
            </div>
            {p ? (
              <>
                <div className="font-serif italic text-sm">${(p.priceCents / 100).toLocaleString()}</div>
                <span
                  onClick={(e) => { e.stopPropagation(); removeItem(cat); }}
                  className="w-5 h-5 rounded-full bg-surface-3 grid place-items-center text-[11px] text-muted-2 hover:bg-accent hover:text-white flex-none cursor-pointer"
                >
                  ✕
                </span>
              </>
            ) : (
              <div className="text-accent text-lg leading-none">+</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
