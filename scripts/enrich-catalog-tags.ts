import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Product } from '../lib/types.ts';
import { inferProductGender } from '../lib/frame-inference';

interface CatalogTagOverride {
  vibes?: string[];
  occasions?: string[];
  searchTerms?: string[];
  gender?: Array<'masc' | 'fem' | 'androgynous'>;
}

type OverrideMap = Record<string, CatalogTagOverride>;

const GENERATED_PATH = path.resolve(process.cwd(), 'data/generated-catalog.json');
const PHOTO_PATH = path.resolve(process.cwd(), 'data/photo-catalog.json');
const OVERRIDES_PATH = path.resolve(process.cwd(), 'data/catalog-tag-overrides.json');

const TARGET_VIBES = [
  'clean',
  'minimal',
  'streetwear',
  'night',
  'date',
  'gym',
  'athletic',
  'office',
  'business casual',
  'old money',
  'vacation',
  'beach',
  'summer',
  'winter',
  'cozy',
  'edgy',
  'techwear',
  'y2k',
  'western',
  'college',
  'casual',
  'luxury',
  'preppy',
  'coffee',
  'airport',
];

const OCCASION_BY_VIBE: Record<string, string[]> = {
  clean: ['everyday'],
  minimal: ['everyday'],
  night: ['night out'],
  date: ['date', 'night out'],
  gym: ['workout'],
  athletic: ['workout', 'everyday'],
  'old money': ['office', 'date'],
  y2k: ['everyday', 'night out'],
  college: ['school', 'everyday'],
  luxury: ['date', 'night out'],
  streetwear: ['everyday'],
  casual: ['everyday'],
  preppy: ['office', 'everyday'],
  'business casual': ['office'],
  office: ['office'],
  vacation: ['vacation'],
  beach: ['vacation'],
  summer: ['vacation', 'everyday'],
  winter: ['winter', 'everyday'],
  cozy: ['winter', 'everyday'],
  edgy: ['night out', 'everyday'],
  techwear: ['everyday'],
  western: ['everyday'],
  coffee: ['everyday'],
  airport: ['travel'],
};

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function metadataList(product: Product, key: string): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function uniqueStrings(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group || []).filter((value) => typeof value === 'string' && value.trim())));
}

function hasAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(normalize(term)));
}

