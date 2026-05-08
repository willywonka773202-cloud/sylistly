'use client';
import { Bookmark, RotateCcw, Send, ShoppingBag, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useFit } from '@/store/fit';
import { type SavedFitRecord, useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { useWardrobe, WARDROBE_STATUS_LABELS } from '@/store/wardrobe';
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
  const wardrobeItems = useWardrobe((state) => state.items);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>('Saved fit');
  const [activeFit, setActiveFit] = useState<{
    fit: SavedFitRecord;
    visualItems: Partial<Record<Category, Product>>;
    visualProducts: Product[];
  } | null>(null);
  const router = useRouter();
  const displayFits = fits
    .map((fit) => {
      const visualEntries = Object.entries(fit.items)
        .filter((entry): entry is [Category, Product] => isHighConfidenceRenderableProduct(entry[1]));
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

                <button
                  type="button"
                  onClick={() => setActiveFit({ fit, visualItems, visualProducts })}
                  className="grid h-[128px] grid-cols-2 grid-rows-2 gap-2 rounded-[16px] text-left transition active:scale-[.98] min-[390px]:h-[144px]"
                  aria-label={`Open ${fit.title}`}
                >
                  {visualProducts.slice(0,4).map((product) => (
                    <div
                      key={`${fit.id}-${product.id}`}
                      className="overflow-hidden rounded-[12px] border border-[#e9ddd3] bg-[#faf6f1] shadow-[0_8px_16px_rgba(0,0,0,.14)]"
                    >
                      <ProductImage
                        product={product}
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-1.5"
                      />
                    </div>
                  ))}
                </button>
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
                  onClick={() => setActiveFit({ fit, visualItems, visualProducts })}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#d7c8bf] transition hover:border-accent hover:text-ink"
                >
                  View post
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
      {activeFit ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/70 backdrop-blur-sm">
          <button className="absolute inset-0" aria-label="Close saved fit" onClick={() => setActiveFit(null)} />
          <article className="relative z-10 max-h-[calc(100dvh-28px)] w-full overflow-y-auto rounded-t-[34px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-24px_70px_rgba(0,0,0,.55)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[.18em] text-accent">Saved outfit</div>
                <h2 className="mt-1 font-serif text-[28px] font-semibold leading-tight text-ink">{activeFit.fit.title}</h2>
                <p className="mt-1 text-[11px] text-muted-2">{formatDate(activeFit.fit.createdAt)}</p>
              </div>
              <button onClick={() => setActiveFit(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-[28px] border border-[#eadfd5] bg-[#fff7ef] p-2">
              <div className="grid h-[390px] grid-cols-2 grid-rows-3 gap-2 overflow-hidden rounded-[22px] bg-[#fffaf5] p-2">
                {activeFit.visualProducts.slice(0, 6).map((product, index) => (
                  <div key={`${activeFit.fit.id}-modal-${product.id}`} className={`overflow-hidden rounded-[16px] bg-white/80 ring-1 ring-[#eadfd5] ${index === 0 ? 'row-span-2' : ''}`}>
                    <ProductImage
                      product={product}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center">
                <div className="font-serif text-[20px] font-semibold text-ink">{activeFit.visualProducts.length}</div>
                <div className="mt-1 text-[8px] uppercase tracking-[.14em] text-muted">Pieces</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center">
                <div className="font-serif text-[20px] font-semibold text-ink">
                  ${(activeFit.visualProducts.reduce((sum, product) => sum + product.priceCents, 0) / 100).toLocaleString()}
                </div>
                <div className="mt-1 text-[8px] uppercase tracking-[.14em] text-muted">Total</div>
              </div>
              <div className="rounded-2xl border border-accent/25 bg-accent/10 px-2 py-3 text-center">
                <div className="font-serif text-[20px] font-semibold text-accent">Post</div>
                <div className="mt-1 text-[8px] uppercase tracking-[.14em] text-muted">Ready</div>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[.18em] text-muted">Pieces</div>
                  <div className="mt-1 text-[12px] text-muted-2">Owned pieces stay in rotation; suggested pieces are ready to shop.</div>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {activeFit.visualProducts.map((product) => {
                  const wardrobeEntry = wardrobeItems[product.id];
                  const shopUrl = getProductOutboundUrl(product);
                  return (
                    <div key={`detail-row-${product.id}`} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/14 p-2">
                      <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-[#fff7ef]">
                        <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-bold text-ink">{product.brand}</div>
                        <div className="truncate text-[11px] text-muted-2">{product.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.1em] text-muted">
                            {product.category}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.1em] ${
                            wardrobeEntry ? 'bg-accent/15 text-accent' : 'bg-white/[0.06] text-muted'
                          }`}>
                            {wardrobeEntry ? WARDROBE_STATUS_LABELS[wardrobeEntry.status] : 'Suggested'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!shopUrl || shopUrl === '#'}
                        onClick={() => {
                          if (!shopUrl || shopUrl === '#') return;
                          window.open(shopUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-muted-2 disabled:opacity-35"
                      >
                        {product.priceCents ? `$${Math.round(product.priceCents / 100)}` : 'Shop'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1.15fr_1fr] gap-2">
              <button
                type="button"
                onClick={() => {
                  replaceItems(activeFit.visualItems);
                  router.push('/build');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
              >
                <RotateCcw size={13} />
                Remix
              </button>
              <button
                type="button"
                onClick={() => {
                  const products = activeFit.visualProducts
                    .map((product) => ({
                      id: product.id,
                      brand: product.brand,
                      name: product.name,
                      retailer: product.retailer,
                      url: getProductOutboundUrl(product),
                      priceCents: product.priceCents,
                    }))
                    .filter((product) => Boolean(product.url));
                  setCheckoutTitle(activeFit.fit.title);
                  setCheckoutProducts(products);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2"
              >
                <ShoppingBag size={13} />
                Shop
              </button>
            </div>
            <button
              type="button"
              onClick={() => postFit(activeFit.visualItems, { title: activeFit.fit.title, caption: 'Saved to my Sylistly wardrobe rotation.', vibe: 'Saved', occasion: 'Casual', visibility: 'public' })}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
            >
              <Send size={13} />
              Post to feed
            </button>
          </article>
        </div>
      ) : null}
    </PlaceholderScreen>
  );
}
