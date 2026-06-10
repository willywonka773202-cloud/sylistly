'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/analytics';

/** Boots PostHog on the client once per session. Renders nothing. */
export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
