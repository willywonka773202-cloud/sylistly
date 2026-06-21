import clientCatalogData from '@/data/client-catalog.json';
import {
  hasExactProductLink,
  hasProductCommerceLink,
  isEditorialCutoutProduct,
  isMultiItemSetProduct,
  sortTransparentFeedRenderableProducts,
} from '@/lib/product-image-quality';
import { hasFrameMismatch } from '@/lib/frame-inference';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { getBudgetMaxCents, type GeneratorBudget, type GeneratorFrame, type VibeId } from '@/lib/vibes';
import { colorHarmonyScore } from '@/lib/color-harmony';
import { formalityCoherenceScore, fabricCoherenceScore } from '@/lib/outfit-coherence';
import { cleanProductName, cleanBrand } from '@/lib/product-name';

type GeneratorMode = 'starter' | 'missing' | 'refresh' | 'full';

export interface CatalogCollection {
  id: string;
  label: string;
  vibe: VibeId;
  frame: GeneratorFrame | 'all';
  blurb: string;
  queryHint: string;
  productIds: string[];
}

interface CollectionDefinition extends Omit<CatalogCollection, 'productIds'> {
  seed: number;
  categories: Category[];
  keywords: string[];
}

interface OutfitFormula {
  id: string;
  label: string;
  structure: string;
  reason: string;
  vibeIds: VibeId[];
  required: Category[];
  optional: Category[];
  prefer: Partial<Record<Category | 'all', string[]>>;
  avoid?: Partial<Record<Category | 'all', string[]>>;
}

const REQUIRED_SLOTS: Category[] = ['top', 'bottom', 'shoes'];
const STARTER_CATEGORY_ORDER: Category[] = ['top', 'outer', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];
const PICK_ORDER: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];
const FEATURED_CATALOG_ORDER: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];
const FEATURED_BRAND_CAP_PASSES = [2, 4, 8, Number.POSITIVE_INFINITY];
const FEATURED_CATEGORY_BRAND_CAP_PASSES = [1, 2, 4, Number.POSITIVE_INFINITY];

type StyleRule = {
  prefer?: string[];
  avoid?: string[];
  hardAvoid?: string[];
};

