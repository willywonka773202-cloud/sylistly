// Sylistly catalog-health audit.
//
// Read-only summary of every live catalog source.  Imports the existing
// arrays (BRAND_CATALOG_PRODUCTS, GENERATED_CATALOG_PRODUCTS,
// PHOTO_CATALOG_PRODUCTS) without mutating them, runs each entry
// through lib/catalog-schemas/product.v2.ts:validateProduct, and prints
// per-source + cross-source statistics.
//
// Does NOT change behavior of the live app — generator + feed + build
// keep using the same products they already do.  The validator is
// stricter than runtime; surfacing issues here is the point.
//
// Run:
//   npx jiti scripts/catalog-health.ts
//   npx jiti scripts/catalog-health.ts --json
//   npx jiti scripts/catalog-health.ts --strict
//   npx jiti scripts/catalog-health.ts --verbose --limit=40
//
// Exit codes:
//   0   default (always; this is an audit, not a gate)
//   1   only under --strict when any product fails validation
//
// Safe to wire into a CI dashboard for visibility, but DO NOT add it
// to release-readiness as a blocking gate until the live catalog has
// been brought up to the schema. The release gate stays scoped to the
// existing audits.

import { BRAND_CATALOG_PRODUCTS } from '../lib/brand-catalog';
import { GENERATED_CATALOG_PRODUCTS } from '../lib/generated-catalog';
import { PHOTO_CATALOG_PRODUCTS } from '../lib/photo-catalog';
import {
  validateProduct,
  type ProductValidationIssueCode,
  type ProductValidationResult,
} from '../lib/catalog-schemas/product.v2';

type SourceLabel = 'brand-catalog' | 'generated-catalog' | 'photo-catalog';

interface SourceStats {
  label: SourceLabel;
  total: number;
  valid: number;
  invalid: number;
  byCategory: Record<string, number>;
  // internal accumulator — kept off the wire-shape so JSON.stringify
  // does not emit it as `{}`. Populated during scan, finalized into
  // `byCategory` (a plain record) before the report leaves the audit.
  _byCategoryAcc: Map<string, number>;
  issueCounts: Partial<Record<ProductValidationIssueCode, number>>;
}

interface SampleIssueRow {
  source: SourceLabel;
  id: string;
  brand: string;
  name: string;
  issues: ProductValidationResult['issues'];
}

interface CatalogReport {
  generatedAt: string;
  totals: { products: number; valid: number; invalid: number };
  sources: SourceStats[];
  duplicateIds: string[];
  duplicateIdCount: number;
  issueCounts: Partial<Record<ProductValidationIssueCode, number>>;
  byCategory: Record<string, number>;
  byVibe: Record<string, number>;
  byGender: Record<string, number>;
  missingImageUrl: number;
  missingProductUrl: number;
  unsafeImageUrl: number;
  fakeTermCount: number;
  sampleIssues: SampleIssueRow[];
}

interface CliFlags {
  json: boolean;
  strict: boolean;
  verbose: boolean;
  limit: number;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { json: false, strict: false, verbose: false, limit: 20 };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--verbose') flags.verbose = true;
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.limit = Math.min(n, 200);
    }
  }
  return flags;
}

function bumpMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) || 0) + 1);
}

function bumpRecord<K extends string>(record: Partial<Record<K, number>>, key: K): void {
  record[key] = ((record[key] as number | undefined) || 0) + 1;
}

const UNSAFE_IMAGE_CODES: ProductValidationIssueCode[] = [
  'IMAGE_URL_DATA_URL',
  'IMAGE_URL_SVG_DATA',
  'IMAGE_URL_SEARCH_INTENT',
  'IMAGE_URL_PLACEHOLDER',
  'IMAGE_URL_UNSAFE_HOST',
  'IMAGE_URL_NOT_STRING',
];

const FAKE_TERM_CODES: ProductValidationIssueCode[] = [
  'FAKE_TITLE_TERM',
  'FAKE_BRAND_TERM',
];

