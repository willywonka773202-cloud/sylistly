import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PHOTO_CATALOG_SEEDS } from '../lib/catalog-seeds.ts';
import { parseSearchIntentHeuristic } from '../lib/claude.ts';
import { searchShopping } from '../lib/serpapi.ts';
import type { Product } from '../lib/types.ts';

const OUTPUT_PATH = path.resolve(process.cwd(), 'data/photo-catalog.json');
const MAX_RESULTS_PER_QUERY = Number.parseInt(process.env.CATALOG_RESULTS_PER_QUERY || '4', 10);
const BRAND_FILTER = process.env.CATALOG_BRAND_FILTER?.trim().toLowerCase() || '';
const CATEGORY_FILTER = process.env.CATALOG_CATEGORY_FILTER?.trim().toLowerCase() || '';
const MAX_SEEDS = Number.parseInt(process.env.CATALOG_MAX_SEEDS || '0', 10);

function isRealImage(url: string | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function dedupe(products: Product[]): Product[] {
  const seen = new Set<string>();
  const output: Product[] = [];

  for (const product of products) {
    const key = [
      product.category,
      product.brand.toLowerCase(),
      product.name.toLowerCase(),
      (product.retailerUrl || '').toLowerCase(),
    ].join('::');

    if (seen.has(key)) continue;
    seen.add(key);
    output.push(product);
  }

  return output;
}

function enrichForCatalog(product: Product, query: string): Product {
  return {
    ...product,
    metadata: {
      ...(product.metadata || {}),
      source: 'photo_catalog',
      catalogQuery: query,
    },
  };
}

const selectedSeeds = PHOTO_CATALOG_SEEDS
  .filter((seed) => (BRAND_FILTER ? seed.brand.toLowerCase().includes(BRAND_FILTER) : true))
  .filter((seed) => (CATEGORY_FILTER ? seed.category === CATEGORY_FILTER : true))
  .slice(0, MAX_SEEDS > 0 ? MAX_SEEDS : PHOTO_CATALOG_SEEDS.length);

if (!selectedSeeds.length) {
  console.error('No seeds matched the requested filters.');
  process.exit(1);
}

const collected: Product[] = [];

for (const seed of selectedSeeds) {
  for (const query of seed.queries) {
    const intent = parseSearchIntentHeuristic(query, seed.category);

    try {
      const products = await searchShopping(intent, query);
      const accepted = products
        .filter((product) => isRealImage(product.imageUrl))
        .slice(0, MAX_RESULTS_PER_QUERY)
        .map((product) => enrichForCatalog(product, query));

      collected.push(...accepted);
      console.log(
        `OK   [${seed.category}] ${seed.brand} :: ${query} -> ${accepted.length} saved`,
      );
    } catch (error) {
      console.warn(
        `WARN [${seed.category}] ${seed.brand} :: ${query} -> ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

const deduped = dedupe(collected).sort((left, right) => {
  if (left.category !== right.category) return left.category.localeCompare(right.category);
  if (left.brand !== right.brand) return left.brand.localeCompare(right.brand);
  return left.name.localeCompare(right.name);
});

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(deduped, null, 2)}\n`, 'utf8');

console.log(`Saved ${deduped.length} photo-backed products to ${OUTPUT_PATH}`);
