import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Sylistly handles your data — most of it never leaves your device.',
};

/**
 * DRAFT privacy policy. The CONTENT is accurate to the app's actual practices
 * (verified against the codebase), but it has NOT had legal review and is not a
 * final/effective policy — the owner must review with counsel for completeness
 * (GDPR/CCPA-specific clauses, retention, data-subject rights, etc.) before
 * launch. The banner makes that explicit so it can't be mistaken for final.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-[640px] bg-bg px-5 pb-20 pt-[calc(env(safe-area-inset-top)+24px)]">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="h-[2px] w-6 self-center rounded-full bg-accent" aria-hidden />
          <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
        </Link>
        <span className="text-[11px] font-semibold text-muted">Privacy</span>
      </header>

      <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-[12px] leading-relaxed text-amber-100">
        ⚠️ <strong>Draft — pending legal review.</strong> This describes how the app works today but
        has not been reviewed by counsel and is not yet a final, effective policy.
      </div>

      <h1 className="mt-6 font-serif text-[32px] font-semibold leading-tight text-ink">Privacy Policy</h1>
      <p className="mt-1 text-[12px] text-muted">Last updated: 21 June 2026</p>

      <div className="mt-6 space-y-6 text-[14px] leading-relaxed text-muted-2">
        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">The short version</h2>
          <p className="mt-2">
            Sylistly is a styling tool, not an account-based service. You don&rsquo;t sign up, and we
            don&rsquo;t ask for your name, email, or address. The fits you save and the style answers
            you give are stored <strong>on your own device</strong>, not on our servers.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">What stays on your device</h2>
          <p className="mt-2">
            Your saved fits, your style-quiz answers and persona, your frame and preference settings,
            and your streak/collection progress are kept in your browser&rsquo;s local storage. They
            don&rsquo;t leave your device and we can&rsquo;t see them. Clearing your browser data
            removes them.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Analytics</h2>
          <p className="mt-2">
            When enabled, we use a product-analytics tool (PostHog) to understand aggregate usage —
            which screens are viewed, fits swiped, and links tapped — so we can improve the app. This
            is behavioural, not personally-identifying, and is only active when an analytics key is
            configured. We do not sell your data.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Shopping links &amp; affiliates</h2>
          <p className="mt-2">
            When you tap to shop a piece, you&rsquo;re sent to the retailer through an affiliate link
            (e.g. Skimlinks, Rakuten). These partners may set cookies on the retailer&rsquo;s side to
            credit Sylistly a commission if you buy — at no extra cost to you. Once you&rsquo;re on a
            retailer&rsquo;s site, their privacy policy governs that visit.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Who we share with</h2>
          <p className="mt-2">
            We don&rsquo;t sell personal data. The only third parties involved are the analytics
            provider (aggregate usage, when enabled), the affiliate networks (for commission
            attribution), and the retailers you choose to visit. We don&rsquo;t process payments —
            purchases happen on the retailer&rsquo;s own checkout.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Children</h2>
          <p className="mt-2">Sylistly isn&rsquo;t directed at children under 13 and we don&rsquo;t knowingly collect their data.</p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Your choices</h2>
          <p className="mt-2">
            You can clear all on-device data any time through your browser settings. Because we
            don&rsquo;t hold an account for you, there&rsquo;s no server-side profile to delete.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[18px] font-semibold text-ink">Changes &amp; contact</h2>
          <p className="mt-2">
            We&rsquo;ll update this page if our practices change. Questions: [contact email — to be
            added before launch].
          </p>
        </section>
      </div>

      <div className="mt-10 flex gap-4 text-[12px] font-semibold text-muted">
        <Link href="/terms" className="text-accent">Terms of Service</Link>
        <Link href="/" className="hover:text-ink">Back to Sylistly</Link>
      </div>
    </main>
  );
}
