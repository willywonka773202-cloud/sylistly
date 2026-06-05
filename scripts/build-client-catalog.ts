import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import {
  getProductImageQualityScore,
  hasProductCommerceLink,
  hasTransparentProductImage,
  isEditorialCutoutProduct,
  isSyntheticStudioProduct,
} from '../lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

interface ClientCatalogReport {
  generatedAt: string;
  runtimeProducts: number;
  eligibleProducts: number;
  emittedProducts: number;
  limit: number;
  byCategory: Record<Category, number>;
  rejected: {
    noTransparentCutout: number;
    failedEditorialGate: number;
    blockedStatusOrFlags: number;
    noCommerceLink: number;
    syntheticStudio: number;
    missingLocalCutoutFile: number;
  };
  outputFile: string;
  notes: string[];
}

const ROOT = process.cwd();
const OUTPUT_PATH = join(ROOT, 'data', 'client-catalog.json');
const REPORT_PATH = join(ROOT, 'data', 'catalog', 'reports', 'client-catalog-build-report.json');
const LIMIT = Number.parseInt(process.env.CLIENT_CATALOG_LIMIT || '240', 10);
const BALANCED_CATEGORY_ORDER: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'eyewear', 'jewelry'];
const BRAND_CAP_PASSES = [3, 6, 10, Number.POSITIVE_INFINITY];
const CATEGORY_BRAND_CAP_PASSES = [2, 3, 5, Number.POSITIVE_INFINITY];

