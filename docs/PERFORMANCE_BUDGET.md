# Performance Budget & Web-Vitals Reporting

CommitLabs tracks performance in two complementary ways:

- **Lab** — [Lighthouse CI](performance/LIGHTHOUSE.md) (`lighthouserc.json`) runs
  synthetic audits on PRs for key routes.
- **Field** — a web-vitals reporting hook captures **real-user** Core Web Vitals
  (LCP / CLS / INP) and forwards them to a pluggable sink.

This document defines the budget both should be held to and how the field
reporting pipeline works.

## Budget (Core Web Vitals)

Field targets use Google's "good" thresholds, encoded in `WEB_VITALS_BUDGET` in
[`src/lib/perf/webVitals.ts`](../src/lib/perf/webVitals.ts):

| Metric | Budget ("good") | Meaning |
| ------ | --------------- | ------- |
| **LCP** (Largest Contentful Paint) | ≤ 2500 ms | Main content rendered |
| **INP** (Interaction to Next Paint) | ≤ 200 ms | Responsiveness to input |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | Visual stability |

### Key routes

The budget applies to all routes, with these as the tracked priorities (the same
set Lighthouse CI collects):

| Route | Why it matters |
| ----- | -------------- |
| `/` | Landing — first impression, mostly unauthenticated traffic |
| `/marketplace` | Data-heavy listing grid (search, sort, cards) |
| `/commitments` | Authenticated dashboard with charts |

> **Lab vs field:** the Lighthouse assertions in `lighthouserc.json` are
> intentionally looser than the field "good" thresholds (e.g. LCP warns at
> 4000 ms in lab) because lab runs include cold-start and CI-runner overhead.
> Treat the field budget above as the user-facing goal and Lighthouse as a
> regression guard.

## Field reporting pipeline

```
Browser → next/web-vitals useReportWebVitals
        → WebVitalsReporter  (src/components/perf/WebVitalsReporter.tsx)
        → reportWebVital()   (src/lib/perf/webVitals.ts)  ← sanitises to a PII-free record
        → sink               (no-op by default; opt-in via setWebVitalsSink)
```

- [`WebVitalsReporter`](../src/components/perf/WebVitalsReporter.tsx) is a tiny
  client component mounted in [`src/app/layout.tsx`](../src/app/layout.tsx); it
  renders nothing.
- [`reportWebVital`](../src/lib/perf/webVitals.ts) normalises each metric to a
  `WebVitalRecord` — **only** `name`, `value`, and optional `rating`, `id`,
  `navigationType`. Extra library fields (`entries`, `attribution`, DOM targets)
  are **dropped**, so no element selectors or user data leave the page. It never
  throws.

### Privacy

- **No PII.** Records carry only the metric name/value and non-identifying
  metadata. The `id` is the measurement library's opaque per-metric id, not a
  user id.
- **Off by default.** The sink is a no-op until an operator opts in, so no
  telemetry is collected or transmitted out of the box.

### Enabling a sink

Register a destination once, on the client, before/at app start:

```ts
import { setWebVitalsSink } from '@/lib/perf/webVitals'

setWebVitalsSink((record) => {
  // e.g. navigator.sendBeacon('/api/vitals', JSON.stringify(record))
  // keep it cheap and non-throwing
})
```

Use [`isWithinBudget(name, value)`](../src/lib/perf/webVitals.ts) in a sink to
flag or sample out-of-budget samples.

## Testing

[`src/lib/perf/__tests__/webVitals.test.ts`](../src/lib/perf/__tests__/webVitals.test.ts)
asserts: no-op by default, sanitized forwarding to a registered sink, unknown
names / non-finite values dropped, extra PII-like fields not forwarded, the sink
throwing never propagates, and budget evaluation via `isWithinBudget`.

## Investigating a regression

1. Identify which metric/route regressed (field sink data or Lighthouse CI).
2. For **LCP**: check the largest above-the-fold element, image sizing/priority,
   and font loading. See [performance/LAZY_HEALTH_CHARTS.md](performance/LAZY_HEALTH_CHARTS.md)
   and [performance/GRID_RENDER.md](performance/GRID_RENDER.md).
3. For **CLS**: reserve space for images/embeds and async content.
4. For **INP**: reduce long tasks / heavy synchronous work on interaction; lazy
   load heavy dependencies (framer-motion, recharts, stellar-sdk).
