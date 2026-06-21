/**
 * Dependency-free unit checks for the core PURE logic — run via jiti (same
 * pattern as check-route-smoke). No test framework, no new deps. Targets the
 * honesty-/engagement-critical functions: XP leveling and bundle pricing (whose
 * verified-only gate is load-bearing for the "no fake discounts" promise).
 *
 *   npm run test:units
 */
import { levelFor, bumpDaily, getXp, consumeLevelUp } from '../lib/stylist-xp';
import { computeBundleDeal } from '../lib/bundle-deals';
import { wrapAffiliate } from '../lib/affiliate';
import { lookRarity } from '../lib/look-rarity';
import { deriveIdentity, type StyleAnswers } from '../lib/style-identity';
import { getTransparentProductImageUrl, isEditorialCutoutProduct } from '../lib/product-image-quality';
import { getProductOutboundUrl } from '../lib/product-links';
import { hasFrameMismatch } from '../lib/frame-inference';
import { proxiedImageUrl } from '../lib/image-url';
import { hasDirectRetailerUrl } from '../lib/retailer-url';
import { normalizeSearchFrame } from '../lib/search-frame';
import { isVibeAppropriate } from '../lib/vibe-fit';
import { dailyCapUsd, estimateCostUsd, recordAiUsage, aiBudgetAvailable, aiBudgetSnapshot } from '../lib/ai-budget';
import { productSearchText, inferProductPresentation } from '../lib/presentation-score';
import { colorHarmonyScore } from '../lib/color-harmony';
import type { Category, Product } from '../lib/types';

// Minimal in-memory localStorage so the storage-backed XP/quest logic runs in
// Node (lib/stylist-xp reads window.localStorage lazily inside its functions).
function installMemoryStorage(): void {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    },
  };
}

let failures = 0;
function check(label: string, condition: boolean): void {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    failures += 1;
  }
}

console.log('Lib unit checks');
console.log('===============');

// ── XP level math (lib/stylist-xp · levelFor) ────────────────────────────────
const l0 = levelFor(0);
check(
  'levelFor(0) → Rookie L1, 0%, next Curator',
  l0.level === 1 && l0.title === 'Rookie' && l0.pct === 0 && l0.nextTitle === 'Curator' && !l0.maxed,
);
const l420 = levelFor(420);
check(
  'levelFor(420) → Tastemaker L3, 100/320, 31%',
  l420.level === 3 &&
    l420.title === 'Tastemaker' &&
    l420.intoLevel === 100 &&
    l420.span === 320 &&
    l420.pct === 31 &&
    l420.nextTitle === 'Stylist',
);
const lMax = levelFor(5000);
check(
  'levelFor(5000) → Icon L7 maxed (100%, no next level)',
  lMax.level === 7 && lMax.title === 'Icon' && lMax.maxed === true && lMax.pct === 100 && lMax.nextTitle === null,
);

// ── Bundle pricing + the verified-only honesty gate (lib/bundle-deals) ────────
const prod = (retailer: string, priceCents: number): Product =>
  ({ id: 'test', brand: retailer, name: 'Test piece', category: 'top', priceCents, currency: 'USD', retailer } as unknown as Product);

const empty = computeBundleDeal([]);
check('computeBundleDeal([]) → no deal, no savings', empty.retailCents === 0 && empty.hasDeal === false && empty.pct === 0);

const verified = computeBundleDeal([prod('adidas', 10000)]);
check(
  'verified retailer (adidas 15%) → real savings (1500/8500/15%)',
  verified.hasDeal === true && verified.savingsCents === 1500 && verified.dealCents === 8500 && verified.pct === 15,
);

const unverified = computeBundleDeal([prod('SKIMS', 10000)]);
check(
  'HONESTY: unverified retailer (SKIMS) → NO discount applied',
  unverified.hasDeal === false && unverified.savingsCents === 0,
);

const unknown = computeBundleDeal([prod('Some Random Boutique', 10000)]);
check('unknown retailer → no deal', unknown.hasDeal === false && unknown.savingsCents === 0);

