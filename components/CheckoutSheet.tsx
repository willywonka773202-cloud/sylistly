'use client';
import { Copy, ExternalLink, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { buildRetailerGroups, formatCheckoutPrice, isExactProductUrl } from '@/lib/checkout';
import { useCheckout } from '@/store/checkout';

export interface CheckoutProduct {
  id: string;
  brand: string;
  name: string;
  retailer: string;
  url: string;
  priceCents?: number;
}

interface Props {
  open: boolean;
  title?: string;
  products: CheckoutProduct[];
  onClose: () => void;
}

export function CheckoutSheet({ open, title = 'Checkout helper', products, onClose }: Props) {
  const router = useRouter();
  const setCheckout = useCheckout((state) => state.setCheckout);
  const validProducts = products.filter((product) => Boolean(product.url));
  const retailerGroups = buildRetailerGroups(validProducts);
  const totalCents = validProducts.reduce((sum, product) => sum + (product.priceCents || 0), 0);

  if (!open) return null;

  async function copyLinks() {
    const text = validProducts
      .map((product) => `${product.brand} ${product.name} - ${product.url}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard failures in older webviews.
    }
  }

  return (
    <>
      <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-3xl border-t border-hairline-2 bg-surface-1 px-4 pb-6 pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-4 pb-3 pt-2">
          <div>
            <div className="text-[9px] uppercase tracking-[.18em] text-muted">Checkout helper</div>
            <div className="mt-1 font-serif text-lg font-semibold text-ink">
              {title} <em className="italic text-accent">links</em>
            </div>
            <div className="mt-1 text-[11px] text-muted-2">
              {validProducts.length} item{validProducts.length !== 1 ? 's' : ''} - {retailerGroups.length} retailer{retailerGroups.length !== 1 ? 's' : ''} - ${' '}
              {(totalCents / 100).toLocaleString()}
            </div>
            <div className="mt-2 max-w-[300px] text-[11px] leading-relaxed text-muted">
              Browsers block several retailer tabs at once, so Sylistly gives you clean links to open one at a time.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 flex-none place-items-center rounded-full bg-surface-3 text-muted-2"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pb-4">
          <button
            type="button"
            onClick={() => {
              setCheckout({ title, products: validProducts });
              onClose();
              router.push('/checkout');
            }}
            className="inline-flex rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white"
          >
            Review checkout
          </button>
          <button
            type="button"
            onClick={copyLinks}
            className="inline-flex items-center gap-2 rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink"
          >
            <Copy size={12} />
            Copy links
          </button>
        </div>

        <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
          {retailerGroups.map((group) => (
            <section key={group.retailer} className="rounded-2xl border border-hairline bg-surface-2 p-3">
              <div>
                <div className="text-[10px] uppercase tracking-[.14em] text-muted">Retailer</div>
                <div className="mt-1 font-serif text-[17px] font-semibold text-ink">{group.retailer}</div>
                <div className="mt-1 text-[11px] text-muted-2">
                  {group.products.length} item{group.products.length !== 1 ? 's' : ''} ready to open
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {group.products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-hairline bg-surface-1 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[.14em] text-muted-2">{product.brand}</div>
                        <div className="mt-1 text-[13px] leading-tight text-ink">{product.name}</div>
                      </div>
                      <div className="rounded-full bg-surface-3 px-2.5 py-1 text-[12px] font-semibold text-ink">
                        {formatCheckoutPrice(product.priceCents)}
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[.16em] ${
                        isExactProductUrl(product.url)
                          ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20'
                      }`}>
                        {isExactProductUrl(product.url) ? 'Exact product page' : 'Retailer search link'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.open(product.url, '_blank', 'noopener,noreferrer')}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-medium text-accent transition hover:bg-accent hover:text-white"
                    >
                      Open item
                      <ExternalLink size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
