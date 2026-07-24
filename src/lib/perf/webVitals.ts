/**
 * Field web-vitals reporting.
 *
 * Captures Core Web Vitals from real users and forwards a **minimal, PII-free**
 * record to a pluggable sink. The sink is a no-op by default, so nothing is
 * collected or sent until an operator opts in via `setWebVitalsSink`.
 *
 * This module is framework-agnostic and SSR-safe (no `window`/`document` access
 * at import or call time). The Next.js wiring lives in
 * `src/components/perf/WebVitalsReporter.tsx`.
 *
 * @see docs/PERFORMANCE_BUDGET.md
 */

/** Core Web Vitals (plus a few supporting metrics Next reports). */
export type WebVitalName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB' | 'FID'

/** A sanitized, serialisable metric record. Contains no PII. */
export interface WebVitalRecord {
  /** Metric short name, e.g. `LCP`. */
  name: WebVitalName
  /** Metric value (ms, except CLS which is unitless). */
  value: number
  /** Google rating bucket, when provided by the source. */
  rating?: 'good' | 'needs-improvement' | 'poor'
  /** Opaque per-metric id from the measurement library (not user-identifying). */
  id?: string
  /** Navigation type, e.g. `navigate`, `reload`, `back-forward`. */
  navigationType?: string
}

/**
 * Performance budget for key Core Web Vitals, aligned with Google's "good"
 * thresholds. Documented per-route in docs/PERFORMANCE_BUDGET.md.
 */
export const WEB_VITALS_BUDGET = {
  /** Largest Contentful Paint — milliseconds. */
  LCP: 2500,
  /** Interaction to Next Paint — milliseconds. */
  INP: 200,
  /** Cumulative Layout Shift — unitless. */
  CLS: 0.1,
} as const

export type WebVitalsSink = (record: WebVitalRecord) => void

/** Default sink: a no-op. Nothing is collected until an operator opts in. */
const noopSink: WebVitalsSink = () => {}

let sink: WebVitalsSink = noopSink

/**
 * Register the destination for web-vitals records (e.g. an analytics beacon).
 * Pass nothing to reset back to the no-op default.
 */
export function setWebVitalsSink(next?: WebVitalsSink): void {
  sink = next ?? noopSink
}

/** Shape accepted from `next/web-vitals` / the `web-vitals` library. */
interface RawMetric {
  name: string
  value: number
  rating?: string
  id?: string
  navigationType?: string
  // intentionally ignore any other fields (entries, attribution, etc.)
}

const KNOWN_NAMES = new Set<WebVitalName>(['LCP', 'CLS', 'INP', 'FCP', 'TTFB', 'FID'])

/**
 * Normalise a raw metric to a PII-free {@link WebVitalRecord} and forward it to
 * the configured sink. Unknown metric names and non-finite values are dropped.
 * Never throws — reporting must not affect the page.
 */
export function reportWebVital(metric: RawMetric): void {
  try {
    if (!metric || !KNOWN_NAMES.has(metric.name as WebVitalName)) return
    if (typeof metric.value !== 'number' || !Number.isFinite(metric.value)) return

    const record: WebVitalRecord = {
      name: metric.name as WebVitalName,
      value: metric.value,
      ...(metric.rating ? { rating: metric.rating as WebVitalRecord['rating'] } : {}),
      ...(metric.id ? { id: metric.id } : {}),
      ...(metric.navigationType ? { navigationType: metric.navigationType } : {}),
    }

    sink(record)
  } catch {
    // Swallow — telemetry must never break the app.
  }
}

/** Whether a metric value is within the documented budget (if one exists). */
export function isWithinBudget(name: WebVitalName, value: number): boolean {
  const budget = (WEB_VITALS_BUDGET as Record<string, number>)[name]
  return budget === undefined ? true : value <= budget
}
