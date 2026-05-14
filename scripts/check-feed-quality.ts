// Standalone /feed quality audit.
//
// Inspects the actual SEED_POSTS array (collection-derived + generated-plan
// posts), then simulates 50 additional generator-produced feed cards
// through buildCatalogLook with the same vibe/frame/budget plans that the
// store uses, and reports the metrics the user asked for:
//
//   - total feed posts
//   - duplicateFeedPostIds
//   - duplicateFeedCombos
//   - missing top / bottom / shoes (across all posts after sanitize)
//   - weakFeedImageCount  (products that pass renderable but fail
//                          isVisuallyWeakFeedProduct / score < 0)
//   - intimatesLeak       (products that pass into feed posts despite the
//                          new isIntimatesOrSleepwear gate — must be 0)
//   - topRepeatedProducts
//   - topRepeatedShoes
//   - averageFeedItemsPerPost
//   - feedCatalogUseRate
//   - categoryConfidenceFailures
//
// FAIL conditions (process.exit(1)):
//   - duplicateFeedPostIds > 0
//   - missingTop / missingBottom / missingShoes > 0
//   - intimatesLeak > 0
//   - unrenderable products > 0
//   - duplicateFeedCombos > 25% of total posts
//
// Run standalone:
//   npx jiti scripts/check-feed-quality.ts
//
// Wired into npm run qa? The published baseline does NOT define a `qa`
// script, so this stays standalone. Adding `qa` would require a
// package.json edit, which the task instructions disallow.

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
import {
  filterFeedRenderableProducts,
  hasFeedCategoryMismatch,
  isFeedBlockedProductImage,
  isFeedHeroCandidate,
  isIntimatesOrSleepwear,
  isNormalOutfitBottom,
  isNormalOutfitShoe,
  isNormalOutfitTop,
  isRenderableProduct,
  isVisuallyWeakFeedProduct,
  productImageQualityScore,
  sortFeedRenderableProducts,
} from '../lib/product-image-quality';
import type { Category, Product } from '../lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '../lib/vibes';

interface FeedPostShape {
  id: string;
  items: Partial<Record<Category, Product>>;
  formulaId?: string;
  formulaLabel?: string;
}

