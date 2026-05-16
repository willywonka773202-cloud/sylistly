// Hand-rolled product-v2 schema validator.
//
// Validates `unknown` input against the shape we want the future
// catalog/database to enforce. Read-only — never mutates input.  No
// runtime dependencies: pure stdlib so it can be imported by scripts,
// build tooling, and (eventually) catalog import seams without dragging
// in zod or another schema library.
//
// The current live catalog data does NOT yet fully conform to this
// schema. That is expected. `validateProduct` is intentionally a
// reporting tool, not a runtime gate.  Existing imports of
// BRAND_CATALOG_PRODUCTS / GENERATED_CATALOG_PRODUCTS /
// PHOTO_CATALOG_PRODUCTS will not be affected — they go nowhere near
// this file at runtime.

export type IssueSeverity = 'error' | 'warning';

export type ProductValidationIssueCode =
  | 'NOT_OBJECT'
  | 'MISSING_ID'
  | 'ID_NOT_STRING'
  | 'MISSING_NAME'
  | 'NAME_NOT_STRING'
  | 'MISSING_BRAND'
  | 'BRAND_NOT_STRING'
  | 'MISSING_CATEGORY'
  | 'UNKNOWN_CATEGORY'
  | 'PRICE_NOT_NUMBER'
  | 'PRICE_NEGATIVE'
  | 'MISSING_IMAGE_URL'
  | 'IMAGE_URL_NOT_STRING'
  | 'IMAGE_URL_DATA_URL'
  | 'IMAGE_URL_SVG_DATA'
  | 'IMAGE_URL_SEARCH_INTENT'
  | 'IMAGE_URL_PLACEHOLDER'
  | 'IMAGE_URL_UNSAFE_HOST'
  | 'MISSING_PRODUCT_URL'
  | 'FAKE_TITLE_TERM'
  | 'FAKE_BRAND_TERM'
  | 'VIBES_WRONG_TYPE'
  | 'GENDER_WRONG_TYPE'
  | 'GENDER_INVALID_VALUE'
  // ── Transparent-image pipeline fields (v2 additions) ────────────
  // These are ADVISORY — products without a transparent image still
  // pass validation. The fields exist so the schema can describe the
  // future cutout database without blocking the live runtime.
  | 'TRANSPARENT_URL_NOT_STRING'
  | 'TRANSPARENT_URL_DATA_URL'
  | 'TRANSPARENT_URL_UNSAFE_HOST'
  | 'TRANSPARENT_URL_NOT_IMAGE'
  | 'IMAGE_SOURCE_INVALID'
  | 'IMAGE_STATUS_INVALID';

export interface ProductValidationIssue {
  code: ProductValidationIssueCode;
  field: string;
  message: string;
  severity: IssueSeverity;
}

export interface ProductValidationResult {
  valid: boolean;
  issues: ProductValidationIssue[];
  productId?: string;
  productName?: string;
  productBrand?: string;
}

export interface ProductBatchValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  issueCountsByCode: Record<ProductValidationIssueCode, number>;
  duplicateIds: string[];
  sampleIssues: Array<{
    id: string;
    name: string;
    brand: string;
    issues: ProductValidationIssue[];
  }>;
}

// Known categories the future schema accepts. Mirrors lib/types.ts but
// duplicated locally so this file has no project-internal imports — that
// keeps it usable from anywhere (scripts, future build tooling, future
// edge functions) without import-cycle risk.
const KNOWN_CATEGORIES = new Set([
  'hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry',
]);

const KNOWN_GENDERS = new Set(['masc', 'fem', 'androgynous']);

// Strings that strongly indicate a fake/mock/placeholder product. Used
// against title+brand text (joined, lowercased). Whole-token boundary
// is checked so legitimate words like "demoiselle" aren't caught by
// "demo".
const FAKE_TERMS = [
  'sample item', 'sample product', 'placeholder top', 'placeholder bottom',
  'placeholder shoe', 'placeholder shoes', 'placeholder product',
  'demo product', 'demo item', 'mock product', 'mock item',
  'lorem', 'ipsum', 'foobar', 'foo bar', 'dummy product', 'dummy item',
  'fake product', 'fake item', 'product a', 'product b', 'product c',
  'test product', 'test item', 'untitled product', 'untitled item',
];

// Image-URL substrings that disqualify a product from being safe for
// rendering. Conservative — matches things that are almost always
// rendering failures.
const UNSAFE_IMAGE_URL_SUBSTRINGS = [
  'placeholder', 'place-holder', 'no-image', 'no_image', 'noimage',
  'image-coming-soon', 'coming-soon', 'spacer', 'pixel.gif',
  '1x1.', 'grey.gif', 'gray.gif', 'blank.gif', 'empty.gif',
  'default-product', 'default_image', 'defaultimage', 'missing.png',
];

