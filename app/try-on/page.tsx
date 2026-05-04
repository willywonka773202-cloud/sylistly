'use client';

import { ArrowLeft, Camera, RefreshCw, Bookmark, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ProductImage';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { getProductOutboundUrl } from '@/lib/product-links';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';

const CATEGORY_LABELS: Partial<Record<Category, string>> = {
  hat: 'Hat',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export default function TryOnPage() {
  const router = useRouter();
  const profile = useProfile((state) => state.profile);
  const { items, totalCents } = useFit();
  const saveFit = useSavedFits((state) => state.saveFit);
  const [saved, setSaved] = useState(false);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const fitProducts = CATEGORY_ORDER
    .map((cat) => items[cat])
    .filter((p): p is Product => Boolean(p));

  const hasPhoto = Boolean(profile.selfieUrl || profile.bodyPhotoUrl);
  const displayPhoto = profile.bodyPhotoUrl || profile.selfieUrl;

  function handleSave() {
    saveFit(items);
    setSaved(true);
  }

  function handleShop() {
    const products: CheckoutProduct[] = fitProducts
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((p) => Boolean(p.url));
    setCheckoutProducts(products);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 border-b border-hairline">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="text-center">
          <div className="font-serif text-[18px] font-semibold text-ink">Try-on</div>
          <div className="text-[10px] text-muted-2">{fitProducts.length} piece{fitProducts.length !== 1 ? 's' : ''}</div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className={`grid h-9 w-9 place-items-center rounded-full transition ${
            saved
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'border border-white/10 bg-white/[0.04] text-muted-2'
          }`}
        >
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">

        {fitProducts.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-[26px] bg-accent/10 text-accent mb-4">
              <Sparkles size={26} />
            </div>
            <h2 className="font-serif text-[26px] font-semibold text-ink">No outfit yet</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
              Build or generate an outfit in the Builder first, then come back to try it on.
            </p>
            <button
              type="button"
              onClick={() => router.push('/build')}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
            >
              <Sparkles size={13} />
              Open Builder
            </button>
          </div>
        ) : (
          <>
            {/* Side-by-side try-on layout */}
            <div className="px-4 pt-4">
              <div className="grid grid-cols-2 gap-3">

                {/* Photo panel */}
                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#151311]">
                  {displayPhoto ? (
                    <>
                      <div className="aspect-[3/4] overflow-hidden rounded-[24px] m-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={displayPhoto}
                          alt="Your photo"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="px-2 pb-2.5 text-center">
                        <div className="text-[9px] uppercase tracking-[.14em] text-muted">You</div>
                      </div>
                    </>
                  ) : (
                    <div className="aspect-[3/4] m-1.5 rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] flex flex-col items-center justify-center gap-2 text-center px-4">
                      <Camera size={22} className="text-muted-2 opacity-50" />
                      <div className="text-[10px] leading-snug text-muted-2">
                        Add a photo in<br />Profile → Style DNA
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push('/profile')}
                        className="mt-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.1em] text-accent"
                      >
                        Set up
                      </button>
                    </div>
                  )}
                </div>

                {/* Outfit panel */}
                <div className="flex flex-col gap-2">
                  {fitProducts.slice(0, 4).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setActiveProduct(product)}
                      className="flex items-center gap-2 overflow-hidden rounded-[18px] border border-white/10 bg-[#151311] p-1.5 text-left transition active:scale-[0.97]"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] border border-[#eadfd5] bg-[#fff8f2]">
                        <ProductImage
                          product={product}
                          wrapperClassName="h-full w-full"
                          className="h-full w-full object-contain p-1"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] uppercase tracking-[.12em] text-accent">{CATEGORY_LABELS[product.category]}</div>
                        <p className="line-clamp-1 text-[10px] font-semibold text-ink">{product.brand}</p>
                        <p className="text-[9px] text-muted">{formatPrice(product.priceCents)}</p>
                      </div>
                    </button>
                  ))}
                  {fitProducts.length > 4 && (
                    <div className="rounded-[18px] border border-white/10 bg-[#151311] px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-2">+{fitProducts.length - 4} more</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Outfit info strip */}
              <div className="mt-3 rounded-[22px] border border-white/10 bg-[#151311] p-3 flex items-center justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-[.14em] text-accent">Full outfit</div>
                  <div className="mt-0.5 font-serif text-[18px] font-semibold text-ink">{formatPrice(totalCents())}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/build')}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2 transition hover:text-ink"
                  >
                    <RefreshCw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleShop}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.1em] text-white shadow-pink-glow"
                  >
                    <ShoppingBag size={13} />
                    Shop
                  </button>
                </div>
              </div>

              {/* Full item list */}
              {fitProducts.length > 0 && (
                <div className="mt-3">
                  <div className="text-[9px] uppercase tracking-[.16em] text-muted mb-2 px-1">All pieces</div>
                  <div className="grid grid-cols-3 gap-2">
                    {fitProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className="overflow-hidden rounded-[18px] border border-white/10 bg-[#151311] transition active:scale-[0.97]"
                      >
                        <div className="aspect-square overflow-hidden rounded-[14px] m-1.5 border border-[#eadfd5] bg-[#fff8f2]">
                          <ProductImage
                            product={product}
                            wrapperClassName="h-full w-full"
                            className="h-full w-full object-contain p-1.5"
                          />
                        </div>
                        <div className="px-1.5 pb-2">
                          <div className="text-[8px] uppercase tracking-[.1em] text-accent">{CATEGORY_LABELS[product.category]}</div>
                          <p className="line-clamp-1 text-[9px] font-semibold text-ink">{product.brand}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA strip */}
              {!hasPhoto && (
                <div className="mt-4 rounded-[24px] border border-accent/20 bg-accent/8 p-4 text-center">
                  <div className="text-[12px] font-semibold text-ink">See yourself in this fit</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-2">
                    Add a full-body photo in your style profile to preview the outfit on you.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/profile')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[.1em] text-accent"
                  >
                    <Camera size={12} />
                    Add photo
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Product detail sheet */}
      {activeProduct ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/70 backdrop-blur-sm">
          <button className="absolute inset-0" aria-label="Close" onClick={() => setActiveProduct(null)} />
          <div className="relative z-10 w-full rounded-t-[32px] border-t border-white/10 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-24px_60px_rgba(0,0,0,.5)]">
            <div className="flex items-start justify-between gap-3">
              <div className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-[20px] border border-[#eadfd5] bg-[#fff8f2]">
                <ProductImage
                  product={activeProduct}
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-[.14em] text-accent">{CATEGORY_LABELS[activeProduct.category]}</div>
                <h3 className="mt-0.5 font-serif text-[20px] font-semibold text-ink leading-tight">{activeProduct.brand}</h3>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-2">{activeProduct.name}</p>
                <p className="mt-1.5 text-[14px] font-semibold text-ink">{formatPrice(activeProduct.priceCents)}</p>
              </div>
              <button
                onClick={() => setActiveProduct(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2"
              >
                <X size={15} />
              </button>
            </div>
            {getProductOutboundUrl(activeProduct) && (
              <a
                href={getProductOutboundUrl(activeProduct)!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
              >
                <ShoppingBag size={13} />
                Shop {activeProduct.brand}
              </a>
            )}
          </div>
        </div>
      ) : null}

      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title="Shop this fit"
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </main>
  );
}
