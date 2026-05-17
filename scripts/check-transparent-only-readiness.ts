// Answers whether Sylistly can safely run transparent-only today.
//
// This is intentionally read-only. It does not alter generator scoring or
// filter runtime products. It checks the transparent subset against the minimum
// category/frame/vibe coverage needed before a transparent-only mode would be
// safe to test in Feed or Build.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

type Frame = 'masc' | 'fem' | 'androgynous' | 'any';

interface RequirementResult {
  label: string;
  passed: boolean;
  actual: number;
  target: number;
  reason: string;
  aliases?: string[];
}

interface ReadinessReport {
  generatedAt: string;
  totalRuntimeProducts: number;
  transparentProducts: number;
  transparentCoveragePercent: number;
  transparentOnlySafe: boolean;
  generatorTransparentSubsetReady: boolean;
  feedFirst50TransparentSubsetReady: boolean;
  countsByCategory: Record<Category, number>;
  countsByFrame: Record<Frame, number>;
  countsByVibe: Record<string, number>;
  countsByStyleFamily: Record<string, number>;
  styleFamilyAliases: Record<string, string[]>;
  exactVibeCounts: Record<string, number>;
  failedRequirements: RequirementResult[];
  passedRequirements: RequirementResult[];
  notes: string[];
}

const REQUIRED_CATEGORY_MINIMUMS: Record<Category, number> = {
  hat: 10,
  outer: 20,
  top: 25,
  bottom: 25,
  shoes: 20,
  bag: 10,
  eyewear: 8,
  jewelry: 8,
};

const KEY_VIBES = ['classic', 'street', 'date', 'work', 'vacation', 'cozy'];

const STYLE_FAMILY_ALIASES: Record<string, string[]> = {
  classic: ['classic', 'old money', 'preppy', 'business casual', 'clean', 'minimal'],
  street: ['street', 'streetwear', 'y2k', 'edgy'],
  work: ['work', 'workwear', 'office', 'business casual'],
  date: ['date', 'night out', 'dressy'],
  vacation: ['vacation', 'summer', 'beach', 'travel'],
  cozy: ['cozy', 'winter'],
};

function emptyCategoryCounts(): Record<Category, number> {
  return Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<Category, number>;
}

function classifyFrame(product: Product): Frame {
  if (!Array.isArray(product.gender) || product.gender.length === 0) return 'any';
  if (product.gender.includes('masc') && !product.gender.includes('fem')) return 'masc';
  if (product.gender.includes('fem') && !product.gender.includes('masc')) return 'fem';
  if (product.gender.includes('androgynous')) return 'androgynous';
  return 'any';
}

function requirement(label: string, actual: number, target: number, reason: string, aliases?: string[]): RequirementResult {
  return { label, actual, target, passed: actual >= target, reason, aliases };
}

function productVibes(product: Product): string[] {
  return [...(product.vibes || []), ...(product.occasions || [])]
    .filter((vibe): vibe is string => typeof vibe === 'string')
    .map((vibe) => vibe.toLowerCase());
}

function matchesStyleFamily(product: Product, family: string): boolean {
  const aliases = STYLE_FAMILY_ALIASES[family] || [family];
  const vibes = productVibes(product);
  return vibes.some((vibe) => aliases.includes(vibe));
}

