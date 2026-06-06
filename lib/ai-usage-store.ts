/**
 * Optional SHARED daily-spend store for an exact, global AI cost ceiling across
 * all serverless instances. Backs the in-memory cap in lib/ai-budget.ts.
 *
 * Uses the Upstash Redis REST API (also satisfied by Vercel KV / Vercel Redis,
 * which exposes the same env). No SDK dependency — just fetch. If no store is
 * configured, every function here no-ops and the app falls back to the
 * per-instance in-memory cap.
 *
 * Configure (either pair works):
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL + KV_REST_API_TOKEN        (Vercel KV)
 */

function storeConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export function hasSharedUsageStore(): boolean {
  return storeConfig() !== null;
}

function dayKey(): string {
  return `ai:spend:${new Date().toISOString().slice(0, 10)}`; // app runtime — Date is fine
}

async function command(parts: string[]): Promise<unknown | null> {
  const config = storeConfig();
  if (!config) return null;
  try {
    const path = parts.map((part) => encodeURIComponent(part)).join('/');
    const res = await fetch(`${config.url}/${path}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      // Never let the store add meaningful latency or hang a request.
      signal: AbortSignal.timeout(1_500),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown };
    return data.result ?? null;
  } catch {
    return null;
  }
}

/** Today's global spend in USD, or null if no shared store is configured/reachable. */
export async function getGlobalSpendUsd(): Promise<number | null> {
  const result = await command(['get', dayKey()]);
  if (result === null || result === undefined) return null;
  const value = Number(result);
  return Number.isFinite(value) ? value : 0;
}

/** Add to today's global spend (fire-and-forget) and keep a 2-day TTL. */
export async function recordGlobalSpendUsd(usd: number): Promise<void> {
  if (!hasSharedUsageStore() || !(usd > 0)) return;
  const key = dayKey();
  await command(['incrbyfloat', key, String(usd)]);
  await command(['expire', key, String(60 * 60 * 48)]);
}