const CLIENT_VIBE_RULES: Record<VibeId, Partial<Record<Category | 'all', StyleRule>>> = {
  clean: {
    all: {
      prefer: ['minimal', 'clean', 'plain', 'neutral', 'simple', 'quiet luxury', 'classic'],
      avoid: ['statement', 'chunky chain', 'western'],
      hardAvoid: ['graphic', 'neon', 'cowboy', 'techwear', 'hiking', 'running', 'workout'],
    },
    shoes: { prefer: ['loafer', 'flat', 'sneaker', 'samba', 'air force'], hardAvoid: ['western boot', 'cowboy boot', 'training shoe'] },
  },
  street: {
    all: {
      prefer: ['streetwear', 'hoodie', 'cargo', 'denim', 'oversized', 'cap', 'sneaker', 'crossbody'],
      avoid: ['formal', 'office', 'heel', 'pump'],
      hardAvoid: ['blazer suit', 'dress pants', 'pumps'],
    },
    shoes: { prefer: ['sneaker', 'samba', 'campus', 'gazelle', 'air force', 'new balance', 'adidas', 'nike'], avoid: ['loafer', 'heel'] },
  },
  gym: {
    all: {
      prefer: ['gym', 'training', 'running', 'workout', 'performance', 'athletic', 'sport'],
      hardAvoid: ['blazer', 'trench', 'suit', 'loafer', 'dress pants', 'work pants', 'cardigan', 'heels', 'pumps', 'leather shoulder bag', 'luxury handbag', 'ugg', 'western', 'denim jacket', 'suede jacket', 'halter', 'cami', 'camisole', 'crop top', 'cropped top', 'sculpted top', 'babaton', 'wilfred', 'techwear', 'derby'],
    },
    top: { prefer: ['training', 'workout', 'running', 'performance', 'sports bra', 'tank', 'tee', 'mesh', 'airism'], hardAvoid: ['sweater polo', 'button down', 'dress shirt', 'oxford', 'cable knit', 'halter', 'cami', 'camisole', 'crop top', 'cropped top', 'sculpted top', 'sheer', 'kite top', 'plunge', 'tube top', 'chiffon', 'wrap top'] },
    bottom: { prefer: ['shorts', 'leggings', 'jogger', 'sweatpant', 'track pant', 'training'], avoid: ['cargo', 'cargo pant'], hardAvoid: ['trouser', 'chino', 'jean', 'work pant'] },
    outer: { prefer: ['track jacket', 'training jacket', 'performance jacket', 'windbreaker', 'nylon', 'shell', 'quarter zip', 'running'], hardAvoid: ['denim', 'suede', 'leather', 'blazer', 'cardigan', 'coat', 'detroit jacket', 'duck', 'carhartt', 'techwear'] },
    shoes: { prefer: ['running', 'training', 'trainer', 'sneaker'], avoid: ['samba', 'campus', 'air force', 'jordan', 'chuck', 'converse', 'gazelle'], hardAvoid: ['boot', 'clog', 'heel', 'loafer', 'sandal', 'ugg', 'birkenstock', 'boston', 'arizona', 'derby', 'dress shoe', 'lug sole', 'wallabee'] },
    bag: { prefer: ['duffel', 'backpack', 'gym bag', 'training bag', 'tote'], hardAvoid: ['super puff', 'longchamp', 'michael kors', 'straw'] },
    jewelry: { hardAvoid: ['necklace', 'earring', 'bracelet', 'ring', 'chain', 'pendant'] },
  },
  office: {
    all: {
      prefer: ['office', 'tailored', 'business casual', 'smart', 'polished'],
      hardAvoid: ['track jacket', 'sweatpants', 'cargo pants', 'gym shorts', 'running shoes', 'ugg', 'graphic tee', 'training', 'workout', 'western'],
    },
    top: { prefer: ['button down', 'shirt', 'polo', 'sweater', 'knit', 'blouse'], hardAvoid: ['graphic tee', 'tank', 'sports bra', 'workout'] },
    bottom: { prefer: ['trouser', 'chino', 'tailored', 'pant', 'pleated'], hardAvoid: ['cargo', 'sweatpant', 'shorts', 'legging', 'track pant'] },
    shoes: { prefer: ['loafer', 'flat', 'dress shoe', 'chelsea', 'oxford', 'ballet'], hardAvoid: ['ugg', 'running', 'training', 'hiking', 'basketball', 'western boot', 'cowboy boot', 'birkenstock'] },
    bag: { prefer: ['tote', 'work bag', 'brief', 'crossbody', 'satchel'], avoid: ['gym bag', 'duffel'] },
  },
  night: {
    all: {
      prefer: ['night out', 'dressy', 'sleek', 'black', 'leather', 'satin', 'polished'],
      hardAvoid: ['work pants', 'cargo work', 'hiking', 'technical shell', 'running shoe', 'training shoe', 'ugg', 'beanie', 'sweatpants', 'track jacket'],
    },
    shoes: { prefer: ['heel', 'boot', 'loafer', 'dress shoe', 'flat', 'ballet', 'slingback', 'mary jane', 'chelsea'], hardAvoid: ['ugg', 'work boot', 'running', 'training', 'hiking', 'sandal', 'clog', 'birkenstock'] },
    bag: { prefer: ['shoulder', 'mini', 'crossbody', 'clutch', 'hobo'], hardAvoid: ['gym bag', 'duffel'] },
  },
  date: {
    all: {
      prefer: ['date', 'dressy', 'romantic', 'sleek', 'black', 'leather', 'satin', 'polished'],
      hardAvoid: ['work pants', 'cargo work', 'hiking', 'technical shell', 'running shoe', 'training shoe', 'ugg', 'beanie', 'sweatpants', 'track jacket'],
    },
    shoes: { prefer: ['heel', 'boot', 'loafer', 'flat', 'ballet', 'slingback', 'mary jane', 'chelsea'], hardAvoid: ['ugg', 'work boot', 'running', 'training', 'hiking', 'clog', 'western boot', 'cowboy boot'] },
    bag: { prefer: ['shoulder', 'mini', 'crossbody', 'clutch', 'hobo'], avoid: ['duffel', 'backpack'] },
  },
  vacation: {
    all: {
      prefer: ['linen', 'summer', 'resort', 'vacation', 'beach', 'sandal', 'straw', 'sunglasses'],
      hardAvoid: ['beanie', 'puffer', 'heavy boot', 'winter coat', 'trench coat', 'tech shell', 'shell jacket', 'work pants', 'fleece', 'wool coat', 'arcteryx', 'arc teryx', 'atom jacket', 'beta lt', 'western', 'cowboy'],
    },
    top: { prefer: ['linen', 'tank', 'tee', 'shirt', 'camp collar', 'resort', 'cotton'], hardAvoid: ['cardigan', 'sweater', 'hoodie', 'thermal', 'performance'] },
    bottom: { prefer: ['shorts', 'linen pant', 'easy pant', 'skirt'], hardAvoid: ['work pants', 'wool trouser', 'fleece', 'sweatpant', 'double knee'] },
    shoes: { prefer: ['sandal', 'slide', 'espadrille', 'sneaker', 'loafer'], hardAvoid: ['heavy boot', 'winter boot', 'ugg', 'hiking boot'] },
    hat: { prefer: ['straw', 'bucket', 'cap', 'sun hat'], hardAvoid: ['beanie', 'pom knit', 'knit hat', 'cuffed knit'] },
    bag: { prefer: ['tote', 'straw', 'canvas', 'beach bag', 'shoulder bag'], hardAvoid: ['cassette', 'tech cassette', 'belt bag', 'backpack', 'dress size', 'hat and jewelry set'] },
    jewelry: { prefer: ['bracelet', 'necklace', 'earring', 'ring', 'gold', 'shell'], avoid: ['tennis necklace', 'matrix', 'toe ring'] },
  },
  cozy: {
    all: {
      prefer: ['cozy', 'winter', 'knit', 'puffer', 'hoodie', 'sweatpant', 'boot', 'beanie'],
      hardAvoid: ['linen', 'beach', 'sandal', 'heel', 'pumps', 'satin'],
    },
    jewelry: { hardAvoid: ['statement', 'necklace', 'earring', 'bracelet', 'ring', 'chain', 'pendant'] },
  },
  preppy: {
    all: {
      prefer: ['polo', 'cardigan', 'sweater', 'chino', 'loafer', 'pleated', 'blazer', 'cable knit', 'classic'],
      hardAvoid: ['techwear', 'shell jacket', 'oversized streetwear', 'work pants', 'gym', 'training', 'ugg', 'cargo pants', 'western'],
    },
    bottom: { prefer: ['chino', 'trouser', 'pleated', 'skirt', 'tailored'], hardAvoid: ['cargo', 'sweatpant', 'work pants'] },
    shoes: { prefer: ['loafer', 'flat', 'dress shoe', 'sneaker'], hardAvoid: ['ugg', 'hiking', 'work boot', 'running'] },
  },
  edgy: {
    all: {
      prefer: ['black', 'leather', 'cargo', 'boot', 'shell', 'crossbody', 'silver', 'utility', 'techwear'],
      hardAvoid: ['beach', 'linen', 'old money', 'preppy', 'sandal', 'straw', 'polo sweater'],
    },
    outer: { prefer: ['shell', 'leather', 'bomber', 'utility', 'technical'], hardAvoid: ['blazer', 'cardigan', 'western denim'] },
    top: { prefer: ['mesh', 'tee', 'technical', 'utility', 'black', 'mock neck', 'long sleeve'], hardAvoid: ['tube top', 'halter', 'cami', 'camisole', 'chiffon', 'wrap top', 'satin', 'blouse'] },
    bottom: { prefer: ['cargo', 'black jean', 'utility', 'parachute'], hardAvoid: ['chino', 'pleated trouser', 'linen'] },
    shoes: { prefer: ['boot', 'technical sneaker', 'sneaker', 'black'], avoid: ['samba', 'campus', 'air force', 'af1', 'gazelle'], hardAvoid: ['loafer', 'sandal', 'espadrille', 'ugg', 'heel', 'pump'] },
    bag: { prefer: ['crossbody', 'sling', 'utility', 'messenger'], hardAvoid: ['straw', 'luxury handbag', 'tabby', 'michael kors', 'coach tabby', 'bottega', 'cassette', 'polene'] },
  },
};

