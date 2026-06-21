/**
 * Auto-ingestion pipeline — "integrate every seller, grow the catalog forever".
 *
 * The core architectural truth (see ./README.md): catalog DATA and affiliate
 * COMMISSION are SEPARATE layers.
 *   • Affiliate-network feeds (Impact, Awin, Rakuten) give data + a pre-tracked
 *     deep link in one shot → growth = revenue.
 *   • Anything else (Shopify long-tail, aggregators) gives raw data; the raw URL
 *     is wrapped with Skimlinks at output so it STILL earns commission.
 *
 * This job pulls from every ENABLED source (enabled = its env credential is set;
 * Shopify needs none), normalizes each to one `IngestRecord`, dedupes
 * (GTIN-first), and writes a STAGING file. Staging — not the live catalog —
 * because raw retailer images aren't feed-grade; a separate promote step runs
 * them through the Higgsfield cutout pipeline + quality gate before they ship
 * (see README "Promote to live").
 *
 * Run:  npx jiti scripts/ingest/ingest-catalog.ts --shopify=store1.com,store2.com
 *       (Impact/Awin auto-run when their env vars are set)
 *
 * Self-contained (no `@/` imports) so it runs under the standalone jiti runner.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface IngestRecord {
  id: string; // stable: `${source}:${sourceId}`
  brand: string;
  name: string;
  priceCents: number;
  currency: string;
  category: string; // mapped to Sylistly's category enum
  imageUrl: string;
  productUrl: string; // ALWAYS the commissionable URL (network deep link, or Skimlinks-wrapped)
  source: IngestSource;
  gtin?: string; // best dedupe key when present
  inStock?: boolean;
}

export type IngestSource = 'impact' | 'awin' | 'rakuten' | 'shopify' | 'aggregator';

// Higher-commission sources win on dedupe conflicts (a network's pre-tracked
// link usually pays more than a Skimlinks-wrapped raw URL).
const SOURCE_RANK: Record<IngestSource, number> = { impact: 0, awin: 1, rakuten: 2, aggregator: 3, shopify: 4 };

// ── Normalizers ─────────────────────────────────────────────────────────────

export function toCents(price: string | number | undefined | null): number {
  if (price == null) return 0;
  const n = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Map a source's free-text taxonomy → Sylistly's category enum. */
export function mapCategory(raw: string | undefined | null): string {
  const t = (raw || '').toLowerCase();
  if (/jacket|coat|blazer|outerwear|parka|puffer|trench|overcoat/.test(t)) return 'outer';
  if (/jean|trouser|pant|short|skirt|legging|chino|cargo|bottom/.test(t)) return 'bottom';
  if (/shoe|sneaker|boot|heel|loafer|sandal|footwear|trainer/.test(t)) return 'shoes';
  if (/bag|tote|backpack|purse|clutch|handbag/.test(t)) return 'bag';
  if (/hat|cap|beanie|headwear|bucket/.test(t)) return 'hat';
  if (/sunglass|eyewear|glasses/.test(t)) return 'eyewear';
  if (/jewel|necklace|ring|bracelet|earring|watch/.test(t)) return 'jewelry';
  if (/shirt|tee|top|sweater|knit|hoodie|blouse|cardigan|polo|tank/.test(t)) return 'top';
  // NB Sylistly composes SEPARATES — there is no 'dress' category. Dresses/gowns/
  // jumpsuits fall to 'top' (a valid placeholder); the promote step decides whether
  // to keep them. ("dress shirt/pant/boot" already matched top/bottom/shoes above.)
  return 'top'; // safe default; the promote step can re-classify with vision
}

export function normalizeBrand(brand: string | undefined, fallback = ''): string {
  return (brand || fallback || '').trim();
}

