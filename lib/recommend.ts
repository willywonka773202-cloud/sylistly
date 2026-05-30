/**
 * Style DNA engine — the differentiator.
 *
 * Pure functions: learn a preference model from swipes, score/rank outfits against
 * it, and surface human-readable feedback ("You seem to like clean streetwear").
 */
import type { AestheticId, Outfit, StyleDNA } from './social-types';
import type { Category } from './types';
import { getItem } from './data/closet';
import { aestheticLabel } from './style';

const FORMALITY_VALUE: Record<string, number> = { lounge: 1, casual: 2, smart: 3, formal: 4 };
const FORMALITY_NAME = ['', 'lounge', 'casual', 'smart', 'formal'];

export function emptyDNA(): StyleDNA {
  return {
    colors: {},
    categories: {},
    aesthetics: {},
    formalitySum: 0,
    formalityCount: 0,
    likes: 0,
    dislikes: 0,
    superlikes: 0,
    seen: [],
  };
}

function outfitFormalityValue(outfit: Outfit): number {
  const vals = outfit.itemIds
    .map((id) => getItem(id))
    .filter(Boolean)
    .map((i) => FORMALITY_VALUE[i!.formality] ?? 2);
  if (!vals.length) return 2;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const WEIGHTS = { like: 1, superlike: 2.2, dislike: -1.1, save: 1.4 } as const;

/** Pure reducer: fold a swipe into the Style DNA. */
export function applySwipe(
  dna: StyleDNA,
  outfit: Outfit,
  action: 'like' | 'dislike' | 'superlike' | 'save',
): StyleDNA {
  const w = WEIGHTS[action];
  const next: StyleDNA = {
    colors: { ...dna.colors },
    categories: { ...dna.categories },
    aesthetics: { ...dna.aesthetics },
    formalitySum: dna.formalitySum,
    formalityCount: dna.formalityCount,
    likes: dna.likes + (action === 'like' ? 1 : 0),
    dislikes: dna.dislikes + (action === 'dislike' ? 1 : 0),
    superlikes: dna.superlikes + (action === 'superlike' ? 1 : 0),
    seen: dna.seen.includes(outfit.id) ? dna.seen : [...dna.seen, outfit.id],
  };

  for (const a of outfit.aesthetics) {
    next.aesthetics[a] = (next.aesthetics[a] || 0) + w;
  }
  for (const id of outfit.itemIds) {
    const item = getItem(id);
    if (!item) continue;
    next.categories[item.category] = (next.categories[item.category] || 0) + w * 0.5;
    next.colors[item.colorName] = (next.colors[item.colorName] || 0) + w * 0.4;
  }
  if (action !== 'dislike') {
    next.formalitySum += outfitFormalityValue(outfit);
    next.formalityCount += 1;
  }
  return next;
}

/** Higher = better match for this user. */
export function scoreOutfit(outfit: Outfit, dna: StyleDNA): number {
  let score = 0;
  for (const a of outfit.aesthetics) score += (dna.aesthetics[a] || 0) * 1.4;
  for (const id of outfit.itemIds) {
    const item = getItem(id);
    if (!item) continue;
    score += dna.categories[item.category] || 0;
    score += dna.colors[item.colorName] || 0;
  }
  if (dna.formalityCount > 0) {
    const avg = dna.formalitySum / dna.formalityCount;
    score -= Math.abs(outfitFormalityValue(outfit) - avg) * 0.8;
  }
  // gentle popularity prior so early (cold-start) feeds still look great
  score += Math.log10((outfit.likes || 0) + 10) * 0.4;
  return score;
}

export function rankOutfits(outfits: Outfit[], dna: StyleDNA): Outfit[] {
  return [...outfits].sort((a, b) => scoreOutfit(b, dna) - scoreOutfit(a, dna));
}

function topKey<T extends string>(rec: Partial<Record<T, number>>): T | undefined {
  let best: T | undefined;
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(rec) as Array<[T, number]>) {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  }
  return bestVal > 0 ? best : undefined;
}

export interface DnaInsights {
  topAesthetic?: AestheticId;
  topCategory?: Category;
  topColor?: string;
  formality?: string;
  swipes: number;
  progress: number; // 0..1 toward a "trained" profile
  messages: string[];
}

const TRAIN_TARGET = 12;

export function dnaInsights(dna: StyleDNA): DnaInsights {
  const swipes = dna.likes + dna.dislikes + dna.superlikes;
  const topAesthetic = topKey(dna.aesthetics);
  const topCategory = topKey(dna.categories) as Category | undefined;
  const topColor = topKey(dna.colors);
  const formality =
    dna.formalityCount > 0 ? FORMALITY_NAME[Math.round(dna.formalitySum / dna.formalityCount)] : undefined;

  const messages: string[] = [];
  if (topAesthetic) messages.push(`You're leaning ${aestheticLabel(topAesthetic).toLowerCase()}`);
  if (topColor) messages.push(`More ${topColor.toLowerCase()} pieces coming your way`);
  if (formality) messages.push(`Tuned to ${formality} fits`);
  if (dna.dislikes > dna.likes && dna.dislikes >= 3) messages.push(`We'll show fewer of those`);
  if (!messages.length) messages.push('Swipe a few looks to train your Style DNA');

  return {
    topAesthetic,
    topCategory,
    topColor,
    formality,
    swipes,
    progress: Math.min(1, swipes / TRAIN_TARGET),
    messages,
  };
}

