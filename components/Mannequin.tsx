'use client';

import { Check, Lock } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getTransparentProductImageUrl, hasTransparentProductImage } from '@/lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';

export type FitVariant = 'casual' | 'elevated' | 'bold';

interface Props {
  items: Partial<Record<Category, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
  vibeLabel: string;
  vibeBlurb: string;
  selectedGenerationSlots?: Category[];
  lockedSlots?: Category[];
  onToggleGenerationSlot?: (category: Category) => void;
  onToggleSlotLock?: (category: Category) => void;
  onOpenSlot?: (category: Category) => void;
  slotInteractionDisabled?: boolean;
  activeEditSlot?: Category | null;
}

interface OutfitAnalysis {
  score: number;
  colorHarmony: number;
  silhouette: number;
  layering: number;
  proportions: number;
  palette: string[];
  styleDna: string[];
  missing: Category[];
  primaryGap: Category | null;
  harmonyLabel: string;
  silhouetteLabel: string;
  balanceLabel: string;
  upgradeNote: string;
  crowding: {
    upper: 'calm' | 'balanced' | 'crowded';
    mid: 'calm' | 'balanced' | 'crowded';
    lower: 'calm' | 'balanced' | 'crowded';
  };
}

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Headwear',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

const NEUTRAL_COLORS = new Set(['black', 'white', 'cream', 'ivory', 'beige', 'stone', 'grey', 'gray', 'charcoal', 'tan', 'brown', 'navy']);
const CATEGORY_PRIORITY: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];
const BOOT_TERMS = ['boot', 'boots', 'chelsea', 'ugg'];
const LOW_PROFILE_SHOE_TERMS = ['samba', 'sneaker', 'sneakers', 'trainer', 'trainers', 'court shoe', 'running shoe'];
const FLAT_SHOE_TERMS = ['loafer', 'loafers', 'flat', 'flats', 'sandal', 'sandals', 'slide', 'slides', 'mule', 'mules'];
const HEEL_TERMS = ['heel', 'heels', 'pump', 'pumps', 'slingback', 'stiletto'];
const CAP_TERMS = ['baseball cap', 'dad cap', 'cap'];
const BEANIE_TERMS = ['beanie', 'watch cap', 'skullcap'];
const BUCKET_HAT_TERMS = ['bucket hat', 'bucket'];
const WIDE_HAT_TERMS = ['sun hat', 'straw hat', 'wide brim', 'wide-brim'];
const TOTE_TERMS = ['tote', 'shopper'];
const MINI_BAG_TERMS = ['mini', 'micro', 'pouch', 'wallet', 'clutch'];
const SHORT_BOTTOM_TERMS = ['short', 'shorts', 'skort', 'mini skirt'];
const SKIRT_BOTTOM_TERMS = ['skirt', 'midi skirt', 'maxi skirt', 'slip skirt'];
const LONG_BOTTOM_TERMS = ['jean', 'jeans', 'pant', 'pants', 'trouser', 'trousers', 'wide leg', 'wide-leg'];
const JEWELRY_SMALL_TERMS = ['ring', 'earring', 'earrings', 'bracelet'];
const JEWELRY_TALL_TERMS = ['necklace', 'chain', 'pendant'];

// Staggered reveal order as a freshly generated fit lands on the board — hero
// pieces (top/bottom) materialize first, accessories cascade in after.
const REVEAL_DELAY: Partial<Record<Category, number>> = {
  top: 0,
  bottom: 70,
  outer: 120,
  shoes: 170,
  bag: 210,
  hat: 250,
  eyewear: 280,
  jewelry: 300,
};

