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
  return <div className="sy-route-enter">{children}</div>;
}
