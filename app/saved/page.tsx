'use client';
import { Bookmark, Plus, RotateCcw, Send, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { ProductImage } from '@/components/ProductImage';
import { useFit } from '@/store/fit';
import { useSavedFits, type SavedFitRecord } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export default function SavedPage() {
  const fits = useSavedFits((state) => state.fits);
  const removeFit = useSavedFits((state) => state.removeFit);
  const postFit = useSocialFeed((state) => state.postFit);
  const replaceItems = useFit((state) => state.replaceItems);
  const [selectedFit, setSelectedFit] = useState<SavedFitRecord | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState<string>('Saved fit');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const displayFits = fits
    .map((fit) => {
      const visualProducts = Object.entries(fit.items)
        .filter((entry): entry is [Category, Product] =>
          isHighConfidenceRenderableProduct(entry[1]) && !failedImageIds.has(entry[1].id),
        )
        .map(([, product]) => product);
      return { fit, visualProducts };
    })
    .filter(({ visualProducts }) => visualProducts.length > 0);

  function openShop(fit: SavedFitRecord) {
    const products = Object.values(fit.items)
      .filter((p): p is Product => Boolean(p))
      .map((p) => ({
        id: p.id,
        brand: p.brand,
        name: p.name,
        retailer: p.retailer,
        url: getProductOutboundUrl(p),
        priceCents: p.priceCents,
      }))
      .filter((p) => Boolean(p.url));
    setCheckoutTitle(fit.title);
    setCheckoutProducts(products);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto pb-6 pt-[calc(env(safe-area-inset-top)+40px)]">

        {/* Page header */}
        <div className="flex items-center justify-between px-4 pb-5">
          <div>
            <div className="text-[9px] uppercase tracking-[.2em] text-accent">Saved</div>
            <h1 className="mt-0.5 font-serif text-[30px] font-semibold leading-none text-ink">
              Fits <em className="italic text-accent">saved</em>
            </h1>
            {displayFits.length > 0 && (
              <p className="mt-1 text-[11px] text-muted">{displayFits.length} look{displayFits.length !== 1 ? 's' : ''} saved locally</p>
            )}
          </div>
          <button
            onClick={() => router.push('/build')}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2.5 text-[11px] font-semibold text-white shadow-pink-glow"
          >
            <Plus size={13} />
            Build new
          </button>
        </div>

        {displayFits.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 px-4">
            {displayFits.map(({ fit, visualProducts }) => (
              <button
                key={fit.id}
                type="button"
                onClick={() => setSelectedFit(fit)}
                className="group overflow-hidden rounded-[22px] border border-white/10 bg-[#151311] text-left shadow-[0_16px_36px_rgba(0,0,0,.28)] transition active:scale-[0.97]"
              >
                {/* Product grid thumbnail */}
                <div className="m-2 grid grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-[16px] border border-[#eadfd5] bg-[#fff8f2] p-1" style={{ height: 156 }}>
                  {visualProducts.slice(0, 4).map((product, i) => (
                    <div
                      key={`${fit.id}-${product.id}`}
                      className={`overflow-hidden rounded-[10px] bg-white/70 ${i === 0 ? 'row-span-2' : ''}`}
                    >
                      <ProductImage
                        product={product}
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-1.5"
                        onUnavailable={(p) => setFailedImageIds((cur) => new Set(cur).add(p.id))}
                      />
                    </div>
                  ))}
                </div>
                {/* Card footer */}
                <div className="px-2.5 pb-3">
                  <h3 className="line-clamp-1 font-serif text-[15px] font-semibold leading-snug text-ink">{fit.title}</h3>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted">
                    <span>{formatPrice(fit.totalCents)}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatDate(fit.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="mx-4 mt-6 rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(232,54,93,.1),transparent_38%),linear-gradient(180deg,#161412_0%,#0d0c0b_100%)] p-7 text-center shadow-[0_24px_60px_rgba(0,0,0,.35)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-accent/12 text-accent">
              <Bookmark size={22} />
            </div>
            <h2 className="mt-4 font-serif text-[24px] font-semibold text-ink">No saved fits yet</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
              Build a look in the Builder, then swipe right or tap Save to keep it here.
            </p>
            <button
              onClick={() => router.push('/build')}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
            >
              Open Builder
            </button>
          </div>
        )}
      </div>

      <BottomNav />

      {/* Fit detail modal */}
      {selectedFit ? (
        <FitDetailModal
          fit={selectedFit}
          failedImageIds={failedImageIds}
          onImageUnavailable={(id) => setFailedImageIds((cur) => new Set(cur).add(id))}
          onClose={() => setSelectedFit(null)}
          onLoadInBuilder={() => {
            replaceItems(selectedFit.items);
            setSelectedFit(null);
            router.push('/build');
          }}
          onTryOn={() => {
            replaceItems(selectedFit.items);
            setSelectedFit(null);
            router.push('/try-on');
          }}
          onShop={() => openShop(selectedFit)}
          onPost={() => {
            postFit(selectedFit.items, { title: selectedFit.title, vibe: 'Saved' });
            setSelectedFit(null);
          }}
          onDelete={() => {
            removeFit(selectedFit.id);
            setSelectedFit(null);
          }}
        />
      ) : null}

      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </main>
  );
}

function FitDetailModal({
  fit,
  failedImageIds,
  onImageUnavailable,
  onClose,
  onLoadInBuilder,
  onTryOn,
  onShop,
  onPost,
  onDelete,
}: {
  fit: SavedFitRecord;
  failedImageIds: Set<string>;
  onImageUnavailable: (id: string) => void;
  onClose: () => void;
  onLoadInBuilder: () => void;
  onTryOn: () => void;
  onShop: () => void;
  onPost: () => void;
  onDelete: () => void;
}) {
  const products = Object.entries(fit.items)
    .filter((entry): entry is [Category, Product] =>
      isHighConfidenceRenderableProduct(entry[1]) && !failedImageIds.has(entry[1].id),
    )
    .map(([, p]) => p);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/72 backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <article className="relative z-10 max-h-[calc(100dvh-40px)] w-full overflow-y-auto rounded-t-[34px] border border-white/12 bg-[#0f0e0d] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-28px_80px_rgba(0,0,0,.58)]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[.18em] text-accent">
              <Bookmark size={10} />
              Saved fit
            </div>
            <h2 className="mt-1 font-serif text-[27px] font-semibold leading-tight text-ink">{fit.title}</h2>
            <p className="mt-1 text-[11px] text-muted">
              {products.length} pieces · {formatPrice(fit.totalCents)} · {formatDate(fit.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2"
          >
            <X size={15} />
          </button>
        </div>

        {/* Product mosaic */}
        <div className="mt-4 rounded-[26px] border border-[#eadfd5] bg-[#fff9f3] p-2.5">
          <div className="grid grid-cols-3 grid-rows-2 gap-2 overflow-hidden rounded-[20px] bg-[#fffbf7] p-2" style={{ height: 280 }}>
            {products.slice(0, 6).map((product, i) => (
              <div
                key={`modal-${product.id}`}
                className={`overflow-hidden rounded-[14px] bg-white/80 ring-1 ring-[#eadfd5] ${i === 0 ? 'row-span-2' : ''}`}
              >
                <ProductImage
                  product={product}
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-contain p-2"
                  onUnavailable={(p) => onImageUnavailable(p.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Primary actions */}
        <div className="mt-4 grid grid-cols-[1fr_.85fr] gap-2">
          <button
            onClick={onLoadInBuilder}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
          >
            <RotateCcw size={13} />
            Load in Builder
          </button>
          <button
            onClick={onShop}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
          >
            <ShoppingBag size={13} />
            Shop fit
          </button>
        </div>

        {/* Secondary actions */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={onTryOn}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
          >
            <Sparkles size={12} />
            Try on
          </button>
          <button
            onClick={onPost}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
          >
            <Send size={12} />
            Post
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-rose-400/65 transition hover:border-rose-400/45 hover:text-rose-300"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </article>
    </div>
  );
}