export function Mannequin({
  items,
  skinTone,
  vibeLabel,
  selectedGenerationSlots = [],
  lockedSlots = [],
  onToggleGenerationSlot,
  onToggleSlotLock,
  onOpenSlot,
  slotInteractionDisabled = false,
  activeEditSlot = null,
}: Props) {
  const analysis = useMemo(() => analyzeOutfit(items, vibeLabel), [items, vibeLabel]);
  const highlightCategory = analysis.primaryGap;
  const glow = skinTone || '#edd7cc';

  return (
    <div
      className="relative overflow-hidden rounded-[30px] border border-[#efe4dc] bg-[#fff7ef] p-2.5 shadow-[0_22px_54px_rgba(0,0,0,.3)]"
      style={{
        boxShadow: `0 18px 44px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.88), 0 0 0 1px ${hexToRgba(glow, 0.08)}`,
      }}
    >
      <div
        className="rounded-[26px] border border-[#eadfd7] bg-[linear-gradient(180deg,#fffdf9_0%,#f8f1ea_100%)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.92)]"
        style={{
          backgroundImage: `radial-gradient(circle at 18% 14%, rgba(255,255,255,.9), transparent 28%), radial-gradient(circle at 86% 18%, rgba(255,255,255,.68), transparent 24%), radial-gradient(circle at 50% 72%, ${hexToRgba(glow, 0.12)}, transparent 38%), linear-gradient(180deg,#fffdf9 0%,#f8f1ea 100%)`,
        }}
      >
        <FrontCanvas
          items={items}
          highlightCategory={highlightCategory}
          activeEditSlot={activeEditSlot}
          onOpenSlot={onOpenSlot}
          onToggleSlotLock={onToggleSlotLock}
          onToggleGenerationSlot={onToggleGenerationSlot}
          selectedGenerationSlots={selectedGenerationSlots}
          lockedSlots={lockedSlots}
          slotInteractionDisabled={slotInteractionDisabled}
        />
      </div>
    </div>
  );
}

