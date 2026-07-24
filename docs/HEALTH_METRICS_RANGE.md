# Health Metrics Range Selector

The dashboard health-metrics panel now includes an in-page range selector above the metric tabs.

## Behavior

- Supports `7d`, `30d`, `90d`, and `All`.
- Filters the data passed to the value history, drawdown, fee generation, and compliance charts.
- Persists the chosen range in `sessionStorage` for the current session.
- Shows an in-chart empty state when the selected range has no data.
- Uses a keyboard-accessible segmented control with `aria-pressed` and arrow-key navigation.

## Implementation notes

- The shared range state lives in `src/components/dashboard/useHealthMetricsRange.ts`.
- The selector lives in `src/components/dashboard/HealthMetricsRangeSelector.tsx`.
- `CommitmentHealthMetrics` keeps the existing chart tabs and applies the active range to all four series consistently.

## Tests

- `src/components/dashboard/HealthMetricsRangeSelector.test.tsx`
- `src/components/dashboard/CommitmentHealthMetrics.test.tsx`