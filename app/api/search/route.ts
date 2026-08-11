import { NextRequest, NextResponse } from 'next/server';
import catalogHealthData from '@/data/catalog-health.json';
import { aiBudgetAvailableGlobal } from '@/lib/ai-budget';
import { isProductPublishable, type CatalogHealthSnapshot } from '@/lib/catalog-publishability';
import { allowAiCall, clientKeyFromRequest } from '@/lib/rate-limit';
import { parseSearchIntent, parseSearchIntentHeuristic, rerankProducts } from '@/lib/claude';
import { hydrateRetailerUrls, searchShopping } from '@/lib/serpapi';
import { wrapAffiliate } from '@/lib/affiliate';
import { cacheProducts } from '@/lib/products';
import { searchDatabaseCatalog } from '@/lib/catalog-db';
import { searchBrandCatalog } from '@/lib/brand-catalog';
import { getFeaturedCatalogProducts } from '@/lib/catalog';
import { getStylistCatalogProducts } from '@/lib/stylist/catalog';
import { searchPhotoCatalog } from '@/lib/photo-catalog';
import { searchDropCatalog } from '@/lib/drop-catalog';
import { searchSearchApiQualityCatalog } from '@/lib/searchapi-quality-catalog';
import { hasDirectRetailerUrl } from '@/lib/retailer-url';
import { hasUsableImageUrl, sortRealCommerceFeedProducts, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
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
  frame?: GeneratorFrame;
  priceMax?: number | null;
  priceMin?: number | null;
  transparentOnly?: boolean;
  exactOnly?: boolean;
}

type SearchSource = 'catalog' | 'live';
type SearchMode = 'catalog-only' | 'catalog-preview' | 'hybrid';
type CatalogKind = 'database' | 'drops' | 'searchapi-quality' | 'photo' | 'blend' | 'starter';

const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_RESULT_LIMIT = 10;
const PUBLISHABILITY_OPTIONS = {
  health: catalogHealthData as CatalogHealthSnapshot,
  freshnessPolicy: 'require-fresh' as const,
};
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

function getSearchMode(): SearchMode {
  if (process.env.SEARCH_MODE === 'catalog-preview') return 'catalog-preview';
  return process.env.SEARCH_MODE === 'hybrid' ? 'hybrid' : 'catalog-only';
}

function realCommerceProducts(products: Product[], transparentOnly = false, exactOnly = transparentOnly): Product[] {
  const sortedProducts = transparentOnly ? sortTransparentFeedRenderableProducts(products) : sortRealCommerceFeedProducts(products);
  // Public search is a shopping surface, so explicit `exactOnly: false` no
  // longer bypasses stock/trust/PDP checks. Keep the argument for request/cache
  // compatibility while applying one publishability boundary to every source.
  void exactOnly;
  return sortedProducts.filter((product) => isProductPublishable(product, PUBLISHABILITY_OPTIONS));
}

function catalogKindFor({
  databaseCount,
  dropCount,
  searchApiQualityCount,
  photoCount,
}: {
  databaseCount: number;
  dropCount: number;
  searchApiQualityCount: number;
  photoCount: number;
}): CatalogKind {
  if (databaseCount) return 'database';
  if (dropCount) return 'drops';
  if (searchApiQualityCount) return 'searchapi-quality';
  if (photoCount) return 'photo';
  return 'starter';
}

