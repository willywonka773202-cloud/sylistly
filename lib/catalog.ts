import { BRAND_CATALOG_PRODUCTS } from './brand-catalog';
import { parseSearchIntentHeuristic, rerankProducts } from './claude';
import { GENERATED_CATALOG_PRODUCTS } from './generated-catalog';
import { PHOTO_CATALOG_PRODUCTS } from './photo-catalog';
import { presentationScore } from './presentation-score';
import { hasDirectRetailerUrl } from './retailer-url';
import { searchBrandCatalog } from './brand-catalog';
import { searchPhotoCatalog } from './photo-catalog';
import { applyCatalogTagOverridesToProducts } from './catalog-tag-overrides';
import { frameCompatibilityScore, hasFrameMismatch } from './frame-inference';
import { hasUsableProductImage, isRenderableProduct } from './product-image-quality';
import { CATEGORY_ORDER, type Category, type Product, type SearchIntent } from './types';
import {
  VIBES,
  getBudgetMaxCents,
  vibeSearchQuery,
  type GeneratorBudget,
  type GeneratorFrame,
  type VibeId,
} from './vibes';

type CollectionFrame = GeneratorFrame | 'all';
type OutfitRecipe = {
  required: Category[];
  optional: Category[];
  prefer: string[];
  avoid: string[];
  colors: string[];
  jewelry: 'strong' | 'optional' | 'avoid';
  eyewear: 'strong' | 'optional' | 'avoid';
};

type QualityRule = {
  prefer?: string[];
  avoid?: string[];
  hardAvoid?: string[];
};

type SlotQualityRules = Partial<Record<Category | 'all', QualityRule>>;

export interface CatalogCollection {
  id: string;
  label: string;
  vibe: VibeId;
  frame: CollectionFrame;
  blurb: string;
  queryHint: string;
  productIds: string[];
}

const VIBE_TERMS: Record<VibeId, string[]> = {
  night: ['night out', 'night', 'going out', 'dressy', 'glam', 'date', 'black', 'leather', 'satin', 'heel', 'loafers', 'mini bag', 'jewelry'],
  street: ['streetwear', 'college', 'casual', 'workwear', 'retro', 'sporty', 'hoodie', 'cargo', 'cap', 'sneaker', 'baggy', 'graphic', 'denim'],
  clean: ['clean', 'minimal', 'minimalist', 'classic', 'quiet luxury', 'neutral', 'black', 'white', 'cream', 'beige', 'grey', 'navy', 'simple'],
  gym: ['gym', 'athletic', 'sporty', 'performance', 'wellness', 'training', 'running', 'workout', 'legging', 'shorts'],
  cozy: ['cozy', 'winter', 'casual', 'soft', 'puffer', 'knit', 'hoodie', 'sweatpants', 'boot', 'beanie'],
  date: ['date', 'night out', 'dressy', 'feminine', 'black', 'leather', 'satin', 'heel', 'loafers', 'jewelry', 'small bag'],
  office: ['office', 'work', 'tailored', 'smart', 'business casual', 'blazer', 'trouser', 'loafers', 'button down', 'tote'],
  vacation: ['vacation', 'summer', 'resort', 'coastal', 'beach', 'linen', 'sandal', 'sunglasses', 'straw', 'tote', 'shorts'],
  edgy: ['edgy', 'dark', 'grunge', 'statement', 'techwear', 'black', 'leather', 'cargo', 'boot', 'shell jacket', 'crossbody'],
  preppy: ['preppy', 'old money', 'classic', 'collegiate', 'smart', 'polo', 'cardigan', 'sweater', 'chinos', 'loafers', 'pleated', 'sunglasses'],
};

const VIBE_TAG_ALIASES: Record<VibeId, string[]> = {
  night: ['night', 'date', 'luxury', 'edgy'],
  street: ['streetwear', 'street', 'college', 'casual', 'y2k'],
  clean: ['clean', 'minimal', 'minimalist', 'casual', 'luxury'],
  gym: ['gym', 'athletic', 'sporty', 'workout'],
  cozy: ['cozy', 'winter', 'casual'],
  date: ['date', 'night', 'luxury'],
  office: ['office', 'business casual', 'old money', 'preppy'],
  vacation: ['vacation', 'beach', 'summer'],
  edgy: ['edgy', 'techwear', 'night'],
  preppy: ['preppy', 'old money', 'business casual', 'college', 'luxury'],
};

const OUTFIT_RECIPES: Record<VibeId, OutfitRecipe> = {
  clean: {
    required: ['top', 'bottom', 'shoes'],
    optional: ['outer', 'bag', 'eyewear'],
    prefer: ['plain', 'minimal', 'neutral', 'white', 'black', 'cream', 'beige', 'grey', 'trouser', 'tee', 'sneaker', 'loafer'],
    avoid: ['graphic', 'neon', 'western', 'gym', 'techwear', 'logo'],
    colors: ['black', 'white', 'cream', 'beige', 'grey', 'gray', 'navy', 'brown'],
    jewelry: 'optional',
    eyewear: 'optional',
  },
  street: {
    required: ['top', 'bottom', 'shoes'],
    optional: ['outer', 'hat', 'bag', 'eyewear', 'jewelry'],
    prefer: ['hoodie', 'cargo', 'denim', 'oversized', 'cap', 'sneaker', 'graphic', 'bomber', 'crossbody', 'baggy', 'chain', 'silver', 'jewelry'],
    avoid: ['blazer', 'heels', 'office', 'formal', 'pumps'],
    colors: ['black', 'white', 'grey', 'gray', 'navy', 'green', 'brown'],
    jewelry: 'strong',
    eyewear: 'strong',
  },
  night: {
    required: ['top', 'bottom', 'shoes', 'bag'],
    optional: ['outer', 'jewelry', 'eyewear'],
    prefer: ['black', 'leather', 'satin', 'sleek', 'dressy', 'heel', 'loafer', 'shoulder bag', 'chain', 'jewelry'],
    avoid: ['gym', 'running', 'sweatpants', 'beach', 'linen', 'puffer', 'cargo', 'hiking', 'work pants', 'beanie'],
    colors: ['black', 'white', 'silver', 'gold', 'cream', 'burgundy'],
    jewelry: 'strong',
    eyewear: 'optional',
  },
  date: {
    required: ['top', 'bottom', 'shoes', 'bag'],
    optional: ['outer', 'jewelry', 'eyewear'],
    prefer: ['black', 'leather', 'satin', 'sleek', 'dressy', 'heel', 'loafer', 'shoulder bag', 'chain', 'jewelry'],
    avoid: ['gym', 'running', 'sweatpants', 'beach', 'linen', 'cargo', 'hiking', 'beanie'],
    colors: ['black', 'white', 'cream', 'silver', 'gold', 'brown'],
    jewelry: 'strong',
    eyewear: 'optional',
  },
  gym: {
    required: ['top', 'bottom', 'shoes'],
    optional: ['outer', 'hat', 'bag'],
    prefer: ['training', 'running', 'workout', 'gym', 'shorts', 'leggings', 'sportswear', 'performance', 'nike', 'adidas', 'lululemon'],
    avoid: ['blazer', 'dress', 'loafers', 'leather jacket', 'heel', 'pumps'],
    colors: ['black', 'white', 'grey', 'gray', 'navy'],
    jewelry: 'avoid',
    eyewear: 'avoid',
  },
  office: {
    required: ['top', 'bottom', 'shoes'],
    optional: ['outer', 'bag', 'jewelry'],
    prefer: ['blazer', 'trouser', 'button down', 'polo', 'loafer', 'cardigan', 'tote', 'work bag', 'chino', 'tailored'],
    avoid: ['gym', 'beach', 'cargo', 'graphic', 'running', 'sweatpants', 'puffer', 'track', 'western', 'cowboy'],
    colors: ['black', 'white', 'cream', 'beige', 'grey', 'gray', 'navy', 'brown'],
    jewelry: 'optional',
    eyewear: 'optional',
  },
  vacation: {
    required: ['top', 'bottom', 'shoes'],
    optional: ['hat', 'eyewear', 'bag', 'jewelry'],
    prefer: ['linen', 'shorts', 'sandals', 'sunglasses', 'tote', 'straw', 'breathable', 'resort', 'beach'],
    avoid: ['puffer', 'winter', 'boots', 'office', 'wool', 'fleece', 'techwear', 'cargo'],
    colors: ['white', 'cream', 'beige', 'tan', 'blue', 'brown'],
    jewelry: 'optional',
    eyewear: 'strong',
  },
  cozy: {
    required: ['top', 'bottom', 'shoes', 'outer'],
    optional: ['hat', 'bag'],
    prefer: ['puffer', 'knit', 'sweater', 'hoodie', 'sweatpants', 'boots', 'beanie', 'fleece'],
    avoid: ['sandals', 'linen', 'beach', 'heel', 'pumps'],
    colors: ['black', 'white', 'cream', 'beige', 'grey', 'gray', 'brown', 'navy'],
    jewelry: 'avoid',
    eyewear: 'avoid',
  },
  preppy: {
    required: ['top', 'bottom', 'shoes'],
    optional: ['outer', 'eyewear', 'jewelry', 'bag', 'hat'],
    prefer: ['polo', 'cardigan', 'sweater', 'chinos', 'loafer', 'pleated', 'blazer', 'ralph lauren', 'cable knit'],
    avoid: ['techwear', 'cargo', 'graphic', 'gym', 'running', 'puffer', 'cowboy', 'western'],
    colors: ['white', 'cream', 'beige', 'navy', 'brown', 'black', 'grey'],
    jewelry: 'strong',
    eyewear: 'strong',
  },
  edgy: {
    required: ['top', 'bottom', 'shoes'],
    optional: ['outer', 'bag', 'eyewear', 'jewelry'],
    prefer: ['black', 'leather', 'cargo', 'boot', 'shell', 'crossbody', 'silver', 'utility', 'techwear', 'chain', 'ring', 'jewelry'],
    avoid: ['beach', 'linen', 'old money', 'preppy', 'sandals'],
    colors: ['black', 'grey', 'gray', 'silver', 'white'],
    jewelry: 'strong',
    eyewear: 'optional',
  },
};

