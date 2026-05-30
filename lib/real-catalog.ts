/**
 * Real-data layer. Adapts the real product-photo catalog (data/photo-catalog.json,
 * ~410 items with real imageUrls) into the app's ClosetItem/Outfit model, and
 * assembles real outfits from the curated look recipes (data/discover-look-recipes.json).
 *
 * This is the PRIMARY data source. The procedural garment-art SVGs are now only a
 * graceful fallback for items whose photo URL is missing or fails to load.
 */
import recipesJson from '@/data/discover-look-recipes.json';
import { PHOTO_CATALOG_PRODUCTS } from './photo-catalog';
import { autoArrange } from './outfit-layout';
import { CREATORS } from './data/creators';
import type { Category, Product } from './types';
import type {
  AestheticId, ClosetItem, Formality, OccasionKey, Outfit, Season, Warmth,
} from './social-types';
import type { GarmentShape } from './garment-art';

const BASE = Date.UTC(2026, 4, 30, 12, 0, 0);
const daysAgo = (n: number) => new Date(BASE - n * 86_400_000).toISOString();
const lc = (s: string) => s.toLowerCase();

/* ---------- derive display + fallback metadata from a product name ---------- */

function deriveShape(category: Category, name: string): GarmentShape {
  const n = lc(name);
  const has = (...k: string[]) => k.some((x) => n.includes(x));
  switch (category) {
    case 'top':
      if (has('hoodie', 'sweatshirt', 'crewneck')) return 'hoodie';
      if (has('sweater', 'knit', 'cashmere', 'merino')) return 'sweater';
      if (has('polo')) return 'polo';
      if (has('dress', 'gown')) return 'dress';
      if (has('tank', 'cami', 'bra')) return 'tank';
      if (has('blouse', 'cowl', 'satin', 'silk')) return 'blouse';
      if (has('long sleeve', 'longsleeve', 'henley', 'turtleneck')) return 'longsleeve';
      if (has('crop', 'baby tee')) return 'crop';
      if (has('shirt', 'button', 'oxford')) return 'shirt';
      return 'tee';
    case 'outer':
      if (has('blazer')) return 'blazer';
      if (has('trench')) return 'trench';
      if (has('coat', 'overcoat')) return 'coat';
      if (has('puffer', 'parka', 'down')) return 'puffer';
      if (has('cardigan')) return 'cardigan';
      return 'jacket';
    case 'bottom':
      if (has('jean', 'denim')) return 'jeans';
      if (has('short')) return 'shorts';
      if (has('skirt')) return 'skirt';
      if (has('legging')) return 'leggings';
      if (has('jogger', 'sweatpant', 'track')) return 'joggers';
      if (has('trouser', 'tailored', 'pleated', 'suit')) return 'trousers';
      return 'pants';
    case 'shoes':
      if (has('boot', 'chelsea', 'combat')) return 'boot';
      if (has('heel', 'pump', 'strappy', 'stiletto')) return 'heel';
      if (has('loafer', 'flat', 'mule', 'ballet')) return 'loafer';
      if (has('sandal', 'slide')) return 'sandal';
      if (has('running', 'trainer', 'runner')) return 'runner';
      return 'sneaker';
    case 'bag':
      if (has('tote')) return 'tote';
      if (has('crossbody', 'sling', 'belt bag')) return 'crossbody';
      if (has('clutch', 'evening')) return 'clutch';
      if (has('backpack')) return 'backpack';
      return 'shoulderbag';
    case 'hat':
      if (has('beanie')) return 'beanie';
      if (has('bucket')) return 'bucket';
      if (has('fedora', 'straw', 'panama')) return 'fedora';
      return 'cap';
    case 'eyewear':
      if (has('clear', 'optical', 'glasses') && !has('sun')) return 'glasses';
      return 'sunglasses';
    case 'jewelry':
      if (has('watch')) return 'watch';
      if (has('chain')) return 'chain';
      if (has('hoop', 'earring')) return 'hoops';
      if (has('ring')) return 'ring';
      if (has('belt')) return 'belt';
      return 'necklace';
    default:
      return 'tee';
  }
}

