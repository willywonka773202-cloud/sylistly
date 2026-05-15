'use client';

import { ProductImage } from '@/components/ProductImage';
import {
  filterFeedRenderableProducts,
  hasHighCategoryConfidence,
  isFeedHeroCandidate,
  isRenderableProductForFeed,
  productImageQualityScore,
} from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

const BOARD_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

const SLOT_STYLES: Record<Category, string> = {
  outer: 'left-[4%] top-[14%] h-[38%] w-[33%] rotate-[-2deg]',
  top: 'left-[35%] top-[8%] h-[31%] w-[34%] rotate-[1deg]',
  bottom: 'left-[31%] top-[39%] h-[37%] w-[38%] rotate-[-1deg]',
  shoes: 'left-[26%] bottom-[3%] h-[18%] w-[47%] rotate-[1deg]',
  bag: 'right-[4%] top-[37%] h-[29%] w-[28%] rotate-[2deg]',
  hat: 'left-[5%] top-[3%] h-[18%] w-[28%] rotate-[-3deg]',
  eyewear: 'right-[4%] top-[7%] h-[18%] w-[28%] rotate-[3deg]',
  jewelry: 'right-[9%] bottom-[16%] h-[17%] w-[23%] rotate-[-2deg]',
};

const IMAGE_PADDING: Record<Category, string> = {
  outer: 'p-2',
  top: 'p-2',
  bottom: 'p-2',
  shoes: 'p-1.5',
  bag: 'p-2',
  hat: 'p-1.5',
  eyewear: 'p-2',
  jewelry: 'p-2.5',
};

const FEED_SUPPORT_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

type FeedLayoutVariant = 'hero-left' | 'hero-top' | 'sneaker-led';

type FeedContext = {
  formulaId?: string;
  formulaLabel?: string;
};

const SNEAKER_LED_FORMULAS = new Set([
  'streetwear-sneaker-led',
  'campus-cozy',
  'gym-training',
  'techwear-utility',
]);

const HERO_TOP_FORMULAS = new Set([
  'vacation-resort',
  'travel-airport',
  'date-polished',
  'night-out',
]);

export function outfitBoardProducts(items: Partial<Record<Category, Product>> | Product[]): Product[] {
  const products = Array.isArray(items) ? items : BOARD_ORDER.map((category) => items[category]).filter(Boolean);
  return filterFeedRenderableProducts(products.filter((product): product is Product => Boolean(product)));
}

export function OutfitBoard({
  items,
  className = '',
  onImageUnavailable,
  variant = 'builder',
  feedContext,
}: {
  items: Partial<Record<Category, Product>> | Product[];
  className?: string;
  onImageUnavailable?: (product: Product) => void;
  variant?: 'builder' | 'feed';
  feedContext?: FeedContext;
}) {
  const products = outfitBoardProducts(items);
  const byCategory = new Map(products.map((product) => [product.category, product]));
  const visibleSlots = BOARD_ORDER.filter((category) => byCategory.has(category));

  if (visibleSlots.length < 3) return null;
  if (variant === 'feed') {
    return (
      <FeedOutfitBoard
        products={products}
        byCategory={byCategory}
        className={className}
        onImageUnavailable={onImageUnavailable}
        feedContext={feedContext}
      />
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-[32px] border border-[#eadfd5] bg-[radial-gradient(circle_at_30%_18%,#fffdf8_0%,#fff7ec_45%,#f2e4d7_100%)] shadow-[0_28px_70px_rgba(0,0,0,.38)] ${className}`}>
      <div className="absolute inset-3 rounded-[26px] border border-[#eadfd5]/80 bg-white/24" />
      <div className="absolute left-5 top-5 text-[8px] font-bold uppercase tracking-[.22em] text-[#9a7460]">Outfit formula</div>
      {visibleSlots.map((category) => {
        const product = byCategory.get(category);
        if (!product) return null;
        return (
          <div
            key={`${category}-${product.id}`}
            className={`absolute overflow-hidden rounded-[22px] bg-white/58 shadow-[0_16px_28px_rgba(99,68,45,.13)] ring-1 ring-[#eadfd5]/80 backdrop-blur-sm ${SLOT_STYLES[category]}`}
          >
            <ProductImage
              product={product}
              wrapperClassName="h-full w-full"
              className={`h-full w-full object-contain ${IMAGE_PADDING[category]}`}
              onUnavailable={onImageUnavailable}
            />
          </div>
        );
      })}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent_0%,rgba(236,219,203,.42)_100%)]" />
    </div>
  );
}

function isSneakerLedFormula(formulaId?: string): boolean {
  if (!formulaId) return false;
  return SNEAKER_LED_FORMULAS.has(formulaId);
}

