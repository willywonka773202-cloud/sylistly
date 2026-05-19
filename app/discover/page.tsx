import { Sparkles } from 'lucide-react';
import { DiscoverRail } from '@/components/DiscoverRail';
import { DiscoverLookCard, type DiscoverLookCardData } from '@/components/DiscoverLookCard';
import { BottomNav } from '@/components/BottomNav';
import {
  ALL_CATALOG_PRODUCTS,
  buildCatalogLook,
  filterProductsByGender,
  getCollectionProducts,
  LAUNCH_COLLECTIONS,
  type CatalogCollection,
} from '@/lib/catalog';
import { frameCompatibilityScore, hasFrameMismatch } from '@/lib/frame-inference';
import { getDiscoverLookPreview } from '@/lib/discover-previews';
import { isRenderableProduct } from '@/lib/product-image-quality';
import { CATEGORY_ORDER, type Product } from '@/lib/types';
import type { GeneratorBudget, GeneratorFrame, VibeId } from '@/lib/vibes';
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
  if (
    (collection.frame === 'masc' || collection.frame === 'fem')
    && hasFrameMismatch(product, collection.frame)
  ) return false;

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
  if (
    (collection.frame === 'masc' || collection.frame === 'fem')
    && hasFrameMismatch(product, collection.frame)
  ) return -999;

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
  if (collection.frame !== 'all') score += frameCompatibilityScore(product, collection.frame);

  if (product.imageQuality === 'good') score += 12;
  if (product.metadata?.featured) score += 6;
  if (product.priceCents > 0) score += 3;

  return score;
}

function frameSafeProductsFor(collection: CatalogCollection): Product[] {
  return collection.frame === 'all'
    ? ALL_CATALOG_PRODUCTS
    : filterProductsByGender(ALL_CATALOG_PRODUCTS, collection.frame);
}

