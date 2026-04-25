'use client';
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Palette, Layers, Target, Dna } from 'lucide-react';
import type { Product, Category } from '@/lib/types';

interface Props {
  items: Partial<Record<Category, Product>>;
}

const STYLE_DNA_LABELS = [
  { keywords: ['supreme', 'nike', 'jordan', 'dunk', 'stussy'], label: 'Streetwear Icon' },
  { keywords: ['gucci', 'prada', 'louis vuitton', 'balenciaga'], label: 'High Fashion' },
  { keywords: ['levis', '501', 'dickies', 'carhartt'], label: 'Urban Americana' },
  { keywords: ['arcteryx', 'patagonia', 'the north face'], label: 'Technical Gorpcore' },
  { keywords: ['j crew', 'polo', 'ralph lauren'], label: 'Elevated Preppy' },
  { keywords: ['zara', 'h&m', 'uniqlo', 'aritzia'], label: 'Clean Minimalist' },
];

function analyzeDNA(items: Product[]) {
  const fullText = items.map((p) => `${p.brand} ${p.name}`).join(' ').toLowerCase();
  
  // Color Harmony
  const hasBlack = fullText.includes('black');
  const hasWhite = fullText.includes('white');
  const hasPop = fullText.includes('red') || fullText.includes('neon') || fullText.includes('pink') || fullText.includes('yellow');
  let harmonyScore = 60;
  if (hasBlack && hasWhite) harmonyScore += 20;
  if (hasBlack && hasPop) harmonyScore += 15;
  if (items.length > 3 && !hasBlack && !hasWhite) harmonyScore -= 10;
  
  // Rarity & Brand Cohesion
  const brands = new Set(items.map(i => i.brand));
  let rarityScore = 50 + (brands.size * 10);
  if (brands.size > 4) rarityScore -= 15; // Too many brands clashing
  if (brands.size === 1 && items.length > 2) rarityScore += 20; // Full brand tracksuit/fit

  // Extract DNA Labels
  const dnaLabels = STYLE_DNA_LABELS.map(({ keywords, label }) => {
    const matchCount = keywords.filter((k) => fullText.includes(k)).length;
    return { name: label, score: matchCount };
  }).filter((s) => s.score > 0).sort((a,b) => b.score - a.score).slice(0, 2);

  const total = Math.min(100, Math.round((harmonyScore + rarityScore + (dnaLabels.length * 20)) / 3) + (items.length * 5));

  // Generate actionable feedback
  let feedback = "A solid start. Add more pieces to complete the look.";
  if (total > 85) feedback = "Flawless cohesion. This outfit is ready for the runway.";
  else if (total > 70) feedback = "Strong aesthetics! Great mix of pieces.";
  else if (brands.size > 4) feedback = "A bit chaotic. Try sticking to 2-3 brands for better synergy.";
  else if (hasPop && !hasBlack && !hasWhite) feedback = "Very colorful! Consider anchoring it with a neutral tone.";
  
  return {
    total,
    breakdown: { harmony: Math.min(100, harmonyScore), rarity: Math.min(100, rarityScore) },
    dna: dnaLabels,
    feedback
  };
}

export function DripMeter({ items }: Props) {
  const analysis = useMemo(() => {
    const productList = Object.values(items).filter(Boolean) as Product[];
    if (productList.length < 2) return null;
    return analyzeDNA(productList);
  }, [items]);

  if (!analysis) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="mt-6 p-5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative overflow-hidden group"
    >
      {/* Animated gradient background sweep */}
      <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center border border-accent/30">
              <Dna className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.2em] font-medium text-white/80">Style DNA Score</span>
          </div>
          <motion.div
            key={analysis.total}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="flex items-baseline gap-0.5"
          >
            <span className="font-serif text-3xl font-bold text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">{analysis.total}</span>
            <span className="text-xs text-white/50">/100</span>
          </motion.div>
        </div>

        <p className="text-sm text-white/90 font-medium mb-4 leading-relaxed">
          {analysis.feedback}
        </p>

        {analysis.dna.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {analysis.dna.map((style) => (
              <span
                key={style.name}
                className="px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-white/90 text-[11px] font-medium tracking-wide flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles size={10} className="text-accent" />
                {style.name}
              </span>
            ))}
          </div>
        )}

        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-2 relative">
          <motion.div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-accent to-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${analysis.total}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}