import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PHOTO_CATALOG_SEEDS } from '../lib/catalog-seeds.ts';
import { parseSearchIntentHeuristic } from '../lib/claude.ts';
import { searchShopping } from '../lib/serpapi.ts';
import type { Product } from '../lib/types.ts';

const OUTPUT_PATH = path.resolve(process.cwd(), 'data/photo-catalog.json');
const STATE_PATH = path.resolve(process.cwd(), 'data/catalog-build-state.json');
const MAX_RESULTS_PER_QUERY = Number.parseInt(process.env.CATALOG_RESULTS_PER_QUERY || '4', 10);
const BRAND_FILTER = process.env.CATALOG_BRAND_FILTER?.trim().toLowerCase() || '';
const CATEGORY_FILTER = process.env.CATALOG_CATEGORY_FILTER?.trim().toLowerCase() || '';
const MAX_TASKS_PER_RUN = Number.parseInt(process.env.CATALOG_MAX_TASKS || '8', 10);
const RESET_CURSOR = process.env.CATALOG_RESET_CURSOR === '1';
const MAX_ITEMS_PER_QUERY = Number.parseInt(process.env.CATALOG_MAX_ITEMS_PER_QUERY || '2', 10);
const TARGET_ITEMS_PER_CATEGORY = Number.parseInt(process.env.CATALOG_TARGET_ITEMS_PER_CATEGORY || '8', 10);

interface BuildTask {
  brand: string;
  category: string;
  query: string;
}

interface CatalogBuildState {
  nextTaskIndex: number;
  lastRunAt?: string;
  lastTask?: string;
  totalCatalogItems?: number;
}

interface CatalogStats {
  categoryCounts: Map<string, number>;
  queryCounts: Map<string, number>;
  brandCategoryCounts: Map<string, number>;
}

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

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildTasks(): BuildTask[] {
  return PHOTO_CATALOG_SEEDS
    .filter((seed) => (BRAND_FILTER ? seed.brand.toLowerCase().includes(BRAND_FILTER) : true))
    .filter((seed) => (CATEGORY_FILTER ? seed.category === CATEGORY_FILTER : true))
    .flatMap((seed) =>
      seed.queries.map((query) => ({
        brand: seed.brand,
        category: seed.category,
        query,
      })),
    );
}

function catalogQueryKey(value: string): string {
  return value.trim().toLowerCase();
}

function readCatalogStats(products: Product[]): CatalogStats {
  const categoryCounts = new Map<string, number>();
  const queryCounts = new Map<string, number>();
  const brandCategoryCounts = new Map<string, number>();

  for (const product of products) {
    categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);

    const query = typeof product.metadata?.catalogQuery === 'string' ? product.metadata.catalogQuery : '';
    if (query) {
      const key = catalogQueryKey(query);
      queryCounts.set(key, (queryCounts.get(key) || 0) + 1);
    }

    const brandCategoryKey = `${product.category}::${product.brand.trim().toLowerCase()}`;
    brandCategoryCounts.set(brandCategoryKey, (brandCategoryCounts.get(brandCategoryKey) || 0) + 1);
  }

  return {
    categoryCounts,
    queryCounts,
    brandCategoryCounts,
  };
}

function taskScore(task: BuildTask, stats: CatalogStats): number {
  const categoryCount = stats.categoryCounts.get(task.category) || 0;
  const queryCount = stats.queryCounts.get(catalogQueryKey(task.query)) || 0;
  const brandCategoryCount = stats.brandCategoryCounts.get(`${task.category}::${task.brand.toLowerCase()}`) || 0;
  const categoryGap = Math.max(TARGET_ITEMS_PER_CATEGORY - categoryCount, 0);
  const unseenCategoryBonus = categoryCount === 0 ? 2_000 : 0;
  const unseenQueryBonus = queryCount === 0 ? 350 : 0;
  const brandGapBonus = brandCategoryCount === 0 ? 120 : Math.max(40 - brandCategoryCount * 10, 0);

  return (
    unseenCategoryBonus +
    categoryGap * 100 +
    unseenQueryBonus +
    brandGapBonus -
    queryCount * 180 -
    categoryCount * 8
  );
}