function recipeProductsFor(collection: CatalogCollection): Product[] {
  const recipe = DISCOVER_RECIPES.get(collection.id);
  if (!recipe) return [];

  const usedIds = new Set<string>();
  const selected: Product[] = [];
  const frameSafeProducts = frameSafeProductsFor(collection);

  for (const category of CATEGORY_ORDER) {
    const slotRecipe = recipe.slotRecipes[category];
    if (!slotRecipe) continue;
    const match = frameSafeProducts
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
    const replacement = frameSafeProductsFor(collection)
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
    for (const product of frameSafeProductsFor(collection).filter(isRenderableProduct)) {
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

const GENERATED_DISCOVER_SECTIONS: Array<{
  title: string;
  vibe: VibeId;
  frame: GeneratorFrame;
  budget: GeneratorBudget;
  tags: string[];
}> = [
  { title: 'Trending fits', vibe: 'streetwear', frame: 'androgynous', budget: 'under500', tags: ['trending', 'streetwear'] },
  { title: 'Under $150', vibe: 'clean', frame: 'androgynous', budget: 'under100', tags: ['budget', 'under 150'] },
  { title: 'Campus', vibe: 'campus', frame: 'androgynous', budget: 'under250', tags: ['campus', 'college'] },
  { title: 'Date night', vibe: 'date', frame: 'androgynous', budget: 'under500', tags: ['date night', 'dinner'] },
  { title: 'Gym', vibe: 'gym', frame: 'androgynous', budget: 'under250', tags: ['gym', 'athletic'] },
  { title: 'Old money', vibe: 'old-money', frame: 'androgynous', budget: 'under500', tags: ['old money', 'preppy'] },
  { title: 'Streetwear', vibe: 'streetwear', frame: 'masc', budget: 'under500', tags: ['streetwear', 'downtown'] },
  { title: 'Clean essentials', vibe: 'clean', frame: 'fem', budget: 'under250', tags: ['clean', 'minimal'] },
  { title: 'Travel', vibe: 'travel', frame: 'androgynous', budget: 'under250', tags: ['travel', 'airport'] },
  { title: 'Work', vibe: 'work', frame: 'androgynous', budget: 'under500', tags: ['work', 'office'] },
  { title: 'Vacation', vibe: 'vacation', frame: 'androgynous', budget: 'under500', tags: ['vacation', 'resort'] },
  { title: 'Techwear', vibe: 'techwear', frame: 'androgynous', budget: 'under500', tags: ['techwear', 'utility'] },
  { title: 'Budget finds', vibe: 'streetwear', frame: 'androgynous', budget: 'under100', tags: ['budget', 'affordable'] },
  { title: 'Premium splurge', vibe: 'premium', frame: 'androgynous', budget: 'any', tags: ['premium', 'luxury'] },
  { title: 'Closet ready', vibe: 'clean', frame: 'androgynous', budget: 'under250', tags: ['closet ready', 'capsule'] },
];

function buildGeneratedDiscoverSections() {
  const recentIds: string[] = [];

  return GENERATED_DISCOVER_SECTIONS.map((section, sectionIndex) => {
    const looks: DiscoverLookCardData[] = [];

    for (let index = 0; index < 4; index += 1) {
      const seed = 21_000 + sectionIndex * 997 + index * 131;
      const generated = buildCatalogLook({
        vibe: section.vibe,
        frame: index % 3 === 0 ? 'masc' : index % 3 === 1 ? 'fem' : section.frame,
        budget: section.budget,
        mode: 'full',
        seed,
        avoidProductIds: recentIds,
      });
      const products = CATEGORY_ORDER
        .map((category) => generated.products[category])
        .filter((product): product is Product => Boolean(product))
        .slice(0, 7);

      recentIds.unshift(...products.map((product) => product.id));
      recentIds.splice(120);

      if (products.length < 4) continue;

      looks.push({
        id: `generated-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
        title: `${section.title} ${index + 1}`,
        description: `Generated from the 709-product catalog with ${section.vibe} styling and budget-aware picks.`,
        vibe: section.vibe,
        frameBias: section.frame,
        products,
        estimatedTotal: products.reduce((sum, product) => sum + product.priceCents, 0),
        previewImageStatus: 'missing',
        tags: section.tags,
      });
    }

    return { title: section.title, looks };
  });
}

export default function DiscoverPage() {
  const looks = buildDiscoverLooks();
  const generatedSections = buildGeneratedDiscoverSections();
  const trendingLooks = looks.slice(0, 4);
  const budgetLooks = looks
    .filter((look) => look.estimatedTotal > 0 && look.estimatedTotal <= 35000)
    .slice(0, 4);
  const creatorLooks = looks
    .filter((look) => ['street', 'night', 'date', 'edgy'].includes(look.vibe))
    .slice(0, 4);
  const campusLooks = looks.filter((look) => look.tags.some((tag) => tag.toLowerCase().includes('campus') || tag.toLowerCase().includes('college'))).slice(0, 4);
  const workLooks = looks.filter((look) => ['office', 'work', 'preppy'].includes(look.vibe) || look.tags.some((tag) => tag.toLowerCase().includes('work'))).slice(0, 4);
  const travelLooks = looks.filter((look) => ['vacation', 'cozy'].includes(look.vibe) || look.tags.some((tag) => tag.toLowerCase().includes('travel') || tag.toLowerCase().includes('airport'))).slice(0, 4);
  const oldMoneyLooks = looks.filter((look) => look.tags.some((tag) => tag.toLowerCase().includes('old money') || tag.toLowerCase().includes('preppy'))).slice(0, 4);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <div className="flex-1 overflow-y-auto px-4 pb-[100px] pt-10">
        <header className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">Discover</div>
          <h1 className="mt-1 font-serif text-[32px] font-semibold text-ink">Style Library</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-2">Editorial outfit directions built from renderable Sylistly catalog products.</p>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(246,48,107,.14),transparent_32%),linear-gradient(180deg,#191513_0%,#0f0f0e_100%)] p-4 shadow-[0_22px_54px_rgba(0,0,0,.28)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[.18em] text-accent">Trend radar</div>
              <h2 className="mt-1 font-serif text-[24px] font-semibold leading-tight text-ink">Find a direction</h2>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['Trending', trendingLooks.length],
              ['Under $350', budgetLooks.length],
              ['Creator', creatorLooks.length],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-3 text-center">
                <div className="font-serif text-[20px] font-semibold text-ink">{value as number}</div>
                <div className="mt-1 text-[8px] uppercase tracking-[.15em] text-muted">{label as string}</div>
              </div>
            ))}
          </div>
        </section>

        <DiscoverRail title="Trending fits" looks={trendingLooks} />
        <DiscoverRail title="Budget-friendly finds" looks={budgetLooks} />
        <DiscoverRail title="Creator-ready looks" looks={creatorLooks} />
        <DiscoverRail title="Campus fits" looks={campusLooks} />
        <DiscoverRail title="Work and interview" looks={workLooks} />
        <DiscoverRail title="Travel capsule" looks={travelLooks} />
        <DiscoverRail title="Old money edits" looks={oldMoneyLooks} />
        {generatedSections.map((section) => (
          <DiscoverRail key={section.title} title={section.title} looks={section.looks} />
        ))}

        <section className="mt-8 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,#141311_0%,#0f0f0e_100%)] p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[.18em] text-muted">Curated Collections</div>
              <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">Editorial Previews</h2>
            </div>
          </div>

          <div className="mx-auto mt-6 grid w-full grid-cols-1 gap-8">
            {looks.map((look) => (
              <DiscoverLookCard key={look.id} look={look} />
            ))}
          </div>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}

