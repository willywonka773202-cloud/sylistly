/**
 * Style identity — a 5-tap quiz that returns a named persona (the Style-DNA
 * growth mechanic: gives the user an identity to share + tunes the feed).
 * Pure logic + localStorage; no backend. Used by the onboarding quiz, the
 * profile "your style" card, and sharing.
 */
import type { Profile } from '@/lib/types';
import type { GeneratorFrame, VibeId } from '@/lib/vibes';

export type Lane = 'street' | 'clean' | 'dressy' | 'sport';
export type Palette = 'neutral' | 'dark' | 'earth' | 'bold';
export type FitPref = 'oversized' | 'tailored' | 'relaxed';
export type BudgetPref = NonNullable<Profile['stylePrefs']['budget']>;

export interface StyleAnswers {
  lane: Lane;
  palette: Palette;
  fit: FitPref;
  budget: BudgetPref;
  frame: GeneratorFrame;
}

export interface StyleIdentity {
  id: string;
  name: string;
  tagline: string;
  /** Vibes this persona favors — seeds feed steering. First is primary. */
  vibes: VibeId[];
}

export const IDENTITIES: Record<string, StyleIdentity> = {
  'street-minimalist': {
    id: 'street-minimalist',
    name: 'Street Minimalist',
    tagline: 'Clean lines, street ease — neutral pieces that do the talking.',
    vibes: ['street', 'clean', 'cozy'],
  },
  'noir-edge': {
    id: 'noir-edge',
    name: 'Noir Edge',
    tagline: 'All-black instincts with a sharp edge. Dark, deliberate, a little dangerous.',
    vibes: ['edgy', 'night', 'street'],
  },
  'editorial-clean': {
    id: 'editorial-clean',
    name: 'Editorial Clean',
    tagline: 'Quiet luxury. Tailored, tonal, never trying too hard.',
    vibes: ['clean', 'office', 'preppy'],
  },
  'soft-romantic': {
    id: 'soft-romantic',
    name: 'Soft Romantic',
    tagline: 'Soft textures and easy elegance. Pretty without the fuss.',
    vibes: ['date', 'cozy', 'clean'],
  },
  'night-luxe': {
    id: 'night-luxe',
    name: 'Night Luxe',
    tagline: 'Built for the evening. Polished, fitted, and a little glossy.',
    vibes: ['night', 'date', 'edgy'],
  },
  'luxe-sport': {
    id: 'luxe-sport',
    name: 'Luxe Sport',
    tagline: 'Performance pieces styled like a fit. Sleek, active, effortless.',
    vibes: ['gym', 'street', 'clean'],
  },
  'earthy-roamer': {
    id: 'earthy-roamer',
    name: 'Earthy Roamer',
    tagline: 'Warm neutrals and linen ease. Made for sun and slow days.',
    vibes: ['vacation', 'cozy', 'clean'],
  },
  'bold-statement': {
    id: 'bold-statement',
    name: 'Bold Statement',
    tagline: 'Color and contrast on purpose. You came to be seen.',
    vibes: ['street', 'night', 'edgy'],
  },
};

/** Deterministic mapping from answers → persona. Every combo resolves. */
export function deriveIdentity(answers: StyleAnswers): StyleIdentity {
  const { lane, palette } = answers;
  let id = 'editorial-clean';

  if (lane === 'sport') {
    id = 'luxe-sport';
  } else if (lane === 'street') {
    if (palette === 'dark' || palette === 'bold') id = 'noir-edge';
    else if (palette === 'earth') id = 'earthy-roamer';
    else id = 'street-minimalist';
  } else if (lane === 'clean') {
    if (palette === 'dark') id = 'noir-edge';
    else if (palette === 'earth') id = 'earthy-roamer';
    else if (palette === 'bold') id = 'bold-statement';
    else id = 'editorial-clean';
  } else if (lane === 'dressy') {
    if (palette === 'dark' || palette === 'bold') id = 'night-luxe';
    else id = 'soft-romantic';
  }

  return IDENTITIES[id] || IDENTITIES['editorial-clean'];
}

const IDENTITY_KEY = 'sylistly.style-identity.v1';

export interface StoredIdentity {
  identityId: string;
  answers: StyleAnswers;
}

export function saveIdentity(answers: StyleAnswers, identity: StyleIdentity): void {
  if (typeof window === 'undefined') return;
  const payload: StoredIdentity = { identityId: identity.id, answers };
  window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(payload));
}

export function loadIdentity(): { identity: StyleIdentity; answers: StyleAnswers } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredIdentity;
    const identity = IDENTITIES[stored.identityId];
    return identity ? { identity, answers: stored.answers } : null;
  } catch {
    return null;
  }
}
