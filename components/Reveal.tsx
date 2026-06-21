'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-triggered "bloom" wrapper. Children start hidden (.sy-reveal) and
 * animate in (.sy-reveal-in) the first time they enter the viewport — the
 * signature high-end-grid feel (cards rising + fading + settling, staggered).
 *
 * Uses a getBoundingClientRect + scroll/resize check rather than
 * IntersectionObserver: it reveals above-the-fold items immediately on mount and
 * the rest as they scroll in, and (unlike IO, which silently never fires in some
 * headless/embedded webviews) it can NEVER leave content stuck invisible. The
 * listener is shared-free, passive, and self-removes once the item is shown.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  /** Stagger delay in ms (e.g. (index % columns) * 80). */
  delay?: number;
  className?: string;
  as?: 'div' | 'li';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setShown(true);
      window.removeEventListener('scroll', check, true);
      window.removeEventListener('resize', check);
    };
    const check = () => {
      if (done) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Reveal once the item's top crosses ~92% of the viewport (a touch before
      // fully in view, so it animates as it arrives).
      if (rect.top < vh * 0.92 && rect.bottom > 0) reveal();
    };
    check();
    if (!done) {
      // capture:true catches scrolls from inner scroll containers too.
      window.addEventListener('scroll', check, { passive: true, capture: true });
      window.addEventListener('resize', check);
    }
    return () => {
      window.removeEventListener('scroll', check, true);
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`sy-reveal ${shown ? 'sy-reveal-in' : ''} ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}