function audit(): CatalogReport {
  const sources: Array<{ label: SourceLabel; products: unknown[] }> = [
    { label: 'brand-catalog', products: BRAND_CATALOG_PRODUCTS as unknown[] },
    { label: 'generated-catalog', products: GENERATED_CATALOG_PRODUCTS as unknown[] },
    { label: 'photo-catalog', products: PHOTO_CATALOG_PRODUCTS as unknown[] },
  ];

  const sourceStats: SourceStats[] = [];
  const issueCounts: Partial<Record<ProductValidationIssueCode, number>> = {};
  const byCategory = new Map<string, number>();
  const byVibe = new Map<string, number>();
  const byGender = new Map<string, number>();
  const sampleIssues: SampleIssueRow[] = [];
  const idCounts = new Map<string, number>();
  let totalValid = 0;
  let totalInvalid = 0;
  let totalProducts = 0;
  let missingImageUrl = 0;
  let missingProductUrl = 0;
  let unsafeImageUrl = 0;
  let fakeTermCount = 0;

  for (const { label, products } of sources) {
    const stats: SourceStats = {
      label,
      total: products.length,
      valid: 0,
      invalid: 0,
      byCategory: {},
      _byCategoryAcc: new Map(),
      issueCounts: {},
    };
    totalProducts += products.length;

    for (const product of products) {
      const result = validateProduct(product);
      const obj = (typeof product === 'object' && product !== null ? product : {}) as Record<string, unknown>;

      // category distribution from declared field, even if invalid
      const declaredCategory = typeof obj.category === 'string' ? obj.category : 'unknown';
      bumpMap(byCategory, declaredCategory);
      bumpMap(stats._byCategoryAcc, declaredCategory);

      // vibe distribution
      if (Array.isArray(obj.vibes)) {
        for (const v of obj.vibes) {
          if (typeof v === 'string') bumpMap(byVibe, v);
        }
      }

      // gender distribution
      if (Array.isArray(obj.gender) && obj.gender.length > 0) {
        for (const g of obj.gender) {
          if (typeof g === 'string') bumpMap(byGender, g);
        }
      } else {
        bumpMap(byGender, 'unspecified');
      }

      // id duplicates
      if (typeof obj.id === 'string' && obj.id.trim() !== '') {
        idCounts.set(obj.id, (idCounts.get(obj.id) || 0) + 1);
      }

      if (result.valid) {
        stats.valid++;
        totalValid++;
      } else {
        stats.invalid++;
        totalInvalid++;
        if (sampleIssues.length < 200) {
          sampleIssues.push({
            source: label,
            id: result.productId || '<missing-id>',
            brand: result.productBrand || '<missing-brand>',
            name: result.productName || '<missing-name>',
            issues: result.issues,
          });
        }
      }

      // tally issue codes per-source and overall
      let sawUnsafeImage = false;
      let sawFakeTerm = false;
      let sawMissingImage = false;
      let sawMissingProductUrl = false;
      for (const issue of result.issues) {
        bumpRecord(issueCounts, issue.code);
        bumpRecord(stats.issueCounts, issue.code);
        if (issue.code === 'MISSING_IMAGE_URL') sawMissingImage = true;
        if (issue.code === 'MISSING_PRODUCT_URL') sawMissingProductUrl = true;
        if (UNSAFE_IMAGE_CODES.includes(issue.code)) sawUnsafeImage = true;
        if (FAKE_TERM_CODES.includes(issue.code)) sawFakeTerm = true;
      }
      if (sawMissingImage) missingImageUrl++;
      if (sawMissingProductUrl) missingProductUrl++;
      if (sawUnsafeImage) unsafeImageUrl++;
      if (sawFakeTerm) fakeTermCount++;
    }

    stats.byCategory = sortMapToRecord(stats._byCategoryAcc);
    sourceStats.push(stats);
  }

  const duplicateIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  // Convert byCategory / byVibe / byGender Maps to records sorted desc
  const byCategoryRecord = sortMapToRecord(byCategory);
  const byVibeRecord = sortMapToRecord(byVibe);
  const byGenderRecord = sortMapToRecord(byGender);

  return {
    generatedAt: new Date().toISOString(),
    totals: { products: totalProducts, valid: totalValid, invalid: totalInvalid },
    sources: sourceStats,
    duplicateIds,
    duplicateIdCount: duplicateIds.length,
    issueCounts,
    byCategory: byCategoryRecord,
    byVibe: byVibeRecord,
    byGender: byGenderRecord,
    missingImageUrl,
    missingProductUrl,
    unsafeImageUrl,
    fakeTermCount,
    sampleIssues,
  };
}

function sortMapToRecord(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    Array.from(map.entries()).sort((a, b) => b[1] - a[1]),
  );
}

function pad(text: string, width: number): string {
  if (text.length >= width) return text;
  return text + ' '.repeat(width - text.length);
}

function padNumber(n: number, width: number): string {
  const text = n.toLocaleString();
  if (text.length >= width) return text;
  return ' '.repeat(width - text.length) + text;
}

