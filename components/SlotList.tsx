'use client';

import { type ComponentType, type MouseEvent, useState } from 'react';
import { ExternalLink, Footprints, Glasses, Hand, PackageSearch, RotateCcw, Shirt, ShoppingBag, Watch } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { CATEGORY_ORDER, type Category } from '@/lib/types';
import { hasUsableProductImage } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { useFit } from '@/store/fit';

const ICONS: Record<Category, ComponentType<{ size?: number }>> = {
  hat: PackageSearch,
  outer: Shirt,
  top: Shirt,
  bottom: Hand,
  shoes: Footprints,
  bag: ShoppingBag,
  eyewear: Glasses,
  jewelry: Watch,
};

const LABELS: Record<Category, string> = {
  hat: 'Hat',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

interface Props {
  onOpenSearch: (cat: Category) => void;
}

export function SlotList({ onOpenSearch }: Props) {
  const { items, removeItem } = useFit();
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  return (
    <div className="overflow-x-auto pb-1 scrollbar-hide">
      <div className="flex min-w-max gap-3">
        {CATEGORY_ORDER.map((cat) => {
          const p = items[cat];
          const renderableProduct = hasUsableProductImage(p) && !failedImageIds.has(p.id) ? p : null;
          const Icon = ICONS[cat];
          const shopUrl = renderableProduct ? getProductOutboundUrl(renderableProduct) : '';

          function openShop(event: MouseEvent) {
            event.stopPropagation();
            if (!shopUrl || shopUrl === '#') return;
            window.open(shopUrl, '_blank', 'noopener,noreferrer');
          }

          return (
            <article
              key={cat}
              className={`relative flex w-[214px] flex-none flex-col overflow-hidden rounded-[24px] border text-left transition ${
                renderableProduct
                  ? 'border-[#eadfd5] bg-[#f8f3ed] text-[#1b1714] shadow-[0_14px_30px_rgba(0,0,0,.24)]'
                  : 'border-[#eadfd5] bg-[#f8f3ed] text-[#1b1714] hover:border-accent/50'
              }`}
            >
              <div className="absolute left-3 top-3 z-10 rounded-full bg-[#6f675d] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white shadow-[0_8px_16px_rgba(0,0,0,.16)]">
                {LABELS[cat]}
              </div>
              <div className="absolute right-2.5 top-2.5 z-10">
                {renderableProduct ? (
                  <button
                    type="button"
                    aria-label={`Remove ${LABELS[cat]}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeItem(cat);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full bg-[#171412]/70 text-[16px] leading-none text-white transition hover:bg-accent"
                  >
                    x
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onOpenSearch(cat)}
                className={`flex h-[252px] items-center justify-center overflow-hidden ${
                renderableProduct ? 'bg-[linear-gradient(180deg,#fffdf9_0%,#efe5dc_100%)] ring-1 ring-[#eadfd5]' : 'bg-[#efe5dc]'
              }`}
              >
                {renderableProduct ? (
                  <ProductImage
                    product={renderableProduct}
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-contain p-4 drop-shadow-[0_18px_24px_rgba(0,0,0,.18)]"
                    onUnavailable={(failedProduct) => {
                      setFailedImageIds((current) => new Set(current).add(failedProduct.id));
                    }}
                  />
                ) : (
                  <div className="grid place-items-center text-[#8a7a70]">
                    <Icon size={22} />
                  </div>
                )}
              </button>

              <div className="flex min-h-[116px] flex-col bg-[#171412] p-3.5 text-white">
                {renderableProduct ? (
                  <>
                    <div className="truncate text-[9px] font-semibold uppercase tracking-[.16em] text-[#a89a90]">{renderableProduct.brand}</div>
                    <div className="mt-1 line-clamp-2 text-[15px] font-semibold leading-[1.12] text-[#fff6ef]">{renderableProduct.name}</div>
                    <div className="mt-2 font-serif text-[17px] font-semibold text-white">${(renderableProduct.priceCents / 100).toLocaleString()}</div>
                  </>
                ) : (
                  <>
                    <div className="text-[13px] font-semibold text-[#fff6ef]">Add {LABELS[cat].toLowerCase()}</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-[#b9aaa0]">Browse the catalog for this slot.</div>
                  </>
                )}

                <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => onOpenSearch(cat)}
                    className="inline-flex items-center justify-center gap-1 rounded-full bg-accent px-3 py-2 text-[10px] font-semibold uppercase tracking-[.12em] text-white shadow-[0_8px_16px_rgba(232,54,93,.28)]"
                  >
                    <RotateCcw size={12} />
                    {renderableProduct ? 'Swap' : 'Browse'}
                  </button>
                  <button
                    type="button"
                    onClick={openShop}
                    disabled={!renderableProduct || !shopUrl || shopUrl === '#'}
                    className="inline-flex items-center justify-center gap-1 rounded-full bg-white/[0.07] px-3 py-2 text-[10px] font-semibold uppercase tracking-[.12em] text-white transition hover:bg-white/[0.12] disabled:opacity-40"
                  >
                    <ExternalLink size={11} />
                    Shop
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
