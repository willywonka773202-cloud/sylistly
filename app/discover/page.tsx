'use client';

import { Compass } from 'lucide-react';
import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { DiscoverLookCard, type DiscoverLookCardData } from '@/components/DiscoverLookCard';
import {
  ALL_CATALOG_PRODUCTS,
  getCollectionProducts,
  LAUNCH_COLLECTIONS,
  type CatalogCollection,
} from '@/lib/catalog';
import { getDiscoverLookPreview } from '@/lib/discover-previews';
import { isRenderableProduct } from '@/lib/product-image-quality';
import { CATEGORY_ORDER, type Product } from '@/lib/types';
import recipeData from '@/data/discover-look-recipes.json';

interface SlotRecipe {
  keywords?: string[];
  colors?: string[];
  avoidKeywords?: string[];
}

interface DiscoverLookRecipe {
  id: string;
  slotRecipes: Partial<Record<Product['category'], SlotRecipe>>;
}

const DISCOVER_RECIPES = new Map(
  (recipeData as DiscoverLookRecipe[]).map((recipe) => [recipe.id, recipe]),
);

const VIBE_FILTERS = ['All', 'Night', 'Street', 'Clean', 'Date', 'Office', 'Gym', 'Cozy', 'Vacation', 'Edgy', 'Preppy'];

function productText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
  ].join(' ').toLowerCase();
}

function productMatchesCollection(product: Product, collection: CatalogCollection): boolean {
  const text = productText(product);
  const frameMatches =
    collection.frame === 'all'
    || product.gender?.includes(collection.frame)
    || product.gender?.includes('androgynous')
    || !product.gender?.length;

  return frameMatches && (
    product.vibes?.includes(collection.vibe)
    || product.occasions?.includes(collection.vibe)
    || text.includes(collection.vibe)
    || text.includes(collection.queryHint)
  );
}

function hasTerm(text: string, term: string): boolean {
  return text.includes(term.toLowerCase());
}

function recipeScore(product: Product, collection: CatalogCollection, recipe: SlotRecipe): number {
  const text = productText(product);
  let score = 0;

  for (const keyword of recipe.keywords || []) {
    if (hasTerm(text, keyword)) score += keyword.length > 5 ? 16 : 10;
  }

  for (const color of recipe.colors || []) {
    if (product.colors?.some((entry) => entry.toLowerCase() === color.toLowerCase()) || hasTerm(text, color)) {
      score += 22;
    }
  }

  for (const avoid of recipe.avoidKeywords || []) {
    if (hasTerm(text, avoid)) score -= 60;
  }

  if (product.vibes?.includes(collection.vibe) || product.occasions?.includes(collection.vibe)) score += 12;
  if (collection.frame === 'all') score += 5;
  else if (product.gender?.includes(collection.frame)) score += 18;
  else if (product.gender?.includes('androgynous') || !product.gender?.length) score += 8;
  else score -= 40;

  if (product.imageQuality === 'good') score += 12;
  if (product.metadata?.featured) score += 6;
  if (product.priceCents > 0) score += 3;

  return score;
}