function buildReport(): ReadinessReport {
  const products = ALL_CATALOG_PRODUCTS as Product[];
  const transparent = products.filter((product) => Boolean(product.imageTransparentUrl));
  const countsByCategory = emptyCategoryCounts();
  const countsByFrame: Record<Frame, number> = { masc: 0, fem: 0, androgynous: 0, any: 0 };
  const countsByVibe: Record<string, number> = {};
  const exactVibeCounts: Record<string, number> = {};
  const countsByStyleFamily: Record<string, number> = {};

  for (const product of transparent) {
    countsByCategory[product.category] += 1;
    countsByFrame[classifyFrame(product)] += 1;
    for (const vibe of productVibes(product)) {
      countsByVibe[vibe] = (countsByVibe[vibe] || 0) + 1;
      exactVibeCounts[vibe] = (exactVibeCounts[vibe] || 0) + 1;
    }
    for (const family of KEY_VIBES) {
      if (matchesStyleFamily(product, family)) {
        countsByStyleFamily[family] = (countsByStyleFamily[family] || 0) + 1;
      }
    }
  }

  const requirements: RequirementResult[] = [];
  for (const category of CATEGORY_ORDER) {
    requirements.push(requirement(
      `${category} transparent coverage`,
      countsByCategory[category],
      REQUIRED_CATEGORY_MINIMUMS[category],
      `Transparent-only needs enough ${category} options for generation variety.`,
    ));
  }
  for (const frame of ['masc', 'fem', 'androgynous'] as const) {
    requirements.push(requirement(
      `${frame} frame coverage`,
      countsByFrame[frame],
      30,
      `Transparent-only should not collapse recommendations for ${frame} users.`,
    ));
  }
  for (const vibe of KEY_VIBES) {
    const aliases = STYLE_FAMILY_ALIASES[vibe] || [vibe];
    requirements.push(requirement(
      `${vibe} style-family coverage`,
      countsByStyleFamily[vibe] || 0,
      12,
      `Transparent-only needs enough ${vibe} pieces for Feed and Build variety. This counts the app's existing generator aliases: ${aliases.join(', ')}.`,
      aliases,
    ));
  }

  const generatorTransparentSubsetReady = [
    'top',
    'bottom',
    'shoes',
    'outer',
  ].every((category) => countsByCategory[category as Category] >= REQUIRED_CATEGORY_MINIMUMS[category as Category]);
  const feedFirst50TransparentSubsetReady = transparent.length >= 120 && requirements.every((entry) => entry.passed);
  const transparentOnlySafe = generatorTransparentSubsetReady && feedFirst50TransparentSubsetReady;

  return {
    generatedAt: new Date().toISOString(),
    totalRuntimeProducts: products.length,
    transparentProducts: transparent.length,
    transparentCoveragePercent: products.length ? Math.round((transparent.length / products.length) * 1000) / 10 : 0,
    transparentOnlySafe,
    generatorTransparentSubsetReady,
    feedFirst50TransparentSubsetReady,
    countsByCategory,
    countsByFrame,
    countsByVibe: Object.fromEntries(Object.entries(countsByVibe).sort((a, b) => b[1] - a[1])),
    countsByStyleFamily: Object.fromEntries(Object.entries(countsByStyleFamily).sort((a, b) => b[1] - a[1])),
    styleFamilyAliases: STYLE_FAMILY_ALIASES,
    exactVibeCounts: Object.fromEntries(Object.entries(exactVibeCounts).sort((a, b) => b[1] - a[1])),
    failedRequirements: requirements.filter((entry) => !entry.passed),
    passedRequirements: requirements.filter((entry) => entry.passed),
    notes: [
      'This report is read-only and does not change Feed or Build generation.',
      'Style-family readiness counts generator vocabulary aliases such as streetwear->street and office->work; exact raw vibe counts are preserved in exactVibeCounts.',
      'Transparent-only is not recommended until tops, bottoms, shoes, outerwear, frame coverage, and style-family coverage all pass.',
      'Original-only products should remain available while transparent asset coverage is low.',
    ],
  };
}

function writeReport(report: ReadinessReport): void {
  const outDir = join(process.cwd(), 'data', 'catalog', 'reports');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'transparent-only-readiness-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function main(): void {
  const report = buildReport();
  writeReport(report);

  console.log('Transparent-only Readiness');
  console.log('==========================');
  console.log(`Runtime products: ${report.totalRuntimeProducts}`);
  console.log(`Transparent products: ${report.transparentProducts} (${report.transparentCoveragePercent}%)`);
  console.log(`Generator transparent subset ready: ${report.generatorTransparentSubsetReady}`);
  console.log(`Feed first 50 transparent subset ready: ${report.feedFirst50TransparentSubsetReady}`);
  console.log(`Transparent-only safe: ${report.transparentOnlySafe}`);
  console.log('');
  console.log('Transparent products by category');
  console.log('--------------------------------');
  for (const category of CATEGORY_ORDER) {
    console.log(`  ${category}: ${report.countsByCategory[category]}`);
  }
  console.log('');
  console.log('Transparent products by style family');
  console.log('------------------------------------');
  for (const vibe of KEY_VIBES) {
    console.log(`  ${vibe}: ${report.countsByStyleFamily[vibe] || 0} (aliases: ${report.styleFamilyAliases[vibe].join(', ')})`);
  }
  console.log('');
  console.log('Failed requirements');
  console.log('-------------------');
  for (const item of report.failedRequirements.slice(0, 20)) {
    console.log(`  ${item.label}: ${item.actual}/${item.target} - ${item.reason}`);
  }
}

main();