const COLOR_MAP: Array<[string[], string, string]> = [
  [['black', 'noir', 'onyx'], '#1c1b19', 'Black'],
  [['charcoal', 'graphite', 'slate'], '#46433d', 'Charcoal'],
  [['grey', 'gray', 'heather'], '#8c877d', 'Grey'],
  [['white', 'ivory', 'optic'], '#efe9dc', 'White'],
  [['cream', 'oat', 'bone', 'ecru'], '#e6ddca', 'Cream'],
  [['beige', 'taupe', 'sand', 'khaki', 'natural', 'stone'], '#c9a98a', 'Sand'],
  [['tan', 'camel', 'cognac', 'caramel'], '#b08a5e', 'Camel'],
  [['brown', 'chocolate', 'espresso', 'mocha'], '#5a4231', 'Brown'],
  [['navy'], '#2f4a6b', 'Navy'],
  [['blue', 'denim', 'indigo', 'cobalt'], '#4f6f93', 'Blue'],
  [['olive', 'army'], '#5d5a3f', 'Olive'],
  [['green', 'forest', 'emerald', 'sage'], '#2f5d52', 'Green'],
  [['burgundy', 'wine', 'maroon', 'plum'], '#6f2f3f', 'Burgundy'],
  [['red', 'brick', 'rust', 'crimson'], '#9c3a2f', 'Red'],
  [['pink', 'blush', 'rose'], '#d98aae', 'Pink'],
  [['purple', 'lilac', 'lavender'], '#6f5a8a', 'Purple'],
  [['yellow', 'mustard', 'gold'], '#c9a23f', 'Gold'],
  [['silver', 'steel', 'chrome'], '#b9c0c7', 'Silver'],
];

function deriveColor(name: string): { hex: string; label: string } {
  const n = lc(name);
  for (const [keys, hex, label] of COLOR_MAP) if (keys.some((k) => n.includes(k))) return { hex, label };
  return { hex: '#8a8a86', label: 'Neutral' };
}

function deriveTags(category: Category, name: string): AestheticId[] {
  const n = lc(name);
  const tags = new Set<AestheticId>();
  const has = (...k: string[]) => k.some((x) => n.includes(x));
  if (has('gym', 'training', 'sport', 'performance', 'legging', 'active', 'run')) { tags.add('gym'); tags.add('athletic'); }
  if (has('hoodie', 'cargo', 'baggy', 'graphic', 'sweatshirt', 'track', 'utility')) tags.add('streetwear');
  if (has('blazer', 'tailored', 'trouser', 'suit', 'oxford')) tags.add('businesscasual');
  if (has('polo', 'chino', 'pleated', 'loafer', 'cable')) tags.add('preppy');
  if (has('silk', 'satin', 'heel', 'dress', 'cami', 'cowl', 'slip', 'gown')) { tags.add('datenight'); tags.add('goingout'); }
  if (has('linen', 'straw', 'sandal', 'resort', 'bikini', 'raffia')) { tags.add('summer'); tags.add('coastal'); }
  if (has('puffer', 'wool', 'coat', 'parka', 'beanie', 'cardigan', 'cashmere', 'fleece')) { tags.add('winter'); tags.add('cozy'); }
  if (has('leather', 'combat', 'moto', 'platform', 'mesh', 'corset', 'shield')) tags.add('edgy');
  if (has('cream', 'minimal', 'neutral', 'clean')) tags.add('minimalist');
  if (tags.size === 0) tags.add('casual');
  return [...tags].slice(0, 3);
}

function deriveFormality(category: Category, name: string): Formality {
  const n = lc(name);
  const has = (...k: string[]) => k.some((x) => n.includes(x));
  if (has('hoodie', 'jogger', 'sweatpant', 'legging', 'sports bra', 'gym', 'track')) return 'lounge';
  if (has('blazer', 'trouser', 'tailored', 'suit', 'gown', 'pump', 'oxford', 'coat')) return 'formal';
  if (has('heel', 'loafer', 'dress', 'silk', 'satin', 'knit', 'chelsea', 'cardigan', 'polo')) return 'smart';
  return 'casual';
}

function deriveSeasonWarmth(name: string): { season: Season; warmth: Warmth } {
  const n = lc(name);
  const has = (...k: string[]) => k.some((x) => n.includes(x));
  if (has('puffer', 'coat', 'wool', 'parka', 'beanie', 'cashmere', 'fleece', 'down', 'sherpa')) return { season: 'winter', warmth: 'warm' };
  if (has('linen', 'tank', 'sandal', 'short', 'resort', 'bikini', 'straw')) return { season: 'summer', warmth: 'cool' };
  return { season: 'all', warmth: 'mid' };
}

/* ---------- ownership: give the user ('me') a real, varied closet ---------- */