const FRAME_AVOID_TERMS: Record<GeneratorFrame, string[]> = {
  masc: ['skirt', 'heel', 'bodysuit', 'corset', 'cat eye', 'pearl'],
  fem: ['work pants'],
  androgynous: [],
};

const MISSING_SLOT_PRIORITY: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'eyewear', 'jewelry', 'hat'];
const REFRESH_ACCESSORY_SLOTS: Category[] = ['bag', 'eyewear', 'jewelry'];
const CONDITIONAL_ACCESSORY_SLOTS = new Set<Category>(['hat', 'eyewear', 'jewelry']);
const STRICT_CATEGORY_PREFERENCE_VIBES = new Set<VibeId>(['gym', 'office', 'vacation', 'night', 'date']);
const DEBUG_GENERATOR = process.env.DEBUG_GENERATOR === '1';

const DEFAULT_ACCESSORY_RATES: Record<VibeId, Partial<Record<Category, number>>> = {
  clean: { eyewear: 0.35, jewelry: 0.08 },
  street: { hat: 0.7, eyewear: 0.75, jewelry: 0.45 },
  night: { eyewear: 0.3, jewelry: 0.82 },
  date: { eyewear: 0.25, jewelry: 0.82 },
  gym: { hat: 0.55, eyewear: 0.04, jewelry: 0 },
  cozy: { hat: 0.75, eyewear: 0.05, jewelry: 0.04 },
  office: { eyewear: 0.1, jewelry: 0.28 },
  vacation: { hat: 0.5, eyewear: 0.78, jewelry: 0.24 },
  preppy: { hat: 0.35, eyewear: 0.72, jewelry: 0.36 },
  edgy: { eyewear: 0.58, jewelry: 0.75 },
};

const VIBE_QUALITY_RULES: Record<VibeId, SlotQualityRules> = {
  gym: {
    all: {
      prefer: ['gym', 'training', 'running', 'workout', 'performance', 'athletic', 'sport'],
      hardAvoid: ['blazer', 'trench', 'suit', 'loafer', 'dress pants', 'work pants', 'cardigan', 'heels', 'pumps', 'leather shoulder bag', 'luxury handbag', 'ugg'],
    },
    outer: {
      prefer: ['hoodie', 'track jacket', 'training jacket', 'performance jacket', 'fleece', 'zip', 'windbreaker'],
      hardAvoid: ['trench', 'blazer', 'suit jacket', 'sport coat', 'leather jacket', 'cardigan', 'detroit jacket', 'duck', 'carhartt', 'techwear', 'futuristic'],
    },
    bottom: {
      prefer: ['shorts', 'leggings', 'jogger', 'sweatpant', 'track pant', 'training', 'running'],
      hardAvoid: ['dress pant', 'work pants', 'trouser', 'chino', 'jean', 'cargo work'],
    },
    shoes: {
      prefer: ['running', 'training', 'trainer', 'sneaker', 'basketball', 'workout'],
      hardAvoid: ['boot', 'clog', 'heel', 'loafer', 'sandal', 'ugg', 'samba', 'campus', 'gazelle', 'air force', 'af1', 'converse', 'chuck'],
    },
    bag: {
      prefer: ['duffel', 'backpack', 'gym bag', 'training bag', 'tote'],
      hardAvoid: ['super puff', 'longchamp', 'michael kors', 'straw'],
      avoid: ['tabby', 'purse', 'evening bag', 'mini bag', 'saint laurent'],
    },
    top: {
      prefer: ['training', 'workout', 'running', 'performance', 'sports bra', 'tank', 'tee', 'mesh', 'airism'],
      hardAvoid: ['sweater polo', 'button down', 'cardigan', 'blazer', 'dress shirt', 'oxford', 'cable knit', 'winter bliss'],
    },
    jewelry: { hardAvoid: ['necklace', 'earring', 'bracelet', 'ring', 'chain', 'pendant', 'jewelry'] },
  },
  office: {
    all: {
      prefer: ['office', 'tailored', 'business casual', 'smart', 'polished'],
      hardAvoid: ['track jacket', 'sweatpants', 'cargo pants', 'gym shorts', 'running shoes', 'ugg', 'graphic tee', 'training', 'workout'],
    },
    outer: {
      prefer: ['blazer', 'cardigan', 'trench', 'coat', 'tailored', 'overshirt'],
      hardAvoid: ['track jacket', 'hoodie', 'puffer', 'shell jacket', 'firebird'],
    },
    top: {
      prefer: ['button down', 'shirt', 'polo', 'sweater', 'knit', 'blouse'],
      hardAvoid: ['graphic tee', 'tank', 'sports bra', 'workout', 'training'],
    },
    bottom: {
      prefer: ['trouser', 'chino', 'tailored', 'pant', 'pleated'],
      hardAvoid: ['cargo', 'sweatpant', 'shorts', 'legging', 'track pant', 'work pants'],
    },
    shoes: {
      prefer: ['loafer', 'flat', 'dress shoe', 'chelsea', 'oxford', 'ballet', 'wallabee'],
      hardAvoid: ['ugg', 'running', 'training', 'hiking', 'chunky sneaker', 'basketball', 'dr martens', 'doc martens', 'samba', 'campus', 'birkenstock', 'clog'],
    },
    bag: {
      prefer: ['tote', 'work bag', 'brief', 'crossbody', 'satchel'],
      hardAvoid: ['belt bag', 'gym bag', 'backpack'],
      avoid: ['evening bag', 'mini bag', 'tabby'],
    },
  },
  vacation: {
    all: {
      prefer: ['linen', 'summer', 'resort', 'vacation', 'beach', 'sandal', 'straw', 'sunglasses'],
      hardAvoid: ['beanie', 'puffer', 'heavy boot', 'winter coat', 'trench coat', 'tech shell', 'shell jacket', 'work pants', 'fleece', 'wool coat', 'arcteryx', 'arc teryx', 'atom jacket', 'beta lt'],
    },
    top: {
      prefer: ['linen', 'tank', 'tee', 'shirt', 'camp collar', 'resort', 'beach', 'cotton'],
      hardAvoid: ['cardigan', 'sweater', 'hoodie', 'thermal', 'performance', 'workout'],
    },
    outer: {
      prefer: ['linen', 'shirt', 'overshirt', 'lightweight'],
      hardAvoid: ['puffer', 'trench', 'wool', 'fleece', 'shell jacket', 'winter coat'],
    },
    bottom: {
      prefer: ['shorts', 'linen pant', 'easy pant', 'skirt'],
      hardAvoid: ['work pants', 'wool trouser', 'fleece', 'sweatpant', 'double knee', 'duck pant', 'cargo pant'],
    },
    shoes: {
      prefer: ['sandal', 'slide', 'espadrille', 'sneaker', 'loafer'],
      hardAvoid: ['heavy boot', 'winter boot', 'ugg', 'hiking boot'],
    },
    hat: {
      prefer: ['straw', 'bucket', 'cap', 'sun hat'],
      hardAvoid: ['beanie'],
    },
    bag: {
      prefer: ['tote', 'straw', 'canvas', 'beach bag', 'shoulder bag'],
      hardAvoid: ['cassette', 'tech cassette', 'belt bag', 'dress size', 'hat and jewelry set'],
    },
    jewelry: {
      prefer: ['bracelet', 'necklace', 'earring', 'ring', 'gold', 'shell'],
      avoid: ['tennis necklace', 'matrix'],
    },
  },
  night: {
    all: {
      prefer: ['night out', 'dressy', 'sleek', 'black', 'leather', 'satin', 'polished'],
      hardAvoid: ['work pants', 'cargo work', 'hiking', 'technical shell', 'shell jacket', 'running shoe', 'training shoe', 'ugg', 'beanie', 'sweatpants', 'arcteryx', 'arc teryx', 'atom jacket', 'beta lt', 'track jacket', 'firebird'],
    },
    outer: {
      prefer: ['leather', 'blazer', 'jacket', 'tailored', 'bomber'],
      hardAvoid: ['hiking', 'technical', 'shell jacket', 'puffer', 'fleece', 'track jacket', 'atom jacket'],
    },
    top: {
      prefer: ['shirt', 'knit', 'satin', 'dressy', 'sleek', 'top', 'polo'],
      hardAvoid: ['workout', 'training', 'graphic tee', 'performance', 'hoodie'],
    },
    bottom: {
      prefer: ['trouser', 'clean jean', 'skirt', 'slip skirt', 'tailored'],
      hardAvoid: ['work pants', 'double knee', 'cargo', 'sweatpant', 'hiking', 'duck pant'],
    },
    shoes: {
      prefer: ['heel', 'boot', 'loafer', 'sleek sneaker', 'dress shoe'],
      hardAvoid: ['ugg', 'work boot', 'running', 'training', 'hiking', 'sandal', 'clog', 'birkenstock'],
    },
    bag: {
      prefer: ['shoulder bag', 'mini bag', 'crossbody', 'clutch', 'hobo'],
      hardAvoid: ['belt bag', 'gym bag'],
      avoid: ['duffel', 'backpack'],
    },
  },
  date: {
    all: {
      prefer: ['date', 'dressy', 'romantic', 'sleek', 'black', 'leather', 'satin', 'polished'],
      hardAvoid: ['work pants', 'cargo work', 'hiking', 'technical shell', 'shell jacket', 'running shoe', 'training shoe', 'ugg', 'beanie', 'sweatpants', 'arcteryx', 'arc teryx', 'atom jacket', 'beta lt', 'track jacket', 'firebird'],
    },
    outer: {
      prefer: ['leather', 'blazer', 'jacket', 'tailored', 'bomber'],
      hardAvoid: ['hiking', 'technical', 'shell jacket', 'puffer', 'fleece', 'track jacket', 'atom jacket'],
    },
    top: {
      prefer: ['shirt', 'knit', 'satin', 'dressy', 'sleek', 'top', 'polo'],
      hardAvoid: ['workout', 'training', 'graphic tee', 'performance', 'hoodie'],
    },
    bottom: {
      prefer: ['trouser', 'clean jean', 'skirt', 'slip skirt', 'tailored'],
      hardAvoid: ['work pants', 'double knee', 'cargo', 'sweatpant', 'hiking', 'duck pant'],
    },
    shoes: {
      prefer: ['heel', 'boot', 'loafer', 'sleek sneaker', 'dress shoe'],
      hardAvoid: ['ugg', 'work boot', 'running', 'training', 'hiking', 'sandal', 'clog', 'birkenstock', 'western boot', 'cowboy boot'],
    },
    bag: {
      prefer: ['shoulder bag', 'mini bag', 'crossbody', 'clutch', 'hobo'],
      hardAvoid: ['belt bag', 'gym bag'],
      avoid: ['duffel', 'backpack'],
    },
  },
  clean: {
    all: {
      prefer: ['minimal', 'clean', 'plain', 'neutral', 'simple', 'quiet luxury'],
      avoid: ['statement', 'chunky chain'],
      hardAvoid: ['graphic', 'neon', 'western', 'cowboy', 'techwear', 'hiking', 'loud'],
    },
    jewelry: {
      avoid: ['statement', 'chunky', 'oversized'],
      hardAvoid: ['western', 'costume'],
    },
    eyewear: {
      prefer: ['minimal', 'classic', 'sunglasses'],
      avoid: ['shield', 'sport', 'goggle'],
    },
  },
  cozy: {
    all: {
      prefer: ['cozy', 'winter', 'knit', 'puffer', 'hoodie', 'sweatpant', 'boot', 'beanie'],
      hardAvoid: ['linen', 'beach', 'sandal', 'heel', 'pumps', 'satin'],
    },
    jewelry: { hardAvoid: ['statement', 'necklace', 'earring', 'bracelet', 'ring', 'chain', 'pendant'] },
    eyewear: { avoid: ['sunglasses', 'eyewear'] },
  },
  preppy: {
    all: {
      prefer: ['polo', 'cardigan', 'sweater', 'chino', 'loafer', 'pleated', 'blazer', 'ralph lauren', 'cable knit'],
      hardAvoid: ['techwear', 'shell jacket', 'oversized streetwear', 'work pants', 'gym', 'training', 'ugg', 'cargo pants'],
    },
    outer: {
      prefer: ['blazer', 'cardigan', 'sweater', 'trench', 'coat'],
      hardAvoid: ['shell jacket', 'track jacket', 'puffer'],
    },
    bottom: {
      prefer: ['chino', 'trouser', 'pleated', 'skirt', 'tailored'],
      hardAvoid: ['cargo', 'sweatpant', 'work pants', 'track pant'],
    },
    shoes: {
      prefer: ['loafer', 'flat', 'dress shoe', 'sneaker'],
      hardAvoid: ['ugg', 'hiking', 'work boot', 'running'],
    },
  },
  street: {
    all: {
      prefer: ['streetwear', 'hoodie', 'cargo', 'denim', 'oversized', 'cap', 'sneaker', 'crossbody'],
      avoid: ['formal', 'office'],
      hardAvoid: ['blazer suit', 'pumps', 'dress pants'],
    },
    shoes: {
      prefer: ['sneaker', 'samba', 'campus', 'jordan', 'nike', 'adidas', 'new balance'],
      avoid: ['loafer', 'heel', 'pump'],
    },
  },
  edgy: {
    all: {
      prefer: ['black', 'leather', 'cargo', 'boot', 'shell', 'crossbody', 'silver', 'utility', 'techwear'],
      hardAvoid: ['beach', 'linen', 'old money', 'preppy', 'sandal', 'straw', 'polo sweater'],
    },
    outer: {
      prefer: ['shell', 'leather', 'bomber', 'utility', 'technical'],
      hardAvoid: ['blazer', 'cardigan', 'western denim'],
    },
    bottom: {
      prefer: ['cargo', 'black jean', 'utility', 'parachute'],
      hardAvoid: ['chino', 'pleated trouser', 'linen'],
    },
    shoes: {
      prefer: ['boot', 'technical sneaker', 'sneaker', 'black'],
      hardAvoid: ['loafer', 'sandal', 'espadrille', 'ugg', 'heel', 'pump', 'samba', 'campus', 'air force', 'af1', 'gazelle'],
    },
    bag: {
      prefer: ['crossbody', 'sling', 'utility', 'messenger'],
      hardAvoid: ['straw', 'luxury handbag', 'tabby', 'michael kors', 'coach tabby', 'bottega', 'cassette', 'polene'],
    },
  },
};

