'use client';
import { Bookmark, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';

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

  return (
    <PlaceholderScreen
      eyebrow="Saved"
      title="Fits"
      accent="saved"
      description="Saved looks now persist on this MacBook, even before cloud sync is fully wired."
    >
      {fits.length ? (
        <div className="grid gap-3">
          {fits.map((fit) => (
            <section key={fit.id} className="rounded-3xl border border-hairline bg-surface-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[.18em] text-muted">Saved locally</div>
                  <h2 className="mt-2 font-serif text-[20px] font-semibold text-ink">{fit.title}</h2>
                  <p className="mt-2 text-[12px] text-muted-2">
                    {fit.itemCount} piece{fit.itemCount !== 1 ? 's' : ''} - ${(fit.totalCents / 100).toLocaleString()} - {formatDate(fit.createdAt)}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <Bookmark size={18} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(fit.items).map(([category, product]) => (
                  <span
                    key={`${fit.id}-${category}`}
                    className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[11px] text-muted-2"
                  >
                    {category}: {product?.brand}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    replaceItems(fit.items);
                    router.push('/');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white"
                >
                  <RotateCcw size={13} />
                  Load in builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const products = Object.values(fit.items)
                      .filter((product): product is NonNullable<typeof product> => Boolean(product))
                      .map((product) => ({
                        id: product.id,
                        brand: product.brand,
                        name: product.name,
                        retailer: product.retailer,
                        url: product.affiliateUrl || product.retailerUrl,
                        priceCents: product.priceCents,
                      }))
                      .filter((product) => Boolean(product.url));
                    setCheckoutTitle(fit.title);
                    setCheckoutProducts(products);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
                >
                  <ShoppingBag size={13} />
                  Shop fit
                </button>
                <button
                  type="button"
                  onClick={() => removeFit(fit.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
                >
                  <Trash2 size={13} />
                  Remove
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
