// Prints the first 10 feed posts a fresh user or migrated v6 persisted
// store would see when opening /feed. The store can't be imported here because it
// uses `@/…` aliases that jiti doesn't resolve, so this script mirrors
// store/social-feed.ts's SEED_POSTS construction — collection-derived
// posts first (`feed-launch-${id}`), in LAUNCH_COLLECTIONS order — and
// reports per-post:
//   - source (launch / generated)
//   - post id
//   - vibe / frame
//   - product slots and which categories are filled
//   - hero candidate (first product that passes isFeedHeroCandidate)
//   - weak signals (visually weak / intimates / fabric / category-mismatch)
//   - missing required slots
//   - combo signature (sorted product ids)
//
// Run: npx jiti scripts/dump-visible-feed.ts

import {
  buildCatalogLook,
  getBrandOrMerchant,
  getCollectionProducts,
  getShoeId,
  LAUNCH_COLLECTIONS,
  OUTFIT_FORMULAS,
  outfitFullSignature,
  outfitRequiredSignature,
} from '../lib/catalog';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '../lib/vibes';
import {
  filterFeedRenderableProducts,
  hasFeedCategoryMismatch,
  isFeedHeroCandidate,
  isIntimatesOrSleepwear,
  isVisuallyWeakFeedProduct,
  productImageQualityScore,
  sortFeedRenderableProducts,
} from '../lib/product-image-quality';
import type { Category, Product } from '../lib/types';

function sanitizeItems(items: Partial<Record<Category, Product>>): Partial<Record<Category, Product>> {
  const products = sortFeedRenderableProducts(
    Object.values(items).filter((p): p is Product => Boolean(p)),
  );
  return Object.fromEntries(products.map((p) => [p.category, p])) as Partial<Record<Category, Product>>;
}

function comboSignature(items: Partial<Record<Category, Product>>): string {
  return outfitFullSignature(items);
}

function hasRequiredSlots(items: Partial<Record<Category, Product>>): boolean {
  return Boolean(items.top && items.bottom && items.shoes);
}

function chooseBestFeedHero(items: Partial<Record<Category, Product>>): Product | null {
  // Hero priority: outer > top > bottom; reject anything that fails
  // isFeedHeroCandidate (intimates / visually weak / non-anchor categories).
  const priorityOrder: Category[] = ['outer', 'top', 'bottom'];
  for (const category of priorityOrder) {
    const product = items[category];
    if (product && isFeedHeroCandidate(product)) return product;
  }
  // Fall back to any feed-hero-candidate-eligible product.
  for (const product of Object.values(items)) {
    if (product && isFeedHeroCandidate(product)) return product;
  }
  return null;
}

function describeWeak(product: Product): string {
  const reasons: string[] = [];
  if (isIntimatesOrSleepwear(product)) reasons.push('intimates');
  if (isVisuallyWeakFeedProduct(product)) reasons.push('visually-weak');
  if (hasFeedCategoryMismatch(product)) reasons.push('category-mismatch');
  if (productImageQualityScore(product) < -5) reasons.push(`low-score(${productImageQualityScore(product)})`);
  return reasons.join(',') || 'ok';
}

interface DumpPost {
  source: 'launch' | 'generated';
  id: string;
  vibe: string;
  frame: string;
  title: string;
  formulaId?: string;
  formulaLabel?: string;
  outfitReason?: string;
  items: Partial<Record<Category, Product>>;
}

// Mirror the COLLECTION_POSTS construction in store/social-feed.ts:120-140
const launchPosts: DumpPost[] = LAUNCH_COLLECTIONS.map((collection) => {
  const products = sortFeedRenderableProducts(getCollectionProducts(collection));
  const items = Object.fromEntries(products.map((p) => [p.category, p])) as Partial<Record<Category, Product>>;
  return {
    source: 'launch' as const,
    id: `feed-launch-${collection.id}`,
    vibe: collection.vibe,
    frame: collection.frame,
    title: collection.label,
    items: sanitizeItems(items),
  };
});

