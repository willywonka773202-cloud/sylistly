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
 * `--app-h` is measured ONCE. We deliberately do not listen for `resize`:
 * re-measuring on every toolbar twitch and keyboard open was the original bug.
 * Orientation is the only change that legitimately alters the height. Shells
 * fall back to `100svh` — the stable small-viewport unit — so a missed or zero
 * reading still yields a correct full-height screen rather than a collapsed one.
 */
export function useAppViewportLock(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sy-app-locked');
    const setHeight = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      if (h > 0) root.style.setProperty('--app-h', `${Math.round(h)}px`);
    };
    setHeight();
    window.addEventListener('orientationchange', setHeight);
    return () => {
      root.classList.remove('sy-app-locked');
      root.style.removeProperty('--app-h');
      window.removeEventListener('orientationchange', setHeight);
    };
  }, []);
}
