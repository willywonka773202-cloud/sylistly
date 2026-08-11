import { hasExactProductLink } from './product-image-quality';
import type { Product } from './types';
import { verificationAgeMs } from './verification-freshness';

export const DEFAULT_LINK_FRESHNESS_MS = 24 * 60 * 60 * 1000;

export type LinkHealthOutcome =
  | 'available'
  | 'reachable'
  | 'sold_out'
  | 'dead'
  | 'blocked'
  | 'error';

export interface ProductLinkHealthRecord {
  outcome: LinkHealthOutcome;
  checkedAt: string;
  url?: string;
  httpStatus?: number | null;
  exactPdp?: boolean;
  livePriceCents?: number;
  catalogPriceCents?: number;
  detail?: string;
}

/**
 * Version 1 snapshots only contained generatedAt/checked/unavailable. Version 2
 * adds one typed, timestamped result per checked product while retaining all of
 * those legacy fields so older clients continue to work.
 */
export interface CatalogHealthSnapshot {
  schemaVersion?: number;
  generatedAt?: string;
  checked?: number;
  unavailable?: string[];
  products?: Record<string, ProductLinkHealthRecord | LegacyProductLinkHealthRecord>;
  coverage?: Record<string, unknown>;
}

interface LegacyProductLinkHealthRecord {
  status?: string;
  outcome?: string;
  checkedAt?: string;
  url?: string;
  httpStatus?: number | null;
  exactPdp?: boolean;
}

export type PublishabilityFailure =
  | 'missing_product'
  | 'not_exact_pdp'
  | 'untrusted'
  | 'trust_unknown'
  | 'out_of_stock'
  | 'stock_unknown'
  | 'known_unavailable'
  | 'health_missing'
  | 'health_stale'
  | 'health_unverified';

export type FreshnessPolicy = 'allow-unknown' | 'require-fresh';

export interface PublishabilityOptions {
  health?: CatalogHealthSnapshot | null;
  freshnessPolicy?: FreshnessPolicy;
  maxHealthAgeMs?: number;
  now?: number | Date;
  requireExplicitTrust?: boolean;
  requireExplicitStock?: boolean;
}

export interface PublishabilityEvaluation {
  publishable: boolean;
  failures: PublishabilityFailure[];
  warnings: PublishabilityFailure[];
  evidence: {
    exactPdp: boolean;
    trust: 'trusted' | 'untrusted' | 'unknown';
    stock: 'in_stock' | 'out_of_stock' | 'unknown';
    health: LinkHealthOutcome | 'missing';
    checkedAt: string | null;
    fresh: boolean;
    ageMs: number | null;
  };
}

function normalizeOutcome(value: unknown): LinkHealthOutcome | null {
  if (value === 'available' || value === 'ok') return 'available';
  if (value === 'reachable') return 'reachable';
  if (value === 'sold_out' || value === 'soldout') return 'sold_out';
  if (value === 'dead') return 'dead';
  if (value === 'blocked') return 'blocked';
  if (value === 'error' || (typeof value === 'string' && value.startsWith('error'))) return 'error';
  return null;
}

function healthRecordFor(
  health: CatalogHealthSnapshot | null | undefined,
  productId: string,
): ProductLinkHealthRecord | null {
  const raw = health?.products?.[productId];
  if (!raw || typeof raw !== 'object') return null;
  const outcome = normalizeOutcome(raw.outcome ?? raw.status);
  if (!outcome || typeof raw.checkedAt !== 'string') return null;
  return {
    ...raw,
    outcome,
    checkedAt: raw.checkedAt,
  } as ProductLinkHealthRecord;
}

function embeddedHealthRecord(product: Product): ProductLinkHealthRecord | null {
  const outcome = product.availabilityState === 'in_stock'
    ? 'available'
    : normalizeOutcome(product.availabilityState);
  if (!outcome || typeof product.lastVerifiedAt !== 'string') return null;
  return {
    outcome,
    checkedAt: product.lastVerifiedAt,
    exactPdp: hasExactProductLink(product),
    catalogPriceCents: product.priceCents,
    detail: 'product_embedded_verification',
  };
}

