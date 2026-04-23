'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Search as SearchIcon } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useFit } from '@/store/fit';
import type { Category, Product } from '@/lib/types';
import {
  frameBiasDescription,
  frameDisplayLabel,
} from '@/lib/search-frame';
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

interface Props {
  open: boolean;
  category: Category | null;
  initialQuery?: string | null;
  frame?: GeneratorFrame;
  onClose: () => void;
}

export function SearchSheet({
  open,
  category,
  initialQuery,
  frame = 'androgynous',
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemoResults, setIsDemoResults] = useState(false);
  const [resultSource, setResultSource] = useState<'catalog' | 'live' | null>(null);
  const [catalogKind, setCatalogKind] = useState<'photo' | 'starter' | 'blend' | null>(null);
  const [searchMode, setSearchMode] = useState<'catalog-only' | 'catalog-preview' | 'hybrid' | null>(null);
  const [canUseDemo, setCanUseDemo] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const setItem = useFit((s) => s.setItem);
  const selectedItem = useFit((s) => (category ? s.items[category] : null));
  const demoSupported = process.env.NODE_ENV === 'development';
  const suggestions = category ? TRENDING[frame][category] : [];

  useEffect(() => {
    if (!open || !category) return;
    setQuery(initialQuery?.trim() || '');
    setResults(null);
    setError(null);
    setIsDemoResults(false);
    setResultSource(null);
    setCatalogKind(null);
    setSearchMode(null);
    setCanUseDemo(false);
  }, [open, category, initialQuery, frame]);

  useEffect(() => {
    if (!open || !category || !initialQuery?.trim()) return;
    void runSearch(initialQuery, category);
  }, [open, category, initialQuery, frame]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function runSearch(q: string, cat: Category, mode: 'live' | 'demo' = 'live') {
    const trimmed = q.trim();

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setLoading(true);
    setError(null);
    setCanUseDemo(false);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: trimmed, category: cat, mode, frame }),
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        setResults([]);
        setIsDemoResults(false);
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
        setCanUseDemo(Boolean(data.demoAvailable));
        setError(typeof data.error === 'string' ? data.error : 'Search failed.');
        return;
      }

      setIsDemoResults(Boolean(data.mock));
      setResultSource(data.source === 'catalog' ? 'catalog' : 'live');
      setCatalogKind(
        data.catalogKind === 'blend'
          ? 'blend'
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
      setResults(Array.isArray(data.products) ? data.products : []);
    } catch (error) {
      if (controller.signal.aborted && activeRequest.current !== controller) {
        return;
      }
      setResults([]);
      setIsDemoResults(false);
      setResultSource(null);
      setCatalogKind(null);
      setSearchMode(null);
      setCanUseDemo(false);
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
  }

  const resultLabel = loading
    ? `Finding ${isDemoResults ? 'demo' : resultSource === 'catalog' || searchMode === 'catalog-only' ? 'catalog' : 'live'} products...`
    : results?.length
    ? `${results.length} ${isDemoResults ? 'demo' : resultSource === 'catalog' ? 'catalog' : 'live'} picks`
    : searchMode === 'catalog-only'
    ? 'Search the Sylistly catalog'
    : searchMode === 'catalog-preview'
    ? 'Search the Sylistly preview catalog'
    : 'Search the Sylistly catalog';

  if (!open || !category) return null;

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 z-50 max-h-[92%] translate-y-0 rounded-t-3xl border-t border-hairline-2 bg-surface-1 flex flex-col shadow-[0_-18px_60px_rgba(0,0,0,.45)]">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2.5" />
            <div className="flex items-center justify-between px-5 pt-1.5 pb-2.5">
              <div className="font-serif font-semibold text-lg">
                Add <em className="italic text-accent">{category}</em>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-surface-3 grid place-items-center">
                <X size={14} className="text-muted-2" />
              </button>
            </div>

            <div className="px-4 pb-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-muted-2">
                <div>
                  <div className="font-semibold text-ink">
                    {frameDisplayLabel(frame)} search bias
                  </div>
                  <div className="mt-0.5">
                    {isDemoResults
                      ? 'Demo mode is on. These are local sample products for UI testing.'
                      : searchMode === 'catalog-only'
                      ? `${frameBiasDescription(frame)} Results come from the stored catalog so the site can run without live API costs.`
                      : searchMode === 'catalog-preview'
                      ? `${frameBiasDescription(frame)} Preview mode can use starter catalog items while the real photo catalog is built.`
                      : `${frameBiasDescription(frame)} Search by brand, color, or vibe, or browse featured inventory for this slot.`}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runSearch('', category)}
                    className="rounded-full border border-hairline-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-2 hover:border-accent hover:text-ink"
                  >
                    Browse
                  </button>
                  {demoSupported ? (
                    <button
                      type="button"
                      onClick={() => void runSearch(query, category, 'demo')}
                      className="rounded-full border border-hairline-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-2 hover:border-accent hover:text-ink"
                    >
                      Demo
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <form
              className="relative px-4 pb-2"
              onSubmit={(event) => {
                event.preventDefault();
                void runSearch(query, category);
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
                className="w-full rounded-2xl border border-hairline bg-surface-3 py-3 pl-10 pr-24 text-sm text-ink outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                Search
              </button>
            </form>

            <div className="flex gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-hide">
              {suggestions.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setQuery(c);
                    void runSearch(c, category);
                  }}
                  className="flex-none whitespace-nowrap rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-[11.5px] text-muted-2 hover:text-ink"
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 pb-2 text-[11px] text-muted">
              <span>{resultLabel}</span>
              {results?.length ? (
                <span>
                  {isDemoResults
                    ? 'Local sample data'
                    : resultSource === 'catalog'
                    ? catalogKind === 'blend'
                      ? 'Photo catalog + starter catalog'
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

            <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-4 pb-6">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex h-[136px] items-center gap-3 rounded-2xl border border-hairline bg-surface-2 px-3 animate-pulse">
                      <div className="h-[104px] w-[92px] rounded-2xl bg-surface-3" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-20 rounded-full bg-surface-3" />
                        <div className="h-4 w-full rounded-full bg-surface-3" />
                        <div className="h-4 w-3/4 rounded-full bg-surface-3" />
                        <div className="h-3 w-24 rounded-full bg-surface-3" />
                      </div>
                    </div>
                  ))
                : error
                ? (
                    <div className="col-span-2 py-10 text-center text-sm">
                      <div className="text-rose-300">{error}</div>
                      {canUseDemo ? (
                        <button
                          type="button"
                          onClick={() => void runSearch(query, category, 'demo')}
                          className="mt-4 rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-2 hover:border-accent hover:text-ink"
                        >
                          Use demo results
                        </button>
                      ) : null}
                    </div>
                  )
                : results === null
                ? <div className="col-span-2 py-10 text-center text-muted text-sm">Search when you are ready, or tap Browse to open featured Sylistly inventory for this slot.</div>
                : results.length === 0
                ? <div className="col-span-2 py-10 text-center text-muted text-sm">No matches. Try a brand, color, or vibe.</div>
                : results.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      selected={selectedItem?.id === p.id}
                      onClick={() => {
                        setItem(category, p);
                        onClose();
                      }}
                    />
                  ))}
            </div>
      </div>
    </>
  );
}
