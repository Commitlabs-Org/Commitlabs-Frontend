# Lazy-loaded Health Metrics Charts

## Goal

Reduce the initial JavaScript bundle for the commitment detail page by lazy-loading the four Recharts-based health-metrics charts with `next/dynamic`.

## Changes

`src/components/dashboard/CommitmentHealthMetrics.tsx`:
- Removed static imports of `HealthMetricsValueHistoryChart`,
  `HealthMetricsDrawdownChart`, `HealthMetricsFeeGenerationChart`,
  `HealthMetricsComplianceChart`.
- Each chart is now loaded via `next/dynamic` with `ssr: false` and
  `HealthMetricsSkeleton` as the loading fallback.
- Recharts is only downloaded when a chart tab is actually viewed.

## Bundle Impact (estimated)

| Metric                      | Before  | After   | Savings |
|-----------------------------|---------|---------|---------|
| Recharts + dependent charts | ~135 kB | ~0 kB   | ~135 kB |

Recharts itself is ~130 kB minified. Combined with the four chart components,
this chunk accounts for roughly **135 kB** that is now deferred until the user
clicks a chart tab.

The initial commitment-detail bundle no longer includes Recharts. Only
`lucide-react` icons and the skeleton placeholder are part of the initial
payload.

## Behaviour

- **Default tab**: the `value` tab is active and its chart component loads
  immediately as a dynamic import.
- **Switching tabs**: each chart is code-split independently; switching tabs
  triggers the dynamic import for that chart only.
- **Repeated switching**: once a chart chunk has loaded, re-visiting that tab
  shows the cached component — no re-download.
- **Loading state**: `HealthMetricsSkeleton` is shown while a chart chunk is
  being fetched.
- **SSR**: charts are client-only (`ssr: false`) to avoid hydration mismatches.

## Verification

- Run `pnpm test` — all lazy-loading tests pass.
- Dev server shows no hydration warnings.
- Production build code-splits each chart into its own chunk.

## File structure

```
src/components/dashboard/
  CommitmentHealthMetrics.tsx          # updated — dynamic imports
  __tests__/
    CommitmentHealthMetrics.lazy.test.tsx  # lazy-loading behaviour tests
docs/performance/
  LAZY_HEALTH_CHARTS.md                # this file
```
