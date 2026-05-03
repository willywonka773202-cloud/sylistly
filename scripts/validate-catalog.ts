import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { genderMismatchReasons, productGenderTags } from '../lib/frame-inference';
import type { Category, Product } from '../lib/types';

const GENERATED_PATH = path.resolve(process.cwd(), 'data/generated-catalog.json');
const PHOTO_PATH = path.resolve(process.cwd(), 'data/photo-catalog.json');
const OVERRIDES_PATH = path.resolve(process.cwd(), 'data/catalog-tag-overrides.json');

const CATEGORIES: Category[] = ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'];
const CATEGORY_TARGETS: Record<Category, number> = {
  top: 40,
  bottom: 35,
  outer: 35,
  shoes: 40,
  bag: 25,
  hat: 20,
  eyewear: 25,
  jewelry: 25,
};
const IMPORTANT_VIBES = [
  'clean', 'minimal', 'streetwear', 'night', 'date', 'gym', 'athletic', 'office',
  'business casual', 'old money', 'vacation', 'beach', 'summer', 'winter', 'cozy',
  'edgy', 'techwear', 'y2k', 'western', 'college', 'casual', 'luxury', 'preppy',
];

interface CatalogTagOverride {
  vibes?: string[];
  occasions?: string[];
  searchTerms?: string[];
  gender?: Array<'masc' | 'fem' | 'androgynous'>;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function hasImage(product: Product): boolean {
  return Boolean(product.imageUrl) && /^https?:\/\//i.test(product.imageUrl) && !product.imageUrl.startsWith('data:image/');
}

function isGoogleShoppingUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    return host === 'google.com' && (/^\/(?:search|shopping)/i.test(parsed.pathname) || parsed.hash.includes('oshopproduct'));
  } catch {
    return /google\.com\/(?:search|shopping)|#oshopproduct/i.test(url);
  }
}

function hasDirectRetailerUrl(product: Product): boolean {
  const url = product.productUrl || product.retailerUrl;
  return Boolean(url) && /^https?:\/\//i.test(url || '') && !isGoogleShoppingUrl(url);
}

function hasGoogleFallbackUrl(product: Product): boolean {
  return isGoogleShoppingUrl(product.googleShoppingUrl) || isGoogleShoppingUrl(product.fallbackUrl);
}

function hasAnyShoppingUrl(product: Product): boolean {
  return hasDirectRetailerUrl(product) || hasGoogleFallbackUrl(product);
}

function productVibes(product: Product): string[] {
  const metadataVibes = Array.isArray(product.metadata?.vibes) ? product.metadata.vibes as string[] : [];
  return Array.from(new Set([...(product.vibes || []), ...metadataVibes]));
}

function productOccasions(product: Product): string[] {
  const metadataOccasions = Array.isArray(product.metadata?.occasions) ? product.metadata.occasions as string[] : [];
  return Array.from(new Set([...(product.occasions || []), ...metadataOccasions]));
}

function productSearchTerms(product: Product): string[] {
  const metadataSearchTerms = Array.isArray(product.metadata?.searchTerms) ? product.metadata.searchTerms as string[] : [];
  const metadataKeywords = Array.isArray(product.metadata?.keywords) ? product.metadata.keywords as string[] : [];
  return Array.from(new Set([...(product.searchTerms || []), ...metadataSearchTerms, ...metadataKeywords]));
}