function FrontCanvas({
  items,
  highlightCategory,
  activeEditSlot,
  onOpenSlot,
  onToggleSlotLock,
  onToggleGenerationSlot,
  selectedGenerationSlots,
  lockedSlots,
  slotInteractionDisabled,
}: {
  items: Partial<Record<Category, Product>>;
  highlightCategory: Category | null;
  activeEditSlot?: Category | null;
  onOpenSlot?: (category: Category) => void;
  onToggleSlotLock?: (category: Category) => void;
  onToggleGenerationSlot?: (category: Category) => void;
  selectedGenerationSlots: Category[];
  lockedSlots: Category[];
  slotInteractionDisabled?: boolean;
}) {
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const zoneStyle: Record<Category, CSSProperties> = {
    hat: { gridColumn: '1', gridRow: '1 / span 2' },
    outer: { gridColumn: '1', gridRow: '3 / span 6' },
    top: { gridColumn: '2', gridRow: '1 / span 4' },
    bottom: { gridColumn: '2', gridRow: '5 / span 4' },
    eyewear: { gridColumn: '3', gridRow: '1 / span 2' },
    jewelry: { gridColumn: '3', gridRow: '3 / span 1' },
    bag: { gridColumn: '3', gridRow: '4 / span 2' },
    shoes: { gridColumn: '3', gridRow: '6 / span 3' },
  };

  const renderZone = (category: Category, prominent = false) => {
    const rawProduct = items[category];
    const product = hasTransparentProductImage(rawProduct) && !failedImageIds.has(rawProduct.id) ? rawProduct : undefined;
    const generationSelected = selectedGenerationSlots.includes(category);
    const locked = Boolean(product && lockedSlots.includes(category));
    const selected = generationSelected || activeEditSlot === category;
    const interactive = Boolean(onToggleGenerationSlot || onOpenSlot) && !slotInteractionDisabled;
    const handleSlotClick = () => {
      if (slotInteractionDisabled) return;
      if (onOpenSlot) {
        onOpenSlot(category);
        return;
      }
      onToggleGenerationSlot?.(category);
    };
    const selectedClassName = locked
      ? 'border-accent shadow-[0_0_0_1px_rgba(255,45,109,.74),0_0_30px_rgba(255,45,109,.36),0_14px_28px_rgba(40,18,22,.14)]'
      : selected && product
      ? 'border-accent shadow-[0_0_0_1px_rgba(255,45,109,.58),0_0_26px_rgba(255,45,109,.32),0_14px_28px_rgba(40,18,22,.14)]'
      : selected
      // Every EMPTY slot starts selected-for-generation, so painting that state
      // accent turned the opening board into a wall of pink shouting the
      // default back at you. Champagne states it just as clearly and keeps
      // pink meaning "you chose this" — a filled selection, a lock, the CTA.
      ? 'border-champagne/65 shadow-[0_0_0_1px_rgba(231,199,155,.34)]'
      : product
      // Filled pieces float borderless on the board so the outfit reads as one
      // cohesive flat lay; empty/editable slots keep only a faint outline.
      ? 'border-transparent shadow-none'
      : 'border-[#e6dad0]/55 shadow-none';
    const filledSlotClassName = product
      ? 'bg-transparent shadow-none'
      : 'bg-[linear-gradient(180deg,#fffefa_0%,#f6eee7_100%)]';
    const wrapperClassName = `relative h-full w-full overflow-visible rounded-[20px] border-2 p-1.5 transition ${filledSlotClassName} ${selectedClassName} ${interactive ? 'cursor-pointer hover:border-accent/80 hover:shadow-[0_0_0_1px_rgba(255,45,109,.42),0_0_24px_rgba(255,45,109,.22),0_14px_28px_rgba(40,18,22,.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.985]' : ''} ${activeEditSlot === category ? 'animate-pulse' : ''} ${highlightCategory === category ? 'ring-1 ring-accent/45' : ''}`;
    const selectionBadge = selected ? (
      <span
        className={`absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full ${
          locked || product
            ? 'bg-accent text-white shadow-[0_6px_16px_rgba(255,45,109,.42)]'
            : 'bg-champagne/90 text-[#2a2118] shadow-[0_4px_12px_rgba(231,199,155,.3)]'
        }`}
      >
        {locked ? <Lock size={12} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
      </span>
    ) : null;

    if (!product) {
      return (
        <button
          type="button"
          onClick={handleSlotClick}
          disabled={slotInteractionDisabled}
          className={`${wrapperClassName} flex flex-col items-center justify-center border-dashed bg-black/[0.02] px-1.5 text-center opacity-80`}
          aria-pressed={selected}
          aria-label={onOpenSlot ? `Edit ${CATEGORY_LABELS[category]}` : `${generationSelected ? 'Exclude' : 'Include'} ${CATEGORY_LABELS[category]} in next generation`}
        >
          {selectionBadge}
          <span className={`max-w-full shrink-0 truncate leading-none text-[7px] font-black uppercase tracking-[.11em] ${selected ? 'text-[#8a7355]' : 'text-[#b39f91]'}`}>{CATEGORY_LABELS[category]}</span>
          {rawProduct && !hasTransparentProductImage(rawProduct) ? (
            <span className="mt-1 text-[7px] font-bold uppercase tracking-[.12em] text-[#c4aa9a]">Cutout queued</span>
          ) : null}
          <span className={`mt-1 text-[16px] leading-none ${selected ? 'text-[#a08b6a]' : 'text-[#d0bfb3]'}`}>+</span>
        </button>
      );
    }
    const imageClassName = builderPreviewImageClass(product, category, prominent);
    const innerFrameClassName =
      'flex h-[calc(100%-13px)] items-center justify-center overflow-visible rounded-[12px] bg-transparent';

    return (
      <button
        type="button"
        onClick={handleSlotClick}
        disabled={slotInteractionDisabled}
        className={wrapperClassName}
        aria-pressed={selected}
        aria-label={onOpenSlot ? `Edit ${CATEGORY_LABELS[category]}` : `${generationSelected ? 'Exclude' : 'Include'} ${CATEGORY_LABELS[category]} in next generation`}
      >
        <span
          key={`bloom-${product.id}`}
          aria-hidden
          className="sy-grid-tile-bloom pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_50%_46%,rgba(255,45,109,.26),transparent_72%)]"
          style={{ animationDelay: `${REVEAL_DELAY[category] ?? 0}ms` }}
        />
        {selectionBadge}
        {product && onToggleSlotLock ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`${locked ? 'Unlock' : 'Lock'} ${CATEGORY_LABELS[category]}`}
            onClick={(event) => {
              event.stopPropagation();
              if (!slotInteractionDisabled) onToggleSlotLock(category);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              if (!slotInteractionDisabled) onToggleSlotLock(category);
            }}
            className={`absolute bottom-1.5 right-1.5 z-10 grid h-6 w-6 place-items-center rounded-full border text-[10px] transition ${
              locked
                ? 'border-accent bg-accent text-white shadow-[0_6px_16px_rgba(255,45,109,.36)]'
                : 'border-[#d9c9bb] bg-white/82 text-[#6c5c52] hover:border-accent hover:text-accent'
            }`}
          >
            <Lock size={12} strokeWidth={2.6} />
          </span>
        ) : null}
        <div className={`mb-0.5 max-w-[calc(100%-28px)] truncate text-left text-[7px] font-black uppercase tracking-[.11em] ${selected ? 'text-accent' : 'text-[#9f8878]'}`}>{CATEGORY_LABELS[category]}</div>
        <div
          key={product.id}
          className={`${innerFrameClassName} sy-grid-piece-in`}
          style={{ animationDelay: `${REVEAL_DELAY[category] ?? 0}ms` }}
        >
          <PreviewImage
            product={product}
            wrapperClassName="h-full w-full"
            modeClassName={imageClassName}
            blend={false}
            onUnavailable={(failedProduct) => {
              setFailedImageIds((current) => new Set(current).add(failedProduct.id));
            }}
          />
        </div>
      </button>
    );
  };

  return (
    <div
      className="relative h-[390px] overflow-hidden rounded-[24px] border border-[#e8ddd5] bg-[linear-gradient(180deg,#fffdfa_0%,#f7f1eb_100%)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_14px_34px_rgba(0,0,0,.1)] min-[390px]:h-[430px]"
    >
      <div
        className="grid h-full gap-2.5"
        style={{
          gridTemplateColumns: '0.9fr 1.62fr 0.9fr',
          gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
        }}
      >
        <div style={zoneStyle.hat}>{renderZone('hat')}</div>
        <div style={zoneStyle.eyewear}>{renderZone('eyewear')}</div>
        <div style={zoneStyle.jewelry}>{renderZone('jewelry')}</div>
        <div style={zoneStyle.top}>{renderZone('top', true)}</div>

        <div style={zoneStyle.outer}>{renderZone('outer', true)}</div>
        <div style={zoneStyle.bottom}>{renderZone('bottom', true)}</div>
        <div style={zoneStyle.bag}>{renderZone('bag')}</div>
        <div style={zoneStyle.shoes}>{renderZone('shoes', true)}</div>
      </div>
    </div>
  );
}

