import type { Category } from './types';

export type VibeId = 'night' | 'street' | 'clean' | 'gym' | 'cozy';
export type GeneratorBudget = 'any' | 'under100' | 'under250' | 'under500';

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

const BUDGET_HINT: Record<GeneratorBudget, string> = {
  any: '',
  under100: ' under $100',
  under250: ' under $250',
  under500: ' under $500',
};

export function vibeSearchQuery(vibe: VibeId, slot: Category, budget: GeneratorBudget = 'any'): string {
  const piece = SLOT_PHRASE[slot];
  const budgetHint = BUDGET_HINT[budget];

  switch (vibe) {
    case 'night':
      return `women's ${piece} going out night out elegant designer${budgetHint}`.trim();
    case 'street':
      return `streetwear ${piece} urban oversized hype brands${budgetHint}`.trim();
    case 'clean':
      return `minimal aesthetic ${piece} quiet luxury neutral tones${budgetHint}`.trim();
    case 'gym':
      return `athletic ${piece} performance training workout${budgetHint}`.trim();
    case 'cozy':
      return `cozy relaxed ${piece} soft loungewear warm${budgetHint}`.trim();
    default:
      return `${piece}${budgetHint}`.trim();
  }
}
