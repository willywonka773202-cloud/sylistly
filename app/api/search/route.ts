import { NextRequest, NextResponse } from 'next/server';
import { parseSearchIntent, parseSearchIntentHeuristic, rerankProducts } from '@/lib/claude';
import { hydrateRetailerUrls, searchShopping } from '@/lib/serpapi';
import { wrapAffiliate } from '@/lib/affiliate';
import { cacheProducts } from '@/lib/products';
import { searchBrandCatalog } from '@/lib/brand-catalog';
import { getFeaturedCatalogProducts } from '@/lib/catalog';
import { searchPhotoCatalog } from '@/lib/photo-catalog';
import { mockSearch } from '@/lib/mock-products';
import { hasDirectRetailerUrl } from '@/lib/retailer-url';
import { filterRenderableProducts, hasUsableImageUrl, hasUsableProductImage } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import {
  applyFrameToIntent,
  normalizeSearchFrame,
  withFrameBias,
} from '@/lib/search-frame';
import type { GeneratorFrame } from '@/lib/vibes';

export const runtime = 'nodejs';
export const maxDuration = 20;

interface SearchBody {
  query: string;
  category?: Category;
  mode?: 'live' | 'demo';
  frame?: GeneratorFrame;
  priceMax?: number | null;
  priceMin?: number | null;
}

type SearchSource = 'catalog' | 'live';
type SearchMode = 'catalog-only' | 'catalog-preview' | 'hybrid';

const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_RESULT_LIMIT = 10;
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

function applyExplicitPriceBounds(
  products: Product[],
  priceMin?: number | null,
  priceMax?: number | null,
): Product[] {
  return products.filter((product) => {
    const price = product.priceCents || 0;
    if (priceMin && price < priceMin * 100) return false;
    if (priceMax && price > priceMax * 100) return false;
    return true;
  });
}

