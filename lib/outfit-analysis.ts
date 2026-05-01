import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';

export interface OutfitAnalysis {
  score: number;
  colorHarmony: number;
  silhouette: number;
  layering: number;
  proportions: number;
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

const CORE_SLOTS: Category[] = ['outer', 'top', 'bottom', 'shoes', 'bag'];
const STYLE_WORDS = ['clean', 'streetwear', 'minimal', 'night out', 'athletic', 'elevated', 'casual', 'edgy'];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function productText(product: Product) {
  return `${product.brand} ${product.name} ${product.category}`.toLowerCase();
}

export function analyzeOutfit(items: Partial<Record<Category, Product>>, vibeLabel = 'Clean'): OutfitAnalysis {
  const present = CATEGORY_ORDER.filter((category) => Boolean(items[category]));
  const missing = CATEGORY_ORDER.filter((category) => !items[category]);
  const count = present.length;
  const coreCount = CORE_SLOTS.filter((category) => Boolean(items[category])).length;
  const accessoryCount = ['hat', 'eyewear', 'jewelry', 'bag'].filter((category) => Boolean(items[category as Category])).length;
  const upperCount = ['hat', 'eyewear', 'jewelry', 'outer', 'top'].filter((category) => Boolean(items[category as Category])).length;
  const lowerCount = ['bottom', 'shoes'].filter((category) => Boolean(items[category as Category])).length;
  const brands = new Set(present.map((category) => items[category]?.brand).filter(Boolean));

  const colorHarmony = clamp(50 + count * 7 + Math.min(brands.size, 4) * 4);
  const silhouette = clamp(45 + coreCount * 10 + (items.outer && items.top ? 8 : 0));
  const layering = clamp(40 + (items.outer ? 18 : 0) + (items.bag ? 8 : 0) + accessoryCount * 5);
  const proportions = clamp(44 + (items.top ? 12 : 0) + (items.bottom ? 18 : 0) + (items.shoes ? 12 : 0) + Math.min(coreCount, 4) * 4);
  const score = clamp((colorHarmony + silhouette + layering + proportions) / 4);

  const text = present.map((category) => productText(items[category]!)).join(' ');
  const styleDna = STYLE_WORDS.filter((word) => text.includes(word)).slice(0, 2);
  if (!styleDna.length) styleDna.push(vibeLabel.toLowerCase());
  if (coreCount >= 4 && !styleDna.includes('full-body')) styleDna.push('full-body');

  const primaryGap = missing.find((category) => ['top', 'bottom', 'shoes', 'outer', 'bag'].includes(category)) || missing[0] || null;

  return {
    score,
    colorHarmony,
    silhouette,
    layering,
    proportions,
    styleDna,
    missing,
    primaryGap,
    harmonyLabel: colorHarmony >= 82 ? 'Color harmony locked' : colorHarmony >= 64 ? 'Palette balanced' : 'Palette forming',
    silhouetteLabel: silhouette >= 82 ? 'Strong silhouette' : silhouette >= 64 ? 'Studio placement pending' : 'Base silhouette forming',
    balanceLabel: score >= 82 ? 'Editorial balance locked' : score >= 64 ? 'Strong canvas, finish the gaps' : 'Base silhouette forming',
    upgradeNote: primaryGap
      ? `Add ${primaryGap} next to tighten the composition.`
      : 'The board reads balanced. Try a bold variant or save this fit.',
    crowding: {
      upper: upperCount >= 5 ? 'crowded' : upperCount >= 3 ? 'balanced' : 'calm',
      mid: coreCount >= 4 ? 'balanced' : 'calm',
      lower: lowerCount >= 2 ? 'balanced' : 'calm',
    },
  };
}
