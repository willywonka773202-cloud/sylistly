'use client';

import { ProductImage } from '@/components/ProductImage';
import { filterFeedRenderableProducts, isFeedHeroCandidate, productImageQualityScore } from '@/lib/product-image-quality';
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
const FEED_HERO_ORDER: Category[] = ['outer', 'top', 'bottom'];

const CATEGORY_LABEL: Record<Category, string> = {
  outer: 'Layer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  hat: 'Hat',
  eyewear: 'Shades',
  jewelry: 'Jewelry',
};

export function outfitBoardProducts(items: Partial<Record<Category, Product>> | Product[]): Product[] {
  const products = Array.isArray(items) ? items : BOARD_ORDER.map((category) => items[category]).filter(Boolean);
  return filterFeedRenderableProducts(products.filter((product): product is Product => Boolean(product)));
}

export function OutfitBoard({
  items,
  className = '',
  onImageUnavailable,
  variant = 'builder',
}: {
  items: Partial<Record<Category, Product>> | Product[];
  className?: string;
  onImageUnavailable?: (product: Product) => void;
  variant?: 'builder' | 'feed';
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

function FeedOutfitBoard({
  products,
  byCategory,
  className,
  onImageUnavailable,
}: {
  products: Product[];
  byCategory: Map<Category, Product>;
  className: string;
  onImageUnavailable?: (product: Product) => void;
}) {
  const hero = chooseFeedHero(products, byCategory);
  const support = FEED_SUPPORT_ORDER
    .map((category) => byCategory.get(category))
    .filter((product): product is Product => Boolean(product))
    .filter((product) => product.id !== hero?.id)
    .slice(0, 5);

  if (!hero || support.length < 2) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-[34px] border border-white/14 bg-[radial-gradient(circle_at_22%_15%,rgba(255,245,226,.35),transparent_32%),linear-gradient(135deg,#f7eee1_0%,#dcc9b8_48%,#9f8270_100%)] p-3 shadow-[0_32px_80px_rgba(0,0,0,.45)] ${className}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.36),transparent_36%,rgba(28,18,13,.18)_100%)]" />
      <div className="relative grid h-full grid-cols-[1.18fr_.82fr] grid-rows-[1fr_auto] gap-2.5">
        <article className="relative row-span-2 overflow-hidden rounded-[28px] border border-white/48 bg-[#fffaf3]/82 shadow-[0_20px_42px_rgba(68,42,26,.18)]">
          <ProductImage
            product={hero}
            loading="eager"
            wrapperClassName="h-full w-full"
            className="h-full w-full object-contain p-3"
            onUnavailable={onImageUnavailable}
          />
          <ProductBadge product={hero} prominent />
        </article>

        <div className="grid min-h-0 grid-cols-2 gap-2">
          {support.slice(0, 4).map((product, index) => (
            <article
              key={`${product.category}-${product.id}`}
              className={`relative overflow-hidden rounded-[22px] border border-white/42 bg-[#fffaf3]/78 shadow-[0_14px_28px_rgba(68,42,26,.13)] ${
                index === 0 ? 'rotate-[1deg]' : index === 1 ? 'rotate-[-1deg]' : index === 2 ? 'rotate-[-.5deg]' : 'rotate-[.8deg]'
              }`}
            >
              <ProductImage
                product={product}
                wrapperClassName="h-full w-full"
                className="h-full w-full object-contain p-2"
                onUnavailable={onImageUnavailable}
              />
              <ProductBadge product={product} />
            </article>
          ))}
        </div>

        {support[4] ? (
          <article className="relative min-h-[74px] overflow-hidden rounded-[24px] border border-white/42 bg-[#17120f]/72 shadow-[0_14px_32px_rgba(0,0,0,.22)]">
            <ProductImage
              product={support[4]}
              wrapperClassName="h-full w-full"
              className="h-full w-full object-contain p-2"
              onUnavailable={onImageUnavailable}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.42)_0%,transparent_70%)]" />
            <div className="absolute bottom-2 left-2 max-w-[78%] text-[9px] font-bold uppercase tracking-[.16em] text-white/86">
              {CATEGORY_LABEL[support[4].category]}
            </div>
          </article>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

function chooseFeedHero(products: Product[], byCategory: Map<Category, Product>): Product | null {
  for (const category of FEED_HERO_ORDER) {
    const product = byCategory.get(category);
    if (product && isFeedHeroCandidate(product)) return product;
  }

  const heroCandidates = products
    .filter(isFeedHeroCandidate)
    .map((product) => ({ product, score: productImageQualityScore(product) + heroCategoryBoost(product.category) }))
    .sort((left, right) => right.score - left.score);

  return heroCandidates[0]?.product || byCategory.get('top') || byCategory.get('outer') || byCategory.get('bottom') || products[0] || null;
}

function heroCategoryBoost(category: Category): number {
  if (category === 'outer') return 18;
  if (category === 'top') return 14;
  if (category === 'bottom') return 6;
  return 0;
}

function ProductBadge({ product, prominent = false }: { product: Product; prominent?: boolean }) {
  return (
    <div className={`absolute left-2 top-2 rounded-full border border-black/8 bg-white/82 px-2 py-1 text-[#3b2b24] shadow-[0_8px_18px_rgba(0,0,0,.08)] backdrop-blur-md ${prominent ? 'max-w-[82%]' : 'max-w-[78%]'}`}>
      <div className="truncate text-[8px] font-black uppercase tracking-[.16em]">
        {CATEGORY_LABEL[product.category]}
      </div>
      {prominent ? (
        <div className="mt-0.5 truncate text-[10px] font-semibold normal-case tracking-normal text-[#6d4d3d]">
          {product.brand}
        </div>
      ) : null}
    </div>
  );
}
