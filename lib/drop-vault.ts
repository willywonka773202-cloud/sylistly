import { CLIENT_CATALOG_PRODUCTS } from './client-catalog';
import type { Product } from './types';
import type { RarityTier } from './look-rarity';

/**
 * Drop progression state — the honest "addictive" layer: a daily STREAK (with a
 * one-time freeze + milestone rewards) and a collectible VAULT of every fit
 * you've pulled. All localStorage, all real counts — no fake numbers, no loss
 * baiting. The streak rewards are genuinely earned; the vault is just a record
 * of looks you actually revealed. See [[sylistly-dopamine-direction]].
 */

const LAST_KEY = 'sylistly.drop.last';
const STREAK_KEY = 'sylistly.drop.streak';
const BEST_KEY = 'sylistly.drop.best';
const FREEZE_KEY = 'sylistly.drop.freezes';
const VAULT_KEY = 'sylistly.drop.vault';
const VAULT_CAP = 80;

function ls(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function daysApart(aKey: string, b: Date): number {
  const [y, m, d] = aKey.split('-').map(Number);
  if (!y) return Infinity;
  const a = new Date(y, m - 1, d);
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - a.getTime()) / 86_400_000);
}

// ── Streak ─────────────────────────────────────────────────────────────────
export function dropClaimedToday(): boolean {
  const store = ls();
  return Boolean(store && store.getItem(LAST_KEY) === dayKey(new Date()));
}

export function currentStreak(): number {
  const store = ls();
  return store ? parseInt(store.getItem(STREAK_KEY) || '0', 10) || 0 : 0;
}

export function bestStreak(): number {
  const store = ls();
  return store ? parseInt(store.getItem(BEST_KEY) || '0', 10) || 0 : 0;
}

/** Freeze tokens left (everyone starts with 1; earned back at milestones). */
export function streakFreezes(): number {
  const store = ls();
  if (!store) return 0;
  const raw = store.getItem(FREEZE_KEY);
  return raw === null ? 1 : parseInt(raw, 10) || 0;
}

/**
 * Records today's claim and returns the new streak. Idempotent per day.
 * Yesterday → +1. Missed exactly one day but a freeze is available → bridge it
 * (consume a freeze, +1). Otherwise → reset to 1.
 */
export function claimStreak(): number {
  const store = ls();
  if (!store) return 1;
  const today = new Date();
  const tKey = dayKey(today);
  const last = store.getItem(LAST_KEY);
  let streak = currentStreak();

  if (last === tKey) return streak || 1; // already claimed today

  const gap = last ? daysApart(last, today) : Infinity;
  if (gap === 1) {
    streak += 1;
  } else if (gap === 2 && streakFreezes() > 0) {
    streak += 1;
    store.setItem(FREEZE_KEY, String(streakFreezes() - 1)); // bridge the missed day
  } else {
    streak = 1;
  }

  store.setItem(LAST_KEY, tKey);
  store.setItem(STREAK_KEY, String(streak));
  if (streak > bestStreak()) store.setItem(BEST_KEY, String(streak));
  return streak;
}

// ── Milestones ───────────────────────────────────────────────────────────────
export interface Milestone {
  day: number;
  title: string;
  reward: string;
}

export const MILESTONES: Milestone[] = [
  { day: 3, title: 'Bonus crate', reward: 'A second crate to open, free' },
  { day: 7, title: 'Standout guaranteed', reward: "A week's reward: a showpiece-tier fit" },
  { day: 14, title: 'Heat unlocked', reward: 'Two weeks in — a Heat-tier drop' },
];

export function nextMilestone(streak: number): Milestone | null {
  return MILESTONES.find((m) => m.day > streak) ?? null;
}

/** The highest milestone the current streak has reached (null if none yet). */
export function reachedMilestone(streak: number): Milestone | null {
  let hit: Milestone | null = null;
  for (const m of MILESTONES) if (streak >= m.day) hit = m;
  return hit;
}

// ── Vault (collection of pulls) ──────────────────────────────────────────────
export interface VaultEntry {
  key: string;
  label: string;
  tier: RarityTier;
  level: number;
  productIds: string[];
  at: string;
}

export function getVault(): VaultEntry[] {
  const store = ls();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(VAULT_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as VaultEntry[]) : [];
  } catch {
    return [];
  }
}

/** Add a pull to the vault (newest first, deduped by key, capped). */
export function recordPull(entry: Omit<VaultEntry, 'at'>): void {
  const store = ls();
  if (!store || !entry.key) return;
  const vault = getVault().filter((v) => v.key !== entry.key);
  vault.unshift({ ...entry, at: dayKey(new Date()) });
  store.setItem(VAULT_KEY, JSON.stringify(vault.slice(0, VAULT_CAP)));
}

export interface VaultStats {
  total: number;
  byTier: Record<RarityTier, number>;
}

export function vaultStats(): VaultStats {
  const byTier: Record<RarityTier, number> = { everyday: 0, standout: 0, showpiece: 0, heat: 0 };
  const vault = getVault();
  for (const entry of vault) if (byTier[entry.tier] !== undefined) byTier[entry.tier] += 1;
  return { total: vault.length, byTier };
}

const BY_ID = new Map(CLIENT_CATALOG_PRODUCTS.map((product) => [product.id, product]));

/** Rehydrate a vault entry's products from the catalog (for re-shop/re-view). */
export function rehydratePull(entry: VaultEntry): Product[] {
  return entry.productIds.map((id) => BY_ID.get(id)).filter((p): p is Product => Boolean(p));
}