function printHumanReport(report: CatalogReport, flags: CliFlags): void {
  console.log('Sylistly Catalog Health');
  console.log('=======================');
  console.log(`Generated: ${report.generatedAt}`);
  console.log('');

  // == Sources ==
  console.log('Sources');
  console.log('-------');
  for (const source of report.sources) {
    console.log(
      `  ${pad(source.label, 20)} total=${padNumber(source.total, 6)}  valid=${padNumber(source.valid, 6)}  invalid=${padNumber(source.invalid, 6)}`,
    );
  }
  console.log('');

  // == Overall ==
  console.log('Overall');
  console.log('-------');
  console.log(`  total products       : ${report.totals.products.toLocaleString()}`);
  console.log(`  valid (no errors)    : ${report.totals.valid.toLocaleString()}`);
  console.log(`  invalid (>=1 error)  : ${report.totals.invalid.toLocaleString()}`);
  console.log(`  duplicate IDs        : ${report.duplicateIdCount.toLocaleString()}`);
  console.log(`  missing image URL    : ${report.missingImageUrl.toLocaleString()}`);
  console.log(`  missing product URL  : ${report.missingProductUrl.toLocaleString()}`);
  console.log(`  unsafe image URL     : ${report.unsafeImageUrl.toLocaleString()}`);
  console.log(`  fake/mock terms      : ${report.fakeTermCount.toLocaleString()}`);
  console.log('');

  // == Issue counts ==
  const issueEntries = Object.entries(report.issueCounts)
    .filter(([, count]) => (count as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  if (issueEntries.length) {
    console.log('Issue counts (by code)');
    console.log('----------------------');
    for (const [code, count] of issueEntries) {
      console.log(`  ${pad(code, 28)} ${padNumber(count as number, 6)}`);
    }
    console.log('');
  } else {
    console.log('Issue counts: none');
    console.log('');
  }

  // == By category ==
  console.log('Distribution by category');
  console.log('------------------------');
  for (const [category, count] of Object.entries(report.byCategory)) {
    console.log(`  ${pad(category, 20)} ${padNumber(count, 6)}`);
  }
  console.log('');

  // == By vibe (top 10) ==
  const vibeEntries = Object.entries(report.byVibe).slice(0, flags.verbose ? 30 : 10);
  if (vibeEntries.length) {
    console.log(`Top ${vibeEntries.length} vibes`);
    console.log('-'.repeat(`Top ${vibeEntries.length} vibes`.length));
    for (const [vibe, count] of vibeEntries) {
      console.log(`  ${pad(vibe, 24)} ${padNumber(count, 6)}`);
    }
    console.log('');
  }

  // == By gender ==
  console.log('Distribution by gender/frame');
  console.log('----------------------------');
  for (const [gender, count] of Object.entries(report.byGender)) {
    console.log(`  ${pad(gender, 20)} ${padNumber(count, 6)}`);
  }
  console.log('');

  // == Duplicate IDs ==
  if (report.duplicateIdCount > 0) {
    const shown = report.duplicateIds.slice(0, 20);
    console.log(`Duplicate IDs (first ${shown.length} of ${report.duplicateIdCount})`);
    console.log('-'.repeat('Duplicate IDs (first XX of YY)'.length));
    for (const id of shown) console.log(`  ${id}`);
    console.log('');
  }

  // == Sample issues ==
  if (report.sampleIssues.length > 0) {
    const cap = Math.min(flags.limit, report.sampleIssues.length);
    console.log(`Sample invalid products (first ${cap} of ${report.sampleIssues.length})`);
    console.log('-'.repeat(`Sample invalid products (first ${cap} of ${report.sampleIssues.length})`.length));
    for (const row of report.sampleIssues.slice(0, cap)) {
      const titleLine = `[${row.source}] id=${row.id} brand=${row.brand} name=${row.name}`.slice(0, 140);
      console.log(`  ${titleLine}`);
      const issuesToShow = flags.verbose ? row.issues : row.issues.slice(0, 3);
      for (const issue of issuesToShow) {
        console.log(`    - ${issue.code} (${issue.severity}) [${issue.field}] ${issue.message.slice(0, 120)}`);
      }
      if (!flags.verbose && row.issues.length > 3) {
        console.log(`    + ${row.issues.length - 3} more issue(s) — pass --verbose to expand`);
      }
    }
    console.log('');
  }

  // == Summary ==
  console.log('Result');
  console.log('------');
  const overallTag = report.totals.invalid === 0 ? 'PASS' : flags.strict ? 'FAIL (--strict)' : 'PASS (with reported issues)';
  console.log(`  ${overallTag}`);
  console.log(`  ${report.totals.valid.toLocaleString()} valid / ${report.totals.invalid.toLocaleString()} invalid / ${report.totals.products.toLocaleString()} total`);
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const report = audit();

  if (flags.json) {
    // Strip the internal Map accumulator before serializing — Maps
    // serialize to `{}` and the finalized record is already on the
    // `byCategory` field. Building a wire-shape copy keeps the audit
    // type ergonomic during accumulation.
    const wire = {
      ...report,
      sources: report.sources.map(({ _byCategoryAcc: _, ...rest }) => rest),
    };
    console.log(JSON.stringify(wire, null, 2));
  } else {
    printHumanReport(report, flags);
  }

  const shouldFail = flags.strict && report.totals.invalid > 0;
  process.exit(shouldFail ? 1 : 0);
}

main();
