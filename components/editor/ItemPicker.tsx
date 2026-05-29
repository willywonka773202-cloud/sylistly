'use client';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { ClothingCard } from '../ClothingCard';
import { AddItemSheet } from '../AddItemSheet';
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from '@/lib/types';
import type { ClosetItem } from '@/lib/social-types';
import { useMyClosetItems } from '@/store/closet';
import { Pill } from '../Primitives';

export function ItemPicker({
  open,
  onClose,
  onPick,
  inCanvas = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: ClosetItem) => void;
  inCanvas?: string[];
}) {
  const items = useMyClosetItems();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [addOpen, setAddOpen] = useState(false);

  const cats = useMemo(() => CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c)), [items]);
  const filtered = cat === 'all' ? items : items.filter((i) => i.category === cat);

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Add from your closet">
        <button
          onClick={() => setAddOpen(true)}
          className="w-full flex items-center gap-3 p-3 mb-3 rounded-2xl border border-dashed border-hairline-2 bg-surface-2 text-left"
        >
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-ink text-cream">
            <Plus size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">Add a new piece</div>
            <div className="text-[11px] text-muted">Create it from a shape + color</div>
          </div>
        </button>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 mb-3">
          <Pill active={cat === 'all'} onClick={() => setCat('all')}>All</Pill>
          {cats.map((c) => (
            <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{CATEGORY_LABELS[c]}</Pill>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {filtered.map((item) => (
            <div key={item.id} className="relative">
              <ClothingCard item={item} imageClassName="aspect-square" onClick={() => onPick(item)} />
              {inCanvas.includes(item.id) && (
                <div className="absolute top-1.5 right-1.5 grid place-items-center w-6 h-6 rounded-full bg-ink text-cream text-[11px] font-bold">✓</div>
              )}
            </div>
          ))}
        </div>
      </BottomSheet>

      <AddItemSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(item) => {
          onPick(item);
        }}
      />
    </>
  );
}