export async function POST(req: NextRequest) {
  // Tolerate an empty/malformed body — a bad request should degrade to an empty
  // search, not throw a 500 (and spam the logs with "Unexpected end of JSON input").
  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    body = {} as SearchBody;
  }
  // Per-client rate limit + global daily cap: either tripping uses the free path.
  const allowAi = allowAiCall(clientKeyFromRequest(req)).allowed && (await aiBudgetAvailableGlobal());
  const query = (body.query || '').slice(0, 200);
  const category = body.category;
  const frame = normalizeSearchFrame(body.frame);
  const explicitPriceMax = typeof body.priceMax === 'number' ? body.priceMax : null;
  const explicitPriceMin = typeof body.priceMin === 'number' ? body.priceMin : null;
  const transparentOnly = Boolean(body.transparentOnly);
  const exactOnly = body.exactOnly !== undefined ? Boolean(body.exactOnly) : transparentOnly;
  const effectiveQuery = withFrameBias(query, category, frame);
  const cacheKey = `${transparentOnly ? 'cutout' : 'real'}::${exactOnly ? 'exact' : 'linked'}::${frame}::${category || 'any'}::${explicitPriceMin ?? 'min-any'}::${explicitPriceMax ?? 'max-any'}::${query.trim().toLowerCase()}`;
  const liveSearchKey = process.env.SEARCHAPI_KEY || process.env.SERPAPI_KEY;
  const searchMode = getSearchMode();
  const catalogOnlyMode = searchMode === 'catalog-only';
  const catalogPreviewMode = searchMode === 'catalog-preview';

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
      );
      const renderableFeaturedProducts = realCommerceProducts(featuredCatalogProducts, transparentOnly, exactOnly)
        .slice(0, SEARCH_RESULT_LIMIT)
        .map((product) => ({
        ...product,
        affiliateUrl: wrapAffiliate(product.retailerUrl, product.id),
      }));

      return NextResponse.json({
        products: renderableFeaturedProducts,
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
      affiliateUrl: wrapAffiliate(product.retailerUrl, product.id),
    }));
    const dropCatalogProducts = searchDropCatalog(fastIntent, effectiveQuery, SEARCH_RESULT_LIMIT * 3).map((product) => ({
      ...product,
      affiliateUrl: wrapAffiliate(product.retailerUrl, product.id),
    }));
    const searchApiQualityProducts = searchSearchApiQualityCatalog(fastIntent, effectiveQuery, SEARCH_RESULT_LIMIT * 4).map((product) => ({
      ...product,
      affiliateUrl: wrapAffiliate(product.retailerUrl, product.id),
    }));
    const databaseCatalogProducts = (await searchDatabaseCatalog(fastIntent, effectiveQuery, SEARCH_RESULT_LIMIT * 4)).map((product) => ({
      ...product,
      affiliateUrl: wrapAffiliate(product.retailerUrl, product.id),
    }));
    const useCatalogFirst =
      catalogOnlyMode ||
      (searchMode === 'hybrid' && shouldUseCatalogFirst(effectiveQuery, category, fastIntent.brand));
    const seededCatalogProducts = searchBrandCatalog(fastIntent, effectiveQuery).map((product) => ({
      ...product,
      affiliateUrl: wrapAffiliate(product.retailerUrl, product.id),
    }));
    const mergedCatalogProducts = applyExplicitPriceBounds(
      mergeCatalogCandidates(databaseCatalogProducts, dropCatalogProducts, searchApiQualityProducts, photoCatalogProducts, seededCatalogProducts),
      explicitPriceMin,
      explicitPriceMax,
    );
    const mergedRenderableProducts = realCommerceProducts(mergedCatalogProducts, transparentOnly, exactOnly);

    if (mergedRenderableProducts.length && (useCatalogFirst || dropCatalogProducts.length > 0 || searchApiQualityProducts.length > 0 || photoCatalogProducts.length > 0 || catalogOnlyMode)) {
      let catalogProducts = mergedCatalogProducts;

      if (!catalogOnlyMode && liveSearchKey && effectiveQuery.trim()) {
        try {
          const liveCandidates = await searchShopping(fastIntent, effectiveQuery);
          catalogProducts = enrichCatalogProductPhotos(catalogProducts, liveCandidates);
        } catch (error) {
          console.warn('[api/search] catalog photo enrichment failed for "%s": %s', query, String(error));
        }
      }

      const realCatalogProducts = realCommerceProducts(catalogProducts, transparentOnly, exactOnly);
      const rankedCatalogProducts = realCommerceProducts(await rerankProducts(
        effectiveQuery || fastIntent.category,
        fastIntent,
        realCatalogProducts,
        Math.min(SEARCH_RESULT_LIMIT, realCatalogProducts.length),
        allowAi,
      ), transparentOnly, exactOnly);

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
        catalogKind: catalogKindFor({
          databaseCount: databaseCatalogProducts.length,
          dropCount: dropCatalogProducts.length,
          searchApiQualityCount: searchApiQualityProducts.length,
          photoCount: photoCatalogProducts.length,
        }),
        searchMode,
        frame,
      });
    }

    const fallbackCategory = category || fastIntent.category;
    if (transparentOnly && fallbackCategory) {
      const stylistFallbackProducts = getStylistCatalogProducts()
        .filter((product) => product.category === fallbackCategory);
      const categoryFallbackProducts = realCommerceProducts(
        applyExplicitPriceBounds(
          mergeCatalogCandidates(
            stylistFallbackProducts,
            getFeaturedCatalogProducts(SEARCH_RESULT_LIMIT * 3, fallbackCategory),
          ),
          explicitPriceMin,
          explicitPriceMax,
        ),
        true,
        exactOnly,
      )
        .slice(0, SEARCH_RESULT_LIMIT)
        .map((product) => ({
          ...product,
          affiliateUrl: wrapAffiliate(product.retailerUrl, product.id),
        }));

      if (categoryFallbackProducts.length) {
        searchResponseCache.set(cacheKey, {
          expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
          products: categoryFallbackProducts,
          source: 'catalog',
        });

        return NextResponse.json({
          products: categoryFallbackProducts,
          source: 'catalog',
          catalogKind: 'cutout-category-fallback',
          searchMode,
          frame,
        });
      }
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
          await parseSearchIntent(effectiveQuery, category, allowAi),
          frame,
        );
        intent.priceMax = explicitPriceMax ?? intent.priceMax ?? null;
        intent.priceMin = explicitPriceMin ?? intent.priceMin ?? null;

        const candidates = await searchShopping(intent, effectiveQuery);
        const filteredCandidates = applyExplicitPriceBounds(candidates, explicitPriceMin, explicitPriceMax);
        const rerankLimit = Math.min(SEARCH_RESULT_LIMIT, filteredCandidates.length);
        const ranked = filteredCandidates.length > rerankLimit
          ? await rerankProducts(effectiveQuery, intent, filteredCandidates, rerankLimit, allowAi)
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

        const products: Product[] = realCommerceProducts(selected.map((p) => ({
          ...p,
          affiliateUrl: wrapAffiliate(p.retailerUrl, p.id),
        })), transparentOnly, exactOnly);

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
      const previewCatalogProducts = mergeCatalogCandidates(databaseCatalogProducts, dropCatalogProducts, searchApiQualityProducts, photoCatalogProducts, seededCatalogProducts);
      const realPreviewProducts = realCommerceProducts(previewCatalogProducts, transparentOnly, exactOnly);
      if (realPreviewProducts.length) {
        const rankedPreviewProducts = realCommerceProducts(await rerankProducts(
          effectiveQuery || fastIntent.category,
          fastIntent,
          realPreviewProducts,
          Math.min(SEARCH_RESULT_LIMIT, realPreviewProducts.length),
          allowAi,
        ), transparentOnly, exactOnly);

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
          catalogKind: catalogKindFor({
            databaseCount: databaseCatalogProducts.length,
            dropCount: dropCatalogProducts.length,
            searchApiQualityCount: searchApiQualityProducts.length,
            photoCount: photoCatalogProducts.length,
          }),
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
