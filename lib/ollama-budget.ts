/**
 * Central cost governor for the Ollama (free-tier / cloud) composer used when
 * Anthropic is out of credits. Mirrors the shape of `lib/ai-budget.ts` so the
 * Ollama cloud bill can never quietly run unbounded either. The daily-spend
 * tracker also defends against an accidental runaway (a misconfigured loop,
 * a runaway client, a bad retry policy) by tripping the cap for the day.
 *
 * Controls (env):
 *   OLLAMA_DAILY_USD_CAP=10       → approx daily spend ceiling (UTC day).
 *                                   0/blank = no cap (NOT recommended in prod).
 *   OLLAMA_USD_PER_CALL=0.01      → flat per-call estimate when token counts
 *                                   aren't returned (cloud preview / local dev).
 *   OLLAMA_USD_PER_1K_TOKENS_IN   → when Ollama returns `prompt_eval_count`,
 *                                   cost in USD per 1K input tokens. 0 → fall
 *                                   back to OLLAMA_USD_PER_CALL.
 *   OLLAMA_USD_PER_1K_TOKENS_OUT  → same, for `eval_count` (output tokens).
 *
 * NOTE: state is in-memory per server instance. On multi-instance/serverless
 * the effective cap is (cap × warm instances) and is best-effort. The kill
 * switch is env-based so it IS globally effective. For an exact global cap,
 * back recordOllamaUsage/ollamaBudgetAvailableGlobal with the shared store in
 * lib/ai-usage-store.ts (the same one used for Anthropic).
 */

import { getGlobalSpendUsd, hasSharedUsageStore, recordGlobalSpendUsd } from './ai-usage-store';

interface OllamaTokenUsage {
  prompt_eval_count?: number | null;
  eval_count?: number | null;
}

let currentDay = '';
let spentTodayUsd = 0;
let callsToday = 0;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollover(): void {
  const day = utcDay();
  if (day !== currentDay) {
    currentDay = day;
    spentTodayUsd = 0;
    callsToday = 0;
  }
}

function budgetKilled(): boolean {
  const flag = process.env.OLLAMA_BUDGET_KILL?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'on';
}

export function ollamaDailyCapUsd(): number {
  const raw = process.env.OLLAMA_DAILY_USD_CAP;
  if (raw === undefined || raw.trim() === '') return 10; // sane default ceiling
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 10;
}

function perCallEstimateUsd(): number {
  const raw = process.env.OLLAMA_USD_PER_CALL;
  if (raw === undefined || raw.trim() === '') return 0.01;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0.01;
}

function per1kInUsd(): number {
  const raw = process.env.OLLAMA_USD_PER_1K_TOKENS_IN;
  if (raw === undefined) return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function per1kOutUsd(): number {
  const raw = process.env.OLLAMA_USD_PER_1K_TOKENS_OUT;
  if (raw === undefined) return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Estimate the USD cost of one Ollama compose call. Prefers real token counts
 * when the API returns them (non-streaming /api/chat responses include
 * prompt_eval_count + eval_count); otherwise falls back to the configured flat
 * per-call estimate. Always returns a non-negative finite number.
 */
export function estimateOllamaCostUsd(usage: OllamaTokenUsage | null | undefined): number {
  const inRate = per1kInUsd();
  const outRate = per1kOutUsd();
  if (usage && (inRate > 0 || outRate > 0)) {
    const inTokens = Math.max(0, usage.prompt_eval_count || 0);
    const outTokens = Math.max(0, usage.eval_count || 0);
    const computed = (inTokens / 1000) * inRate + (outTokens / 1000) * outRate;
    if (computed > 0) return computed;
  }
  return perCallEstimateUsd();
}

/** True if an Ollama compose call is permitted right now (not killed, under cap). */
export function ollamaBudgetAvailable(): boolean {
  if (budgetKilled()) return false;
  rollover();
  const cap = ollamaDailyCapUsd();
  if (cap <= 0) return true; // explicit "no cap"
  return spentTodayUsd < cap;
}

/** Record spend for a completed Ollama compose so the daily cap can trip. */
export function recordOllamaUsage(usage: OllamaTokenUsage | null | undefined): void {
  rollover();
  const cost = estimateOllamaCostUsd(usage);
  if (cost > 0) {
    spentTodayUsd += cost;
    callsToday += 1;
    void recordGlobalSpendUsd(cost);
  }
}

// Short cache of the shared-store total so we don't add a round-trip per request.
let globalCache = { at: 0, usd: 0 };

/**
 * Async budget gate for the route layer: enforces the kill switch, the shared
 * GLOBAL daily cap (exact across instances, when a store is configured), and
 * the local in-memory cap as a backstop. Routes await this; deep call sites
 * keep the sync ollamaBudgetAvailable() check.
 */
export async function ollamaBudgetAvailableGlobal(): Promise<boolean> {
  if (!ollamaBudgetAvailable()) return false;
  const cap = ollamaDailyCapUsd();
  if (cap <= 0 || !hasSharedUsageStore()) return true;
  const now = Date.now();
  if (now - globalCache.at > 15_000) {
    // Reuse the Anthropic shared store: the per-day key aggregates both
    // providers' spend so the configured cap is a global ceiling across
    // Anthropic + Ollama — the safer default. If you want provider-separated
    // global caps, add a separate key in lib/ai-usage-store.ts.
    const total = await getGlobalSpendUsd();
    if (total !== null) globalCache = { at: now, usd: total };
  }
  return globalCache.usd < cap;
}

export function ollamaBudgetSnapshot(): {
  day: string;
  spentUsd: number;
  capUsd: number;
  callsToday: number;
  killed: boolean;
} {
  rollover();
  return {
    day: currentDay,
    spentUsd: Number(spentTodayUsd.toFixed(4)),
    capUsd: ollamaDailyCapUsd(),
    callsToday,
    killed: budgetKilled(),
  };
}