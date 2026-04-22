import { NextRequest, NextResponse } from 'next/server';
import { parseSearchIntent, rerankProducts } from '@/lib/claude';
import { hasDirectRetailerUrl, hydrateRetailerUrls, searchShopping } from '@/lib/serpapi';
import { wrapAffiliate } from '@/lib/affiliate';
import { cacheProducts } from '@/lib/products';
import { mockSearch } from '@/lib/mock-products';
import type { Category, Product } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 20;

interface SearchBody {
  query: string;
  category?: Category;
  mode?: 'live' | 'demo';
}

const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const searchResponseCache = new Map<string, { expiresAt: number; products: Product[] }>();
const EXPANDED_MARKETPLACE_HOSTS = new Set([
  'ebay.com',
  'etsy.com',
  'mercari.com',
  'poshmark.com',
  'vestiairecollective.com',
  'whatnot.com',
]);

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function productSortScore(product: Product): number {
  const host = safeHostname(product.retailerUrl);
  let score = 0;

  if (product.trusted !== false) score += 1_000;
  if (hasDirectRetailerUrl(product.retailerUrl)) score += 250;
  if (product.priceCents > 0) score += 40;
  if (host && !EXPANDED_MARKETPLACE_HOSTS.has(host)) score += 25;

  return score;
}

function demoSearchResponse(category: Category | undefined, query: string, reason: string) {
  const products = mockSearch(category || 'top', query);
  return NextResponse.json({
    products,
    mock: true,
    mode: 'demo',
    reason,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SearchBody;
  const query = (body.query || '').slice(0, 200);
  const category = body.category;
  const mode = body.mode || 'live';
  const cacheKey = `${category || 'any'}::${query.trim().toLowerCase()}`;
  const isDev = process.env.NODE_ENV === 'development';
  const liveSearchKey = process.env.SEARCHAPI_KEY || process.env.SERPAPI_KEY;
  const shouldUseDevMocks = isDev && !liveSearchKey;

  if (isDev && mode === 'demo') {
    return demoSearchResponse(category, query, 'manual_demo');
  }

  if (shouldUseDevMocks) {
    return demoSearchResponse(category, query, 'missing_searchapi_key');
  }

  if (!liveSearchKey) {
    return NextResponse.json(
      { error: 'SEARCHAPI_KEY is required for live product search.' },
      { status: 500 },
    );
  }

  const cached = searchResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ products: cached.products, cached: true });
  }
  if (cached) searchResponseCache.delete(cacheKey);

  const startedAt = Date.now();

  try {
    // 1. Parse intent
    const intent = await parseSearchIntent(query, category);

    // 2. Search real inventory
    const candidates = await searchShopping(intent, query);

    // 3. Re-rank with Claude
    const rerankLimit = Math.min(6, candidates.length);
    const ranked = candidates.length > rerankLimit
      ? await rerankProducts(query, intent, candidates, rerankLimit)
      : candidates.slice(0, rerankLimit);

    // 4. Resolve direct retailer links for the strongest results only.
    // This keeps the picker responsive on mobile while still upgrading the
    // top cards with clean retailer destinations.
    const hydrationTargets = ranked.slice(0, 3);
    const untouched = ranked.slice(3);
    const hydratedTop = await hydrateRetailerUrls(hydrationTargets);
    const combined = [...hydratedTop, ...untouched].sort(
      (left, right) => productSortScore(right) - productSortScore(left),
    );
    const directFirst = combined.filter((product) => hasDirectRetailerUrl(product.retailerUrl));
    const selected = (directFirst.length >= 4
      ? [
          ...directFirst,
          ...combined.filter((product) => !hasDirectRetailerUrl(product.retailerUrl)),
        ]
      : combined
    ).slice(0, 6);

    // 5. Affiliate-wrap
    const products: Product[] = selected.map((p) => ({
      ...p,
      affiliateUrl: wrapAffiliate(p.retailerUrl),
    }));

    if (!products.length) {
      return NextResponse.json(
        { error: 'No live products found for that query.' },
        { status: 404 },
      );
    }

    console.info(
      '[api/search] query=%s category=%s candidates=%d results=%d durationMs=%d',
      query || '(blank)',
      category || intent.category,
      candidates.length,
      products.length,
      Date.now() - startedAt,
    );

    // 6. Fire-and-forget cache write
    cacheProducts(products).catch(() => {});
    searchResponseCache.set(cacheKey, {
      expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
      products,
    });

    return NextResponse.json({ products });
  } catch (err) {
    console.error('[api/search]', err);
    const message =
      err instanceof Error ? err.message : 'Live search failed. Please try again.';
    if (/searchapi 429|serpapi 429/i.test(message)) {
      return NextResponse.json(
        {
          error: 'Live search is temporarily rate-limited. Please wait a moment and try again.',
          demoAvailable: isDev,
        },
        { status: 429 },
      );
    }
    if (/searchapi 401|serpapi 401/i.test(message)) {
      return NextResponse.json(
        { error: 'The SearchAPI key was rejected. Double-check that SEARCHAPI_KEY is your regular API key, not an MCP URL or token.' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
