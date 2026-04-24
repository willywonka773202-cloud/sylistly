import type { Category } from './types';
import { OCCASIONS, occasionSearchQuery, type GeneratorBudget, type GeneratorFrame, type OccasionId } from './occasions';

export type VibeId = OccasionId;
export { OCCASIONS };
export type { GeneratorBudget, GeneratorFrame };

export { occasionSearchQuery };

export function getVibeSearchQuery(
  vibe: VibeId,
  slot: Category,
  budget: GeneratorBudget = 'any',
  frame: GeneratorFrame = 'androgynous',
): string {
  return occasionSearchQuery(vibe, slot, budget, frame);
}

const VIBES = OCCASIONS;

export { VIBES };

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

function framePrefix(frame: GeneratorFrame): string {
  switch (frame) {
    case 'masc': return "men's";
    case 'fem': return "women's";
    default: return 'unisex';
  }
}

export function vibeSearchQuery(
  vibe: VibeId,
  slot: Category,
  budget: GeneratorBudget = 'any',
  frame: GeneratorFrame = 'androgynous',
): string {
  return occasionSearchQuery(vibe, slot, budget, frame);
}