// Hostnames that indicate a search-intent URL rather than a direct
// product image (the page renders to "search results", not a clean
// product photo).
const SEARCH_INTENT_HOST_SUBSTRINGS = [
  'google.com/shopping',
  '#oshopproduct',
  'search.google',
  'shopping.google',
];

function pushIssue(
  issues: ProductValidationIssue[],
  code: ProductValidationIssueCode,
  field: string,
  message: string,
  severity: IssueSeverity = 'error',
): void {
  issues.push({ code, field, message, severity });
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function lowerJoined(...parts: Array<unknown>): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function tokenContains(text: string, term: string): boolean {
  // word-boundary check against term (which may itself contain spaces).
  // Avoids false positives like "demo" matching "demoiselle".
  const padded = ` ${text.replace(/[^a-z0-9]+/g, ' ')} `;
  const needle = ` ${term.replace(/[^a-z0-9]+/g, ' ')} `;
  return padded.includes(needle);
}

function hasFakeTerm(text: string): string | null {
  for (const term of FAKE_TERMS) {
    if (tokenContains(text, term)) return term;
  }
  return null;
}

function hasUnsafeImagePattern(url: string): ProductValidationIssueCode | null {
  const normalized = url.trim().toLowerCase();
  if (normalized.startsWith('data:image/svg')) return 'IMAGE_URL_SVG_DATA';
  if (normalized.startsWith('data:')) return 'IMAGE_URL_DATA_URL';
  if (SEARCH_INTENT_HOST_SUBSTRINGS.some((needle) => normalized.includes(needle))) {
    return 'IMAGE_URL_SEARCH_INTENT';
  }
  if (UNSAFE_IMAGE_URL_SUBSTRINGS.some((needle) => normalized.includes(needle))) {
    return 'IMAGE_URL_PLACEHOLDER';
  }
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://') && !normalized.startsWith('/')) {
    return 'IMAGE_URL_UNSAFE_HOST';
  }
  return null;
}

