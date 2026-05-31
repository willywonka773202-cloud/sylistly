import { Sparkles } from 'lucide-react';
import { DiscoverLookCard, type DiscoverLookCardData } from '@/components/DiscoverLookCard';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
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

export default function DiscoverPage() {
  const looks = buildDiscoverLooks();

  return (
    <PlaceholderScreen
      eyebrow="Discover"
      title="Style"
      accent="library"
      description="Editorial outfit directions built from renderable Sylistly catalog products."
      maxWidthClassName="max-w-[680px]"
    >
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,#141311_0%,#0f0f0e_100%)] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[.18em] text-muted">Style library</div>
            <h2 className="mt-1 font-serif text-[22px] font-semibold text-[#fff5ee]">Editorial outfit previews</h2>
          </div>
        </div>

        <div className="mx-auto mt-6 grid w-full grid-cols-1 gap-8">
          {looks.map((look) => (
            <DiscoverLookCard key={look.id} look={look} />
          ))}
        </div>
      </section>
    </PlaceholderScreen>
  );
}
