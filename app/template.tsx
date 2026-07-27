'use client';

import type { ReactNode } from 'react';

/**
 * Re-mounts on every navigation (unlike layout.tsx), so a CSS entrance here
 * gives the whole app a subtle, consistent route transition. Opacity-only on
 * purpose: a transform would establish a containing block and break every
 * `position: fixed` element (bottom nav, modals, onboarding overlay). Honors
 * prefers-reduced-motion via the .sy-route-enter rule in globals.css.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="sy-route-enter">
      <span aria-hidden className="sy-route-wipe pointer-events-none fixed inset-y-0 left-1/2 z-[90] w-full max-w-[480px] -translate-x-1/2" />
      {children}
    </div>
  );
}