function imageLooksLikePlaceholder(imageUrl: string | undefined): boolean {
  return !hasUsableImageUrl(imageUrl);
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

function mergeCatalogCandidates(...groups: Product[][]): Product[] {
  const merged = new Map<string, Product>();

  for (const group of groups) {
    for (const product of group) {
      if (!merged.has(product.id)) {
        merged.set(product.id, product);
        continue;
      }

      const existing = merged.get(product.id)!;
      const existingLooksPlaceholder = imageLooksLikePlaceholder(existing.imageUrl);
      const nextLooksReal = !imageLooksLikePlaceholder(product.imageUrl);

      if (existingLooksPlaceholder && nextLooksReal) {
        merged.set(product.id, product);
      }
    }
  }

  return Array.from(merged.values());
}

function demoSearchResponse(category: Category | undefined, query: string, reason: string) {
  const products = filterRenderableProducts(mockSearch(category || 'top', query));
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
  const frame = normalizeSearchFrame(body.frame);
  const explicitPriceMax = typeof body.priceMax === 'number' ? body.priceMax : null;
  const explicitPriceMin = typeof body.priceMin === 'number' ? body.priceMin : null;
  const effectiveQuery = withFrameBias(query, category, frame);
  const cacheKey = `${frame}::${category || 'any'}::${query.trim().toLowerCase()}`;
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
      frame,
    });
  }
  if (cached) searchResponseCache.delete(cacheKey);

  const startedAt = Date.now();

  try {
    if (!query.trim() && category) {
      const featuredCatalogProducts = applyExplicitPriceBounds(
        getFeaturedCatalogProducts(SEARCH_RESULT_LIMIT * 2, category),
        explicitPriceMin,
        explicitPriceMax,
      ).filter(hasUsableProductImage).slice(0, SEARCH_RESULT_LIMIT).map((product) => ({
        ...product,
        affiliateUrl: wrapAffiliate(product.retailerUrl),
      }));

      return NextResponse.json({
        products: featuredCatalogProducts,
        source: 'catalog',
        catalogKind: 'featured',
        searchMode,
        frame,
      });
    }

    const fastIntent = applyFrameToIntent(
      parseSearchIntentHeuristic(effectiveQuery, category),
      frame,
    );
    fastIntent.priceMax = explicitPriceMax ?? fastIntent.priceMax ?? null;
    fastIntent.priceMin = explicitPriceMin ?? fastIntent.priceMin ?? null;
    const photoCatalogProducts = searchPhotoCatalog(fastIntent, effectiveQuery).map((product) => ({
      ...product,
      affiliateUrl: wrapAffiliate(product.retailerUrl),
    }));
    const useCatalogFirst =
      catalogOnlyMode ||
      (searchMode === 'hybrid' && shouldUseCatalogFirst(effectiveQuery, category, fastIntent.brand));
    const seededCatalogProducts = searchBrandCatalog(fastIntent, effectiveQuery).map((product) => ({
      ...product,
      affiliateUrl: wrapAffiliate(product.retailerUrl),
    }));
    const mergedCatalogProducts = applyExplicitPriceBounds(
      mergeCatalogCandidates(photoCatalogProducts, seededCatalogProducts),
      explicitPriceMin,
      explicitPriceMax,
    );

    if (mergedCatalogProducts.length && (useCatalogFirst || photoCatalogProducts.length > 0 || catalogOnlyMode)) {
      let catalogProducts = mergedCatalogProducts;

      if (!catalogOnlyMode && liveSearchKey && effectiveQuery.trim()) {
        try {
          const liveCandidates = await searchShopping(fastIntent, effectiveQuery);
          catalogProducts = enrichCatalogProductPhotos(catalogProducts, liveCandidates);
        } catch (error) {
          console.warn('[api/search] catalog photo enrichment failed for "%s": %s', query, String(error));
        }
      }

      const rankedCatalogProducts = filterRenderableProducts(await rerankProducts(
        effectiveQuery || fastIntent.category,
        fastIntent,
        filterRenderableProducts(catalogProducts),
        Math.min(SEARCH_RESULT_LIMIT, catalogProducts.length),
      ));

      cacheProducts(rankedCatalogProducts).catch(() => {});
      searchResponseCache.set(cacheKey, {
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        products: rankedCatalogProducts,
        source: 'catalog',
      });

      console.info(
        '[api/search] query=%s category=%s frame=%s source=%s results=%d durationMs=%d',
        query || '(blank)',
        category || fastIntent.category,
        frame,
        photoCatalogProducts.length ? 'catalog_blend' : 'catalog',
        rankedCatalogProducts.length,
        Date.now() - startedAt,
      );

      return NextResponse.json({
        products: rankedCatalogProducts,
        source: 'catalog',
        catalogKind: photoCatalogProducts.length ? 'blend' : 'starter',
        searchMode,
        frame,
      });
    }

    if (catalogOnlyMode) {
      return NextResponse.json(
        {
          products: [],
          source: 'catalog',
          searchMode,
          frame,
          error: 'No catalog matches yet for that search. Try Browse, a brand, or a simpler clothing term while we keep expanding Sylistly inventory.',
        },
        { status: 404 },
      );
    }

    let liveSearchError: unknown = null;

    if (liveSearchKey) {
      try {
        const intent = applyFrameToIntent(
          await parseSearchIntent(effectiveQuery, category),
          frame,
        );
        intent.priceMax = explicitPriceMax ?? intent.priceMax ?? null;
        intent.priceMin = explicitPriceMin ?? intent.priceMin ?? null;

        const candidates = await searchShopping(intent, effectiveQuery);
        const filteredCandidates = applyExplicitPriceBounds(candidates, explicitPriceMin, explicitPriceMax);
        const rerankLimit = Math.min(SEARCH_RESULT_LIMIT, filteredCandidates.length);
        const ranked = filteredCandidates.length > rerankLimit
          ? await rerankProducts(effectiveQuery, intent, filteredCandidates, rerankLimit)
          : filteredCandidates.slice(0, rerankLimit);

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
        ).slice(0, SEARCH_RESULT_LIMIT);

        const products: Product[] = filterRenderableProducts(selected.map((p) => ({
          ...p,
          affiliateUrl: wrapAffiliate(p.retailerUrl),
        })));

        if (products.length) {
          console.info(
            '[api/search] query=%s category=%s frame=%s candidates=%d results=%d durationMs=%d',
            query || '(blank)',
            category || intent.category,
            frame,
            candidates.length,
            products.length,
            Date.now() - startedAt,
          );

          cacheProducts(products).catch(() => {});
          searchResponseCache.set(cacheKey, {
            expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
            products,
            source: 'live',
          });

          return NextResponse.json({ products, source: 'live', searchMode, frame });
        }
      } catch (error) {
        liveSearchError = error;
        if (searchMode === 'hybrid') throw error;
      }
    } else if (searchMode === 'hybrid') {
      return NextResponse.json(
        { error: 'SEARCHAPI_KEY is required for hybrid live product search.', searchMode, frame },
        { status: 500 },
      );
    }

    if (catalogPreviewMode) {
      const previewCatalogProducts = mergeCatalogCandidates(photoCatalogProducts, seededCatalogProducts);
      if (previewCatalogProducts.length) {
        const rankedPreviewProducts = filterRenderableProducts(await rerankProducts(
          effectiveQuery || fastIntent.category,
          fastIntent,
          filterRenderableProducts(previewCatalogProducts),
          Math.min(SEARCH_RESULT_LIMIT, previewCatalogProducts.length),
        ));

        cacheProducts(rankedPreviewProducts).catch(() => {});
        searchResponseCache.set(cacheKey, {
          expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
          products: rankedPreviewProducts,
          source: 'catalog',
        });

        console.info(
          '[api/search] query=%s category=%s frame=%s source=preview_catalog results=%d durationMs=%d',
          query || '(blank)',
          category || fastIntent.category,
          frame,
          rankedPreviewProducts.length,
          Date.now() - startedAt,
        );

        return NextResponse.json({
          products: rankedPreviewProducts,
          source: 'catalog',
          catalogKind: photoCatalogProducts.length ? 'blend' : 'starter',
          searchMode,
          frame,
        });
      }
    }

    if (liveSearchError) {
      throw liveSearchError;
    }

    return NextResponse.json(
      { error: 'No products found for that query yet.', searchMode, frame },
      { status: 404 },
    );
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
          frame,
        },
        { status: 429 },
      );
    }
    if (/searchapi 401|serpapi 401/i.test(message)) {
      return NextResponse.json(
        {
          error: 'The SearchAPI key was rejected. Double-check that SEARCHAPI_KEY is your regular API key, not an MCP URL or token.',
          searchMode,
          frame,
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: message, searchMode, frame },
      { status: 500 },
    );
  }
}
