/**
 * Lightweight in-memory per-client rate limiter for the AI routes. Caps how
 * often a single visitor can trigger paid Claude calls; when exceeded, callers
 * degrade to the free deterministic path (not a hard error) so UX stays intact.
 *
 * In-memory per instance (best-effort on serverless). For exact global limits,
 * swap the bucket store for Upstash/Redis. Defaults are env-tunable:
 *   AI_RATELIMIT_PER_MIN=20   → AI calls allowed per client per rolling minute.
 */

const WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();
let lastSweep = 0;

function perMinuteLimit(): number {
  const raw = Number(process.env.AI_RATELIMIT_PER_MIN ?? '20');
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

function sweep(now: number): void {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [key, times] of buckets) {
    const fresh = times.filter((t) => now - t < WINDOW_MS);
    if (fresh.length) buckets.set(key, fresh);
    else buckets.delete(key);
  }
}

/** Returns whether this client may make another AI call right now. */
export function allowAiCall(clientKey: string): { allowed: boolean; remaining: number; limit: number } {
  const now = Date.now();
  sweep(now);
  const limit = perMinuteLimit();
  const recent = (buckets.get(clientKey) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    buckets.set(clientKey, recent);
    return { allowed: false, remaining: 0, limit };
  }
  recent.push(now);
  buckets.set(clientKey, recent);
  return { allowed: true, remaining: limit - recent.length, limit };
}

/** Best-effort client identity from proxy headers (no PII stored, just keyed). */
export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'anon';
  return ip;
}
