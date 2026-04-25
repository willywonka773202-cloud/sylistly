'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Palette, Layers, Target, Zap } from 'lucide-react';
import type { Product, Category } from '@/lib/types';

interface Props {
  items: Partial<Record<Category, Product>>;
}

interface StyleDNA {
  name: string;
  icon: string;
  score: number;
}

const STYLE_DNA_LABELS = [
  { keywords: ['supreme', 'nike', 'jordan', 'dunk', 'travis'], label: 'Streetwear' },
  { keywords: ['gucci', 'prada', 'louis vuitton', 'balenciaga'], label: 'Luxury Minimalist' },
  { keywords: ['levis', '501', 'wrangler', 'carhartt'], label: 'Americana' },
  { keywords: ['accolade', 'zegna', 'brioni'], label: 'Old Money' },
  { keywords: ['arcteryx', 'patagonia', 'the north face'], label: 'Gorpcore' },
  { keywords: ['j crew', 'banana republic', 'polo'], label: 'Clean Boy' },
  { keywords: ['versace', 'fendi', 'dolce'], label: 'Euro Summer' },
  { keywords: ['yeezy', 'balenciaga', ' Off-White™'], label: 'Y2K' },
];

const COLOR_HARMONY = {
  neutral: ['black', 'white', 'grey', 'gray', 'beige', 'navy', 'cream'],
  warm: ['red', 'orange', 'yellow', 'burgundy', 'brown', 'tan'],
  cool: ['blue', 'green', 'purple', 'teal', 'olive'],
};

function analyzeColors(items: Product[]): { harmony: number; dominant: string[] } {
  const colorCounts: Record<string, number> = {};
  items.forEach((item) => {
    const name = item.name.toLowerCase();
    const brand = item.brand.toLowerCase();
    const text = `${brand} ${name}`;
    Object.keys(COLOR_HARMONY).forEach((palette) => {
      COLOR_HARMONY[palette as keyof typeof COLOR_HARMONY].forEach((color) => {
        if (text.includes(color)) {
          colorCounts[palette] = (colorCounts[palette] || 0) + 1;
        }
      });
    });
  });

  const categories = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  const dominant = categories.slice(0, 2).map(([c]) => c);
  
  let harmony = 50;
  if (dominant.length === 1) harmony = 85;
  else if (dominant.length === 2 && dominant[0] === dominant[1]) harmony = 80;
  else if (dominant.includes('neutral') && dominant.length > 1) harmony = 75;
  else if (dominant.includes('warm') && dominant.includes('cool')) harmony = 40;
  
  return { harmony, dominant };
}

function calculateRarity(items: Product[]): number {
  const brandCounts: Record<string, number> = {};
  items.forEach((item) => {
    brandCounts[item.brand] = (brandCounts[item.brand] || 0) + 1;
  });

  const uniqueBrands = Object.keys(brandCounts).length;
  const avgPrice = items.reduce((sum, p) => sum + p.priceCents, 0) / items.length;
  
  let rarity = 50;
  if (uniqueBrands >= 4) rarity += 15;
  if (avgPrice > 30000) rarity += 15;
  else if (avgPrice > 15000) rarity += 8;
  
  return Math.min(100, rarity);
}

function calculateTrendLevel(items: Product[]): number {
  const trendingBrands = ['nike', 'supreme', 'gucci', 'prada', 'jordan', 'dunk', 'yeezy'];
  const matchCount = items.filter((p) => 
    trendingBrands.some((b) => p.brand.toLowerCase().includes(b))
  ).length;
  
  return 40 + Math.min(60, matchCount * 15);
}

function analyzeStyleDNA(items: Product[]): StyleDNA[] {
  const fullText = items.map((p) => `${p.brand} ${p.name}`).join(' ').toLowerCase();
  
  return STYLE_DNA_LABELS.map(({ keywords, label }) => {
    const matchCount = keywords.filter((k) => fullText.includes(k)).length;
    return { name: label, icon: label.toLowerCase().replace(' ', '-'), score: matchCount * 30 + 20 };
  }).filter((s) => s.score > 30).slice(0, 3);
}

export function DripMeter({ items }: Props) {
  const score = useMemo(() => {
    const productList = Object.values(items).filter(Boolean) as Product[];
    if (productList.length < 2) return { total: 0, breakdown: null };

    const { harmony } = analyzeColors(productList);
    const rarity = calculateRarity(productList);
    const trend = calculateTrendLevel(productList);
    const cohesion = productList.length >= 5 ? 75 : 50 + productList.length * 5;

    const total = Math.round((harmony + rarity + trend + cohesion) / 4);
    const breakdown = { harmony, rarity, trend, cohesion };

    return { total, breakdown };
  }, [items]);

  const dna = useMemo(() => {
    const productList = Object.values(items).filter(Boolean) as Product[];
    if (productList.length < 2) return [];
    return analyzeStyleDNA(productList);
  }, [items]);

  if (score.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-surface-2 to-surface-1 border border-hairline"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs uppercase tracking-widest text-muted">Drip Meter</span>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="flex items-center gap-1"
        >
          <span className="font-serif text-2xl font-bold">{score.total}</span>
          <span className="text-xs text-muted">/100</span>
        </motion.div>
      </div>

      {score.breakdown && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20">
            <Palette size={14} className="text-muted" />
            <span className="text-[10px] text-muted">Harmony</span>
            <span className="ml-auto text-xs font-medium">{score.breakdown.harmony}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20">
            <Target size={14} className="text-muted" />
            <span className="text-[10px] text-muted">Rarity</span>
            <span className="ml-auto text-xs font-medium">{score.breakdown.rarity}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20">
            <TrendingUp size={14} className="text-muted" />
            <span className="text-[10px] text-muted">Trend</span>
            <span className="ml-auto text-xs font-medium">{score.breakdown.trend}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20">
            <Layers size={14} className="text-muted" />
            <span className="text-[10px] text-muted">Cohesion</span>
            <span className="ml-auto text-xs font-medium">{score.breakdown.cohesion}</span>
          </div>
        </div>
      )}

      {dna.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted">Style DNA</span>
          {dna.map((style) => (
            <span
              key={style.name}
              className="px-2 py-1 rounded-full bg-accent/20 text-accent text-[10px] font-medium"
            >
              {style.name}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}