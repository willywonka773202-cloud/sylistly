'use client';

import { ProductImage } from '@/components/ProductImage';
import { getProductImageQualityScore } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

const BOARD_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

const HERO_WEIGHT: Record<Category, number> = {
  outer: 34,
  top: 32,
  shoes: 30,
  bottom: 24,
  bag: 14,
  hat: 8,
  eyewear: 8,
  jewelry: 8,
};

const CATEGORY_LABEL: Record<Category, string> = {
  hat: 'Headwear',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

export function outfitBoardProducts(items: Partial<Record<Category, Product>> | Product[]): Product[] {
  const products = Array.isArray(items) ? items : BOARD_ORDER.map((category) => items[category]).filter(Boolean);
  return dedupeProducts(products.filter((product): product is Product => Boolean(product)));
}

function formatPrice(cents?: number) {
  if (!cents || cents <= 0) return null;
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

function pickHeroProduct(products: Product[]) {
  return products
    .map((product, index) => ({
      product,
      index,
      score: HERO_WEIGHT[product.category] + getProductImageQualityScore(product),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.product;
}

function pickSatelliteProducts(products: Product[], hero?: Product) {
  const withoutHero = products.filter((product) => product.id !== hero?.id);
  const byPriority = BOARD_ORDER
    .map((category) => withoutHero.find((product) => product.category === category))
    .filter((product): product is Product => Boolean(product));
  const remaining = withoutHero.filter((product) => !byPriority.some((picked) => picked.id === product.id));
  return [...byPriority, ...remaining].slice(0, 3);
}

export function OutfitBoard({
  items,
  className = '',
  onImageUnavailable,
  onProductClick,
}: {
  items: Partial<Record<Category, Product>> | Product[];
  className?: string;
  onImageUnavailable?: (product: Product) => void;
  onProductClick?: (product: Product) => void;
}) {
  const products = outfitBoardProducts(items);
  const hero = pickHeroProduct(products);
  const satellites = pickSatelliteProducts(products, hero);

  if (!hero) return null;

  return (
    <div className={`relative overflow-hidden rounded-[32px] border border-[#eadfd5] bg-[radial-gradient(circle_at_18%_12%,#fffdf8_0%,#fff7ec_40%,#ead8c9_100%)] shadow-[0_28px_70px_rgba(0,0,0,.38)] ${className}`}>
      <div className="absolute inset-3 rounded-[26px] border border-[#eadfd5]/80 bg-white/30" />
      <div className="absolute left-5 top-5 z-20 flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.22em] text-[#9a7460]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff4f9a]" />
        Editorial fit board
      </div>

      <div className="relative z-10 grid h-full min-h-0 grid-cols-[1.35fr_.85fr] gap-3 p-4 pt-10">
        <button
          type="button"
          onClick={() => onProductClick?.(hero)}
          className="group relative min-h-[240px] overflow-hidden rounded-[28px] bg-white/78 text-left shadow-[0_20px_40px_rgba(99,68,45,.16)] ring-1 ring-[#eadfd5]/90 transition duration-200 active:scale-[.99]"
        >
          <ProductImage
            product={hero}
            size="hero"
            loading="eager"
            wrapperClassName="h-full w-full"
            className="h-full w-full object-contain p-5 transition duration-300 group-active:scale-[.985]"
            onUnavailable={(failedProduct) => {
              onImageUnavailable?.(failedProduct);
            }}
          />
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(31,20,17,.64)_100%)] p-4 pt-12 text-white">
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-white/72">{CATEGORY_LABEL[hero.category]}</div>
            <div className="mt-1 line-clamp-1 text-[13px] font-black">{hero.brand}</div>
            <div className="line-clamp-1 text-[11px] text-white/78">{hero.name}</div>
          </div>
        </button>

        <div className="grid min-h-0 grid-rows-3 gap-3">
          {satellites.map((product) => (
            <button
              key={`${product.category}-${product.id}`}
              type="button"
              onClick={() => onProductClick?.(product)}
              className="group relative min-h-[82px] overflow-hidden rounded-[22px] bg-white/76 text-left shadow-[0_12px_24px_rgba(99,68,45,.11)] ring-1 ring-[#eadfd5]/85 transition duration-200 active:scale-[.985]"
            >
              <ProductImage
                product={product}
                size="lg"
                loading="eager"
                wrapperClassName="h-full w-full"
                className="h-full w-full object-contain p-3 transition duration-300 group-active:scale-[.985]"
                onUnavailable={(failedProduct) => {
                  onImageUnavailable?.(failedProduct);
                }}
              />
              <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-white/88 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-[#7c5e51] shadow-sm">
                {CATEGORY_LABEL[product.category]}
              </div>
              {formatPrice(product.priceCents) ? (
                <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-[#1c1618]/78 px-2 py-1 text-[9px] font-bold text-white">
                  {formatPrice(product.priceCents)}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-full bg-[#1c1618]/72 px-3 py-2 text-white shadow-[0_12px_32px_rgba(0,0,0,.22)] backdrop-blur-md">
        <span className="text-[9px] font-black uppercase tracking-[.18em] text-white/64">{products.length} catalog pieces</span>
        <span className="max-w-[54%] truncate text-[11px] font-black">{hero.name}</span>
      </div>
    </div>
  );
}
