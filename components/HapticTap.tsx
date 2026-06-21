'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { isMuted, subscribeMuted } from '@/lib/feedback';

/**
 * iOS web haptics — the only trick that survived iOS 26.5. Android buzzes via
 * navigator.vibrate (see lib/feedback.ts); iOS Safari has no Vibration API and
 * the old programmatic-click switch hack was PATCHED. The single thing that
 * still fires the system Taptic is a REAL finger landing DIRECTLY on a native
 * <input type="checkbox" switch>. So on iOS we lay an invisible, real switch on
 * top of the tap target: the finger toggles it → iOS plays its tick. The styled
 * <button> underneath is decoration but stays the keyboard / VoiceOver target
 * (the switch is aria-hidden), so a11y is unchanged.
 *
 * Gating mirrors the Android path in feedback.ts: when muted OR reduced-motion,
 * the switch goes pointer-events:none and the tap falls through to the button
 * (action still fires, no buzz). Drag gestures (FitDeck fling) can't toggle a
 * switch, so swipe-to-love/pass stays audio-only on iOS — taps only here.
 *
 * VERIFY ON A REAL IPHONE (iOS 26.5+): no simulator or headless browser buzzes.
 */

// iOS Safari is the platform with NO Vibration API — that absence is our gate.
const isIOSWeb = typeof navigator !== 'undefined' && typeof navigator.vibrate !== 'function';

// `switch` is a Safari-only boolean attribute and unknown to React's JSX types,
// so we set it on the real element via ref (a stable fn — no per-render churn).
function makeSwitch(el: HTMLInputElement | null) {
  el?.setAttribute('switch', '');
}

export function HapticTap({
  onTap,
  disabled = false,
  ariaLabel,
  className = '',
  style,
  type = 'button',
  children,
}: {
  onTap: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
  children: ReactNode;
}) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  const reduce = useReducedMotion();
  // Only mount the overlay after hydration — SSR/first render must match the
  // server (which always sees the bare button) or React warns on mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const button = (
    <button type={type} aria-label={ariaLabel} onClick={onTap} disabled={disabled} className={className} style={style}>
      {children}
    </button>
  );

  if (!isIOSWeb || disabled || !mounted) return button;

  const hapticsLive = !muted && !reduce;

  return (
    // :has(input:active) reproduces the press feel the button loses once the
    // switch sits on top of it — one place, uniform across every wrapped tap.
    <span className="relative inline-grid transition-transform [&:has(input:active)]:scale-95">
      {button}
      <input
        type="checkbox"
        aria-hidden
        tabIndex={-1}
        ref={makeSwitch}
        onChange={onTap}
        className={`absolute inset-0 z-10 m-0 h-full w-full opacity-0 ${hapticsLive ? 'cursor-pointer' : 'pointer-events-none'}`}
      />
    </span>
  );
}
