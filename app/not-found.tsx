import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col items-center justify-center gap-6 overflow-hidden bg-bg px-8 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-8%,rgba(255,59,99,.18),transparent_46%)]" />
      <div className="relative">
        <div className="sy-eyebrow">404</div>
        <h1 className="mt-2 font-serif text-[34px] font-semibold leading-tight text-ink">
          Nothing styled here.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-2">
          This page doesn&rsquo;t exist. Let&rsquo;s get you back to the fits.
        </p>
      </div>
      <div className="relative flex w-full max-w-[260px] flex-col gap-2.5">
        <Link href="/build" className="sy-cta-primary px-5 py-3 text-[12px] font-bold uppercase tracking-[.14em]">
          Style a fit
        </Link>
        <Link href="/feed" className="sy-cta-secondary px-5 py-3 text-[12px] font-bold uppercase tracking-[.14em]">
          Browse the feed
        </Link>
      </div>
    </main>
  );
}
