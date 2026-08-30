# Health Metrics Chart Performance

## Why chart config is centralized

Recharts rebuilds SVG trees whenever parent components re-render. The four Health
Metrics charts (`HealthMetricsValueHistoryChart`, `HealthMetricsDrawdownChart`,
`HealthMetricsFeeGenerationChart`, `HealthMetricsComplianceChart`) previously
constructed axis, grid, tooltip cursor, and series chrome **inline** on every
render. Those new object identities defeat `React.memo` and force expensive
reconciles on tab switches and container resizes.

Shared props now live in `src/components/dashboard/chartConfig.ts` as
**module-level constants** so every chart receives the same stable references.

## Pattern

1. **Shared config** — import `CHART_GRID_PROPS`, `CHART_X_AXIS_PROPS`,
   `CHART_Y_AXIS_PROPS`, colors, margins, and formatters from `chartConfig.ts`.
2. **`React.memo`** — wrap each chart export so unchanged props skip re-render.
3. **`useMemo` / `useCallback`** — memoize derived series data (e.g. merged
   benchmark points) and Legend / tickFormatter callbacks so Recharts children
   keep referential equality across renders.
4. **Stable props from parents** — prefer memoized data arrays and avoid inline
   object/array props when rendering these charts from `CommitmentHealthMetrics`.

## Adding a new health chart

```tsx
import React, { useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import {
  CHART_GRID_PROPS,
  CHART_X_AXIS_PROPS,
  CHART_Y_AXIS_PROPS,
  CHART_MARGIN_DEFAULT,
  CHART_COLORS,
} from './chartConfig';

function MyChartComponent({ data }: { data: Array<{ date: string; value: number }> }) {
  const renderLegend = useCallback(() => <span>Series</span>, []);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={CHART_MARGIN_DEFAULT}>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis {...CHART_X_AXIS_PROPS} />
        <YAxis {...CHART_Y_AXIS_PROPS} />
        <Line dataKey="value" stroke={CHART_COLORS.teal} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const MyChart = React.memo(MyChartComponent);
MyChart.displayName = 'MyChart';
```

## Verification

- Unit tests assert each chart export is a `React.memo` component and that a
  memoized chart **does not re-render** when an unrelated parent state value
  changes while chart props stay referentially equal.
- Visuals (colors, domains, tooltips, copy) must match the previous charts.