// ── Engagement XP + quests (lib/stylist-xp · bumpDaily) ──────────────────────
// "XP from real actions only" + auto-claimed daily quests + capped passive XP.
installMemoryStorage();
// like +5 (like-3 quest needs 3, not yet)
check('bumpDaily(likes) → +5 (no quest yet)', bumpDaily('likes') === 5);
// save +8 action + 20 save-fit quest = 28
check('bumpDaily(saves) → +8 +20 quest = 28', bumpDaily('saves') === 28);
// open drop +12 action + 30 open-drop quest = 42
check('bumpDaily(dropsOpened) → +12 +30 quest = 42', bumpDaily('dropsOpened') === 42);
check('XP total accrued correctly (5+28+42=75)', getXp() === 75);
// 2nd like (+5, no quest), 3rd like (+5 +20 like-3 quest = 25)
check('bumpDaily(likes) 2nd → +5 (quest needs 3)', bumpDaily('likes') === 5);
check('bumpDaily(likes) 3rd → +5 +20 like-3 quest = 25', bumpDaily('likes') === 25);

// Passive-view XP cap (honesty: swiping can't be grinded past 40/day).
installMemoryStorage();
let viewXp = 0;
for (let i = 0; i < 40; i += 1) viewXp += bumpDaily('looksViewed');
check('looksViewed: first 40 each grant +1 (total 40)', viewXp === 40);
check('looksViewed: 41st grants 0 (capped at 40/day)', bumpDaily('looksViewed') === 0);

