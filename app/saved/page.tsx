'use client';
import { Bookmark, RotateCcw, Send, ShoppingBag, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
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
  const postFit = useSocialFeed((state) => state.postFit);
  const replaceItems = useFit((state) => state.replaceItems);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>('Saved fit');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const displayFits = fits
    .map((fit) => {
      const visualEntries = Object.entries(fit.items)
        .filter((entry): entry is [Category, Product] => isHighConfidenceRenderableProduct(entry[1]) && !failedImageIds.has(entry[1].id));
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
            <section key={fit.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#171512_0%,#0f0e0d_100%)] p-4 shadow-[0_18px_42px_rgba(0,0,0,.32)]">
              <div className="grid grid-cols-[1fr_128px] gap-3 min-[390px]:grid-cols-[1fr_144px]">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[#9a8a80]">
                    Saved locally
                    <Bookmark size={12} className="text-accent" />
                  </div>
                  <h2 className="mt-2 font-serif text-[24px] font-semibold leading-[1.03] text-[#fff5ee] min-[390px]:text-[26px]">{fit.title}</h2>
                  <p className="mt-2 text-[11px] uppercase tracking-[.14em] text-[#c8b8ae]">
                    {visualProducts.length} pieces - ${(visualProducts.reduce((sum, product) => sum + product.priceCents, 0) / 100).toLocaleString()}
                  </p>
                  <p className="mt-2 text-[11px] text-[#9f9087]">{formatDate(fit.createdAt)}</p>
                </div>

                <div className="grid h-[128px] grid-cols-2 grid-rows-2 gap-2 min-[390px]:h-[144px]">
                  {visualProducts.slice(0,4).map((product) => (
                    <div
                      key={`${fit.id}-${product.id}`}
                      className="overflow-hidden rounded-[12px] border border-[#e9ddd3] bg-[#faf6f1] shadow-[0_8px_16px_rgba(0,0,0,.14)]"
                    >
                      <ProductImage
                        product={product}
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-1.5"
                        onUnavailable={(failedProduct) => {
                          setFailedImageIds((current) => new Set(current).add(failedProduct.id));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    replaceItems(visualItems);
                    router.push('/build');
                  }}
                  className="inline-flex flex-[1.25] items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
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
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#d7c8bf] transition hover:border-accent hover:text-ink"
                >
                  <ShoppingBag size={13} />
                  Shop fit
                </button>
                <button
                  type="button"
                  onClick={() => postFit(visualItems, { title: fit.title, vibe: 'Saved', visibility: 'public' })}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#d7c8bf] transition hover:border-accent hover:text-ink"
                >
                  <Send size={13} />
                  Post
                </button>
                <button
                  type="button"
                  aria-label="Remove saved fit"
                  onClick={() => removeFit(fit.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#d7c8bf] transition hover:border-accent hover:text-ink"
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
