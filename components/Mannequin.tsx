'use client';

import { motion } from 'framer-motion';
import { Check, Layers3, Lock, Radar, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { hasUsableProductImage } from '@/lib/product-image-quality';
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

interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rotation?: number;
  imageClassName?: string;
  frameClassName?: string;
  blend?: boolean;
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

const FRAME_LABELS: Record<GeneratorFrame, string> = {
  masc: 'Menswear edit',
  fem: 'Womenswear edit',
  androgynous: 'Neutral edit',
};

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

const GHOST_ZONES: Array<{ category: Category; label: string; style: CSSProperties }> = [
  { category: 'hat', label: 'Head', style: { left: '50%', top: '8%', width: '26%', height: '12%', transform: 'translateX(-50%)' } },
  { category: 'eyewear', label: 'Eyes', style: { left: '50%', top: '19%', width: '22%', height: '7%', transform: 'translateX(-50%)' } },
  { category: 'top', label: 'Torso', style: { left: '50%', top: '29%', width: '46%', height: '24%', transform: 'translateX(-50%)' } },
  { category: 'outer', label: 'Layer', style: { left: '50%', top: '28%', width: '56%', height: '28%', transform: 'translateX(-50%)' } },
  { category: 'jewelry', label: 'Accessory', style: { left: '50%', top: '31%', width: '18%', height: '7%', transform: 'translateX(-50%)' } },
  { category: 'bag', label: 'Bag', style: { right: '9%', top: '40%', width: '23%', height: '26%' } },
  { category: 'bottom', label: 'Legs', style: { left: '50%', top: '55%', width: '39%', height: '28%', transform: 'translateX(-50%)' } },
  { category: 'shoes', label: 'Feet', style: { left: '50%', bottom: '8%', width: '44%', height: '12%', transform: 'translateX(-50%)' } },
];

const NEUTRAL_COLORS = new Set(['black', 'white', 'cream', 'ivory', 'beige', 'stone', 'grey', 'gray', 'charcoal', 'tan', 'brown', 'navy']);
const CATEGORY_PRIORITY: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];

export function Mannequin({
  items,
  skinTone,
  bodyType = 'androgynous',
  vibeLabel,
  vibeBlurb,
  selectedGenerationSlots = [],
  lockedSlots = [],
  onToggleGenerationSlot,
  onToggleSlotLock,
  onOpenSlot,
  slotInteractionDisabled = false,
  activeEditSlot = null,
}: Props) {
  const [mirrorMode, setMirrorMode] = useState(false);
  const [magnetMode, setMagnetMode] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState(true);
  const [polishMode, setPolishMode] = useState(true);
  const [bagLayer, setBagLayer] = useState<'front' | 'behind'>('front');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const count = Object.values(items).filter(Boolean).length;
  const hasItems = count > 0;
  const analysis = useMemo(() => analyzeOutfit(items, vibeLabel), [items, vibeLabel]);
  const highlightCategory = activeCategory || analysis.primaryGap;
  const glow = skinTone || '#edd7cc';

  function autoFit() {
    setMagnetMode(true);
    setPolishMode(true);
    setHeatmapMode(false);
    setBagLayer('front');
    setActiveCategory(analysis.primaryGap || 'top');
  }

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
          bagLayer={bagLayer}
          heatmapMode={heatmapMode}
          highlightCategory={highlightCategory}
          magnetMode={magnetMode}
          activeEditSlot={activeEditSlot}
          onOpenSlot={onOpenSlot}
          onToggleSlotLock={onToggleSlotLock}
          onToggleGenerationSlot={onToggleGenerationSlot}
          polishMode={polishMode}
          selectedGenerationSlots={selectedGenerationSlots}
          lockedSlots={lockedSlots}
          skinTone={skinTone}
          slotInteractionDisabled={slotInteractionDisabled}
        />
      </div>
    </div>
  );
}

