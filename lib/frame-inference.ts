import type { Product } from './types';
import type { GeneratorFrame } from './vibes';

export type FrameTag = 'masc' | 'fem' | 'androgynous';

const FEM_ONLY_TERMS = [
  // explicit
  'women', 'womens', 'wmns', 'woman', 'ladies', 'lady', 'girl', 'girls',
  // dresses / skirts
  'mini dress', 'slip dress', 'bodycon dress', 'wrap dress', 'maxi dress', 'midi dress',
  'mini skirt', 'pleated skirt', 'maxi skirt', 'midi skirt', 'skort', 'skirt',
  // tops (women-coded)
  'crop top', 'cropped top', 'cropped cami', 'cropped polo', 'cropped tee', 'cropped', 'crop ',
  'cami tank', 'cami', 'camisole', 'tube top', 'tube dress', 'bandeau', 'halter', 'corset', 'bustier',
  'bodysuit', 'scoop tank', 'scoop neck', 'square neck', 'sweetheart', 'off shoulder', 'one shoulder',
  'wrap top', 'peplum', 'ruched', 'smocked', 'milkmaid', 'baby tee', 'deep plunge', 'plunge top',
  // lingerie / activewear (women)
  'sports bra', 'bralette', 'bra top', 'scoop bra', 'micro scoop bra', 'align tank', 'aspire tank',
  'legging', 'leggings', 'jegging', 'airbrush', 'airlift', 'alosoft', 'biker short', 'micro short', 'booty short',
  // shoes (women)
  'heels', 'heel', 'pumps', 'pump', 'slingback', 'stiletto', 'mule', 'mary jane', 'ballet flat', 'ballerina flat', 'kitten heel', 'espadrille wedge',
  // one-pieces
  'romper', 'playsuit', 'catsuit',
  // women-leaning brands / lines
  'ditsy floral', 'skims', 'aritzia', 'babaton', 'wilfred', 'alo yoga', 'set active', 'reformation',
  'ganni', 'free people', 'varley', 'beyond yoga', 'girlfriend collective', 'outdoor voices',
  'good american', 'spanx', 'princess polly', 'white fox', 'meshki', 'oh polly', 'house of cb',
  'cult gaia', 'staud', 'edikted',
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
  const explicitWomen = hasAny(haystack, ['women', 'womens', 'wmns', 'woman', 'ladies', 'lady', 'female', 'girls', 'girl']);
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
    // Single comprehensive women's signal set (brands + garment terms) — shared with inferProductGender.
    if (hasAny(haystack, FEM_ONLY_TERMS)) {
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
