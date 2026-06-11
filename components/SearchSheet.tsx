'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, X, Search as SearchIcon } from 'lucide-react';
import { ProductImage } from './ProductImage';
import { useFit } from '@/store/fit';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import {
  frameBiasDescription,
  frameDisplayLabel,
} from '@/lib/search-frame';
import { hasUsableProductImage, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import type { GeneratorFrame } from '@/lib/vibes';

const TRENDING: Record<GeneratorFrame, Record<Category, string[]>> = {
  masc: {
    hat: ['fitted cap', 'beanie', 'dad hat', 'nike cap', 'carhartt beanie'],
    outer: ['bomber jacket', 'puffer jacket', 'carhartt jacket', 'overcoat', 'track jacket'],
    top: ['boxy tee', 'knit polo', 'hoodie', 'camp collar shirt', 'oversized tee'],
    bottom: ['relaxed trousers', 'cargo pants', 'baggy jeans', 'dickies pants', 'tailored shorts'],
    shoes: ['loafers', 'samba', 'new balance', 'boots', 'air force 1'],
    bag: ['crossbody bag', 'tote bag', 'sling bag', 'backpack', 'belt bag'],
    eyewear: ['wayfarer sunglasses', 'oakley shield', 'aviator', 'black sunglasses', 'warby parker'],
    jewelry: ['silver chain', 'watch', 'signet ring', 'bracelet', 'gold chain'],
  },
  fem: {
    hat: ['baseball cap', 'beanie', 'prada bucket', 'nike cap', 'trucker hat'],
    outer: ['puffer', 'denim jacket', 'trench', 'leather jacket', 'cardigan'],
    top: ['white crop top', 'fitted tank', 'corset top', 'basic tank', 'bodysuit'],
    bottom: ['baggy jeans', 'cargo pants', 'black skirt', 'wide leg trousers', 'leggings'],
    shoes: ['air force 1', 'samba', 'dr martens', 'new balance', 'heels'],
    bag: ['gucci bag', 'tote', 'telfar', 'bottega bag', 'mini bag'],
    eyewear: ['rayban', 'prada shield', 'oval sunglasses', 'aviator', 'black sunglasses'],
    jewelry: ['gold hoops', 'silver ring', 'mejuri', 'pearl necklace', 'tennis bracelet'],
  },
  androgynous: {
    hat: ['baseball cap', 'beanie', 'bucket hat', 'nike cap', 'new era'],
    outer: ['puffer jacket', 'denim jacket', 'trench', 'arcteryx', 'carhartt'],
    top: ['white tee', 'hoodie', 'tank top', 'button down', 'essentials'],
    bottom: ['baggy jeans', 'cargo pants', 'straight jeans', 'dickies', 'trousers'],
    shoes: ['air force 1', 'samba', 'dr martens', 'new balance', 'loafers'],
    bag: ['tote bag', 'crossbody bag', 'telfar', 'bottega bag', 'belt bag'],
    eyewear: ['rayban', 'oakley', 'prada shield', 'aviator', 'black sunglasses'],
    jewelry: ['gold chain', 'silver ring', 'watch', 'bracelet', 'pearl'],
  },
};

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Hat',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.body.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function formatPrice(priceCents: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString()}`;
}

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'retailer';
  }
}

