/** UI bridge: taxonomy → lucide icons + label/format helpers. */
import {
  Briefcase, GraduationCap, Dumbbell, Heart, PartyPopper, Plane, Crown, Sun,
  Handshake, UtensilsCrossed, type LucideIcon,
} from 'lucide-react';
import {
  AESTHETICS, OCCASIONS_SOCIAL, FORMALITY_LABELS,
  type AestheticId, type OccasionKey, type Formality,
} from './social-types';

export const OCCASION_ICONS: Record<OccasionKey, LucideIcon> = {
  work: Briefcase,
  school: GraduationCap,
  gym: Dumbbell,
  date: Heart,
  party: PartyPopper,
  travel: Plane,
  formal: Crown,
  casual: Sun,
  interview: Handshake,
  dinner: UtensilsCrossed,
};

const AESTHETIC_MAP = new Map(AESTHETICS.map((a) => [a.id, a]));
const OCCASION_MAP = new Map(OCCASIONS_SOCIAL.map((o) => [o.key, o]));

export function aestheticLabel(id: AestheticId): string {
  return AESTHETIC_MAP.get(id)?.label ?? id;
}
export function aestheticSwatch(id: AestheticId): string {
  return AESTHETIC_MAP.get(id)?.swatch ?? '#a39d92';
}
export function occasionLabel(key?: OccasionKey): string {
  return key ? OCCASION_MAP.get(key)?.label ?? key : '';
}
export function occasionEmoji(key?: OccasionKey): string {
  return key ? OCCASION_MAP.get(key)?.emoji ?? '' : '';
}
export function formalityLabel(f: Formality): string {
  return FORMALITY_LABELS[f];
}

/* ---------- formatting ---------- */

export function centsToUsd(cents?: number): string {
  if (!cents && cents !== 0) return '';
  const dollars = cents / 100;
  return dollars >= 1000
    ? `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${Math.round(dollars)}`;
}

export function compactCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`.replace('.0k', 'k');
  return `${(n / 1_000_000).toFixed(1)}m`.replace('.0m', 'm');
}

export function timeAgo(iso: string, now: number = Date.UTC(2026, 4, 29, 12, 0, 0)): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}
