'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface for observability; never show raw errors to the user.
    console.error('[sylistly] route error:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col items-center justify-center gap-6 bg-bg px-8 text-center">
      <div>
        <div className="sy-eyebrow">Something slipped</div>
        <h1 className="mt-2 font-serif text-[32px] font-semibold leading-tight text-ink">
          That look didn&rsquo;t load.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-2">
          A hiccup on our end — your saved fits and closet are safe. Give it another try.
        </p>
      </div>
      <div className="flex w-full max-w-[260px] flex-col gap-2.5">
        <button type="button" onClick={reset} className="sy-cta-primary px-5 py-3 text-[12px] font-bold uppercase tracking-[.14em]">
          Try again
        </button>
        <a href="/" className="sy-cta-secondary px-5 py-3 text-[12px] font-bold uppercase tracking-[.14em]">
          Back to home
        </a>
      </div>
    </main>
  );
}
