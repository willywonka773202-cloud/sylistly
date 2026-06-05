import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { analyzeProductVision, getCatalogVisionConfig, type ProductVisionAnalysis, type VisionProvider } from '../lib/catalog-vision';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import {
  hasExactProductLink,
  hasProductCommerceLink,
  isEditorialCutoutProduct,
  isMultiItemSetProduct,
  sortTransparentFeedRenderableProducts,
} from '../lib/product-image-quality';
import type { Product } from '../lib/types';

interface CatalogVisionReport {
  generatedAt: string;
  apply: boolean;
  provider: VisionProvider;
  model: string;
  enabled: boolean;
  hasProviderKey: boolean;
  requestedLimit: number;
  analyzed: number;
  cacheSizeBefore: number;
  cacheSizeAfter: number;
  outputFile: string;
  notes: string[];
}

type CacheFile = Record<string, ProductVisionAnalysis>;

const ROOT = process.cwd();
const CACHE_PATH = join(ROOT, 'data', 'catalog-vision-cache.json');
const REPORT_PATH = join(ROOT, 'data', 'catalog', 'reports', 'catalog-vision-report.json');

function loadEnvLocal(): void {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function argValue(name: string): string | null {
  const prefixed = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefixed));
  if (inline) return inline.slice(prefixed.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] || null;
  return null;
}

function hasArg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readCache(): CacheFile {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as CacheFile;
  } catch {
    return {};
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getVisionCatalogProducts(): Product[] {
  return sortTransparentFeedRenderableProducts(ALL_CATALOG_PRODUCTS)
    .filter((product) =>
      isEditorialCutoutProduct(product)
      && hasProductCommerceLink(product)
      && hasExactProductLink(product)
      && !isMultiItemSetProduct(product),
    )
    .slice(0, 240);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const config = getCatalogVisionConfig();
  const apply = hasArg('apply');
  const limitRaw = Number.parseInt(argValue('limit') || process.env.CATALOG_VISION_LIMIT || '24', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 24;
  const forceProviderArg = argValue('provider');
  const forceProvider = forceProviderArg === 'gemini' || forceProviderArg === 'local' ? forceProviderArg : undefined;
  const cache = readCache();
  const products = getVisionCatalogProducts()
    .filter((product) => !cache[product.id])
    .slice(0, limit);

  console.log('Catalog vision analysis');
  console.log('=======================');
  console.log(`Mode    : ${apply ? 'apply' : 'dry-run'}`);
  console.log(`Provider: ${forceProvider || config.provider}`);
  console.log(`Model   : ${config.model}`);
  console.log(`Products: ${products.length}`);

  const analyses: ProductVisionAnalysis[] = [];
  for (const [index, product] of products.entries()) {
    const analysis = await analyzeProductVision(product, { forceProvider });
    analyses.push(analysis);
    console.log(`${index + 1}/${products.length} ${product.category.padEnd(7)} ${product.brand} ${product.name} -> ${analysis.subcategory} (${analysis.provider})`);
  }

  const nextCache: CacheFile = {
    ...cache,
    ...Object.fromEntries(analyses.map((analysis) => [analysis.productId, analysis])),
  };

  if (apply) {
    writeJson(CACHE_PATH, nextCache);
  }

  const report: CatalogVisionReport = {
    generatedAt: new Date().toISOString(),
    apply,
    provider: forceProvider || config.provider,
    model: config.model,
    enabled: config.enabled,
    hasProviderKey: config.hasProviderKey,
    requestedLimit: limit,
    analyzed: analyses.length,
    cacheSizeBefore: Object.keys(cache).length,
    cacheSizeAfter: Object.keys(nextCache).length,
    outputFile: 'data/catalog-vision-cache.json',
    notes: [
      'This script analyzes only real stylist-catalog products that already pass transparent cutout and exact commerce-link gates.',
      'Run with --apply to write cache entries. Without --apply, it only writes the report.',
      'If CATALOG_VISION_ENABLED is off or no provider key exists, analysis uses deterministic local heuristics.',
      'The app consumes cached metadata at runtime so feed/build pages do not make live vision calls.',
    ],
  };

  writeJson(REPORT_PATH, report);
  console.log(`Report : ${REPORT_PATH}`);
  if (apply) console.log(`Cache  : ${CACHE_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
