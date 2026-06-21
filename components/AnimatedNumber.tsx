'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/visual-capability';

/**
 * Premium count-up. Animates from 0 (on mount) — or from the currently-shown
 * value on change — to `value`, easing out, then formats. Reduced-motion shows
 * the final value instantly. rAF is cancelled on unmount/value-change so it
 * never leaks or races. Deliberately small + correct (the swarm's draft was the
 * opposite).
 *
 * `currentRef` tracks the value ON SCREEN (updated every frame), so a fresh
 * effect run always resumes from where the number actually is — which makes it
 * (a) StrictMode-safe: dev's setup→cleanup→setup no longer leaves from===to and
 * bails before animating, and (b) smooth when `value` changes mid-count (resume
 * from the live position, not from the old target). The cleanup only cancels
 * timers; it never rewrites the baseline.
 */
export function AnimatedNumber({
  value,
  format,
  durationMs = 700,
  className,
}: {
  value: number;
  /** Render the (rounded) running value, e.g. n => `$${n.toLocaleString()}`. */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0); // the value currently on screen
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const to = value;
    if (reduced) {
      currentRef.current = to;
      setDisplay(to);
      return;
    }
    const from = currentRef.current;
    if (from === to) return; // already there (display === currentRef invariant)
    let start: number | null = null;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      const v = Math.round(from + (to - from) * easeOut(t));
      currentRef.current = v;
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    // Backstop: if rAF stalls (backgrounded tab, headless), snap to the real
    // value so the number is never stuck mid-count (e.g. a price showing $0).
    const backstop = window.setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      currentRef.current = to;
      setDisplay(to);
    }, durationMs + 250);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(backstop);
    };
  }, [value, durationMs, reduced]);

  return <span className={className}>{format ? format(display) : display}</span>;
}
