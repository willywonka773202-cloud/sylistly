'use client';

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { Heart, ShoppingBag, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { HapticTap } from '@/components/HapticTap';

/**
 * FitDeck — the Tinder-style outfit card stack. The top card is draggable; drag
 * it past a threshold (or flick it) and it ROTATES + FLINGS off in that
 * direction, then the parent advances. Right = love (save), left = pass. Cards
 * behind peek through, scaled + offset, and spring forward as the top leaves.
 *
 * Honest by construction: the swipe just records YOUR decision — no fake match,
 * no "who liked you", no rigged scarcity. Reduced-motion: drag is disabled and
 * the buttons commit instantly (no fling animation).
 *
 * Each card owns its OWN motion value, and only the top card is draggable, so
 * promotion to the next card never flashes (the card underneath is already at
 * rest in the stack — it just gains drag + springs to the front).
 */

export interface DeckItem {
  key: string;
}

const SWIPE_OFF = 720; // px the card travels off-screen on a committed fling

export function FitDeck<T extends DeckItem>({
  cards,
  onSwipe,
  onShop,
  renderCard,
  burstColors,
}: {
  /** Visible window of the deck, top card first. */
  cards: T[];
  /** Fired AFTER the fling animation completes. */
  onSwipe: (card: T, dir: 'right' | 'left') => void;
  /** Shop the top look (button); optional. */
  onShop?: (card: T) => void;
  renderCard: (card: T, isTop: boolean) => ReactNode;
  /** Palette hexes for the love-commit burst, so a fit celebrates in its own colours. */
  burstColors?: (card: T) => string[];
}) {
  // The top card registers its fling fn here so the Pass/Love buttons can drive it.
  const flingRef = useRef<((dir: 'right' | 'left') => void) | null>(null);
  const top = cards[0];
  const visible = cards.slice(0, 3);

  // Keyboard parity for the swipe: ← passes, → loves. The deck IS the feed's
  // primary content, so left/right arrows don't conflict with scroll. Skipped
  // while an input is focused or a sheet/dialog is open over the deck. Reuses the
  // same flingRef the Pass/Love buttons drive; feed-only (unmounts on route nav).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!flingRef.current) return;
      flingRef.current(e.key === 'ArrowRight' ? 'right' : 'left');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="relative flex-1">
        {visible.map((card, depth) => (
          <SwipeCard
            key={card.key}
            depth={depth}
            isTop={depth === 0}
            onSwipe={(dir) => onSwipe(card, dir)}
            registerFling={depth === 0 ? (fn) => { flingRef.current = fn; } : undefined}
            burstColors={depth === 0 ? burstColors?.(card) : undefined}
          >
            {renderCard(card, depth === 0)}
          </SwipeCard>
        ))}
        {!top ? (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <div className="flex flex-col items-center">
              {/* "dealing fresh fits" — a small fanned deck gently floats */}
              <div className="relative mb-6 h-[72px] w-[56px]" aria-hidden>
                <span className="sy-deal-card absolute inset-0 rounded-xl border border-hairline-2 bg-surface-2/70" style={{ '--dr': '-11deg' } as React.CSSProperties} />
                <span className="sy-deal-card absolute inset-0 rounded-xl border border-hairline-2 bg-surface-2/90" style={{ '--dr': '0deg', animationDelay: '.22s' } as React.CSSProperties} />
                <span className="sy-deal-card absolute inset-0 rounded-xl border border-accent/40 bg-surface-3 shadow-pink-glow" style={{ '--dr': '11deg', animationDelay: '.44s' } as React.CSSProperties} />
              </div>
              <p className="font-serif text-[22px] italic text-ink">That&rsquo;s the deck</p>
              <p className="mt-2 text-[13px] text-muted">Fresh fits are loading — give it a sec.</p>
            </div>
          </div>
        ) : null}
      </div>

      <DeckControls
        onPass={() => flingRef.current?.('left')}
        onLove={() => flingRef.current?.('right')}
        onShop={onShop && top ? () => onShop(top) : undefined}
        disabled={!top}
      />
    </div>
  );
}

