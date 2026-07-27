'use client';

import { useEffect } from 'react';

/**
 * Pins a full-screen app route to the visible viewport on iOS.
 *
 * Safari's toolbar animates on any scroll gesture, which resizes the viewport
 * mid-gesture. On a route whose shell is one screen tall that shifts everything
 * under the thumb — and on the feed it moved the scroll-snap points, so a card
 * never locked in place. `.sy-app-locked` pins the body with `position: fixed`
 * (the only lock Safari honours — it ignores `overflow: hidden` here) so the
 * toolbar never animates at all.
 *
 * There is deliberately NO JavaScript height measurement here. Shells size
 * themselves in pure CSS with `100svh` — the small-viewport unit, which is
 * defined as the viewport with the toolbars showing and therefore never changes
 * as the toolbar animates. A measured height was worse in every way: it needed a
 * `resize` listener (whose re-measuring mid-gesture was the original snap bug),
 * and it read wrong on bfcache restore and rotation. `svh` is the same value
 * when correct and can't drift.
 *
 * On the feed this class is ALSO applied by a synchronous inline script in
 * app/page.tsx, so the document is locked before first paint rather than after
 * hydration. This hook stays the owner of removal on unmount.
 */
export function useAppViewportLock(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sy-app-locked');
    return () => root.classList.remove('sy-app-locked');
  }, []);
}
