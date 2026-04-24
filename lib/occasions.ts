import type { Category } from './types';
import { 
  Moon, CloudRain, Sun, Flame, Music, Building2, Briefcase, 
  UtensilsCrossed, Plane, Heart, Zap, Crown, Star, Sparkles,
  Shield, Gem, HandHeart, PartyPopper
} from 'lucide-react';

export type OccasionId =
  | 'night'
  | 'street'
  | 'date'
  | 'gym'
  | 'cozy'
  | 'office'
  | 'vacation'
  | 'edgy'
  | 'preppy'
  | 'formal'
  | 'dateright'
  | 'nightlife';

export type StyleScoreType = 
  | 'completeness'
  | 'confidence'
  | 'attractiveness'
  | 'trendiness'
  | 'balance'
  | 'rarity';

export const STYLE_SCORES: Record<StyleScoreType, number> = {
  completeness: 0,
  confidence: 0,
  attractiveness: 0,
  trendiness: 0,
  balance: 0,
  rarity: 0,
};

export type GeneratorBudget = 'any' | 'under100' | 'under250' | 'under500';
export type GeneratorFrame = 'masc' | 'fem' | 'androgynous';

export const OCCASIONS: Array<{
  id: OccasionId;
  label: string;
  blurb: string;
  icon: React.ElementType;
  slots: Category[];
  emoji?: string;
}> = [
  {
    id: 'night',
    label: 'Night Out',
    blurb: 'Polished, fitted, ready for attention',
    icon: Moon,
    slots: ['top', 'bottom', 'shoes', 'bag'],
    emoji: '🌙',
  },
  {
    id: 'street',
    label: 'Streetwear',
    blurb: 'Oversized, layered, cool as hell',
    icon: CloudRain,
    slots: ['hat', 'outer', 'top', 'bottom'],
    emoji: '🔥',
  },
  {
    id: 'date',
    label: 'Date Night',
    blurb: 'Flirty, memorable, confidence on max',
    icon: Heart,
    slots: ['top', 'bottom', 'shoes', 'jewelry'],
    emoji: '💕',
  },
  {
    id: 'gym',
    label: 'Gym Fit',
    blurb: 'Performance, sleek, move ready',
    icon: Zap,
    slots: ['top', 'bottom', 'shoes', 'bag'],
    emoji: '💪',
  },
  {
    id: 'cozy',
    label: 'Cozy Vibes',
    blurb: 'Soft layers, warmth, off-duty mode',
    icon: HandHeart,
    slots: ['outer', 'top', 'bottom', 'shoes'],
    emoji: '🧸',
  },
  {
    id: 'office',
    label: 'Office',
    blurb: 'Tailored, sharp, professional',
    icon: Briefcase,
    slots: ['outer', 'top', 'bottom', 'shoes'],
    emoji: '💼',
  },
  {
    id: 'vacation',
    label: 'Vacation',
    blurb: 'Easy, sunny, destination ready',
    icon: Plane,
    slots: ['hat', 'top', 'bottom', 'bag'],
    emoji: '✈️',
  },
  {
    id: 'edgy',
    label: 'Edgy',
    blurb: 'Dark, sharp, statement forward',
    icon: Sparkles,
    slots: ['outer', 'top', 'bottom', 'shoes'],
    emoji: '⚡',
  },
  {
    id: 'preppy',
    label: 'Preppy',
    blurb: 'Classic, collegiate, refined',
    icon: Star,
    slots: ['outer', 'top', 'bottom', 'shoes'],
    emoji: '🎀',
  },
  {
    id: 'formal',
    label: 'Formal',
    blurb: 'Elegant, timeless, dressed up',
    icon: Crown,
    slots: ['outer', 'top', 'bottom', 'shoes'],
    emoji: '👑',
  },
  {
    id: 'dateright',
    label: 'First Date',
    blurb: 'Make an impression, dress to impress',
    icon: PartyPopper,
    slots: ['top', 'bottom', 'shoes', 'jewelry'],
    emoji: '✨',
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    blurb: 'Turn heads, own the club',
    icon: Music,
    slots: ['top', 'bottom', 'shoes', 'bag'],
    emoji: '🎵',
  },
];

const SLOT_PHRASE: Record<Category, string> = {
  hat: 'hat or cap',
  outer: 'jacket or coat',
  top: 'top or shirt',
  bottom: 'pants or skirt',
  shoes: 'sneakers or shoes',
  bag: 'bag or purse',
  eyewear: 'sunglasses',
  jewelry: 'jewelry or accessory',
};

const BUDGET_HINT: Record<GeneratorBudget, string> = {
  any: '',
  under100: ' under $100',
  under250: ' under $250',
  under500: ' under $500',
};

function framePrefix(frame: GeneratorFrame): string {
  switch (frame) {
    case 'masc': return "men's";
    case 'fem': return "women's";
    default: return 'unisex';
  }
}

export function occasionSearchQuery(
  occasion: OccasionId,
  slot: Category,
  budget: GeneratorBudget = 'any',
  frame: GeneratorFrame = 'androgynous',
): string {
  const piece = SLOT_PHRASE[slot];
  const budgetHint = BUDGET_HINT[budget];
  const person = framePrefix(frame);

  switch (occasion) {
    case 'night':
      return `${person} ${piece} going out night elegant sleek${budgetHint}`.trim();
    case 'street':
      return `streetwear ${piece} urban hype oversized${budgetHint}`.trim();
    case 'date':
      return `${person} ${piece} date romantic attractive${budgetHint}`.trim();
    case 'gym':
      return `${person} ${piece} athletic workout performance${budgetHint}`.trim();
    case 'cozy':
      return `${person} ${piece} cozy soft relaxed warm${budgetHint}`.trim();
    case 'office':
      return `${person} ${piece} office professional tailored${budgetHint}`.trim();
    case 'vacation':
      return `${person} ${piece} resort vacation summer${budgetHint}`.trim();
    case 'edgy':
      return `${person} ${piece} edgy dark statement monochrome${budgetHint}`.trim();
    case 'preppy':
      return `${person} ${piece} preppy classic collegiate${budgetHint}`.trim();
    case 'formal':
      return `${person} ${piece} formal elegant dressy${budgetHint}`.trim();
    case 'dateright':
      return `${person} ${piece} first date impressive stylish${budgetHint}`.trim();
    case 'nightlife':
      return `${person} ${piece} club nightlife party bold${budgetHint}`.trim();
    default:
      return `${person} ${piece}${budgetHint}`.trim();
  }
}

export const LAUNCH_COLLECTIONS = OCCASIONS.map((occasion) => ({
  id: occasion.id,
  label: occasion.label,
  vibe: occasion.id,
  blurb: occasion.blurb,
  emoji: occasion.emoji,
}));