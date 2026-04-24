'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Layers3, Radar, Sparkles, Wand2 } from 'lucide-react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { proxiedImageUrl } from '@/lib/image-url';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import type { GeneratorFrame } from '@/lib/vibes';

export type FitVariant = 'casual' | 'elevated' | 'bold';

interface Props {
  items: Partial<Record<Category, Product>>;
  skinTone?: string;
  bodyType?: GeneratorFrame;
  vibeLabel: string;
  vibeBlurb: string;
  onOpenSearch?: (category: Category) => void;
  onGenerateVariant?: (variant: FitVariant) => void;
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

const VARIANT_COPY: Record<FitVariant, { title: string; blurb: string }> = {
  casual: { title: 'Casual', blurb: 'Relax the look' },
  elevated: { title: 'Elevated', blurb: 'Sharpen the silhouette' },
  bold: { title: 'Bold', blurb: 'Push contrast and statement' },
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
  onOpenSearch,
  onGenerateVariant,
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
  const stackEntries = CATEGORY_ORDER.filter((category) => items[category]).map((category) => ({
    category,
    product: items[category]!,
  }));
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
      className="relative overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,#1a1714_0%,#11100f_32%,#0e0d0c_100%)] p-3.5 shadow-[0_28px_80px_rgba(0,0,0,.35)]"
      style={{
        boxShadow: `0 28px 80px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px ${hexToRgba(glow, 0.08)}`,
      }}
    >
      <div className="absolute -right-10 top-10 h-36 w-36 rounded-full blur-3xl" style={{ background: hexToRgba(glow, 0.12) }} />
      <div className="absolute left-[-30px] top-44 h-32 w-32 rounded-full bg-[#f5e8de]/8 blur-3xl" />

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[.22em] text-[#9f9187]">AI fit board</div>
          <div className="mt-1 font-serif text-[24px] font-semibold leading-none text-[#fff6f0]">
            Outfit <em className="italic text-accent">canvas</em>
          </div>
          <div className="mt-2 max-w-[220px] text-[11px] leading-relaxed text-[#c8b9ae]">
            {vibeLabel} styling system tuned for anchored placement, color balance, and cleaner product separation.
          </div>
          <div className="mt-1 max-w-[240px] text-[10px] uppercase tracking-[.14em] text-[#9d8d84]">
            {vibeBlurb}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur">
          <div className="text-[10px] uppercase tracking-[.18em] text-[#a7948b]">{FRAME_LABELS[bodyType]}</div>
          <div className="mt-1 font-serif text-[28px] font-semibold leading-none text-[#fff8f4]">
            {analysis.score}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[.16em] text-[#b9aaa1]">
            {count}/8 placed
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        <ToolChip label="Fit Magnet" active={magnetMode} onClick={() => setMagnetMode((value) => !value)} icon={<Radar size={12} />} />
        <ToolChip label="Mirror Mode" active={mirrorMode} onClick={() => setMirrorMode((value) => !value)} icon={<Layers3 size={12} />} />
        <ToolChip label="Heatmap" active={heatmapMode} onClick={() => setHeatmapMode((value) => !value)} icon={<Sparkles size={12} />} />
        <ToolChip label="Auto Fit" active={false} onClick={autoFit} icon={<Wand2 size={12} />} />
        <ToolChip label="One Tap Polish" active={polishMode} onClick={() => setPolishMode((value) => !value)} icon={<Sparkles size={12} />} />
      </div>

      <div className="relative z-10 mt-4 overflow-hidden rounded-[30px] border border-[#ebe0d8] bg-[#f7f2ee] p-3 shadow-[0_18px_46px_rgba(0,0,0,.22)]">
        <div
          className="rounded-[26px] border border-[#e9dfd7] bg-[linear-gradient(180deg,#fcfaf8_0%,#f7f1eb_58%,#f0e8e2_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]"
          style={{
            backgroundImage: `radial-gradient(circle at 18% 18%, rgba(255,255,255,.86), transparent 28%), radial-gradient(circle at 82% 12%, rgba(255,255,255,.68), transparent 24%), radial-gradient(circle at 50% 70%, ${hexToRgba(glow, 0.16)}, transparent 36%), linear-gradient(180deg,#fcfaf8 0%,#f7f1eb 58%,#f0e8e2 100%)`,
          }}
        >
          {mirrorMode ? (
            <div className="grid grid-cols-2 gap-3">
              <FrontCanvas
                items={items}
                bagLayer={bagLayer}
                heatmapMode={heatmapMode}
                highlightCategory={highlightCategory}
                magnetMode={magnetMode}
                polishMode={polishMode}
                skinTone={skinTone}
              />
              <FlatLayCanvas items={items} />
            </div>
          ) : (
            <FrontCanvas
              items={items}
              bagLayer={bagLayer}
              heatmapMode={heatmapMode}
              highlightCategory={highlightCategory}
              magnetMode={magnetMode}
              polishMode={polishMode}
              skinTone={skinTone}
            />
          )}
        </div>

        {!hasItems ? (
          <div className="mt-3 rounded-[22px] border border-[#eadfd7] bg-white/70 px-4 py-3 text-[11px] leading-relaxed text-[#74665f] shadow-[0_10px_24px_rgba(84,54,43,.06)]">
            Add pieces below and Sylistly will snap them into the head, torso, waist, foot, and side-body zones automatically.
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[22px] border border-[#eadfd7] bg-white/72 px-4 py-2.5 text-[10px] uppercase tracking-[.18em] text-[#8e7d73] shadow-[0_8px_20px_rgba(84,54,43,.05)]">
            <span>{analysis.balanceLabel}</span>
            <span>{analysis.harmonyLabel}</span>
            <span>{count} products in look</span>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-2 gap-3">
        <section className="rounded-[26px] border border-white/8 bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[.18em] text-[#a8968b]">Product stack</div>
              <div className="mt-1 font-serif text-[18px] font-semibold text-[#fff6f0]">Selected pieces</div>
            </div>
            <button
              type="button"
              onClick={() => onOpenSearch?.(analysis.primaryGap || 'top')}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[.14em] text-[#d9cbc3] transition hover:border-accent hover:text-white"
            >
              Browse
              <ArrowUpRight size={11} />
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {stackEntries.length ? (
              stackEntries.map(({ category, product }) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onOpenSearch?.(category)}
                  onMouseEnter={() => setActiveCategory(category)}
                  onMouseLeave={() => setActiveCategory(null)}
                  className="flex w-full items-center gap-3 rounded-[20px] border border-white/7 bg-[#141210] px-2.5 py-2.5 text-left transition hover:border-accent/40 hover:bg-[#191613]"
                >
                  <div className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,#fbfaf8_0%,#f2ebe5_100%)] ring-1 ring-[#efe4da]">
                    <PreviewImage
                      product={product}
                      category={category}
                      modeClassName="h-full w-full object-contain p-2"
                      wrapperClassName="h-full w-full"
                      blend={false}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] uppercase tracking-[.18em] text-[#a69489]">{CATEGORY_LABELS[category]}</div>
                    <div className="mt-1 truncate text-[12px] font-medium text-[#fff4ee]">{product.brand}</div>
                    <div className="truncate text-[11px] text-[#c1b2a8]">{product.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-[14px] font-semibold text-[#fff4ee]">
                      ${(product.priceCents / 100).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-white/10 bg-[#141210] px-3 py-5 text-center text-[11px] leading-relaxed text-[#c8b9ae]">
                Your product stack populates here as you add pieces from the tray.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-white/8 bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur">
          <div className="text-[10px] uppercase tracking-[.18em] text-[#a8968b]">Style intelligence</div>
          <div className="mt-1 font-serif text-[18px] font-semibold text-[#fff6f0]">Fit diagnostics</div>

          <div className="mt-3 rounded-[22px] border border-white/8 bg-[#141210] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[.18em] text-[#aa968b]">Style DNA</div>
                <div className="mt-1 text-[13px] font-medium text-[#fff6f0]">{analysis.silhouetteLabel}</div>
              </div>
              <div className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-[#fff6f0]">
                {analysis.harmonyLabel}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {analysis.styleDna.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[.14em] text-[#d9cac1]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            <MetricRow label="Color harmony" value={analysis.colorHarmony} />
            <MetricRow label="Silhouette" value={analysis.silhouette} />
            <MetricRow label="Layering" value={analysis.layering} />
            <MetricRow label="Proportions" value={analysis.proportions} />
          </div>

          <div className="mt-3 rounded-[22px] border border-white/8 bg-[#141210] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[.18em] text-[#aa968b]">Heatmap</div>
              <button
                type="button"
                onClick={() => setBagLayer((value) => (value === 'front' ? 'behind' : 'front'))}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] uppercase tracking-[.16em] text-[#d7c6bc] transition hover:border-accent"
              >
                Bag {bagLayer === 'front' ? 'front' : 'behind'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <HeatChip label="Upper" value={analysis.crowding.upper} />
              <HeatChip label="Mid" value={analysis.crowding.mid} />
              <HeatChip label="Lower" value={analysis.crowding.lower} />
            </div>
            <div className="mt-3 text-[11px] leading-relaxed text-[#c7b8ae]">{analysis.upgradeNote}</div>
          </div>

          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-[.18em] text-[#aa968b]">Shop the gaps</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.missing.length ? (
                analysis.missing.slice(0, 3).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onOpenSearch?.(category)}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#f5e8df] transition hover:border-accent"
                  >
                    Add {category}
                  </button>
                ))
              ) : (
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-[#d8c9c0]">
                  Fully styled
                </span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-[.18em] text-[#aa968b]">3 better versions</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.keys(VARIANT_COPY) as FitVariant[]).map((variant) => (
                <button
                  key={variant}
                  type="button"
                  onClick={() => onGenerateVariant?.(variant)}
                  className="rounded-[18px] border border-white/10 bg-[#151311] px-2.5 py-2.5 text-left transition hover:border-accent hover:bg-[#191613]"
                >
                  <div className="text-[10px] uppercase tracking-[.16em] text-[#f5e8df]">{VARIANT_COPY[variant].title}</div>
                  <div className="mt-1 text-[10px] leading-relaxed text-[#bdaea4]">{VARIANT_COPY[variant].blurb}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
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
  polishMode,
  skinTone,
}: {
  items: Partial<Record<Category, Product>>;
  bagLayer: 'front' | 'behind';
  heatmapMode: boolean;
  highlightCategory: Category | null;
  magnetMode: boolean;
  polishMode: boolean;
  skinTone?: string;
}) {
  const crowding = getCrowding(items);
  const placements = buildPlacements(items, bagLayer, polishMode);

  return (
    <div className="relative h-[380px] overflow-hidden rounded-[28px] border border-[#e8ddd5] bg-[linear-gradient(180deg,#fefdfb_0%,#f7f2ec_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.94),transparent_28%),radial-gradient(circle_at_50%_68%,rgba(232,54,93,.08),transparent_36%)]" />
      <AlignmentGuides />
      {heatmapMode ? <HeatmapOverlay crowding={crowding} /> : null}
      <Silhouette skinTone={skinTone} />

      {GHOST_ZONES.map((zone) => {
        const filled = Boolean(items[zone.category]);
        const focused = highlightCategory === zone.category;
        return (
          <div
            key={zone.category}
            className={`absolute rounded-[22px] border border-dashed transition ${
              filled
                ? 'border-transparent'
                : focused || magnetMode
                ? 'border-accent/40 bg-accent/[0.05]'
                : 'border-[#ddd2ca] bg-white/[0.18]'
            }`}
            style={zone.style}
          >
            {!filled ? (
              <div className="absolute left-3 top-2 text-[9px] uppercase tracking-[.18em] text-[#b9aaa0]">
                {zone.label}
              </div>
            ) : null}
          </div>
        );
      })}

      {CATEGORY_PRIORITY.map((category) => {
        const product = items[category];
        const placement = placements[category];
        if (!product || !placement) return null;

        if (category === 'shoes') {
          return (
            <div key={`${category}-${product.id}`} className="absolute inset-0">
              {renderShoes(product, placement, highlightCategory === category)}
            </div>
          );
        }

        return (
          <motion.div
            key={`${category}-${product.id}`}
            layout
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={`absolute ${placement.frameClassName || ''}`}
            style={placementStyle(placement)}
          >
            <div
              className={`relative h-full w-full ${
                highlightCategory === category ? 'drop-shadow-[0_18px_28px_rgba(232,54,93,.22)]' : ''
              }`}
            >
              <PreviewImage
                product={product}
                category={category}
                modeClassName={placement.imageClassName || defaultCanvasImageClass(category)}
                wrapperClassName="h-full w-full"
                blend={placement.blend ?? (category !== 'bag' && category !== 'eyewear' && category !== 'jewelry')}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function FlatLayCanvas({ items }: { items: Partial<Record<Category, Product>> }) {
  const entries = CATEGORY_PRIORITY.filter((category) => items[category]);

  return (
    <div className="relative h-[380px] overflow-hidden rounded-[28px] border border-[#e8ddd5] bg-[linear-gradient(180deg,#ffffff_0%,#f7f2ec_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.92)]">
      <div className="text-[10px] uppercase tracking-[.18em] text-[#9e8e84]">Mirror mode</div>
      <div className="mt-1 font-serif text-[17px] font-semibold text-[#342a26]">Flat-lay board</div>
      <div className="mt-3 grid h-[310px] grid-cols-2 gap-2.5">
        {entries.length ? (
          entries.map((category, index) => (
            <div
              key={`${category}-${items[category]!.id}`}
              className={`rounded-[20px] border border-[#eee4dc] bg-white p-2 shadow-[0_10px_18px_rgba(84,54,43,.05)] ${
                index === 0 ? 'col-span-2' : ''
              }`}
            >
              <div className="text-[9px] uppercase tracking-[.18em] text-[#b29f95]">{CATEGORY_LABELS[category]}</div>
              <div className="mt-2 flex h-[calc(100%-18px)] items-center justify-center overflow-hidden rounded-[14px] bg-[#faf6f2]">
                <PreviewImage
                  product={items[category]!}
                  category={category}
                  wrapperClassName="h-full w-full"
                  modeClassName="h-full w-full object-contain p-2.5"
                  blend={false}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 rounded-[24px] border border-dashed border-[#e2d7cf] bg-white/70 p-4 text-center text-[11px] leading-relaxed text-[#8d7c73]">
            Mirror mode will generate a flat-lay board as soon as pieces are added.
          </div>
        )}
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

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[.16em] text-[#a8968b]">
        <span>{label}</span>
        <span className="text-[#f5e8df]">{value}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(8, Math.min(100, value))}%` }}
          transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          className="h-full rounded-full bg-[linear-gradient(90deg,#e8365d_0%,#ffc9d4_100%)]"
        />
      </div>
    </div>
  );
}

function HeatChip({
  label,
  value,
}: {
  label: string;
  value: 'calm' | 'balanced' | 'crowded';
}) {
  const styles =
    value === 'crowded'
      ? 'border-rose-400/35 bg-rose-500/12 text-rose-100'
      : value === 'balanced'
      ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
      : 'border-white/10 bg-white/[0.05] text-[#eee2da]';

  return (
    <div className={`rounded-[18px] border px-2.5 py-2 text-center ${styles}`}>
      <div className="text-[9px] uppercase tracking-[.18em]">{label}</div>
      <div className="mt-1 text-[11px] font-semibold capitalize">{value}</div>
    </div>
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
}: {
  product: Product;
  category: Category;
  wrapperClassName: string;
  modeClassName: string;
  blend: boolean;
}) {
  const [imageMode, setImageMode] = useState<'cutout' | 'plain' | 'fallback'>(() =>
    product.imageUrl ? 'cutout' : 'fallback',
  );

  const src =
    imageMode === 'fallback' || !product.imageUrl
      ? overlayFallback(product.brand)
      : imageMode === 'cutout'
      ? proxiedImageUrl(product.imageUrl, { cutout: true, category })
      : proxiedImageUrl(product.imageUrl);

  return (
    <div className={wrapperClassName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${product.brand} ${product.name}`}
        className={modeClassName}
        style={{
          mixBlendMode: blend ? 'multiply' : 'normal',
          filter: blend ? 'drop-shadow(0 14px 22px rgba(0,0,0,.16))' : 'drop-shadow(0 10px 18px rgba(0,0,0,.08))',
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageMode((current) => (current === 'cutout' ? 'plain' : 'fallback'))}
      />
    </div>
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
