'use client';

import { useEffect } from 'react';

/**
 * Freeze background scroll while a sheet/overlay is open (iOS-safe: position the
 * body instead of relying on `overflow: hidden`, which iOS Safari ignores).
 *
 * Reference-counted at module scope so nested/concurrent locks compose — e.g. a
 * CheckoutSheet opening over an already-locked build overlay. The body is frozen
 * once at the OUTERMOST scroll position and restored once when the last lock
 * releases. A naive per-caller lock would re-capture the already-zeroed
 * `scrollY` on the second lock and jump the page to the top.
 */
let lockCount = 0;
let savedScrollY = 0;
let saved: Record<string, string> = {};

function freeze() {
  savedScrollY = window.scrollY;
  const s = document.body.style;
  saved = {
    overflow: s.overflow,
    position: s.position,
    top: s.top,
    width: s.width,
    overscrollBehavior: s.overscrollBehavior,
  };
  s.overflow = 'hidden';
  s.position = 'fixed';
  s.top = `-${savedScrollY}px`;
  s.width = '100%';
  s.overscrollBehavior = 'none';
}

function thaw() {
  const s = document.body.style;
  s.overflow = saved.overflow;
  s.position = saved.position;
  s.top = saved.top;
  s.width = saved.width;
  s.overscrollBehavior = saved.overscrollBehavior;
  window.scrollTo(0, savedScrollY);
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (lockCount === 0) freeze();
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) thaw();
    };
  }, [locked]);
}
