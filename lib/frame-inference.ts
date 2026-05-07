import type { Product } from './types';
import type { GeneratorFrame } from './vibes';

export type FrameTag = 'masc' | 'fem' | 'androgynous';

const FEM_ONLY_TERMS = [
  'women', 'womens', 'woman', 'ladies', 'lady', 'girl', 'girls',
  'mini dress', 'slip dress', 'bodycon dress', 'maxi dress', 'midi dress',
  'mini skirt', 'pleated skirt', 'slip skirt', 'skirt',
  'heels', 'heel', 'pumps', 'pump', 'stiletto', 'kitten heel',
  'sports bra', 'bralette', 'bra ', 'crop top', 'cropped cami', 'cami tank',
  'align tank', 'baby tee', 'tube top', 'bodysuit', 'corset', 'ballet flat',
];

const MASC_ONLY_TERMS = [
  'men', 'mens', 'man', 'male', 'dress shirt men', 'button down men',
  'mens loafers', 'mens boots', 'mens trousers', 'boxer', 'men athletic shorts',
];

const ANDROGYNOUS_TERMS = [
  'unisex', 'hoodie', 'sweatshirt', 'tee', 't shirt', 't-shirt', 'sneaker',
  'sneakers', 'cap', 'beanie', 'cargo', 'jeans', 'denim jacket', 'puffer',
  'bomber', 'backpack', 'sunglasses', 'tote', 'crossbody', 'converse', 'vans',
  'nike', 'adidas', 'new balance', 'asics', 'uniqlo',
];

const FEM_ANDROGYNOUS_TERMS = [
  'purse', 'handbag', 'shoulder bag', 'earrings', 'earring', 'necklace',
  'bracelet', 'mini bag', 'tote',
];

const MASC_ANDROGYNOUS_TERMS = [
  'chain necklace', 'silver chain', 'polo', 'chinos', 'blazer', 'loafers',
  'boots', 'trousers', 'button down',
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function metadataList(product: Product, key: string): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function hasAny(haystack: string, terms: string[]): boolean {
  const padded = ` ${haystack} `;
  return terms.some((term) => padded.includes(` ${normalize(term)} `));
}

export function productFrameHaystack(product: Product): string {
  return normalize([
    product.category,
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.colors || []),
    ...(product.searchTerms || []),
    ...metadataList(product, 'gender'),
    ...metadataList(product, 'vibes'),
    ...metadataList(product, 'styles'),
    ...metadataList(product, 'keywords'),
    ...metadataList(product, 'searchTerms'),
    ...metadataList(product, 'colors'),
  ].join(' '));
}

export function inferProductGender(product: Product): FrameTag[] {
  const haystack = productFrameHaystack(product);
  const explicitWomen = hasAny(haystack, ['women', 'womens', 'woman', 'ladies', 'lady', 'female', 'girls', 'girl']);
  const explicitMen = hasAny(haystack, ['men', 'mens', 'man', 'male']);
  const femOnly = explicitWomen || hasAny(haystack, FEM_ONLY_TERMS);
  const mascOnly = explicitMen || hasAny(haystack, MASC_ONLY_TERMS);
  const androgynous = hasAny(haystack, ANDROGYNOUS_TERMS);
  const femAndrogynous = product.category === 'bag' || product.category === 'jewelry' || hasAny(haystack, FEM_ANDROGYNOUS_TERMS);
  const mascAndrogynous = hasAny(haystack, MASC_ANDROGYNOUS_TERMS);

  if (explicitWomen && !androgynous) return ['fem'];
  if (explicitMen && !androgynous) return ['masc'];
  if (femOnly && !mascOnly) return femAndrogynous ? ['fem', 'androgynous'] : ['fem'];
  if (mascOnly && !femOnly) return mascAndrogynous ? ['masc', 'androgynous'] : ['masc'];
  if (androgynous) return ['androgynous'];
  if (femAndrogynous) return ['fem', 'androgynous'];

  if (product.category === 'eyewear' || product.category === 'hat' || product.category === 'shoes') {
    return ['androgynous'];
  }

  return ['androgynous'];
}

export function productGenderTags(product: Product): FrameTag[] {
  const explicit = [
    ...(product.gender || []),
    ...metadataList(product, 'gender'),
  ].filter((tag): tag is FrameTag => tag === 'masc' || tag === 'fem' || tag === 'androgynous');

  return Array.from(new Set(explicit.length ? explicit : inferProductGender(product)));
}

export function genderMismatchReasons(product: Product, requestedFrame: GeneratorFrame): string[] {
  if (requestedFrame === 'androgynous') return [];
  const haystack = productFrameHaystack(product);
  const tags = productGenderTags(product);
  const reasons: string[] = [];

  if (requestedFrame === 'masc') {
    if (tags.includes('fem') && !tags.includes('androgynous') && !tags.includes('masc')) reasons.push('fem-only tag');
    if (hasAny(haystack, ['women', 'womens', 'ladies', 'mini dress', 'slip dress', 'midi dress', 'maxi dress', 'skirt', 'sports bra', 'bralette', 'bodysuit', 'heels', 'pumps', 'stiletto', 'kitten heel', 'baby tee', 'tube top', 'cami tank', 'align tank', 'cropped cami'])) {
      reasons.push('obvious fem keyword');
    }
  }

  if (requestedFrame === 'fem') {
    if (tags.includes('masc') && !tags.includes('androgynous') && !tags.includes('fem')) reasons.push('masc-only tag');
    if (hasAny(haystack, [' men ', ' mens ', 'male', 'boxer'])) reasons.push('obvious masc keyword');
  }

  return Array.from(new Set(reasons));
}

export function hasFrameMismatch(product: Product, requestedFrame: GeneratorFrame): boolean {
  return genderMismatchReasons(product, requestedFrame).length > 0;
}

export function frameCompatibilityScore(product: Product, requestedFrame: GeneratorFrame): number {
  const tags = productGenderTags(product);

  if (requestedFrame === 'androgynous') {
    if (tags.includes('androgynous')) return 24;
    if (tags.length === 1) return 4;
    return 10;
  }

  if (hasFrameMismatch(product, requestedFrame)) return -220;
  if (tags.includes(requestedFrame)) return 42;
  if (tags.includes('androgynous')) return 26;

  return -90;
}
