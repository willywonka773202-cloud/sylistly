'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Copy, ExternalLink } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { buildRetailerGroups, formatCheckoutPrice, isExactProductUrl, openCheckoutUrls } from '@/lib/checkout';
import { useCheckout } from '@/store/checkout';

export default function CheckoutPage() {
  const products = useCheckout((state) => state.products);
  const title = useCheckout((state) => state.title);
  const retailerGroups = buildRetailerGroups(products);
  const totalCents = products.reduce((sum, product) => sum + (product.priceCents || 0), 0);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  async function copyLinks() {
    const text = products
      .map((product) => `${product.brand} ${product.name} - ${product.url}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard failures.
    }
  }

  function openAllTabs() {
    const result = openCheckoutUrls(products.map((product) => product.url));
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
        `Opened ${result.openedCount} of ${result.requestedCount} tabs. If your browser blocks the rest, use Copy all below.`,
      );
      return;
    }

    setBatchMessage('Your browser blocked the batch open. Use Copy all and open the retailer pages manually.');
  }

  return (
    <PlaceholderScreen
      eyebrow="Checkout"
      title="Retailer"
      accent="links"
      description="Use this page as a multi-store checkout helper. Sylistly can batch-open retailer tabs again, with manual links as the fallback."
    >
      {products.length ? (
        <div className="grid gap-3">
          <section className="rounded-3xl border border-hairline bg-surface-1 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[.18em] text-muted">Ready to shop</div>
                <h2 className="mt-2 font-serif text-[20px] font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-[12px] text-muted-2">
                  {products.length} item{products.length !== 1 ? 's' : ''} - {retailerGroups.length} retailer{retailerGroups.length !== 1 ? 's' : ''} - ${(totalCents / 100).toLocaleString('en-US')}
                </p>
              </div>
              <button
                type="button"
                onClick={copyLinks}
                className="inline-flex items-center gap-2 rounded-full border border-hairline-2 px-3 py-2 text-[11px] font-medium text-muted-2 transition hover:border-accent hover:text-ink"
              >
                <Copy size={12} />
                Copy all
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openAllTabs}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white"
              >
                Open all tabs
              </button>
            </div>
            {batchMessage ? (
              <div className="mt-3 rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-muted-2">
                {batchMessage}
              </div>
            ) : null}
          </section>

          {retailerGroups.map((group) => (
            <section key={group.retailer} className="rounded-3xl border border-hairline bg-surface-1 p-4">
              <div>
                <div className="text-[11px] uppercase tracking-[.18em] text-muted">Retailer</div>
                <h2 className="mt-2 font-serif text-[20px] font-semibold text-ink">{group.retailer}</h2>
                <p className="mt-1 text-[12px] text-muted-2">
                  {group.products.length} clean link{group.products.length !== 1 ? 's' : ''} ready.
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                {group.products.map((product) => {
                  const exact = isExactProductUrl(product.url);
                  return (
                    <div key={product.id} className="rounded-2xl border border-hairline bg-surface-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[.14em] text-muted-2">{product.brand}</div>
                          <div className="mt-1 text-[13px] leading-tight text-ink">{product.name}</div>
                        </div>
                        <div className="rounded-full bg-surface-3 px-2.5 py-1 text-[12px] font-semibold text-ink">
                          {formatCheckoutPrice(product.priceCents)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[.16em] ${
                          exact
                            ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20'
                        }`}>
                          {exact ? 'Exact product page' : 'Retailer search link'}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-medium text-accent transition hover:bg-accent hover:text-white"
                        >
                          Open item
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="rounded-3xl border border-hairline bg-surface-1 p-5">
          <h2 className="font-serif text-[20px] font-semibold text-ink">No checkout session yet</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
            Open a fit from the builder or Saved tab, then use the checkout helper to review every store link in one place.
          </p>
          <Link
            href="/saved"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-accent transition hover:bg-accent hover:text-white"
          >
            Go to saved fits
            <ArrowRight size={13} />
          </Link>
        </section>
      )}
    </PlaceholderScreen>
  );
}