const STRICT_SOFT_AVOID_SLOTS: Partial<Record<VibeId, Category[]>> = {
  gym: ['bottom', 'shoes', 'bag'],
  office: ['shoes', 'bag'],
  edgy: ['shoes', 'bag'],
};

const FRAME_HARD_AVOID_TERMS: Partial<Record<GeneratorFrame, Partial<Record<Category | 'all', string[]>>>> = {
  masc: {
    all: ['women', 'womens', 'wmns', 'girl', 'girls'],
    top: [
      'cami',
      'camisole',
      'tube top',
      'halter',
      'sculpted halter',
      'deep plunge',
      'plunge top',
      'wrap top',
      'chiffon top',
      'corset',
      'bralette',
      'bandeau',
      'crop top',
      'cropped top',
    ],
    bottom: ['skirt', 'mini skirt', 'skort', 'ditsy floral', 'skims'],
    shoes: ['slingback', 'heel', 'pumps', 'ballet flats', 'mary jane'],
    jewelry: ['earrings', 'stud earring', 'hoop earrings'],
  },
  fem: {
    all: ['men s', 'mens', 'boys'],
    top: ['men s', 'mens oversized', 'men oversized', 'men regular fit', 'men wavy', 'men contrast'],
    bottom: ['men s', 'mens', 'men relaxed fit', 'men original', 'men double knee'],
    outer: ['men s', 'mens', 'men atom', 'men jacket', 'men coat'],
    shoes: ['men s', 'mens'],
  },
};