function debugGenerator(label: string, data: Record<string, unknown>): void {
  if (!DEBUG_GENERATOR) return;
  console.info(`[generator] ${label}`, data);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textHasTerm(text: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  return Boolean(normalizedTerm) && text.includes(normalizedTerm);
}

function matchedTerms(text: string, terms: string[] = []): string[] {
  return terms.filter((term) => textHasTerm(text, term));
}

function hasRealPhoto(product: Product): boolean {
  return hasUsableProductImage(product);
}

type GeneratorMode = 'starter' | 'missing' | 'full' | 'refresh';

function productCommerceScore(product: Product): number {
  let score = 0;
  if (product.trusted !== false) score += 18;
  if (hasDirectRetailerUrl(product.productUrl || '') || hasDirectRetailerUrl(product.retailerUrl || '')) score += 22;
  else if (product.googleShoppingUrl || product.fallbackUrl) score += 8;
  if (hasRealPhoto(product)) score += 16;
  return score;
}

function searchHaystack(product: Product): string {
  return normalize([
    product.brand,
    product.name,
    product.retailer,
    product.category,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.colors || []),
    ...(product.gender || []),
    ...(product.searchTerms || []),
    ...metadataList(product, 'styles'),
    ...metadataList(product, 'vibes'),
    ...metadataList(product, 'keywords'),
    ...metadataList(product, 'colors'),
    ...metadataList(product, 'occasions'),
    ...metadataList(product, 'searchTerms'),
    ...metadataList(product, 'gender'),
  ].join(' '));
}

function titleHaystack(product: Product): string {
  return normalize([
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...(product.searchTerms || []),
    ...metadataList(product, 'keywords'),
    ...metadataList(product, 'searchTerms'),
  ].join(' '));
}

function metadataList(
  product: Product,
  key: 'colors' | 'styles' | 'vibes' | 'keywords' | 'occasions' | 'searchTerms' | 'gender',
): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isUnderBudget(product: Product, budget: GeneratorBudget, customMaxCents?: number | null): boolean {
  return product.priceCents <= getBudgetMaxCents(budget, customMaxCents);
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const output: Product[] = [];

  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    output.push(product);
  }

  return output;
}

