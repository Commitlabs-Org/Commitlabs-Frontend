'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVital } from '@/lib/perf/webVitals'

/**
 * Mounts the Next.js web-vitals listener and forwards each metric to the
 * pluggable reporter in `@/lib/perf/webVitals`. Renders nothing.
 *
 * The reporter's sink is a no-op by default, so this is inert until an operator
 * opts in via `setWebVitalsSink`. See docs/PERFORMANCE_BUDGET.md.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    reportWebVital(metric)
  })

  return null
}
