'use client';

import { useState } from 'react';
import { Check, Heart, ShoppingBag, Sparkles, Shirt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ProductImage';
import type { DiscoverLookCardData } from '@/components/DiscoverLookCard';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useWardrobe } from '@/store/wardrobe';

function productsToItems(products: Product[]): Partial<Record<Category, Product>> {
  const items: Partial<Record<Category, Product>> = {};

  for (const product of products) {
    if (!items[product.category]) items[product.category] = product;
  }

  return items;
}

function formatTotal(cents: number): string {
  if (!cents) return 'Price pending';
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

export function DiscoverRail({ title, looks }: { title: string; looks: DiscoverLookCardData[] }) {
  const router = useRouter();
  const replaceItems = useFit((state) => state.replaceItems);
  const setItemStatus = useWardrobe((state) => state.setItemStatus);
  const [toast, setToast] = useState<string | null>(null);

  if (!looks.length) return null;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function buildAround(look: DiscoverLookCardData) {
    const renderableProducts = look.products.filter(isRenderableProduct);
    const slots = renderableProducts.map((product) => product.category).join(',');
    replaceItems(productsToItems(renderableProducts));
    router.push(`/build?vibe=${look.vibe}&frame=${look.frameBias === 'all' ? 'androgynous' : look.frameBias}&slots=${encodeURIComponent(slots)}`);
  }

  function addLookToWardrobe(look: DiscoverLookCardData, status: 'owned' | 'wishlist') {
    const renderableProducts = look.products.filter(isRenderableProduct);
    renderableProducts.forEach((product) => setItemStatus(product, status));
    showToast(status === 'owned' ? 'Added pieces to closet' : 'Added pieces to wishlist');
  }

  function shopLook(look: DiscoverLookCardData) {
    const firstProduct = look.products.find(isRenderableProduct);
    if (!firstProduct) {
      showToast('No shoppable products in this look');
      return;
    }

    window.open(getProductOutboundUrl(firstProduct), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="relative mt-6">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-serif text-[20px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-muted">{looks.length} real catalog looks</p>
        </div>
      </div>

      <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {looks.map((look) => {
          const products = look.products.filter(isRenderableProduct);

          return (
            <article
              key={`${title}-${look.id}`}
              className="w-[196px] flex-none snap-start rounded-[24px] border border-white/10 bg-[#151311] p-3 shadow-[0_16px_34px_rgba(0,0,0,.24)] transition hover:-translate-y-0.5 active:scale-[.985]"
            >
              <button
                type="button"
                onClick={() => buildAround(look)}
                className="block w-full text-left"
                aria-label={`Build ${look.title}`}
              >
                <div className="grid h-[124px] grid-cols-2 gap-1.5 overflow-hidden rounded-[18px] border border-[#eadfd5] bg-[#fff7ef] p-1.5">
                  {products.slice(0, 4).map((product) => (
                    <div key={`${look.id}-${product.id}`} className="overflow-hidden rounded-xl bg-white/80">
                      <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 line-clamp-1 font-serif text-[17px] font-semibold text-ink">{look.title}</div>
              </button>

              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-muted">
                  {look.vibe}
                </span>
                <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-muted">
                  {products.length} pcs
                </span>
                <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-muted">
                  {formatTotal(look.estimatedTotal)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => addLookToWardrobe(look, 'wishlist')}
                  aria-label={`Wishlist ${look.title}`}
                  className="grid h-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-accent/60 hover:text-accent"
                >
                  <Heart size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => addLookToWardrobe(look, 'owned')}
                  aria-label={`Add ${look.title} to closet`}
                  className="grid h-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-accent/60 hover:text-accent"
                >
                  <Shirt size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => buildAround(look)}
                  aria-label={`Build around ${look.title}`}
                  className="grid h-9 place-items-center rounded-full bg-accent text-white shadow-pink-glow transition hover:bg-accent-hot"
                >
                  <Sparkles size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => shopLook(look)}
                  aria-label={`Shop ${look.title}`}
                  className="grid h-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-accent/60 hover:text-accent"
                >
                  <ShoppingBag size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {toast ? (
        <div className="pointer-events-none sticky bottom-[96px] z-20 mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-[#171311]/95 px-3 py-2 text-[11px] font-semibold text-white shadow-pink-glow backdrop-blur">
          <Check size={13} className="text-accent" />
          {toast}
        </div>
      ) : null}
    </section>
  );
}
