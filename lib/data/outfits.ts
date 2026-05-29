import type { AestheticId, LayoutPreset, OccasionKey, Outfit, Visibility } from '../social-types';
import type { Category } from '../types';
import { autoArrange } from '../outfit-layout';
import { getItem } from './closet';

/**
 * Seeded outfits (the "outfits" + "outfit_layout" tables). 32 looks composed from
 * real closet items, with layouts produced by the editorial composition engine so
 * they render identically server- and client-side.
 */

const BASE = Date.UTC(2026, 4, 29, 12, 0, 0);
function daysAgo(n: number): string {
  return new Date(BASE - n * 86_400_000).toISOString();
}

interface OutfitSeed {
  id: string;
  title: string;
  caption?: string;
  itemIds: string[];
  ownerId: string;
  aesthetics: AestheticId[];
  occasion?: OccasionKey;
  preset?: LayoutPreset;
  background?: string;
  visibility?: Visibility;
  likes?: number;
  saves?: number;
  storyEnabled?: boolean;
  day: number;
}

function mk(s: OutfitSeed): Outfit {
  const preset = s.preset ?? 'editorial';
  const arrangeInput = s.itemIds
    .map((id) => {
      const item = getItem(id);
      return item ? { itemId: id, category: item.category } : null;
    })
    .filter((x): x is { itemId: string; category: Category } => x !== null);

  return {
    id: s.id,
    title: s.title,
    caption: s.caption,
    itemIds: s.itemIds,
    layout: autoArrange(arrangeInput, preset),
    background: s.background ?? 'paper',
    preset,
    occasion: s.occasion,
    aesthetics: s.aesthetics,
    visibility: s.visibility ?? 'public',
    ownerId: s.ownerId,
    storyEnabled: s.storyEnabled,
    createdAt: daysAgo(s.day),
    likes: s.likes ?? 0,
    saves: s.saves ?? 0,
    source: 'seed',
  };
}