function inferTags(product: Product): CatalogTagOverride {
  const existingTerms = uniqueStrings(
    product.searchTerms,
    metadataList(product, 'searchTerms'),
    metadataList(product, 'keywords'),
    metadataList(product, 'colors'),
  );
  const haystack = normalize([
    product.category,
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...existingTerms,
    ...metadataList(product, 'sourceQuery'),
  ].join(' '));
  const vibes = new Set<string>();
  const searchTerms = new Set<string>(existingTerms);

  const add = (nextVibes: string[], nextTerms: string[]): void => {
    nextVibes.forEach((vibe) => vibes.add(vibe));
    nextTerms.forEach((term) => searchTerms.add(term));
  };

  if (hasAny(haystack, [
    'nike', 'adidas', 'new balance', 'asics', 'salomon', 'alo', 'lululemon', 'gymshark',
    'legging', 'sports bra', 'running', 'training', 'workout', 'gym short', 'duffel', 'sneaker',
    'performance', 'athletic', 'tennis skirt', 'yoga',
  ])) {
    add(['gym', 'athletic'], ['gym', 'athletic', 'training', 'workout']);
  }

  if (hasAny(haystack, [
    'black top', 'leather', 'heel', 'loafers', 'silver chain', 'chain', 'dressy', 'satin',
    'mini bag', 'shoulder bag', 'corset', 'slip skirt', 'pearl', 'huggie', 'hoop', 'night out',
    'date night', 'going out', 'stiletto',
  ])) {
    add(['night', 'date'], ['night out', 'date', 'dressy']);
  }

  if (hasAny(haystack, [
    'polo ralph lauren', 'ralph lauren', 'loafers', 'cardigan', 'chinos', 'blazer', 'cashmere',
    'sweater', 'pleated skirt', 'oxford', 'trouser', 'tailored', 'wallabee', 'polo soft',
  ])) {
    add(['old money', 'preppy', 'business casual'], ['old money', 'preppy', 'tailored', 'office']);
  }

  if (hasAny(haystack, [
    'prada', 'gucci', 'saint laurent', 'ysl', 'miu miu', 'coach', 'jacquemus', 'acne studios',
    'ganni', 'cos', 'reiss', 'massimo dutti', 'tiffany', 'swarovski', 'bottega', 'polene',
    'longchamp', 'michael kors', 'mejuri', 'missoma', 'david yurman', 'monica vinader',
  ])) {
    add(['luxury'], ['luxury', 'designer', 'premium']);
  }

  if (hasAny(haystack, [
    'hoodie', 'jeans', 'cap', 'sneakers', 'backpack', 'cargo', 'oversized', 'campus',
    'college', 'new era', 'stussy', 'carhartt', 'dickies', 'jordan', 'converse', 'bucket hat',
    'crossbody', 'tee',
  ])) {
    add(['college', 'casual', 'streetwear'], ['college', 'casual', 'streetwear']);
  }

  if (hasAny(haystack, [
    'minimalist', 'minimal', 'clean', 'neutral', 'white', 'black', 'beige', 'cream', 'ivory',
    'uniqlo', 'cos', 'everlane', 'plain tee', 't shirt', 't-shirt', 'trouser', 'simple sneaker',
    'air force 1', 'samba', 'wide leg', 'boxy tee',
  ])) {
    add(['clean', 'minimal'], ['clean', 'minimal', 'neutral']);
  }

  if (hasAny(haystack, [
    'baby tee', 'low rise', 'baggy jeans', 'mini skirt', 'platform', 'butterfly', 'sunglasses',
    'shoulder bag', 'y2k', 'cargo skirt', 'crop top', 'cropped', 'parachute',
  ])) {
    add(['y2k'], ['y2k', 'retro', '2000s']);
  }

  if (hasAny(haystack, [
    'blazer', 'trouser', 'button down', 'button-down', 'oxford shirt', 'dress shirt',
    'work bag', 'briefcase', 'satchel', 'tote', 'loafer', 'flat', 'cardigan', 'chino',
    'tailored', 'office', 'business casual', 'workwear',
  ])) {
    add(['office', 'business casual'], ['office', 'work', 'tailored', 'business casual']);
  }

  if (hasAny(haystack, [
    'linen', 'resort', 'vacation', 'beach', 'summer', 'sandals', 'sandal', 'slide',
    'straw', 'raffia', 'swim', 'bikini', 'tank', 'shorts', 'camp collar', 'espadrille',
  ])) {
    add(['vacation', 'beach', 'summer'], ['vacation', 'beach', 'summer', 'resort']);
  }

  if (hasAny(haystack, [
    'puffer', 'beanie', 'fleece', 'wool', 'winter', 'cozy', 'sweatpants', 'sweatshirt',
    'knit', 'sweater', 'boot', 'boots', 'thermal', 'quarter zip', 'hoodie',
  ])) {
    add(['winter', 'cozy'], ['winter', 'cozy', 'warm']);
  }

  if (hasAny(haystack, [
    'black', 'leather', 'cargo', 'shell', 'utility', 'tactical', 'techwear', 'crossbody',
    'silver', 'chain', 'boot', 'boots', 'edgy', 'grunge', 'parachute',
  ])) {
    add(['edgy', 'techwear'], ['edgy', 'techwear', 'utility']);
  }

  if (hasAny(haystack, [
    'cowboy', 'western', 'suede', 'rugged', 'denim jacket', 'bootcut', 'belt', 'turquoise',
    'ranch', 'rodeo',
  ])) {
    add(['western'], ['western', 'rugged']);
  }

  if (hasAny(haystack, ['coffee', 'coffee run', 'cafe', 'easy pant', 'everyday tote'])) {
    add(['coffee', 'casual', 'clean'], ['coffee run', 'everyday']);
  }

  if (hasAny(haystack, ['airport', 'travel', 'carry on', 'carry-on', 'travel tote', 'weekender', 'jogger'])) {
    add(['airport', 'clean', 'casual'], ['airport', 'travel']);
  }

  if (product.category === 'eyewear' && hasAny(haystack, ['black', 'cat eye', 'rectangle', 'prada', 'gucci', 'ray ban'])) {
    add(['night', 'date', 'luxury'], ['sunglasses', 'eyewear']);
  }

  const inferredVibes = Array.from(vibes);
  const occasions = uniqueStrings(...inferredVibes.map((vibe) => OCCASION_BY_VIBE[vibe]));

  return {
    vibes: inferredVibes,
    occasions,
    searchTerms: Array.from(searchTerms),
    gender: inferProductGender(product),
  };
}

