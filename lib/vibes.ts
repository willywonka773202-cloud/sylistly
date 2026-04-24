import type { Category } from './types';

export type VibeId =
  | 'night'
  | 'street'
  | 'clean'
  | 'gym'
  | 'cozy'
  | 'date'
  | 'office'
  | 'vacation'
  | 'edgy'
  | 'preppy';
export type GeneratorBudget = 'any' | 'under100' | 'under250' | 'under500' | 'custom';
export type GeneratorFrame = 'masc' | 'fem' | 'androgynous';

const BUDGET_HINT: Record<Exclude<GeneratorBudget, 'custom'>, string> = {
  any: '',
  under100: ' under $100',
  under250: ' under $250',
  under500: ' under $500',
};

export function getBudgetMaxCents(
  budget: GeneratorBudget,
  customMaxCents?: number | null,
): number {
  if (budget === 'under100') return 10_000;
  if (budget === 'under250') return 25_000;
  if (budget === 'under500') return 50_000;
  if (budget === 'custom') return Math.max(0, customMaxCents || 0);
  return Number.POSITIVE_INFINITY;
}

export function getBudgetHint(
  budget: GeneratorBudget,
  customMaxCents?: number | null,
): string {
  if (budget === 'custom' && customMaxCents && customMaxCents > 0) {
    return ` under $${Math.round(customMaxCents / 100)}`;
  }

  if (budget === 'custom') return '';
  return BUDGET_HINT[budget];
}

export const VIBES: Array<{
  id: VibeId;
  label: string;
  blurb: string;
  slots: Category[];
}> = [
  {
    id: 'night',
    label: 'Night out',
    blurb: 'polished, fitted, elevated',
    slots: ['top', 'bottom', 'shoes', 'bag'],
  },
  {
    id: 'street',
    label: 'Streetwear',
    blurb: 'oversized, layered, cool',
    slots: ['hat', 'outer', 'top', 'bottom'],
  },
  {
    id: 'clean',
    label: 'Clean',
    blurb: 'minimal, neutral, sharp',
    slots: ['top', 'bottom', 'shoes', 'bag'],
  },
  {
    id: 'gym',
    label: 'Gym',
    blurb: 'performance, active, sleek',
    slots: ['top', 'bottom', 'shoes', 'bag'],
  },
  {
    id: 'cozy',
    label: 'Cozy',
    blurb: 'soft layers, relaxed, warm',
    slots: ['outer', 'top', 'bottom', 'shoes'],
  },
  {
    id: 'date',
    label: 'Date night',
    blurb: 'flirty, elevated, memorable',
    slots: ['top', 'bottom', 'shoes', 'jewelry'],
  },
  {
    id: 'office',
    label: 'Office',
    blurb: 'tailored, polished, smart',
    slots: ['outer', 'top', 'bottom', 'shoes'],
  },
  {
    id: 'vacation',
    label: 'Vacation',
    blurb: 'easy, sunny, destination-ready',
    slots: ['hat', 'top', 'bottom', 'bag'],
  },
  {
    id: 'edgy',
    label: 'Edgy',
    blurb: 'dark, sharp, statement-forward',
    slots: ['outer', 'top', 'bottom', 'shoes'],
  },
  {
    id: 'preppy',
    label: 'Preppy',
    blurb: 'classic, collegiate, refined',
    slots: ['outer', 'top', 'bottom', 'shoes'],
  },
];

const SLOT_PHRASE: Record<Category, string> = {
  hat: 'hat or cap',
  outer: 'jacket or coat',
  top: 'top or shirt',
  bottom: 'pants, jeans, or skirt',
  shoes: 'sneakers or shoes',
  bag: 'bag or purse',
  eyewear: 'sunglasses or glasses',
  jewelry: 'necklace, earrings, or bracelet',
};

function framePrefix(frame: GeneratorFrame): string {
  switch (frame) {
    case 'masc':
      return "men's";
    case 'fem':
      return "women's";
    default:
      return 'unisex';
  }
}

export function vibeSearchQuery(
  vibe: VibeId,
  slot: Category,
  budget: GeneratorBudget = 'any',
  frame: GeneratorFrame = 'androgynous',
  customMaxCents?: number | null,
): string {
  const piece = SLOT_PHRASE[slot];
  const budgetHint = getBudgetHint(budget, customMaxCents);
  const person = framePrefix(frame);

  switch (vibe) {
    case 'night':
      return `${person} ${piece} going out night out elegant designer${budgetHint}`.trim();
    case 'street':
      return `streetwear ${piece} urban oversized hype brands${budgetHint}`.trim();
    case 'clean':
      return `${person} minimal aesthetic ${piece} quiet luxury neutral tones${budgetHint}`.trim();
    case 'gym':
      return `${person} athletic ${piece} performance training workout${budgetHint}`.trim();
    case 'cozy':
      return `${person} cozy relaxed ${piece} soft loungewear warm${budgetHint}`.trim();
    case 'date':
      return `${person} ${piece} date night romantic polished${budgetHint}`.trim();
    case 'office':
      return `${person} ${piece} office wear tailored smart casual${budgetHint}`.trim();
    case 'vacation':
      return `${person} ${piece} resort vacation summer effortless${budgetHint}`.trim();
    case 'edgy':
      return `${person} ${piece} edgy dark monochrome statement${budgetHint}`.trim();
    case 'preppy':
      return `${person} ${piece} preppy classic collegiate polished${budgetHint}`.trim();
    default:
      return `${person} ${piece}${budgetHint}`.trim();
  }
}
