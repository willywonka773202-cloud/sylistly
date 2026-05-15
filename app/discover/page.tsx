'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Heart, Layers, ShoppingBag, Sparkles, Wand2 } from 'lucide-react';
import { DiscoverLookCard, type DiscoverLookCardData } from '@/components/DiscoverLookCard';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { ProductImage } from '@/components/ProductImage';
import {
  ALL_CATALOG_PRODUCTS,
  getCollectionProducts,
  LAUNCH_COLLECTIONS,
  type CatalogCollection,
} from '@/lib/catalog';
import { getDiscoverLookPreview } from '@/lib/discover-previews';
import { isRenderableProduct } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import recipeData from '@/data/discover-look-recipes.json';
import { useFit } from '@/store/fit';
import { useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

interface SlotRecipe {
  keywords?: string[];
  colors?: string[];
  avoidKeywords?: string[];
}

interface DiscoverLookRecipe {
  id: string;
  slotRecipes: Partial<Record<Product['category'], SlotRecipe>>;
}

interface FormulaRail {
  id: string;
  title: string;
  subtitle: string;
  formulaIds: string[];
  keywords: string[];
  categories?: Category[];
}

const DISCOVER_RECIPES = new Map(
  (recipeData as DiscoverLookRecipe[]).map((recipe) => [recipe.id, recipe]),
);

const FORMULA_RAILS: FormulaRail[] = [
  {
    id: 'clean-elevated',
    title: 'Clean elevated',
    subtitle: 'Quiet staples, polished layers, and sharp basics.',
    formulaIds: ['clean-elevated', 'old-money-knit'],
    keywords: ['clean', 'minimal', 'neutral', 'tailored', 'polo', 'trouser', 'blazer', 'loafer'],
  },
  {
    id: 'sneaker-led',
    title: 'Sneaker-led',
    subtitle: 'Fits that start with the shoe and keep the shape casual.',
    formulaIds: ['streetwear-sneaker-led', 'campus-cozy'],
    keywords: ['sneaker', 'samba', 'campus', 'air force', 'chuck', 'street', 'cargo', 'hoodie'],
  },
  {
    id: 'gym-training',
    title: 'Gym training',
    subtitle: 'Performance pieces that still read intentional.',
    formulaIds: ['gym-training'],
    keywords: ['gym', 'training', 'alo', 'adidas', 'track', 'shorts', 'woven', 'studio'],
  },
  {
    id: 'date-polished',
    title: 'Date polished',
    subtitle: 'Dinner-ready pieces with shine, structure, and better shoes.',
    formulaIds: ['date-polished', 'night-out'],
    keywords: ['date', 'night', 'black', 'leather', 'slingback', 'jewelry', 'dressy', 'tabby'],
  },
  {
    id: 'travel',
    title: 'Travel',
    subtitle: 'Airport and resort pieces that pack cleanly.',
    formulaIds: ['travel-airport', 'vacation-resort'],
    keywords: ['travel', 'airport', 'vacation', 'resort', 'linen', 'tote', 'sunglasses', 'shorts'],
  },
  {
    id: 'office',
    title: 'Office',
    subtitle: 'Workday pieces with real outfit range.',
    formulaIds: ['office-smart-casual'],
    keywords: ['office', 'workwear', 'tailored', 'suit', 'blazer', 'button', 'trouser', 'weekday'],
  },
];

const BASIC_KEYWORDS = [
  'white',
  'black',
  'tee',
  'tank',
  'polo',
  'button',
  'trouser',
  'jean',
  'sneaker',
  'loafer',
  'tote',
  'jacket',
];

function formatPrice(priceCents: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString()}`;
}

function productText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.retailer,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
    ...(product.colors || []),
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

  return looks.slice(0, 8);
}

function uniqueProducts(products: Product[], limit: number, excludedIds = new Set<string>()): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const product of products) {
    if (!isRenderableProduct(product)) continue;
    if (seen.has(product.id) || excludedIds.has(product.id)) continue;
    seen.add(product.id);
    out.push(product);
    if (out.length >= limit) break;
  }
  return out;
}

function scoreForKeywords(product: Product, keywords: string[], preferredCategories?: Category[]): number {
  const text = productText(product);
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) score += keyword.length > 5 ? 14 : 9;
  }
  if (preferredCategories?.includes(product.category)) score += 8;
  if (product.imageQuality === 'good') score += 8;
  if (product.metadata?.featured) score += 4;
  return score;
}

function itemsFromProduct(product: Product): Partial<Record<Category, Product>> {
  return { [product.category]: product } as Partial<Record<Category, Product>>;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const posts = useSocialFeed((state) => state.posts);
  const replaceItems = useFit((state) => state.replaceItems);
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const addToCloset = useWardrobe((state) => state.addToCloset);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);

  const wardrobeProductIds = useMemo(() => new Set(wardrobeItems.map((item) => item.productId)), [wardrobeItems]);
  const closetCategories = useMemo(
    () => new Set(wardrobeItems.filter((item) => item.status === 'closet').map((item) => item.product.category)),
    [wardrobeItems],
  );

  const feedProducts = useMemo(
    () => posts.flatMap((post) => Object.values(post.items).filter((product): product is Product => Boolean(product))),
    [posts],
  );

  const formulaRails = useMemo(() => {
    return FORMULA_RAILS.map((rail) => {
      const postProducts = posts
        .filter((post) => {
          const searchable = [post.formulaId, post.formulaLabel, post.formulaStructure, post.title, post.vibe, ...post.tags].join(' ').toLowerCase();
          return rail.formulaIds.some((id) => searchable.includes(id)) || rail.keywords.some((keyword) => searchable.includes(keyword));
        })
        .flatMap((post) => Object.values(post.items).filter((product): product is Product => Boolean(product)));

      const catalogProducts = ALL_CATALOG_PRODUCTS
        .filter(isRenderableProduct)
        .map((product) => ({ product, score: scoreForKeywords(product, rail.keywords, rail.categories) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.product);

      return {
        ...rail,
        products: uniqueProducts([...postProducts, ...catalogProducts], 12),
      };
    }).filter((rail) => rail.products.length > 0);
  }, [posts]);

  const basics = useMemo(() => {
    const scored = [...feedProducts, ...ALL_CATALOG_PRODUCTS]
      .filter(isRenderableProduct)
      .map((product) => ({ product, score: scoreForKeywords(product, BASIC_KEYWORDS, ['top', 'bottom', 'shoes', 'outer', 'bag']) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.product);
    return uniqueProducts(scored, 12, wardrobeProductIds);
  }, [feedProducts, wardrobeProductIds]);

  const gapProducts = useMemo(() => {
    const missing = CATEGORY_ORDER.filter((category) => !closetCategories.has(category));
    const suggestions = missing.flatMap((category) => {
      const fromFeed = feedProducts.filter((product) => product.category === category);
      const fromCatalog = ALL_CATALOG_PRODUCTS
        .filter((product) => product.category === category)
        .filter(isRenderableProduct)
        .sort((left, right) => {
          const leftScore = (left.imageQuality === 'good' ? 10 : 0) + (left.metadata?.featured ? 6 : 0) + (left.priceCents ? 2 : 0);
          const rightScore = (right.imageQuality === 'good' ? 10 : 0) + (right.metadata?.featured ? 6 : 0) + (right.priceCents ? 2 : 0);
          return rightScore - leftScore;
        });
      return uniqueProducts([...fromFeed, ...fromCatalog], 2, wardrobeProductIds);
    });
    return uniqueProducts(suggestions, 12, wardrobeProductIds);
  }, [closetCategories, feedProducts, wardrobeProductIds]);

  const looks = useMemo(() => buildDiscoverLooks(), []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function buildAround(product: Product) {
    replaceItems(itemsFromProduct(product));
    router.push(`/build?lock=${encodeURIComponent(product.category)}`);
  }

  function shop(product: Product) {
    const url = getProductOutboundUrl(product);
    if (!url || url === '#') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <PlaceholderScreen
      eyebrow="Discover"
      title="Style"
      accent="hub"
      description="Formula rails and closet-aware shopping suggestions built from real Sylistly products."
      maxWidthClassName="max-w-[680px]"
    >
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.18),transparent_38%),linear-gradient(180deg,#151412_0%,#0f0f0e_100%)] p-4 shadow-[0_22px_54px_rgba(0,0,0,.34)]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/14 text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[.2em] text-accent">Formula rails</div>
              <h2 className="mt-1 font-serif text-[22px] font-semibold leading-tight text-[#fff5ee]">Shop by outfit logic</h2>
            </div>
          </div>
          <p className="mt-3 max-w-[46ch] text-[12px] leading-relaxed text-muted-2">
            Rails use catalog-backed feed products and real catalog entries. No fake trend counts, sponsored blocks, or placeholder items.
          </p>
        </section>

        {formulaRails.map((rail) => (
          <ProductRail
            key={rail.id}
            title={rail.title}
            subtitle={rail.subtitle}
            products={rail.products}
            wardrobeProductIds={wardrobeProductIds}
            onWishlist={(product) => {
              addToWishlist(product, 'catalog');
              showToast('Added to wishlist');
            }}
            onCloset={(product) => {
              addToCloset(product, 'catalog');
              showToast('Added to closet');
            }}
            onBuild={buildAround}
            onShop={shop}
          />
        ))}

        <ProductRail
          title="Basics"
          subtitle="Renderable essentials not already in your closet or wishlist."
          products={basics}
          wardrobeProductIds={wardrobeProductIds}
          onWishlist={(product) => {
            addToWishlist(product, 'catalog');
            showToast('Added to wishlist');
          }}
          onCloset={(product) => {
            addToCloset(product, 'catalog');
            showToast('Added to closet');
          }}
          onBuild={buildAround}
          onShop={shop}
        />

        {gapProducts.length > 0 ? (
          <ProductRail
            title="Wardrobe gaps"
            subtitle="Missing closet categories with real product suggestions."
            products={gapProducts}
            wardrobeProductIds={wardrobeProductIds}
            onWishlist={(product) => {
              addToWishlist(product, 'catalog');
              showToast('Added to wishlist');
            }}
            onCloset={(product) => {
              addToCloset(product, 'catalog');
              showToast('Added to closet');
            }}
            onBuild={buildAround}
            onShop={shop}
          />
        ) : null}

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#141311_0%,#0f0f0e_100%)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[.2em] text-accent">Outfit cards</div>
              <h2 className="mt-1 font-serif text-[22px] font-semibold text-[#fff5ee]">Editorial previews</h2>
            </div>
            <Wand2 size={18} className="text-accent" />
          </div>
          <div className="mx-auto mt-6 grid w-full grid-cols-1 gap-8">
            {looks.map((look) => (
              <DiscoverLookCard key={look.id} look={look} />
            ))}
          </div>
        </section>
      </div>

      {toast ? (
        <div className="fixed inset-x-0 bottom-[86px] z-[70] mx-auto flex max-w-[480px] justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-accent/35 bg-[#15110f]/95 px-4 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-white shadow-[0_14px_42px_rgba(246,48,107,.35)] backdrop-blur-md">
            <Check size={13} className="text-accent" />
            {toast}
          </div>
        </div>
      ) : null}
    </PlaceholderScreen>
  );
}

function ProductRail({
  title,
  subtitle,
  products,
  wardrobeProductIds,
  onWishlist,
  onCloset,
  onBuild,
  onShop,
}: {
  title: string;
  subtitle: string;
  products: Product[];
  wardrobeProductIds: Set<string>;
  onWishlist: (product: Product) => void;
  onCloset: (product: Product) => void;
  onBuild: (product: Product) => void;
  onShop: (product: Product) => void;
}) {
  if (products.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-serif text-[21px] font-semibold leading-tight text-ink">{title}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-2">{subtitle}</p>
        </div>
        <ArrowRight size={15} className="mb-1 text-accent" />
      </div>
      <div className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
        {products.map((product) => (
          <DiscoverProductCard
            key={`${title}-${product.id}`}
            product={product}
            saved={wardrobeProductIds.has(product.id)}
            onWishlist={() => onWishlist(product)}
            onCloset={() => onCloset(product)}
            onBuild={() => onBuild(product)}
            onShop={() => onShop(product)}
          />
        ))}
      </div>
    </section>
  );
}

function DiscoverProductCard({
  product,
  saved,
  onWishlist,
  onCloset,
  onBuild,
  onShop,
}: {
  product: Product;
  saved: boolean;
  onWishlist: () => void;
  onCloset: () => void;
  onBuild: () => void;
  onShop: () => void;
}) {
  return (
    <article className="group w-[172px] flex-none overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.055] shadow-[0_16px_34px_rgba(0,0,0,.28)] transition active:scale-[0.98] hover:-translate-y-1 hover:border-accent/55 hover:shadow-[0_22px_46px_rgba(246,48,107,.24)] motion-safe:transition-all motion-safe:duration-200">
      <button
        type="button"
        onClick={onBuild}
        className="block w-full text-left"
        aria-label={`Build around ${product.name}`}
      >
        <div className="relative h-[168px] bg-[#fff7ef]">
          <ProductImage
            product={product}
            wrapperClassName="h-full w-full"
            className="h-full w-full object-contain p-3 drop-shadow-[0_16px_22px_rgba(0,0,0,.24)]"
          />
          <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[8px] font-black uppercase tracking-[.14em] text-white backdrop-blur-md">
            {product.category}
          </div>
          {saved ? (
            <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
              <Check size={13} />
            </div>
          ) : null}
        </div>
        <div className="p-3">
          <div className="truncate text-[9px] font-black uppercase tracking-[.17em] text-accent">{product.brand}</div>
          <div className="mt-1 line-clamp-2 min-h-[38px] font-serif text-[16px] font-semibold leading-[1.15] text-ink">
            {product.name}
          </div>
          <div className="mt-2 text-[12px] font-bold text-white">{formatPrice(product.priceCents)}</div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
        <button
          type="button"
          onClick={onWishlist}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-white transition active:scale-95 hover:border-accent/60"
        >
          <Heart size={11} />
          Wish
        </button>
        <button
          type="button"
          onClick={onCloset}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-white transition active:scale-95 hover:border-accent/60"
        >
          <Layers size={11} />
          Closet
        </button>
        <button
          type="button"
          onClick={onBuild}
          className="inline-flex items-center justify-center gap-1 rounded-full bg-accent px-2 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-95 hover:bg-accent-hot"
        >
          <Sparkles size={11} />
          Build
        </button>
        <button
          type="button"
          onClick={onShop}
          className="inline-flex items-center justify-center gap-1 rounded-full bg-white px-2 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-black transition active:scale-95 hover:bg-[#fff1e5]"
        >
          <ShoppingBag size={11} />
          Shop
        </button>
      </div>
    </article>
  );
}
