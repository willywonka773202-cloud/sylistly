/**
 * Remix budget — persisted on this device (local-only, no account).
 *
 * The Remix board is the place users assemble a fit, so a per-device budget
 * cap belongs here, not in any backend. Storage key is namespaced under
 * `sylistly_remix_budget_v1` to avoid colliding with the prototype demo's
 * `sylistly_budget_v1` for users who have both open at any point.
 *
 * Values are stored as whole-dollar integers (matches how the UI surfaces the
 * budget; the underlying product prices stay in cents via `priceCents`).
 */

const STORAGE_KEY = 'sylistly_remix_budget_v1';

export function loadRemixBudgetFromStorage(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function persistRemixBudgetToStorage(budget: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  } catch {
    // Quota / private mode — budget just won't persist this session.
  }
}
