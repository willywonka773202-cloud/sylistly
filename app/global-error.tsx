'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary: catches errors in the ROOT layout itself (or in error.tsx),
 * which the per-route error.tsx cannot. It REPLACES the root layout, so it must
 * render its own <html>/<body> and lean on INLINE styles only — globals.css and
 * next/font may not have loaded if the layout is what failed. Brand colors are
 * hard-coded so the fallback still looks like Sylistly, not a raw stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[sylistly] global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D0D0F',
          color: '#FBF7F2',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          padding: '0 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#E7C79B',
            }}
          >
            Something slipped
          </div>
          <h1 style={{ margin: '12px 0 0', fontSize: 30, fontWeight: 600, lineHeight: 1.15 }}>
            Sylistly hit a snag.
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: 'rgba(251,247,242,.68)' }}>
            A hiccup on our end — your saved fits and pieces are safe. Give it another try.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              margin: '24px auto 0',
              display: 'block',
              width: '100%',
              maxWidth: 260,
              padding: '14px 20px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg,#FF2D6D,#FF5C8A)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
