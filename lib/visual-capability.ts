'use client';

import { useEffect, useState } from 'react';

/**
 * Capability gate for the high-end visual layer (WebGL/3D, shaders, heavy
 * motion). Everything fancy mounts behind this so it NEVER breaks SSR, never
 * fights prefers-reduced-motion, and degrades gracefully on weak phones / data
 * saver. Heavy surfaces should default to the cheap path during SSR + first
 * paint (these all return the safe value until mounted) and upgrade after.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersReducedData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!conn) return false;
  return Boolean(conn.saveData) || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

/** Rough "this device will struggle with WebGL" heuristic. */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if (typeof mem === 'number' && mem > 0 && mem <= 3) return true;
  if (typeof cores === 'number' && cores > 0 && cores <= 2) return true;
  return false;
}

let webglCache: boolean | null = null;
export function supportsWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    webglCache = Boolean(gl);
    // free it
    const lose = gl && (gl.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null);
    lose?.loseContext?.();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/** Should we render the full WebGL/3D experience (vs the CSS fallback)? */
export function heavyVisualsAllowed(): boolean {
  return supportsWebGL() && !prefersReducedMotion() && !prefersReducedData();
}

/**
 * Clamp devicePixelRatio for WebGL — full DPR on phones murders the GPU. ~1.5 is
 * the sweet spot; low-power devices get 1.
 */
export function targetDpr(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  if (isLowPowerDevice()) return 1;
  return Math.min(dpr, 1.5);
}

// ── React hooks (client; safe default until mounted to avoid hydration drift) ─
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

/**
 * `false` on the server + first client render (so we never SSR a <canvas> or
 * cause hydration mismatch), then resolves to the real capability after mount.
 */
export function useHeavyVisuals(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    setAllowed(heavyVisualsAllowed());
  }, []);
  return allowed;
}
