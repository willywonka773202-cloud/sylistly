const ANONYMOUS_ID_KEY = 'sylistly.analytics.anonymous_id';
const FIRST_SEEN_KEY = 'sylistly.analytics.first_seen_at';
const SESSION_ID_KEY = 'sylistly.analytics.session_id';
const SESSION_CAPTURED_KEY = 'sylistly.analytics.session_started_captured';

export interface AnalyticsIdentity {
  anonymousId: string;
  sessionId: string;
  isReturning: boolean;
}

function opaqueId(prefix: 'a' | 's'): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random.slice(0, 48)}`;
}

function validOpaqueId(value: string | null, prefix: 'a' | 's'): value is string {
  return Boolean(value && new RegExp(`^${prefix}_[a-zA-Z0-9]{8,64}$`).test(value));
}

/**
 * Anonymous identity persists on this browser. Session identity lasts for the
 * current tab/sessionStorage lifetime. Neither value contains account or PII.
 */
export function ensureAnalyticsIdentity(): AnalyticsIdentity | null {
  if (typeof window === 'undefined') return null;

  try {
    const existingAnonymousId = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    const anonymousId = validOpaqueId(existingAnonymousId, 'a') ? existingAnonymousId : opaqueId('a');
    const existingSessionId = window.sessionStorage.getItem(SESSION_ID_KEY);
    const sessionId = validOpaqueId(existingSessionId, 's') ? existingSessionId : opaqueId('s');
    const firstSeenAt = window.localStorage.getItem(FIRST_SEEN_KEY);

    window.localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
    window.sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    if (!firstSeenAt) window.localStorage.setItem(FIRST_SEEN_KEY, new Date().toISOString());

    return { anonymousId, sessionId, isReturning: Boolean(firstSeenAt) };
  } catch {
    // Storage can be disabled in privacy modes. PostHog remains a safe no-op or
    // uses its own in-memory identity; no product action should be blocked.
    return null;
  }
}

export function shouldCaptureSessionStarted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(SESSION_CAPTURED_KEY) === '1') return false;
    window.sessionStorage.setItem(SESSION_CAPTURED_KEY, '1');
    return true;
  } catch {
    return true;
  }
}

export function clearAnalyticsIdentity(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ANONYMOUS_ID_KEY);
    window.localStorage.removeItem(FIRST_SEEN_KEY);
    window.sessionStorage.removeItem(SESSION_ID_KEY);
    window.sessionStorage.removeItem(SESSION_CAPTURED_KEY);
  } catch {
    // Sign-out must keep working when storage is unavailable.
  }
}