const VIBE_SLOT_MAP: Record<VibeId, Category[]> = {
  night: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  street: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  clean: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  gym: ['top', 'bottom', 'shoes', 'outer', 'hat', 'bag'],
  cozy: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'],
  date: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  office: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  vacation: ['hat', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
  edgy: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  preppy: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'],
};

const FORMULAS: OutfitFormula[] = [
	  {
	    id: 'clean-elevated',
    label: 'Clean Elevated',
    structure: 'quiet layer + simple top + polished bottom + clean shoe',
    reason: 'The outfit stays minimal, linked, and easy to remix because each piece has a clear role.',
    vibeIds: ['clean', 'office', 'preppy'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'bag', 'eyewear', 'jewelry'],
	    prefer: { all: ['clean', 'minimal', 'neutral', 'quiet', 'classic'], outer: ['blazer', 'jacket', 'coat'], shoes: ['loafer', 'sneaker', 'flat'] },
	    avoid: { all: ['graphic', 'neon', 'western', 'cowboy', 'techwear', 'training'] },
	  },
  {
    id: 'travel-airport',
    label: 'Travel Airport',
    structure: 'soft layer + comfortable bottom + easy shoe + carry bag',
    reason: 'Comfort pieces are balanced with a structured accessory so the look reads intentional.',
    vibeIds: ['clean', 'cozy', 'vacation'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'bag', 'hat'],
	    prefer: { all: ['travel', 'airport', 'cozy', 'soft', 'neutral'], bag: ['tote', 'carry', 'shoulder'] },
	    avoid: { all: ['heel', 'pump', 'satin', 'western', 'cowboy'] },
	  },
  {
    id: 'streetwear-sneaker-led',
    label: 'Sneaker-Led Street',
    structure: 'statement shoe + relaxed bottom + casual top + optional layer',
    reason: 'The shoe anchors the board while the clothing keeps a streetwear silhouette.',
    vibeIds: ['street', 'edgy'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'hat', 'bag', 'eyewear'],
	    prefer: { all: ['street', 'sneaker', 'cargo', 'oversized', 'hoodie', 'black'], shoes: ['samba', 'air force', 'sneaker'] },
	    avoid: { all: ['office', 'formal', 'dress pant', 'pump'] },
	  },
  {
    id: 'campus-cozy',
    label: 'Campus Cozy',
    structure: 'easy top + relaxed bottom + sneaker + soft layer',
    reason: 'Relaxed pieces make the fit wearable without losing a styled composition.',
    vibeIds: ['street', 'cozy', 'gym'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'hat', 'bag'],
	    prefer: { all: ['campus', 'cozy', 'relaxed', 'sweatshirt', 'knit', 'sneaker'] },
	    avoid: { all: ['heel', 'pump', 'formal', 'satin'] },
	  },
  {
    id: 'night-out',
    label: 'Night Out',
    structure: 'dark top + polished bottom + elevated shoe + shine',
    reason: 'Darker pieces and accessories add night-out polish while preserving real product links.',
    vibeIds: ['night', 'date', 'edgy'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'bag', 'jewelry'],
	    prefer: { all: ['night', 'black', 'leather', 'dressy', 'satin'], shoes: ['heel', 'boot', 'loafer'] },
	    avoid: { all: ['gym', 'training', 'running', 'workout', 'sweatpant', 'beanie', 'hiking', 'western'] },
	  },
  {
    id: 'date-polished',
    label: 'Date Polished',
    structure: 'fitted top + sharp bottom + good shoe + compact accessory',
    reason: 'A fitted anchor and cleaner accessories make the board feel ready for dinner.',
    vibeIds: ['date', 'night'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'bag', 'jewelry'],
	    prefer: { all: ['date', 'polished', 'romantic', 'black', 'cream'], bag: ['shoulder', 'mini', 'clutch'] },
	    avoid: { all: ['gym', 'training', 'running', 'workout', 'sweatpant', 'hiking', 'western'] },
	  },
  {
    id: 'gym-training',
    label: 'Gym Training',
    structure: 'performance top + active bottom + training shoe',
    reason: 'Athletic products stay practical, clean, and commerce-backed.',
    vibeIds: ['gym'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'hat', 'bag'],
	    prefer: { all: ['gym', 'training', 'performance', 'active', 'track', 'sport'], shoes: ['running', 'training', 'sneaker'] },
	    avoid: { all: ['blazer', 'satin', 'dressy', 'loafer', 'heel', 'pump', 'western', 'cowboy'] },
	  },
  {
    id: 'active-errands',
    label: 'Active Errands',
    structure: 'clean tee/hoodie + sweat or nylon bottom + everyday sneaker',
    reason: 'The look stays active and comfortable, but reads more like a styled off-duty fit than a repeated training set.',
    vibeIds: ['gym'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'hat', 'bag'],
    prefer: {
      all: ['active', 'sport', 'sneaker', 'sweatpant', 'nylon', 'tee', 'hoodie', 'cap'],
      outer: ['hoodie', 'windbreaker', 'fleece', 'zip', 'nylon'],
      top: ['tee', 'tank', 'hoodie', 'airism', 'mesh'],
      bottom: ['sweatpant', 'shorts', 'track', 'nylon', 'jogger'],
      shoes: ['sneaker', 'running', 'trainer', 'new balance', 'nike', 'adidas'],
      bag: ['tote', 'backpack', 'sling', 'duffel'],
      hat: ['cap', 'trucker', 'snapback'],
    },
    avoid: {
      all: ['blazer', 'satin', 'dressy', 'loafer', 'heel', 'pump', 'leather shoulder bag'],
      shoes: ['samba', 'campus', 'air force', 'gazelle', 'converse', 'chuck', 'jordan'],
      jewelry: ['necklace', 'bracelet', 'ring', 'earring'],
    },
  },
  {
    id: 'office-smart-casual',
    label: 'Office Smart Casual',
    structure: 'tailored layer + clean top + trouser + refined shoe',
    reason: 'Tailored shapes and neutral pieces make this fit feel work-ready instead of random.',
    vibeIds: ['office', 'clean', 'preppy'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'bag', 'jewelry'],
	    prefer: { all: ['office', 'workwear', 'tailored', 'trouser', 'button', 'blazer'], shoes: ['loafer', 'flat', 'dress'] },
	    avoid: { all: ['gym', 'training', 'running', 'sweatpant', 'cargo pant', 'western', 'cowboy', 'ugg'] },
	  },
  {
    id: 'vacation-resort',
    label: 'Vacation Resort',
    structure: 'light top + easy bottom + warm-weather shoe + sun accessory',
    reason: 'Lighter pieces and accessories keep the look destination-ready.',
    vibeIds: ['vacation'],
    required: REQUIRED_SLOTS,
    optional: ['hat', 'bag', 'eyewear', 'jewelry'],
	    prefer: { all: ['vacation', 'resort', 'linen', 'summer', 'beach', 'sandal'], eyewear: ['sunglasses'] },
	    avoid: { all: ['puffer', 'winter', 'beanie', 'fleece', 'wool', 'heavy boot', 'work pants'] },
	  },
  {
    id: 'old-money-knit',
    label: 'Old Money Knit',
    structure: 'classic knit + tailored bottom + loafer/sneaker + structured accessory',
    reason: 'Classic proportions give the outfit a refined, Fits-style board read.',
    vibeIds: ['preppy', 'clean', 'office'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'bag', 'eyewear', 'jewelry'],
	    prefer: { all: ['preppy', 'classic', 'knit', 'polo', 'tailored', 'loafer', 'old money'] },
	    avoid: { all: ['techwear', 'training', 'cargo pant', 'western', 'cowboy'] },
	  },
  {
    id: 'techwear-utility',
    label: 'Techwear Utility',
    structure: 'dark layer + utility bottom + technical shoe + compact bag',
    reason: 'Black utility pieces create a stronger visual identity while staying real and shoppable.',
    vibeIds: ['edgy', 'street'],
    required: REQUIRED_SLOTS,
    optional: ['outer', 'bag', 'hat', 'eyewear'],
	    prefer: { all: ['black', 'utility', 'technical', 'cargo', 'edgy'], bag: ['crossbody', 'sling', 'messenger'] },
	    avoid: { all: ['linen', 'beach', 'preppy', 'old money', 'sandal', 'straw'] },
	  },
];

const COLLECTION_DEFS: CollectionDefinition[] = [
  { id: 'clean-femme-capsule', label: 'Clean capsule', vibe: 'clean', frame: 'fem', blurb: 'Minimal real cutouts with soft polish.', queryHint: 'minimal', seed: 11, categories: ['outer', 'top', 'bottom', 'shoes', 'bag'], keywords: ['clean', 'minimal', 'neutral', 'polished'] },
  { id: 'street-any-sneaker', label: 'Sneaker-led street', vibe: 'street', frame: 'all', blurb: 'A shoe-first street board with remixable layers.', queryHint: 'sneaker', seed: 23, categories: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'], keywords: ['street', 'sneaker', 'black', 'cargo'] },
  { id: 'office-any-soft', label: 'Soft workday', vibe: 'office', frame: 'all', blurb: 'Tailored pieces without a stiff office read.', queryHint: 'tailored', seed: 37, categories: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'], keywords: ['office', 'workwear', 'tailored', 'trouser'] },
  { id: 'date-femme-polish', label: 'Date polish', vibe: 'date', frame: 'fem', blurb: 'Dinner-ready pieces with compact accessories.', queryHint: 'date', seed: 41, categories: ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'], keywords: ['date', 'night', 'black', 'polished'] },
  { id: 'cozy-any-weekend', label: 'Weekend layers', vibe: 'cozy', frame: 'all', blurb: 'Soft layers and easy proportions for off-duty saves.', queryHint: 'cozy', seed: 53, categories: ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'], keywords: ['cozy', 'weekend', 'soft', 'sweater'] },
  { id: 'vacation-any-light', label: 'Light vacation', vibe: 'vacation', frame: 'all', blurb: 'Warm-weather pieces, no fake product imagery.', queryHint: 'resort', seed: 67, categories: ['hat', 'top', 'bottom', 'shoes', 'bag', 'eyewear'], keywords: ['vacation', 'resort', 'summer', 'linen'] },
  { id: 'preppy-any-city', label: 'Preppy city', vibe: 'preppy', frame: 'all', blurb: 'Classic shapes with sharper accessories.', queryHint: 'preppy', seed: 79, categories: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'], keywords: ['preppy', 'classic', 'knit', 'loafer'] },
  { id: 'edgy-any-black', label: 'Black edit', vibe: 'edgy', frame: 'all', blurb: 'Darker utility pieces arranged as a clean fashion board.', queryHint: 'black', seed: 83, categories: ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear'], keywords: ['black', 'edgy', 'leather', 'utility'] },
];

function normalize(value?: string | null): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function productText(product: Product): string {
  return normalize([
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
    ...(product.colors || []),
    product.category,
  ].filter(Boolean).join(' '));
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hasAnyTerm(text: string, terms: string[] = []): boolean {
  return terms.some((term) => text.includes(normalize(term)));
}

function matchedTermCount(text: string, terms: string[] = []): number {
  return terms.reduce((count, term) => count + (text.includes(normalize(term)) ? 1 : 0), 0);
}

function ruleTerms(vibe: VibeId, category: Category, key: keyof StyleRule): string[] {
  return [
    ...(CLIENT_VIBE_RULES[vibe]?.all?.[key] || []),
    ...(CLIENT_VIBE_RULES[vibe]?.[category]?.[key] || []),
  ];
}

function hasStrictSoftAvoid(product: Product, vibe: VibeId, category: Category): boolean {
  if (!STRICT_SOFT_AVOID_SLOTS[vibe]?.includes(category)) return false;
  return hasAnyTerm(productText(product), ruleTerms(vibe, category, 'avoid'));
}

function scoreClientVibeFit(product: Product, vibe: VibeId): number {
  const text = productText(product);
  const prefer = ruleTerms(vibe, product.category, 'prefer');
  const avoid = ruleTerms(vibe, product.category, 'avoid');
  const hardAvoid = ruleTerms(vibe, product.category, 'hardAvoid');

  return matchedTermCount(text, prefer) * 30
    - matchedTermCount(text, avoid) * 86
    - matchedTermCount(text, hardAvoid) * 2600;
}

function scoreClientCompatibility(product: Product, vibe: VibeId, selectedProducts: Product[] = []): number {
  if (!selectedProducts.length) return 0;
  const text = productText(product);
  const selectedTexts = selectedProducts.map(productText);
  const selected = selectedTexts.join(' ');
  const selectedHas = (terms: string[]) => hasAnyTerm(selected, terms);
  const productHas = (terms: string[]) => hasAnyTerm(text, terms);
  let score = 0;

  if (selectedHas(['blazer', 'trouser', 'office', 'tailored', 'loafer']) && productHas(['running', 'gym', 'workout', 'sweatpants', 'gym shorts'])) score -= 72;
  if (selectedHas(['hoodie', 'cargo', 'sneaker', 'cap', 'denim']) && productHas(['heel', 'pumps', 'formal', 'satin']) && ['street', 'gym', 'cozy'].includes(vibe)) score -= 52;
  if (selectedHas(['puffer', 'winter', 'fleece', 'beanie']) && productHas(['sandal', 'linen', 'beach'])) score -= 58;
  if (selectedHas(['linen', 'beach', 'vacation', 'resort']) && productHas(['puffer', 'winter', 'boot', 'fleece'])) score -= 58;
  if (selectedHas(['linen', 'straw', 'resort', 'sandal']) && productHas(['linen', 'straw', 'resort', 'sandal', 'shorts'])) score += 24;
  if (selectedHas(['black', 'leather', 'sleek']) && productHas(['black', 'leather', 'sleek', 'silver', 'chain'])) score += 18;
  if (vibe === 'clean' && productHas(['graphic', 'neon', 'statement', 'western', 'techwear'])) score -= 50;
  if ((vibe === 'gym' || vibe === 'cozy') && productHas(['heel', 'pumps', 'satin', 'dressy'])) score -= 50;
  if ((vibe === 'night' || vibe === 'date') && productHas(['running', 'gym', 'workout', 'sweatpants'])) score -= 50;

  score += colorHarmonyScore(text, selected);
  score += formalityCoherenceScore(text, selectedTexts);
  score += fabricCoherenceScore(text, selectedTexts);
  return score;
}

function scoreClientFrameFit(product: Product, frame: GeneratorFrame | 'all'): number {
  if (frame === 'all') return 0;
  const text = productText(product);
  const terms = [
    ...(FRAME_HARD_AVOID_TERMS[frame]?.all || []),
    ...(FRAME_HARD_AVOID_TERMS[frame]?.[product.category] || []),
  ];
  const hardHits = matchedTermCount(text, terms);
  if (!hardHits) return 0;
  return hardHits * -3200;
}

function orderCategoriesForPicking(categories: Category[]): Category[] {
  return PICK_ORDER.filter((category) => categories.includes(category));
}

export function isCleanClientCatalogProduct(product?: Product | null): product is Product {
  return Boolean(
    product
      && isEditorialCutoutProduct(product)
      && hasProductCommerceLink(product)
      && !isMultiItemSetProduct(product)
      && product.imageTransparentUrl,
  );
}

export const ALL_CATALOG_PRODUCTS: Product[] = sortTransparentFeedRenderableProducts(
  (clientCatalogData as Product[])
    .filter(isCleanClientCatalogProduct)
    // Clean redundant brand-in-name (36% of names) + trailing size tokens once at
    // the source, so every surface (feed, builder, saved, shared, AI looks — which
    // resolve from this array by id) shows polished names. Scoring is unaffected:
    // productText still has the brand via the separate brand field.
    // name uses the ORIGINAL brand (to strip a redundant prefix); brand is then
    // cleaned of domain TLDs for display.
    .map((product) => ({
      ...product,
      name: cleanProductName(product.name, product.brand),
      brand: cleanBrand(product.brand),
    })),
);

export const CLIENT_CATALOG_PRODUCTS = ALL_CATALOG_PRODUCTS;

const PRODUCT_BY_ID = new Map(ALL_CATALOG_PRODUCTS.map((product) => [product.id, product]));
const PRODUCT_IDS = new Set(PRODUCT_BY_ID.keys());

function scoreProduct(product: Product, {
  vibe,
  frame,
  budget,
  customMaxCents,
  category,
  seed,
  keywords = [],
  usedIds,
  avoidIds,
  recentShoeIds,
  recentBrandCounts,
  formula,
  selectedProducts,
}: {
  vibe: VibeId;
  frame: GeneratorFrame | 'all';
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  category?: Category;
  seed: number;
  keywords?: string[];
  usedIds?: Set<string>;
  avoidIds?: Set<string>;
  recentShoeIds?: Set<string>;
  recentBrandCounts?: Record<string, number>;
  formula?: OutfitFormula;
  selectedProducts?: Product[];
}): number {
  if (category && product.category !== category) return -10_000;
  if (usedIds?.has(product.id) || avoidIds?.has(product.id)) return -9_000;
  // HARD frame constraint: a gender-mismatched product (e.g. a skirt/heels for a
  // masc frame) is REMOVED from the pool, not merely de-ranked — so menswear can
  // never compose a women-only piece, and vice versa. Androgynous allows all.
  if (frame !== 'all' && hasFrameMismatch(product, frame)) return -10_000;

  const text = productText(product);
  const maxCents = getBudgetMaxCents(budget, customMaxCents);
  let score = 100;

  if (Number.isFinite(maxCents) && product.priceCents > maxCents) score -= 80 + Math.min(60, Math.round((product.priceCents - maxCents) / 1500));
  if (product.priceCents > 0) score += 4;
  if (product.imageQuality === 'good') score += 18;
  // Prefer directly-shoppable pieces (a real product page) over google-shopping
  // search fallbacks, so generated looks have a higher "X/N shoppable" ratio —
  // more pieces a user can actually buy (~55% of the catalog lacks a direct
  // link). Modest (tie-breaker) so it never overrides vibe (+36) or coordination.
  if (hasExactProductLink(product)) score += 14;
  if (product.metadata?.featured) score += 8;
  if (product.vibes?.includes(vibe) || product.occasions?.includes(vibe)) score += 36;
  if (text.includes(vibe)) score += 18;
  if (hasAnyTerm(text, keywords)) score += 30;
  score += scoreClientVibeFit(product, vibe);
  score += scoreClientFrameFit(product, frame);
  score += scoreClientCompatibility(product, vibe, selectedProducts);

  const formulaTerms = [...(formula?.prefer.all || []), ...(formula?.prefer[product.category] || [])];
  if (hasAnyTerm(text, formulaTerms)) score += 42;
  const formulaAvoidTerms = [...(formula?.avoid?.all || []), ...(formula?.avoid?.[product.category] || [])];
  if (hasAnyTerm(text, formulaAvoidTerms)) score -= 260;

  if (frame === 'masc') {
    if (hasAnyTerm(text, ['aritzia', 'babaton', 'wilfred', 'wmns'])) score -= 420;
    if (product.category === 'jewelry' && hasAnyTerm(text, ['earring', 'earrings', 'hoop'])) score -= 130;
  }

  if (frame === 'fem' && hasAnyTerm(text, ['men s', 'mens'])) {
    score -= 420;
  }

  if (frame !== 'all') {
    if (product.gender?.includes(frame)) score += 16;
    else if (product.gender?.includes('androgynous') || !product.gender?.length) score += 7;
    else score -= 24;
  }

  if (product.category === 'shoes' && recentShoeIds?.has(product.id)) score -= 260;

  const brandKey = getBrandOrMerchant(product);
  const selectedBrandMatches = brandKey
    ? (selectedProducts || []).filter((selected) => getBrandOrMerchant(selected) === brandKey).length
    : 0;
  if (brandKey && recentBrandCounts?.[brandKey]) {
    const recentCount = recentBrandCounts[brandKey];
    score -= recentCount * 120 + Math.max(0, recentCount - 1) * 180;
  }
  if (selectedBrandMatches > 0) {
    score -= selectedBrandMatches * 520 + Math.max(0, selectedBrandMatches - 1) * 720;
  }

  score += stableHash(`${product.id}:${vibe}:${frame}:${budget}:${category || 'all'}:${seed}`) % 37;
  return score;
}

function rankedCategoryProducts(category: Category, options: Parameters<typeof scoreProduct>[1]): Array<{ product: Product; score: number }> {
  const ranked = ALL_CATALOG_PRODUCTS
    .filter((product) => product.category === category)
    .map((product) => ({ product, score: scoreProduct(product, { ...options, category }) }))
    .filter((entry) => entry.score > -1000)
    .sort((left, right) => right.score - left.score);
  const cleanRanked = ranked.filter((entry) => !hasStrictSoftAvoid(entry.product, options.vibe, category));
  return cleanRanked.length >= 3 ? cleanRanked : ranked;
}

function pickProduct(category: Category, options: Parameters<typeof scoreProduct>[1]): Product | undefined {
  const bestDiverseProduct = (ranked: Array<{ product: Product; score: number }>): Product | undefined => {
    const selectedBrands = new Set((options.selectedProducts || []).map(getBrandOrMerchant).filter(Boolean));
    const heavyRecentBrands = new Set(
      Object.entries(options.recentBrandCounts || {})
        .filter(([, count]) => count >= 3)
        .map(([brand]) => brand),
    );
    return ranked.find((entry) => {
      const brand = getBrandOrMerchant(entry.product);
      return !brand || (!selectedBrands.has(brand) && !heavyRecentBrands.has(brand));
    })?.product
      || ranked.find((entry) => {
        const brand = getBrandOrMerchant(entry.product);
        return !brand || !selectedBrands.has(brand);
      })?.product
      || ranked[0]?.product;
  };

  const primary = bestDiverseProduct(rankedCategoryProducts(category, options));
  if (primary || !options.avoidIds?.size) return primary;

  // Narrow style settings can over-constrain a small reviewed catalog. Keep
  // `usedIds` and scoring penalties, but relax the hard avoid list for this
  // slot so generation returns a usable outfit instead of starving entirely.
  return bestDiverseProduct(rankedCategoryProducts(category, { ...options, avoidIds: new Set<string>() }));
}

function chooseFormula(vibe: VibeId, seed: number, preferredFormulaId?: string): OutfitFormula {
  const candidates = FORMULAS.filter((formula) => formula.vibeIds.includes(vibe));
  const pool = candidates.length ? candidates : FORMULAS;
  const preferred = preferredFormulaId ? pool.find((formula) => formula.id === preferredFormulaId) : undefined;
  if (preferred) return preferred;
  return pool[stableHash(`${vibe}:${seed}:formula`) % pool.length] || FORMULAS[0];
}

function categoriesForLook(vibe: VibeId, mode: GeneratorMode, formula: OutfitFormula, targetSlots?: Category[]): Category[] {
  if (targetSlots?.length) return CATEGORY_ORDER.filter((category) => targetSlots.includes(category));
  const base = Array.from(new Set([...formula.required, ...(VIBE_SLOT_MAP[vibe] || []), ...formula.optional]));
  const max = mode === 'starter' ? 5 : mode === 'missing' ? 6 : 7;
  return CATEGORY_ORDER.filter((category) => base.includes(category)).slice(0, max);
}

function productsForDefinition(definition: CollectionDefinition): Product[] {
  const usedIds = new Set<string>();
  const selected: Product[] = [];
  const recentBrandCounts: Record<string, number> = {};
  for (const category of definition.categories) {
    const product = pickProduct(category, {
      vibe: definition.vibe,
      frame: definition.frame,
      budget: 'any',
      seed: definition.seed + selected.length * 17,
      keywords: [definition.queryHint, ...definition.keywords],
      usedIds,
      recentBrandCounts,
      selectedProducts: selected,
    });
    if (!product) continue;
    usedIds.add(product.id);
    selected.push(product);
    const brand = getBrandOrMerchant(product);
    if (brand) recentBrandCounts[brand] = (recentBrandCounts[brand] || 0) + 1;
  }
  return selected;
}

export const LAUNCH_COLLECTIONS: CatalogCollection[] = COLLECTION_DEFS.map((definition) => ({
  ...definition,
  productIds: productsForDefinition(definition).map((product) => product.id),
}));

export function getCollectionProducts(collection: CatalogCollection): Product[] {
  return collection.productIds
    .map((id) => PRODUCT_BY_ID.get(id))
    .filter((product): product is Product => Boolean(product));
}

function selectBalancedCatalogProducts(
  products: Product[],
  limit: number,
  order: Category[] = FEATURED_CATALOG_ORDER,
): Product[] {
  const max = Math.max(0, Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 8);
  if (!max) return [];

  const pools = new Map<Category, Product[]>();
  for (const category of CATEGORY_ORDER) {
    pools.set(category, products.filter((product) => product.category === category));
  }

  const selected: Product[] = [];
  const usedIds = new Set<string>();
  const brandCounts = new Map<string, number>();
  const categoryBrandCounts = new Map<string, number>();

  const addProduct = (product: Product) => {
    selected.push(product);
    usedIds.add(product.id);
    const brand = getBrandOrMerchant(product);
    if (!brand) return;
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    const categoryBrandKey = `${product.category}:${brand}`;
    categoryBrandCounts.set(categoryBrandKey, (categoryBrandCounts.get(categoryBrandKey) || 0) + 1);
  };

  const pickFromCategory = (category: Category, brandCap: number, categoryBrandCap: number): boolean => {
    const pool = pools.get(category) || [];
    const product = pool.find((candidate) => {
      if (usedIds.has(candidate.id)) return false;
      const brand = getBrandOrMerchant(candidate);
      if (!brand) return true;
      if ((brandCounts.get(brand) || 0) >= brandCap) return false;
      if ((categoryBrandCounts.get(`${category}:${brand}`) || 0) >= categoryBrandCap) return false;
      return true;
    });
    if (!product) return false;
    addProduct(product);
    return true;
  };

  const categoryOrder = order.filter((category) => pools.get(category)?.length);
  for (let pass = 0; pass < FEATURED_BRAND_CAP_PASSES.length && selected.length < max; pass += 1) {
    const brandCap = FEATURED_BRAND_CAP_PASSES[pass];
    const categoryBrandCap = FEATURED_CATEGORY_BRAND_CAP_PASSES[pass];
    let madeProgress = true;

    while (madeProgress && selected.length < max) {
      madeProgress = false;
      for (const category of categoryOrder) {
        if (selected.length >= max) break;
        madeProgress = pickFromCategory(category, brandCap, categoryBrandCap) || madeProgress;
      }
    }
  }

  return selected;
}

export function getFeaturedCatalogProducts(limit = 8, category?: Category): Product[] {
  const products = category ? ALL_CATALOG_PRODUCTS.filter((product) => product.category === category) : ALL_CATALOG_PRODUCTS;
  return selectBalancedCatalogProducts(products, limit, category ? [category] : FEATURED_CATALOG_ORDER);
}

export function getClientCatalogProducts(limit = 240, category?: Category): Product[] {
  return getFeaturedCatalogProducts(limit, category);
}

export function getStylistCatalogProducts(limit = 240, category?: Category): Product[] {
  return getClientCatalogProducts(limit, category);
}

export function getClientStarterProducts(limit = 8): Product[] {
  return selectBalancedCatalogProducts(ALL_CATALOG_PRODUCTS, limit, STARTER_CATEGORY_ORDER);
}

export function getStylistStarterProducts(limit = 8): Product[] {
  return getClientStarterProducts(limit);
}

export const isCleanStylistCatalogProduct = isCleanClientCatalogProduct;

export function hydrateItemsFromClientCatalog(
  items: Partial<Record<Category, Product>>,
): Partial<Record<Category, Product>> {
  const nextItems: Partial<Record<Category, Product>> = {};
  for (const [slot, product] of Object.entries(items) as Array<[Category, Product | undefined]>) {
    if (!product) continue;
    const catalogProduct = PRODUCT_BY_ID.get(product.id);
    if (catalogProduct) nextItems[slot] = catalogProduct;
    else if (isCleanClientCatalogProduct(product)) nextItems[slot] = product;
  }
  return nextItems;
}

export const hydrateItemsFromCatalog = hydrateItemsFromClientCatalog;

export function productIdOf(product?: Product | null): string | null {
  return product?.id || null;
}

export function collectOutfitProductIds(items: Partial<Record<Category, Product>>): string[] {
  return CATEGORY_ORDER
    .map((slot) => productIdOf(items[slot]))
    .filter((id): id is string => Boolean(id));
}

export function outfitRequiredSignature(items: Partial<Record<Category, Product>>): string {
  return REQUIRED_SLOTS
    .map((slot) => `${slot}:${items[slot]?.id || '-'}`)
    .join('|');
}

export function outfitFullSignature(items: Partial<Record<Category, Product>>): string {
  return CATEGORY_ORDER
    .map((slot) => `${slot}:${items[slot]?.id || '-'}`)
    .join('|');
}

export function outfitCategorySignature(items: Partial<Record<Category, Product>>): string {
  return CATEGORY_ORDER
    .filter((slot) => Boolean(items[slot]))
    .join('+');
}

export function getShoeId(items: Partial<Record<Category, Product>>): string | null {
  return items.shoes?.id || null;
}

export function getBrandOrMerchant(product?: Product | null): string {
  return normalize(product?.brand || product?.retailer || '').trim();
}

export function getOutfitBrandCounts(items: Partial<Record<Category, Product>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of Object.values(items)) {
    const key = getBrandOrMerchant(product);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function buildCatalogLook({
  vibe,
  frame,
  budget,
  customMaxCents,
  currentItems,
  lockedItems,
  mode,
  seed = 0,
  avoidProductIds = [],
  recentShoeIds = [],
  recentBrandCounts,
  preferredFormulaId,
  targetSlots,
}: {
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  customMaxCents?: number | null;
  currentItems?: Partial<Record<Category, Product>>;
  lockedItems?: Partial<Record<Category, Product>>;
  mode: GeneratorMode;
  seed?: number;
  avoidProductIds?: string[];
  avoidComboSignatures?: string[];
  recentShoeIds?: string[];
  recentBrandCounts?: Record<string, number>;
  recentFormulaIds?: string[];
  preferredFormulaId?: string;
  diversityStrength?: 'low' | 'medium' | 'high';
  targetSlots?: Category[];
  transparentOnly?: boolean;
}): {
  products: Partial<Record<Category, Product>>;
  collection: CatalogCollection | null;
  missingSlots: Category[];
  formula: OutfitFormula;
} {
  const formula = chooseFormula(vibe, seed, preferredFormulaId);
  const categories = categoriesForLook(vibe, mode, formula, targetSlots);
  const products: Partial<Record<Category, Product>> = {};
  const usedIds = new Set<string>();
  const avoidIds = new Set(avoidProductIds.filter((id) => PRODUCT_IDS.has(id)));
  const recentShoeSet = new Set(recentShoeIds);
  const anchors = { ...(currentItems || {}), ...(lockedItems || {}) };

  for (const category of categories) {
    const anchor = anchors[category];
    if (anchor && isCleanClientCatalogProduct(anchor)) {
      products[category] = PRODUCT_BY_ID.get(anchor.id) || anchor;
      usedIds.add(anchor.id);
    }
  }

	  const collection = LAUNCH_COLLECTIONS
	    .filter((candidate) => candidate.vibe === vibe && (candidate.frame === 'all' || candidate.frame === frame))
	    .sort((left, right) => stableHash(`${left.id}:${seed}`) - stableHash(`${right.id}:${seed}`))[0] || null;
	  const collectionProducts = collection ? getCollectionProducts(collection) : [];
	  const allowCollectionPrefill = mode === 'starter' && avoidIds.size === 0;

	  if (allowCollectionPrefill) {
	    for (const product of collectionProducts) {
	      if (!categories.includes(product.category) || products[product.category] || usedIds.has(product.id) || avoidIds.has(product.id)) continue;
	      products[product.category] = product;
	      usedIds.add(product.id);
	    }
	  }

	  for (const category of orderCategoriesForPicking(categories)) {
	    if (products[category]) continue;
	    const selectedProducts = Object.values(products).filter((product): product is Product => Boolean(product));
	    const product = pickProduct(category, {
	      vibe,
	      frame,
      budget,
      customMaxCents,
      seed: seed + category.length * 97,
      keywords: [vibe, formula.label, formula.structure],
      usedIds,
      avoidIds,
	      recentShoeIds: recentShoeSet,
	      recentBrandCounts,
	      formula,
	      selectedProducts,
	    });
    if (!product) continue;
    products[category] = product;
    usedIds.add(product.id);
  }

  const missingSlots = categories.filter((category) => !products[category]);
  return {
    products,
    collection,
    missingSlots,
    formula,
  };
}