export function validateProduct(input: unknown): ProductValidationResult {
  const issues: ProductValidationIssue[] = [];

  if (!isPlainObject(input)) {
    pushIssue(issues, 'NOT_OBJECT', '<root>', 'product must be a non-null object');
    return { valid: false, issues };
  }

  const productId = typeof input.id === 'string' ? input.id : undefined;
  const productName = typeof input.name === 'string' ? input.name : undefined;
  const productBrand = typeof input.brand === 'string' ? input.brand : undefined;

  // id
  if (input.id === undefined || input.id === null) {
    pushIssue(issues, 'MISSING_ID', 'id', 'id is required');
  } else if (typeof input.id !== 'string') {
    pushIssue(issues, 'ID_NOT_STRING', 'id', `id must be string, got ${typeof input.id}`);
  } else if (input.id.trim() === '') {
    pushIssue(issues, 'MISSING_ID', 'id', 'id is empty string');
  }

  // name (Product schema uses `name`)
  if (input.name === undefined || input.name === null) {
    pushIssue(issues, 'MISSING_NAME', 'name', 'name is required');
  } else if (typeof input.name !== 'string') {
    pushIssue(issues, 'NAME_NOT_STRING', 'name', `name must be string, got ${typeof input.name}`);
  } else if (input.name.trim() === '') {
    pushIssue(issues, 'MISSING_NAME', 'name', 'name is empty string');
  }

  // brand
  if (input.brand === undefined || input.brand === null) {
    pushIssue(issues, 'MISSING_BRAND', 'brand', 'brand is required');
  } else if (typeof input.brand !== 'string') {
    pushIssue(issues, 'BRAND_NOT_STRING', 'brand', `brand must be string, got ${typeof input.brand}`);
  } else if (input.brand.trim() === '') {
    pushIssue(issues, 'MISSING_BRAND', 'brand', 'brand is empty string');
  }

  // category
  if (input.category === undefined || input.category === null) {
    pushIssue(issues, 'MISSING_CATEGORY', 'category', 'category is required');
  } else if (typeof input.category !== 'string') {
    pushIssue(issues, 'UNKNOWN_CATEGORY', 'category', `category must be string, got ${typeof input.category}`);
  } else if (!KNOWN_CATEGORIES.has(input.category)) {
    pushIssue(issues, 'UNKNOWN_CATEGORY', 'category', `unknown category "${input.category}"`);
  }

  // priceCents — optional in current schema, but if present must be a non-negative number
  if (input.priceCents !== undefined && input.priceCents !== null) {
    if (typeof input.priceCents !== 'number' || !Number.isFinite(input.priceCents)) {
      pushIssue(issues, 'PRICE_NOT_NUMBER', 'priceCents', `priceCents must be finite number, got ${typeof input.priceCents}`);
    } else if (input.priceCents < 0) {
      pushIssue(issues, 'PRICE_NEGATIVE', 'priceCents', `priceCents must be non-negative, got ${input.priceCents}`);
    }
  }

  // imageUrl
  if (input.imageUrl === undefined || input.imageUrl === null) {
    pushIssue(issues, 'MISSING_IMAGE_URL', 'imageUrl', 'imageUrl is required');
  } else if (typeof input.imageUrl !== 'string') {
    pushIssue(issues, 'IMAGE_URL_NOT_STRING', 'imageUrl', `imageUrl must be string, got ${typeof input.imageUrl}`);
  } else if (input.imageUrl.trim() === '') {
    pushIssue(issues, 'MISSING_IMAGE_URL', 'imageUrl', 'imageUrl is empty string');
  } else {
    const unsafe = hasUnsafeImagePattern(input.imageUrl);
    if (unsafe) {
      pushIssue(issues, unsafe, 'imageUrl', `imageUrl appears unsafe: ${input.imageUrl.slice(0, 80)}`);
    }
  }

  // productUrl OR retailerUrl required
  const productUrl = typeof input.productUrl === 'string' ? input.productUrl.trim() : '';
  const retailerUrl = typeof input.retailerUrl === 'string' ? input.retailerUrl.trim() : '';
  if (!productUrl && !retailerUrl) {
    pushIssue(issues, 'MISSING_PRODUCT_URL', 'productUrl|retailerUrl', 'one of productUrl or retailerUrl is required', 'warning');
  }

  // imageTransparentUrl — optional cutout asset (validated when present).
  // Advisory: a missing transparent URL does NOT make the product
  // invalid; the audit script surfaces missing-transparent counts.
  if (input.imageTransparentUrl !== undefined && input.imageTransparentUrl !== null) {
    if (typeof input.imageTransparentUrl !== 'string') {
      pushIssue(
        issues,
        'TRANSPARENT_URL_NOT_STRING',
        'imageTransparentUrl',
        `imageTransparentUrl must be string when present, got ${typeof input.imageTransparentUrl}`,
        'warning',
      );
    } else {
      const trimmed = input.imageTransparentUrl.trim();
      if (trimmed) {
        const normalized = trimmed.toLowerCase();
        if (normalized.startsWith('data:')) {
          pushIssue(
            issues,
            'TRANSPARENT_URL_DATA_URL',
            'imageTransparentUrl',
            'imageTransparentUrl cannot be a data: URL — must point at a real transparent PNG/WebP asset',
            'warning',
          );
        } else if (
          !normalized.startsWith('http://') &&
          !normalized.startsWith('https://') &&
          !normalized.startsWith('/')
        ) {
          pushIssue(
            issues,
            'TRANSPARENT_URL_UNSAFE_HOST',
            'imageTransparentUrl',
            `imageTransparentUrl scheme not recognised: ${trimmed.slice(0, 80)}`,
            'warning',
          );
        } else if (
          !/\.(png|webp|avif)(\?|$)/.test(normalized) &&
          !normalized.includes('format=png') &&
          !normalized.includes('format=webp')
        ) {
          // Soft check — many CDNs serve PNG/WebP from URLs without an
          // extension. Treat as a soft warning, not a blocker.
          pushIssue(
            issues,
            'TRANSPARENT_URL_NOT_IMAGE',
            'imageTransparentUrl',
            'imageTransparentUrl does not look like a PNG/WebP/AVIF asset — verify the cutout pipeline output',
            'warning',
          );
        }
      }
    }
  }

  // imageSource — optional provenance flag (validated when present).
  if (input.imageSource !== undefined && input.imageSource !== null) {
    const validSources = ['merchant', 'searchapi', 'manual', 'generated', 'transparent-pipeline'];
    if (typeof input.imageSource !== 'string' || !validSources.includes(input.imageSource)) {
      pushIssue(
        issues,
        'IMAGE_SOURCE_INVALID',
        'imageSource',
        `imageSource must be one of ${validSources.join(', ')}`,
        'warning',
      );
    }
  }

  // imageStatus — optional pipeline status (validated when present).
  if (input.imageStatus !== undefined && input.imageStatus !== null) {
    const validStatuses = ['original', 'needs-cutout', 'cutout-ready', 'cutout-failed', 'review-only', 'quarantined'];
    if (typeof input.imageStatus !== 'string' || !validStatuses.includes(input.imageStatus)) {
      pushIssue(
        issues,
        'IMAGE_STATUS_INVALID',
        'imageStatus',
        `imageStatus must be one of ${validStatuses.join(', ')}`,
        'warning',
      );
    }
  }

  // title/brand fake-term scan
  const text = lowerJoined(input.name, input.brand);
  if (text) {
    const fake = hasFakeTerm(text);
    if (fake) {
      // Attribute the issue to whichever field actually contains the term.
      const nameLower = typeof input.name === 'string' ? input.name.toLowerCase() : '';
      const brandLower = typeof input.brand === 'string' ? input.brand.toLowerCase() : '';
      if (tokenContains(nameLower, fake)) {
        pushIssue(issues, 'FAKE_TITLE_TERM', 'name', `name contains fake term "${fake}"`);
      }
      if (tokenContains(brandLower, fake)) {
        pushIssue(issues, 'FAKE_BRAND_TERM', 'brand', `brand contains fake term "${fake}"`);
      }
    }
  }

  // vibes — optional but if present must be an array of strings
  if (input.vibes !== undefined && input.vibes !== null) {
    if (!Array.isArray(input.vibes)) {
      pushIssue(issues, 'VIBES_WRONG_TYPE', 'vibes', `vibes must be array, got ${typeof input.vibes}`, 'warning');
    } else if (input.vibes.some((entry) => typeof entry !== 'string')) {
      pushIssue(issues, 'VIBES_WRONG_TYPE', 'vibes', 'vibes must be array of strings', 'warning');
    }
  }

  // gender — optional. Product type allows string[] of masc|fem|androgynous.
  if (input.gender !== undefined && input.gender !== null) {
    if (!Array.isArray(input.gender)) {
      pushIssue(issues, 'GENDER_WRONG_TYPE', 'gender', `gender must be array, got ${typeof input.gender}`, 'warning');
    } else {
      for (const entry of input.gender) {
        if (typeof entry !== 'string' || !KNOWN_GENDERS.has(entry)) {
          pushIssue(issues, 'GENDER_INVALID_VALUE', 'gender', `gender entry "${String(entry)}" not in {masc,fem,androgynous}`, 'warning');
          break;
        }
      }
    }
  }

  const valid = issues.every((issue) => issue.severity !== 'error');
  return { valid, issues, productId, productName, productBrand };
}

