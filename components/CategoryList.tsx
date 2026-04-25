import { X, Plus } from 'lucide-react';
import type { Category, Product } from '@/lib/types';
import { CATEGORY_ORDER } from '@/lib/types';

interface CategoryListProps {
  items: Partial<Record<Category, Product>>;
  onSlotClick: (slot: Category) => void;
  onRemoveSlot: (slot: Category) => void;
}

export function CategoryList({ items, onSlotClick, onRemoveSlot }: CategoryListProps) {
  return (
    <div className="flex-1 space-y-2">
      {CATEGORY_ORDER.map((cat) => {
        const product = items[cat];
        return (
          <button
            key={cat}
            onClick={() => onSlotClick(cat)}
            className={`w-full h-11 rounded-xl border flex items-center justify-between px-3 transition-all ${
              product 
                ? 'bg-surface-2 border-accent/40 hover:border-accent/80 shadow-sm' 
                : 'bg-surface-1 border-hairline hover:border-hairline-2'
            }`}
          >
            {product ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-md overflow-hidden p-0.5 flex items-center justify-center border border-hairline">
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-widest">{cat}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveSlot(cat); }}
                  className="w-6 h-6 rounded-full bg-surface-3 text-[10px] flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] font-medium text-muted/60 capitalize tracking-wide">+ {cat}</span>
                <Plus className="w-4 h-4 text-muted/40" />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
