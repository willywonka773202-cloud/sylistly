'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { PremiumButton } from './Primitives';
import { CATEGORY_ORDER, CATEGORY_LABELS, type Category } from '@/lib/types';
import { COLOR_SWATCHES, FORMALITY_ORDER, FORMALITY_LABELS, type Formality, type ClosetItem } from '@/lib/social-types';
import { garmentArt, defaultShapeForCategory, type GarmentShape } from '@/lib/garment-art';
import { useCloset } from '@/store/closet';
import { successToast } from './Toast';

const SHAPES_BY_CATEGORY: Record<Category, { shape: GarmentShape; label: string }[]> = {
  top: [
    { shape: 'tee', label: 'Tee' }, { shape: 'longsleeve', label: 'Long sleeve' }, { shape: 'shirt', label: 'Shirt' },
    { shape: 'hoodie', label: 'Hoodie' }, { shape: 'sweater', label: 'Sweater' }, { shape: 'tank', label: 'Tank' },
    { shape: 'blouse', label: 'Blouse' }, { shape: 'polo', label: 'Polo' }, { shape: 'crop', label: 'Crop' }, { shape: 'dress', label: 'Dress' },
  ],
  outer: [
    { shape: 'jacket', label: 'Jacket' }, { shape: 'coat', label: 'Coat' }, { shape: 'blazer', label: 'Blazer' },
    { shape: 'puffer', label: 'Puffer' }, { shape: 'cardigan', label: 'Cardigan' }, { shape: 'trench', label: 'Trench' },
  ],
  bottom: [
    { shape: 'pants', label: 'Pants' }, { shape: 'jeans', label: 'Jeans' }, { shape: 'trousers', label: 'Trousers' },
    { shape: 'shorts', label: 'Shorts' }, { shape: 'skirt', label: 'Skirt' }, { shape: 'joggers', label: 'Joggers' }, { shape: 'leggings', label: 'Leggings' },
  ],
  shoes: [
    { shape: 'sneaker', label: 'Sneaker' }, { shape: 'runner', label: 'Runner' }, { shape: 'boot', label: 'Boot' },
    { shape: 'heel', label: 'Heel' }, { shape: 'loafer', label: 'Loafer' }, { shape: 'sandal', label: 'Sandal' },
  ],
  bag: [
    { shape: 'tote', label: 'Tote' }, { shape: 'crossbody', label: 'Crossbody' }, { shape: 'shoulderbag', label: 'Shoulder' },
    { shape: 'backpack', label: 'Backpack' }, { shape: 'clutch', label: 'Clutch' },
  ],
  hat: [
    { shape: 'cap', label: 'Cap' }, { shape: 'beanie', label: 'Beanie' }, { shape: 'bucket', label: 'Bucket' }, { shape: 'fedora', label: 'Fedora' },
  ],
  eyewear: [
    { shape: 'sunglasses', label: 'Sunglasses' }, { shape: 'glasses', label: 'Glasses' },
  ],
  jewelry: [
    { shape: 'necklace', label: 'Necklace' }, { shape: 'chain', label: 'Chain' }, { shape: 'hoops', label: 'Hoops' },
    { shape: 'watch', label: 'Watch' }, { shape: 'ring', label: 'Ring' }, { shape: 'belt', label: 'Belt' },
  ],
};

export function AddItemSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded?: (item: ClosetItem) => void;
}) {
  const addItem = useCloset((s) => s.addItem);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<Category>('top');
  const [shape, setShape] = useState<GarmentShape>('tee');
  const [swatch, setSwatch] = useState(COLOR_SWATCHES[0]);
  const [formality, setFormality] = useState<Formality>('casual');

  function pickCategory(c: Category) {
    setCategory(c);
    setShape(defaultShapeForCategory(c));
  }

  function handleAdd() {
    const item = addItem({
      name,
      brand,
      category,
      shape,
      color: swatch.hex,
      colorName: swatch.name,
      formality,
    });
    successToast('Added to your closet');
    onAdded?.(item);
    setName('');
    setBrand('');
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Add a piece"
      footer={
        <PremiumButton fullWidth size="lg" onClick={handleAdd} icon={<Plus size={18} />}>
          Add to closet
        </PremiumButton>
      }
    >
      <div className="flex gap-4 mb-4">
        <div className="w-28 h-32 shrink-0 rounded-2xl collage-paper border border-hairline grid place-items-center overflow-hidden">
          <img src={garmentArt(shape, swatch.hex)} alt="preview" className="w-full h-full object-contain p-3" />
        </div>
        <div className="flex-1 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. White Tee)" className="w-full h-10 px-3 rounded-xl bg-surface-2 border border-hairline text-sm font-semibold text-ink placeholder:text-muted focus:outline-none focus:border-hairline-2" />
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand" className="w-full h-10 px-3 rounded-xl bg-surface-2 border border-hairline text-sm text-ink placeholder:text-muted focus:outline-none focus:border-hairline-2" />
        </div>
      </div>

      <Section label="Category">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {CATEGORY_ORDER.map((c) => (
            <Mini key={c} active={category === c} onClick={() => pickCategory(c)}>{CATEGORY_LABELS[c]}</Mini>
          ))}
        </div>
      </Section>

      <Section label="Type">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {SHAPES_BY_CATEGORY[category].map((s) => (
            <Mini key={s.shape} active={shape === s.shape} onClick={() => setShape(s.shape)}>{s.label}</Mini>
          ))}
        </div>
      </Section>

      <Section label="Color">
        <div className="flex flex-wrap gap-2">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c.hex}
              onClick={() => setSwatch(c)}
              aria-label={c.name}
              className={`w-8 h-8 rounded-full border-2 ${swatch.hex === c.hex ? 'border-ink' : 'border-hairline'}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </Section>

      <Section label="Formality">
        <div className="flex gap-2">
          {FORMALITY_ORDER.map((f) => (
            <Mini key={f} active={formality === f} onClick={() => setFormality(f)}>{FORMALITY_LABELS[f]}</Mini>
          ))}
        </div>
      </Section>
    </BottomSheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-2xs uppercase tracking-editorial text-muted mb-2">{label}</div>
      {children}
    </div>
  );
}
function Mini({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 h-9 rounded-full text-[13px] font-medium border transition-colors ${
        active ? 'bg-ink text-cream border-ink' : 'bg-surface-1 text-muted-2 border-hairline'
      }`}
    >
      {children}
    </button>
  );
}
