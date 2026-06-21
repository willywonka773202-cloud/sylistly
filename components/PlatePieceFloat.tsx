'use client';

/**
 * PlatePieceFloat — 3D garment "float & cast-shadow" hover for individual plate
 * pieces (the transparent-cutout garments that make up an outfit collage).
 *
 * What it does
 * ────────────
 * On pointer hover / touch / focus, the piece lifts off the studio-grey stage on
 * a real CSS 3D plane: it tilts toward the cursor (perspective + rotateX/rotateY),
 * rises on translateZ, and casts a SEPARATE, ground-projected shadow whose
 * offset, blur, scale and opacity all track the tilt + lift — so it reads like a
 * physical garment levitating above the plate, not a flat box-shadow. An idle
 * micro-bob keeps it "alive" even without pointer movement.
 *
 * Why it's built this way
 * ───────────────────────
 * • SSR-safe: no window/document at module scope; all measurement happens in
 *   effects / event handlers after mount.
 * • Mobile-perf: a SINGLE shared rAF runs only while hovering/pressing; pointer
 *   samples are stored in refs and committed to the DOM via CSS custom props
 *   (no React re-render per frame). DPR is clamped via targetDpr() so the
 *   blur/shadow work stays cheap on phones. Everything is torn down on unmount.
 * • Reduced-motion / low-capability respectful: useReducedMotion() and
 *   useHeavyVisuals() collapse the effect to a tasteful static elevation with a
 *   pure CSS fallback — no transforms, no rAF, no listeners attached.
 *
 * Fully self-contained — drop it around any plate piece (an <img>, a
 * <ProductImage/>, or arbitrary children) and pass data via props.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import {
  targetDpr,
  useHeavyVisuals,
  useReducedMotion,
} from '@/lib/visual-capability';

export interface PlatePieceFloatProps {
  /** The garment cutout to float. Pass an <img>, <ProductImage/>, etc. */
  children: ReactNode;

  /**
   * Max tilt in degrees toward the pointer. Lower = subtler / more luxe.
   * @default 14
   */
  maxTilt?: number;
  /**
   * How high the piece lifts toward the viewer (translateZ, px) at full hover.
   * @default 46
   */
  lift?: number;
  /**
   * Perspective depth (px) of the 3D scene. Smaller = more dramatic foreshorten.
   * @default 900
   */
  perspective?: number;
  /**
   * Idle "alive" micro-float amplitude (px). Set 0 to disable the idle bob.
   * @default 4
   */
  idleFloat?: number;
  /**
   * Tint of the cast shadow. Editorial-Noir studio stage wants a warm brown.
   * @default 'rgba(34, 18, 10, 0.42)'
   */
  shadowColor?: string;
  /**
   * Disable the interactive float (e.g. while the parent plate is dragging /
   * swiping). Collapses to resting state without unmounting.
   * @default false
   */
  disabled?: boolean;

  /** Optional click/activate handler (keyboard-accessible). */
  onActivate?: () => void;
  /** Accessible label when onActivate is provided (makes it a button). */
  label?: string;

  className?: string;
  style?: CSSProperties;
}