export function validateProducts(inputs: unknown[]): ProductBatchValidationSummary {
  // Initialize counts for every code so callers can iterate keys without
  // worrying about absent ones.
  const issueCountsByCode = {} as Record<ProductValidationIssueCode, number>;
  const allCodes: ProductValidationIssueCode[] = [
    'NOT_OBJECT', 'MISSING_ID', 'ID_NOT_STRING', 'MISSING_NAME', 'NAME_NOT_STRING',
    'MISSING_BRAND', 'BRAND_NOT_STRING', 'MISSING_CATEGORY', 'UNKNOWN_CATEGORY',
    'PRICE_NOT_NUMBER', 'PRICE_NEGATIVE', 'MISSING_IMAGE_URL', 'IMAGE_URL_NOT_STRING',
    'IMAGE_URL_DATA_URL', 'IMAGE_URL_SVG_DATA', 'IMAGE_URL_SEARCH_INTENT',
    'IMAGE_URL_PLACEHOLDER', 'IMAGE_URL_UNSAFE_HOST', 'MISSING_PRODUCT_URL',
    'FAKE_TITLE_TERM', 'FAKE_BRAND_TERM', 'VIBES_WRONG_TYPE',
    'GENDER_WRONG_TYPE', 'GENDER_INVALID_VALUE',
    'TRANSPARENT_URL_NOT_STRING', 'TRANSPARENT_URL_DATA_URL',
    'TRANSPARENT_URL_UNSAFE_HOST', 'TRANSPARENT_URL_NOT_IMAGE',
    'IMAGE_SOURCE_INVALID', 'IMAGE_STATUS_INVALID',
  ];
  for (const code of allCodes) issueCountsByCode[code] = 0;

  const idSightings = new Map<string, number>();
  let valid = 0;
  let invalid = 0;
  const sampleIssues: ProductBatchValidationSummary['sampleIssues'] = [];
  const SAMPLE_CAP = 20;

  for (const input of inputs) {
    const result = validateProduct(input);
    if (result.valid) {
      valid++;
    } else {
      invalid++;
      if (sampleIssues.length < SAMPLE_CAP) {
        sampleIssues.push({
          id: result.productId || '<missing-id>',
          name: result.productName || '<missing-name>',
          brand: result.productBrand || '<missing-brand>',
          issues: result.issues,
        });
      }
    }
    for (const issue of result.issues) {
      issueCountsByCode[issue.code] = (issueCountsByCode[issue.code] || 0) + 1;
    }
    if (result.productId) {
      idSightings.set(result.productId, (idSightings.get(result.productId) || 0) + 1);
    }
  }

  const duplicateIds = Array.from(idSightings.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  return {
    total: inputs.length,
    valid,
    invalid,
    issueCountsByCode,
    duplicateIds,
    sampleIssues,
  };
}