// Mirror GENERATED_POST_PLAN's plans + itemsFromGeneratedLook
const PLAN: Array<{ id: string; title: string; vibe: VibeId; frame: GeneratorFrame; budget: GeneratorBudget; seed: number }> = [
  { id: 'coffee-clean-fem',      title: 'Coffee run clean fit', vibe: 'clean',    frame: 'fem',          budget: 'under250', seed: 101 },
  { id: 'airport-neutral',       title: 'Airport uniform',      vibe: 'clean',    frame: 'androgynous',  budget: 'under250', seed: 102 },
  { id: 'street-femme-downtown', title: 'Downtown street edit', vibe: 'street',   frame: 'fem',          budget: 'under500', seed: 201 },
  { id: 'street-masc-campus',    title: 'Campus layers',        vibe: 'street',   frame: 'masc',         budget: 'under250', seed: 202 },
  { id: 'night-masc-polish',     title: 'Night out masculine',  vibe: 'night',    frame: 'masc',         budget: 'under500', seed: 301 },
  { id: 'night-femme-gold',      title: 'Gold hour black fit',  vibe: 'night',    frame: 'fem',          budget: 'under500', seed: 302 },
  { id: 'date-femme-soft',       title: 'Soft date night',      vibe: 'date',     frame: 'fem',          budget: 'under250', seed: 401 },
  { id: 'date-masc-clean',       title: 'Clean dinner fit',     vibe: 'date',     frame: 'masc',         budget: 'under500', seed: 402 },
  { id: 'gym-femme-studio',      title: 'Studio to street',     vibe: 'gym',      frame: 'fem',          budget: 'under250', seed: 501 },
  { id: 'gym-masc-training',     title: 'Training day',         vibe: 'gym',      frame: 'masc',         budget: 'under250', seed: 502 },
  { id: 'office-fem-cream',      title: 'Cream office uniform', vibe: 'office',   frame: 'fem',          budget: 'under500', seed: 601 },
  { id: 'office-masc-smart',     title: 'Smart office rotation',vibe: 'office',   frame: 'masc',         budget: 'under500', seed: 602 },
  { id: 'vacation-femme-linen',  title: 'Beach club neutral',   vibe: 'vacation', frame: 'fem',          budget: 'under250', seed: 701 },
  { id: 'vacation-masc-resort',  title: 'Resort morning',       vibe: 'vacation', frame: 'masc',         budget: 'under500', seed: 702 },
  { id: 'cozy-femme-weekend',    title: 'Soft weekend stack',   vibe: 'cozy',     frame: 'fem',          budget: 'under250', seed: 801 },
  { id: 'cozy-masc-winter',      title: 'Winter off-duty',      vibe: 'cozy',     frame: 'masc',         budget: 'under500', seed: 802 },
  { id: 'preppy-femme-city',     title: 'Preppy city look',     vibe: 'preppy',   frame: 'fem',          budget: 'under500', seed: 901 },
  { id: 'preppy-masc-weekend',   title: 'Clubhouse weekend',    vibe: 'preppy',   frame: 'masc',         budget: 'under500', seed: 902 },
  { id: 'edgy-femme-downtown',   title: 'Edgy downtown',        vibe: 'edgy',     frame: 'fem',          budget: 'under500', seed: 1001 },
  { id: 'edgy-masc-tech',        title: 'Techwear utility',     vibe: 'edgy',     frame: 'masc',         budget: 'under500', seed: 1002 },
  { id: 'clean-masc-casual',     title: 'Clean casual base',    vibe: 'clean',    frame: 'masc',         budget: 'under250', seed: 1101 },
  { id: 'street-any-black',      title: 'Black street uniform', vibe: 'street',   frame: 'androgynous',  budget: 'under500', seed: 1201 },
  { id: 'office-any-soft',       title: 'Soft workday edit',    vibe: 'office',   frame: 'androgynous',  budget: 'under500', seed: 1301 },
  { id: 'night-any-luxe',        title: 'Luxe monochrome',      vibe: 'night',    frame: 'androgynous',  budget: 'under500', seed: 1401 },
];

const PLAN_FORMULA_IDS: Record<string, string> = {
  'coffee-clean-fem': 'clean-elevated',
  'airport-neutral': 'travel-airport',
  'street-femme-downtown': 'streetwear-sneaker-led',
  'street-masc-campus': 'campus-cozy',
  'night-masc-polish': 'night-out',
  'night-femme-gold': 'date-polished',
  'date-femme-soft': 'date-polished',
  'date-masc-clean': 'date-polished',
  'gym-femme-studio': 'gym-training',
  'gym-masc-training': 'gym-training',
  'office-fem-cream': 'office-smart-casual',
  'office-masc-smart': 'office-smart-casual',
  'vacation-femme-linen': 'vacation-resort',
  'vacation-masc-resort': 'vacation-resort',
  'cozy-femme-weekend': 'campus-cozy',
  'cozy-masc-winter': 'travel-airport',
  'preppy-femme-city': 'old-money-knit',
  'preppy-masc-weekend': 'old-money-knit',
  'edgy-femme-downtown': 'techwear-utility',
  'edgy-masc-tech': 'techwear-utility',
  'clean-masc-casual': 'clean-elevated',
  'street-any-black': 'streetwear-sneaker-led',
  'office-any-soft': 'office-smart-casual',
  'night-any-luxe': 'date-polished',
};

