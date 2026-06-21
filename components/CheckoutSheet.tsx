'use client';
import { Copy, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildRetailerGroups,
  formatCheckoutPrice,
  getCheckoutUrlHost,
  isExactProductUrl,
  openCheckoutUrls,
} from '@/lib/checkout';
import { wrapAffiliate } from '@/lib/affiliate';
import { track } from '@/lib/analytics';
import { useCheckout } from '@/store/checkout';
import { useDialogBehavior } from '@/lib/use-dialog-behavior';

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

export function CheckoutSheet({ open, title = 'This fit', products, onClose }: Props) {
  const router = useRouter();
  const setCheckout = useCheckout((state) => state.setCheckout);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const dialogRef = useDialogBehavior<HTMLDivElement>(onClose, open);
  const linkedProducts = products.filter((product) => Boolean(product.url));
  const exactProducts = linkedProducts.filter((product) => isExactProductUrl(product.url));
  const withheldCount = linkedProducts.length - exactProducts.length;
  const retailerGroups = buildRetailerGroups(exactProducts);
  const totalCents = exactProducts.reduce((sum, product) => sum + (product.priceCents || 0), 0);

  useEffect(() => {
    if (!open) return;
    const navs = Array.from(document.querySelectorAll<HTMLElement>('nav[aria-label="Primary navigation"]'));
    const previous = navs.map((nav) => ({
      nav,
      visibility: nav.style.visibility,
      pointerEvents: nav.style.pointerEvents,
    }));

    for (const nav of navs) {
      nav.style.visibility = 'hidden';
      nav.style.pointerEvents = 'none';
    }

    return () => {
      for (const entry of previous) {
        entry.nav.style.visibility = entry.visibility;
        entry.nav.style.pointerEvents = entry.pointerEvents;
      }
    };
  }, [open]);

  if (!open) return null;

  async function copyLinks() {
    const text = exactProducts
      .map((product) => `${product.brand} ${product.name} - ${product.url}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard failures in older webviews.
    }
    setBatchMessage(`Copied ${exactProducts.length} retailer link${exactProducts.length !== 1 ? 's' : ''}.`);
  }

  function openAllTabs() {
    const result = openCheckoutUrls(exactProducts.map((product) => product.url));
    if (!result.requestedCount) {
      setBatchMessage('No retailer links are ready yet.');
      return;
    }

    if (result.openedCount === result.requestedCount) {
      setBatchMessage(`Opened ${result.openedCount} retailer tab${result.openedCount !== 1 ? 's' : ''}.`);
      return;
    }

    if (result.openedCount > 0) {
      setBatchMessage(
        `Opened ${result.openedCount} of ${result.requestedCount} tabs. If your browser blocks the rest, use Copy links or Review checkout.`,
      );
      return;
    }

    setBatchMessage('Your browser blocked the batch open. Use Copy links or Review checkout.');
  }

  return (
    <>
      <div className="sy-route-enter fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Shop ${title}`}
        tabIndex={-1}
        className="sy-sheet-enter fixed inset-x-0 bottom-0 z-[100] mx-auto max-h-[92dvh] max-w-[440px] rounded-t-3xl border-t border-hairline-2 bg-surface-1 px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 shadow-[0_-24px_70px_rgba(0,0,0,.58)] outline-none"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-4 pb-3 pt-2">
          <div>
            <div className="text-[9px] uppercase tracking-[.18em] text-muted">Shop the look</div>
            <div className="mt-1 font-serif text-lg font-semibold text-ink">
              Shop <em className="italic text-accent">{title}</em>
            </div>
            <div className="mt-1 text-[11px] text-muted-2">
              {exactProducts.length} item{exactProducts.length !== 1 ? 's' : ''} - {retailerGroups.length} retailer{retailerGroups.length !== 1 ? 's' : ''} - {formatCheckoutPrice(totalCents)}
            </div>
            <div className="mt-2 max-w-[300px] text-[11px] leading-relaxed text-muted">
              Each link opens the item&rsquo;s real product page at the retailer.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 flex-none place-items-center rounded-full bg-surface-3 text-muted-2 transition hover:text-ink active:scale-90"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pb-4">
          <button
            type="button"
            onClick={openAllTabs}
            className="inline-flex rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white transition active:scale-[0.97] hover:shadow-pink-glow"
          >
            Open all tabs
          </button>
          <button
            type="button"
            onClick={() => {
              setCheckout({ title, products: exactProducts });
              onClose();
              router.push('/checkout');
            }}
            className="inline-flex rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white transition active:scale-[0.97] hover:shadow-pink-glow"
          >
            Review checkout
          </button>
          <button
            type="button"
            onClick={copyLinks}
            className="inline-flex items-center gap-2 rounded-full border border-hairline-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2 transition hover:border-accent hover:text-ink active:scale-[0.97]"
          >
            <Copy size={12} />
            Copy links
          </button>
        </div>

        {batchMessage ? (
          <div role="status" aria-live="polite" className="mb-4 rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted-2">
            {batchMessage}
          </div>
        ) : null}

        {withheldCount > 0 ? (
          <div
            className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100"
          >
            {withheldCount} link{withheldCount !== 1 ? 's need' : ' needs'} refreshing. Reopen this fit from the Scroll to update {withheldCount !== 1 ? 'them' : 'it'}.
          </div>
        ) : null}

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
                        <div className="mt-1 text-[10px] font-medium text-muted">
                          {getCheckoutUrlHost(product.url)}
                        </div>
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
                        {isExactProductUrl(product.url) ? 'Exact match' : 'Needs refresh'}
                      </span>
                    </div>
                    <a
                      href={wrapAffiliate(product.url, product.id)}
                      target="_blank"
                      rel="noreferrer sponsored"
                      onClick={() =>
                        track('shop_link_clicked', {
                          brand: product.brand,
                          retailer: product.retailer,
                          priceCents: product.priceCents,
                          exact: isExactProductUrl(product.url),
                          wrapped: wrapAffiliate(product.url) !== product.url,
                          surface: 'checkout-sheet',
                        })
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-medium text-accent transition hover:bg-accent hover:text-white active:scale-[0.97]"
                    >
                      Open real link
                      <ExternalLink size={12} />
                    </a>
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
