import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { upsertProductsToSupabase } from '../lib/catalog-upsert.ts';
import { ingestDropProducts, type DropIngestResult, type DropSourceConfig } from '../lib/drop-ingest.ts';
import type { Product } from '../lib/types.ts';

interface CliFlags {
  apply: boolean;
  json: boolean;
  limit: number;
  sourceId: string;
  includeSearchApi: boolean;
  maxSearchQueries: number;
  supabase: boolean;
}

interface IngestReport extends DropIngestResult {
  mode: 'dry-run' | 'apply';
  existingProducts: number;
  addedProducts: number;
  mergedProducts: number;
  wroteCatalog: boolean;
  supabaseUpserted: number;
  outputFile: string;
  notes: string[];
}

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'data', 'drop-catalog.json');
const REPORT_PATH = path.join(ROOT, 'data', 'catalog', 'reports', 'drop-ingest-report.json');

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    apply: false,
    json: false,
    limit: Number.parseInt(process.env.DROP_INGEST_LIMIT || '120', 10),
    sourceId: process.env.DROP_SOURCE_ID || '',
    includeSearchApi: process.env.DROP_SEARCHAPI === '1',
    maxSearchQueries: Number.parseInt(process.env.DROP_SEARCHAPI_MAX_QUERIES || '0', 10),
    supabase: process.env.DROP_INGEST_SUPABASE === '1',
  };

  for (const arg of argv) {
    if (arg === '--apply') flags.apply = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--searchapi') flags.includeSearchApi = true;
    else if (arg === '--supabase') flags.supabase = true;
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.limit = n;
    } else if (arg.startsWith('--source=')) {
      flags.sourceId = arg.slice('--source='.length).trim();
    } else if (arg.startsWith('--max-search-queries=')) {
      const n = Number.parseInt(arg.slice('--max-search-queries='.length), 10);
      if (Number.isFinite(n) && n >= 0) flags.maxSearchQueries = n;
    }
  }

  flags.limit = Math.min(Math.max(flags.limit || 120, 1), 1000);
  flags.maxSearchQueries = Math.min(Math.max(flags.maxSearchQueries || 0, 0), 50);
  return flags;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function productKey(product: Product): string {
  return product.id || product.productUrl || product.retailerUrl || `${product.brand}:${product.name}`;
}

function mergeProducts(existing: Product[], incoming: Product[]): Product[] {
  const merged = new Map<string, Product>();
  for (const product of [...existing, ...incoming]) {
    const key = productKey(product);
    if (!key) continue;
    merged.set(key, product);
  }
  const sorted = Array.from(merged.values()).sort((left, right) => {
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    if (left.brand !== right.brand) return left.brand.localeCompare(right.brand);
    return left.name.localeCompare(right.name);
  });
  const output: Product[] = [];
  const seenNames = new Set<string>();
  for (const product of sorted) {
    const nameKey = `${product.category}:${product.brand}:${product.name}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    output.push(product);
  }
  return output;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const existing = await readJson<Product[]>(OUTPUT_PATH, []);
  const dropSourcesData = await readJson<DropSourceConfig>(path.join(ROOT, 'data', 'drop-sources.json'), { version: 1 });
  const result = await ingestDropProducts(dropSourcesData, {
    limit: flags.limit,
    sourceId: flags.sourceId,
    includeSearchApi: flags.includeSearchApi,
    maxSearchQueries: flags.maxSearchQueries,
  });
  const merged = mergeProducts(existing, result.products);
  const existingKeys = new Set(existing.map(productKey));
  const added = result.products.filter((product) => !existingKeys.has(productKey(product)));

  let supabaseUpserted = 0;
  if (flags.apply && flags.supabase) {
    supabaseUpserted = await upsertProductsToSupabase(added.length ? added : result.products);
  }

  const report: IngestReport = {
    ...result,
    mode: flags.apply ? 'apply' : 'dry-run',
    existingProducts: existing.length,
    addedProducts: added.length,
    mergedProducts: merged.length,
    wroteCatalog: flags.apply,
    supabaseUpserted,
    outputFile: 'data/drop-catalog.json',
    notes: [
      'Drop ingestion stores original merchant images first and marks them imageStatus=needs-cutout.',
      'Run scripts/prepare-cutout-candidates.ts and scripts/generate-cutouts-local.py after ingestion to create reviewed transparent assets.',
      'Run scripts/build-client-catalog.ts after registering cutouts so the client UI receives the expanded transparent set.',
      'SearchAPI sources only run when --searchapi is passed and SEARCHAPI_KEY is configured.',
    ],
  };

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  if (flags.apply) {
    await writeFile(OUTPUT_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('New-drop catalog ingest');
  console.log('=======================');
  console.log(`Mode: ${report.mode}`);
  console.log(`Existing drop products: ${report.existingProducts}`);
  console.log(`Accepted this run: ${report.products.length}`);
  console.log(`Added this run: ${report.addedProducts}`);
  console.log(`Merged total: ${report.mergedProducts}`);
  console.log(`Wrote catalog: ${report.wroteCatalog}`);
  console.log(`Supabase upserted: ${report.supabaseUpserted}`);
  for (const entry of report.reports) {
    console.log(`  ${entry.status.toUpperCase()} ${entry.id}: found=${entry.productsFound} accepted=${entry.productsAccepted}${entry.error ? ` error=${entry.error}` : ''}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
