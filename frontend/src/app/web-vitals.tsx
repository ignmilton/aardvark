'use client';

import { useEffect } from 'react';
import { reportWebVitals, type WebVitalMetric } from '@/lib/performance';

/**
 * Client component that reports Core Web Vitals.
 * Sends metrics to analytics endpoint in production.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    reportWebVitals((metric: WebVitalMetric) => {
      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Web Vital] ${metric.name}: ${metric.value} (${metric.rating})`);
        return;
      }

      // Send to analytics in production
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        page: window.location.pathname,
      });

      // Use sendBeacon for reliability during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/vitals', body);
      } else {
        fetch('/api/analytics/vitals', {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        });
      }
    });
  }, []);

  return null;
}
