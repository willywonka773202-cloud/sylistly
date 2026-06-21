'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useHeavyVisuals, useReducedMotion } from '@/lib/visual-capability';

/**
 * CelebrationBurst — confetti + bloom v2 for milestones (Drop reveal, streak
 * save, level-up, first purchase). Richer than the legacy CSS DropBurst:
 * GPU-instanced foil confetti + additive bloom embers, rarity-scaled on `level`
 * 0–3 (matches lib/look-rarity).
 *
 * SSR safety: this wrapper is the ONLY thing imported by app/feature code. The
 * three.js scene lives in ./three/CelebrationScene and is pulled in via
 * next/dynamic({ ssr:false }) so three NEVER enters the server bundle and there
 * is no hydration <canvas>. Same proven pattern as components/three/Crate3D.tsx.
 *
 * Gating:
 *  - useReducedMotion()  → render NOTHING (honest reduced-motion fallback).
 *  - useHeavyVisuals()   → WebGL path; else a self-contained inline-keyframe CSS
 *                          spray (no dependency on globals.css .sy-confetti).
 *
 * Fire-once semantics: it self-completes after `durationMs` and calls
 * onComplete. To retrigger on the same mount, bump `key` or toggle `play`.
 */

const CelebrationScene = dynamic(() => import('./three/CelebrationScene'), {
  ssr: false,
  loading: () => null,
});

export interface CelebrationBurstProps {
  /** Rarity 0–3 (lib/look-rarity Rarity.level). Scales count/spread/glow. */
  level?: number;
  /** Accent hue (e.g. winner.rarity.hue). */
  hue?: string;
  /** Normalized origin in the viewport (0–1). Default center-ish (Drop reveal). */
  origin?: { x: number; y: number };
  /** Total lifetime in ms; the rAF loop hard-stops here. */
  durationMs?: number;
  /** Stacking. Drop reveal wants 60 (above the reveal). */
  zIndex?: number;
  /** Set false to keep mounted but idle. */
  play?: boolean;
  onComplete?: () => void;
}

export default function CelebrationBurst({
  level = 1,
  hue = '#FF2D6D',
  origin = { x: 0.5, y: 0.36 },
  durationMs = 2600,
  zIndex = 60,
  play = true,
  onComplete,
}: CelebrationBurstProps) {
  const reduced = useReducedMotion();
  const heavy = useHeavyVisuals();
  const [done, setDone] = useState(false);

  // CSS-fallback self-completion (the WebGL path completes inside the scene).
  useEffect(() => {
    if (reduced || heavy || !play || done) return;
    const t = setTimeout(() => {
      setDone(true);
      onComplete?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [reduced, heavy, play, done, durationMs, onComplete]);

  // Honest reduced-motion fallback: nothing animated, nothing rendered.
  if (reduced || !play || done) return null;

  if (heavy) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ zIndex }}
      >
        <CelebrationScene
          level={level}
          hue={hue}
          origin={origin}
          durationMs={durationMs}
          onComplete={() => {
            setDone(true);
            onComplete?.();
          }}
        />
      </div>
    );
  }

  return (
    <CssBurst level={level} hue={hue} origin={origin} zIndex={zIndex} />
  );
}

/* ── CSS fallback: self-contained, scoped keyframes, no globals.css dep ────── */

function CssBurst({
  level,
  hue,
  origin,
  zIndex,
}: {
  level: number;
  hue: string;
  origin: { x: number; y: number };
  zIndex: number;
}) {
  const count = 18 + level * 12;
  const colors = [hue, '#FFC24B', '#FFFFFF', '#FF2D6D'];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex }}
    >
      <style>{`
        @keyframes sycb-pop {
          0%   { transform: translate(-50%,-50%) translate(0,0) rotate(0deg); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translate(-50%,-50%) translate(var(--sycb-dx), var(--sycb-dy)) rotate(var(--sycb-rot)); opacity: 0; }
        }
        .sycb-chip { animation: sycb-pop 1700ms cubic-bezier(.18,.7,.32,1) forwards; will-change: transform, opacity; }
        @media (prefers-reduced-motion: reduce) { .sycb-chip { display: none; } }
      `}</style>
      <div
        className="absolute"
        style={{ left: `${origin.x * 100}%`, top: `${origin.y * 100}%` }}
      >
        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + (((i * 37) % 21) - 10) * 0.03;
          const dist = 120 + ((i * 53) % (90 + level * 40));
          const color = colors[i % colors.length];
          const size = 5 + (i % 4);
          const round = i % 3 === 0;
          return (
            <span
              key={i}
              className="sycb-chip absolute block"
              style={
                {
                  left: 0,
                  top: 0,
                  width: size,
                  height: round ? size : size * 2.4,
                  background: color,
                  borderRadius: round ? '9999px' : '2px',
                  boxShadow: `0 0 6px ${color}`,
                  animationDelay: `${(i % 8) * 24}ms`,
                  '--sycb-dx': `${Math.cos(angle) * dist}px`,
                  '--sycb-dy': `${Math.sin(angle) * dist - 30}px`,
                  '--sycb-rot': `${(i * 47) % 360}deg`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}
