'use client';

import { useEffect } from 'react';

function isChunkError(error?: Error): boolean {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /ChunkLoadError|Loading chunk [\d]+ failed|Loading CSS chunk|Importing a module script failed/i.test(text);
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunkError = isChunkError(error);

  useEffect(() => {
    // Surface for observability; never show raw errors to the user.
    console.error('[sylistly] route error:', error);

    // Stale or missing JS chunks (common right after a deploy ships new hashes,
    // or on a flaky mobile connection) shouldn't strand the user on an error
    // page. Reload once to pull fresh chunks; a timestamp guard prevents an
    // infinite reload loop if the failure genuinely persists.
    if (typeof window !== 'undefined' && chunkError) {
      try {
        const KEY = 'sylistly.chunkReloadAt';
        const last = Number(sessionStorage.getItem(KEY) || '0');
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* sessionStorage blocked — fall through to the manual retry UI */
      }
    }
  }, [error, chunkError]);

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col items-center justify-center gap-6 overflow-hidden bg-bg px-8 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-8%,rgba(255,59,99,.18),transparent_46%)]" />
      <div className="relative">
        <div className="sy-eyebrow">Something slipped</div>
        <h1 className="mt-2 font-serif text-[34px] font-semibold leading-tight text-ink">
          That look didn&rsquo;t load.
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-2">
          A hiccup on our end — your saved fits and closet are safe. Give it another try.
        </p>
      </div>
      <div className="relative flex w-full max-w-[260px] flex-col gap-2.5">
        <button
          type="button"
          onClick={() => (chunkError && typeof window !== 'undefined' ? window.location.reload() : reset())}
          className="sy-cta-primary px-5 py-3 text-[12px] font-bold uppercase tracking-[.14em]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => { if (typeof window !== 'undefined') window.location.assign('/'); }}
          className="sy-cta-secondary px-5 py-3 text-[12px] font-bold uppercase tracking-[.14em]"
        >
          Back to home
        </button>
      </div>
    </main>
  );
}