function productText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.category,
    product.retailer,
    ...(product.searchTerms || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
  ].join(' ').toLowerCase();
}

function productHasTerm(product: Product, terms: string[]): boolean {
  const text = ` ${productText(product).replace(/[^a-z0-9]+/g, ' ')} `;
  return terms.some((term) => {
    const normalizedTerm = term.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return Boolean(normalizedTerm) && text.includes(` ${normalizedTerm} `);
  });
}

function builderPreviewImageClass(product: Product, category: Category, prominent: boolean): string {
  // Pieces are scaled up to fill their cells so the board reads as a full,
  // styled outfit rather than small items floating in empty space.
  const base = 'h-full w-full object-contain object-center p-0 drop-shadow-[0_16px_18px_rgba(54,34,24,.18)]';
  if (category === 'top') return `${base} scale-[1.3]`;
  if (category === 'outer') return `${base} scale-[1.2]`;
  if (category === 'bottom') {
    if (productHasTerm(product, SHORT_BOTTOM_TERMS)) return `${base} translate-y-[-2%] scale-[1.0]`;
    if (productHasTerm(product, SKIRT_BOTTOM_TERMS)) return `${base} translate-y-[1%] scale-[1.12]`;
    if (productHasTerm(product, LONG_BOTTOM_TERMS)) return `${base} translate-y-[2%] scale-[1.18]`;
    return `${base} scale-[1.14]`;
  }
  if (category === 'shoes') {
    if (productHasTerm(product, BOOT_TERMS)) return `${base} translate-y-[8%] scale-[.92]`;
    if (productHasTerm(product, HEEL_TERMS)) return `${base} translate-y-[6%] scale-[1.0]`;
    if (productHasTerm(product, FLAT_SHOE_TERMS)) return `${base} translate-y-[6%] scale-[1.04]`;
    if (productHasTerm(product, LOW_PROFILE_SHOE_TERMS)) return `${base} translate-y-[5%] scale-[1.06]`;
    return `${base} translate-y-[6%] scale-[1.04]`;
  }
  if (category === 'bag') {
    if (productHasTerm(product, TOTE_TERMS)) return `${base} translate-y-[3%] scale-[.96]`;
    if (productHasTerm(product, MINI_BAG_TERMS)) return `${base} scale-[1.15]`;
    return `${base} scale-[1.08]`;
  }
  if (category === 'hat') {
    if (productHasTerm(product, BEANIE_TERMS)) return `${base} translate-y-[3%] scale-[1.05]`;
    if (productHasTerm(product, WIDE_HAT_TERMS)) return `${base} translate-y-[3%] scale-[1.0]`;
    if (productHasTerm(product, BUCKET_HAT_TERMS)) return `${base} translate-y-[3%] scale-[1.12]`;
    if (productHasTerm(product, CAP_TERMS)) return `${base} translate-y-[3%] scale-[1.2]`;
    return `${base} scale-[1.08]`;
  }
  if (category === 'eyewear') return `${base} scale-[1.0]`;
  if (category === 'jewelry') {
    if (productHasTerm(product, JEWELRY_SMALL_TERMS)) return `${base} scale-[.84]`;
    if (productHasTerm(product, JEWELRY_TALL_TERMS)) return `${base} scale-[.95]`;
    return `${base} scale-[.92]`;
  }
  return `${base} ${prominent ? 'scale-[1.22]' : 'scale-[1.15]'}`;
}

