/** Small clock-skew allowance for retailer evidence produced by another host. */
export const VERIFICATION_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** Return a non-negative evidence age, or null for malformed / materially
 * future-dated timestamps. Future evidence must never extend the shopping SLA. */
export function verificationAgeMs(
  checkedAt: string | undefined | null,
  now = Date.now(),
): number | null {
  if (!Number.isFinite(now) || !checkedAt) return null;
  const checkedMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedMs) || checkedMs - now > VERIFICATION_MAX_FUTURE_SKEW_MS) return null;
  return Math.max(0, now - checkedMs);
}

export function isVerificationFresh(
  checkedAt: string | undefined | null,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  const age = verificationAgeMs(checkedAt, now);
  return age !== null && Number.isFinite(maxAgeMs) && maxAgeMs >= 0 && age <= maxAgeMs;
}
