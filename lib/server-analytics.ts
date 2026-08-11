import { ANALYTICS_SCHEMA_VERSION, type CanonicalAnalyticsEvent } from './analytics-events';

/**
 * Minimal best-effort capture for server and catalog-job outcomes. The PostHog
 * project key is a public ingestion key; no Supabase/service credential ever
 * leaves the server. Missing configuration is an intentional no-op.
 */
export async function captureServerAnalytics(
  event: CanonicalAnalyticsEvent,
  distinctId: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) return;

  try {
    const host = new URL(process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com');
    if (host.protocol !== 'https:') return;
    const endpoint = new URL('/capture/', host);
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        properties: {
          distinct_id: distinctId,
          schema_version: ANALYTICS_SCHEMA_VERSION,
          source: 'server_redirect',
          ...properties,
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(800),
    });
  } catch {
    // Analytics must never delay or break a redirect, lifecycle write, or job.
  }
}
