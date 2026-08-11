import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'How Sylistly shopping links and retailer commissions work.',
};

export default function AffiliateDisclosurePage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-[720px] bg-bg px-5 pb-20 pt-[calc(env(safe-area-inset-top)+24px)] sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2" aria-label="Back to Sylistly">
          <span className="h-[2px] w-6 rounded-full bg-accent" aria-hidden />
          <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
        </Link>
        <span className="text-[11px] font-semibold text-muted">Shopping transparency</span>
      </header>

      <div className="mt-8 rounded-[28px] border border-hairline bg-surface-1 p-6 shadow-card sm:p-8">
        <p className="text-eyebrow font-extrabold uppercase tracking-[.18em] text-champagne">Clear before you click</p>
        <h1 className="mt-3 font-serif text-[34px] font-semibold leading-tight text-ink sm:text-[42px]">
          Affiliate disclosure
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-2">
          Sylistly may earn a commission when you follow a shopping link and purchase from a retailer.
          That commission does not increase the price you pay.
        </p>

        <div className="mt-8 space-y-7 text-[14px] leading-7 text-muted-2">
          <section>
            <h2 className="font-serif text-[20px] font-semibold text-ink">How links work</h2>
            <p className="mt-2">
              Shopping actions take you to the retailer&rsquo;s exact product page. When an approved affiliate
              network is configured, Sylistly applies its tracking to that destination. If affiliate tracking is
              unavailable, the retailer link can remain direct.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-[20px] font-semibold text-ink">What does not change</h2>
            <p className="mt-2">
              Retailers set the price, availability, shipping, returns, and purchase terms. Sylistly does not
              process payment or receive your retailer checkout details. A commission does not determine whether
              an item is shown as available or whether it meets your saved preferences.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-[20px] font-semibold text-ink">Attribution</h2>
            <p className="mt-2">
              Sylistly records a privacy-safe product and session reference when a retailer link is opened so it
              can measure whether recommendations are useful and reconcile permitted affiliate reporting. See the
              privacy policy for the current data practices.
            </p>
          </section>
        </div>
      </div>

      <nav aria-label="Legal information" className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-muted">
        <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-ink">Privacy</Link>
        <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-ink">Terms</Link>
        <Link href="/" className="inline-flex min-h-11 items-center text-accent">Back to For You</Link>
      </nav>
    </main>
  );
}