function applyOverride(product: Product, override?: CatalogTagOverride): Product {
  if (!override) return product;
  const vibes = Array.from(new Set([...productVibes(product), ...(override.vibes || [])]));
  const occasions = Array.from(new Set([...productOccasions(product), ...(override.occasions || [])]));
  const searchTerms = Array.from(new Set([...productSearchTerms(product), ...(override.searchTerms || [])]));
  const genderSource = override.gender?.length ? override.gender : product.gender || [];
  const gender = Array.from(new Set(genderSource))
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

function key(product: Product): string {
  return `${product.category}::${product.brand.toLowerCase()}::${product.name.toLowerCase()}`;
}

function validateProduct(product: Product, index: number): string[] {
  const errors: string[] = [];
  if (!product.id) errors.push(`product[${index}] missing id`);
  if (!product.brand) errors.push(`${product.id || index} missing brand`);
  if (!product.name) errors.push(`${product.id || index} missing name`);
  if (!CATEGORIES.includes(product.category)) errors.push(`${product.id || index} invalid category`);
  if (!product.priceCents || product.priceCents <= 0) errors.push(`${product.id || index} missing price`);
  if (!product.retailer) errors.push(`${product.id || index} missing retailer`);
  if (!hasAnyShoppingUrl(product)) errors.push(`${product.id || index} missing shopping URL`);
  if (isGoogleShoppingUrl(product.productUrl) || isGoogleShoppingUrl(product.retailerUrl)) {
    errors.push(`${product.id || index} uses Google Shopping as main product URL`);
  }
  if (!hasImage(product)) errors.push(`${product.id || index} missing usable imageUrl`);
  if (!productVibes(product).length) errors.push(`${product.id || index} missing vibes`);
  return errors;
}

function normalizedProductText(product: Product): string {
  return [
    product.category,
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...(product.searchTerms || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
  ].join(' ').toLowerCase();
}

function genderWarnings(product: Product): string[] {
  const warnings: string[] = [];
  const text = normalizedProductText(product);
  const tags = productGenderTags(product);
  const hasMasc = tags.includes('masc');
  const hasFem = tags.includes('fem');

  if (!tags.length) warnings.push(`${product.id} missing gender tags`);
  if (product.category === 'bottom' && /\b(skirt|mini dress|slip dress)\b/.test(text) && hasMasc) warnings.push(`${product.id} skirt/dress bottom tagged masc`);
  if (/\b(women|womens|ladies)\b/.test(text) && hasMasc) warnings.push(`${product.id} women/ladies product tagged masc`);
  if (/\b(men|mens)\b/.test(text) && hasFem) warnings.push(`${product.id} men/mens product tagged fem`);
  if (product.category === 'top' && /\b(sports bra|bralette|bodysuit)\b/.test(text) && hasMasc) warnings.push(`${product.id} fem-only top tagged masc`);
  if (/\b(heels|heel|pumps|pump)\b/.test(text) && hasMasc) warnings.push(`${product.id} heels/pumps tagged masc`);

  for (const frame of ['masc', 'fem'] as const) {
    const reasons = genderMismatchReasons(product, frame);
    if (reasons.length && ((frame === 'masc' && hasMasc) || (frame === 'fem' && hasFem))) {
      warnings.push(`${product.id} suspicious ${frame} tag: ${reasons.join(', ')}`);
    }
  }

  return warnings;
}

async function main(): Promise<void> {
  const generated = await readJson<Product[]>(GENERATED_PATH, []);
  const photo = await readJson<Product[]>(PHOTO_PATH, []);
  const overrides = await readJson<Record<string, CatalogTagOverride>>(OVERRIDES_PATH, {});
  const all = [...photo, ...generated].map((product) => applyOverride(product, overrides[product.id]));
  const generatedWithOverrides = generated.map((product) => applyOverride(product, overrides[product.id]));

  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const categoryCounts = new Map<Category, number>(CATEGORIES.map((category) => [category, 0]));
  const categoryImageCounts = new Map<Category, number>(CATEGORIES.map((category) => [category, 0]));
  const vibeCounts = new Map<string, number>();

  generatedWithOverrides.forEach((product, index) => {
    errors.push(...validateProduct(product, index));
  });

  for (const product of all) {
    if (seenIds.has(product.id)) errors.push(`duplicate id: ${product.id}`);
    seenIds.add(product.id);

    const duplicateKey = key(product);
    if (seenKeys.has(duplicateKey)) errors.push(`duplicate brand/name/category: ${duplicateKey}`);
    seenKeys.add(duplicateKey);

    categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
    if (hasImage(product)) categoryImageCounts.set(product.category, (categoryImageCounts.get(product.category) || 0) + 1);

    for (const vibe of [...productVibes(product), ...productOccasions(product)]) {
      vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
    }

    warnings.push(...genderWarnings(product));
  }

  console.log(`Generated products: ${generated.length}`);
  console.log(`JSON-backed cached catalog products: ${all.length}`);
  console.log(`Catalog tag overrides: ${Object.keys(overrides).length}`);
  console.log(`Generated products with direct retailer URLs: ${generatedWithOverrides.filter(hasDirectRetailerUrl).length}`);
  console.log(`Generated products with Google fallback URLs: ${generatedWithOverrides.filter(hasGoogleFallbackUrl).length}`);
  console.log(`Generated products with no shopping URL: ${generatedWithOverrides.filter((product) => !hasAnyShoppingUrl(product)).length}`);
  console.log(`Generated products with Google Shopping main URLs: ${generatedWithOverrides.filter((product) => isGoogleShoppingUrl(product.productUrl) || isGoogleShoppingUrl(product.retailerUrl)).length}`);
  console.log('\nCategory coverage:');
  for (const category of CATEGORIES) {
    const count = categoryCounts.get(category) || 0;
    const imageCount = categoryImageCounts.get(category) || 0;
    const target = CATEGORY_TARGETS[category];
    console.log(`  ${category}: ${count}/${target} total, ${imageCount} image-backed`);
    if (count < target) errors.push(`category below target: ${category} ${count}/${target}`);
  }

  console.log('\nVibe/topic coverage:');
  for (const vibe of IMPORTANT_VIBES) {
    const count = vibeCounts.get(vibe) || 0;
    console.log(`  ${vibe}: ${count}`);
    if (count < 5) errors.push(`vibe/topic below soft target: ${vibe} ${count}/5`);
  }

  console.log('\nAccessory coverage:');
  console.log(`  eyewear: ${categoryCounts.get('eyewear') || 0}`);
  console.log(`  jewelry: ${categoryCounts.get('jewelry') || 0}`);

  const genderCounts = { masc: 0, fem: 0, androgynous: 0, none: 0 };
  for (const product of all) {
    const tags = productGenderTags(product);
    if (!tags.length) genderCounts.none += 1;
    for (const tag of tags) genderCounts[tag] += 1;
  }

  console.log('\nGender/frame coverage:');
  console.log(`  masc: ${genderCounts.masc}`);
  console.log(`  fem: ${genderCounts.fem}`);
  console.log(`  androgynous: ${genderCounts.androgynous}`);
  console.log(`  no tags: ${genderCounts.none}`);

  if (warnings.length) {
    console.log('\nGender/frame warnings:');
    warnings.slice(0, 80).forEach((warning) => console.log(`  - ${warning}`));
    if (warnings.length > 80) console.log(`  ... ${warnings.length - 80} more`);
  }

  if (errors.length) {
    console.log('\nValidation issues:');
    errors.slice(0, 80).forEach((error) => console.log(`  - ${error}`));
    if (errors.length > 80) console.log(`  ... ${errors.length - 80} more`);
    process.exitCode = 1;
  } else {
    console.log('\nValidation passed.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
