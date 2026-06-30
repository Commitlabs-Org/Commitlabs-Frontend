# Volatility Exposure Binding

This document describes how live commitment metrics feed the `VolatilityExposureMeter` on the commitment detail page.

## Data flow

1. **Commitment detail page** (`src/app/commitments/[id]/page.tsx`) gathers value history and drawdown series plus the commitment's `maxLossPercent`.
2. **`computeCommitmentExposure`** (`src/utils/exposure.ts`) derives a single 0–100 exposure score and related thresholds.
3. **`CommitmentHealthMetrics`** passes the result to chart tabs that render `VolatilityExposureMeter`.

## Exposure calculation

| Input | Role |
| --- | --- |
| Latest drawdown (0–1 fraction) | Compared against `maxLossPercent` to produce a drawdown exposure score (0–100). |
| Value history (≥ 2 points) | Mean absolute period-over-period return, scaled by protocol `maxLossPercentCeiling`. |
| `maxLossPercent` | Commitment rule; also drives the drawdown chart reference line (`maxLoss / 100`). |

When both drawdown and volatility signals exist, the final score is a weighted blend (60% drawdown, 40% volatility). If only one signal is available, that signal is used alone.

## Thresholds

| Threshold | Value | Usage |
| --- | --- | --- |
| Low / medium boundary | 33% | Meter zone label and `aria-valuetext` band |
| Medium / high boundary | 66% | Meter zone label and `aria-valuetext` band |
| Drawdown reference line | `maxLossPercent / 100` | Drawdown chart dashed threshold |

Zone thresholds are exported as `EXPOSURE_ZONE_THRESHOLDS` from `src/utils/exposure.ts`.

## Insufficient data

Exposure is **not** computed when:

- `maxLossPercent` is missing or ≤ 0, or
- There is no valid drawdown point **and** fewer than two usable value-history points.

In that case `computeCommitmentExposure` returns `{ status: 'insufficient_data' }`. The meter renders an explicit “Insufficient data” message with accessible `aria-valuetext` instead of a numeric reading.

## Accessibility

When data is available, the meter keeps:

- `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- `aria-label` including percent and band (low / medium / high)
- `aria-valuetext` with percent and band

When data is insufficient, `aria-valuetext` is `"Insufficient data"` and no misleading fill is shown.

## Tests

- Unit: `src/utils/__tests__/exposure.test.ts` — zones, boundaries, insufficient data
- RTL binding: `src/components/dashboard/__tests__/CommitmentHealthMetrics.exposure.test.tsx` — meter wired from computed exposure
