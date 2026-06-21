'use client';

/**
 * Zero-asset feedback engine — procedural Web Audio tones + haptics, gated by a
 * persisted mute toggle. No audio files to ship; every sound is synthesized so
 * it's instant and tiny. Powers the dopamine layer: swipe ticks, like/save
 * pops, and the rarity-scaled "reveal" chime.
 *
 * Haptics use navigator.vibrate (Android). iOS Safari has no Vibration API, and
 * the `<input type="checkbox" switch>` Taptic hack — programmatically click()ing
 * a switch's label — was PATCHED in iOS 26.5 (no longer fires on a synthetic
 * click). The only thing that still buzzes on iOS web is a REAL user tap landing
 * directly on a native switch control. So on iOS the haptic half lives in
 * components/HapticTap.tsx, which overlays an invisible real <input switch> on
 * each primary TAP target (taps only — the swipe-fling drag can't toggle one, so
 * it stays audio-only). This module owns the Android path + the shared mute gate
 * (subscribeMuted lets the overlay respect mute live); HapticTap reads it.
 */

const MUTE_KEY = 'sylistly.sound.muted';
let muted: boolean | null = null;
let ctx: AudioContext | null = null;
const muteListeners = new Set<() => void>();

export function isMuted(): boolean {
  if (muted === null) {
    if (typeof window === 'undefined') return false;
    try {
      muted = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      muted = false; // private mode / blocked storage — default to sound on
    }
  }
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      /* private mode / blocked — mute still applies for this session */
    }
  }
  muteListeners.forEach((fn) => fn());
}

/** Subscribe to mute changes (for useSyncExternalStore in the iOS haptic overlay). */
export function subscribeMuted(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  // Autoplay policy: the first call happens inside a tap/swipe gesture, so this resumes cleanly.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

interface ToneOpts {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  slideTo?: number;
  delay?: number;
}

function tone({ freq, dur = 0.12, type = 'sine', gain = 0.12, attack = 0.006, slideTo, delay = 0 }: ToneOpts): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export function haptic(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  // Respect reduced-motion: if the user has damped motion, don't buzz either —
  // keeps the tactile layer consistent with the visual one (sy-press disabled).
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

// Warm pentatonic notes (C5 D5 E5 G5 A5) — any subset sounds pleasant together.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0];

export const feedback = {
  /** A featherweight tick — sub-threshold swipe nudge. */
  tick(): void {
    if (isMuted()) return;
    tone({ freq: 900, dur: 0.045, type: 'triangle', gain: 0.04 });
    haptic(7);
  },
  /** A soft downward whoosh as a card advances. */
  swipe(): void {
    if (isMuted()) return;
    tone({ freq: 440, slideTo: 190, dur: 0.16, type: 'sine', gain: 0.06 });
    haptic(12);
  },
  /** A satisfying two-note rising pop for a like. */
  like(): void {
    if (isMuted()) return;
    tone({ freq: 660, dur: 0.09, type: 'sine', gain: 0.12 });
    tone({ freq: 990, dur: 0.13, type: 'sine', gain: 0.1, delay: 0.06 });
    haptic([14, 26, 20]);
  },
  /** A clean click for a save. */
  save(): void {
    if (isMuted()) return;
    tone({ freq: 523, dur: 0.08, type: 'triangle', gain: 0.1 });
    haptic(16);
  },
  /**
   * The rarity-scaled reveal chime as a new look lands. `level` 0–3 (everyday →
   * heat): rarer looks get a longer arpeggio, brighter timbre, stronger buzz.
   */
  reveal(level: number): void {
    if (isMuted()) return;
    const count = Math.max(1, Math.min(NOTES.length, 2 + level));
    const notes = NOTES.slice(0, count);
    notes.forEach((freq, i) =>
      tone({
        freq,
        dur: 0.2,
        type: i === notes.length - 1 ? 'triangle' : 'sine',
        gain: 0.07 + level * 0.014,
        delay: i * 0.05,
      }),
    );
    haptic(level >= 2 ? [10, 24, 12, 24, 22] : level >= 1 ? [12, 28, 16] : 10);
  },
  /**
   * A triumphant ascending fanfare for crossing a tier (level-up) — deliberately
   * DISTINCT from reveal()'s pentatonic chime: a rising major arpeggio (C5-E5-G5-C6)
   * that lands bright + high, with an escalating buzz. The "you earned this" sound.
   */
  levelUp(): void {
    if (isMuted()) return;
    const run = [523.25, 659.25, 783.99, 1046.5]; // C5 · E5 · G5 · C6 (major, rising)
    run.forEach((freq, i) =>
      tone({
        freq,
        dur: 0.24,
        type: i === run.length - 1 ? 'triangle' : 'sine',
        gain: 0.08 + i * 0.013,
        delay: i * 0.07,
      }),
    );
    haptic([14, 30, 20, 30, 48]); // escalating, lands on a strong final buzz
  },
};