function recipeProductsFor(collection: CatalogCollection): Product[] {
  const recipe = DISCOVER_RECIPES.get(collection.id);
  if (!recipe) return [];

  const usedIds = new Set<string>();
  const selected: Product[] = [];

  for (const category of CATEGORY_ORDER) {
    const slotRecipe = recipe.slotRecipes[category];
    if (!slotRecipe) continue;
    const match = ALL_CATALOG_PRODUCTS
      .filter((product) => product.category === category)
      .filter(isRenderableProduct)
      .filter((product) => !usedIds.has(product.id))
      .map((product) => ({ product, score: recipeScore(product, collection, slotRecipe) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.product;

    if (!match) continue;
    usedIds.add(match.id);
    selected.push(match);
  }

  return selected;
}

function curatedProductsFor(collection: CatalogCollection): Product[] {
  const recipeProducts = recipeProductsFor(collection);
  if (recipeProducts.length >= 3) return recipeProducts.slice(0, 8);

  const seen = new Set<string>();
  const selected: Product[] = [];
  const addProduct = (product: Product) => {
    if (seen.has(product.id) || !isRenderableProduct(product)) return;
    seen.add(product.id);
    selected.push(product);
  };

  getCollectionProducts(collection).forEach(addProduct);

  for (const category of CATEGORY_ORDER) {
    if (selected.some((product) => product.category === category)) continue;
    const replacement = ALL_CATALOG_PRODUCTS
      .filter((product) => product.category === category)
      .filter((product) => productMatchesCollection(product, collection))
      .filter(isRenderableProduct)
      .sort((left, right) => {
        const leftScore = (left.imageQuality === 'good' ? 10 : 0) + (left.metadata?.featured ? 6 : 0) + (left.priceCents ? 2 : 0);
        const rightScore = (right.imageQuality === 'good' ? 10 : 0) + (right.metadata?.featured ? 6 : 0) + (right.priceCents ? 2 : 0);
        return rightScore - leftScore;
      })[0];
    if (replacement) addProduct(replacement);
    if (selected.length >= 6) break;
  }

  if (selected.length < 4) {
    for (const product of ALL_CATALOG_PRODUCTS.filter(isRenderableProduct)) {
      if (!productMatchesCollection(product, collection)) continue;
      addProduct(product);
      if (selected.length >= 6) break;
    }
  }

  return selected.slice(0, 6);
}

function buildDiscoverLooks(): DiscoverLookCardData[] {
  const looks = LAUNCH_COLLECTIONS
    .map((collection) => {
      const products = curatedProductsFor(collection);
      const preview = getDiscoverLookPreview(collection.id);
      const hasReadyPreview = preview.previewImageStatus === 'ready' && Boolean(preview.previewImageUrl);

      if (!hasReadyPreview && products.length < 4) return null;

      const look: DiscoverLookCardData = {
        id: collection.id,
        title: collection.label,
        description: collection.blurb,
        vibe: collection.vibe,
        frameBias: collection.frame,
        products,
        estimatedTotal: products.reduce((sum, product) => sum + product.priceCents, 0),
        previewImageStatus: preview.previewImageStatus,
        tags: preview.tags?.length ? preview.tags : [collection.vibe, collection.queryHint],
        ...(hasReadyPreview ? { previewImageUrl: preview.previewImageUrl } : {}),
      };

      return look;
    })
    .filter((look): look is DiscoverLookCardData => look !== null);

  return looks.slice(0, 20);
}

const ALL_LOOKS = buildDiscoverLooks();

export default function DiscoverPage() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredLooks = activeFilter === 'All'
    ? ALL_LOOKS
    : ALL_LOOKS.filter((look) =>
        look.vibe.toLowerCase().includes(activeFilter.toLowerCase()) ||
        look.title.toLowerCase().includes(activeFilter.toLowerCase()) ||
        look.tags.some((tag) => tag.toLowerCase().includes(activeFilter.toLowerCase())),
      );

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto pb-6 pt-[calc(env(safe-area-inset-top)+16px)]">

        {/* Page header */}
        <div className="flex items-center justify-between px-4 pb-4">
          <div>
            <div className="text-[9px] uppercase tracking-[.2em] text-accent">Discover</div>
            <h1 className="mt-0.5 font-serif text-[30px] font-semibold leading-none text-ink">
              Style <em className="italic text-accent">library</em>
            </h1>
            <p className="mt-1 text-[11px] text-muted">{filteredLooks.length} editorial look{filteredLooks.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-[18px] bg-accent/10 text-accent">
            <Compass size={20} />
          </div>
        </div>

        {/* Vibe filter chips */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-hide">
          {VIBE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`flex-none rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[.1em] transition ${
                activeFilter === filter
                  ? 'bg-accent text-white shadow-pink-glow'
                  : 'border border-white/10 bg-white/[0.04] text-muted-2 hover:border-accent/50 hover:text-ink'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Looks list */}
        {filteredLooks.length > 0 ? (
          <div className="flex flex-col gap-6 px-4">
            {filteredLooks.map((look) => (
              <DiscoverLookCard key={look.id} look={look} />
            ))}
          </div>
        ) : (
          <div className="mx-4 mt-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#161412_0%,#0d0c0b_100%)] p-7 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-accent/12 text-accent">
              <Compass size={22} />
            </div>
            <h2 className="mt-4 font-serif text-[22px] font-semibold text-ink">No looks for this vibe</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-2">Try another filter or browse all looks.</p>
            <button
              onClick={() => setActiveFilter('All')}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
            >
              Show all
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
