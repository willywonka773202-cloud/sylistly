import posthog from 'posthog-js';

/**
 * Thin PostHog wrapper. No-ops everywhere until NEXT_PUBLIC_POSTHOG_KEY exists,
 * so instrumented code never has to guard. `capture_pageview: 'history_change'`
 * tracks App Router navigations without a pageview component.
 */
let initialized = false;

export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (initialized || !key || typeof window === 'undefined') return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: 'history_change',
    persistence: 'localStorage+cookie',
  });
  initialized = true;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}
