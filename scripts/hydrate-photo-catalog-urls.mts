import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hydrateRetailerUrls, hasDirectRetailerUrl } from '../lib/serpapi.ts';
import type { Category, Product } from '../lib/types.ts';

const OUTPUT_PATH = path.resolve(process.cwd(), 'data/photo-catalog.json');
const LIMIT = Number.parseInt(process.env.CATALOG_HYDRATE_LIMIT || '32', 10);
const PER_CATEGORY_LIMIT = Number.parseInt(process.env.CATALOG_HYDRATE_PER_CATEGORY || '6', 10);
const CATEGORY_FILTER = process.env.CATALOG_HYDRATE_CATEGORY?.trim().toLowerCase() || '';
const CATEGORY_PRIORITY: Category[] = ['top', 'bottom', 'outer', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function searchText(product: Product): string {
  const values = [
    product.brand,
    product.name,
    product.retailer,
    ...(Array.isArray(product.metadata?.keywords) ? product.metadata.keywords : []),
    ...(Array.isArray(product.metadata?.styles) ? product.metadata.styles : []),
    ...(Array.isArray(product.metadata?.vibes) ? product.metadata.vibes : []),
    typeof product.metadata?.catalogQuery === 'string' ? product.metadata.catalogQuery : '',
  ];

  return normalize(values.filter((value): value is string => typeof value === 'string').join(' '));
}

function hydrateScore(product: Product): number {
  const haystack = searchText(product);
  let score = 0;

  if (product.trusted) score += 12;
  if (haystack.includes('women') || haystack.includes('womens') || haystack.includes('fem')) score += 4;
  if (haystack.includes('men') || haystack.includes('mens') || haystack.includes('masc')) score += 4;
  if (haystack.includes('bag') || haystack.includes('shoe') || haystack.includes('jacket')) score += 3;
  if (product.priceCents > 0) score += Math.min(10, Math.round(product.priceCents / 20_000));

  return score;
}

function pickProducts(products: Product[]): Product[] {
  const wrapperProducts = products
    .filter((product) => (CATEGORY_FILTER ? product.category === CATEGORY_FILTER : true))
    .filter((product) => !hasDirectRetailerUrl(product.retailerUrl))
    .filter((product) => typeof product.metadata?.searchapiProductToken === 'string');

  const counts = new Map<Category, number>();

  return wrapperProducts
    .sort((left, right) => {
      const categoryDelta = CATEGORY_PRIORITY.indexOf(left.category) - CATEGORY_PRIORITY.indexOf(right.category);
      if (categoryDelta !== 0) return categoryDelta;
      return hydrateScore(right) - hydrateScore(left);
    })
    .filter((product) => {
      const current = counts.get(product.category) || 0;
      if (current >= PER_CATEGORY_LIMIT) return false;
      counts.set(product.category, current + 1);
      return true;
    })
    .slice(0, LIMIT);
}

function replaceProducts(existing: Product[], resolved: Product[]): Product[] {
  const replacementByRetailerHost = new Map<string, Product>();

  for (const product of resolved) {
    const token = typeof product.metadata?.searchapiProductToken === 'string'
      ? product.metadata.searchapiProductToken
      : '';
    if (!token) continue;
    replacementByRetailerHost.set(token, product);
  }

  return existing.map((product) => {
    const token = typeof product.metadata?.searchapiProductToken === 'string'
      ? product.metadata.searchapiProductToken
      : '';
    return replacementByRetailerHost.get(token) || product;
  });
}

const catalog = await readJsonFile<Product[]>(OUTPUT_PATH, []);
const targets = pickProducts(catalog);

if (!targets.length) {
  console.log('No wrapper-link products matched the hydration filters.');
  process.exit(0);
}

console.log(`Hydrating ${targets.length} products from wrapper URLs to direct retailer pages...`);
const resolved = await hydrateRetailerUrls(targets);
const merged = replaceProducts(catalog, resolved);

let directCount = 0;
for (const product of resolved) {
  if (hasDirectRetailerUrl(product.retailerUrl)) directCount += 1;
}

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

console.log(`Hydrated ${directCount}/${resolved.length} products to direct retailer URLs.`);