function nowMs(value: number | Date | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return Date.now();
}

function checkedAtAge(checkedAt: string | undefined, now: number): number | null {
  return verificationAgeMs(checkedAt, now);
}

/**
 * One source of truth for whether a product is safe to publish as buyable.
 *
 * Structural failures are always hard failures: the product must own an exact
 * PDP and cannot be explicitly untrusted, out of stock, dead, or sold out.
 * Missing/stale verification is a warning by default so old catalog rows do not
 * disappear overnight; release/build jobs can opt into `require-fresh` once
 * link-health coverage reaches the launch target.
 *
 * Freshness is derived only from a per-product link-health check. Discovery,
 * ingestion, image-update, and catalog-build timestamps are deliberately never
 * treated as availability verification.
 */
export function evaluateProductPublishability(
  product?: Product | null,
  options: PublishabilityOptions = {},
): PublishabilityEvaluation {
  const failures: PublishabilityFailure[] = [];
  const warnings: PublishabilityFailure[] = [];
  const maxHealthAgeMs = Number.isFinite(options.maxHealthAgeMs)
    ? Math.max(0, Number(options.maxHealthAgeMs))
    : DEFAULT_LINK_FRESHNESS_MS;
  const currentTime = nowMs(options.now);

  if (!product) {
    return {
      publishable: false,
      failures: ['missing_product'],
      warnings,
      evidence: {
        exactPdp: false,
        trust: 'unknown',
        stock: 'unknown',
        health: 'missing',
        checkedAt: null,
        fresh: false,
        ageMs: null,
      },
    };
  }

  const exactPdp = hasExactProductLink(product);
  const trust = product.trusted === true
    ? 'trusted'
    : product.trusted === false ? 'untrusted' : 'unknown';
  const stock = product.inStock === true
    ? 'in_stock'
    : product.inStock === false ? 'out_of_stock' : 'unknown';
  const record = healthRecordFor(options.health, product.id) || embeddedHealthRecord(product);
  const outcome = record?.outcome || 'missing';
  const ageMs = checkedAtAge(record?.checkedAt, currentTime);
  const fresh = ageMs !== null && ageMs <= maxHealthAgeMs;

  if (!exactPdp) failures.push('not_exact_pdp');
  if (trust === 'untrusted') failures.push('untrusted');
  if (trust === 'unknown') {
    (options.requireExplicitTrust ? failures : warnings).push('trust_unknown');
  }
  if (stock === 'out_of_stock') failures.push('out_of_stock');
  if (stock === 'unknown') {
    (options.requireExplicitStock ? failures : warnings).push('stock_unknown');
  }

  const legacyUnavailable = Boolean(options.health?.unavailable?.includes(product.id));
  if (legacyUnavailable || outcome === 'dead' || outcome === 'sold_out') {
    failures.push('known_unavailable');
  }

  let freshnessIssue: PublishabilityFailure | null = null;
  if (!record) freshnessIssue = 'health_missing';
  else if (!fresh) freshnessIssue = 'health_stale';
  else if (
    outcome === 'reachable'
    || outcome === 'blocked'
    || outcome === 'error'
    || record.exactPdp === false
  ) {
    freshnessIssue = 'health_unverified';
  }

  if (freshnessIssue) {
    (options.freshnessPolicy === 'require-fresh' ? failures : warnings).push(freshnessIssue);
  }

  return {
    publishable: failures.length === 0,
    failures: Array.from(new Set(failures)),
    warnings: Array.from(new Set(warnings)),
    evidence: {
      exactPdp,
      trust,
      stock,
      health: outcome,
      checkedAt: record?.checkedAt || null,
      fresh,
      ageMs,
    },
  };
}

export function isProductPublishable(
  product?: Product | null,
  options: PublishabilityOptions = {},
): product is Product {
  return evaluateProductPublishability(product, options).publishable;
}

export function filterPublishableProducts(
  products: Product[],
  options: PublishabilityOptions = {},
): Product[] {
  return products.filter((product) => isProductPublishable(product, options));
}