function rankTasks(tasks: BuildTask[], stats: CatalogStats): BuildTask[] {
  return tasks
    .filter((task) => {
      const categoryCount = stats.categoryCounts.get(task.category) || 0;
      const queryCount = stats.queryCounts.get(catalogQueryKey(task.query)) || 0;
      if (queryCount === 0) return true;
      return categoryCount < TARGET_ITEMS_PER_CATEGORY && queryCount < MAX_ITEMS_PER_QUERY;
    })
    .sort((left, right) => {
      const scoreDelta = taskScore(right, stats) - taskScore(left, stats);
      if (scoreDelta !== 0) return scoreDelta;
      if (left.category !== right.category) return left.category.localeCompare(right.category);
      if (left.brand !== right.brand) return left.brand.localeCompare(right.brand);
      return left.query.localeCompare(right.query);
    });
}

function pickBatch<T>(items: T[], startIndex: number, count: number): Array<{ index: number; item: T }> {
  if (!items.length || count <= 0) return [];

  const batch: Array<{ index: number; item: T }> = [];
  for (let offset = 0; offset < Math.min(count, items.length); offset += 1) {
    const index = (startIndex + offset) % items.length;
    batch.push({ index, item: items[index] });
  }
  return batch;
}

const tasks = buildTasks();

if (!tasks.length) {
  console.error('No catalog tasks matched the requested filters.');
  process.exit(1);
}

const existingCatalog = await readJsonFile<Product[]>(OUTPUT_PATH, []);
const existingState = await readJsonFile<CatalogBuildState>(STATE_PATH, { nextTaskIndex: 0 });
const stats = readCatalogStats(existingCatalog);
const rankedTasks = rankTasks(tasks, stats);

if (!rankedTasks.length) {
  console.error('No remaining catalog tasks need more coverage with the current filters.');
  process.exit(0);
}

const startIndex = RESET_CURSOR ? 0 : existingState.nextTaskIndex % rankedTasks.length;
const batch = pickBatch(rankedTasks, startIndex, MAX_TASKS_PER_RUN);

const collected: Product[] = [];
let nextTaskIndex = startIndex;
let rateLimited = false;
let lastTask = '';

for (const { index, item } of batch) {
  lastTask = `${item.brand} :: ${item.query}`;
  const intent = parseSearchIntentHeuristic(item.query, item.category as Product['category']);

  try {
    const products = await searchShopping(intent, item.query);
    const accepted = products
      .filter((product) => isRealImage(product.imageUrl))
      .slice(0, MAX_RESULTS_PER_QUERY)
      .map((product) => enrichForCatalog(product, item.query));

    collected.push(...accepted);
    nextTaskIndex = (index + 1) % tasks.length;
    console.log(`OK   [${item.category}] ${item.brand} :: ${item.query} -> ${accepted.length} saved`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`WARN [${item.category}] ${item.brand} :: ${item.query} -> ${message}`);

    if (/searchapi 429/i.test(message)) {
      rateLimited = true;
      nextTaskIndex = index;
      break;
    }

    nextTaskIndex = (index + 1) % tasks.length;
  }
}

const mergedCatalog = dedupe([...existingCatalog, ...collected]).sort((left, right) => {
  if (left.category !== right.category) return left.category.localeCompare(right.category);
  if (left.brand !== right.brand) return left.brand.localeCompare(right.brand);
  return left.name.localeCompare(right.name);
});

const nextState: CatalogBuildState = {
  nextTaskIndex,
  lastRunAt: new Date().toISOString(),
  lastTask,
  totalCatalogItems: mergedCatalog.length,
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(mergedCatalog, null, 2)}\n`, 'utf8');
await writeFile(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

console.log(
  `Saved ${mergedCatalog.length} photo-backed products to ${OUTPUT_PATH} ` +
  `(added ${collected.length}, next task ${nextTaskIndex}/${rankedTasks.length}${rateLimited ? ', rate-limited' : ''})`,
);
