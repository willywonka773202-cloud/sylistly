'use client';
import { Bookmark, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function SavedPage() {
  const fits = useSavedFits((state) => state.fits);
  const removeFit = useSavedFits((state) => state.removeFit);
  const replaceItems = useFit((state) => state.replaceItems);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>('Saved fit');
  const router = useRouter();
  const displayFits = fits
    .map((fit) => {
      const visualEntries = Object.entries(fit.items)
        .filter((entry): entry is [Category, Product] => isRenderableProduct(entry[1]));
      const visualItems = Object.fromEntries(visualEntries) as Partial<Record<Category, Product>>;
      const visualProducts = visualEntries.map(([, product]) => product);

      return { fit, visualItems, visualProducts };
    })
    .filter(({ visualProducts }) => visualProducts.length > 0);

  return (
    <PlaceholderScreen
      eyebrow="Saved"
      title="Fits"
      accent="saved"
      description="Saved looks now persist on this MacBook, even before cloud sync is fully wired."
    >
      {displayFits.length ? (
        <div className="grid gap-4">
          {displayFits.map(({ fit, visualItems, visualProducts }) => (
            <section key={fit.id} className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#151311_0%,#0f0f0e_100%)] p-3.5 shadow-[0_14px_32px_rgba(0,0,0,.28)]">
              <div className="grid grid-cols-[1fr_168px] gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[#9a8a80]">
                    Saved locally
                    <Bookmark size={12} className="text-accent" />
                  </div>
                  <h2 className="mt-2 font-serif text-[24px] font-semibold leading-[1.04] text-[#fff5ee]">{fit.title}</h2>
                  <p className="mt-2 text-[11px] uppercase tracking-[.14em] text-[#c8b8ae]">
                    {visualProducts.length} pieces - ${(visualProducts.reduce((sum, product) => sum + product.priceCents, 0) / 100).toLocaleString()}
                  </p>
                  <p className="mt-2 text-[11px] text-[#9f9087]">{formatDate(fit.createdAt)}</p>
                </div>

                <div className="grid h-[132px] grid-cols-2 grid-rows-3 gap-1.5">
                  {visualProducts.slice(0,5).map((product, index) => (
                    <div
                      key={`${fit.id}-${product.id}`}
                      className={`overflow-hidden rounded-[10px] border border-[#e9ddd3] bg-[#faf6f1] ${index === 0 ? 'row-span-1' : ''}`}
                    >
                      <ProductImage product={product} className="h-full w-full object-contain p-1.5"/>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    replaceItems(visualItems);
                    router.push('/');
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
                >
                  <RotateCcw size={13} />
                  Load in builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const products = visualProducts
                      .map((product) => ({
                        id: product.id,
                        brand: product.brand,
                        name: product.name,
                        retailer: product.retailer,
                        url: getProductOutboundUrl(product),
                        priceCents: product.priceCents,
                      }))
                      .filter((product) => Boolean(product.url));
                    setCheckoutTitle(fit.title);
                    setCheckoutProducts(products);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[#d7c8bf] transition hover:border-accent hover:text-ink"
                >
                  <ShoppingBag size={13} />
                  Shop fit
                </button>
                <button
                  type="button"
                  aria-label="Remove saved fit"
                  onClick={() => removeFit(fit.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[#d7c8bf] transition hover:border-accent hover:text-ink"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="rounded-3xl border border-hairline bg-surface-1 p-5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Bookmark size={18} />
          </div>
          <h2 className="mt-4 font-serif text-[20px] font-semibold text-ink">No saved fits yet</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
            Save a look from the builder and it will show up here instantly on this MacBook, even before cloud storage is turned on.
          </p>
        </section>
      )}
      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </PlaceholderScreen>
  );
}
