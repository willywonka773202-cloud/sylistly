import type { Product, SearchIntent } from './types';

type Presentation = 'masc' | 'fem' | 'neutral';

const FEM_TERMS = [
  'women',
  'womens',
  'womenswear',
  'female',
  'skims',
  'aritzia',
  'alo',
  'mejuri',
  'missoma',
  'quay',
  'steve madden',
  'swarovski',
  'pandora',
  'kendra scott',
  'coach',
  'zara',
  'corset',
  'bodysuit',
  'skirt',
  'slip skirt',
  'midi',
  'heel',
  'heels',
  'pump',
  'slingback',
  'huggie',
  'hoop',
  'earrings',
  'pearl',
  'tabby',
  'shoulder bag',
  'purse',
  'super puff',
  'align',
  'finesse',
  'contour',
  'cat eye',
];

const MASC_TERMS = [
  'men',
  'mens',
  'menswear',
  'male',
  'dickies',
  'carhartt',
  'new era',
  'ralph lauren',
  'polo ralph lauren',
  'stussy',
  'arc teryx',
  'jordan',
  'work pants',
  'oxford',
  'button down',
  'boxy',
  'polo',
  'trucker',
  'jogger',
  'watch',
  'chain',
  'loafers',
  'boots',
  'overcoat',
  'bomber',
  'detroit jacket',
  '874',
];

const NEUTRAL_TERMS = [
  'unisex',
  'androgynous',
  'sneaker',
  'sneakers',
  'samba',
  'air force',
  'hoodie',
  'tee',
  't shirt',
  'denim',
  'cap',
  'beanie',
  'bucket',
  'tote',
  'sunglasses',
  'wayfarer',
  'clog',
];

const LIGHT_BIAS_CATEGORIES = new Set(['hat', 'bag', 'eyewear', 'jewelry']);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readString(value: unknown): string[] {
  return typeof value === 'string' ? [value] : [];
}

function hasAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(normalize(term)));
}

export function productSearchText(product: Product): string {
  return normalize([
    product.brand,
    product.name,
    product.retailer,
    ...readStringArray(product.metadata?.colors),
    ...readStringArray(product.metadata?.styles),
    ...readStringArray(product.metadata?.vibes),
    ...readStringArray(product.metadata?.keywords),
    ...readStringArray(product.metadata?.gender),
    ...readStringArray(product.metadata?.presentation),
    ...readString(product.metadata?.gender),
    ...readString(product.metadata?.presentation),
  ].join(' '));
}

export function inferProductPresentation(product: Product): Set<Presentation> {
  const haystack = productSearchText(product);
  const result = new Set<Presentation>();

  if (hasAny(haystack, FEM_TERMS)) result.add('fem');
  if (hasAny(haystack, MASC_TERMS)) result.add('masc');
  if (hasAny(haystack, NEUTRAL_TERMS)) result.add('neutral');

  if (!result.size) result.add('neutral');
  return result;
}

export function presentationScore(product: Product, intent: SearchIntent): number {
  if (!intent.gender || intent.gender === 'androgynous') return 0;

  const inferred = inferProductPresentation(product);
  const isLightBias = LIGHT_BIAS_CATEGORIES.has(product.category);
  const matchBoost = isLightBias ? 7 : 20;
  const neutralBoost = isLightBias ? 4 : 6;
  const mismatchPenalty = isLightBias ? 4 : 18;

  if (intent.gender === 'masc') {
    let score = 0;
    if (inferred.has('masc')) score += matchBoost;
    if (inferred.has('neutral')) score += neutralBoost;
    if (inferred.has('fem') && !inferred.has('masc')) score -= mismatchPenalty;
    return score;
  }

  let score = 0;
  if (inferred.has('fem')) score += matchBoost;
  if (inferred.has('neutral')) score += neutralBoost;
  if (inferred.has('masc') && !inferred.has('fem')) score -= mismatchPenalty;
  return score;
}
