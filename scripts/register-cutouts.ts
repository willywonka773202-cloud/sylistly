import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';

const root = process.cwd();
const cutoutDir = join(root, 'public', 'assets', 'cutouts');
const reportDir = join(root, 'data', 'catalog', 'cutout-reviewed');
const reportPath = join(reportDir, 'cutout-register-report.json');
const overridePath = join(root, 'data', 'catalog-cutout-overrides.json');
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
    imageUpdatedAt: string;
    imageReviewNotes: string;
  };
};

type CutoutOverride = NonNullable<CutoutMatch['proposedPatch']> & {
  imageQualityFlags?: string[];
};

function readExistingOverrides(): Record<string, CutoutOverride> {
  if (!existsSync(overridePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(overridePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, CutoutOverride>;
  } catch {
    return {};
  }
}

const productById = new Map(ALL_CATALOG_PRODUCTS.map((product) => [product.id, product]));

function isCutoutAsset(file: string): boolean {
  return /\.(png|webp|avif)$/i.test(file);
}

function publicUrlFor(file: string): string {
  return `/assets/cutouts/${file}`;
}

function main() {
  mkdirSync(reportDir, { recursive: true });
  const generatedAt = new Date().toISOString();
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
            imageUpdatedAt: generatedAt,
            imageReviewNotes: `Registered from ${relative(root, join(cutoutDir, file)).replace(/\\/g, '/')} by scripts/register-cutouts.ts.`,
          }
        : undefined,
    };
  });

  let appliedCount = 0;
  let overrideFile = relative(root, overridePath).replace(/\\/g, '/');
  if (apply) {
    const existing = readExistingOverrides();
    const next = { ...existing };
    for (const match of matches) {
      if (!match.matched || !match.proposedPatch) continue;
      next[match.id] = {
        ...(existing[match.id] || {}),
        ...match.proposedPatch,
      };
      appliedCount += 1;
    }
    writeFileSync(overridePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }

  const report = {
    generatedAt,
    mode: apply ? 'apply' : 'dry-run',
    cutoutDir: relative(root, cutoutDir).replace(/\\/g, '/'),
    overrideFile,
    totalAssets: files.length,
    matchedProducts: matches.filter((match) => match.matched).length,
    unmatchedAssets: matches.filter((match) => !match.matched).length,
    appliedCount,
    matches,
    notes: [
      apply
        ? 'Applied matched cutout assets to data/catalog-cutout-overrides.json. Source product files were not edited.'
        : 'Dry-run only. Use --apply after reviewing assets to write data/catalog-cutout-overrides.json.',
      'The runtime catalog reads this reviewed override layer after tag overrides.',
      'Unmatched assets are reported but never applied.',
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
  console.log(`Applied overrides  : ${report.appliedCount}`);
  console.log(`Report written     : ${relative(root, reportPath).replace(/\\/g, '/')}`);
  if (apply) {
    console.log(`Override file      : ${report.overrideFile}`);
  }
}

main();
