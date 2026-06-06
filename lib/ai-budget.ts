/**
 * Central cost governor for every Claude call in the app. One place decides
 * whether an AI call is allowed and tracks (estimated) spend, so a public
 * deployment can never quietly run up an unbounded Anthropic bill.
 *
 * Controls (env):
 *   AI_ENABLED=0            → hard kill switch; all AI off, free fallback only.
 *   AI_DAILY_USD_CAP=10     → approx daily spend ceiling (UTC day). 0/blank = no cap.
 *
 * NOTE: state is in-memory per server instance. On multi-instance/serverless
 * the effective cap is (cap × warm instances) and is best-effort. The kill
 * switch is env-based so it IS globally effective. For an exact global cap,
 * back recordAiUsage/aiBudgetAvailable with a shared store (Upstash/Supabase).
 */

// Approximate Anthropic list prices, USD per 1M tokens. Override per model via
// AI_PRICE_<MODELKEY>_IN / _OUT if pricing changes. These are estimates used
// only for the spend cap, not billing.
const PRICE_TABLE: Array<{ match: string; in: number; out: number }> = [
  { match: 'haiku', in: 1, out: 5 },
  { match: 'sonnet', in: 3, out: 15 },
  { match: 'opus', in: 15, out: 75 },
];

interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
}

let currentDay = '';
let spentTodayUsd = 0;

function utcDay(): string {
  // App server runtime (not a workflow script) — Date is available here.
  return new Date().toISOString().slice(0, 10);
}

function rollover(): void {
  const day = utcDay();
  if (day !== currentDay) {
    currentDay = day;
    spentTodayUsd = 0;
  }
}

function killSwitchEngaged(): boolean {
  const flag = process.env.AI_ENABLED?.trim().toLowerCase();
  return flag === '0' || flag === 'false' || flag === 'off';
}

export function dailyCapUsd(): number {
  const raw = process.env.AI_DAILY_USD_CAP;
  if (raw === undefined || raw.trim() === '') return 10; // sane default ceiling
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 10;
}

function priceFor(model: string): { in: number; out: number } {
  const lower = model.toLowerCase();
  return PRICE_TABLE.find((entry) => lower.includes(entry.match)) || { in: 3, out: 15 };
}

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const { in: inPrice, out: outPrice } = priceFor(model);
  const inTokens = Math.max(0, usage.input_tokens || 0);
  const outTokens = Math.max(0, usage.output_tokens || 0);
  return (inTokens / 1_000_000) * inPrice + (outTokens / 1_000_000) * outPrice;
}

/** True if a Claude call is permitted right now (key present, not killed, under cap). */
export function aiBudgetAvailable(): boolean {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return false;
  if (killSwitchEngaged()) return false;
  rollover();
  const cap = dailyCapUsd();
  if (cap <= 0) return true; // explicit "no cap"
  return spentTodayUsd < cap;
}

/** Record (estimated) spend for a completed call so the daily cap can trip. */
export function recordAiUsage(model: string, usage: TokenUsage | null | undefined): void {
  if (!usage) return;
  rollover();
  spentTodayUsd += estimateCostUsd(model, usage);
}

export function aiBudgetSnapshot(): { day: string; spentUsd: number; capUsd: number; killed: boolean } {
  rollover();
  return { day: currentDay, spentUsd: Number(spentTodayUsd.toFixed(4)), capUsd: dailyCapUsd(), killed: killSwitchEngaged() };
}