function SwipeCard({
  depth,
  isTop,
  onSwipe,
  registerFling,
  burstColors,
  children,
}: {
  depth: number;
  isTop: boolean;
  onSwipe: (dir: 'right' | 'left') => void;
  registerFling?: (fn: (dir: 'right' | 'left') => void) => void;
  burstColors?: string[];
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-14, 14]);
  const loveOpacity = useTransform(x, [30, 150], [0, 1]);
  const passOpacity = useTransform(x, [-150, -30], [1, 0]);
  const goneRef = useRef(false);
  const [burst, setBurst] = useState(false);

  const fling = useCallback(
    (dir: 'right' | 'left') => {
      if (goneRef.current) return;
      goneRef.current = true;
      if (reduce) {
        onSwipe(dir);
        return;
      }
      if (dir === 'right') setBurst(true);
      animate(x, dir === 'right' ? SWIPE_OFF : -SWIPE_OFF, {
        duration: 0.34,
        ease: [0.22, 0.9, 0.28, 1],
        onComplete: () => onSwipe(dir),
      });
    },
    [reduce, onSwipe, x],
  );

  useEffect(() => {
    if (isTop && registerFling) registerFling(fling);
  }, [isTop, registerFling, fling]);

  // One-time swipe-hint nudge: the very first top card (ever) gives a small
  // wiggle that flashes the Love/Pass stamps, teaching the swipe gesture the way
  // Tinder/Hinge do. Gated to once per device + skipped under reduced motion.
  useEffect(() => {
    if (!isTop || reduce) return;
    let hinted = true;
    try { hinted = localStorage.getItem('sylistly.swipe-hinted') === '1'; } catch { /* private mode */ }
    if (hinted || goneRef.current) return;
    const timer = window.setTimeout(() => {
      if (goneRef.current) return;
      try { localStorage.setItem('sylistly.swipe-hinted', '1'); } catch { /* private mode */ }
      animate(x, [0, 42, -28, 0], { duration: 1.15, ease: [0.4, 0, 0.2, 1], times: [0, 0.34, 0.68, 1] });
    }, 950);
    return () => window.clearTimeout(timer);
  }, [isTop, reduce, x]);

  const onDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 390;
      const commit = Math.min(w * 0.3, 130);
      if (info.offset.x > commit || info.velocity.x > 650) fling('right');
      else if (info.offset.x < -commit || info.velocity.x < -650) fling('left');
      else animate(x, 0, { type: 'spring', stiffness: 420, damping: 34 });
    },
    [fling, x],
  );

  // Resting pose for cards behind the top (peek through the stack).
  const restScale = 1 - depth * 0.05;
  const restY = depth * 18;

  return (
    <motion.div
      className="absolute inset-0"
      style={isTop ? { x, rotate, zIndex: 30 } : { zIndex: 30 - depth }}
      drag={isTop && !reduce ? 'x' : false}
      dragMomentum={false}
      dragElastic={0.55}
      onDragEnd={isTop ? onDragEnd : undefined}
      initial={false}
      animate={isTop ? { scale: 1, y: 0 } : { scale: restScale, y: restY }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {isTop ? (
        <>
          <motion.span
            aria-hidden
            style={{ opacity: loveOpacity }}
            className="pointer-events-none absolute left-5 top-7 z-40 -rotate-12 rounded-xl border-[3px] border-accent px-3 py-1 text-[26px] font-black uppercase tracking-[.14em] text-accent shadow-[0_0_24px_rgba(255,45,109,.5)]"
          >
            Love
          </motion.span>
          <motion.span
            aria-hidden
            style={{ opacity: passOpacity }}
            className="pointer-events-none absolute right-5 top-7 z-40 rotate-12 rounded-xl border-[3px] border-[#9aa3b2] px-3 py-1 text-[26px] font-black uppercase tracking-[.14em] text-[#9aa3b2] shadow-[0_0_24px_rgba(154,163,178,.35)]"
          >
            Pass
          </motion.span>
          {/* champagne sheen sweep as the card takes the top */}
          {!reduce ? (
            <span key="sheen" aria-hidden className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-card-lg">
              <span
                className="absolute inset-y-0 -left-1/3 w-1/3"
                style={{
                  background: 'linear-gradient(100deg,transparent,rgba(231,199,155,.3),transparent)',
                  animation: 'sy-shimmer-sweep 1.05s cubic-bezier(.2,.8,.2,1) .12s both',
                }}
              />
            </span>
          ) : null}
          {/* love-commit payoff: ring + heart burst */}
          {burst ? (
            <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center">
              <span className="absolute h-24 w-24 rounded-full border-2 border-accent" style={{ animation: 'sy-ring-burst .55s ease-out both' }} />
              <Heart
                size={88}
                fill="currentColor"
                className="text-accent drop-shadow-[0_0_24px_rgba(255,45,109,.7)]"
                style={{ animation: 'sy-heart-pop .6s ease-out both' }}
              />
              {/* The fit celebrates in ITS OWN palette — colour particles spray from
                  the heart, tying the love moment to the look's identity. */}
              {(burstColors || []).length
                ? Array.from({ length: 8 }).map((_, i) => {
                    const colors = burstColors as string[];
                    const angle = (i / 8) * Math.PI * 2;
                    const dist = 64 + (i % 3) * 16;
                    return (
                      <span
                        key={`burst-${i}`}
                        className="absolute h-2 w-2 rounded-full"
                        style={{
                          background: colors[i % colors.length],
                          '--dx': `${Math.round(Math.cos(angle) * dist)}px`,
                          '--dy': `${Math.round(Math.sin(angle) * dist)}px`,
                          '--rot': `${180 + i * 26}deg`,
                          animation: `sy-confetti .62s cubic-bezier(.2,.7,.3,1) ${i * 14}ms both`,
                        } as React.CSSProperties}
                      />
                    );
                  })
                : null}
            </div>
          ) : null}
        </>
      ) : null}
      {children}
      {!isTop ? <span aria-hidden className="pointer-events-none absolute inset-0 z-40 rounded-card-lg bg-black/35" /> : null}
    </motion.div>
  );
}