function localCutoutExists(product: Product): boolean {
  const url = product.imageTransparentUrl || product.imageCutoutUrl || '';
  if (!url.startsWith('/assets/cutouts/')) return true;
  return existsSync(join(ROOT, 'public', url.replace(/^\//, '')));
}

function hasBlockedCutoutStatusOrFlags(product: Product): boolean {
  if (product.imageStatus === 'review-only' || product.imageStatus === 'quarantined' || product.imageStatus === 'cutout-failed') {
    return true;
  }
  return Boolean(product.imageQualityFlags?.some((flag) =>
    ['body-model', 'full-body', 'multi-item', 'outfit-set', 'bad-cutout'].includes(flag),
  ));
}

function isClientCatalogProduct(product: Product): boolean {
  return isEditorialCutoutProduct(product)
    && hasProductCommerceLink(product)
    && !isSyntheticStudioProduct(product)
    && localCutoutExists(product);
}

function sortClientCatalogProducts(products: Product[]): Product[] {
  return products
    .filter(isClientCatalogProduct)
    .map((product, index) => ({
      product,
      index,
      score:
        getProductImageQualityScore(product)
        + (product.imageStatus === 'cutout-ready' ? 40 : 0)
        + (product.priceCents > 0 ? 8 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.product);
}

function normalizeBrand(product: Product): string {
  return (product.brand || product.retailer || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function selectBalancedClientCatalogProducts(sortedProducts: Product[], limit: number): Product[] {
  const max = Math.max(0, Number.isFinite(limit) && limit > 0 ? limit : 240);
  if (!max) return [];

  const pools = new Map<Category, Product[]>();
  for (const category of CATEGORY_ORDER) {
    pools.set(category, sortedProducts.filter((product) => product.category === category));
  }

  const selected: Product[] = [];
  const usedIds = new Set<string>();
  const brandCounts = new Map<string, number>();
  const categoryBrandCounts = new Map<string, number>();

  const addProduct = (product: Product) => {
    selected.push(product);
    usedIds.add(product.id);
    const brand = normalizeBrand(product);
    if (!brand) return;
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    const categoryBrandKey = `${product.category}:${brand}`;
    categoryBrandCounts.set(categoryBrandKey, (categoryBrandCounts.get(categoryBrandKey) || 0) + 1);
  };

  const pickFromCategory = (category: Category, brandCap: number, categoryBrandCap: number): boolean => {
    const pool = pools.get(category) || [];
    const product = pool.find((candidate) => {
      if (usedIds.has(candidate.id)) return false;
      const brand = normalizeBrand(candidate);
      if (!brand) return true;
      if ((brandCounts.get(brand) || 0) >= brandCap) return false;
      if ((categoryBrandCounts.get(`${category}:${brand}`) || 0) >= categoryBrandCap) return false;
      return true;
    });
    if (!product) return false;
    addProduct(product);
    return true;
  };

  for (let pass = 0; pass < BRAND_CAP_PASSES.length && selected.length < max; pass += 1) {
    const brandCap = BRAND_CAP_PASSES[pass];
    const categoryBrandCap = CATEGORY_BRAND_CAP_PASSES[pass];
    let madeProgress = true;

    while (madeProgress && selected.length < max) {
      madeProgress = false;
      for (const category of BALANCED_CATEGORY_ORDER) {
        if (selected.length >= max) break;
        madeProgress = pickFromCategory(category, brandCap, categoryBrandCap) || madeProgress;
      }
    }
  }

  return selected;
}

function compactStrings(values?: string[], limit = 48): string[] | undefined {
  if (!values?.length) return undefined;
  const compacted = Array.from(new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean),
  )).slice(0, limit);
  return compacted.length ? compacted : undefined;
}

function compactMetadata(product: Product): Record<string, unknown> {
  const metadata = product.metadata || {};
  const compact: Record<string, unknown> = { clientCatalog: true };
  if (metadata.featured) compact.featured = true;

  for (const key of ['source', 'sourceId', 'sourceType', 'collection', 'productType']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) compact[key] = value.trim().slice(0, 120);
  }

  for (const key of ['title', 'description']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) compact[key] = value.trim().slice(0, 280);
  }

  return compact;
}

function cleanProduct(product: Product): Product {
  return {
    id: product.id,
    brand: product.brand,
    name: product.name,
    category: product.category,
    priceCents: product.priceCents,
    currency: product.currency,
    retailer: product.retailer,
    retailerUrl: product.retailerUrl,
    affiliateUrl: product.affiliateUrl,
    productUrl: product.productUrl,
    googleShoppingUrl: product.googleShoppingUrl,
    fallbackUrl: product.fallbackUrl,
    imageUrl: product.imageUrl,
    imageTransparentUrl: product.imageTransparentUrl,
    imageCutoutUrl: product.imageCutoutUrl,
    imageSource: product.imageSource,
    imageStatus: product.imageStatus,
    imageQualityFlags: compactStrings(product.imageQualityFlags, 12),
    inStock: product.inStock,
    trusted: product.trusted,
    vibes: compactStrings(product.vibes, 14),
    occasions: compactStrings(product.occasions, 12),
    colors: compactStrings(product.colors, 10),
    gender: product.gender,
    searchTerms: compactStrings(product.searchTerms, 48),
    sourceQuery: product.sourceQuery,
    imageQuality: product.imageQuality,
    popularityScore: product.popularityScore,
    metadata: compactMetadata(product),
  };
}

function emptyCategoryCounts(): Record<Category, number> {
  return Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<Category, number>;
}

function build(): { products: Product[]; report: ClientCatalogReport } {
  const runtimeProducts = ALL_CATALOG_PRODUCTS as Product[];
  const rejected = {
    noTransparentCutout: 0,
    failedEditorialGate: 0,
    blockedStatusOrFlags: 0,
    noCommerceLink: 0,
    syntheticStudio: 0,
    missingLocalCutoutFile: 0,
  };

  for (const product of runtimeProducts) {
    if (!hasTransparentProductImage(product)) {
      rejected.noTransparentCutout += 1;
      continue;
    }
    if (!isEditorialCutoutProduct(product)) {
      rejected.failedEditorialGate += 1;
      continue;
    }
    if (hasBlockedCutoutStatusOrFlags(product)) {
      rejected.blockedStatusOrFlags += 1;
      continue;
    }
    if (!hasProductCommerceLink(product)) {
      rejected.noCommerceLink += 1;
      continue;
    }
    if (isSyntheticStudioProduct(product)) {
      rejected.syntheticStudio += 1;
      continue;
    }
    if (!localCutoutExists(product)) {
      rejected.missingLocalCutoutFile += 1;
    }
  }

  const sortedProducts = sortClientCatalogProducts(runtimeProducts);
  const effectiveLimit = Number.isFinite(LIMIT) && LIMIT > 0 ? LIMIT : 240;
  const products = selectBalancedClientCatalogProducts(sortedProducts, effectiveLimit).map(cleanProduct);

  const byCategory = emptyCategoryCounts();
  for (const product of products) byCategory[product.category] += 1;

  return {
    products,
    report: {
      generatedAt: new Date().toISOString(),
      runtimeProducts: runtimeProducts.length,
      eligibleProducts: sortedProducts.length,
      emittedProducts: products.length,
      limit: effectiveLimit,
      byCategory,
      rejected,
      outputFile: 'data/client-catalog.json',
      notes: [
        'Client catalog is generated from reviewed transparent runtime products only.',
        'Products must pass the feed editorial transparent-cutout gate, have a real commerce/search outbound link, avoid failed/quarantined/bad cutout flags, and reference an existing local cutout file.',
        'The export intentionally shares the same visual quality floor as the feed and generator so noisy marketplace, costume, set, and category-mismatched items do not re-enter the UI.',
        'The emitted order is category- and brand-balanced so the first client slices do not collapse into one brand or two outfit formulas.',
        'Run this after catalog ingestion + cutout registration so the client UI stops relying on a small handpicked subset.',
      ],
    },
  };
}

function main(): void {
  const { products, report } = build();
  mkdirSync(join(ROOT, 'data', 'catalog', 'reports'), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('Client catalog build');
  console.log('====================');
  console.log(`Runtime products : ${report.runtimeProducts}`);
  console.log(`Eligible products: ${report.eligibleProducts}`);
  console.log(`Emitted products : ${report.emittedProducts}`);
  console.log('By category');
  for (const category of CATEGORY_ORDER) console.log(`  ${category}: ${report.byCategory[category]}`);
  console.log(`Report: ${report.outputFile}`);
}

main();