function isHeroTopFormula(formulaId?: string): boolean {
  if (!formulaId) return false;
  return HERO_TOP_FORMULAS.has(formulaId);
}

function pickFeedLayoutVariant(
  formulaId: string | undefined,
  byCategory: Map<Category, Product>,
  hero: Product | null,
): FeedLayoutVariant {
  if (hero?.category === 'shoes') return 'sneaker-led';
  if (isSneakerLedFormula(formulaId) && byCategory.has('shoes')) return 'sneaker-led';
  if (isHeroTopFormula(formulaId)) return 'hero-top';
  return 'hero-left';
}

function chooseFeedHero(
  products: Product[],
  byCategory: Map<Category, Product>,
  context: FeedContext | undefined,
): Product | null {
  const sneakerLed = isSneakerLedFormula(context?.formulaId);
  // Sneaker-led formulas: shoes can lead the visual frame when the shoe
  // is a strong, high-confidence product. Without this, every gym /
  // streetwear / techwear card falls back to outer/top hero and the
  // formula's intent is invisible.
  if (sneakerLed) {
    const shoes = byCategory.get('shoes');
    if (shoes && isRenderableProductForFeed(shoes) && hasHighCategoryConfidence(shoes, 'shoes')) {
      return shoes;
    }
  }

  for (const category of ['outer', 'top', 'bottom'] as const) {
    const product = byCategory.get(category);
    if (product && isFeedHeroCandidate(product)) return product;
  }

  // Quality-scored fallback over renderable, hero-eligible products only.
  // No unconditional final fallback — we'd rather return null and let the
  // board hide than show a weak hero.
  const scored = products
    .filter(isRenderableProductForFeed)
    .filter((product) => isFeedHeroCandidate(product) || (sneakerLed && product.category === 'shoes'))
    .map((product) => ({ product, score: productImageQualityScore(product) + heroCategoryBoost(product.category, sneakerLed) }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.product ?? null;
}

function heroCategoryBoost(category: Category, sneakerLed: boolean): number {
  if (sneakerLed && category === 'shoes') return 20;
  if (category === 'outer') return 18;
  if (category === 'top') return 14;
  if (category === 'bottom') return 6;
  return 0;
}

function FeedOutfitBoard({
  products,
  byCategory,
  className,
  onImageUnavailable,
  feedContext,
}: {
  products: Product[];
  byCategory: Map<Category, Product>;
  className: string;
  onImageUnavailable?: (product: Product) => void;
  feedContext?: FeedContext;
}) {
  const hero = chooseFeedHero(products, byCategory, feedContext);
  if (!hero) return null;

  const layoutVariant = pickFeedLayoutVariant(feedContext?.formulaId, byCategory, hero);

  const support = FEED_SUPPORT_ORDER
    .map((category) => byCategory.get(category))
    .filter((product): product is Product => Boolean(product))
    .filter((product) => product.id !== hero.id);

  if (support.length < 2) return null;

  if (layoutVariant === 'sneaker-led') {
    return (
      <FeedShellSneakerLed
        hero={hero}
        support={support}
        className={className}
        onImageUnavailable={onImageUnavailable}
      />
    );
  }
  if (layoutVariant === 'hero-top') {
    return (
      <FeedShellHeroTop
        hero={hero}
        support={support}
        className={className}
        onImageUnavailable={onImageUnavailable}
      />
    );
  }
  return (
    <FeedShellHeroLeft
      hero={hero}
      support={support}
      className={className}
      onImageUnavailable={onImageUnavailable}
    />
  );
}

function FeedFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[34px] border border-white/14 bg-[radial-gradient(circle_at_22%_15%,rgba(255,245,226,.35),transparent_32%),linear-gradient(135deg,#f7eee1_0%,#dcc9b8_48%,#9f8270_100%)] p-3 shadow-[0_32px_80px_rgba(0,0,0,.45)] ${className}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.36),transparent_36%,rgba(28,18,13,.18)_100%)]" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function HeroTile({
  product,
  onImageUnavailable,
}: {
  product: Product;
  onImageUnavailable?: (product: Product) => void;
}) {
  return (
    <article className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/48 bg-[#fffaf3]/82 shadow-[0_20px_42px_rgba(68,42,26,.18)]">
      <ProductImage
        product={product}
        loading="eager"
        wrapperClassName="h-full w-full"
        className="h-full w-full object-contain p-3"
        onUnavailable={onImageUnavailable}
      />
      <HeroBrandCaption product={product} />
    </article>
  );
}

function SupportTile({
  product,
  rotation = '',
  onImageUnavailable,
}: {
  product: Product;
  rotation?: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  return (
    <article
      className={`relative h-full w-full overflow-hidden rounded-[22px] border border-white/42 bg-[#fffaf3]/78 shadow-[0_14px_28px_rgba(68,42,26,.13)] ${rotation}`}
    >
      <ProductImage
        product={product}
        wrapperClassName="h-full w-full"
        className="h-full w-full object-contain p-2"
        onUnavailable={onImageUnavailable}
      />
    </article>
  );
}

function HeroBrandCaption({ product }: { product: Product }) {
  return (
    <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
      <div className="max-w-[78%] rounded-full bg-black/55 px-2.5 py-1 text-white shadow-[0_8px_18px_rgba(0,0,0,.22)] backdrop-blur-md">
        <div className="truncate text-[10px] font-semibold tracking-tight">{product.brand}</div>
      </div>
    </div>
  );
}

function FeedShellHeroLeft({
  hero,
  support,
  className,
  onImageUnavailable,
}: {
  hero: Product;
  support: Product[];
  className: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const supportTiles = support.slice(0, 4);
  const rotations = ['rotate-[.8deg]', 'rotate-[-1deg]', 'rotate-[-.5deg]', 'rotate-[1deg]'];
  return (
    <FeedFrame className={className}>
      <div className="grid h-full grid-cols-[1.18fr_.82fr] gap-2.5">
        <HeroTile product={hero} onImageUnavailable={onImageUnavailable} />
        <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-2">
          {supportTiles.map((product, index) => (
            <SupportTile
              key={`${product.category}-${product.id}`}
              product={product}
              rotation={rotations[index] || ''}
              onImageUnavailable={onImageUnavailable}
            />
          ))}
        </div>
      </div>
    </FeedFrame>
  );
}

function FeedShellHeroTop({
  hero,
  support,
  className,
  onImageUnavailable,
}: {
  hero: Product;
  support: Product[];
  className: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const supportTiles = support.slice(0, 4);
  const rotations = ['rotate-[.6deg]', 'rotate-[-.6deg]', 'rotate-[.4deg]', 'rotate-[-.4deg]'];
  return (
    <FeedFrame className={className}>
      <div className="grid h-full grid-rows-[1.4fr_.85fr] gap-2.5">
        <HeroTile product={hero} onImageUnavailable={onImageUnavailable} />
        <div className={`grid min-h-0 gap-2 ${supportTiles.length === 4 ? 'grid-cols-4' : supportTiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {supportTiles.map((product, index) => (
            <SupportTile
              key={`${product.category}-${product.id}`}
              product={product}
              rotation={rotations[index] || ''}
              onImageUnavailable={onImageUnavailable}
            />
          ))}
        </div>
      </div>
    </FeedFrame>
  );
}

function FeedShellSneakerLed({
  hero,
  support,
  className,
  onImageUnavailable,
}: {
  hero: Product;
  support: Product[];
  className: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  // Hero is intentionally the shoe (or whatever the chooser picked) and
  // sits large on the right. The left column stacks top + bottom / outer
  // so the shoe gets the editorial weight without losing the rest of the
  // outfit.
  const STACK_ORDER: Category[] = ['outer', 'top', 'bottom', 'bag', 'hat', 'eyewear', 'jewelry'];
  const stack = STACK_ORDER
    .map((category) => support.find((product) => product.category === category))
    .filter((product): product is Product => Boolean(product))
    .slice(0, 3);

  const overflow = support.filter((product) => !stack.includes(product) && product.id !== hero.id).slice(0, 2);

  return (
    <FeedFrame className={className}>
      <div className="grid h-full grid-cols-[.78fr_1.22fr] gap-2.5">
        <div className="grid min-h-0 grid-rows-3 gap-2">
          {stack.map((product, index) => (
            <SupportTile
              key={`${product.category}-${product.id}`}
              product={product}
              rotation={index === 0 ? 'rotate-[-1deg]' : index === 1 ? 'rotate-[.8deg]' : 'rotate-[-.6deg]'}
              onImageUnavailable={onImageUnavailable}
            />
          ))}
        </div>
        <div className="grid min-h-0 grid-rows-[1.6fr_.85fr] gap-2">
          <HeroTile product={hero} onImageUnavailable={onImageUnavailable} />
          {overflow.length ? (
            <div className={`grid min-h-0 gap-2 ${overflow.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {overflow.map((product, index) => (
                <SupportTile
                  key={`${product.category}-${product.id}`}
                  product={product}
                  rotation={index === 0 ? 'rotate-[.5deg]' : 'rotate-[-.5deg]'}
                  onImageUnavailable={onImageUnavailable}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </FeedFrame>
  );
}
