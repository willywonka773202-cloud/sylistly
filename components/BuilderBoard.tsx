'use client';

import { Lock, Plus } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { WornFlatlay } from '@/components/WornFlatlay';
import type { Category, Product } from '@/lib/types';

/**
 * Builder board — the SAME worn-silhouette plate the scroll/saved/share use,
 * plus an editable slot strip below. Tap a chip to swap/add that slot, tap its
 * lock to keep it through the next generate. One consistent outfit object
 * across the whole app (replaces the old slot-grid Mannequin).
 */

const CHIP_ORDER: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];

const CATEGORY_NOUN: Record<Category, string> = {
  hat: 'hat',
  outer: 'layer',
  top: 'top',
  bottom: 'bottoms',
  shoes: 'shoes',
  bag: 'bag',
  eyewear: 'frames',
  jewelry: 'jewelry',
};

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function BuilderBoard({
  items,
  generationSlots = [],
  lockedSlots = [],
  onOpenSlot,
  onToggleSlotLock,
  activeEditSlot,
  disabled = false,
}: {
  items: Partial<Record<Category, Product>>;
  generationSlots?: Category[];
  lockedSlots?: Category[];
  onOpenSlot?: (category: Category) => void;
  onToggleSlotLock?: (category: Category) => void;
  activeEditSlot?: Category | null;
  disabled?: boolean;
}) {
  const products = Object.values(items).filter((product): product is Product => Boolean(product));
  const wanted = new Set<Category>([...generationSlots, ...(Object.keys(items) as Category[])]);
  const slots = CHIP_ORDER.filter((category) => wanted.has(category));
  const lockedSet = new Set(lockedSlots);

  return (
    <div className="flex flex-col">
      {/* The silhouette plate — identical to the rest of the app */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-card-lg ring-1 ring-hairline shadow-card-strong">
        {products.length >= 3 ? (
          <WornFlatlay
            items={items}
            active
            loading="eager"
            className="h-full w-full"
            onPieceClick={disabled ? undefined : (product) => onOpenSlot?.(product.category)}
          />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(125%_92%_at_50%_36%,#FFFDF9_0%,#F5F0E7_74%,#ECE5D8_100%)] px-8 text-center">
            <div>
              <p className="font-serif text-[20px] font-semibold italic text-[#2a2018]">Your fit, here.</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#7a6a5d]">
                Generate a look below, or tap a slot to add a piece.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Editable slot strip — tap to swap/add, lock to keep */}
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {slots.map((category) => {
          const product = items[category];
          const locked = lockedSet.has(category);
          const active = activeEditSlot === category;
          if (!product) {
            return (
              <button
                key={category}
                type="button"
                disabled={disabled}
                onClick={() => onOpenSlot?.(category)}
                aria-label={`Add ${CATEGORY_NOUN[category]}`}
                className="sy-press flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-hairline-2 bg-surface-2/60 py-2 pl-2.5 pr-3 text-muted transition disabled:opacity-50"
              >
                <Plus size={13} />
                <span className="text-[11px] font-semibold capitalize">{CATEGORY_NOUN[category]}</span>
              </button>
            );
          }
          return (
            <div
              key={category}
              className={`flex shrink-0 items-center gap-1 rounded-full border py-1 pl-1.5 pr-1 backdrop-blur-md transition ${
                active
                  ? 'border-accent bg-accent-soft text-ink shadow-pink-glow'
                  : locked
                    ? 'border-accent/60 bg-accent-soft/60 text-ink'
                    : 'border-hairline-2 bg-surface-2/70 text-muted-2'
              }`}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onOpenSlot?.(category)}
                aria-label={`Swap the ${product.brand} ${CATEGORY_NOUN[category]}`}
                className="sy-press flex items-center gap-2 disabled:opacity-60"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-ink/95">
                  <ProductImage product={product} wrapperClassName="h-6 w-6" className="h-6 w-6 object-contain" transparentOnly />
                </span>
                <span className="text-[11px] font-semibold capitalize">{CATEGORY_NOUN[category]}</span>
                <span className="text-[11px] font-medium text-muted">{formatPrice(product.priceCents || 0)}</span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleSlotLock?.(category)}
                aria-pressed={locked}
                aria-label={`${locked ? 'Unlock' : 'Lock'} the ${CATEGORY_NOUN[category]}`}
                className={`sy-press grid h-7 w-7 shrink-0 place-items-center rounded-full transition disabled:opacity-60 ${
                  locked ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                }`}
              >
                <Lock size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