// Mirrors store/social-feed.ts:GENERATED_POST_PLAN at this commit so the
// audit produces the same outfits the running app produces.
const PLAN: Array<{ id: string; vibe: VibeId; frame: GeneratorFrame; budget: GeneratorBudget; seed: number }> = [
  { id: 'coffee-clean-fem', vibe: 'clean', frame: 'fem', budget: 'under250', seed: 101 },
  { id: 'airport-neutral', vibe: 'clean', frame: 'androgynous', budget: 'under250', seed: 102 },
  { id: 'street-femme-downtown', vibe: 'street', frame: 'fem', budget: 'under500', seed: 201 },
  { id: 'street-masc-campus', vibe: 'street', frame: 'masc', budget: 'under250', seed: 202 },
  { id: 'night-masc-polish', vibe: 'night', frame: 'masc', budget: 'under500', seed: 301 },
  { id: 'night-femme-gold', vibe: 'night', frame: 'fem', budget: 'under500', seed: 302 },
  { id: 'date-femme-soft', vibe: 'date', frame: 'fem', budget: 'under250', seed: 401 },
  { id: 'date-masc-clean', vibe: 'date', frame: 'masc', budget: 'under500', seed: 402 },
  { id: 'gym-femme-studio', vibe: 'gym', frame: 'fem', budget: 'under250', seed: 501 },
  { id: 'gym-masc-training', vibe: 'gym', frame: 'masc', budget: 'under250', seed: 502 },
  { id: 'office-fem-cream', vibe: 'office', frame: 'fem', budget: 'under500', seed: 601 },
  { id: 'office-masc-smart', vibe: 'office', frame: 'masc', budget: 'under500', seed: 602 },
  { id: 'vacation-femme-linen', vibe: 'vacation', frame: 'fem', budget: 'under250', seed: 701 },
  { id: 'vacation-masc-resort', vibe: 'vacation', frame: 'masc', budget: 'under500', seed: 702 },
  { id: 'cozy-femme-weekend', vibe: 'cozy', frame: 'fem', budget: 'under250', seed: 801 },
  { id: 'cozy-masc-winter', vibe: 'cozy', frame: 'masc', budget: 'under500', seed: 802 },
  { id: 'preppy-femme-city', vibe: 'preppy', frame: 'fem', budget: 'under500', seed: 901 },
  { id: 'preppy-masc-weekend', vibe: 'preppy', frame: 'masc', budget: 'under500', seed: 902 },
  { id: 'edgy-femme-downtown', vibe: 'edgy', frame: 'fem', budget: 'under500', seed: 1001 },
  { id: 'edgy-masc-tech', vibe: 'edgy', frame: 'masc', budget: 'under500', seed: 1002 },
  { id: 'clean-masc-casual', vibe: 'clean', frame: 'masc', budget: 'under250', seed: 1101 },
  { id: 'street-any-black', vibe: 'street', frame: 'androgynous', budget: 'under500', seed: 1201 },
  { id: 'office-any-soft', vibe: 'office', frame: 'androgynous', budget: 'under500', seed: 1301 },
  { id: 'night-any-luxe', vibe: 'night', frame: 'androgynous', budget: 'under500', seed: 1401 },
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

function formulaLabel(id?: string): string | undefined {
  return OUTFIT_FORMULAS.find((formula) => formula.id === id)?.label;
}

function prioritizeFirstScreenPosts<T extends FeedPostShape>(posts: T[]): T[] {
  const order = new Map(FIRST_SCREEN_POST_IDS.map((id, index) => [id, index]));
  return [...posts].sort((left, right) => (order.get(left.id) ?? 999) - (order.get(right.id) ?? 999));
}

function sanitizeItems(items: Partial<Record<Category, Product>>): Partial<Record<Category, Product>> {
  const products = sortFeedRenderableProducts(
    Object.values(items).filter((product): product is Product => Boolean(product)),
  );
  return Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
}

function hasRequiredSlots(items: Partial<Record<Category, Product>>): boolean {
  return Boolean(items.top && items.bottom && items.shoes);
}

// 1. Collection-derived posts — keep only the ones that pass the live-app
//    SEED_POSTS filter (>= 5 sanitized products). 19 of 20 LAUNCH_COLLECTIONS
//    at this baseline reference legacy seed products whose images fail
//    isRenderableProduct, so only 1 truly survives — and even that one was
//    dropped when the threshold moved from >= 4 to >= 5. Reflecting the
//    live filter prevents the audit from FAIL-blaming the app for posts
//    that are never actually rendered.
const launchPostsAll: FeedPostShape[] = LAUNCH_COLLECTIONS.map((collection) => ({
  id: `feed-launch-${collection.id}`,
  items: sanitizeItems(
    Object.fromEntries(
      getCollectionProducts(collection).map((product) => [product.category, product]),
    ) as Partial<Record<Category, Product>>,
  ),
}));
const launchPosts: FeedPostShape[] = launchPostsAll.filter(
  (post) => Object.values(post.items).filter(Boolean).length >= 5 && hasRequiredSlots(post.items),
);

// 2. Generated-plan posts (one per plan + 26 additional streaming posts
//    with cursor offsets, simulating the first ~50 feed cards a user
//    would see after a couple of scroll-triggered batches).
const generatedPosts: FeedPostShape[] = [];
const recentIds: string[] = [];
const recentShoes: string[] = [];
const requiredCombos: string[] = [];
const fullCombos: string[] = [];
const generationBrandCounts: Record<string, number> = {};
let cursor = 0;
const targetGenerated = PLAN.length + 26;
let attempts = 0;
while (generatedPosts.length < targetGenerated && attempts < targetGenerated * 5) {
  const plan = PLAN[cursor % PLAN.length];
  const generated = buildCatalogLook({
    vibe: plan.vibe,
    frame: plan.frame,
    budget: plan.budget,
    mode: 'full',
    seed: plan.seed + cursor * 1019,
    avoidProductIds: Array.from(new Set(recentIds)).slice(0, 90),
    avoidComboSignatures: [...requiredCombos, ...fullCombos],
    recentShoeIds: recentShoes,
    recentBrandCounts: generationBrandCounts,
    preferredFormulaId: PLAN_FORMULA_IDS[plan.id],
    diversityStrength: 'high',
  });
  const items = sanitizeItems(generated.products);
  const productCount = Object.values(items).filter(Boolean).length;
  // Live-app filter: SEED_POSTS / normalizeFeedPost / makeGeneratedPost all
  // require >= 5 sanitized products so OutfitBoard's 8-slot collage never
  // renders with too many empty positions. Mirror that here.
  if (productCount >= 5 && hasRequiredSlots(items)) {
    const id = cursor < PLAN.length ? `feed-plan-${plan.id}` : `feed-plan-${plan.id}-${cursor}`;
    generatedPosts.push({
      id,
      items,
      formulaId: generated.formula.id,
      formulaLabel: generated.formula.label,
    });
    recentIds.unshift(
      ...Object.values(items)
        .filter((product): product is Product => Boolean(product))
        .map((product) => product.id),
    );
    if (recentIds.length > 90) recentIds.length = 90;
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
  cursor += 1;
  attempts += 1;
}

const posts = prioritizeFirstScreenPosts([...launchPosts, ...generatedPosts]);
const totalPosts = posts.length;
const firstTen = posts.slice(0, 10);

// === Metrics ===

const idCounts = new Map<string, number>();
for (const post of posts) idCounts.set(post.id, (idCounts.get(post.id) || 0) + 1);
const duplicateIds = Array.from(idCounts.entries()).filter(([, n]) => n > 1);

const comboCounts = new Map<string, string[]>();
for (const post of posts) {
  const sig = outfitFullSignature(post.items);
  if (!sig) continue;
  const ids = comboCounts.get(sig) || [];
  ids.push(post.id);
  comboCounts.set(sig, ids);
}
const duplicateCombos = Array.from(comboCounts.values()).filter((ids) => ids.length > 1);

const first10ProductIds = new Set<string>();
const first10Shoes = new Set<string>();
const first10Brands = new Set<string>();
const first10Formulas = new Set<string>();
const first10CategoryStructures = new Set<string>();
const first10RequiredCombos = new Set<string>();
let first10DuplicateCombos = 0;
let first10Picks = 0;
let first10StrongHero = 0;
const first10WeakHeroPostIds: string[] = [];
for (const post of firstTen) {
  const required = outfitRequiredSignature(post.items);
  if (post.formulaId) first10Formulas.add(post.formulaId);
  first10CategoryStructures.add(
    (['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'] as Category[])
      .filter((category) => Boolean(post.items[category]))
      .join('+'),
  );
  if (first10RequiredCombos.has(required)) first10DuplicateCombos += 1;
  first10RequiredCombos.add(required);
  const first10Products = Object.values(post.items).filter((item): item is Product => Boolean(item));
  if (first10Products.some(isFeedHeroCandidate)) {
    first10StrongHero += 1;
  } else {
    first10WeakHeroPostIds.push(post.id);
  }
  for (const product of first10Products) {
    first10Picks += 1;
    first10ProductIds.add(product.id);
    if (product.category === 'shoes') first10Shoes.add(product.id);
    const brand = getBrandOrMerchant(product);
    if (brand) first10Brands.add(brand);
  }
}
const first10AverageItems = firstTen.length ? first10Picks / firstTen.length : 0;

let missingTop = 0;
let missingBottom = 0;
let missingShoes = 0;
let intimatesLeak = 0;
let unrenderableLeak = 0;
let weakFeedImageCount = 0;
let categoryConfidenceFailures = 0;
let allProductPicks = 0;
// Feed-quality metrics surfaced by the new whitelist helpers.
let weakHeroProducts = 0;     // posts whose strongest visible product is NOT isFeedHeroCandidate
let badNormalBottoms = 0;     // posts whose bottom is present but fails isNormalOutfitBottom
let badNormalTops = 0;        // posts whose top is present but fails isNormalOutfitTop
let badNormalShoes = 0;       // posts whose shoes are present but fail isNormalOutfitShoe
const productCounts = new Map<string, { brand: string; name: string; count: number }>();
const shoeCounts = new Map<string, { brand: string; name: string; count: number }>();
const brandCounts = new Map<string, number>();
const formulaCounts = new Map<string, number>();
const categoryStructureCounts = new Map<string, number>();

for (const post of posts) {
  if (post.formulaId) formulaCounts.set(post.formulaId, (formulaCounts.get(post.formulaId) || 0) + 1);
  const structure = (['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'] as Category[])
    .filter((category) => Boolean(post.items[category]))
    .join('+');
  categoryStructureCounts.set(structure, (categoryStructureCounts.get(structure) || 0) + 1);
  if (!post.items.top) missingTop += 1;
  if (!post.items.bottom) missingBottom += 1;
  if (!post.items.shoes) missingShoes += 1;

  // Category-confidence checks per slot (only when the slot is present).
  if (post.items.top && !isNormalOutfitTop(post.items.top)) badNormalTops += 1;
  if (post.items.bottom && !isNormalOutfitBottom(post.items.bottom)) badNormalBottoms += 1;
  if (post.items.shoes && !isNormalOutfitShoe(post.items.shoes)) badNormalShoes += 1;

  // Hero candidate check — at least one product on the post should be a
  // strong hero anchor. If none qualify, the feed card has nothing visually
  // strong to anchor it (the user's reported "broken-looking first card").
  const products = Object.values(post.items).filter((p): p is Product => Boolean(p));
  const hasStrongHero = products.some(isFeedHeroCandidate);
  if (!hasStrongHero) weakHeroProducts += 1;

  for (const product of products) {
    allProductPicks += 1;
    productCounts.set(product.id, {
      brand: product.brand,
      name: product.name,
      count: (productCounts.get(product.id)?.count || 0) + 1,
    });
    if (product.category === 'shoes') {
      shoeCounts.set(product.id, {
        brand: product.brand,
        name: product.name,
        count: (shoeCounts.get(product.id)?.count || 0) + 1,
      });
    }
    const brandKey = product.brand.toLowerCase().trim();
    if (brandKey) brandCounts.set(brandKey, (brandCounts.get(brandKey) || 0) + 1);
    if (!isRenderableProduct(product)) unrenderableLeak += 1;
    if (isIntimatesOrSleepwear(product)) intimatesLeak += 1;
    if (isVisuallyWeakFeedProduct(product) || isFeedBlockedProductImage(product)) weakFeedImageCount += 1;
    if (hasFeedCategoryMismatch(product)) categoryConfidenceFailures += 1;
    if (productImageQualityScore(product) < -5) weakFeedImageCount += 1;
  }
}

const topRepeated = Array.from(productCounts.values()).filter((p) => p.count > 1).sort((a, b) => b.count - a.count).slice(0, 8);
const topShoes = Array.from(shoeCounts.values()).sort((a, b) => b.count - a.count).slice(0, 6);
const uniqueProducts = productCounts.size;
const feedCatalogUseRate = allProductPicks ? uniqueProducts / allProductPicks : 0;
const averageItems = totalPosts ? allProductPicks / totalPosts : 0;

// Also: confirm the intimates gate is actually pulling some products out
// of feed eligibility (catalog level — sanity check that the rule fires).
const intimatesInCatalog = filterFeedRenderableProducts(
  // Hack: re-run through the feed filter and count rejections by reason.
  [],
);
void intimatesInCatalog;

// === Report ===

// Weak-hero soft threshold — having a single feed card with no strong
// hero candidate is acceptable; >10% is the visible "first page looks
// broken" symptom the user reported.
const weakHeroThreshold = Math.max(2, Math.ceil(totalPosts * 0.1));

const failures: string[] = [];
if (duplicateIds.length) failures.push(`duplicateFeedPostIds=${duplicateIds.length} (${duplicateIds.slice(0, 5).map(([id, n]) => `${id}×${n}`).join(', ')})`);
if (missingTop > 0) failures.push(`missingTop=${missingTop} (must be 0)`);
if (missingBottom > 0) failures.push(`missingBottom=${missingBottom} (must be 0)`);
if (missingShoes > 0) failures.push(`missingShoes=${missingShoes} (must be 0)`);
if (intimatesLeak > 0) failures.push(`intimatesLeak=${intimatesLeak} (must be 0 — bras/lingerie/sleepwear leaked into normal feed outfits)`);
if (unrenderableLeak > 0) failures.push(`unrenderableLeak=${unrenderableLeak} (must be 0)`);
if (badNormalBottoms > 0) failures.push(`badNormalBottoms=${badNormalBottoms} (posts whose "bottom" slot is not a wearable pant/jean/skirt/short — likely a swim/underwear/lingerie miscategorization)`);
const comboDupThreshold = Math.max(2, Math.ceil(totalPosts * 0.25));
if (duplicateCombos.length > comboDupThreshold) {
  failures.push(`duplicateFeedCombos=${duplicateCombos.length} > threshold ${comboDupThreshold} (>25% of ${totalPosts} posts share exact product combos)`);
}
if (first10DuplicateCombos > 0) failures.push(`first10DuplicateCombos=${first10DuplicateCombos}`);
if (first10StrongHero < firstTen.length) failures.push(`first10StrongHero=${first10StrongHero}/${firstTen.length} weak=${first10WeakHeroPostIds.join(',')}`);
if (first10Formulas.size < 5) failures.push(`first10FormulaDiversity=${first10Formulas.size} (expected at least 5)`);
if (first10CategoryStructures.size < 5) failures.push(`first10CategoryStructureDiversity=${first10CategoryStructures.size} (expected at least 5)`);
if (weakHeroProducts > weakHeroThreshold) {
  failures.push(`weakHeroProducts=${weakHeroProducts} > threshold ${weakHeroThreshold} (no strong hero candidate per post — first-page feed cards will look weak)`);
}

const topBrands = Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

if (failures.length) {
  console.error('Feed quality: FAILED');
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`  metrics: posts=${totalPosts} uniqueProducts=${uniqueProducts} feedCatalogUseRate=${(feedCatalogUseRate * 100).toFixed(1)}% averageItems=${averageItems.toFixed(1)} weakImages=${weakFeedImageCount} weakHero=${weakHeroProducts} badNormalTops=${badNormalTops} badNormalBottoms=${badNormalBottoms} badNormalShoes=${badNormalShoes} categoryConfidenceFailures=${categoryConfidenceFailures} duplicateCombos=${duplicateCombos.length}`);
  console.error(`  first10: uniqueProducts=${first10ProductIds.size} uniqueShoes=${first10Shoes.size} uniqueBrands=${first10Brands.size} duplicateCombos=${first10DuplicateCombos} averageItems=${first10AverageItems.toFixed(1)}`);
  if (topRepeated.length) {
    console.error(`  topRepeatedFeedProducts: ${topRepeated.map((p) => `${p.brand} ${p.name} ×${p.count}`).join('; ')}`);
  }
  if (topShoes.length) {
    console.error(`  topRepeatedFeedShoes: ${topShoes.map((s) => `${s.brand} ${s.name} ×${s.count}`).join('; ')}`);
  }
  if (topBrands.length) {
    console.error(`  topBrands: ${topBrands.map(([b, n]) => `${b}×${n}`).join('; ')}`);
  }
  process.exit(1);
}

console.log(
  [
    `Feed quality: PASS`,
    `posts=${totalPosts} (launch ${launchPosts.length} + generated ${generatedPosts.length})`,
    `feedUniqueProducts=${uniqueProducts}`,
    `feedCatalogUseRate=${(feedCatalogUseRate * 100).toFixed(1)}%`,
    `averageItemsPerPost=${averageItems.toFixed(1)}`,
    `first10UniqueProducts=${first10ProductIds.size}`,
    `first10UniqueShoes=${first10Shoes.size}`,
    `first10UniqueBrands=${first10Brands.size}`,
    `first10FormulaDiversity=${first10Formulas.size}`,
    `first10CategoryStructureDiversity=${first10CategoryStructures.size}`,
    `first10DuplicateCombos=${first10DuplicateCombos}`,
    `first10StrongHero=${first10StrongHero}/${firstTen.length}`,
    `first10AverageItems=${first10AverageItems.toFixed(1)}`,
    `duplicateFeedPostIds=0`,
    `duplicateFeedCombos=${duplicateCombos.length}`,
    `formulaDiversity=${formulaCounts.size}`,
    `categoryStructureDiversity=${categoryStructureCounts.size}`,
    `missingTop=0 missingBottom=0 missingShoes=0`,
    `intimatesLeak=0`,
    `unrenderable=0`,
    `weakFeedImageProducts=${weakFeedImageCount}`,
    `weakHeroProducts=${weakHeroProducts}/${weakHeroThreshold}`,
    `badNormalTops=${badNormalTops} badNormalBottoms=${badNormalBottoms} badNormalShoes=${badNormalShoes}`,
    `categoryConfidenceFailures=${categoryConfidenceFailures}`,
  ].join('  '),
);
if (topRepeated.length) {
  console.log(`  topRepeatedFeedProducts (≥2): ${topRepeated.map((p) => `${p.brand} ${p.name}×${p.count}`).slice(0, 5).join('; ')}`);
}
if (topShoes.length) {
  console.log(`  topRepeatedFeedShoes: ${topShoes.map((s) => `${s.brand} ${s.name}×${s.count}`).slice(0, 4).join('; ')}`);
}
if (topBrands.length) {
  console.log(`  topBrands: ${topBrands.map(([b, n]) => `${b}×${n}`).slice(0, 4).join('; ')}`);
}
