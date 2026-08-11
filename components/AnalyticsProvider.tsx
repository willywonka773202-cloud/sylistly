'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { initAnalytics, track } from '@/lib/analytics';

function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
}

/** Boots PostHog on the client once per session. Renders nothing. */
export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);

  useReportWebVitals((metric) => {
    track('web_vital_measured', {
      surface: 'web-vitals',
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigation_type: metric.navigationType,
      device_type: deviceType(),
      viewport_width: window.innerWidth,
      path: window.location.pathname,
    });
  });

  return null;
}