/** Springy interpolation toward a target; frame-rate-aware via dt. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export default function PlatePieceFloat({
  children,
  maxTilt = 14,
  lift = 46,
  perspective = 900,
  idleFloat = 4,
  shadowColor = 'rgba(34, 18, 10, 0.42)',
  disabled = false,
  onActivate,
  label,
  className,
  style,
}: PlatePieceFloatProps) {
  const reducedMotion = useReducedMotion();
  const heavy = useHeavyVisuals();
  // Full 3D float only when the device opts into heavy visuals AND the user
  // hasn't asked for reduced motion. Otherwise: static, CSS-only elevation.
  const interactive = heavy && !reducedMotion && !disabled;

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  // ── Animation state lives in refs so per-frame updates never re-render ──────
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastTsRef = useRef(0);
  const startTsRef = useRef(0);

  // Pointer target (normalized -1..1 from center) + current eased values.
  const target = useRef({ x: 0, y: 0, hover: 0 }); // hover: 0 rest → 1 active
  const cur = useRef({ x: 0, y: 0, hover: 0 });

  // Clamp shadow/blur cost on weak phones.
  const dprScale = useRef(1);

  const [isPointer, setIsPointer] = useState(false); // drives the resting class only

  // Commit current eased state to the DOM via CSS variables (cheap, no React).
  const commit = useCallback(
    (now: number) => {
      const card = cardRef.current;
      const shadow = shadowRef.current;
      if (!card) return;

      const { x, y, hover } = cur.current;

      // Idle micro-bob: a slow sine that only contributes when not fully lifted,
      // so the resting plate feels alive but the lifted piece stays steady.
      const idlePhase = (now - startTsRef.current) / 1000;
      const idle =
        idleFloat > 0
          ? Math.sin(idlePhase * 1.6) * idleFloat * (1 - hover * 0.7)
          : 0;

      const rotX = -y * maxTilt * hover; // tilt top back when pointer is high
      const rotY = x * maxTilt * hover;
      const tz = lift * hover;

      card.style.setProperty('--ppf-rx', `${rotX.toFixed(2)}deg`);
      card.style.setProperty('--ppf-ry', `${rotY.toFixed(2)}deg`);
      card.style.setProperty('--ppf-tz', `${tz.toFixed(2)}px`);
      card.style.setProperty('--ppf-idle', `${idle.toFixed(2)}px`);

      if (shadow) {
        // Cast shadow is a ground-projected ellipse that drifts OPPOSITE the
        // tilt and grows softer/larger/dimmer as the piece rises — physical
        // levitation, not a glued box-shadow.
        const sx = -x * (28 + 22 * hover); // px drift
        const sy = 18 + 30 * hover + -y * 10; // sits lower as it lifts
        const blur = (10 + 26 * hover) * dprScale.current;
        const scale = 1 + 0.18 * hover;
        const squash = 1 - 0.12 * hover; // flatten the ellipse as it climbs
        const opacity = 0.85 - 0.42 * hover;

        shadow.style.setProperty('--ppf-sx', `${sx.toFixed(2)}px`);
        shadow.style.setProperty('--ppf-sy', `${sy.toFixed(2)}px`);
        shadow.style.setProperty('--ppf-sblur', `${blur.toFixed(2)}px`);
        shadow.style.setProperty('--ppf-sscale', scale.toFixed(3));
        shadow.style.setProperty('--ppf-ssquash', squash.toFixed(3));
        shadow.style.setProperty('--ppf-sopacity', opacity.toFixed(3));
      }
    },
    [idleFloat, lift, maxTilt],
  );

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      if (!runningRef.current) return;
      const dt = Math.min(0.05, (now - lastTsRef.current) / 1000 || 0.016);
      lastTsRef.current = now;

      const t = target.current;
      const c = cur.current;
      // Pointer tilt eases quickly; hover lift/settle a touch slower & springier.
      c.x = damp(c.x, t.x, 12, dt);
      c.y = damp(c.y, t.y, 12, dt);
      c.hover = damp(c.hover, t.hover, 9, dt);

      commit(now);

      // Settle test: once we've reached rest AND there's no idle motion needed,
      // stop the rAF entirely to save battery. Idle bob keeps it alive while hovered.
      const settled =
        Math.abs(c.x - t.x) < 0.001 &&
        Math.abs(c.y - t.y) < 0.001 &&
        Math.abs(c.hover - t.hover) < 0.001;
      const needsIdle = idleFloat > 0 && t.hover > 0.001;

      if (settled && !needsIdle) {
        // snap exact, final commit, then idle.
        c.x = t.x;
        c.y = t.y;
        c.hover = t.hover;
        commit(now);
        stopLoop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [commit, idleFloat, stopLoop],
  );

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTsRef.current = performance.now();
    if (startTsRef.current === 0) startTsRef.current = lastTsRef.current;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // ── Pointer handlers (only wired when interactive) ─────────────────────────
  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const root = rootRef.current;
      if (!root) return;
      const r = root.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // Normalize to -1..1 around center.
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      target.current.x = Math.max(-1, Math.min(1, nx));
      target.current.y = Math.max(-1, Math.min(1, ny));
      startLoop();
    },
    [startLoop],
  );

  const enter = useCallback(() => {
    target.current.hover = 1;
    setIsPointer(true);
    startLoop();
  }, [startLoop]);

  const leave = useCallback(() => {
    target.current.hover = 0;
    target.current.x = 0;
    target.current.y = 0;
    setIsPointer(false);
    startLoop();
  }, [startLoop]);

  // Measure DPR clamp once mounted (clamps shadow blur cost on phones).
  useEffect(() => {
    dprScale.current = Math.min(targetDpr(), 1.5);
  }, []);

  // When the effect goes inactive (reduced motion / disabled / unmount), reset
  // to a clean resting state and kill the loop + any inline transforms.
  useEffect(() => {
    if (interactive) return;
    target.current = { x: 0, y: 0, hover: 0 };
    cur.current = { x: 0, y: 0, hover: 0 };
    stopLoop();
    setIsPointer(false);
    const card = cardRef.current;
    if (card) {
      card.style.removeProperty('--ppf-rx');
      card.style.removeProperty('--ppf-ry');
      card.style.removeProperty('--ppf-tz');
      card.style.removeProperty('--ppf-idle');
    }
  }, [interactive, stopLoop]);

  // Hard teardown on unmount.
  useEffect(() => () => stopLoop(), [stopLoop]);

  const isButton = typeof onActivate === 'function';

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isButton) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate?.();
      }
    },
    [isButton, onActivate],
  );

  const rootStyle = useMemo<CSSProperties>(
    () => ({
      perspective: interactive ? `${perspective}px` : undefined,
      // Lift the scene a touch so the perspective origin sits above the piece —
      // garments read better tilting "away" at the top.
      perspectiveOrigin: '50% 35%',
      ...style,
    }),
    [interactive, perspective, style],
  );

  // Self-contained scoped CSS (no styled-jsx / Tailwind plugin dependency).
  // Scoped by a per-instance class so multiple plates never collide. useId()
  // is stable across SSR + client → no hydration drift. Dynamic per-frame
  // values come from CSS variables set imperatively in commit().
  const rawId = useId();
  const scope = useMemo(
    () => `ppf-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [rawId],
  );
  const css = useMemo(() => buildCss(scope, shadowColor), [scope, shadowColor]);

  return (
    <div
      ref={rootRef}
      className={[scope, 'ppf-root', className].filter(Boolean).join(' ')}
      style={rootStyle}
      onPointerEnter={interactive ? enter : undefined}
      onPointerMove={interactive ? handleMove : undefined}
      onPointerLeave={interactive ? leave : undefined}
      onPointerCancel={interactive ? leave : undefined}
      data-interactive={interactive ? 'true' : 'false'}
      data-active={isPointer ? 'true' : 'false'}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Ground-projected cast shadow (sibling, not a box-shadow on the card). */}
      <div ref={shadowRef} className="ppf-shadow" aria-hidden="true" />

      {/* The floating garment plane. */}
      <div
        ref={cardRef}
        className="ppf-card"
        role={isButton ? 'button' : undefined}
        tabIndex={isButton ? 0 : undefined}
        aria-label={isButton ? label : undefined}
        onClick={isButton ? onActivate : undefined}
        onKeyDown={onKeyDown}
        onFocus={interactive ? enter : undefined}
        onBlur={interactive ? leave : undefined}
      >
        {children}
      </div>
    </div>
  );
}