/** Minimal RFC-4180-ish CSV → row objects (no dependency). Handles quoted fields. */
export function parseCsv(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
      if (c === '\r' && csv[i + 1] === '\n') i += 1;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

/** Wrap any raw retailer URL into a commission link (matches lib/affiliate's pattern). */
export function wrapSkimlinks(rawUrl: string, subId: string): string {
  const id = process.env.NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID || process.env.SKIMLINKS_PUBLISHER_ID;
  if (!id) return rawUrl; // no publisher id → return raw (still ingestable; just not yet monetized)
  return `https://go.skimresources.com/?id=${id}&xs=1&url=${encodeURIComponent(rawUrl)}&xcust=${encodeURIComponent(subId)}`;
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

// ── Adapters ────────────────────────────────────────────────────────────────

/**
 * SHOPIFY — public `/products.json` (no auth, runnable today). Raw URL wrapped
 * with Skimlinks for commission. Discover fashion Shopify stores via BuiltWith /
 * the Skimlinks merchant list. Respect robots.txt + rate-limit politely.
 */
export async function fromShopify(domain: string, maxPages = 4): Promise<IngestRecord[]> {
  const out: IngestRecord[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
      headers: { 'user-agent': 'SylistlyCatalogBot/1.0 (+https://www.sylistly.com)' },
    });
    if (!res.ok) break;
    const data = (await res.json()) as { products?: ShopifyProduct[] };
    const products = data.products ?? [];
    if (!products.length) break;
    for (const p of products) {
      const variant = p.variants?.[0];
      const raw = `https://${domain}/products/${p.handle}`;
      out.push({
        id: `shopify:${domain}:${p.id}`,
        brand: normalizeBrand(p.vendor, domain),
        name: p.title,
        priceCents: toCents(variant?.price),
        currency: 'USD',
        category: mapCategory(p.product_type || p.tags?.join(' ')),
        imageUrl: p.images?.[0]?.src ?? '',
        productUrl: wrapSkimlinks(raw, `shopify_${p.id}`),
        source: 'shopify',
        inStock: p.variants?.some((v) => v.available) ?? undefined,
      });
    }
    await sleep(800);
  }
  return out;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  images?: { src: string }[];
  variants?: { price?: string; available?: boolean }[];
}

/**
 * IMPACT.com Catalog API — Tier 1. Data + pre-tracked deep link (`Url`) together.
 * Env: IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN (HTTP Basic). Per-advertiser approval.
 */
export async function fromImpact(query = 'dress', maxPages = 5): Promise<IngestRecord[]> {
  const sid = process.env.IMPACT_ACCOUNT_SID;
  const token = process.env.IMPACT_AUTH_TOKEN;
  if (!sid || !token) return []; // not configured → skipped
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const out: IngestRecord[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetch(
      `https://api.impact.com/Mediapartners/${sid}/Catalogs/ItemSearch?Query=${encodeURIComponent(query)}&Page=${page}`,
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
    );
    if (!res.ok) break;
    const data = (await res.json()) as { Items?: ImpactItem[] };
    const items = data.Items ?? [];
    if (!items.length) break;
    for (const it of items) {
      out.push({
        id: `impact:${it.CatalogItemId}`,
        brand: normalizeBrand(it.Manufacturer ?? it.Brand),
        name: it.Name,
        priceCents: toCents(it.CurrentPrice),
        currency: it.Currency || 'USD',
        category: mapCategory(it.Category),
        imageUrl: it.ImageUrl ?? '',
        productUrl: it.Url, // already a tracking deep link
        source: 'impact',
        gtin: it.Gtin,
        inStock: it.StockAvailability ? it.StockAvailability !== 'OutOfStock' : undefined,
      });
    }
  }
  return out;
}

interface ImpactItem {
  CatalogItemId: string;
  Name: string;
  Manufacturer?: string;
  Brand?: string;
  CurrentPrice?: string;
  Currency?: string;
  Category?: string;
  ImageUrl?: string;
  Url: string;
  Gtin?: string;
  StockAvailability?: string;
}

/**
 * AWIN — Tier 1, easiest bulk. CSV/XML data feed; `aw_deep_link` pre-tracked.
 * Env: AWIN_FEED_URL (a built feed URL from Create-a-Feed, includes the feed key).
 */
