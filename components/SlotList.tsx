'use client';
import { useFit } from '@/store/fit';
import { CATEGORY_ORDER, type Category } from '@/lib/types';
import { Shirt, Footprints, ShoppingBag, Watch, Glasses, PackageSearch, Hand, X } from 'lucide-react';
import { proxiedImageUrl } from '@/lib/image-url';
import { motion } from 'framer-motion';

const ICONS: Record<Category, React.ComponentType<{ size?: number; className?: string }>> = {
  hat: (props) => <PackageSearch {...props} />,
  outer: (props) => <Shirt {...props} />,
  top: (props) => <Shirt {...props} />,
  bottom: (props) => <Hand {...props} />,
  shoes: (props) => <Footprints {...props} />,
  bag: (props) => <ShoppingBag {...props} />,
  eyewear: (props) => <Glasses {...props} />,
  jewelry: (props) => <Watch {...props} />,
};

const LABELS: Record<Category, string> = {
  hat: 'Hat', outer: 'Outer', top: 'Top', bottom: 'Bottom',
  shoes: 'Shoes', bag: 'Bag', eyewear: 'Eyewear', jewelry: 'Jewelry',
};

function thumbFallback(brand: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="18" fill="#0f0f0e" />
      <rect x="8" y="8" width="80" height="80" rx="14" fill="#e8365d" opacity="0.15" />
      <circle cx="48" cy="38" r="18" fill="#fffefb" opacity="0.9" />
      <rect x="24" y="62" width="48" height="8" rx="4" fill="#fffefb" opacity="0.75" />
      <text x="48" y="86" text-anchor="middle" fill="#fffefb" font-family="Arial, sans-serif" font-size="11" font-weight="700">${brand.substring(0, 8)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

interface Props {
  onOpenSearch: (cat: Category) => void;
}

export function SlotList({ onOpenSearch }: Props) {
  const { items, removeItem } = useFit();
  const filledCount = Object.keys(items).filter(Boolean).length;

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-muted">Your Pieces</h3>
        <span className="text-[10px] text-muted">{filledCount} / {CATEGORY_ORDER.length}</span>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {CATEGORY_ORDER.map((cat, index) => {
          const p = items[cat];
          const Icon = ICONS[cat];
          return (
            <motion.button
              key={cat}
              onClick={() => onOpenSearch(cat)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                p 
                  ? 'bg-surface-1/50 border-accent/30 hover:border-accent/60' 
                  : 'bg-surface-1 border-hairline hover:border-hairline-2 hover:bg-surface-2'
              }`}
            >
              <div className={`relative w-14 h-14 rounded-xl flex-none flex items-center justify-center overflow-hidden ${
                p ? 'bg-black border border-hairline-2' : 'bg-surface-3 border border-hairline'
              }`}>
                {p ? (
                  <img
                    src={proxiedImageUrl(p.imageUrl)}
                    alt=""
                    className="w-full h-full object-contain p-1.5"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.src = thumbFallback(p.brand);
                    }}
                  />
                ) : (
                  <Icon size={20} className="text-muted/50" />
                )}
                {p && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      removeItem(cat); 
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface-3 border border-hairline text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent hover:text-white"
                  >
                    <X size={10} />
                  </motion.button>
                )}
              </div>
              
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[9px] uppercase tracking-[.18em] text-muted/70">{LABELS[cat]}</div>
                {p ? (
                  <div className="mt-0.5 truncate text-sm font-medium text-ink">
                    <span className="text-[10px] tracking-wide text-muted-2 uppercase mr-1.5 bg-surface-2/50 px-1.5 py-0.5 rounded">{p.brand}</span>
                    {p.name}
                  </div>
                ) : (
                  <div className="text-sm text-muted/60">Tap to add</div>
                )}
              </div>
              
              <div className="flex-none flex items-center gap-2">
                {p ? (
                  <>
                    <span className="font-serif italic text-base text-emerald">${(p.priceCents / 100).toFixed(0)}</span>
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                      <span className="text-accent text-lg leading-none">+</span>
                    </div>
                  </>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-2 border border-hairline flex items-center justify-center">
                    <span className="text-accent text-lg leading-none">+</span>
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
      
      {filledCount === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-muted">Generate a look above or tap any slot to search</p>
        </div>
      )}
    </div>
  );
}