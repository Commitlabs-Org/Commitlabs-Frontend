# Early Exit Timing Preview

The `ExitTimingPreview` component added to the `CommitmentEarlyExitModal` provides users with an interactive "what if I exit later" visualization.

## Goal
To help liquidity providers make informed decisions about when to trigger an early exit by allowing them to scrub a slider between "now" and the commitment's maturity date. The projected penalty and net return are dynamically updated.

## Implementation Details
- **Component Location:** `src/components/CommitmentEarlyExitModal/ExitTimingPreview.tsx`
- **Data Source:** It fetches the baseline penalty from `/api/commitments/[id]/early-exit/preview`.
- **Interpolation:** Since the preview API returns the current snapshot of the penalty, the frontend linearly interpolates the penalty down to zero as the slider moves closer to the maturity date.
- **Debouncing:** The slider utilizes a simulated debounce strategy to ensure the UI feels responsive while deferring state recalculations by a small timeout.
- **Fallback Mechanism:** If the preview API fails or rate-limits, it gracefully falls back to a static calculation using the `originalAmount` and `penaltyPercent` props to estimate the baseline penalty.
- **Accessibility:** Uses accessible range input features (`aria-label`) to announce the currently selected simulated date. It is strictly presented as an objective projection and eschews financial advice wording.

## Grace Period Countdown

The modal also includes a grace-period countdown banner driven by `commitmentLimits.earlyExitGracePeriodDays` from the protocol constants endpoint. The banner appears before `ExitTimingPreview` and tells the user whether the current early exit still incurs a penalty or whether waiting reaches a penalty-free window near maturity.

See [GRACE_COUNTDOWN.md](GRACE_COUNTDOWN.md) for the component states, accessibility behavior, and tests.
