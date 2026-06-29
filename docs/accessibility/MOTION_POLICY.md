# Motion Policy for Data Visualizations

Data-visualization surfaces (Recharts charts and the `VolatilityExposureMeter`)
animate by default. To respect accessibility preferences and improve perceived
performance, animations are gated behind the user's
`prefers-reduced-motion` setting.

## The hook

[`src/lib/a11y/useReducedMotion.ts`](../../src/lib/a11y/useReducedMotion.ts)
exposes a shared `useReducedMotion()` hook:

- Returns `true` when the OS/browser requests reduced motion.
- **SSR-safe**: returns `false` on the server and first client render to avoid
  hydration mismatches, then updates after mount.
- **Resilient**: if `matchMedia` is unavailable it falls back to `false`
  (animations enabled) instead of throwing.
- **Live**: subscribes to media-query changes so toggling the setting updates
  the value without a reload.

## How it is applied

| Surface                          | Gating mechanism                                  |
| -------------------------------- | ------------------------------------------------- |
| `HealthMetricsValueHistoryChart` | Recharts `isAnimationActive={!reducedMotion}`     |
| `VolatilityExposureMeter`        | Inline `transition: 'none'` when reduced motion   |

Importantly, **data still updates** when reduced motion is on — only the
animation/transition is removed, so the chart and meter reflect new values
instantly rather than tweening to them.

## Adding new visualizations

When adding a new chart or animated meter, call `useReducedMotion()` and disable
the relevant animation (e.g. `isAnimationActive`, CSS `transition`, or
framer-motion variants) when it returns `true`.
