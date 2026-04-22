import { NextRequest, NextResponse } from 'next/server';
import { parseSearchIntent, parseSearchIntentHeuristic, rerankProducts } from '@/lib/claude';
import { hasDirectRetailerUrl, hydrateRetailerUrls, searchShopping } from '@/lib/serpapi';
import { wrapAffiliate } from '@/lib/affiliate';
import { cacheProducts } from '@/lib/products';
import { searchBrandCatalog } from '@/lib/brand-catalog';
import { searchPhotoCatalog } from '@/lib/photo-catalog';
import { mockSearch } from '@/lib/mock-products';
import type { Category, Product } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 20;

interface SearchBody {
  query: string;
  category?: Category;
  mode?: 'live' | 'demo';
}

type SearchSource = 'catalog' | 'live';
type SearchMode = 'catalog-only' | 'catalog-preview' | 'hybrid';

const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const searchResponseCache = new Map<
  string,
  { expiresAt: number; products: Product[]; source: SearchSource }
>();
const EXPANDED_MARKETPLACE_HOSTS = new Set([
  'ebay.com',
  'etsy.com',
  'mercari.com',
  'poshmark.com',
  'vestiairecollective.com',
  'whatnot.com',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

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

function shouldUseCatalogFirst(query: string, category: Category | undefined, detectedBrands: string[] | undefined): boolean {
  if (!query.trim()) return true;
  if ((detectedBrands || []).length > 0) return true;

  const normalized = normalizeText(query);
  if (category && normalized === category) return true;

  return false;
}

function imageLooksLikePlaceholder(imageUrl: string | undefined): boolean {
  return typeof imageUrl === 'string' && imageUrl.startsWith('data:image/svg+xml');
}

function nameOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  let score = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) score += 1;
  }

  return score;
}

