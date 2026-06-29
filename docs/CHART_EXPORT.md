# Health Metrics Chart Export

Commitment detail health-metric charts support per-tab CSV and PNG export so users can archive or analyze data outside the app.

## User flow

1. Open a commitment detail page and navigate to a health-metrics tab (Value History, Drawdown, Fee Generation, Compliance).
2. Use the **CSV** or **PNG** buttons in the top-right of the active chart card.
3. CSV downloads the underlying series; PNG captures the rendered Recharts SVG.

Export controls are disabled while chart data is loading.

## Implementation

| Piece | Location |
|-------|----------|
| CSV + PNG helpers | `src/utils/chartExport.ts` |
| Export menu UI | `src/components/dashboard/ChartExportMenu.tsx` |
| Tab wiring | `src/components/dashboard/CommitmentHealthMetrics.tsx` |

## CSV format

CSV generation reuses `buildCsv` / `escapeCsvField` from `src/lib/backend/csv.ts` for consistent escaping and formula-injection protection.

Drawdown values stored as fractions (0–1) are normalized to percent strings in the export.

Filenames follow `health-metrics-{commitmentId}-{metric}-{date}.csv`.

## PNG format

PNG export serializes the chart's rendered `svg.recharts-surface` to a canvas-backed blob. Filenames follow the same pattern with a `.png` extension.

## Tests

- `src/utils/__tests__/chartExport.test.ts` — CSV mapping, filename sanitization, drawdown normalization
- `src/components/dashboard/ChartExportMenu.test.tsx` — disabled/loading state and CSV download trigger