function resolveTargetSlots(
  mode: GeneratorMode,
  vibe: VibeId,
  vibeSlots: Category[],
  existingItems: Partial<Record<Category, Product>>,
  selectedSlots?: Category[],
  seed = 0,
): Category[] {
  if (selectedSlots?.length) {
    const selected = CATEGORY_ORDER.filter((slot) => selectedSlots.includes(slot));
    if (mode === 'missing') return selected.filter((slot) => !existingItems[slot]);
    return selected;
  }

  const recipe = OUTFIT_RECIPES[vibe];
  const includeDefaultSlot = (slot: Category, salt: string): boolean => {
    if (!CONDITIONAL_ACCESSORY_SLOTS.has(slot)) return true;
    const rate = DEFAULT_ACCESSORY_RATES[vibe]?.[slot] ?? 0;
    if (rate <= 0) return false;
    if (rate >= 1) return true;
    const mixed = (
      stableHash(`${vibe}:${mode}:${slot}:${salt}`)
      ^ Math.imul(Math.abs(Math.trunc(seed || 0)), 2_654_435_761)
    ) >>> 0;
    const random = (mixed % 10_000) / 10_000;
    return random < rate;
  };
  const defaultOptionalSlots = (salt: string) => recipe.optional.filter((slot) => includeDefaultSlot(slot, salt));
  const defaultVibeSlots = (salt: string) => vibeSlots.filter((slot) => includeDefaultSlot(slot, salt));

  if (mode === 'full') {
    const slots = Array.from(new Set([
      ...recipe.required,
      ...defaultOptionalSlots('full'),
      ...defaultVibeSlots('full'),
    ]));
    return CATEGORY_ORDER.filter((slot) => slots.includes(slot));
  }
  if (mode === 'missing') {
    const missing = [
      ...recipe.required,
      ...MISSING_SLOT_PRIORITY.filter((slot) => includeDefaultSlot(slot, 'missing-priority')),
      ...defaultOptionalSlots('missing'),
      ...defaultVibeSlots('missing'),
    ].filter((slot) => !existingItems[slot]);
    return Array.from(new Set(missing));
  }
  if (mode === 'refresh') {
    const slots = Array.from(new Set([
      ...defaultVibeSlots('refresh'),
      ...REFRESH_ACCESSORY_SLOTS.filter((slot) => includeDefaultSlot(slot, 'refresh-accessory')),
      ...Object.keys(existingItems).filter((slot): slot is Category => CATEGORY_ORDER.includes(slot as Category)),
    ]));
    return CATEGORY_ORDER.filter((slot) => slots.includes(slot));
  }
  const starterSlots = Array.from(new Set([...recipe.required, ...defaultOptionalSlots('starter'), ...defaultVibeSlots('starter')]));
  return CATEGORY_ORDER.filter((slot) => starterSlots.includes(slot)).slice(0, 6);
}