function buildSimilarQuery(product: Product | null | undefined, category: Category, fallback: string): string {
  if (!product) return fallback;
  const words = [
    product.brand,
    product.name,
    ...(product.colors || []),
    ...(product.searchTerms || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['the', 'and', 'for', 'with', 'new', 'women', 'mens', 'men', 'size'].includes(word));

  const unique = Array.from(new Set(words)).slice(0, 5);
  return unique.length ? `${unique.join(' ')} ${category}` : fallback;
}

interface Props {
  open: boolean;
  category: Category | null;
  initialQuery?: string | null;
  frame?: GeneratorFrame;
  priceMax?: number | null;
  itemsOverride?: Partial<Record<Category, Product>>;
  onSelectProduct?: (category: Category, product: Product) => void;
  onClose: () => void;
}

export function SearchSheet({
  open,
  category,
  initialQuery,
  frame = 'androgynous',
  priceMax = null,
  itemsOverride,
  onSelectProduct,
  onClose,
}: Props) {
  useBodyScrollLock(open);
  const [activeCategory, setActiveCategory] = useState<Category | null>(category);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultSource, setResultSource] = useState<'catalog' | 'live' | null>(null);
  const [catalogKind, setCatalogKind] = useState<'database' | 'photo' | 'starter' | 'blend' | 'drops' | 'searchapi-quality' | null>(null);
  const [searchMode, setSearchMode] = useState<'catalog-only' | 'catalog-preview' | 'hybrid' | null>(null);
  const [readyImageIds, setReadyImageIds] = useState<Set<string>>(new Set());
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [searchPriceMax, setSearchPriceMax] = useState<number | null>(priceMax);
  const [customPriceInput, setCustomPriceInput] = useState(
    priceMax && ![100, 250, 500].includes(Math.round(priceMax)) ? String(Math.round(priceMax)) : '',
  );
  const activeRequest = useRef<AbortController | null>(null);
  const setItem = useFit((s) => s.setItem);
  const fitItems = useFit((s) => s.items);
  const displayItems = itemsOverride || fitItems;
  const selectedItem = activeCategory ? displayItems[activeCategory] : null;
  const currentCategory = activeCategory || category;
  const suggestions = currentCategory ? TRENDING[frame][currentCategory] : [];
  const currentCategoryRef = useRef<Category | null>(currentCategory);
  const queryRef = useRef(query);
  const hasResultsRef = useRef(results !== null);

  useEffect(() => {
    currentCategoryRef.current = currentCategory;
  }, [currentCategory]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    hasResultsRef.current = results !== null;
  }, [results]);

  const runSearch = useCallback(async (
    q: string,
    cat: Category,
    overridePriceMax?: number | null,
  ) => {
    const trimmed = q.trim();
    const effectivePriceMax = overridePriceMax === undefined ? searchPriceMax : overridePriceMax;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          category: cat,
          frame,
          priceMax: effectivePriceMax,
          transparentOnly: true,
          exactOnly: true,
        }),
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        setResults([]);
        setReadyImageIds(new Set());
        setFailedImageIds(new Set());
        setActiveResultIndex(0);
        setResultSource(null);
        setCatalogKind(null);
        setSearchMode(
          data.searchMode === 'hybrid'
            ? 'hybrid'
            : data.searchMode === 'catalog-only'
            ? 'catalog-only'
            : data.searchMode === 'catalog-preview'
            ? 'catalog-preview'
            : null,
        );
        setError(typeof data.error === 'string' ? data.error : 'Search failed.');
        return;
      }

      setReadyImageIds(new Set());
      setFailedImageIds(new Set());
      setActiveResultIndex(0);
      setResultSource(data.source === 'catalog' ? 'catalog' : 'live');
      setCatalogKind(
        data.catalogKind === 'blend'
          ? 'blend'
          : data.catalogKind === 'database'
          ? 'database'
          : data.catalogKind === 'drops'
          ? 'drops'
          : data.catalogKind === 'searchapi-quality'
          ? 'searchapi-quality'
          : data.catalogKind === 'photo'
          ? 'photo'
          : data.catalogKind === 'starter'
          ? 'starter'
          : null,
      );
      setSearchMode(
        data.searchMode === 'hybrid'
          ? 'hybrid'
          : data.searchMode === 'catalog-only'
          ? 'catalog-only'
          : data.searchMode === 'catalog-preview'
          ? 'catalog-preview'
          : null,
      );
      setResults(Array.isArray(data.products) ? sortTransparentFeedRenderableProducts(data.products) : []);
    } catch (error) {
      if (controller.signal.aborted && activeRequest.current !== controller) {
        return;
      }
      setResults([]);
      setReadyImageIds(new Set());
      setFailedImageIds(new Set());
      setActiveResultIndex(0);
      setResultSource(null);
      setCatalogKind(null);
      setSearchMode(null);
      setError(
        error instanceof Error && error.name === 'AbortError'
          ? 'Search timed out. Please try again.'
          : 'Network error. Please try again.',
      );
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) activeRequest.current = null;
      setLoading(false);
    }
  }, [frame, searchPriceMax]);

  useEffect(() => {
    if (!open || !category) return;
    const product = displayItems[category];
    const autoQuery = initialQuery?.trim() || buildSimilarQuery(product, category, TRENDING[frame][category][0] || '');
    setActiveCategory(category);
    setQuery(autoQuery);
    setResults(null);
    setError(null);
    setResultSource(null);
    setCatalogKind(null);
    setSearchMode(null);
    setReadyImageIds(new Set());
    setFailedImageIds(new Set());
    setActiveResultIndex(0);
    setSearchPriceMax(priceMax);
    setCustomPriceInput(
      priceMax && ![100, 250, 500].includes(Math.round(priceMax)) ? String(Math.round(priceMax)) : '',
    );
    void runSearch(autoQuery, category, priceMax);
  }, [category, displayItems, frame, initialQuery, open, priceMax, runSearch]);

  useEffect(() => {
    const activeCategoryRef = currentCategoryRef.current;
    if (!open || !activeCategoryRef || !hasResultsRef.current) return;
    void runSearch(queryRef.current, activeCategoryRef, searchPriceMax);
  }, [open, runSearch, searchPriceMax]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function chooseCategory(nextCategory: Category) {
    if (nextCategory === currentCategory) return;
    activeRequest.current?.abort();
    setActiveCategory(nextCategory);
    setQuery('');
    setResults(null);
    setError(null);
    setResultSource(null);
    setCatalogKind(null);
    setSearchMode(null);
    setReadyImageIds(new Set());
    setFailedImageIds(new Set());
    setActiveResultIndex(0);
  }

  const candidateResults = results
    ? sortTransparentFeedRenderableProducts(results).filter((product) => !failedImageIds.has(product.id))
    : results;
  const activeCandidate = candidateResults?.[activeResultIndex] || null;
  const activeImageReady = activeCandidate ? readyImageIds.has(activeCandidate.id) : false;
  const activePosition = activeCandidate ? activeResultIndex + 1 : 0;
  const resultLabel = loading
    ? 'Finding image-backed pieces...'
    : candidateResults?.length && activeCandidate
    ? `Option ${activePosition} of ${candidateResults.length}`
    : candidateResults?.length && activeResultIndex >= candidateResults.length
    ? 'You reviewed all options'
    : searchMode === 'catalog-only'
    ? 'Search the Sylistly catalog'
    : searchMode === 'catalog-preview'
    ? 'Search the Sylistly preview catalog'
    : 'Search the Sylistly catalog';

  useEffect(() => {
    if (!candidateResults?.length) return;
    if (activeResultIndex > candidateResults.length) {
      setActiveResultIndex(candidateResults.length);
    }
  }, [candidateResults?.length, activeResultIndex]);

  useEffect(() => {
    if (!activeCandidate || activeImageReady) return;
    const timer = window.setTimeout(() => {
      setFailedImageIds((current) => new Set(current).add(activeCandidate.id));
    }, 8_000);
    return () => window.clearTimeout(timer);
  }, [activeCandidate, activeImageReady]);

  function goToPreviousResult() {
    setActiveResultIndex((current) => Math.max(0, current - 1));
  }

  function goToNextResult() {
    setActiveResultIndex((current) => {
      const total = candidateResults?.length || 0;
      return Math.min(total, current + 1);
    });
  }

  function chooseActiveCandidate() {
    if (!activeCandidate || !currentCategory || !activeImageReady) return;
    if (onSelectProduct) {
      onSelectProduct(currentCategory, activeCandidate);
    } else {
      setItem(currentCategory, activeCandidate);
    }
    onClose();
  }

  function shopActiveCandidate() {
    if (!activeCandidate) return;
    const url = getProductOutboundUrl(activeCandidate);
    if (!url || url === '#') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!open || !category || !currentCategory) return null;
  const slotOrder = [currentCategory, ...CATEGORY_ORDER.filter((slot) => slot !== currentCategory)];

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 z-[80] mx-auto flex min-h-0 max-w-[480px] translate-y-0 flex-col overscroll-contain rounded-t-3xl border-t border-white/10 bg-[#11100f] pb-1 shadow-[0_-22px_70px_rgba(0,0,0,.55)]"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 8px)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-bottom) - 16px)',
        }}
      >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2.5" />
            <div className="flex items-center justify-between px-5 pb-1.5 pt-1">
              <div className="font-serif font-semibold text-lg">
                Add <em className="italic text-accent">{CATEGORY_LABELS[currentCategory]}</em>
              </div>
              <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-full bg-surface-3 grid place-items-center">
                <X size={14} className="text-muted-2" />
              </button>
            </div>

            <div className="px-4 pb-2">
              <div className="overflow-x-auto pb-1 scrollbar-hide">
                <div className="flex min-w-max gap-2">
                  {slotOrder.map((slot) => {
                    const product = displayItems[slot];
                    const active = slot === currentCategory;
                    const renderableProduct = hasUsableProductImage(product) && !failedImageIds.has(product.id) ? product : null;

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => chooseCategory(slot)}
                        className={`relative flex w-[96px] flex-none flex-col rounded-[16px] border p-1.5 text-left transition ${
                          active
                            ? 'border-accent/65 bg-[linear-gradient(180deg,rgba(255,45,109,.12),rgba(255,255,255,.04))] shadow-pink-glow'
                            : product
                            ? 'border-white/10 bg-white/[0.05]'
                            : 'border-white/8 bg-[#151311]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[9px] uppercase tracking-[.18em] text-[#a9998f]">{CATEGORY_LABELS[slot]}</div>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] uppercase tracking-[.14em] text-[#d7c8bf]">
                            {product ? 'Swap' : 'Browse'}
                          </span>
                        </div>
                        <div className={`mt-1 flex h-[42px] items-center justify-center overflow-hidden rounded-[12px] ${
                          renderableProduct ? 'bg-[linear-gradient(180deg,#fbfaf8_0%,#f2ebe5_100%)] ring-1 ring-[#efe4da]' : 'bg-white/[0.04]'
                        }`}>
                          {renderableProduct ? (
                            <ProductImage
                              product={renderableProduct}
                              transparentOnly
                              wrapperClassName="h-full w-full"
                              className="h-full w-full object-contain p-2"
                              onUnavailable={(failedProduct) => {
                                setFailedImageIds((current) => new Set(current).add(failedProduct.id));
                              }}
                            />
                          ) : (
                            <span className="text-[22px] leading-none text-[#7d7068]">+</span>
                          )}
                        </div>
                        <div className="mt-1 min-h-[20px]">
                          {renderableProduct ? (
                            <>
                              <div className="truncate text-[8px] uppercase tracking-[.12em] text-[#a9998f]">{renderableProduct.brand}</div>
                              <div className="truncate text-[9px] text-[#fff6f0]">{renderableProduct.name}</div>
                            </>
                          ) : (
                            <div className="text-[11px] leading-snug text-[#c8b9ae]">Search this slot</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-4 pb-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-muted-2">
                <div>
                  <div className="font-semibold text-ink">
                    {frameDisplayLabel(frame)} search bias
                  </div>
                  <div className="mt-0.5 line-clamp-1">
                    {searchMode === 'catalog-only'
                      ? `${frameBiasDescription(frame)} Results come from the stored catalog so the site can run without live API costs.`
                      : searchMode === 'catalog-preview'
                      ? `${frameBiasDescription(frame)} Preview mode only shows image-backed merchant pieces while the catalog keeps expanding.`
                      : `${frameBiasDescription(frame)} Search by brand, color, or vibe, or browse real merchant-backed inventory for this slot.`}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runSearch('', currentCategory)}
                    className="rounded-full border border-hairline-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-2 hover:border-accent hover:text-ink"
                  >
                    Browse
                  </button>
                </div>
              </div>
            </div>

            <form
              className="relative px-4 pb-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void runSearch(query, currentCategory);
              }}
            >
              <SearchIcon size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setError(null);
                }}
                placeholder={`try: ${suggestions[0]} or browse`}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-24 text-sm text-ink outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {[
                { label: 'Any', value: null },
                { label: '< $100', value: 100 },
                { label: '< $250', value: 250 },
                { label: '< $500', value: 500 },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setSearchPriceMax(option.value);
                    if (option.value !== null) setCustomPriceInput('');
                  }}
                  className={`flex-none whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    searchPriceMax === option.value
                      ? 'bg-accent text-white shadow-pink-glow'
                      : 'border border-hairline bg-surface-2 text-muted-2 hover:text-ink'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={customPriceInput}
                onChange={(event) => {
                  const cleaned = event.target.value.replace(/[^\d]/g, '').slice(0, 4);
                  setCustomPriceInput(cleaned);
                  setSearchPriceMax(cleaned ? Number(cleaned) : null);
                }}
                placeholder="Custom $"
                className="min-w-[96px] rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-[11px] text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-hide">
              {suggestions.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setQuery(c);
                    void runSearch(c, currentCategory);
                  }}
                  className="flex-none whitespace-nowrap rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-[11.5px] text-muted-2 hover:text-ink"
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 pb-1.5 text-[10px] text-muted">
              <span>{resultLabel}</span>
              {activeCandidate ? (
                <span>
                  {resultSource === 'catalog'
                    ? catalogKind === 'blend'
                      ? 'Photo catalog + starter catalog'
                      : catalogKind === 'database'
                      ? 'Merchant catalog'
                      : catalogKind === 'drops'
                      ? 'Drop catalog'
                      : catalogKind === 'searchapi-quality'
                      ? 'SearchAPI quality catalog'
                      : catalogKind === 'photo'
                      ? 'Real-photo catalog'
                      : searchMode === 'catalog-only'
                      ? 'Sylistly catalog'
                      : searchMode === 'catalog-preview'
                      ? 'Preview starter catalog'
                      : 'Starter brand catalog'
                    : 'Fastest clean links first'}
                </span>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-3">
              {loading
                ? (
                    <div className="grid min-h-[260px] place-items-center rounded-[28px] border border-white/10 bg-white/[0.03] text-center">
                      <div>
                        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
                        <div className="mt-4 font-serif text-lg text-ink">Finding image-backed pieces...</div>
                        <div className="mt-1 text-sm text-muted">Only real product photos will be shown.</div>
                      </div>
                    </div>
                  )
                : error
                ? (
                    <div className="py-10 text-center text-sm">
                      <div className="text-rose-300">{error}</div>
                    </div>
                  )
                : candidateResults === null
                ? <div className="py-10 text-center text-muted text-sm">Search when you are ready, or tap Browse to open featured Sylistly inventory for this slot.</div>
                : candidateResults.length === 0
                ? (
                    <div className="py-10 text-center text-sm">
                      <div className="text-ink">No image-backed products found for this search.</div>
                      <div className="mt-1 text-muted">Try a broader term or browse another slot.</div>
                    </div>
                  )
                : activeResultIndex >= candidateResults.length
                ? (
                    <div className="grid min-h-[260px] place-items-center rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-center">
                      <div>
                        <div className="font-serif text-2xl text-ink">You reviewed all options.</div>
                        <div className="mt-2 text-sm text-muted">Search again, reset the stack, or browse another slot.</div>
                        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveResultIndex(0);
                              setFailedImageIds(new Set());
                              setReadyImageIds(new Set());
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-ink"
                          >
                            <RotateCcw size={14} />
                            Reset options
                          </button>
                          <button
                            type="button"
                            onClick={() => void runSearch(query, currentCategory)}
                            className="rounded-full bg-accent px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-white shadow-pink-glow"
                          >
                            Search again
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                : (
                    <div className="relative">
                      {activeCandidate && !activeImageReady ? (
                        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden="true">
                          <ProductImage
                            product={activeCandidate}
                            transparentOnly
                            loading="eager"
                            wrapperClassName="h-px w-px overflow-hidden"
                            className="h-px w-px object-contain"
                            onAvailable={(product) => {
                              setReadyImageIds((current) => new Set(current).add(product.id));
                            }}
                            onUnavailable={(product) => {
                              setReadyImageIds((current) => {
                                const next = new Set(current);
                                next.delete(product.id);
                                return next;
                              });
                              setFailedImageIds((current) => new Set(current).add(product.id));
                            }}
                          />
                        </div>
                      ) : null}

                      {!activeCandidate || !activeImageReady ? (
                        <div className="grid min-h-[260px] place-items-center rounded-[28px] border border-white/10 bg-white/[0.03] text-center">
                          <div>
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
                            <div className="mt-4 font-serif text-lg text-ink">Preparing option...</div>
                            <div className="mt-1 text-sm text-muted">Checking the product photo before it appears.</div>
                          </div>
                        </div>
                      ) : (
                        <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[#171514] shadow-[0_24px_70px_rgba(0,0,0,.34)]">
                          <div className="relative m-2.5 overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#fffaf0_0%,#f0e4d6_100%)] ring-1 ring-[#efe4da]">
                            <div className="absolute left-3 top-3 z-10 rounded-full bg-[#181513]/80 px-3 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-white">
                              {CATEGORY_LABELS[activeCandidate.category]}
                            </div>
                            {selectedItem?.id === activeCandidate.id ? (
                              <div className="absolute right-3 top-3 z-10 rounded-full bg-accent px-3 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white">
                                Selected
                              </div>
                            ) : null}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.92),transparent_38%)]" />
                            <div className="absolute inset-x-12 bottom-5 h-6 rounded-full bg-[#c7b8aa]/42 blur-[11px]" />
                            <ProductImage
                              product={activeCandidate}
                              transparentOnly
                              wrapperClassName="relative h-[min(160px,23dvh)] min-[390px]:h-[min(180px,24dvh)] w-full"
                              className="relative h-full w-full object-contain p-4 drop-shadow-[0_15px_20px_rgba(0,0,0,.22)]"
                              onAvailable={(product) => {
                                setReadyImageIds((current) => new Set(current).add(product.id));
                              }}
                              onUnavailable={(product) => {
                                setReadyImageIds((current) => {
                                  const next = new Set(current);
                                  next.delete(product.id);
                                  return next;
                                });
                                setFailedImageIds((current) => new Set(current).add(product.id));
                              }}
                            />
                          </div>

                          <div className="px-4 pb-4 pt-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a9998f]">{activeCandidate.brand}</div>
                                <div className="mt-1 line-clamp-2 font-serif text-[18px] font-semibold leading-[1.08] text-ink">
                                  {activeCandidate.name}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                                  <span className="rounded-full border border-white/10 px-2.5 py-1">{formatPrice(activeCandidate.priceCents)}</span>
                                  <span className="rounded-full border border-white/10 px-2.5 py-1">{getHost(getProductOutboundUrl(activeCandidate))}</span>
                                </div>
                              </div>
                              <div className="flex flex-none items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-muted">
                                {activePosition}/{candidateResults.length}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-[1fr_1.25fr] gap-2">
                              <button
                                type="button"
                                onClick={goToNextResult}
                                className="rounded-full border border-white/15 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-ink"
                              >
                                Skip
                              </button>
                              <button
                                type="button"
                                onClick={chooseActiveCandidate}
                                className="rounded-full bg-accent px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-white shadow-pink-glow"
                              >
                                {selectedItem ? 'Swap' : 'Use this'}
                              </button>
                            </div>

                            <div className="mt-1.5 grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={goToPreviousResult}
                                disabled={activeResultIndex <= 0}
                                className="inline-flex items-center justify-center gap-1 rounded-full bg-white/[0.05] px-3 py-2 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2 disabled:opacity-35"
                              >
                                <ChevronLeft size={14} />
                                Prev
                              </button>
                              <button
                                type="button"
                                onClick={shopActiveCandidate}
                                className="inline-flex items-center justify-center gap-1 rounded-full bg-white/[0.05] px-3 py-2 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2"
                              >
                                Shop
                                <ExternalLink size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={goToNextResult}
                                disabled={activeResultIndex >= candidateResults.length}
                                className="inline-flex items-center justify-center gap-1 rounded-full bg-white/[0.05] px-3 py-2 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2 disabled:opacity-35"
                              >
                                Next
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        </article>
                      )}
                    </div>
                  )}
            </div>
      </div>
    </>
  );
}