function FrontCanvas({
  items,
  bagLayer,
  heatmapMode,
  highlightCategory,
  magnetMode,
  activeEditSlot,
  onOpenSlot,
  onToggleSlotLock,
  onToggleGenerationSlot,
  polishMode,
  selectedGenerationSlots,
  lockedSlots,
  skinTone,
  slotInteractionDisabled,
}: {
  items: Partial<Record<Category, Product>>;
  bagLayer: 'front' | 'behind';
  heatmapMode: boolean;
  highlightCategory: Category | null;
  magnetMode: boolean;
  activeEditSlot?: Category | null;
  onOpenSlot?: (category: Category) => void;
  onToggleSlotLock?: (category: Category) => void;
  onToggleGenerationSlot?: (category: Category) => void;
  polishMode: boolean;
  selectedGenerationSlots: Category[];
  lockedSlots: Category[];
  skinTone?: string;
  slotInteractionDisabled?: boolean;
}) {
  const _crowding = getCrowding(items);
  const _placements = buildPlacements(items, bagLayer, polishMode);
  const _tone = skinTone;
  const _heatmap = heatmapMode;
  const _magnet = magnetMode;
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const zoneStyle: Record<Category, CSSProperties> = {
    hat: { gridColumn: '1', gridRow: '1 / span 2' },
    outer: { gridColumn: '1', gridRow: '3 / span 6' },
    top: { gridColumn: '2', gridRow: '1 / span 4' },
    bottom: { gridColumn: '2', gridRow: '5 / span 4' },
    eyewear: { gridColumn: '3', gridRow: '1 / span 2' },
    jewelry: { gridColumn: '3', gridRow: '3 / span 2' },
    bag: { gridColumn: '3', gridRow: '5 / span 2' },
    shoes: { gridColumn: '3', gridRow: '7 / span 2' },
  };

  const renderZone = (category: Category, prominent = false) => {
    const rawProduct = items[category];
    const product = hasUsableProductImage(rawProduct) && !failedImageIds.has(rawProduct.id) ? rawProduct : undefined;
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
      ? 'border-accent shadow-[0_0_0_1px_rgba(232,54,93,.74),0_0_30px_rgba(232,54,93,.36),0_14px_28px_rgba(40,18,22,.14)]'
      : selected
      ? 'border-accent shadow-[0_0_0_1px_rgba(232,54,93,.58),0_0_26px_rgba(232,54,93,.32),0_14px_28px_rgba(40,18,22,.14)]'
      : 'border-[#eadfd5] shadow-[0_10px_22px_rgba(48,34,24,.07)]';
    const wrapperClassName = `relative h-full w-full overflow-hidden rounded-[20px] border-2 bg-[linear-gradient(180deg,#fffefa_0%,#f6eee7_100%)] p-1.5 transition ${selectedClassName} ${interactive ? 'cursor-pointer hover:border-accent/80 hover:shadow-[0_0_0_1px_rgba(232,54,93,.42),0_0_24px_rgba(232,54,93,.22),0_14px_28px_rgba(40,18,22,.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.985]' : ''} ${activeEditSlot === category ? 'animate-pulse' : ''} ${highlightCategory === category ? 'ring-1 ring-accent/45' : ''}`;
    const selectionBadge = selected ? (
      <span className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_rgba(232,54,93,.42)]">
        {locked ? <Lock size={12} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
      </span>
    ) : null;

    if (!product) {
      return (
        <button
          type="button"
          onClick={handleSlotClick}
          disabled={slotInteractionDisabled}
          className={`${wrapperClassName} flex flex-col items-center justify-center border-dashed bg-white/64 px-1.5 text-center`}
          aria-pressed={selected}
          aria-label={onOpenSlot ? `Edit ${CATEGORY_LABELS[category]}` : `${generationSelected ? 'Exclude' : 'Include'} ${CATEGORY_LABELS[category]} in next generation`}
        >
          {selectionBadge}
          <span className={`text-[8px] font-bold uppercase tracking-[.18em] ${selected ? 'text-accent' : 'text-[#b39f91]'}`}>{CATEGORY_LABELS[category]}</span>
          <span className={`mt-1 text-[16px] leading-none ${selected ? 'text-accent' : 'text-[#d0bfb3]'}`}>+</span>
        </button>
      );
    }
    const imageClassName =
      category === 'top' ? 'h-full w-full object-contain object-center p-1.5 scale-[1.03]' :
      category === 'bottom' ? 'h-full w-full object-contain object-center p-1.5 scale-[1.03]' :
      category === 'shoes' ? 'h-full w-full object-contain object-center p-1.5 scale-[1.04]' :
      category === 'bag' ? 'h-full w-full object-contain object-center p-2 scale-[1.02]' :
      category === 'outer' ? 'h-full w-full object-contain object-center p-1.5 scale-[0.99]' :
      category === 'hat' ? 'h-full w-full object-contain object-center p-1.5 scale-[1.03]' :
      category === 'eyewear' ? 'h-full w-full object-contain object-center p-2 scale-[1.08]' :
      category === 'jewelry' ? 'h-full w-full object-contain object-center p-2.5 scale-[1.12]' :
      `h-full w-full object-contain ${prominent ? 'p-1' : 'p-1.5'}`;
    const innerFrameClassName =
      category === 'jewelry'
        ? 'flex h-[calc(100%-13px)] items-center justify-center overflow-hidden rounded-[12px] bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,.7)]'
        : category === 'eyewear'
        ? 'flex h-[calc(100%-13px)] items-center justify-center overflow-hidden rounded-[12px] bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,.65)]'
        : 'flex h-[calc(100%-13px)] items-center justify-center overflow-hidden rounded-[12px] bg-white/64 shadow-[inset_0_1px_0_rgba(255,255,255,.55)]';

    return (
      <button
        type="button"
        onClick={handleSlotClick}
        disabled={slotInteractionDisabled}
        className={wrapperClassName}
        aria-pressed={selected}
        aria-label={onOpenSlot ? `Edit ${CATEGORY_LABELS[category]}` : `${generationSelected ? 'Exclude' : 'Include'} ${CATEGORY_LABELS[category]} in next generation`}
      >
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
                ? 'border-accent bg-accent text-white shadow-[0_6px_16px_rgba(232,54,93,.36)]'
                : 'border-[#d9c9bb] bg-white/82 text-[#6c5c52] hover:border-accent hover:text-accent'
            }`}
          >
            <Lock size={12} strokeWidth={2.6} />
          </span>
        ) : null}
        <div className={`mb-0.5 text-left text-[7px] font-bold uppercase tracking-[.18em] ${selected ? 'text-accent' : 'text-[#9f8878]'}`}>{CATEGORY_LABELS[category]}</div>
        <div className={innerFrameClassName}>
          <PreviewImage
            product={product}
            category={category}
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
    <div className="relative h-[390px] overflow-hidden rounded-[24px] border border-[#e8ddd5] bg-[linear-gradient(180deg,#fffdfa_0%,#f7f1eb_100%)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_14px_34px_rgba(0,0,0,.1)] min-[390px]:h-[430px]">
      <div
        className="grid h-full gap-2.5"
        style={{
          gridTemplateColumns: '0.92fr 1.55fr 0.92fr',
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

function FlatLayCanvas({ items }: { items: Partial<Record<Category, Product>> }) {
  return (
    <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-[#e8ddd5] bg-[linear-gradient(180deg,#ffffff_0%,#f7f2ec_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.92)]">
      <div className="grid h-full grid-cols-2 gap-2.5">
        <div className="rounded-[20px] border border-[#ece2d9] bg-white/80 p-3">
          <div className="text-[10px] uppercase tracking-[.18em] text-[#9e8e84]">Mirror mode</div>
          <div className="mt-1 font-serif text-[16px] font-semibold text-[#342a26]">Outfit summary</div>
          <div className="mt-3 space-y-2">
            {CATEGORY_ORDER.filter((c) => items[c]).map((c) => (
              <div key={c} className="flex items-center justify-between rounded-full border border-[#ece2d9] bg-[#faf6f2] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#86756a]">
                <span>{CATEGORY_LABELS[c]}</span>
                <span>{items[c]?.brand}</span>
              </div>
            ))}
            {CATEGORY_ORDER.every((c) => !items[c]) ? <div className="text-[11px] text-[#8d7c73]">Add pieces to populate your board.</div> : null}
          </div>
        </div>
        <div className="rounded-[20px] border border-[#ece2d9] bg-white/80 p-2.5">
          <div className="grid h-full grid-cols-2 gap-2">
            {CATEGORY_ORDER.map((category) => (
              <div key={category} className="overflow-hidden rounded-[14px] border border-[#eee4dc] bg-white p-1.5">
                {items[category] ? (
                  <>
                    <div className="text-[8px] uppercase tracking-[.16em] text-[#a59082]">{CATEGORY_LABELS[category]}</div>
                    <div className="h-[calc(100%-14px)]">
                      <PreviewImage product={items[category]!} category={category} wrapperClassName="h-full w-full" modeClassName="h-full w-full object-contain p-1.5" blend={false} />
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-[8px] uppercase tracking-[.14em] text-[#b9a89d]">{CATEGORY_LABELS[category]}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] transition ${
        active
          ? 'border-accent/60 bg-accent/12 text-white shadow-pink-glow'
          : 'border-white/10 bg-white/[0.04] text-[#d8c9c0] hover:border-white/20 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AlignmentGuides() {
  return (
    <>
      <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-[linear-gradient(180deg,transparent,rgba(195,180,171,.62),transparent)]" />
      <div className="absolute left-[22%] right-[22%] top-[29%] h-px bg-[linear-gradient(90deg,transparent,rgba(210,196,188,.46),transparent)]" />
      <div className="absolute left-[24%] right-[24%] top-[54%] h-px bg-[linear-gradient(90deg,transparent,rgba(210,196,188,.38),transparent)]" />
      <div className="absolute left-[28%] right-[28%] top-[84%] h-px bg-[linear-gradient(90deg,transparent,rgba(210,196,188,.32),transparent)]" />
    </>
  );
}

function HeatmapOverlay({
  crowding,
}: {
  crowding: { upper: number; mid: number; lower: number };
}) {
  return (
    <>
      <HeatSpot top="14%" left="50%" intensity={crowding.upper} />
      <HeatSpot top="42%" left="53%" intensity={crowding.mid} />
      <HeatSpot top="79%" left="50%" intensity={crowding.lower} />
    </>
  );
}

function HeatSpot({
  top,
  left,
  intensity,
}: {
  top: string;
  left: string;
  intensity: number;
}) {
  const alpha = intensity >= 4 ? 0.16 : intensity >= 3 ? 0.1 : 0.05;
  return (
    <div
      className="absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      style={{ top, left, background: `rgba(232, 54, 93, ${alpha})` }}
    />
  );
}

function Silhouette({ skinTone }: { skinTone?: string }) {
  const tone = skinTone || '#d6c0b1';

  return (
    <>
      <div className="absolute left-1/2 top-[12%] h-[64px] w-[62px] -translate-x-1/2 rounded-[28px] blur-[1px]" style={{ background: hexToRgba(tone, 0.25) }} />
      <div className="absolute left-1/2 top-[28%] h-[122px] w-[112px] -translate-x-1/2 rounded-[42px]" style={{ background: hexToRgba(tone, 0.14) }} />
      <div className="absolute left-[29%] top-[31%] h-[108px] w-[34px] rounded-[22px]" style={{ background: hexToRgba(tone, 0.12) }} />
      <div className="absolute right-[29%] top-[31%] h-[108px] w-[34px] rounded-[22px]" style={{ background: hexToRgba(tone, 0.12) }} />
      <div className="absolute left-[40%] top-[58%] h-[112px] w-[32px] rounded-[22px]" style={{ background: hexToRgba(tone, 0.12) }} />
      <div className="absolute right-[40%] top-[58%] h-[112px] w-[32px] rounded-[22px]" style={{ background: hexToRgba(tone, 0.12) }} />
      <div className="absolute left-[34%] bottom-[7%] h-4 w-16 rounded-full" style={{ background: hexToRgba(tone, 0.16) }} />
      <div className="absolute right-[34%] bottom-[7%] h-4 w-16 rounded-full" style={{ background: hexToRgba(tone, 0.16) }} />
    </>
  );
}

function PreviewImage({
  product,
  category,
  wrapperClassName,
  modeClassName,
  blend,
  onUnavailable,
}: {
  product: Product;
  category: Category;
  wrapperClassName: string;
  modeClassName: string;
  blend: boolean;
  onUnavailable?: (product: Product) => void;
}) {
  return (
    <ProductImage
      product={product}
      wrapperClassName={wrapperClassName}
      className={`${modeClassName} ${blend ? 'mix-blend-multiply' : ''}`}
      displayMode="cutout"
      onUnavailable={onUnavailable}
    />
  );
}

function buildPlacements(
  items: Partial<Record<Category, Product>>,
  bagLayer: 'front' | 'behind',
  polishMode: boolean,
): Partial<Record<Category, Placement>> {
  const hasOuter = Boolean(items.outer);
  const topY = hasOuter ? 30 : 29;
  const bottomY = items.top || items.outer ? 56 : 52;

  return {
    hat: items.hat
      ? {
          x: 50,
          y: 6,
          w: 32,
          h: 15,
          z: 12,
          imageClassName: 'h-full w-full object-contain object-bottom',
        }
      : undefined,
    eyewear: items.eyewear
      ? {
          x: 50,
          y: 18,
          w: 23,
          h: 8,
          z: 13,
          imageClassName: 'h-full w-full object-contain',
          blend: false,
        }
      : undefined,
    jewelry: items.jewelry
      ? {
          x: 50,
          y: 29,
          w: 13,
          h: 8,
          z: 10,
          imageClassName: 'h-full w-full object-contain',
          blend: false,
        }
      : undefined,
    outer: items.outer
      ? {
          x: 50,
          y: 28,
          w: polishMode ? 57 : 60,
          h: 33,
          z: 4,
          imageClassName: 'h-full w-full object-contain',
        }
      : undefined,
    top: items.top
      ? {
          x: 50,
          y: topY,
          w: hasOuter ? 42 : 46,
          h: hasOuter ? 27 : 29,
          z: 6,
          imageClassName: 'h-full w-full object-contain',
        }
      : undefined,
    bottom: items.bottom
      ? {
          x: 50,
          y: bottomY,
          w: 38,
          h: 29,
          z: 6,
          imageClassName: 'h-full w-full object-contain object-top',
        }
      : undefined,
    bag: items.bag ? resolveBagPlacement(items.bag, bagLayer) : undefined,
    shoes: items.shoes
      ? {
          x: 50,
          y: 88,
          w: 42,
          h: 10,
          z: 8,
          imageClassName: 'h-full w-full object-contain object-bottom',
          blend: false,
        }
      : undefined,
  };
}

function resolveBagPlacement(product: Product, bagLayer: 'front' | 'behind'): Placement {
  const styles = metadataList(product, 'styles').join(' ').toLowerCase();
  const keywords = metadataList(product, 'keywords').join(' ').toLowerCase();
  const tokens = `${styles} ${keywords}`;

  if (tokens.includes('belt bag') || tokens.includes('waist bag')) {
    return {
      x: 67,
      y: 50,
      w: 24,
      h: 16,
      z: bagLayer === 'front' ? 8 : 5,
      rotation: -10,
      imageClassName: 'h-full w-full object-contain',
      blend: false,
    };
  }

  if (tokens.includes('tote')) {
    return {
      x: 75,
      y: 53,
      w: 24,
      h: 28,
      z: bagLayer === 'front' ? 8 : 3,
      rotation: -4,
      imageClassName: 'h-full w-full object-contain object-bottom',
      blend: false,
    };
  }

  if (tokens.includes('crossbody')) {
    return {
      x: 70,
      y: 44,
      w: 25,
      h: 22,
      z: bagLayer === 'front' ? 9 : 4,
      rotation: -10,
      imageClassName: 'h-full w-full object-contain',
      blend: false,
    };
  }

  return {
    x: 71,
    y: 44,
    w: 24,
    h: 24,
    z: bagLayer === 'front' ? 9 : 4,
    rotation: -6,
    imageClassName: 'h-full w-full object-contain',
    blend: false,
  };
}

function renderShoes(product: Product, placement: Placement, highlighted: boolean) {
  return (
    <>
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className={highlighted ? 'drop-shadow-[0_18px_28px_rgba(232,54,93,.22)]' : ''}
        style={{
          ...placementStyle({ ...placement, x: 42.5, w: 18, h: 10 }),
          zIndex: placement.z,
        }}
      >
        <PreviewImage
          product={product}
          category="shoes"
          modeClassName="h-full w-full object-contain object-bottom"
          wrapperClassName="h-full w-full"
          blend={false}
        />
      </motion.div>
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className={highlighted ? 'drop-shadow-[0_18px_28px_rgba(232,54,93,.22)]' : ''}
        style={{
          ...placementStyle({ ...placement, x: 57.5, w: 18, h: 10 }),
          zIndex: placement.z,
          transform: 'translateX(-50%) scaleX(-1)',
        }}
      >
        <PreviewImage
          product={product}
          category="shoes"
          modeClassName="h-full w-full object-contain object-bottom"
          wrapperClassName="h-full w-full"
          blend={false}
        />
      </motion.div>
    </>
  );
}

function placementStyle(placement: Placement): CSSProperties {
  const rotation = placement.rotation || 0;
  return {
    position: 'absolute',
    left: `${placement.x}%`,
    top: `${placement.y}%`,
    width: `${placement.w}%`,
    height: `${placement.h}%`,
    zIndex: placement.z,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };
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

function defaultCanvasImageClass(category: Category): string {
  if (category === 'hat') return 'h-full w-full object-contain object-bottom';
  if (category === 'eyewear') return 'h-full w-full object-contain';
  if (category === 'jewelry') return 'h-full w-full object-contain';
  if (category === 'bag') return 'h-full w-full object-contain';
  if (category === 'bottom') return 'h-full w-full object-contain object-top';
  return 'h-full w-full object-contain';
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
  if (normalized.length !== 6) return `rgba(232, 54, 93, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