function enrichCatalogProductPhotos(catalogProducts: Product[], liveProducts: Product[]): Product[] {
  const usedLiveIds = new Set<string>();

  return catalogProducts.map((catalogProduct) => {
    if (!imageLooksLikePlaceholder(catalogProduct.imageUrl)) return catalogProduct;

    const normalizedBrand = normalizeText(catalogProduct.brand);
    const bestMatch = liveProducts
      .filter((liveProduct) => !usedLiveIds.has(liveProduct.id))
      .map((liveProduct) => {
        const sameBrand = normalizeText(liveProduct.brand) === normalizedBrand;
        const overlap = nameOverlapScore(catalogProduct.name, liveProduct.name);
        return {
          liveProduct,
          score: (sameBrand ? 10 : 0) + overlap + (liveProduct.trusted !== false ? 1 : 0),
        };
      })
      .sort((left, right) => right.score - left.score)[0];

    if (!bestMatch || bestMatch.score < 2) return catalogProduct;

    usedLiveIds.add(bestMatch.liveProduct.id);
    return {
      ...catalogProduct,
      imageUrl: bestMatch.liveProduct.imageUrl || catalogProduct.imageUrl,
      imageOriginalUrl:
        bestMatch.liveProduct.imageOriginalUrl
        || bestMatch.liveProduct.imageUrl
        || catalogProduct.imageOriginalUrl,
      metadata: {
        ...(catalogProduct.metadata || {}),
        photoSource: 'live_match',
        matchedLiveProductId: bestMatch.liveProduct.id,
      },
    };
  });
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

function getSearchMode(): SearchMode {
  if (process.env.SEARCH_MODE === 'catalog-preview') return 'catalog-preview';
  return process.env.SEARCH_MODE === 'hybrid' ? 'hybrid' : 'catalog-only';
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SearchBody;
  const query = (body.query || '').slice(0, 200);
  const category = body.category;
  const mode = body.mode || 'live';
  const cacheKey = `${category || 'any'}::${query.trim().toLowerCase()}`;
  const isDev = process.env.NODE_ENV === 'development';
  const liveSearchKey = process.env.SEARCHAPI_KEY || process.env.SERPAPI_KEY;
  const searchMode = getSearchMode();
  const catalogOnlyMode = searchMode === 'catalog-only';
  const catalogPreviewMode = searchMode === 'catalog-preview';
  const shouldUseDevMocks = isDev && !liveSearchKey;

  if (isDev && mode === 'demo') {
    return demoSearchResponse(category, query, 'manual_demo');
  }

  if (shouldUseDevMocks && !catalogOnlyMode && !catalogPreviewMode) {
    return demoSearchResponse(category, query, 'missing_searchapi_key');
  }

  const cached = searchResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      products: cached.products,
      cached: true,
      source: cached.source,
      searchMode,
    });
  }
  if (cached) searchResponseCache.delete(cacheKey);

  const startedAt = Date.now();

  try {
    // 1. Prefer the real photo-backed catalog whenever we have a match.
    const fastIntent = parseSearchIntentHeuristic(query, category);
    const photoCatalogProducts = searchPhotoCatalog(fastIntent, query).map((product) => ({
      ...product,
      affiliateUrl: wrapAffiliate(product.retailerUrl),
    }));

    if (photoCatalogProducts.length) {
      cacheProducts(photoCatalogProducts).catch(() => {});
      searchResponseCache.set(cacheKey, {
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        products: photoCatalogProducts,
        source: 'catalog',
      });

      console.info(
        '[api/search] query=%s category=%s source=photo_catalog results=%d durationMs=%d',
        query || '(blank)',
        category || fastIntent.category,
        photoCatalogProducts.length,
        Date.now() - startedAt,
      );

      return NextResponse.json({ products: photoCatalogProducts, source: 'catalog', searchMode });
    }

    // 2. Fall back to the built-in starter catalog only in hybrid mode.
    // In catalog-only launch mode we avoid placeholder SVG products so the
    // public site only shows real-photo inventory.
    const useCatalogFirst =
      catalogPreviewMode ||
      (!catalogOnlyMode && shouldUseCatalogFirst(query, category, fastIntent.brand));
    const seededCatalogProducts = useCatalogFirst
      ? searchBrandCatalog(fastIntent, query)
      : [];

    if (seededCatalogProducts.length) {
      let catalogProducts = seededCatalogProducts;

      if (!catalogOnlyMode && liveSearchKey && query.trim()) {
        try {
          const liveCandidates = await searchShopping(fastIntent, query);
          catalogProducts = enrichCatalogProductPhotos(catalogProducts, liveCandidates);
        } catch (error) {
          console.warn('[api/search] catalog photo enrichment failed for "%s": %s', query, String(error));
        }
      }

      const affiliateWrappedProducts = catalogProducts.map((product) => ({
        ...product,
        affiliateUrl: wrapAffiliate(product.retailerUrl),
      }));

      cacheProducts(affiliateWrappedProducts).catch(() => {});
      searchResponseCache.set(cacheKey, {
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        products: affiliateWrappedProducts,
        source: 'catalog',
      });

      console.info(
        '[api/search] query=%s category=%s source=catalog results=%d durationMs=%d',
        query || '(blank)',
        category || fastIntent.category,
        affiliateWrappedProducts.length,
        Date.now() - startedAt,
      );

      return NextResponse.json({ products: affiliateWrappedProducts, source: 'catalog', searchMode });
    }

    if (catalogOnlyMode) {
      return NextResponse.json(
        {
          products: [],
          source: 'catalog',
          searchMode,
          error: 'No catalog matches yet for that search. Try a brand or a simpler clothing term while we keep expanding Sylistly inventory.',
        },
        { status: 404 },
      );
    }

    // 3. Parse intent for live search fallback
    if (!liveSearchKey) {
      return NextResponse.json(
        { error: 'SEARCHAPI_KEY is required for hybrid live product search.', searchMode },
        { status: 500 },
      );
    }

    const intent = await parseSearchIntent(query, category);

    // 4. Search real inventory
    const candidates = await searchShopping(intent, query);

    // 5. Re-rank with Claude
    const rerankLimit = Math.min(6, candidates.length);
    const ranked = candidates.length > rerankLimit
      ? await rerankProducts(query, intent, candidates, rerankLimit)
      : candidates.slice(0, rerankLimit);

    // 6. Resolve direct retailer links for the strongest results only.
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

    // 7. Affiliate-wrap
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

    // 8. Fire-and-forget cache write
    cacheProducts(products).catch(() => {});
    searchResponseCache.set(cacheKey, {
      expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
      products,
      source: 'live',
    });

    return NextResponse.json({ products, source: 'live', searchMode });
  } catch (err) {
    console.error('[api/search]', err);
    const message =
      err instanceof Error ? err.message : 'Live search failed. Please try again.';
    if (/searchapi 429|serpapi 429/i.test(message)) {
      return NextResponse.json(
        {
          error: 'Live search is temporarily rate-limited. Please wait a moment and try again.',
          demoAvailable: isDev,
          searchMode,
        },
        { status: 429 },
      );
    }
    if (/searchapi 401|serpapi 401/i.test(message)) {
      return NextResponse.json(
        {
          error: 'The SearchAPI key was rejected. Double-check that SEARCHAPI_KEY is your regular API key, not an MCP URL or token.',
          searchMode,
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: message, searchMode },
      { status: 500 },
    );
  }
}