function applyOverride(product: Product, override?: CatalogTagOverride): Product {
  if (!override) return product;
  const vibes = uniqueStrings(product.vibes, metadataList(product, 'vibes'), metadataList(product, 'styles'), override.vibes);
  const occasions = uniqueStrings(product.occasions, metadataList(product, 'occasions'), override.occasions);
  const searchTerms = uniqueStrings(product.searchTerms, metadataList(product, 'searchTerms'), metadataList(product, 'keywords'), override.searchTerms);
  const genderSource = override.gender?.length ? override.gender : uniqueStrings(product.gender, metadataList(product, 'gender'));
  const gender = uniqueStrings(genderSource)
    .filter((tag): tag is 'masc' | 'fem' | 'androgynous' => tag === 'masc' || tag === 'fem' || tag === 'androgynous');
  return {
    ...product,
    vibes,
    occasions,
    searchTerms,
    gender,
    metadata: {
      ...(product.metadata || {}),
      vibes,
      styles: vibes,
      occasions,
      searchTerms,
      keywords: searchTerms,
      gender,
    },
  };
}

function vibeCoverage(products: Product[]): Record<string, number> {
  const counts = Object.fromEntries(TARGET_VIBES.map((vibe) => [vibe, 0])) as Record<string, number>;
  for (const product of products) {
    const vibes = uniqueStrings(product.vibes, metadataList(product, 'vibes'), metadataList(product, 'styles'));
    const occasions = uniqueStrings(product.occasions, metadataList(product, 'occasions'));
    for (const vibe of TARGET_VIBES) {
      if (vibes.includes(vibe) || occasions.includes(vibe)) counts[vibe] += 1;
    }
  }
  return counts;
}

function printCoverage(label: string, counts: Record<string, number>): void {
  console.log(`\n${label}`);
  for (const vibe of TARGET_VIBES) {
    console.log(`  ${vibe}: ${counts[vibe] || 0}`);
  }
}

function timestampForBackup(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function backupIfPresent(filePath: string): Promise<string | null> {
  try {
    await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
  const parsed = path.parse(filePath);
  const backupPath = path.resolve(parsed.dir, `${parsed.name}.backup-${timestampForBackup()}${parsed.ext}`);
  await copyFile(filePath, backupPath);
  return backupPath;
}

async function main(): Promise<void> {
  const generated = await readJson<Product[]>(GENERATED_PATH, []);
  const photo = await readJson<Product[]>(PHOTO_PATH, []);
  const existingOverrides = await readJson<OverrideMap>(OVERRIDES_PATH, {});
  const products = [...photo, ...generated];
  const beforeCounts = vibeCoverage(products.map((product) => applyOverride(product, existingOverrides[product.id])));
  const nextOverrides: OverrideMap = { ...existingOverrides };
  let changedProducts = 0;

  for (const product of products) {
    const inferred = inferTags(product);
    const merged = {
      vibes: uniqueStrings(existingOverrides[product.id]?.vibes, inferred.vibes),
      occasions: uniqueStrings(existingOverrides[product.id]?.occasions, inferred.occasions),
      searchTerms: uniqueStrings(existingOverrides[product.id]?.searchTerms, inferred.searchTerms),
      gender: uniqueStrings(inferred.gender)
        .filter((tag): tag is 'masc' | 'fem' | 'androgynous' => tag === 'masc' || tag === 'fem' || tag === 'androgynous'),
    } satisfies Required<CatalogTagOverride>;
    const original = existingOverrides[product.id] || {};
    const changed =
      merged.vibes.length > (original.vibes || []).length
      || merged.occasions.length > (original.occasions || []).length
      || merged.searchTerms.length > (original.searchTerms || []).length
      || merged.gender.join('|') !== (original.gender || []).join('|');

    if (!changed || (!merged.vibes.length && !merged.occasions.length && !merged.searchTerms.length && !merged.gender.length)) continue;
    nextOverrides[product.id] = merged;
    changedProducts += 1;
  }

  const afterCounts = vibeCoverage(products.map((product) => applyOverride(product, nextOverrides[product.id])));

  await mkdir(path.dirname(OVERRIDES_PATH), { recursive: true });
  const backupPath = await backupIfPresent(OVERRIDES_PATH);
  if (backupPath) console.log(`Created backup: ${backupPath}`);
  await writeFile(OVERRIDES_PATH, `${JSON.stringify(nextOverrides, null, 2)}\n`, 'utf8');

  console.log(`Read ${photo.length} photo products and ${generated.length} generated products.`);
  console.log(`Overrides before: ${Object.keys(existingOverrides).length}`);
  console.log(`Overrides after: ${Object.keys(nextOverrides).length}`);
  console.log(`Products enriched this run: ${changedProducts}`);
  printCoverage('Before target vibe coverage', beforeCounts);
  printCoverage('After target vibe coverage', afterCounts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