function buildOwnership(items: Product[]): Map<string, string> {
  const owner = new Map<string, string>();
  const perCatForMe = 4; // ~4 of each category land in the user's closet
  const seen: Partial<Record<Category, number>> = {};
  let ci = 0;
  for (const p of items) {
    const count = seen[p.category] || 0;
    if (count < perCatForMe) {
      owner.set(p.id, 'me');
      seen[p.category] = count + 1;
    } else {
      owner.set(p.id, CREATORS[ci % CREATORS.length].id);
      ci += 1;
    }
  }
  return owner;
}

/* ---------- adapt catalog -> ClosetItem[] ---------- */

const SOURCE: Product[] = PHOTO_CATALOG_PRODUCTS.filter(
  (p) => typeof p.imageUrl === 'string' && p.imageUrl.startsWith('http'),
);
const OWNER = buildOwnership(SOURCE);

export const REAL_ITEMS: ClosetItem[] = SOURCE.map((p, i) => {
  const color = deriveColor(p.name);
  const { season, warmth } = deriveSeasonWarmth(p.name);
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    subcategory: p.category,
    shape: deriveShape(p.category, p.name),
    color: color.hex,
    colorName: color.label,
    imageUrl: p.imageUrl,
    retailerUrl: p.retailerUrl || (p.metadata?.googleShoppingUrl as string | undefined),
    tags: deriveTags(p.category, p.name),
    formality: deriveFormality(p.category, p.name),
    season,
    warmth,
    priceCents: p.priceCents,
    ownerId: OWNER.get(p.id) || 'me',
    source: 'seed',
    createdAt: daysAgo(i % 40),
  };
});

const ITEMS_BY_CATEGORY = new Map<Category, ClosetItem[]>();
for (const it of REAL_ITEMS) {
  const list = ITEMS_BY_CATEGORY.get(it.category) || [];
  list.push(it);
  ITEMS_BY_CATEGORY.set(it.category, list);
}

/* ---------- assemble real outfits from look recipes ---------- */

interface SlotRecipe {
  keywords: string[];
  colors?: string[];
  avoidKeywords?: string[];
}
interface Recipe {
  id: string;
  slotRecipes: Partial<Record<Category, SlotRecipe>>;
}
const RECIPES = recipesJson as Recipe[];

interface RecipeMeta {
  creator: string;
  occasion: OccasionKey;
  aesthetics: AestheticId[];
  background: string;
}
const RECIPE_META: Record<string, RecipeMeta> = {
  'night-femme': { creator: 'sofia', occasion: 'party', aesthetics: ['goingout', 'datenight'], background: 'ink' },
  'street-masc': { creator: 'devon', occasion: 'casual', aesthetics: ['streetwear', 'edgy'], background: 'paper' },
  'clean-all': { creator: 'maya', occasion: 'casual', aesthetics: ['minimalist', 'casual'], background: 'cream' },
  'office-femme': { creator: 'jules', occasion: 'work', aesthetics: ['businesscasual', 'minimalist'], background: 'paper' },
  'vacation-femme': { creator: 'lena', occasion: 'travel', aesthetics: ['summer', 'coastal'], background: 'sand' },
  'preppy-masc': { creator: 'noah', occasion: 'casual', aesthetics: ['preppy', 'oldmoney'], background: 'sand' },
  'clean-femme-soft': { creator: 'maya', occasion: 'casual', aesthetics: ['minimalist', 'cozy'], background: 'cream' },
  'clean-masc-smart': { creator: 'jules', occasion: 'work', aesthetics: ['minimalist', 'businesscasual'], background: 'paper' },
  'date-femme-afterdark': { creator: 'sofia', occasion: 'date', aesthetics: ['datenight', 'goingout'], background: 'ink' },
  'date-masc-polished': { creator: 'marcus', occasion: 'date', aesthetics: ['datenight', 'edgy'], background: 'ink' },
  'edgy-femme-night': { creator: 'ivy', occasion: 'party', aesthetics: ['edgy', 'goingout', 'y2k'], background: 'ink' },
  'edgy-masc-core': { creator: 'remy', occasion: 'casual', aesthetics: ['edgy', 'streetwear'], background: 'paper' },
  'office-masc-refined': { creator: 'noah', occasion: 'work', aesthetics: ['businesscasual', 'winter'], background: 'paper' },
  'vacation-masc-resort': { creator: 'marcus', occasion: 'travel', aesthetics: ['summer', 'coastal'], background: 'sand' },
  'gym-femme-studio': { creator: 'kai', occasion: 'gym', aesthetics: ['gym', 'athletic'], background: 'sage' },
  'gym-masc-training': { creator: 'kai', occasion: 'gym', aesthetics: ['gym', 'streetwear'], background: 'paper' },
  'cozy-femme-weekend': { creator: 'maya', occasion: 'casual', aesthetics: ['cozy', 'datenight'], background: 'blush' },
  'street-femme-downtown': { creator: 'ivy', occasion: 'casual', aesthetics: ['streetwear', 'y2k', 'edgy'], background: 'paper' },
};