function buildFrameIntent(category: Category, frame: GeneratorFrame): SearchIntent {
  return {
    category,
    keywords: [],
    gender: frame,
  };
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chooseVariedCandidate<T>(items: T[], seed: number, key: string): T | null {
  if (!items.length) return null;
  const pool = items.slice(0, Math.min(48, items.length));
  const random = (stableHash(`${key}:${Math.abs(seed || 0)}`) % 1_000_000) / 1_000_000;
  const totalWeight = pool.reduce((total, _item, index) => total + Math.pow(pool.length - index, 1.35), 0);
  let threshold = random * totalWeight;

  for (let index = 0; index < pool.length; index += 1) {
    threshold -= Math.pow(pool.length - index, 1.35);
    if (threshold <= 0) return pool[index] || pool[0] || null;
  }

  return pool[0] || null;
}

export const LAUNCH_COLLECTIONS: CatalogCollection[] = [
  {
    id: 'night-femme',
    label: 'Midnight polish',
    vibe: 'night',
    frame: 'fem',
    blurb: 'A sharp night-out build with clean lines, a sleek heel, and a statement bag.',
    queryHint: 'night out',
    productIds: [
      'catalog-top-zara-corset',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-stevemadden-heel',
      'catalog-bag-saintlaurent-le5a7',
      'catalog-jewelry-missoma-pearlhoop',
    ],
  },
  {
    id: 'street-masc',
    label: 'Downtown layers',
    vibe: 'street',
    frame: 'masc',
    blurb: 'Layered outerwear, strong denim, and sneaker energy for a more built-out street fit.',
    queryHint: 'streetwear',
    productIds: [
      'catalog-hat-newera-yankees',
      'catalog-outer-northface-nuptse',
      'catalog-top-stussy-tee',
      'catalog-bottom-dickies-874',
      'catalog-shoes-jordan-1low',
    ],
  },
  {
    id: 'clean-all',
    label: 'Clean daily core',
    vibe: 'clean',
    frame: 'all',
    blurb: 'An easy neutral look that works as a clean starting point before you add accessories.',
    queryHint: 'clean minimal',
    productIds: [
      'catalog-top-uniqlo-airism',
      'catalog-bottom-aritzia-effortless',
      'catalog-shoes-nike-af1',
      'catalog-bag-longchamp-lepliage',
      'catalog-eyewear-rayban-wayfarer',
    ],
  },
  {
    id: 'gym-all',
    label: 'Studio reset',
    vibe: 'gym',
    frame: 'all',
    blurb: 'Performance-first basics that still feel like a polished matching set.',
    queryHint: 'gym set',
    productIds: [
      'catalog-top-lululemon-swiftly',
      'catalog-bottom-lululemon-align',
      'catalog-shoes-newbalance-530',
      'catalog-bag-lululemon-beltbag',
    ],
  },
  {
    id: 'cozy-all',
    label: 'Soft weekend',
    vibe: 'cozy',
    frame: 'all',
    blurb: 'Warm layers and off-duty pieces that still build a complete look fast.',
    queryHint: 'cozy weekend',
    productIds: [
      'catalog-outer-aritzia-superpuff',
      'catalog-top-essentials-hoodie',
      'catalog-bottom-nike-jogger',
      'catalog-shoes-ugg-ultramini',
      'catalog-bag-longchamp-lepliage',
    ],
  },
  {
    id: 'office-femme',
    label: 'Refined office',
    vibe: 'office',
    frame: 'fem',
    blurb: 'Tailored layers with a polished tote so the generator can land on something work-ready.',
    queryHint: 'office wear',
    productIds: [
      'catalog-outer-zara-trench',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-abercrombie-tailored',
      'catalog-shoes-stevemadden-heel',
      'catalog-bag-michaelkors-tote',
    ],
  },
  {
    id: 'vacation-femme',
    label: 'Resort set',
    vibe: 'vacation',
    frame: 'fem',
    blurb: 'Light vacation pieces with an easy hat and accessories to anchor the look.',
    queryHint: 'vacation outfit',
    productIds: [
      'catalog-hat-hm-bucket',
      'catalog-top-hm-ribtank',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-birkenstock-boston',
      'catalog-bag-coach-tabby',
      'catalog-eyewear-gucci-cateye',
    ],
  },
  {
    id: 'preppy-masc',
    label: 'Campus classic',
    vibe: 'preppy',
    frame: 'masc',
    blurb: 'A preppy base built around a cap, oxford shirt, and sharper everyday pieces.',
    queryHint: 'preppy classic',
    productIds: [
      'catalog-hat-ralphlauren-cap',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-levis-501',
      'catalog-shoes-converse-chuck70',
      'catalog-bag-michaelkors-tote',
    ],
  },
  {
    id: 'clean-femme-soft',
    label: 'Soft tailored clean',
    vibe: 'clean',
    frame: 'fem',
    blurb: 'A sharper feminine clean look with tailored pants, a fitted top, and polished accessories.',
    queryHint: 'clean womenswear',
    productIds: [
      'catalog-top-aritzia-contour',
      'catalog-bottom-aritzia-effortless',
      'catalog-shoes-nike-af1',
      'catalog-bag-coach-tabby',
      'catalog-jewelry-mejuri-dome',
    ],
  },
  {
    id: 'clean-masc-smart',
    label: 'Clean city uniform',
    vibe: 'clean',
    frame: 'masc',
    blurb: 'A cleaner menswear base with relaxed tailoring, a premium tee, and understated shoes.',
    queryHint: 'clean menswear',
    productIds: [
      'catalog-top-uniqlo-airism',
      'catalog-bottom-levis-501',
      'catalog-shoes-converse-chuck70',
      'catalog-hat-ralphlauren-cap',
      'catalog-eyewear-rayban-wayfarer',
    ],
  },
  {
    id: 'date-femme-afterdark',
    label: 'After dark polish',
    vibe: 'date',
    frame: 'fem',
    blurb: 'A dressier date build with a fitted top, tailored base, and jewelry-led finish.',
    queryHint: 'date night',
    productIds: [
      'catalog-top-aritzia-contour',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-stevemadden-heel',
      'catalog-jewelry-pandora-hoops',
      'catalog-bag-saintlaurent-le5a7',
    ],
  },
  {
    id: 'date-masc-polished',
    label: 'Polished night out',
    vibe: 'date',
    frame: 'masc',
    blurb: 'A polished menswear date look with a cleaner shirt, darker jacket, and sharper footwear.',
    queryHint: 'mens date night',
    productIds: [
      'catalog-outer-abercrombie-bomber',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-levis-501',
      'catalog-shoes-docmartens-1460',
      'catalog-eyewear-rayban-wayfarer',
    ],
  },
  {
    id: 'edgy-femme-night',
    label: 'Edgy gallery night',
    vibe: 'edgy',
    frame: 'fem',
    blurb: 'A darker feminine build with sharper layers and heavier footwear.',
    queryHint: 'edgy womenswear',
    productIds: [
      'catalog-outer-abercrombie-bomber',
      'catalog-top-zara-corset',
      'catalog-bottom-zara-slip-skirt',
      'catalog-shoes-docmartens-1460',
      'catalog-bag-saintlaurent-le5a7',
    ],
  },
  {
    id: 'edgy-masc-core',
    label: 'Workwear after dark',
    vibe: 'edgy',
    frame: 'masc',
    blurb: 'Structured workwear layers and heavier shoes for a darker everyday look.',
    queryHint: 'edgy menswear',
    productIds: [
      'catalog-outer-carhartt-detroit',
      'catalog-top-stussy-tee',
      'catalog-bottom-dickies-874',
      'catalog-shoes-docmartens-1460',
      'catalog-hat-carhartt-beanie',
    ],
  },
  {
    id: 'office-masc-refined',
    label: 'Refined office core',
    vibe: 'office',
    frame: 'masc',
    blurb: 'A more office-ready menswear build with a clean outer layer and structured separates.',
    queryHint: 'mens office wear',
    productIds: [
      'catalog-outer-zara-trench',
      'catalog-top-ralphlauren-oxford',
      'catalog-bottom-abercrombie-tailored',
      'catalog-shoes-converse-chuck70',
      'catalog-bag-michaelkors-tote',
    ],
  },
  {
    id: 'vacation-masc-resort',
    label: 'Resort off-duty',
    vibe: 'vacation',
    frame: 'masc',
    blurb: 'An easy vacation set with softer basics, relaxed accessories, and warm-weather footwear.',
    queryHint: 'mens vacation outfit',
    productIds: [
      'catalog-hat-ralphlauren-cap',
      'catalog-top-uniqlo-airism',
      'catalog-bottom-levis-501',
      'catalog-shoes-birkenstock-boston',
      'catalog-bag-longchamp-lepliage',
    ],
  },
  {
    id: 'gym-femme-studio',
    label: 'Studio set',
    vibe: 'gym',
    frame: 'fem',
    blurb: 'A tighter studio-led activewear set with stronger womenswear picks and cleaner sneakers.',
    queryHint: 'womens gym set',
    productIds: [
      'catalog-top-lululemon-swiftly',
      'catalog-bottom-lululemon-align',
      'catalog-shoes-newbalance-530',
      'catalog-bag-lululemon-beltbag',
    ],
  },
  {
    id: 'gym-masc-training',
    label: 'Training uniform',
    vibe: 'gym',
    frame: 'masc',
    blurb: 'A menswear training build with a straightforward performance top and cleaner athletic base.',
    queryHint: 'mens gym fit',
    productIds: [
      'catalog-top-nike-tee',
      'catalog-bottom-nike-jogger',
      'catalog-shoes-newbalance-530',
      'catalog-hat-nike-club-cap',
    ],
  },
  {
    id: 'cozy-femme-weekend',
    label: 'Weekend soft layers',
    vibe: 'cozy',
    frame: 'fem',
    blurb: 'A softer cold-weather build with puffed outerwear and more feminine cozy accessories.',
    queryHint: 'cozy womenswear',
    productIds: [
      'catalog-outer-aritzia-superpuff',
      'catalog-top-skims-tank',
      'catalog-bottom-lululemon-align',
      'catalog-shoes-ugg-ultramini',
      'catalog-bag-coach-tabby',
    ],
  },
  {
    id: 'street-femme-downtown',
    label: 'Downtown femme street',
    vibe: 'street',
    frame: 'fem',
    blurb: 'A more feminine streetwear lane with a sharper jacket, denim base, and statement bag.',
    queryHint: 'femme streetwear',
    productIds: [
      'catalog-hat-nike-club-cap',
      'catalog-outer-adidas-firebird',
      'catalog-top-nike-tee',
      'catalog-bottom-agolde-90s',
      'catalog-shoes-nike-af1',
      'catalog-bag-telfar-shopping',
    ],
  },
];

export const ALL_CATALOG_PRODUCTS: Product[] = dedupeProducts([
  ...applyCatalogTagOverridesToProducts(PHOTO_CATALOG_PRODUCTS),
  ...applyCatalogTagOverridesToProducts(GENERATED_CATALOG_PRODUCTS),
  ...applyCatalogTagOverridesToProducts(BRAND_CATALOG_PRODUCTS),
]);

const PRODUCTS_BY_ID = new Map(ALL_CATALOG_PRODUCTS.map((product) => [product.id, product]));

export function getCatalogProductById(id: string): Product | null {
  return PRODUCTS_BY_ID.get(id) || null;
}

function findRealPhotoReplacement(
  product: Product,
  budget?: GeneratorBudget,
  customMaxCents?: number | null,
  usedIds?: Set<string>,
): Product | null {
  const originalHaystack = searchHaystack(product);
  const candidates = ALL_CATALOG_PRODUCTS
    .filter((candidate) => candidate.category === product.category)
    .filter(hasRealPhoto)
    .filter((candidate) => candidate.id !== product.id)
    .filter((candidate) => !budget || isUnderBudget(candidate, budget, customMaxCents))
    .filter((candidate) => !usedIds || !usedIds.has(candidate.id));

  if (!candidates.length) return null;

  return candidates
    .map((candidate) => {
      let score = 100;
      if (candidate.metadata?.featured) score += 20;
      if (normalize(candidate.brand) === normalize(product.brand)) score += 30;
      score += productCommerceScore(candidate);

      const candidateHaystack = searchHaystack(candidate);
      const originalTerms = new Set(originalHaystack.split(' ').filter(Boolean));
      const candidateTerms = new Set(candidateHaystack.split(' ').filter(Boolean));

      for (const term of originalTerms) {
        if (candidateTerms.has(term)) score += 6;
      }

      const priceDelta = Math.abs((candidate.priceCents || 0) - (product.priceCents || 0));
      score -= Math.min(25, Math.round(priceDelta / 2500));

      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score)[0]?.candidate || null;
}

export function hydrateItemsFromCatalog(
  items: Partial<Record<Category, Product>>,
): Partial<Record<Category, Product>> {
  const nextItems: Partial<Record<Category, Product>> = {};

  for (const [slot, product] of Object.entries(items) as Array<[Category, Product | undefined]>) {
    if (!product) continue;
    const catalogProduct = getCatalogProductById(product.id);
    const currentIsPlaceholder = String(product.imageUrl || '').startsWith('data:image/svg+xml');

    if (catalogProduct) {
      const catalogHasRealPhoto = hasRealPhoto(catalogProduct);
      if (currentIsPlaceholder && catalogHasRealPhoto) {
        nextItems[slot] = {
          ...product,
          ...catalogProduct,
        };
        continue;
      }
    }

    if (currentIsPlaceholder) {
      nextItems[slot] = findRealPhotoReplacement(product) || product;
      continue;
    }

    nextItems[slot] = product;
  }

  return nextItems;
}

export function getCollectionProducts(collection: CatalogCollection): Product[] {
  return collection.productIds
    .map((id) => getCatalogProductById(id))
    .filter((product): product is Product => Boolean(product));
}

export function getCollectionsFor(vibe?: VibeId, frame?: GeneratorFrame): CatalogCollection[] {
  return LAUNCH_COLLECTIONS.filter((collection) => {
    if (vibe && collection.vibe !== vibe) return false;
    if (!frame || frame === 'androgynous') return true;
    return collection.frame === 'all' || collection.frame === frame;
  });
}

export function getFeaturedCatalogProducts(limit = 8, category?: Category): Product[] {
  const pool = category
    ? ALL_CATALOG_PRODUCTS.filter((product) => product.category === category)
    : ALL_CATALOG_PRODUCTS;

  const featured = pool.filter((product) => Boolean(product.metadata?.featured));
  const fallback = pool.filter((product) => !product.metadata?.featured);

  return dedupeProducts([...featured, ...fallback]).slice(0, limit);
}

function scoreFallbackProduct(
  product: Product,
  vibe: VibeId,
  frame: GeneratorFrame,
): number {
  let score = product.metadata?.featured ? 12 : 4;
  score += productCommerceScore(product);
  const haystack = searchHaystack(product);
  score += presentationScore(product, buildFrameIntent(product.category, frame));

  for (const term of VIBE_TAG_ALIASES[vibe]) {
    if (haystack.includes(normalize(term))) score += 26;
  }

  for (const term of VIBE_TERMS[vibe]) {
    if (haystack.includes(normalize(term))) score += 12;
  }

  for (const term of FRAME_AVOID_TERMS[frame]) {
    if (haystack.includes(normalize(term))) score -= 14;
  }

  const genders = new Set([
    ...(product.gender || []),
    ...metadataList(product, 'gender'),
  ].map(normalize));
  if (frame !== 'androgynous' && genders.size) {
    if (genders.has(frame) || genders.has('androgynous') || genders.has('unisex')) score += 12;
    else score -= 12;
  }

  const metadataRichness = [
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.colors || []),
    ...(product.searchTerms || []),
    ...metadataList(product, 'styles'),
    ...metadataList(product, 'vibes'),
    ...metadataList(product, 'keywords'),
  ].length;
  score += Math.min(metadataRichness * 1.8, 24);

  if (product.imageQuality === 'good') score += 8;
  if (product.imageQuality === 'missing') score -= 30;
  if (product.popularityScore) score += Math.min(product.popularityScore, 20);

  return score;
}

export function getVibeQualityWarnings(product: Product, vibe: VibeId, _frame: GeneratorFrame = 'androgynous'): string[] {
  const haystack = searchHaystack(product);
  const rules = [
    VIBE_QUALITY_RULES[vibe]?.all,
    VIBE_QUALITY_RULES[vibe]?.[product.category],
  ].filter((rule): rule is QualityRule => Boolean(rule));
  const warnings: string[] = [];

  for (const rule of rules) {
    for (const term of matchedTerms(haystack, rule.hardAvoid)) {
      warnings.push(`${product.category} hard-avoids "${term}" for ${vibe}`);
    }
    for (const term of matchedTerms(haystack, rule.avoid)) {
      warnings.push(`${product.category} avoids "${term}" for ${vibe}`);
    }
  }

  return Array.from(new Set(warnings));
}

function hasHardVibeContradiction(product: Product, vibe: VibeId, frame: GeneratorFrame): boolean {
  return getVibeQualityWarnings(product, vibe, frame).some((warning) => warning.includes('hard-avoids'));
}

function hasVibeCategoryPreference(product: Product, vibe: VibeId): boolean {
  const rule = VIBE_QUALITY_RULES[vibe]?.[product.category];
  if (!rule?.prefer?.length) return true;
  return matchedTerms(searchHaystack(product), rule.prefer).length > 0;
}

function scoreVibeCategoryFit(product: Product, vibe: VibeId, frame: GeneratorFrame): number {
  const haystack = searchHaystack(product);
  const rules = [
    VIBE_QUALITY_RULES[vibe]?.all,
    VIBE_QUALITY_RULES[vibe]?.[product.category],
  ].filter((rule): rule is QualityRule => Boolean(rule));
  let score = 0;

  for (const rule of rules) {
    score += Math.min(matchedTerms(haystack, rule.prefer).length * 28, 96);
    score -= matchedTerms(haystack, rule.avoid).length * 70;
    score -= matchedTerms(haystack, rule.hardAvoid).length * 260;
  }

  if ((vibe === 'night' || vibe === 'date') && frame === 'masc') {
    if (product.category === 'top' && matchedTerms(haystack, ['shirt', 'knit', 'polo', 'sweater']).length) score += 34;
    if (product.category === 'bottom' && matchedTerms(haystack, ['trouser', 'clean jean', 'tailored pant']).length) score += 34;
    if (product.category === 'shoes' && matchedTerms(haystack, ['loafer', 'boot', 'dress shoe', 'samba']).length) score += 32;
    if (product.category === 'jewelry' && matchedTerms(haystack, ['chain', 'bracelet', 'watch', 'ring']).length) score += 28;
  }

  if ((vibe === 'night' || vibe === 'date') && frame === 'fem') {
    if (product.category === 'top' && matchedTerms(haystack, ['dressy', 'satin', 'contour', 'bodysuit', 'tank', 'top']).length) score += 34;
    if (product.category === 'bottom' && matchedTerms(haystack, ['skirt', 'trouser', 'jean', 'slip']).length) score += 30;
    if (product.category === 'shoes' && matchedTerms(haystack, ['heel', 'boot', 'loafer', 'sandal']).length) score += 32;
    if (product.category === 'bag' && matchedTerms(haystack, ['shoulder', 'mini', 'hobo', 'clutch']).length) score += 28;
  }

  if (vibe === 'preppy' && frame === 'masc') {
    if (product.category === 'top' && matchedTerms(haystack, ['polo', 'knit', 'button down', 'sweater']).length) score += 34;
    if (product.category === 'bottom' && matchedTerms(haystack, ['chino', 'trouser', 'tailored']).length) score += 34;
    if (product.category === 'shoes' && matchedTerms(haystack, ['loafer', 'sneaker', 'dress shoe']).length) score += 28;
  }

  if (vibe === 'preppy' && frame === 'fem') {
    if (product.category === 'outer' && matchedTerms(haystack, ['cardigan', 'blazer', 'sweater']).length) score += 34;
    if (product.category === 'bottom' && matchedTerms(haystack, ['tailored', 'trouser', 'skirt', 'pleated']).length) score += 34;
    if (product.category === 'shoes' && matchedTerms(haystack, ['loafer', 'flat', 'heel']).length) score += 28;
    if (product.category === 'bag' && matchedTerms(haystack, ['structured', 'tote', 'shoulder']).length) score += 24;
  }

  return score;
}

function scoreRecipeProduct(product: Product, vibe: VibeId): number {
  const recipe = OUTFIT_RECIPES[vibe];
  const haystack = searchHaystack(product);
  let score = 0;

  for (const term of recipe.prefer) {
    if (haystack.includes(normalize(term))) score += 18;
  }

  for (const term of recipe.avoid) {
    if (haystack.includes(normalize(term))) score -= 46;
  }

  for (const color of recipe.colors) {
    if (haystack.includes(normalize(color))) score += 9;
  }

  if (product.category === 'jewelry') {
    if (recipe.jewelry === 'strong') score += 78;
    if (recipe.jewelry === 'optional') score += 16;
    if (recipe.jewelry === 'avoid') score -= 110;
  }

  if (product.category === 'eyewear') {
    if (recipe.eyewear === 'strong') score += 58;
    if (recipe.eyewear === 'optional') score += 12;
    if (recipe.eyewear === 'avoid') score -= 100;
  }

  if (recipe.required.includes(product.category)) score += 12;
  if (recipe.optional.includes(product.category)) score += 6;

  return score;
}

function scoreCatalogQuality(product: Product, vibe: VibeId, frame: GeneratorFrame): number {
  const haystack = searchHaystack(product);
  const retailer = normalize(product.retailer || '');
  const brand = normalize(product.brand || '');
  let score = 0;

  if (haystack.includes(' baby ') || haystack.includes(' toddler ') || haystack.includes(' infant ')) score -= 260;
  if (haystack.includes(' boys ') || haystack.includes(' girls ') || haystack.includes(' kids ') || haystack.includes(' junior ')) score -= 180;
  if (retailer.includes('poshmark') || retailer.includes('etsy') || retailer.includes('ebay') || retailer.includes('zazzle')) score -= 180;
  if (retailer.includes('walmart') || retailer.includes('temu') || retailer.includes('tiktok') || retailer.includes('shein')) score -= 170;
  if (brand.includes('poshmark') || brand.includes('etsy') || brand.includes('walmart') || brand.includes('temu')) score -= 150;
  if (haystack.includes('bundle') || haystack.includes('set of') || haystack.includes('costume') || haystack.includes('cosplay')) score -= 150;
  if (haystack.includes('cowboy') || haystack.includes('western')) score += vibe === 'edgy' ? 0 : -120;

  if (retailer.includes('nordstrom') || retailer.includes('ssense') || retailer.includes('end clothing') || retailer.includes('farfetch')) score += 34;
  if (retailer.includes('uniqlo') || retailer.includes('zara') || retailer.includes('h m') || retailer.includes('cos') || retailer.includes('aritzia')) score += 30;
  if (retailer.includes('nike') || retailer.includes('adidas') || retailer.includes('lululemon') || retailer.includes('abercrombie')) score += 26;
  if (brand.includes('nike') || brand.includes('adidas') || brand.includes('new balance') || brand.includes('cos') || brand.includes('aritzia')) score += 20;

  if (frame === 'masc') {
    if (
      product.category === 'jewelry'
      && !haystack.includes('chain')
      && !haystack.includes('silver')
      && !haystack.includes('bracelet')
      && !haystack.includes('ring')
      && !haystack.includes('pendant')
    ) score -= 34;
    if (product.category === 'bag' && (haystack.includes('tabby') || haystack.includes('purse'))) score -= 80;
  }

  if (frame === 'fem') {
    if (haystack.includes(' mens ') || haystack.includes(' men s ')) score -= 120;
  }

  return score;
}

function scoreCategoryIntegrity(product: Product): number {
  const haystack = titleHaystack(product);
  const has = (terms: string[]) => terms.some((term) => haystack.includes(normalize(term)));

  switch (product.category) {
    case 'hat':
      return has(['cap', 'hat', 'beanie', 'bucket']) ? 24 : -80;
    case 'outer':
      return has(['jacket', 'coat', 'blazer', 'cardigan', 'puffer', 'hoodie', 'overshirt', 'trench', 'bomber']) ? 28 : -80;
    case 'top':
      return has(['shirt', 'tee', 't shirt', 'top', 'tank', 'polo', 'sweater', 'hoodie', 'cardigan'])
        && !has(['pants', 'trouser', 'shorts', 'skirt', 'bag', 'shoes'])
        ? 28
        : -90;
    case 'bottom':
      return has(['pant', 'trouser', 'jean', 'short', 'skirt', 'cargo', 'chino', 'legging', 'sweatpant'])
        && !has(['jacket', 'shirt set', 'bag', 'shoe'])
        ? 28
        : -90;
    case 'shoes':
      return has(['shoe', 'sneaker', 'loafer', 'boot', 'heel', 'sandal', 'clog'])
        && !has(['jacket', 'hat denim', 'bag'])
        ? 28
        : -90;
    case 'bag':
      return has(['bag', 'tote', 'backpack', 'crossbody', 'shoulder', 'duffel', 'purse'])
        && !has(['dress size', 'hat and jewelry set'])
        ? 28
        : -90;
    case 'eyewear':
      return has(['sunglasses', 'glasses', 'eyeglasses', 'eyewear']) ? 28 : -90;
    case 'jewelry':
      return has(['necklace', 'bracelet', 'ring', 'earring', 'earrings', 'hoop', 'chain', 'pendant', 'jewelry', 'stud', 'huggie', 'bangle', 'cuff', 'charm']) ? 28 : -90;
    default:
      return 0;
  }
}

function hasCategoryMismatch(product: Product): boolean {
  const haystack = titleHaystack(product);
  const has = (terms: string[]) => terms.some((term) => haystack.includes(normalize(term)));
  const knownEyewearBrand = has(['ray ban', 'oakley', 'warby parker', 'gentle monster', 'quay', 'versace eyewear', 'prada eyewear']);

  switch (product.category) {
    case 'shoes':
      return has(['shirt', 'jacket', 'coat', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote']);
    case 'top':
      return has(['pants', 'trouser', 'jeans', 'shorts', 'skirt', 'shoes', 'sneaker', 'bag', 'tote']);
    case 'bottom':
      return has(['jacket', 'coat', 'shirt', 'tee', 'shoes', 'sneaker', 'bag', 'tote']);
    case 'outer':
      return has(['shoes', 'sneaker', 'pants', 'trouser', 'jeans', 'shorts', 'bag', 'tote'])
        && !has(['jacket', 'coat', 'blazer', 'cardigan', 'puffer', 'hoodie', 'overshirt', 'trench', 'bomber']);
    case 'bag':
      return has(['shoes', 'sneaker', 'pants', 'trouser', 'jeans', 'jacket', 'coat'])
        || has(['dress size', 'hat and jewelry set']);
    case 'eyewear':
      return !knownEyewearBrand && !has(['sunglasses', 'glasses', 'eyeglasses', 'eyewear', 'shades']);
    case 'jewelry':
      return !has(['necklace', 'bracelet', 'ring', 'earring', 'earrings', 'hoop', 'chain', 'pendant', 'jewelry', 'stud', 'huggie', 'bangle', 'cuff', 'charm']);
    case 'hat':
      return has(['jacket', 'pants', 'trouser', 'shoes', 'bag']) && !has(['cap', 'hat', 'beanie', 'bucket']);
    default:
      return false;
  }
}

function isAdultCatalogCandidate(product: Product): boolean {
  const haystack = searchHaystack(product);
  return !(
    haystack.includes(' baby ')
    || haystack.includes(' toddler ')
    || haystack.includes(' infant ')
    || haystack.includes(' boys ')
    || haystack.includes(' girls ')
    || haystack.includes(' kids ')
    || haystack.includes(' 18m ')
    || haystack.includes(' 2t ')
  );
}

function scoreOutfitCompatibility(product: Product, vibe: VibeId, selectedProducts: Product[]): number {
  if (!selectedProducts.length) return 0;
  const haystack = searchHaystack(product);
  const selectedHaystack = selectedProducts.map(searchHaystack).join(' ');
  let score = 0;

  const hasSelected = (terms: string[]) => terms.some((term) => selectedHaystack.includes(normalize(term)));
  const hasProduct = (terms: string[]) => terms.some((term) => haystack.includes(normalize(term)));

  if (hasSelected(['blazer', 'trouser', 'office', 'tailored']) && hasProduct(['running', 'gym', 'workout', 'sweatpants'])) score -= 52;
  if (hasSelected(['puffer', 'winter', 'fleece', 'beanie']) && hasProduct(['sandal', 'linen', 'beach'])) score -= 52;
  if (hasSelected(['linen', 'beach', 'vacation', 'resort']) && hasProduct(['puffer', 'winter', 'boot', 'fleece'])) score -= 52;
  if (vibe === 'clean' && hasProduct(['graphic', 'neon', 'statement', 'western', 'techwear'])) score -= 44;
  if ((vibe === 'gym' || vibe === 'cozy') && hasProduct(['heel', 'pumps', 'satin', 'dressy'])) score -= 44;
  if ((vibe === 'night' || vibe === 'date') && hasProduct(['running', 'gym', 'workout', 'sweatpants'])) score -= 44;

  const neutralTerms = ['black', 'white', 'cream', 'beige', 'grey', 'gray', 'navy', 'brown'];
  if (hasSelected(neutralTerms) && hasProduct(neutralTerms)) score += 12;
  if (vibe === 'gym' && hasSelected(['nike', 'adidas', 'lululemon', 'alo', 'new balance']) && hasProduct(['nike', 'adidas', 'lululemon', 'alo', 'new balance'])) {
    score += 18;
  }

  return score;
}

function getSlotCandidates({
  slot,
  vibe,
  frame,
  budget,
  customMaxCents,
  usedIds,
  avoidIds,
  currentIds,
  currentProductId,
  usedBrands,
  selectedProducts,
  collectionCandidates,
}: {
  slot: Category;
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  usedIds: Set<string>;
  avoidIds: Set<string>;
  currentIds: Set<string>;
  currentProductId?: string;
  usedBrands: Set<string>;
  selectedProducts: Product[];
  collectionCandidates: Product[];
}): Product[] {
  const query = vibeSearchQuery(vibe, slot, budget, frame, customMaxCents);
  const intent = parseSearchIntentHeuristic(query, slot);
  intent.priceMax = Number.isFinite(getBudgetMaxCents(budget, customMaxCents))
    ? getBudgetMaxCents(budget, customMaxCents) / 100
    : null;
  intent.priceMin = null;
  const collectionIds = new Set(
    collectionCandidates
      .filter((product) => product.category === slot)
      .map((product) => product.id),
  );
  const searchedIds = new Set(
    dedupeProducts([
      ...searchPhotoCatalog(intent, query, 24),
      ...searchBrandCatalog(intent, query, 16),
    ]).map((product) => product.id),
  );

  const categoryProducts = ALL_CATALOG_PRODUCTS
    .filter((product) => product.category === slot)
    .filter(isRenderableProduct)
    .filter(isAdultCatalogCandidate)
    .filter((product) => !hasCategoryMismatch(product))
    .filter((product) => isUnderBudget(product, budget, customMaxCents))
    .filter((product) => !usedIds.has(product.id));
  const vibeCoherentProducts = categoryProducts.filter((product) => !hasHardVibeContradiction(product, vibe, frame));
  const vibePool = vibeCoherentProducts.length >= 3 ? vibeCoherentProducts : categoryProducts;
  const categoryPreferredProducts = vibePool.filter((product) => hasVibeCategoryPreference(product, vibe));
  const requiresCategoryPreference = STRICT_CATEGORY_PREFERENCE_VIBES.has(vibe) && Boolean(VIBE_QUALITY_RULES[vibe]?.[slot]?.prefer?.length);
  const qualityPool = categoryPreferredProducts.length >= 3 || (requiresCategoryPreference && categoryPreferredProducts.length)
    ? categoryPreferredProducts
    : vibePool;
  const frameMatched = frame === 'androgynous'
    ? qualityPool
    : qualityPool.filter((product) => !hasFrameMismatch(product, frame));
  const framePool = frame !== 'androgynous' && frameMatched.length >= 2 ? frameMatched : qualityPool;

  const ranked = framePool
    .map((product) => ({
      product,
      score:
        scoreFallbackProduct(product, vibe, frame)
        + frameCompatibilityScore(product, frame)
        + scoreRecipeProduct(product, vibe)
        + scoreCatalogQuality(product, vibe, frame)
        + scoreCategoryIntegrity(product)
        + scoreVibeCategoryFit(product, vibe, frame)
        + scoreOutfitCompatibility(product, vibe, selectedProducts)
        + (hasRealPhoto(product) ? 28 : -24)
        + (collectionIds.has(product.id) ? 14 : 0)
        + (searchedIds.has(product.id) ? 24 : 0)
        - (usedBrands.has(normalize(product.brand)) ? 28 : 0)
        - (avoidIds.has(product.id) ? 130 : 0)
        - (currentIds.has(product.id) ? 220 : 0)
        - (product.id === currentProductId ? 320 : 0)
        + ((product.productUrl || product.retailerUrl || product.googleShoppingUrl || product.fallbackUrl) ? 6 : -10),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product)
    .filter((product, index, list) => list.findIndex((entry) => entry.id === product.id) === index);

  const alternatives = ranked.filter((product) => product.id !== currentProductId && !currentIds.has(product.id));
  const eligible = alternatives.length >= 3 ? alternatives : ranked;
  const preferred = eligible.filter((product) => !avoidIds.has(product.id) && !currentIds.has(product.id));
  const avoided = eligible.filter((product) => avoidIds.has(product.id) || currentIds.has(product.id));
  return [...preferred, ...avoided].slice(0, 96);
}

export function buildCatalogLook({
  vibe,
  frame,
  budget,
  customMaxCents,
  currentItems,
  mode,
  seed = 0,
  avoidProductIds = [],
  targetSlots: selectedTargetSlots,
}: {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  currentItems?: Partial<Record<Category, Product>>;
  mode: GeneratorMode;
  seed?: number;
  avoidProductIds?: string[];
  targetSlots?: Category[];
}): {
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
} {
  const vibeConfig = VIBES.find((entry) => entry.id === vibe) || VIBES[0];
  const existingItems = currentItems || {};
  const targetSlots = resolveTargetSlots(mode, vibe, vibeConfig.slots, existingItems, selectedTargetSlots, seed);
  const picked: Partial<Record<Category, Product>> = {};
  const currentIds = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );
  const usedIds = new Set<string>();
  const usedBrands = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => normalize(product.brand)),
  );
  const avoidIds = new Set([
    ...avoidProductIds,
    ...(mode === 'starter' || mode === 'refresh' || mode === 'full' ? Array.from(currentIds) : []),
  ]);

  const collections = getCollectionsFor(vibe, frame);
  const bestCollection = collections.length
    ? collections[(stableHash(`${vibe}:${frame}:${budget}:${customMaxCents || 0}`) + Math.abs(seed || 0)) % collections.length] || collections[0] || null
    : null;
  const collectionCandidates = dedupeProducts(
    [
      ...(bestCollection ? getCollectionProducts(bestCollection) : []),
      ...collections.flatMap((collection) => getCollectionProducts(collection)),
    ],
  );

  debugGenerator('start', {
    vibe,
    frame,
    budget,
    mode,
    targetSlots,
    currentCount: currentIds.size,
    avoidCount: avoidIds.size,
    accessorySlotsIncluded: targetSlots.filter((slot) => REFRESH_ACCESSORY_SLOTS.includes(slot)),
  });

  for (const slot of targetSlots) {
    if (mode === 'missing' && existingItems[slot]) continue;
    const candidatePool = getSlotCandidates({
      slot,
      vibe,
      frame,
      budget,
      customMaxCents,
      usedIds,
      avoidIds,
      currentIds,
      currentProductId: existingItems[slot]?.id,
      usedBrands,
      selectedProducts: Object.values(picked).filter((product): product is Product => Boolean(product)),
      collectionCandidates,
    });
    const chosen = chooseVariedCandidate(candidatePool, seed, `${vibe}:${frame}:${budget}:${customMaxCents || 0}:${slot}:catalog`);

    if (slot === 'jewelry') {
      debugGenerator('jewelry-candidates', {
        vibe,
        frame,
        mode,
        selected: targetSlots.includes('jewelry'),
        candidateCount: candidatePool.length,
        currentProductId: existingItems.jewelry?.id || null,
      });
    }

    debugGenerator('slot', {
      vibe,
      mode,
      slot,
      candidateCount: candidatePool.length,
      currentProductId: existingItems[slot]?.id || null,
      currentAvoided: Boolean(existingItems[slot]?.id && chosen?.id !== existingItems[slot]?.id),
      chosen: chosen ? `${chosen.brand} ${chosen.name}` : null,
      chosenId: chosen?.id || null,
    });

    if (!chosen) {
      if (slot === 'jewelry') {
        debugGenerator('jewelry-skipped', {
          vibe,
          frame,
          mode,
          reason: candidatePool.length ? 'weighted selection returned no product' : 'no eligible jewelry candidates',
        });
      }
      continue;
    }

    if (slot === 'jewelry') {
      debugGenerator('jewelry-chosen', {
        vibe,
        frame,
        mode,
        chosenId: chosen.id,
        chosen: `${chosen.brand} ${chosen.name}`,
      });
    }

    picked[slot] = chosen;
    usedIds.add(chosen.id);
    usedBrands.add(normalize(chosen.brand));
  }

  const missingSlots = targetSlots.filter((slot) => !picked[slot] && !(mode === 'missing' && existingItems[slot]));
  if (DEBUG_GENERATOR) {
    for (const accessory of REFRESH_ACCESSORY_SLOTS) {
      if (targetSlots.includes(accessory) && !picked[accessory]) {
        debugGenerator('accessory-skipped', { vibe, mode, slot: accessory, reason: 'no eligible catalog candidate' });
      }
    }
  }

  return {
    products: picked,
    collection: bestCollection,
    missingSlots,
  };
}

export async function buildAiCatalogLook({
  vibe,
  frame,
  budget,
  customMaxCents,
  currentItems,
  mode,
  seed = 0,
  avoidProductIds = [],
  targetSlots: selectedTargetSlots,
}: {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  currentItems?: Partial<Record<Category, Product>>;
  mode: GeneratorMode;
  seed?: number;
  avoidProductIds?: string[];
  targetSlots?: Category[];
}): Promise<{
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
  assistantMode: 'ai-assisted' | 'catalog';
}> {
  const base = buildCatalogLook({ vibe, frame, budget, customMaxCents, currentItems, mode, seed, avoidProductIds, targetSlots: selectedTargetSlots });
  const vibeConfig = VIBES.find((entry) => entry.id === vibe) || VIBES[0];
  const existingItems = currentItems || {};
  const targetSlots = resolveTargetSlots(mode, vibe, vibeConfig.slots, existingItems, selectedTargetSlots, seed);
  const currentIds = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );
  const usedIds = new Set<string>();
  const usedBrands = new Set(
    Object.values(existingItems)
      .filter((product): product is Product => Boolean(product))
      .map((product) => normalize(product.brand)),
  );
  const avoidIds = new Set([
    ...avoidProductIds,
    ...(mode === 'starter' || mode === 'refresh' || mode === 'full' ? Array.from(currentIds) : []),
  ]);
  const collections = getCollectionsFor(vibe, frame);
  const chosenCollection = collections.length
    ? collections[(stableHash(`${vibe}:${frame}:${budget}:${customMaxCents || 0}:ai`) + Math.abs(seed || 0)) % collections.length] || collections[0] || null
    : null;
  const collectionCandidates = dedupeProducts(
    [
      ...(chosenCollection ? getCollectionProducts(chosenCollection) : []),
      ...collections.flatMap((collection) => getCollectionProducts(collection)),
    ],
  );
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const picked: Partial<Record<Category, Product>> = {};

  for (const slot of targetSlots) {
    if (mode === 'missing' && existingItems[slot]) continue;

    const candidatePool = getSlotCandidates({
      slot,
      vibe,
      frame,
      budget,
      customMaxCents,
      usedIds,
      avoidIds,
      currentIds,
      currentProductId: existingItems[slot]?.id,
      usedBrands,
      selectedProducts: Object.values(picked).filter((product): product is Product => Boolean(product)),
      collectionCandidates,
    });

    if (!candidatePool.length) continue;
    const photoFirstPool = candidatePool.filter(hasRealPhoto);
    const rankingPool = photoFirstPool.length ? photoFirstPool : candidatePool;

    const query = vibeSearchQuery(vibe, slot, budget, frame, customMaxCents);
    const intent = parseSearchIntentHeuristic(query, slot);
    intent.priceMax = Number.isFinite(getBudgetMaxCents(budget, customMaxCents))
      ? getBudgetMaxCents(budget, customMaxCents) / 100
      : null;
    intent.priceMin = null;
    const ranked = await rerankProducts(query, intent, rankingPool, Math.min(12, rankingPool.length));
    const variedRanked = ranked.filter((product) => !usedIds.has(product.id));
    const chosen =
      chooseVariedCandidate(variedRanked, seed, `${vibe}:${frame}:${budget}:${customMaxCents || 0}:${slot}:ai`)
      || variedRanked[0]
      || rankingPool[0];

    if (slot === 'jewelry') {
      debugGenerator('ai-jewelry-candidates', {
        vibe,
        frame,
        mode,
        selected: targetSlots.includes('jewelry'),
        candidateCount: candidatePool.length,
        rankedCount: variedRanked.length,
        currentProductId: existingItems.jewelry?.id || null,
      });
    }

    debugGenerator('ai-slot', {
      vibe,
      mode,
      slot,
      candidateCount: candidatePool.length,
      rankedCount: variedRanked.length,
      currentProductId: existingItems[slot]?.id || null,
      currentAvoided: Boolean(existingItems[slot]?.id && chosen?.id !== existingItems[slot]?.id),
      chosen: chosen ? `${chosen.brand} ${chosen.name}` : null,
      chosenId: chosen?.id || null,
    });

    if (!chosen) {
      if (slot === 'jewelry') {
        debugGenerator('ai-jewelry-skipped', {
          vibe,
          frame,
          mode,
          reason: candidatePool.length ? 'rerank/selection returned no product' : 'no eligible jewelry candidates',
        });
      }
      continue;
    }
    if (slot === 'jewelry') {
      debugGenerator('ai-jewelry-chosen', {
        vibe,
        frame,
        mode,
        chosenId: chosen.id,
        chosen: `${chosen.brand} ${chosen.name}`,
      });
    }
    picked[slot] = chosen;
    usedIds.add(chosen.id);
    usedBrands.add(normalize(chosen.brand));
  }

  const mergedProducts = {
    ...base.products,
    ...picked,
  };

  for (const slot of targetSlots) {
    const current = mergedProducts[slot];
    if (!current) continue;
    if (!isUnderBudget(current, budget, customMaxCents)) {
      delete mergedProducts[slot];
    }
  }

  for (const slot of targetSlots) {
    const current = mergedProducts[slot];
    if (!current || hasRealPhoto(current)) continue;
    const replacement = findRealPhotoReplacement(current, budget, customMaxCents, usedIds);
    if (!replacement) continue;
    mergedProducts[slot] = replacement;
    usedIds.add(replacement.id);
  }

  const missingSlots = targetSlots.filter((slot) => !mergedProducts[slot] && !(mode === 'missing' && existingItems[slot]));

  return {
    products: mergedProducts,
    collection: base.collection,
    missingSlots,
    assistantMode: aiEnabled ? 'ai-assisted' : 'catalog',
  };
}