function PreviewImage({
  product,
  wrapperClassName,
  modeClassName,
  blend,
  onUnavailable,
}: {
  product: Product;
  wrapperClassName: string;
  modeClassName: string;
  blend: boolean;
  onUnavailable?: (product: Product) => void;
}) {
  const [imageOk, setImageOk] = useState(hasTransparentProductImage(product));

  const src = imageOk ? getTransparentProductImageUrl(product) || '' : '';

  useEffect(() => {
    setImageOk(hasTransparentProductImage(product));
  }, [product]);

  if (!src) return null;

  return (
    <div className={wrapperClassName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        data-image-kind="transparent"
        data-product-id={product.id}
        data-product-category={product.category}
        className={modeClassName}
        style={{
          mixBlendMode: blend ? 'multiply' : 'normal',
          filter: blend ? 'drop-shadow(0 14px 22px rgba(0,0,0,.16))' : undefined,
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setImageOk(false);
          onUnavailable?.(product);
        }}
      />
    </div>
  );
}

function analyzeOutfit(
  items: Partial<Record<Category, Product>>,
  vibeLabel: string,
): OutfitAnalysis {
  const selected = CATEGORY_ORDER
    .map((category) => ({ category, product: items[category] }))
    .filter((entry): entry is { category: Category; product: Product } => Boolean(entry.product));
  const count = selected.length;
  const missing = CATEGORY_PRIORITY.filter((category) => !items[category]);
  const palette = extractPalette(selected.map((entry) => entry.product));
  const accentColors = palette.filter((color) => !NEUTRAL_COLORS.has(color.toLowerCase()));
  const colorHarmony =
    count === 0 ? 52 :
    accentColors.length <= 1 ? 92 :
    accentColors.length === 2 ? 82 :
    accentColors.length === 3 ? 70 : 58;
  const silhouette =
    (items.top ? 28 : 0) +
    (items.bottom ? 28 : 0) +
    (items.shoes ? 18 : 0) +
    (items.outer ? 16 : 0) +
    (items.hat || items.eyewear ? 8 : 0);
  const layering =
    (items.top ? 28 : 0) +
    (items.outer ? 22 : 0) +
    (items.bag ? 16 : 0) +
    (items.jewelry || items.eyewear ? 12 : 0) +
    (items.hat ? 8 : 0);
  const proportions =
    (items.top ? 30 : 0) +
    (items.bottom ? 30 : 0) +
    (items.shoes ? 20 : 0) +
    (items.outer ? 10 : 0) +
    (items.bag ? 8 : 0);
  const completeness = Math.round((count / CATEGORY_ORDER.length) * 100);
  const score = clamp(Math.round(completeness * 0.34 + colorHarmony * 0.22 + silhouette * 0.2 + layering * 0.12 + proportions * 0.12), 48, 99);

  const dnaPool = new Map<string, number>();
  dnaPool.set(vibeLabel, 3);
  for (const entry of selected) {
    for (const tag of [...metadataList(entry.product, 'vibes'), ...metadataList(entry.product, 'styles')]) {
      const normalized = titleCase(tag);
      dnaPool.set(normalized, (dnaPool.get(normalized) || 0) + 1);
    }
  }
  const styleDna = Array.from(dnaPool.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([tag]) => tag);

  const crowd = getCrowding(items);
  const crowding = {
    upper: crowd.upper >= 4 ? 'crowded' : crowd.upper >= 2 ? 'balanced' : 'calm',
    mid: crowd.mid >= 3 ? 'crowded' : crowd.mid >= 2 ? 'balanced' : 'calm',
    lower: crowd.lower >= 3 ? 'crowded' : crowd.lower >= 2 ? 'balanced' : 'calm',
  } as const;

  const balanceLabel =
    count >= 6 ? 'Editorial balance locked' :
    count >= 4 ? 'Strong canvas, finish the gaps' :
    count >= 2 ? 'Base silhouette forming' : 'Canvas still open';

  const silhouetteLabel =
    items.outer && items.top && items.bottom ? 'Layered editorial column' :
    items.top && items.bottom && items.shoes ? 'Clean full-body stack' :
    items.top && items.bottom ? 'Core silhouette in progress' :
    'Studio placement pending';

  const harmonyLabel =
    colorHarmony >= 86 ? 'Color harmony locked' :
    colorHarmony >= 74 ? 'Palette balanced' :
    'Palette needs a cleaner lane';

  const upgradeNote =
    missing.length
      ? `The board reads strongest through the center. Add ${CATEGORY_LABELS[missing[0]].toLowerCase()} next to tighten the composition.`
      : crowding.upper === 'crowded'
      ? 'Upper-body styling is getting busy. Let the hat, eyewear, and outerwear breathe or keep the bag lower on the side-body lane.'
      : items.bag && !items.outer
      ? 'A sharper outer layer would give the bag a cleaner shoulder relationship and make the silhouette feel more premium.'
      : 'The canvas is balanced. Use one-tap polish or generate a bolder variant to push it into a stronger editorial direction.';

  return {
    score,
    colorHarmony,
    silhouette: clamp(silhouette, 44, 98),
    layering: clamp(layering, 38, 96),
    proportions: clamp(proportions, 40, 96),
    palette,
    styleDna,
    missing,
    primaryGap: missing[0] || null,
    harmonyLabel,
    silhouetteLabel,
    balanceLabel,
    upgradeNote,
    crowding,
  };
}

function getCrowding(items: Partial<Record<Category, Product>>) {
  return {
    upper: [items.hat, items.eyewear, items.top, items.outer, items.jewelry].filter(Boolean).length,
    mid: [items.outer, items.top, items.bag, items.jewelry].filter(Boolean).length,
    lower: [items.bottom, items.shoes, items.bag].filter(Boolean).length,
  };
}

function extractPalette(products: Product[]): string[] {
  const counts = new Map<string, number>();

  for (const product of products) {
    for (const color of metadataList(product, 'colors')) {
      const token = color.toLowerCase();
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    for (const token of tokenize(`${product.name} ${product.brand}`)) {
      if (isColorToken(token)) {
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }
  }

  if (!counts.size) return ['Black', 'Cream'];
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([color]) => titleCase(color));
}

function metadataList(product: Product, key: 'colors' | 'styles' | 'vibes' | 'keywords'): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isColorToken(token: string): boolean {
  return [
    'black',
    'white',
    'cream',
    'grey',
    'gray',
    'charcoal',
    'navy',
    'blue',
    'pink',
    'red',
    'green',
    'brown',
    'tan',
    'beige',
    'silver',
    'gold',
    'olive',
    'stone',
  ].includes(token);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(255,45,109, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
