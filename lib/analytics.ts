import type { PostHog } from 'posthog-js';
import {
  analyticsEventProperties,
  normalizeAnalyticsEvent,
  type CanonicalAnalyticsEvent,
} from './analytics-events';
import {
  clearAnalyticsIdentity,
  ensureAnalyticsIdentity,
  shouldCaptureSessionStarted,
} from './analytics-identity';

/**
 * Thin PostHog wrapper. No-ops everywhere until NEXT_PUBLIC_POSTHOG_KEY exists,
 * so instrumented code never has to guard. `capture_pageview: 'history_change'`
 * tracks App Router navigations without a pageview component.
 */
let posthogClient: PostHog | null = null;
let initialization: Promise<void> | null = null;
const pendingCaptures: Array<{ event: string; properties: Record<string, unknown> }> = [];
let identityRegistrationRequired = true;
let deferIdentityRegistrationUntilCapture = false;

function analyticsKey(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || '';
}

function registerAnonymousIdentity(client: PostHog): void {
  const identity = ensureAnalyticsIdentity();
  if (identity) {
    client.register({
      anonymous_id: identity.anonymousId,
      anonymous_session_id: identity.sessionId,
    });
  }
  if (shouldCaptureSessionStarted()) {
    client.capture('session_started', analyticsEventProperties(
      { event: 'session_started' },
      { is_returning: identity?.isReturning ?? null, surface: 'app' },
    ));
  }
  identityRegistrationRequired = false;
  deferIdentityRegistrationUntilCapture = false;
}

function registerIdentityBeforeCapture(client: PostHog): void {
  if (identityRegistrationRequired) registerAnonymousIdentity(client);
}

export function initAnalytics(): void {
  const key = analyticsKey();
  if (posthogClient || initialization || !key || typeof window === 'undefined') return;
  // PostHog is observational, not part of the shopping experience. Load its
  // SDK after hydration so every route avoids paying for it in First Load JS.
  initialization = import('posthog-js')
    .then(({ default: client }) => {
      client.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        autocapture: false,
        capture_pageview: 'history_change',
        capture_pageleave: false,
        capture_heatmaps: false,
        capture_performance: false,
        disable_session_recording: true,
        persistence: 'localStorage+cookie',
        person_profiles: 'identified_only',
      });
      posthogClient = client;
      if (!deferIdentityRegistrationUntilCapture) registerAnonymousIdentity(client);
      for (const pending of pendingCaptures.splice(0)) {
        registerIdentityBeforeCapture(client);
        client.capture(pending.event, pending.properties);
      }
    })
    .catch(() => {
      // Analytics failures are always non-blocking; a later action may retry.
      initialization = null;
    });
}

export function track(
  event: CanonicalAnalyticsEvent | (string & {}),
  properties?: Record<string, unknown>,
): void {
  if (!analyticsKey() || typeof window === 'undefined') return;
  const normalized = normalizeAnalyticsEvent(event);
  const eventProperties = analyticsEventProperties(normalized, properties);
  if (posthogClient) {
    registerIdentityBeforeCapture(posthogClient);
    posthogClient.capture(normalized.event, eventProperties);
    return;
  }
  deferIdentityRegistrationUntilCapture = false;
  pendingCaptures.push({ event: normalized.event, properties: eventProperties });
  if (pendingCaptures.length > 50) pendingCaptures.shift();
  initAnalytics();
}

/** Call only after a real account identity is available. */
export function identifyAnalyticsUser(userId: string, properties?: Record<string, unknown>): void {
  if (!userId.trim()) return;
  if (posthogClient) {
    registerIdentityBeforeCapture(posthogClient);
    posthogClient.identify(userId.trim(), properties);
    return;
  }
  deferIdentityRegistrationUntilCapture = false;
  initAnalytics();
  void initialization?.then(() => {
    if (!posthogClient) return;
    registerIdentityBeforeCapture(posthogClient);
    posthogClient.identify(userId.trim(), properties);
  });
}

/** Use on sign-out/data reset so the next visitor is not joined to this user. */
export function resetAnalytics(): void {
  clearAnalyticsIdentity();
  pendingCaptures.length = 0;
  identityRegistrationRequired = true;
  // A clear-data action must not immediately recreate identifiers. A later
  // measured action (or the next page load) starts a genuinely new identity.
  deferIdentityRegistrationUntilCapture = true;
  posthogClient?.reset();
}
