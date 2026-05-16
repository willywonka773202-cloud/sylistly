import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';

const root = process.cwd();
const cutoutDir = join(root, 'public', 'assets', 'cutouts');
const reportDir = join(root, 'data', 'catalog', 'cutout-reviewed');
const reportPath = join(reportDir, 'cutout-register-report.json');
const apply = process.argv.includes('--apply');
const json = process.argv.includes('--json');

type ProductWithTransparent = (typeof ALL_CATALOG_PRODUCTS)[number] & {
  imageTransparentUrl?: string;
};

type CutoutMatch = {
  id: string;
  assetPath: string;
  matched: boolean;
  product?: {
    id: string;
    brand: string;
    name: string;
    category: string;
    currentTransparentUrl?: string;
  };
  proposedPatch?: {
    imageTransparentUrl: string;
    imageSource: 'transparent-pipeline';
    imageStatus: 'cutout-ready';
  };
};

const productById = new Map(ALL_CATALOG_PRODUCTS.map((product) => [product.id, product]));

function isCutoutAsset(file: string): boolean {
  return /\.(png|webp|avif)$/i.test(file);
}

function publicUrlFor(file: string): string {
  return `/assets/cutouts/${file}`;
}

function main() {
  mkdirSync(reportDir, { recursive: true });
  const files = existsSync(cutoutDir) ? readdirSync(cutoutDir).filter(isCutoutAsset).sort() : [];
  const matches: CutoutMatch[] = files.map((file) => {
    const id = file.replace(/\.(png|webp|avif)$/i, '');
    const product = productById.get(id) as ProductWithTransparent | undefined;
    const assetPath = publicUrlFor(file);
    return {
      id,
      assetPath,
      matched: Boolean(product),
      product: product
        ? {
            id: product.id,
            brand: product.brand,
            name: product.name,
            category: product.category,
            currentTransparentUrl: product.imageTransparentUrl,
          }
        : undefined,
      proposedPatch: product
        ? {
            imageTransparentUrl: assetPath,
            imageSource: 'transparent-pipeline',
            imageStatus: 'cutout-ready',
          }
        : undefined,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply-requested-but-manual-only' : 'dry-run',
    cutoutDir: relative(root, cutoutDir).replace(/\\/g, '/'),
    totalAssets: files.length,
    matchedProducts: matches.filter((match) => match.matched).length,
    unmatchedAssets: matches.filter((match) => !match.matched).length,
    matches,
    notes: [
      'This script does not mutate catalog data yet.',
      'Use the proposedPatch fields only after visually reviewing each transparent asset.',
      'Catalog source ownership should be chosen before applying patches to live product JSON.',
    ],
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('Cutout registration dry-run');
  console.log('===========================');
  console.log(`Assets found       : ${report.totalAssets}`);
  console.log(`Matched products   : ${report.matchedProducts}`);
  console.log(`Unmatched assets   : ${report.unmatchedAssets}`);
  console.log(`Report written     : ${relative(root, reportPath).replace(/\\/g, '/')}`);
  if (apply) {
    console.log('Apply mode is intentionally manual-only. Review the report before editing product data.');
  }
}

main();
