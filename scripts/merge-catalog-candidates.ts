import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { CATEGORY_ORDER, type Category, type Product } from '../lib/types';

type Candidate = {
  id?: string;
  brand?: string;
  name?: string;
  category?: string;
  gender?: Array<'masc' | 'fem' | 'androgynous'>;
  priceCents?: number | null;
  currency?: string;
  imageUrl?: string | null;
  productUrl?: string;
  retailerUrl?: string;
  retailer?: string;
  vibes?: string[];
  occasions?: string[];
  searchTerms?: string[];
  needsReview?: boolean;
  reviewReasons?: string[];
  metadata?: Record<string, unknown>;
};

type ReviewRow = {
  status: 'ready' | 'needs_review' | 'duplicate_live_catalog' | 'invalid';
  reason: string;
  candidate: Candidate;
};

const INPUT_PATH = path.join(process.cwd(), 'data', 'searchapi-catalog-candidates.json');
const REPORT_PATH = path.join(process.cwd(), 'data', 'searchapi-catalog-review-report.json');
const EXPANSION_PATH = path.join(process.cwd(), 'data', 'searchapi-catalog-reviewed-expansion.json');
const ALLOW_CATALOG_MERGE = process.env.ALLOW_CATALOG_MERGE === 'true';

function normalize(value?: string | null): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeUrl(value?: string | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) {
      url.searchParams.delete(param);
    }
    url.hash = '';
    return url.toString().toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function productIdentity(product: Pick<Product, 'brand' | 'name' | 'category' | 'priceCents' | 'retailerUrl' | 'productUrl'>): string {
  const url = normalizeUrl(product.productUrl || product.retailerUrl);
  if (url) return `url:${url}`;
  return `name:${normalize(product.brand)}|${normalize(product.name)}|${product.category}|${product.priceCents || 0}`;
}

function candidateIdentity(candidate: Candidate): string {
  const url = normalizeUrl(candidate.productUrl || candidate.retailerUrl);
  if (url) return `url:${url}`;
  return `name:${normalize(candidate.brand)}|${normalize(candidate.name)}|${candidate.category}|${candidate.priceCents || 0}`;
}

function isCategory(value?: string): value is Category {
  return CATEGORY_ORDER.includes(value as Category);
}

function validateCandidate(candidate: Candidate): string[] {
  const issues: string[] = [];
  if (!candidate.name?.trim()) issues.push('missing name');
  if (!candidate.brand?.trim()) issues.push('missing brand');
  if (!isCategory(candidate.category)) issues.push('invalid category');
  if (!candidate.productUrl && !candidate.retailerUrl) issues.push('missing product URL');
  if (candidate.priceCents !== null && candidate.priceCents !== undefined && candidate.priceCents <= 0) issues.push('invalid price');
  if (!candidate.gender?.length) issues.push('missing gender');
  return issues;
}

function toExpansionProduct(candidate: Candidate): Partial<Product> {
  return {
    id: candidate.id || `searchapi-${normalize(candidate.brand)}-${normalize(candidate.name)}`.replace(/\s+/g, '-'),
    brand: candidate.brand || '',
    name: candidate.name || '',
    category: candidate.category as Category,
    priceCents: candidate.priceCents || 0,
    currency: candidate.currency || 'USD',
    retailer: candidate.retailer || candidate.brand || 'SearchAPI',
    retailerUrl: candidate.retailerUrl || candidate.productUrl || '',
    productUrl: candidate.productUrl || candidate.retailerUrl || '',
    imageUrl: candidate.imageUrl || '',
    imageQuality: candidate.imageUrl ? 'ok' : 'missing',
    gender: candidate.gender || ['androgynous'],
    vibes: candidate.vibes || [],
    occasions: candidate.occasions || [],
    searchTerms: candidate.searchTerms || [],
    metadata: {
      ...(candidate.metadata || {}),
      source: 'searchapi-reviewed',
      needsReview: candidate.needsReview || false,
      reviewReasons: candidate.reviewReasons || [],
    },
  };
}

async function main() {
  const raw = await readFile(INPUT_PATH, 'utf8').catch(() => '[]');
  const candidates = JSON.parse(raw) as Candidate[];
  const liveIdentity = new Set(ALL_CATALOG_PRODUCTS.map(productIdentity));
  const seenCandidateIdentity = new Set<string>();
  const rows: ReviewRow[] = [];
  const ready: Candidate[] = [];

  for (const candidate of candidates) {
    const issues = validateCandidate(candidate);
    const identity = candidateIdentity(candidate);

    if (!identity || identity === 'name:|||0') {
      rows.push({ status: 'invalid', reason: 'weak identity', candidate });
      continue;
    }

    if (seenCandidateIdentity.has(identity)) {
      rows.push({ status: 'duplicate_live_catalog', reason: 'duplicate candidate identity', candidate });
      continue;
    }
    seenCandidateIdentity.add(identity);

    if (liveIdentity.has(identity)) {
      rows.push({ status: 'duplicate_live_catalog', reason: 'already in live catalog', candidate });
      continue;
    }

    if (issues.length) {
      rows.push({ status: 'invalid', reason: issues.join(', '), candidate });
      continue;
    }

    if (candidate.needsReview || !candidate.imageUrl || !candidate.priceCents) {
      rows.push({ status: 'needs_review', reason: (candidate.reviewReasons || ['manual review']).join(', '), candidate });
      ready.push(candidate);
      continue;
    }

    rows.push({ status: 'ready', reason: 'passes candidate validation', candidate });
    ready.push(candidate);
  }

  const expansionProducts = ready.map(toExpansionProduct);
  const report = {
    input: INPUT_PATH,
    liveCatalogProducts: ALL_CATALOG_PRODUCTS.length,
    candidates: candidates.length,
    ready: rows.filter((row) => row.status === 'ready').length,
    needsReview: rows.filter((row) => row.status === 'needs_review').length,
    duplicateLiveCatalog: rows.filter((row) => row.status === 'duplicate_live_catalog').length,
    invalid: rows.filter((row) => row.status === 'invalid').length,
    allowCatalogMerge: ALLOW_CATALOG_MERGE,
    rows,
  };

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(EXPANSION_PATH, `${JSON.stringify(expansionProducts, null, 2)}\n`, 'utf8');

  console.log(`Reviewed ${candidates.length} SearchAPI candidates against ${ALL_CATALOG_PRODUCTS.length} live products.`);
  console.log(`Ready: ${report.ready}; needs review: ${report.needsReview}; duplicates: ${report.duplicateLiveCatalog}; invalid: ${report.invalid}`);
  console.log(`Wrote report: ${REPORT_PATH}`);
  console.log(`Wrote reviewed expansion candidates: ${EXPANSION_PATH}`);

  if (!ALLOW_CATALOG_MERGE) {
    console.log('Live catalog was not modified. Set ALLOW_CATALOG_MERGE=true only after reviewing the report.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