const FIRST_SCREEN_POST_IDS = [
  'feed-plan-airport-neutral',
  'feed-plan-street-femme-downtown',
  'feed-plan-street-masc-campus',
  'feed-plan-gym-masc-training',
  'feed-plan-date-femme-soft',
  'feed-plan-vacation-femme-linen',
  'feed-plan-office-masc-smart',
  'feed-plan-preppy-masc-weekend',
  'feed-plan-edgy-masc-tech',
  'feed-plan-night-femme-gold',
];

function prioritizeFirstScreenPosts(posts: DumpPost[]): DumpPost[] {
  const order = new Map(FIRST_SCREEN_POST_IDS.map((id, index) => [id, index]));
  return [...posts].sort((left, right) => (order.get(left.id) ?? 999) - (order.get(right.id) ?? 999));
}

const generatedPosts: DumpPost[] = [];
const recentIds: string[] = [];
const recentShoes: string[] = [];
const requiredCombos: string[] = [];
const fullCombos: string[] = [];
const generationBrandCounts: Record<string, number> = {};

for (const [index, plan] of PLAN.entries()) {
  const generated = buildCatalogLook({
    vibe: plan.vibe,
    frame: plan.frame,
    budget: plan.budget,
    mode: 'full',
    seed: plan.seed + index * 1_019,
    avoidProductIds: Array.from(new Set(recentIds)).slice(0, 90),
    avoidComboSignatures: [...requiredCombos, ...fullCombos],
    recentShoeIds: recentShoes,
    recentBrandCounts: generationBrandCounts,
    preferredFormulaId: PLAN_FORMULA_IDS[plan.id],
    diversityStrength: 'high',
  });
  const items = sanitizeItems(generated.products);
  generatedPosts.push({
    source: 'generated' as const,
    id: `feed-plan-${plan.id}`,
    vibe: plan.vibe,
    frame: plan.frame,
    title: plan.title,
    formulaId: generated.formula.id,
    formulaLabel: generated.formula.label,
    outfitReason: generated.formula.reason,
    items,
  });
  recentIds.unshift(
    ...Object.values(items)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id),
  );
  recentIds.splice(90);
  const shoeId = getShoeId(items);
  if (shoeId) {
    recentShoes.unshift(shoeId);
    recentShoes.splice(18);
  }
  requiredCombos.unshift(outfitRequiredSignature(items));
  fullCombos.unshift(outfitFullSignature(items));
  requiredCombos.splice(80);
  fullCombos.splice(80);
  for (const product of Object.values(items).filter((item): item is Product => Boolean(item))) {
    const brand = getBrandOrMerchant(product);
    if (brand) generationBrandCounts[brand] = Math.min(16, (generationBrandCounts[brand] || 0) + 1);
  }
}

// Mirror store/social-feed.ts SEED_POSTS = dedupeFeedPostsById([...COLLECTION_POSTS, ...GENERATED_POSTS])
//   .filter(post => fitTotals(post.items).itemCount >= 5)
// The threshold was bumped 4 → 5 because OutfitBoard renders 8 slot
// positions and sparse posts (< 5 products) leave too many empty slots.
const seenIds = new Set<string>();
const seedPosts: DumpPost[] = [...launchPosts, ...generatedPosts]
  .filter((post) => {
    if (seenIds.has(post.id)) return false;
    seenIds.add(post.id);
    return Object.values(post.items).filter(Boolean).length >= 5 && hasRequiredSlots(post.items);
  });

const orderedSeedPosts = prioritizeFirstScreenPosts(seedPosts);
const firstTen = orderedSeedPosts.slice(0, 10);

const launchKept = launchPosts.filter((p) => Object.values(p.items).filter(Boolean).length >= 5 && hasRequiredSlots(p.items)).length;
const launchDropped = launchPosts.length - launchKept;
const generatedKept = generatedPosts.filter((p) => Object.values(p.items).filter(Boolean).length >= 5 && hasRequiredSlots(p.items)).length;
const generatedDropped = generatedPosts.length - generatedKept;

console.log(`First 10 visible /feed posts (fresh load or v6 migrated persisted feed)`);
console.log(`Source breakdown:`);
console.log(`  LAUNCH_COLLECTIONS  total=${launchPosts.length}  kept=${launchKept}  dropped=${launchDropped}  (filter: itemCount >= 5 + required slots)`);
console.log(`  GENERATED_POST_PLAN total=${generatedPosts.length}  kept=${generatedKept}  dropped=${generatedDropped}`);
console.log(`  SEED_POSTS final size = ${seedPosts.length}`);
console.log('');