export const SEED_OUTFITS: Outfit[] = [
  // ---- Maya — minimalist / old money ----
  mk({ id: 'o-maya-1', title: 'Camel & Cream', caption: 'Quiet luxury for a slow Sunday.', itemIds: ['outer-camel-coat', 'top-oat-knit', 'bottom-cream-trousers', 'shoes-mule', 'jewel-pendant'], ownerId: 'maya', aesthetics: ['oldmoney', 'minimalist'], occasion: 'casual', background: 'cream', likes: 2410, saves: 612, day: 1, storyEnabled: true }),
  mk({ id: 'o-maya-2', title: 'Trench Season', caption: 'The trench does the talking.', itemIds: ['outer-trench', 'dress-knit', 'shoes-mule', 'bag-tote', 'eye-cateye'], ownerId: 'maya', aesthetics: ['oldmoney', 'businesscasual'], occasion: 'work', background: 'sand', likes: 3120, saves: 880, day: 4 }),
  // ---- Devon — streetwear ----
  mk({ id: 'o-devon-1', title: 'Puffer Szn', caption: 'Cold weather, warm fit.', itemIds: ['outer-black-puffer', 'top-black-hoodie', 'bottom-cargo', 'shoes-nb990', 'hat-beanie', 'jewel-chain'], ownerId: 'devon', aesthetics: ['streetwear', 'winter'], occasion: 'casual', preset: 'streetwear', background: 'paper', likes: 5840, saves: 1320, day: 0, storyEnabled: true }),
  mk({ id: 'o-devon-2', title: 'Samba Daily', caption: 'Tee, jeans, sambas. Never misses.', itemIds: ['top-black-tee', 'bottom-black-jeans', 'shoes-samba', 'hat-cap', 'jewel-chain'], ownerId: 'devon', aesthetics: ['streetwear', 'minimalist'], occasion: 'casual', preset: 'streetwear', background: 'paper', likes: 4210, saves: 998, day: 6 }),
  // ---- Sofia — date night / going out ----
  mk({ id: 'o-sofia-1', title: 'Little Black Slip', caption: 'Dinner reservations energy.', itemIds: ['dress-black-slip', 'shoes-heel', 'bag-clutch', 'jewel-hoops'], ownerId: 'sofia', aesthetics: ['datenight', 'formal', 'goingout'], occasion: 'date', background: 'blush', likes: 6720, saves: 2110, day: 2, storyEnabled: true }),
  mk({ id: 'o-sofia-2', title: 'Satin Hour', caption: 'Plum satin for late nights.', itemIds: ['dress-satin', 'shoes-strap-heel', 'bag-baguette', 'jewel-hoops', 'eye-cateye'], ownerId: 'sofia', aesthetics: ['goingout', 'datenight'], occasion: 'party', background: 'ink', likes: 5310, saves: 1480, day: 5 }),
  mk({ id: 'o-sofia-3', title: 'Blouse & Midi', caption: 'Soft rose, champagne satin.', itemIds: ['top-rose-blouse', 'bottom-midi-skirt', 'shoes-ballet', 'bag-shoulder', 'jewel-pendant'], ownerId: 'sofia', aesthetics: ['datenight', 'oldmoney'], occasion: 'dinner', background: 'blush', likes: 3990, saves: 1020, day: 9 }),
  // ---- Kai — athletic / gym ----
  mk({ id: 'o-kai-1', title: 'Train Day', caption: 'Matching set, locked in.', itemIds: ['top-black-zip', 'bottom-joggers', 'shoes-runner-perf', 'bag-sling', 'eye-shield'], ownerId: 'kai', aesthetics: ['gym', 'athletic'], occasion: 'gym', preset: 'grid', background: 'sage', likes: 2880, saves: 540, day: 3 }),
  mk({ id: 'o-kai-2', title: 'Off-Duty Athlete', caption: 'Track jacket + vomeros.', itemIds: ['outer-track-jacket', 'top-sport-tank', 'bottom-joggers', 'shoes-vomero', 'hat-cap'], ownerId: 'kai', aesthetics: ['athletic', 'streetwear'], occasion: 'casual', preset: 'streetwear', background: 'paper', likes: 3240, saves: 760, day: 7 }),
  // ---- Noah — preppy ----
  mk({ id: 'o-noah-1', title: 'Campus Prep', caption: 'Oxford, chinos, loafers.', itemIds: ['top-blue-oxford', 'bottom-khaki-chino', 'shoes-loafer', 'bag-canvas-tote', 'jewel-belt'], ownerId: 'noah', aesthetics: ['preppy', 'campus', 'businesscasual'], occasion: 'school', background: 'cream', likes: 1980, saves: 410, day: 8 }),
  mk({ id: 'o-noah-2', title: 'Blazer & Polo', caption: 'Club house ready.', itemIds: ['outer-navy-blazer', 'top-stripe-polo', 'bottom-cream-trousers', 'shoes-loafer', 'hat-cream-cap'], ownerId: 'noah', aesthetics: ['preppy', 'oldmoney'], occasion: 'casual', background: 'sand', likes: 2460, saves: 588, day: 12 }),
  // ---- Lena — coastal / summer ----
  mk({ id: 'o-lena-1', title: 'Linen & Salt', caption: 'Beach club lunch.', itemIds: ['top-sage-longsleeve', 'bottom-linen-shorts', 'shoes-sandal', 'hat-bucket', 'eye-wayfarer'], ownerId: 'lena', aesthetics: ['coastal', 'summer', 'travel'], occasion: 'travel', background: 'sand', likes: 3580, saves: 940, day: 2, storyEnabled: true }),
  mk({ id: 'o-lena-2', title: 'Terracotta Midi', caption: 'Golden hour dress.', itemIds: ['dress-floral', 'shoes-sandal', 'bag-canvas-tote', 'hat-fedora'], ownerId: 'lena', aesthetics: ['summer', 'coastal', 'datenight'], occasion: 'date', background: 'blush', likes: 4120, saves: 1180, day: 6 }),
  // ---- Theo — edgy / winter ----
  mk({ id: 'o-theo-1', title: 'Forest & Combat', caption: 'Layered for grey days.', itemIds: ['outer-grey-coat', 'top-forest-sweater', 'bottom-black-jeans', 'shoes-combat', 'hat-beanie'], ownerId: 'theo', aesthetics: ['edgy', 'winter', 'minimalist'], occasion: 'casual', background: 'paper', likes: 3010, saves: 720, day: 5 }),
  mk({ id: 'o-theo-2', title: 'All Black Everything', caption: 'Mood: monochrome.', itemIds: ['outer-black-bomber', 'top-black-tee', 'bottom-black-jeans', 'shoes-combat', 'eye-wayfarer', 'jewel-signet'], ownerId: 'theo', aesthetics: ['edgy', 'streetwear'], occasion: 'casual', preset: 'streetwear', background: 'ink', likes: 4680, saves: 1090, day: 10 }),
  // ---- Ivy — y2k / going out ----
  mk({ id: 'o-ivy-1', title: 'Baby Tee + Wides', caption: 'Y2K never left.', itemIds: ['top-pink-crop', 'bottom-wide-jeans', 'shoes-vomero', 'bag-baguette', 'eye-shield', 'jewel-hoops'], ownerId: 'ivy', aesthetics: ['y2k', 'goingout', 'summer'], occasion: 'party', preset: 'streetwear', background: 'blush', likes: 7210, saves: 2380, day: 1, storyEnabled: true }),
  mk({ id: 'o-ivy-2', title: 'Denim Mini Night', caption: 'Going-out starter pack.', itemIds: ['dress-satin', 'bottom-denim-skirt', 'shoes-strap-heel', 'bag-baguette', 'jewel-hoops'], ownerId: 'ivy', aesthetics: ['y2k', 'goingout'], occasion: 'party', background: 'ink', likes: 5120, saves: 1340, day: 8 }),
  // ---- Marcus — old money / formal ----
  mk({ id: 'o-marcus-1', title: 'Heritage Grey', caption: 'Tailoring, the right way.', itemIds: ['outer-grey-coat', 'top-navy-cable', 'bottom-grey-trousers', 'shoes-chelsea', 'jewel-watch'], ownerId: 'marcus', aesthetics: ['oldmoney', 'formal', 'businesscasual'], occasion: 'formal', background: 'sand', likes: 4310, saves: 1260, day: 3 }),
  mk({ id: 'o-marcus-2', title: 'Boardroom', caption: 'Black blazer, gold watch.', itemIds: ['outer-black-blazer', 'top-cream-oxford', 'bottom-black-trousers', 'shoes-mule', 'jewel-watch', 'jewel-signet'], ownerId: 'marcus', aesthetics: ['formal', 'businesscasual', 'oldmoney'], occasion: 'interview', background: 'paper', likes: 3680, saves: 1010, day: 11 }),
  // ---- Priya — campus / travel ----
  mk({ id: 'o-priya-1', title: 'Airport Easy', caption: 'Comfy but together.', itemIds: ['top-white-longsleeve', 'bottom-blue-jeans', 'shoes-samba', 'bag-backpack', 'hat-cap'], ownerId: 'priya', aesthetics: ['travel', 'campus', 'casual'], occasion: 'travel', preset: 'grid', background: 'cream', likes: 1740, saves: 360, day: 7 }),
  mk({ id: 'o-priya-2', title: 'Lecture Layers', caption: 'Cardigan + tote kind of day.', itemIds: ['outer-grey-cardigan', 'top-white-tee', 'bottom-khaki-chino', 'shoes-af1', 'bag-tote'], ownerId: 'priya', aesthetics: ['campus', 'cozy', 'minimalist'], occasion: 'school', background: 'paper', likes: 1520, saves: 290, day: 13 }),
  // ---- Jules — minimal workwear ----
  mk({ id: 'o-jules-1', title: 'Monochrome Work', caption: 'Black blouse, tailored trousers.', itemIds: ['top-black-blouse', 'bottom-black-trousers', 'shoes-mule', 'bag-crossbody', 'eye-clear'], ownerId: 'jules', aesthetics: ['minimalist', 'businesscasual', 'formal'], occasion: 'work', background: 'paper', likes: 3950, saves: 1150, day: 4, storyEnabled: true }),
  mk({ id: 'o-jules-2', title: 'Blazer Minimal', caption: 'Less, but better.', itemIds: ['outer-black-blazer', 'top-white-tee', 'bottom-cream-trousers', 'shoes-mule', 'jewel-dive-watch'], ownerId: 'jules', aesthetics: ['minimalist', 'businesscasual'], occasion: 'work', background: 'cream', likes: 3210, saves: 870, day: 9 }),
  // ---- Remy — workwear / thrift ----
  mk({ id: 'o-remy-1', title: 'Chore & Cargo', caption: 'Texture over logos.', itemIds: ['outer-work-jacket', 'top-grey-hoodie', 'bottom-cargo', 'shoes-chuck', 'hat-beanie'], ownerId: 'remy', aesthetics: ['streetwear', 'campus', 'edgy'], occasion: 'casual', preset: 'streetwear', background: 'paper', likes: 2760, saves: 640, day: 6 }),
  mk({ id: 'o-remy-2', title: 'Rust Workwear', caption: 'Carhartt forever.', itemIds: ['outer-work-jacket', 'top-white-tee', 'bottom-blue-jeans', 'shoes-chuck', 'eye-wayfarer'], ownerId: 'remy', aesthetics: ['streetwear', 'casual'], occasion: 'casual', background: 'sand', likes: 2190, saves: 470, day: 14 }),
  // ---- You — seeded so the profile isn't empty ----
  mk({ id: 'o-me-1', title: 'My Everyday', caption: 'White tee, blue jeans, AF1s.', itemIds: ['top-white-tee', 'bottom-blue-jeans', 'shoes-af1', 'hat-cap', 'eye-wayfarer'], ownerId: 'me', aesthetics: ['minimalist', 'casual', 'campus'], occasion: 'casual', background: 'paper', visibility: 'public', likes: 84, saves: 12, day: 2 }),
  mk({ id: 'o-me-2', title: 'Smart Casual', caption: 'Oxford + chinos + chelseas.', itemIds: ['top-cream-oxford', 'bottom-khaki-chino', 'shoes-chelsea', 'bag-tote', 'jewel-dive-watch'], ownerId: 'me', aesthetics: ['businesscasual', 'preppy'], occasion: 'work', background: 'cream', visibility: 'public', likes: 56, saves: 8, day: 5 }),
  mk({ id: 'o-me-3', title: 'Cozy Sunday', caption: 'Hoodie + sweats kind of mood.', itemIds: ['top-grey-hoodie', 'bottom-sweatpant', 'shoes-samba', 'hat-beanie'], ownerId: 'me', aesthetics: ['cozy', 'streetwear'], occasion: 'casual', background: 'paper', visibility: 'private', likes: 0, saves: 0, day: 1 }),
  mk({ id: 'o-me-4', title: 'Camel Coat Day', caption: 'Layering the camel coat.', itemIds: ['outer-camel-coat', 'top-white-longsleeve', 'bottom-black-jeans', 'shoes-chelsea', 'jewel-pendant'], ownerId: 'me', aesthetics: ['oldmoney', 'minimalist'], occasion: 'casual', background: 'sand', visibility: 'friends', likes: 31, saves: 5, day: 8 }),
  // ---- a few more for feed depth ----
  mk({ id: 'o-lena-3', title: 'Pleats & Pearls', caption: 'Tennis club aesthetic.', itemIds: ['top-stripe-polo', 'bottom-pleated-skirt', 'shoes-af1', 'hat-cream-cap', 'jewel-pendant'], ownerId: 'lena', aesthetics: ['preppy', 'coastal', 'athletic'], occasion: 'casual', background: 'sage', likes: 2980, saves: 690, day: 10 }),
  mk({ id: 'o-devon-3', title: 'Denim on Denim', caption: 'Trucker + light wash.', itemIds: ['outer-denim-jacket', 'top-white-tee', 'bottom-wide-jeans', 'shoes-nb990', 'hat-cap'], ownerId: 'devon', aesthetics: ['streetwear', 'casual', 'y2k'], occasion: 'casual', preset: 'streetwear', background: 'paper', likes: 3870, saves: 910, day: 11 }),
  mk({ id: 'o-marcus-3', title: 'Weekend Heritage', caption: 'Cable knit + chinos.', itemIds: ['top-navy-cable', 'bottom-khaki-chino', 'shoes-loafer', 'jewel-watch', 'eye-clear'], ownerId: 'marcus', aesthetics: ['oldmoney', 'preppy'], occasion: 'casual', background: 'cream', likes: 2540, saves: 600, day: 15 }),
];

export const OUTFIT_BY_ID: Map<string, Outfit> = new Map(SEED_OUTFITS.map((o) => [o.id, o]));

export function getOutfit(id: string): Outfit | undefined {
  return OUTFIT_BY_ID.get(id);
}
