import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms for using Sylistly — a styling tool with real shoppable links.',
};

/**
 * DRAFT terms of service. Content is accurate to how the app actually works, but
 * has NOT had legal review and is not a final/effective agreement. The owner must
 * review with counsel (limitation of liability, governing law, arbitration, etc.)
 * before launch. The banner makes that explicit.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-[640px] bg-bg px-5 pb-20 pt-[calc(env(safe-area-inset-top)+24px)]">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="h-[2px] w-6 self-center rounded-full bg-accent" aria-hidden />
          <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
        </Link>
        <span className="text-[11px] font-semibold text-muted">Terms</span>
      </header>

      <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-[12px] leading-relaxed text-amber-100">
        <strong>Draft — pending legal review.</strong> Accurate to how the app works today, but not
        yet reviewed by counsel or in effect.
      </div>

      <h1 className="mt-6 font-serif text-[32px] font-semibold leading-tight text-ink">Terms of Service</h1>
      <p className="mt-1 text-[12px] text-muted">Last updated: 10 August 2026</p>

      <div className="mt-6 space-y-6 text-[14px] leading-relaxed text-muted-2">
        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">What Sylistly is</h2>
          <p className="mt-2">
            Sylistly is a styling tool that assembles outfits from real products and links you out to
            the retailers that sell them. It&rsquo;s a discovery and inspiration service — it doesn&rsquo;t
            sell or ship anything itself.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Affiliate links</h2>
          <p className="mt-2">
            Many shopping links are affiliate links: if you buy through them, Sylistly may earn a
            commission at no extra cost to you. We disclose this throughout the app.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Prices &amp; availability</h2>
          <p className="mt-2">
            Products, prices, and availability are set by the retailers and can change or sell out at
            any time. We show our best current data but can&rsquo;t guarantee a piece will be available
            or priced as shown when you reach the store.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Third-party retailers</h2>
          <p className="mt-2">
            When you shop a piece, your purchase, payment, shipping, returns, and support are handled
            entirely by that retailer under their own terms. Sylistly isn&rsquo;t a party to those
            transactions and isn&rsquo;t responsible for them.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Honest by design</h2>
          <p className="mt-2">
            Your swipes and saves are your own decisions — we don&rsquo;t fake matches, follower counts,
            scarcity, or urgency. Rarity tiers and daily drops are honest game mechanics, not gambling.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Acceptable use</h2>
          <p className="mt-2">
            Use Sylistly for personal styling and shopping. Don&rsquo;t scrape, abuse, or attempt to
            disrupt the service.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">No warranty &amp; changes</h2>
          <p className="mt-2">
            The service is provided &ldquo;as is.&rdquo; We may update these terms. Limitation of liability,
            governing law, and dispute terms still require counsel and jurisdiction-specific review
            before this draft can take effect.
          </p>
        </section>
      </div>

      <div className="mt-10 flex gap-4 text-[12px] font-semibold text-muted">
        <Link href="/privacy" className="text-accent">Privacy Policy</Link>
        <Link href="/affiliate-disclosure" className="hover:text-ink">Affiliate disclosure</Link>
        <Link href="/" className="hover:text-ink">Back to Sylistly</Link>
      </div>
    </main>
  );
}