// ── Scoped-style helpers ─────────────────────────────────────────────────────

function buildCss(scope: string, shadowColor: string): string {
  const s = `.${scope}`;
  return `
${s}.ppf-root {
  position: relative;
  display: inline-block;
  width: 100%;
  height: 100%;
  isolation: isolate;
}
${s} .ppf-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform-origin: 50% 60%;
  --ppf-rx: 0deg;
  --ppf-ry: 0deg;
  --ppf-tz: 0px;
  --ppf-idle: 0px;
  transform: translate3d(0, var(--ppf-idle), 0) translateZ(var(--ppf-tz)) rotateX(var(--ppf-rx)) rotateY(var(--ppf-ry));
  outline: none;
}
${s} .ppf-card:focus-visible {
  outline: 2px solid var(--accent, #ff2d6d);
  outline-offset: 4px;
  border-radius: 14px;
}
${s} .ppf-shadow {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: 62%;
  height: 16%;
  --ppf-sx: 0px;
  --ppf-sy: 18px;
  --ppf-sblur: 10px;
  --ppf-sscale: 1;
  --ppf-ssquash: 1;
  --ppf-sopacity: 0.85;
  transform: translate3d(calc(-50% + var(--ppf-sx)), var(--ppf-sy), 0) scale(var(--ppf-sscale), var(--ppf-ssquash));
  transform-origin: 50% 50%;
  opacity: var(--ppf-sopacity);
  border-radius: 50%;
  background: radial-gradient(ellipse at center, ${shadowColor} 0%, color-mix(in srgb, ${shadowColor} 55%, transparent) 45%, transparent 72%);
  filter: blur(var(--ppf-sblur));
  pointer-events: none;
  will-change: transform, opacity, filter;
}
${s}[data-interactive="true"] .ppf-card { will-change: transform; }
${s}[data-interactive="false"] .ppf-card { transform: none; will-change: auto; }
${s}[data-interactive="false"] .ppf-shadow {
  transform: translate3d(-50%, 14px, 0) scale(1, 0.92);
  opacity: 0.7;
  filter: blur(13px);
  will-change: auto;
  transition: opacity 200ms ease, transform 200ms ease;
}
@media (hover: hover) and (pointer: fine) {
  ${s}[data-interactive="false"]:hover .ppf-shadow {
    opacity: 0.5;
    transform: translate3d(-50%, 20px, 0) scale(1.08, 0.86);
    filter: blur(18px);
  }
}
@media (prefers-reduced-motion: reduce) {
  ${s} .ppf-card { transform: none !important; }
  ${s} .ppf-shadow { transition: none !important; }
}
`;
}
