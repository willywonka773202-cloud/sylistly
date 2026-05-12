import type { Category } from './types';

export type VibeId =
  | 'night'
  | 'street'
  | 'streetwear'
  | 'clean'
  | 'gym'
  | 'athletic'
  | 'cozy'
  | 'date'
  | 'office'
  | 'work'
  | 'vacation'
  | 'travel'
  | 'edgy'
  | 'techwear'
  | 'preppy'
  | 'old-money'
  | 'campus'
  | 'premium';

const VIBE_ALIASES: Record<string, VibeId> = {
  night: 'night', 'night out': 'night', evening: 'night',
  street: 'street', streetwear: 'streetwear', urban: 'streetwear',
  clean: 'clean', minimal: 'clean', minimalist: 'clean', 'clean girl': 'clean',
  gym: 'gym', workout: 'gym',
  athletic: 'athletic', sport: 'athletic', sporty: 'athletic', performance: 'athletic',
  cozy: 'cozy', lounge: 'cozy',
  date: 'date', 'date night': 'date', romantic: 'date',
  office: 'office', business: 'office', 'business casual': 'office',
  work: 'work',
  vacation: 'vacation', resort: 'vacation', beach: 'vacation',
  travel: 'travel', airport: 'travel',
  edgy: 'edgy', dark: 'edgy', goth: 'edgy', punk: 'edgy',
  techwear: 'techwear', technical: 'techwear', utility: 'techwear',
  preppy: 'preppy', collegiate: 'preppy', ivy: 'preppy',
  'old money': 'old-money', 'old-money': 'old-money', 'quiet luxury': 'old-money', heritage: 'old-money',
  campus: 'campus', college: 'campus', class: 'campus',
  premium: 'premium', luxury: 'premium', designer: 'premium', splurge: 'premium',
};

const CANONICAL_VIBE_SET: Set<VibeId> = new Set([
  'night', 'street', 'streetwear', 'clean', 'gym', 'athletic', 'cozy', 'date',
  'office', 'work', 'vacation', 'travel', 'edgy', 'techwear', 'preppy',
  'old-money', 'campus', 'premium',
]);

export function normalizeVibe(value?: string | null): VibeId | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (CANONICAL_VIBE_SET.has(trimmed as VibeId)) return trimmed as VibeId;
  return VIBE_ALIASES[trimmed] ?? null;
}
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
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'street',
    label: 'Streetwear',
    blurb: 'oversized, layered, cool',
    slots: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'clean',
    label: 'Clean',
    blurb: 'minimal, neutral, sharp',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'gym',
    label: 'Gym',
    blurb: 'performance, active, sleek',
    slots: ['top', 'bottom', 'shoes'],
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
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'office',
    label: 'Office',
    blurb: 'tailored, polished, smart',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'vacation',
    label: 'Vacation',
    blurb: 'easy, sunny, destination-ready',
    slots: ['hat', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'edgy',
    label: 'Edgy',
    blurb: 'dark, sharp, statement-forward',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'preppy',
    label: 'Preppy',
    blurb: 'classic, collegiate, refined',
    slots: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'streetwear',
    label: 'Streetwear',
    blurb: 'oversized, layered, modern street',
    slots: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'campus',
    label: 'Campus',
    blurb: 'casual student daily, comfortable, real',
    slots: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'travel',
    label: 'Travel',
    blurb: 'airport-ready, comfortable, sharp',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  },
  {
    id: 'old-money',
    label: 'Old Money',
    blurb: 'quiet luxury, heritage, refined classic',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'techwear',
    label: 'Techwear',
    blurb: 'black, technical, utility, modern',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  },
  {
    id: 'work',
    label: 'Work',
    blurb: 'business casual, polished, professional',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  },
  {
    id: 'athletic',
    label: 'Athletic',
    blurb: 'performance, sporty, gym-to-street',
    slots: ['outer', 'top', 'bottom', 'shoes', 'hat', 'bag'],
  },
  {
    id: 'premium',
    label: 'Premium',
    blurb: 'designer-leaning, splurge, elevated',
    slots: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
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
    case 'streetwear':
      return `streetwear ${piece} oversized modern hype brands${budgetHint}`.trim();
    case 'campus':
      return `${person} ${piece} college campus casual student${budgetHint}`.trim();
    case 'travel':
      return `${person} ${piece} airport travel comfortable polished${budgetHint}`.trim();
    case 'old-money':
      return `${person} ${piece} quiet luxury heritage classic refined${budgetHint}`.trim();
    case 'techwear':
      return `${person} ${piece} techwear technical utility black modern${budgetHint}`.trim();
    case 'work':
      return `${person} ${piece} business casual work tailored polished${budgetHint}`.trim();
    case 'athletic':
      return `${person} ${piece} athletic performance sporty active${budgetHint}`.trim();
    case 'premium':
      return `${person} ${piece} premium designer elevated luxury${budgetHint}`.trim();
    default:
      return `${person} ${piece}${budgetHint}`.trim();
  }
}
