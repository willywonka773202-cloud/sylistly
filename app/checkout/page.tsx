'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Copy, ExternalLink } from 'lucide-react';
import { AffiliateDisclosure } from '@/components/AffiliateDisclosure';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { ProductImage } from '@/components/ProductImage';
import type { CheckoutProduct } from '@/components/CheckoutSheet';
import { getProductOutboundUrl } from '@/lib/product-links';
import { buildRetailerClickPath } from '@/lib/retailer-attribution';
import { track } from '@/lib/analytics';
import { buildRetailerGroups, formatCheckoutPrice, isExactProductUrl, openCheckoutUrls } from '@/lib/checkout';
import type { Product } from '@/lib/types';
import { useCheckout } from '@/store/checkout';

export default function CheckoutPage() {
  const productIds = useCheckout((state) => state.productIds);
  const title = useCheckout((state) => state.title);
  const lookId = useCheckout((state) => state.lookId);
  // Zustand omits the persist API while Next.js prerenders without browser
  // storage. Start closed and inspect it only after the client mounts.
  const [hydrated, setHydrated] = useState(false);
  const [refreshState, setRefreshState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [resolvedProducts, setResolvedProducts] = useState<Product[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  useEffect(() => {
    const persistence = useCheckout.persist;
    if (!persistence) {
      setHydrated(true);
      return;
    }
    setHydrated(persistence.hasHydrated());
    return persistence.onFinishHydration(() => setHydrated(true));
  }, []);

  // Persisted checkout contains identity only. Re-resolve every ID through the
  // strict current catalog before a price, retailer link, copy action, or batch
  // open is exposed; unresolved IDs fail closed as explicitly withheld.
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    setBatchMessage(null);
    setResolvedProducts([]);
    if (!productIds.length) {
      setRefreshState('ready');
      return () => controller.abort();
    }

    setRefreshState('loading');
    const batches: string[][] = [];
    for (let index = 0; index < productIds.length; index += 64) {
      batches.push(productIds.slice(index, index + 64));
    }
    void Promise.all(batches.map(async (ids) => {
      const response = await fetch(`/api/catalog?ids=${encodeURIComponent(ids.join(','))}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('checkout_catalog_refresh_failed');
      const payload = await response.json() as { products?: Product[] };
      return Array.isArray(payload.products) ? payload.products : [];
    })).then((groups) => {
      if (controller.signal.aborted) return;
      const byId = new Map(groups.flat().map((product) => [product.id, product]));
      setResolvedProducts(productIds.flatMap((id) => {
        const product = byId.get(id);
        return product ? [product] : [];
      }));
      setRefreshState('ready');
    }).catch(() => {
      if (controller.signal.aborted) return;
      setResolvedProducts([]);
      setRefreshState('error');
    });
    return () => controller.abort();
  }, [hydrated, productIds, refreshToken]);

  const products = useMemo<CheckoutProduct[]>(() => resolvedProducts.map((product) => ({
    id: product.id,
    brand: product.brand,
    name: product.name,
    retailer: product.retailer,
    url: getProductOutboundUrl(product),
    priceCents: product.priceCents,
  })), [resolvedProducts]);
  const exactProducts = products.filter((product) => Boolean(product.url) && isExactProductUrl(product.url));
  const withheldCount = Math.max(0, productIds.length - exactProducts.length);
  const retailerGroups = buildRetailerGroups(exactProducts);
  const totalCents = exactProducts.reduce((sum, product) => sum + (product.priceCents || 0), 0);
  const currentProductById = useMemo(
    () => new Map(resolvedProducts.map((product) => [product.id, product])),
    [resolvedProducts],
  );

  async function copyLinks() {
    const text = exactProducts
      .map((product) => {
        const attributedPath = buildRetailerClickPath({
          productId: product.id,
          lookId,
          surface: 'checkout-page-copy',
          subId: product.id,
        });
        const attributedUrl = new URL(attributedPath, window.location.origin).toString();
        return `${product.brand} ${product.name} - ${attributedUrl}`;
      })
      .join('\n');

    if (!exactProducts.length) {
      setBatchMessage('No retailer links are ready yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setBatchMessage(`Copied ${exactProducts.length} retailer link${exactProducts.length === 1 ? '' : 's'}.`);
    } catch {
      setBatchMessage('Copy failed. Open the retailer links individually instead.');
    }
  }

  function openAllTabs() {
    const result = openCheckoutUrls(
      exactProducts.map((product) => ({ productId: product.id, url: product.url, subId: product.id, lookId })),
      'checkout-page-batch',
    );
    exactProducts.slice(0, result.openedCount).forEach((product) => {
      track('retailer_click_started', {
        productId: product.id,
        lookId,
        brand: product.brand,
        retailer: product.retailer,
        priceCents: product.priceCents,
        surface: 'checkout-page-batch',
      });
    });
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
      eyebrow="Live loadout"
      title="Shop the"
      accent="real pieces"
      description="The clothes in your fit, cleanly grouped by retailer — every available link opens the real product page."
    >
      {!hydrated || refreshState === 'loading' ? (
        <section role="status" aria-live="polite" className="rounded-3xl border border-hairline bg-surface-1 p-5">
          <h2 className="font-serif text-[20px] font-semibold text-ink">Verifying your checkout</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
            Checking current prices, availability, and exact retailer pages before anything can be opened.
          </p>
        </section>
      ) : refreshState === 'error' ? (
        <section role="alert" className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-5">
          <h2 className="font-serif text-[20px] font-semibold text-ink">Checkout could not be verified</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
            No saved prices or links will be used. Try the current catalog check again before shopping.
          </p>
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-accent/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-accent transition hover:bg-accent hover:text-bg"
          >
            Retry verification
          </button>
        </section>
      ) : productIds.length ? (
        <div className="grid gap-3">
          <section className="rounded-3xl border border-hairline bg-surface-1 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[.18em] text-muted">Ready to shop</div>
                <h2 className="mt-2 font-serif text-[20px] font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-[12px] text-muted-2">
                  {exactProducts.length}/{productIds.length} current item{productIds.length !== 1 ? 's' : ''} · {retailerGroups.length} retailer{retailerGroups.length !== 1 ? 's' : ''} · {formatCheckoutPrice(totalCents)}
                </p>
              </div>
              <button
                type="button"
                onClick={copyLinks}
                disabled={!exactProducts.length}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-2 px-3 py-2 text-[11px] font-medium text-muted-2 transition hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Copy size={12} />
                Copy all
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openAllTabs}
                disabled={!exactProducts.length}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-bg disabled:cursor-not-allowed disabled:opacity-45"
              >
                Open all tabs
              </button>
            </div>
            <AffiliateDisclosure className="mt-3" />
            {batchMessage ? (
              <div role="status" aria-live="polite" className="mt-3 rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-muted-2">
                {batchMessage}
              </div>
            ) : null}
            {withheldCount > 0 ? (
              <div
                role="status"
                className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100"
              >
                {withheldCount} item{withheldCount !== 1 ? 's are' : ' is'} withheld because {withheldCount !== 1 ? 'they no longer have' : 'it no longer has'} fresh, exact catalog evidence. The total and actions include only the {exactProducts.length} currently verified item{exactProducts.length === 1 ? '' : 's'}.
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
                  const currentProduct = currentProductById.get(product.id);
                  return (
                    <div key={product.id} className="sy-card group rounded-2xl border border-hairline bg-surface-2 p-3">
                      <div className="flex items-start gap-3">
                        {currentProduct ? (
                          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fff,#eee6dc)] p-1.5">
                            <ProductImage
                              product={currentProduct}
                              transparentOnly
                              wrapperClassName="h-full w-full"
                              className="h-full w-full object-contain motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
                            />
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-[.14em] text-muted-2">{product.brand}</div>
                          <div className="mt-1 text-[13px] leading-tight text-ink">{product.name}</div>
                        </div>
                        <div className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-[12px] font-semibold text-ink">
                          {formatCheckoutPrice(product.priceCents)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[.16em] ${
                          exact
                            ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/20'
                        }`}>
                          {exact ? 'Exact product page' : 'Needs refresh'}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={buildRetailerClickPath({
                            productId: product.id,
                            lookId,
                            surface: 'checkout-page',
                            subId: product.id,
                          })}
                          target="_blank"
                          rel="noreferrer sponsored"
                          onClick={() =>
                            track('shop_link_clicked', {
                              productId: product.id,
                              lookId,
                              brand: product.brand,
                              retailer: product.retailer,
                              priceCents: product.priceCents,
                              exact,
                              attributed: true,
                              surface: 'checkout-page',
                            })
                          }
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/40 px-3 py-1.5 text-[10px] font-medium text-accent transition hover:bg-accent hover:text-bg"
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
          <h2 className="font-serif text-[20px] font-semibold text-ink">Nothing to shop yet</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
            Open a fit from Remix or your Saved tab, then tap Shop to gather every piece&rsquo;s store link in one place.
          </p>
          <Link
            href="/saved"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.12em] text-accent transition hover:bg-accent hover:text-bg"
          >
            Go to saved fits
            <ArrowRight size={13} />
          </Link>
        </section>
      )}
    </PlaceholderScreen>
  );
}