export async function fromAwin(): Promise<IngestRecord[]> {
  const feedUrl = process.env.AWIN_FEED_URL;
  if (!feedUrl) return []; // not configured → skipped
  const res = await fetch(feedUrl);
  if (!res.ok) return [];
  const csv = await res.text();
  return parseCsv(csv).map((row) => ({
    id: `awin:${row.merchant_id || ''}:${row.merchant_product_id || row.aw_product_id || ''}`,
    brand: normalizeBrand(row.brand_name, row.merchant_name),
    name: row.product_name,
    priceCents: toCents(row.search_price || row.store_price),
    currency: row.currency || 'USD',
    category: mapCategory(row.merchant_category || row.category_name),
    imageUrl: row.merchant_image_url || row.aw_image_url || '',
    productUrl: row.aw_deep_link, // already a tracking deep link
    source: 'awin' as const,
    gtin: row.product_GTIN || undefined,
    inStock: row.in_stock ? row.in_stock === '1' : undefined,
  }));
}

// ── Dedupe + orchestrate ────────────────────────────────────────────────────

/** GTIN-first dedupe; on conflict keep the higher-commission source. */
export function dedupe(records: IngestRecord[]): IngestRecord[] {
  const seen = new Map<string, IngestRecord>();
  for (const r of records) {
    const key = r.gtin
      ? `g:${r.gtin}`
      : `n:${r.brand.toLowerCase()}|${r.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    const prev = seen.get(key);
    if (!prev || SOURCE_RANK[r.source] < SOURCE_RANK[prev.source]) seen.set(key, r);
  }
  // Only keep records that are actually usable downstream.
  return [...seen.values()].filter((r) => r.imageUrl && r.priceCents > 0 && r.name && r.productUrl);
}

export interface IngestReport {
  total: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  withGtin: number;
  sample: IngestRecord[];
}

export function reportOn(records: IngestRecord[]): IngestReport {
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const r of records) {
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  return {
    total: records.length,
    bySource,
    byCategory,
    withGtin: records.filter((r) => r.gtin).length,
    sample: records.slice(0, 3),
  };
}

function parseDomains(): string[] {
  const arg = process.argv.find((a) => a.startsWith('--shopify='));
  if (arg) return arg.slice('--shopify='.length).split(',').map((d) => d.trim()).filter(Boolean);
  return (process.env.SHOPIFY_STORES || '').split(',').map((d) => d.trim()).filter(Boolean);
}

export async function ingestAll(domains: string[]): Promise<IngestRecord[]> {
  const batches = await Promise.all([
    fromImpact().catch(() => [] as IngestRecord[]),
    fromAwin().catch(() => [] as IngestRecord[]),
    ...domains.map((d) => fromShopify(d).catch(() => [] as IngestRecord[])),
  ]);
  return dedupe(batches.flat());
}

async function main(): Promise<void> {
  const domains = parseDomains();
  const enabled = [
    process.env.IMPACT_ACCOUNT_SID ? 'impact' : null,
    process.env.AWIN_FEED_URL ? 'awin' : null,
    domains.length ? `shopify(${domains.length})` : null,
  ].filter(Boolean);
  console.log(`[ingest] enabled sources: ${enabled.length ? enabled.join(', ') : 'NONE — set env or pass --shopify=domain.com'}`);

  const records = await ingestAll(domains);
  const report = reportOn(records);
  const outPath = 'data/ingested-staging.json';
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(records, null, 2));
  console.log(`[ingest] wrote ${report.total} records → ${outPath}`);
  console.log(`[ingest] by source:`, report.bySource);
  console.log(`[ingest] by category:`, report.byCategory);
  console.log(`[ingest] ${report.withGtin} have a GTIN (best dedupe key)`);
}

// Run only when invoked directly (so the module stays importable for tests).
if (process.argv[1] && process.argv[1].includes('ingest-catalog')) {
  main().catch((err) => {
    console.error('[ingest] failed:', err);
    process.exit(1);
  });
}
