import {
  TASTE_PROFILE_STORAGE_KEY,
  TASTE_PROFILE_MAX_BYTES,
  buildTasteRankingSignals,
  loadTasteProfile,
  recordTasteSignal,
  scoreOutfitForTaste,
  scoreProductForTaste,
  scoreLookForTaste,
  tasteProfileSerializedBytes,
  tasteVibeCounters,
  undoTasteSignal,
  type TasteStorage,
} from '../lib/taste-profile';
import { respectsCatalogGenerationHardPreferences } from '../lib/catalog-generation-preferences';
import type { Category, Product } from '../lib/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

class MemoryStorage implements TasteStorage {
  protected readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingReadStorage extends MemoryStorage {
  getItem(): string | null {
    throw new Error('blocked');
  }
}

class TightQuotaStorage extends MemoryStorage {
  constructor(private readonly maxBytes: number) { super(); }
  setItem(key: string, value: string): void {
    if (tasteProfileSerializedBytes(value) > this.maxBytes) throw new Error('quota');
    super.setItem(key, value);
  }
}

function product(
  id: string,
  category: Category,
  brand: string,
  colors: string[],
  styles: string[],
): Product {
  return {
    id,
    category,
    brand,
    retailer: `${brand} Store`,
    name: `${brand} ${category}`,
    colors,
    metadata: { styles },
    vibes: styles,
    priceCents: 10_000,
    currency: 'USD',
    retailerUrl: `https://example.com/products/${id}`,
    imageUrl: `https://example.com/images/${id}.jpg`,
  };
}

let failures = 0;
function check(label: string, condition: boolean): void {
  if (condition) console.log(`PASS ${label}`);
  else {
    console.error(`FAIL ${label}`);
    failures += 1;
  }
}

console.log('Taste profile checks');
console.log('====================');

const now = Date.parse('2026-08-10T20:00:00.000Z');
const legacyStorage = new MemoryStorage();
legacyStorage.setItem('sylistly.vibe-likes.v1', JSON.stringify({ clean: 4, street: 1 }));
legacyStorage.setItem('sylistly.vibe-passes.v1', JSON.stringify({ street: 5 }));
legacyStorage.setItem('sylistly-builder-preferences-v1', JSON.stringify({
  events: [
    { kind: 'save', vibe: 'office', productIds: ['legacy-save'], categories: ['top'], createdAt: now - 1_000 },
    { kind: 'pass', vibe: 'gym', productIds: ['legacy-pass'], categories: ['shoes'], createdAt: now - 2_000 },
  ],
}));

const migrated = loadTasteProfile(legacyStorage, now);
const migratedSignals = buildTasteRankingSignals(migrated, now);
check('legacy Feed likes migrate into positive vibe evidence', (migratedSignals.vibeScores.clean || 0) > 0);
check('legacy Feed passes can outweigh old likes without hard exclusion', (migratedSignals.vibeScores.street || 0) < 0);
check('legacy builder save events become positive product evidence', (migratedSignals.productScores['legacy save'] || 0) > 0);
check('legacy builder pass events become negative product evidence', (migratedSignals.productScores['legacy pass'] || 0) < 0);
const migratedEventCount = migrated.events.length;
check('legacy migration is idempotent', loadTasteProfile(legacyStorage, now + 1).events.length === migratedEventCount);
check('unified model persists under one versioned key', Boolean(legacyStorage.getItem(TASTE_PROFILE_STORAGE_KEY)));
check('blocked storage reads fail safe instead of throwing', loadTasteProfile(new ThrowingReadStorage(), now).events.length === 0);

const storage = new MemoryStorage();
loadTasteProfile(storage, now);
const liked = product('liked-top', 'top', 'Alpha', ['black'], ['clean']);
const sameBrand = product('alpha-shoes', 'shoes', 'Alpha', ['white'], ['office']);
const passed = product('passed-top', 'top', 'Beta', ['red'], ['street']);
const samePassedBrand = product('beta-shoes', 'shoes', 'Beta', ['red'], ['street']);
const replacement = product('replacement-top', 'top', 'Gamma', ['cream'], ['clean']);

recordTasteSignal(storage, {
  action: 'save',
  vibe: 'clean',
  products: [liked],
  contextId: 'save-1',
}, now + 10);
recordTasteSignal(storage, {
  action: 'save',
  vibe: 'clean',
  products: [liked],
  contextId: 'save-1',
}, now + 11);
check(
  'same action/context upserts idempotently',
  loadTasteProfile(storage, now + 12).events.filter((event) => event.action === 'save' && event.contextId === 'save-1').length === 1,
);
recordTasteSignal(storage, {
  action: 'shop',
  vibe: 'clean',
  products: [liked],
  contextId: 'shop-1',
}, now + 20);
recordTasteSignal(storage, {
  action: 'pass',
  vibe: 'street',
  products: [passed],
  contextId: 'pass-1',
}, now + 30);
recordTasteSignal(storage, {
  action: 'replacement',
  vibe: 'clean',
  products: [replacement],
  rejectedProducts: [passed],
  contextId: 'replace-1',
}, now + 40);
recordTasteSignal(storage, {
  action: 'remix',
  vibe: 'clean',
  products: [replacement],
  contextId: 'remix-1',
}, now + 50);

let signals = buildTasteRankingSignals(loadTasteProfile(storage, now + 60), now + 60);
check('save + shop make the exact product rank higher', scoreProductForTaste(liked, signals) > 20);
check('brand evidence gently lifts a related product', scoreProductForTaste(sameBrand, signals) > 0);
check('pass + replacement rejection down-rank the old product', scoreProductForTaste(passed, signals) < 0);
check('negative brand evidence gently lowers a related product', scoreProductForTaste(samePassedBrand, signals) < 0);
check('selected replacement and remix lift the accepted product', scoreProductForTaste(replacement, signals) > 0);
check('category evidence is consumed by product ranking', (signals.categoryScores.top || 0) !== 0 && scoreProductForTaste(replacement, signals) !== 0);
check(
  'outfit scorer lets the shared evidence alter pre-generated row ranking',
  scoreOutfitForTaste([liked, sameBrand], signals) > scoreOutfitForTaste([passed, samePassedBrand], signals),
);
check(
  'returning-feed deck score combines product and vibe evidence',
  scoreLookForTaste([liked], 'clean', signals) > scoreLookForTaste([passed], 'street', signals),
);
const counters = tasteVibeCounters(signals);
check('Feed adapter reads positive and negative vibes from the same model', counters.likes.clean > 0 && counters.passes.street > 0);

const passedScoreBeforeUndo = scoreProductForTaste(passed, signals);
const undo = undoTasteSignal(storage, { action: 'pass', contextId: 'pass-1' }, now + 70);
signals = buildTasteRankingSignals(undo.profile, now + 70);
check('pass undo removes the exact persisted event', undo.undone && !undo.profile.events.some((event) => event.contextId === 'pass-1'));
check('pass undo reduces the rejected product penalty', scoreProductForTaste(passed, signals) > passedScoreBeforeUndo);

for (let index = 0; index < 280; index += 1) {
  recordTasteSignal(storage, {
    action: index % 2 ? 'save' : 'pass',
    vibe: index % 2 ? 'clean' : 'street',
    products: [liked],
    contextId: `cap-${index}`,
  }, now + 100 + index);
}
const capped = loadTasteProfile(storage, now + 500);
const cappedScore = scoreProductForTaste(liked, buildTasteRankingSignals(capped, now + 500));
check('event history stays bounded on long-running devices', capped.events.length <= 180);
check('ranking nudges stay bounded and never become a hard gate', cappedScore >= -72 && cappedScore <= 72);
const compactRaw = storage.getItem(TASTE_PROFILE_STORAGE_KEY) || '';
check('persisted model uses the compact wire shape', compactRaw.includes('"v":1') && !compactRaw.includes('schemaVersion'));
check('persisted model stays within its explicit byte budget', tasteProfileSerializedBytes(compactRaw) <= TASTE_PROFILE_MAX_BYTES);

const tightStorage = new TightQuotaStorage(2_500);
for (let index = 0; index < 80; index += 1) {
  recordTasteSignal(tightStorage, {
    action: 'save',
    vibe: 'clean',
    products: [product(`quota-${index}`, 'top', `Long Brand ${index}`, ['black'], ['clean'])],
    contextId: `quota-context-${index}`,
  }, now + 1_000 + index);
}
const tightRaw = tightStorage.getItem(TASTE_PROFILE_STORAGE_KEY) || '';
check('quota rejection retries with a smaller persisted history', Boolean(tightRaw) && tasteProfileSerializedBytes(tightRaw) <= 2_500);

const explicitlySized = { ...liked, availableSizes: ['XS'] } as Product;
check(
  'library hard predicate rejects excluded brands, terms, and explicit size misses',
  !respectsCatalogGenerationHardPreferences(explicitlySized, { excludedBrands: ['Alpha'] })
    && !respectsCatalogGenerationHardPreferences(explicitlySized, { excludedTerms: ['clean'] })
    && !respectsCatalogGenerationHardPreferences(explicitlySized, { preferredSizes: { top: 'XL' } }),
);

const repoRoot = join(__dirname, '..');
const librarySource = readFileSync(join(repoRoot, 'lib/outfit-library.ts'), 'utf8');
const buildSource = readFileSync(join(repoRoot, 'app/build/page.tsx'), 'utf8');
const feedSource = readFileSync(join(repoRoot, 'components/Feed.tsx'), 'utf8');
check(
  'pre-generated library applies hard profile eligibility and Build passes preferences',
  librarySource.includes('respectsCatalogGenerationHardPreferences(product, opts.preferences)')
    && buildSource.includes('preferences: {\n                ...generationPreferences'),
);
const successfulReplaceIndex = buildSource.indexOf('replaceItems(nextItems);');
const remixPersistIndex = buildSource.indexOf("if (options?.tasteAction === 'remix'", successfulReplaceIndex);
check('Builder records remix only after successful board replacement', successfulReplaceIndex >= 0 && remixPersistIndex > successfulReplaceIndex);
check(
  'returning Feed reorders mounted cards without loading the heavy engine',
  feedSource.includes('score: scoreLookForTaste(lookProducts(look.items)')
    && feedSource.includes('no eager catalog-engine import or deck replacement'),
);

const corruptStorage = new MemoryStorage();
corruptStorage.setItem(TASTE_PROFILE_STORAGE_KEY, '{broken');
check('corrupt local data fails safe to a usable profile', loadTasteProfile(corruptStorage, now).schemaVersion === 1);

if (failures) {
  console.error(`\n${failures} taste profile check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll taste profile checks passed.');