// ── Level-up detection (lib/stylist-xp · consumeLevelUp) — drives the feed's
//    earned tier-crossing celebration; must fire exactly once per crossing. ───
installMemoryStorage();
const lvlStore = (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage;
lvlStore.setItem('sylistly.xp.total', '0'); // Rookie (L1)
check('consumeLevelUp: first call baselines → null', consumeLevelUp() === null);
lvlStore.setItem('sylistly.xp.total', '150'); // crosses into Curator (L2, ≥120)
const lvlUp = consumeLevelUp();
check('consumeLevelUp: detects Rookie→Curator (L2)', !!lvlUp && lvlUp.level === 2 && lvlUp.title === 'Curator');
check('consumeLevelUp: fires once — 2nd call → null', consumeLevelUp() === null);
lvlStore.setItem('sylistly.xp.total', '700'); // multi-tier jump into Stylist (L4, ≥640)
check('consumeLevelUp: detects later multi-tier jump → L4', (consumeLevelUp()?.level ?? 0) === 4);

// ── Affiliate wrapping (lib/affiliate · wrapAffiliate) — REVENUE logic ───────
for (const k of [
  'NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID',
  'SKIMLINKS_PUBLISHER_ID',
  'NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID',
  'RAKUTEN_AFFILIATE_ID',
]) delete process.env[k];

const rawUrl = 'https://www.everlane.com/products/tee';
check('wrapAffiliate: no env → graceful raw-url fallback', wrapAffiliate(rawUrl) === rawUrl);
check('wrapAffiliate: non-http input → returned unchanged', wrapAffiliate('mailto:a@b.com') === 'mailto:a@b.com');

process.env.NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID = 'pub123';
check(
  'wrapAffiliate: skimlinks env → wraps via go.skimresources',
  wrapAffiliate(rawUrl).startsWith('https://go.skimresources.com/?id=pub123&url='),
);
// Rakuten partner (nordstrom) still has a PLACEHOLDER advertiser id → must be
// skipped (no broken linksynergy links), falling through to skimlinks.
check(
  'wrapAffiliate: rakuten partner w/ placeholder id → skipped, not broken',
  wrapAffiliate('https://www.nordstrom.com/s/shoe/12345').startsWith('https://go.skimresources.com/'),
);
delete process.env.NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID;

// ── Honest rarity tiers (lib/look-rarity · lookRarity) ───────────────────────
// Deterministic score = (exact/n)*38 + (min(n,8)/8)*22 + price-bonus + syli-bonus.
const CATS: Category[] = ['top', 'bottom', 'outer', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];
const rarityItem = (category: Category, priceCents: number, exact: boolean): Product =>
  ({
    id: category,
    brand: 'B',
    name: 'N',
    category,
    priceCents,
    currency: 'USD',
    ...(exact ? { productUrl: `https://shop.example.com/products/${category}` } : {}),
  } as unknown as Product);
const buildLook = (n: number, priceEach: number, exact: boolean): Partial<Record<Category, Product>> => {
  const items: Partial<Record<Category, Product>> = {};
  for (let i = 0; i < n; i += 1) items[CATS[i]] = rarityItem(CATS[i], priceEach, exact);
  return items;
};
check('lookRarity({}) → everyday', lookRarity({}).tier === 'everyday');
check('lookRarity: 4 exact ~$500 → standout', lookRarity(buildLook(4, 12500, true)).tier === 'standout');
check('lookRarity: 6 exact ~$1200 → showpiece', lookRarity(buildLook(6, 20000, true)).tier === 'showpiece');
check('lookRarity: 8 exact $2000 + syli source → heat', lookRarity(buildLook(8, 25000, true), 'syli').tier === 'heat');

// ── Onboarding quiz → style identity (lib/style-identity · deriveIdentity) ────
const answer = (lane: string, palette: string): StyleAnswers =>
  ({ lane, palette } as unknown as StyleAnswers); // deriveIdentity reads only lane+palette
check('deriveIdentity sport → luxe-sport', deriveIdentity(answer('sport', 'neutral')).id === 'luxe-sport');
check('deriveIdentity street+dark → noir-edge', deriveIdentity(answer('street', 'dark')).id === 'noir-edge');
check('deriveIdentity street+neutral → street-minimalist', deriveIdentity(answer('street', 'neutral')).id === 'street-minimalist');
check('deriveIdentity clean+bold → bold-statement', deriveIdentity(answer('clean', 'bold')).id === 'bold-statement');
check('deriveIdentity dressy+neutral → soft-romantic', deriveIdentity(answer('dressy', 'neutral')).id === 'soft-romantic');

// ── Catalog quality gate (lib/product-image-quality) — keeps bad images off ──
// Exclusion cases short-circuit cleanly (no dependence on the URL-blocklist).
const qp = (extra: Record<string, unknown>): Product =>
  ({ id: 'x', brand: 'B', name: 'N', category: 'top', priceCents: 1000, currency: 'USD', ...extra } as unknown as Product);
check('getTransparentProductImageUrl(null) → null', getTransparentProductImageUrl(null) === null);
check('getTransparentProductImageUrl: no asset → null', getTransparentProductImageUrl(qp({})) === null);
check('getTransparentProductImageUrl: quarantined → null', getTransparentProductImageUrl(qp({ imageStatus: 'quarantined', imageTransparentUrl: 'https://media.example.com/p.png' })) === null);
check('getTransparentProductImageUrl: cutout-failed → null', getTransparentProductImageUrl(qp({ imageStatus: 'cutout-failed', imageTransparentUrl: 'https://media.example.com/p.png' })) === null);
check('isEditorialCutoutProduct(null) → false', isEditorialCutoutProduct(null) === false);
check('isEditorialCutoutProduct: quarantined → false (excluded from feed)', isEditorialCutoutProduct(qp({ imageStatus: 'quarantined', imageTransparentUrl: 'https://media.example.com/p.png' })) === false);

// ── Shop-link resolution (lib/product-links · getProductOutboundUrl) ─────────
// Priority chain: productUrl → retailerUrl → … → Google Shopping search fallback.
const lp = (extra: Record<string, unknown>): Product =>
  ({ id: 'x', brand: 'Nike', name: 'Tee', category: 'top', priceCents: 1000, currency: 'USD', ...extra } as unknown as Product);
check('getProductOutboundUrl: productUrl wins', getProductOutboundUrl(lp({ productUrl: 'https://shop.com/p', retailerUrl: 'https://r.com/x' })) === 'https://shop.com/p');
check('getProductOutboundUrl: falls back to retailerUrl', getProductOutboundUrl(lp({ retailerUrl: 'https://r.com/x' })) === 'https://r.com/x');
check('getProductOutboundUrl: invalid productUrl skipped → retailerUrl', getProductOutboundUrl(lp({ productUrl: 'not-a-url', retailerUrl: 'https://r.com/x' })) === 'https://r.com/x');
check('getProductOutboundUrl: no links → Google Shopping search fallback', getProductOutboundUrl(lp({})).startsWith('https://www.google.com/search'));

// ── Frame correctness (lib/frame-inference · hasFrameMismatch) ───────────────
// Keeps frame-inappropriate pieces out of a gendered scroll; androgynous = no gate.
const fp = (name: string, brand: string): Product =>
  ({ id: 'x', brand, name, category: 'top', priceCents: 1000, currency: 'USD' } as unknown as Product);
check('hasFrameMismatch: androgynous → never a mismatch', hasFrameMismatch(fp('Cotton Crew Tee', 'Everlane'), 'androgynous') === false);
check('hasFrameMismatch: fem frame + masc keyword (boxer) → true', hasFrameMismatch(fp('Cotton Boxer Briefs', 'Hanes'), 'fem') === true);
check('hasFrameMismatch: fem frame + neutral piece → false', hasFrameMismatch(fp('Cotton Crew Tee', 'Everlane'), 'fem') === false);
check('hasFrameMismatch: masc frame + neutral piece → false', hasFrameMismatch(fp('Cotton Crew Tee', 'Everlane'), 'masc') === false);

// ── Image proxy URL builder (lib/image-url · proxiedImageUrl) ────────────────
check('proxiedImageUrl(undefined) → empty', proxiedImageUrl(undefined) === '');
check('proxiedImageUrl: data: URL passes through', proxiedImageUrl('data:image/png;base64,AAA') === 'data:image/png;base64,AAA');
check('proxiedImageUrl: http URL → /api/image proxy', proxiedImageUrl('https://x.com/p.jpg').startsWith('/api/image?url='));
check(
  'proxiedImageUrl: cutout + category params passed',
  (() => { const u = proxiedImageUrl('https://x.com/p.jpg', { cutout: true, category: 'top' }); return u.includes('cutout=1') && u.includes('category=top'); })(),
);

// ── Direct-retailer detection (lib/retailer-url · hasDirectRetailerUrl) ───────
check('hasDirectRetailerUrl: real retailer host → true', hasDirectRetailerUrl('https://www.nike.com/t/shoe') === true);
check('hasDirectRetailerUrl: google search host → false', hasDirectRetailerUrl('https://www.google.com/search?q=shoes') === false);
check('hasDirectRetailerUrl: non-url → false', hasDirectRetailerUrl('not a url') === false);

// ── Frame input normalization (lib/search-frame · normalizeSearchFrame) ───────
check('normalizeSearchFrame: valid frame kept', normalizeSearchFrame('masc') === 'masc');
check('normalizeSearchFrame: invalid → androgynous default', normalizeSearchFrame('xyz') === 'androgynous');
check('normalizeSearchFrame: non-string → androgynous default', normalizeSearchFrame(null) === 'androgynous');

// ── Vibe-appropriate filtering (lib/vibe-fit · isVibeAppropriate) ────────────
// (reuses fp from the frame block: fp(name, brand) → Product; nameOf lowercases)
check('isVibeAppropriate: office top rejects a hoodie', isVibeAppropriate(fp('Hoodie', 'Cozy Co'), 'office', 'top' as Category) === false);
check('isVibeAppropriate: office top allows an oxford shirt', isVibeAppropriate(fp('Oxford Shirt', 'Charles'), 'office', 'top' as Category) === true);
check('isVibeAppropriate: gym shoes allow a running shoe', isVibeAppropriate(fp('Running Shoes', 'Nike'), 'gym', 'shoes' as Category) === true);
check('isVibeAppropriate: gym shoes reject a leather loafer', isVibeAppropriate(fp('Leather Loafer', 'Aldo'), 'gym', 'shoes' as Category) === false);
check('isVibeAppropriate: non-special vibe → always allowed', isVibeAppropriate(fp('Cotton Tee', 'Uniqlo'), 'cozy', 'top' as Category) === true);

// ── AI spend cap default + parsing (lib/ai-budget · dailyCapUsd) ─────────────
// Memory flags spend-cap bugs; lock in the $10 default + safe parsing.
delete process.env.AI_DAILY_USD_CAP;
check('dailyCapUsd: unset → $10 default ceiling', dailyCapUsd() === 10);
process.env.AI_DAILY_USD_CAP = '5';
check('dailyCapUsd: valid value respected', dailyCapUsd() === 5);
process.env.AI_DAILY_USD_CAP = 'abc';
check('dailyCapUsd: non-numeric → $10 default', dailyCapUsd() === 10);
process.env.AI_DAILY_USD_CAP = '-3';
check('dailyCapUsd: negative → $10 default', dailyCapUsd() === 10);
process.env.AI_DAILY_USD_CAP = '0';
check('dailyCapUsd: explicit 0 (no-cap) respected', dailyCapUsd() === 0);
delete process.env.AI_DAILY_USD_CAP;

// ── AI cost estimation (lib/ai-budget · estimateCostUsd) — spend-cap basis ────
// Pricing/1M: haiku 1/5 · sonnet 3/15 · opus 15/75.
check('estimateCostUsd: sonnet 1M input = $3', estimateCostUsd('claude-sonnet-4-6', { input_tokens: 1_000_000, output_tokens: 0 }) === 3);
check('estimateCostUsd: opus 1M output = $75', estimateCostUsd('claude-opus-4-8', { input_tokens: 0, output_tokens: 1_000_000 }) === 75);
check('estimateCostUsd: haiku 1M in + 1M out = $6', estimateCostUsd('claude-haiku-4-5', { input_tokens: 1_000_000, output_tokens: 1_000_000 }) === 6);
check('estimateCostUsd: zero usage = $0', estimateCostUsd('claude-sonnet-4-6', { input_tokens: 0, output_tokens: 0 }) === 0);
check('estimateCostUsd: negative tokens clamp to $0', estimateCostUsd('claude-sonnet-4-6', { input_tokens: -5, output_tokens: -5 }) === 0);

// ── AI spend-cap ENFORCEMENT (recordAiUsage drives aiBudgetAvailable) ─────────
// The actual protection: once today's spend exceeds the cap, AI is unavailable.
process.env.ANTHROPIC_API_KEY = 'test-key-for-budget-unit-check';
process.env.AI_DAILY_USD_CAP = '10';
delete process.env.AI_ENABLED; // kill switch off
check('aiBudgetAvailable: true under the cap', aiBudgetAvailable() === true);
recordAiUsage('claude-opus-4-8', { input_tokens: 0, output_tokens: 1_000_000 }); // +$75 > $10
check('aiBudgetAvailable: false once spend exceeds the cap', aiBudgetAvailable() === false);
delete process.env.AI_DAILY_USD_CAP;
delete process.env.ANTHROPIC_API_KEY;

// ── AI spend reporting (lib/ai-budget · aiBudgetSnapshot) ────────────────────
// The founder monitors spend through this snapshot; lock in that it reports the
// env cap, the kill-switch state, and that recorded usage moves spentUsd up.
process.env.AI_DAILY_USD_CAP = '20';
delete process.env.AI_ENABLED; // kill switch off → not killed
const snapBefore = aiBudgetSnapshot();
recordAiUsage('claude-sonnet-4-6', { input_tokens: 1_000_000, output_tokens: 0 }); // +$3
const snapAfter = aiBudgetSnapshot();
check('aiBudgetSnapshot: capUsd reflects env override', snapAfter.capUsd === 20);
check('aiBudgetSnapshot: killed false when AI not disabled', snapAfter.killed === false);
check('aiBudgetSnapshot: spentUsd rises when usage is recorded', snapAfter.spentUsd > snapBefore.spentUsd);
delete process.env.AI_DAILY_USD_CAP;

// ── Search text builder (lib/presentation-score · productSearchText) ─────────
// Lowercase inputs so the assertion is robust to the normalizer's casing.
const stxt = productSearchText({ id: 'x', brand: 'acmebrand', name: 'zephyrwidget tee', category: 'top', priceCents: 1000, currency: 'USD' } as unknown as Product);
check('productSearchText: includes brand + name tokens', stxt.includes('acmebrand') && stxt.includes('zephyrwidget'));
check('productSearchText: empty product → string (no throw)', typeof productSearchText({ id: 'y' } as unknown as Product) === 'string');
const pres = inferProductPresentation({ id: 'z', brand: 'zzqq', name: 'qqzz wibble', category: 'top', priceCents: 1000, currency: 'USD' } as unknown as Product);
check('inferProductPresentation: ungendered → defaults to {neutral}', pres.has('neutral') && pres.size === 1);

// ── Outfit colour coordination (lib/color-harmony · colorHarmonyScore) ───────
// The "actually smart outfit selection" upgrade: coordinated palettes score
// higher than busy clashes so the generator favours fits that go together.
const neutralAnchor = colorHarmonyScore('black wool coat', 'navy trouser cream knit');
const tonalRepeat = colorHarmonyScore('olive cargo pant', 'olive bomber black tee');
const thirdAccentClash = colorHarmonyScore('orange puffer', 'red knit green skirt');
check('colorHarmony: neutral anchor scores positive', neutralAnchor > 0);
check('colorHarmony: tonal repeat beats a 3-accent clash', tonalRepeat > thirdAccentClash);
check('colorHarmony: a 3rd distinct accent is penalised (negative)', thirdAccentClash < 0);
check('colorHarmony: neutral anchor beats the clash', neutralAnchor > thirdAccentClash);

// NOTE: streak logic (lib/drop-vault) + isExactProductUrl (lib/checkout) are
// covered by live QA, not here — they transitively import modules via the `@/`
// path alias (and the generated client-catalog), which the standalone jiti
// runner doesn't resolve. Only relative/type-only-import libs are unit-testable.

if (failures > 0) {
  console.error(`\n${failures} unit check(s) FAILED`);
  process.exit(1);
}
console.log('\nOverall: PASS');