let okPostCount = 0;
let weakHeroPostCount = 0;
let missingRequiredPostCount = 0;
const seenRequired = new Set<string>();
const seenShoes = new Set<string>();
const seenFormulas = new Set<string>();
const seenStructures = new Set<string>();

for (let i = 0; i < firstTen.length; i += 1) {
  const post = firstTen[i];
  const items = post.items;
  const products = Object.values(items).filter((p): p is Product => Boolean(p));
  const renderableForFeed = filterFeedRenderableProducts(products);
  const requiredSignature = outfitRequiredSignature(items);
  const shoeId = getShoeId(items);
  const brandList = Array.from(new Set(products.map((product) => getBrandOrMerchant(product)).filter(Boolean))).slice(0, 6);
  const categoryStructure = (['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'] as Category[])
    .filter((category) => Boolean(items[category]))
    .join('+');
  const duplicateRequired = requiredSignature ? seenRequired.has(requiredSignature) : false;
  const duplicateShoe = shoeId ? seenShoes.has(shoeId) : false;
  if (post.formulaId) seenFormulas.add(post.formulaId);
  if (categoryStructure) seenStructures.add(categoryStructure);

  const hero = chooseBestFeedHero(items);
  const missingRequired = [];
  if (!items.top) missingRequired.push('top');
  if (!items.bottom) missingRequired.push('bottom');
  if (!items.shoes) missingRequired.push('shoes');

  const weak = products.filter(
    (p) => isIntimatesOrSleepwear(p) || isVisuallyWeakFeedProduct(p) || hasFeedCategoryMismatch(p),
  );

  if (missingRequired.length) missingRequiredPostCount += 1;
  if (!hero) weakHeroPostCount += 1;
  if (!missingRequired.length && hero) okPostCount += 1;
  const formula = post.formulaLabel || OUTFIT_FORMULAS.find((entry) => entry.id === post.formulaId)?.label || post.formulaId || 'unknown';

  console.log(`#${i + 1}  ${post.id}  [${post.source}]  vibe=${post.vibe}  frame=${post.frame}`);
  console.log(`     title: ${post.title}`);
  console.log(`     formula: ${formula}  structure=${categoryStructure || 'unknown'}  shoe=${shoeId || 'none'}${duplicateShoe ? ' DUPLICATE-SHOE' : ''}`);
  if (post.outfitReason) console.log(`     reason: ${post.outfitReason}`);
  console.log(`     brands: ${brandList.join(', ') || 'none'}`);
  console.log(`     pieces (${products.length}, ${renderableForFeed.length} feed-renderable):`);
  for (const cat of ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'] as Category[]) {
    const product = items[cat];
    if (!product) continue;
    const weakNote = describeWeak(product);
    const heroMark = product === hero ? ' ★HERO' : '';
    const heroEligible = isFeedHeroCandidate(product) ? '' : ' (not-hero-candidate)';
    console.log(`       ${cat.padEnd(8)} ${product.brand} ${product.name.slice(0, 60)}${heroMark}${heroEligible}  [${weakNote}]`);
  }
  console.log(`     hero: ${hero ? `${hero.brand} ${hero.name.slice(0, 50)} (${hero.category})` : '— NONE — visually weak post'}`);
  if (missingRequired.length) console.log(`     missing required: ${missingRequired.join(', ')}`);
  if (weak.length) console.log(`     weak products: ${weak.length}`);
  console.log(`     combo: ${comboSignature(items).slice(0, 120)}${duplicateRequired ? ' DUPLICATE-REQUIRED' : ''}`);
  console.log('');

  if (requiredSignature) seenRequired.add(requiredSignature);
  if (shoeId) seenShoes.add(shoeId);
}

console.log('=== SUMMARY ===');
console.log(`firstTenPosts        : ${firstTen.length}`);
console.log(`postsWithStrongHero  : ${firstTen.length - weakHeroPostCount}`);
console.log(`postsWithWeakHero    : ${weakHeroPostCount}  ⚠️  (these are the "broken-looking" first-page cards)`);
console.log(`postsWithAllRequired : ${firstTen.length - missingRequiredPostCount}`);
console.log(`postsMissingRequired : ${missingRequiredPostCount}`);
console.log(`formulaDiversity     : ${seenFormulas.size}`);
console.log(`structureDiversity   : ${seenStructures.size}`);
console.log(`postsAllGood         : ${okPostCount}`);