function DeckControls({
  onPass,
  onLove,
  onShop,
  disabled,
}: {
  onPass: () => void;
  onLove: () => void;
  onShop?: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-5 pb-1 pt-3">
      <CircleBtn label="Pass" onClick={onPass} disabled={disabled} className="h-14 w-14 border-hairline-2 bg-surface-2/80 text-muted-2 active:border-[#9aa3b2] active:text-[#cdd3dd]">
        <X size={24} strokeWidth={2.4} />
      </CircleBtn>
      {onShop ? (
        <CircleBtn label="Shop the look" onClick={onShop} disabled={disabled} className="h-12 w-12 border-hairline-2 bg-surface-2/80 text-ink">
          <ShoppingBag size={19} />
        </CircleBtn>
      ) : null}
      <CircleBtn label="Love it — save the fit" onClick={onLove} disabled={disabled} className="sy-glow-breathe h-16 w-16 border-accent bg-accent text-white shadow-pink-glow active:scale-90">
        <Heart size={28} fill="currentColor" />
      </CircleBtn>
    </div>
  );
}

function CircleBtn({
  label,
  onClick,
  disabled,
  className = '',
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <HapticTap
      ariaLabel={label}
      onTap={onClick}
      disabled={disabled}
      className={`sy-press grid place-items-center rounded-full border backdrop-blur-md transition disabled:opacity-40 ${className}`}
    >
      {children}
    </HapticTap>
  );
}
