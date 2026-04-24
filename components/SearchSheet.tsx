'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search as SearchIcon, LoaderCircle, Sparkles, Clock, TrendingUp } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useFit } from '@/store/fit';
import type { Category, Product } from '@/lib/types';

const SUGGESTIONS: Record<Category, string[]> = {
  hat: ['baseball cap', 'beanie', 'fedral', 'bucket hat', 'visor'],
  outer: ['puffer', 'denim jacket', 'trench coat', 'blazer', 'bomber'],
  top: ['hoodie', 'tee', 'crop top', 'tank', 'sweater'],
  bottom: ['baggy jeans', 'cargo pants', 'leggings', 'shorts', 'skirt'],
  shoes: ['air force 1', 'samba', 'dunks', 'jordan', 'heels'],
  bag: ['tote', 'crossbody', 'backpack', 'mini bag', 'messenger'],
  eyewear: ['aviator', 'wayfarer', 'cat eye', 'shield', 'round'],
  jewelry: ['chain', 'hoops', 'ring', 'bracelet', 'medallion'],
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  hat: 'Caps, beanies, visors',
  outer: 'Jackets, coats, blazers',
  top: 'Shirts, hoodies, tees',
  bottom: 'Pants, jeans, shorts',
  shoes: 'Sneakers, heels, boots',
  bag: 'Totes, backpacks, clutches',
  eyewear: 'Sunglasses, specs',
  jewelry: 'Chains, rings, earrings',
};

interface Props {
  open: boolean;
  category: Category | null;
  initialQuery?: string | null;
  onClose: () => void;
}

export function SearchSheet({ open, category, initialQuery, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const activeRequest = useRef<AbortController | null>(null);
  const setItem = useFit((s) => s.setItem);

  useEffect(() => {
    if (!open || !category) return;
    setQuery(initialQuery?.trim() || '');
    setResults([]);
    setError(null);
    setSearched(false);
    const saved = localStorage.getItem('sylistly-search-history');
    if (saved) {
      try { setHistory(JSON.parse(saved).slice(0, 5)); } catch {}
    }
  }, [open, category, initialQuery]);

  useEffect(() => {
    if (!open || !category || !initialQuery?.trim()) return;
    void runSearch(initialQuery);
  }, [open, category, initialQuery]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function runSearch(q: string = query) {
    if (!category) return;
    const trimmed = q.trim();

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    
    setLoading(true);
    setError(null);

    if (trimmed && !history.includes(trimmed)) {
      const newHistory = [trimmed, ...history].slice(0, 5);
      setHistory(newHistory);
      localStorage.setItem('sylistly-search-history', JSON.stringify(newHistory));
    }

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: trimmed, category }),
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        setResults([]);
        setError(typeof data.error === 'string' ? data.error : 'Search failed');
        return;
      }

      setResults(Array.isArray(data.products) ? data.products : []);
      setSearched(true);
    } catch (err) {
      if (controller.signal.aborted) return;
      setResults([]);
      setError(err instanceof Error && err.name === 'AbortError' ? 'Timeout' : 'Network error');
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) activeRequest.current = null;
      setLoading(false);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion);
    void runSearch(suggestion);
  }

  if (!open || !category) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
        className="absolute inset-x-0 bottom-0 z-50 max-h-[90%] rounded-t-3xl border-t border-hairline-2 bg-bg flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">{CATEGORY_DESCRIPTIONS[category]}</div>
            <h2 className="font-serif text-xl font-semibold capitalize mt-0.5">
              {category} <span className="text-accent italic">options</span>
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
            <X size={16} className="text-muted" />
          </button>
        </div>

        <form
          className="relative px-4 py-3"
          onSubmit={(e) => { e.preventDefault(); void runSearch(); }}
        >
          <div className="flex items-center gap-2">
            <SearchIcon size={16} className="text-muted ml-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand, style..."
              className="flex-1 rounded-xl border border-hairline bg-surface-2 py-2.5 px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-accent text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? <LoaderCircle size={16} className="animate-spin" /> : 'Search'}
            </button>
          </div>
        </form>

        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted shrink-0">Popular</span>
            {SUGGESTIONS[category].map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestionClick(s)}
                className="px-3 py-1.5 rounded-full bg-surface-2 border border-hairline text-xs text-muted capitalize shrink-0"
              >
                {s}
              </button>
            ))}
          </div>
          
          {history.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] uppercase tracking-widest text-muted shrink-0 flex items-center gap-1">
                <Clock size={10} /> Recent
              </span>
              {history.map((h) => (
                <button
                  key={h}
                  onClick={() => handleSuggestionClick(h)}
                  className="px-3 py-1.5 rounded-full bg-surface-1 border border-hairline text-xs text-muted capitalize shrink-0"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-surface-2 animate-pulse" />
                ))}
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-10 text-center"
              >
                <div className="text-red-400 text-sm mb-3">{error}</div>
                <button
                  onClick={() => void runSearch()}
                  className="px-4 py-2 rounded-full bg-surface-2 text-sm"
                >
                  Try again
                </button>
              </motion.div>
            ) : results.length === 0 && !searched ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-10 text-center"
              >
                <Sparkles className="w-10 h-10 text-accent mx-auto mb-3" />
                <div className="text-muted text-sm">Search or tap a suggestion above</div>
              </motion.div>
            ) : results.length === 0 ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-10 text-center"
              >
                <div className="text-muted text-sm">No results found</div>
                <div className="text-xs text-muted mt-1">Try different keywords</div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <div className="text-xs text-muted mb-2">{results.length} results</div>
                {results.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={() => {
                      setItem(category, p);
                      onClose();
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}