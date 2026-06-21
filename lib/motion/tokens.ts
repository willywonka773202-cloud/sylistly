/**
 * Motion design tokens — ONE vocabulary for every animation (framer-motion +
 * CSS custom props in globals.css). Cohesion + a deliberate ~100-200ms beat is
 * the cheapest thing that reads as Stripe/Apple/Linear-grade instead of
 * AI-generic. Import these instead of hand-typing easings/springs per component.
 */

// Cubic-bezier control points (framer-motion `ease`, also mirrored as CSS vars).
export const EASE = {
  out: [0.22, 0.9, 0.28, 1] as [number, number, number, number], // standard decel
  emphasized: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  spring: [0.34, 1.4, 0.5, 1] as [number, number, number, number], // soft overshoot
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
  expo: [0.16, 1, 0.3, 1] as [number, number, number, number], // long, luxe decel
  anticipate: [0.36, 0, 0.66, -0.4] as [number, number, number, number], // wind-up then go
} as const;

// Durations in seconds (framer-motion). CSS gets the ms mirror in :root.
export const DUR = { fast: 0.16, base: 0.28, slow: 0.5, lavish: 0.8 } as const;

// framer-motion spring presets.
export const SPRING = {
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 },
  bouncy: { type: 'spring', stiffness: 520, damping: 18, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 180, damping: 26, mass: 0.9 },
} as const;

// Shared interaction gestures.
export const TAP = { scale: 0.95 } as const; // whileTap for buttons/cards
export const PRESS = { scale: 0.92 } as const; // firmer press for big CTAs

// Staggered-children defaults.
export const STAGGER = { staggerChildren: 0.06, delayChildren: 0.04 } as const;

/** Collapse every motion to a flat fade when the user prefers reduced motion. */
export function withReducedMotion<T extends object>(transition: T, reduced: boolean): T | { duration: number } {
  return reduced ? { duration: 0.12 } : transition;
}