function scoreItem(item: ClosetItem, slot: SlotRecipe): number {
  const hay = lc(`${item.name} ${item.colorName}`);
  let s = 0.5;
  for (const k of slot.keywords) if (hay.includes(lc(k))) s += 2;
  for (const c of slot.colors || []) if (hay.includes(lc(c))) s += 1.5;
  for (const a of slot.avoidKeywords || []) if (hay.includes(lc(a))) s -= 3;
  return s;
}

const TITLE_WORDS = ['Look', 'Fit', 'Edit', 'Set', 'Moment'];

function buildOutfit(recipe: Recipe, variant: number, index: number): Outfit | null {
  const meta = RECIPE_META[recipe.id];
  if (!meta) return null;
  const used = new Set<string>();
  const itemIds: string[] = [];

  for (const [cat, slot] of Object.entries(recipe.slotRecipes) as Array<[Category, SlotRecipe]>) {
    const pool = (ITEMS_BY_CATEGORY.get(cat) || []).filter((i) => !used.has(i.id));
    if (!pool.length) continue;
    const ranked = pool
      .map((i) => ({ i, s: scoreItem(i, slot) }))
      .sort((a, b) => b.s - a.s);
    const pick = ranked[variant % Math.min(ranked.length, 3)]?.i || ranked[0].i;
    if (pick) {
      itemIds.push(pick.id);
      used.add(pick.id);
    }
  }

  if (itemIds.length < 3) return null;

  const arrangeInput = itemIds.map((id) => {
    const it = REAL_ITEMS.find((x) => x.id === id)!;
    return { itemId: id, category: it.category };
  });

  const region = meta.aesthetics[0];
  const title = `${meta.occasion[0].toUpperCase()}${meta.occasion.slice(1)} ${TITLE_WORDS[index % TITLE_WORDS.length]}`;

  return {
    id: `look-${recipe.id}-${variant}`,
    title,
    caption: undefined,
    itemIds,
    layout: autoArrange(arrangeInput, meta.aesthetics.includes('streetwear') ? 'streetwear' : 'editorial'),
    background: meta.background,
    preset: 'editorial',
    occasion: meta.occasion,
    aesthetics: meta.aesthetics,
    visibility: 'public',
    ownerId: meta.creator,
    storyEnabled: index % 4 === 0,
    createdAt: daysAgo(index),
    likes: 600 + ((index * 877) % 6200),
    saves: 80 + ((index * 211) % 1500),
    source: 'seed',
  };
}

export const REAL_OUTFITS: Outfit[] = (() => {
  const out: Outfit[] = [];
  let idx = 0;
  // one base outfit per recipe
  for (const r of RECIPES) {
    const o = buildOutfit(r, 0, idx);
    if (o) {
      out.push(o);
      idx += 1;
    }
  }
  // a second variant for the first dozen recipes for feed depth
  for (const r of RECIPES.slice(0, 12)) {
    const o = buildOutfit(r, 1, idx);
    if (o) {
      out.push(o);
      idx += 1;
    }
  }
  return out;
})();

/** Pick real wardrobe staples for the Home "basics" rail (by category + keyword). */
export function realBasics(limit = 8): ClosetItem[] {
  const wants: Array<{ cat: Category; kw: string[] }> = [
    { cat: 'top', kw: ['tee', 'white'] },
    { cat: 'bottom', kw: ['jean', 'denim'] },
    { cat: 'shoes', kw: ['sneaker', 'white'] },
    { cat: 'outer', kw: ['jacket', 'blazer'] },
    { cat: 'top', kw: ['knit', 'sweater'] },
    { cat: 'bottom', kw: ['trouser', 'tailored'] },
    { cat: 'bag', kw: ['tote'] },
    { cat: 'shoes', kw: ['loafer', 'boot'] },
  ];
  const out: ClosetItem[] = [];
  const used = new Set<string>();
  for (const w of wants) {
    const pool = (ITEMS_BY_CATEGORY.get(w.cat) || []).filter((i) => !used.has(i.id));
    const pick =
      pool.find((i) => w.kw.some((k) => lc(i.name).includes(k))) || pool[0];
    if (pick) {
      out.push(pick);
      used.add(pick.id);
    }
    if (out.length >= limit) break;
  }
  return out;
}
