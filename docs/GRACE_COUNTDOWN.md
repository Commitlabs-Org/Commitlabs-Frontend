# Early Exit Grace Countdown

The early-exit modal shows a grace-period countdown banner before the timing preview. The banner tells users whether exiting now still incurs the configured penalty or whether waiting reaches a penalty-free grace window near maturity.

## Protocol Constant

The client reads `commitmentLimits.earlyExitGracePeriodDays` from `GET /api/protocol/constants` through `fetchProtocolConstants()`.

Default backend value:

```text
COMMITLABS_EARLY_EXIT_GRACE_PERIOD_DAYS=7
```

If the value is missing, invalid, or `0`, the banner falls back to the penalty-now state and does not promise a grace window.

## Modal Behavior

`CommitmentEarlyExitModal` loads protocol constants when the modal opens and passes the resolved grace-period value to:

- `GraceCountdownBanner`, which displays the accessible status message.
- `ExitTimingPreview`, which projects penalty decay to `0` once the grace window starts.

States:

| State | Condition | User message |
| --- | --- | --- |
| Loading | Protocol constants are still loading | Checking grace period |
| Pre-grace | Current time is before `maturityDate - gracePeriodDays` | Penalty applies now, with a countdown to the grace window |
| In-grace | Current time is on or after the grace-window start | Early exit is penalty-free until maturity |
| No grace | Grace period is `0` or unavailable | Early exit uses the penalty shown in the modal |

## Accessibility

- The banner uses `role="status"` with `aria-live="polite"` and `aria-atomic="true"` so assistive technology receives timing updates without interrupting the user.
- Countdown updates every second by default.
- When `prefers-reduced-motion: reduce` is enabled, countdown text omits seconds and updates on a slower cadence.
- The status uses both iconography and text; color is not the only signal.

## Usage Example

```tsx
<GraceCountdownBanner
  maturityDate={maturityDate}
  gracePeriodDays={7}
/>

<ExitTimingPreview
  commitmentId={commitmentId}
  originalAmount={parsedOriginalAmount}
  currentPenaltyPercent={parsedPenaltyPercent}
  maturityDate={maturityDate}
  gracePeriodDays={7}
/>
```

## Tests

Focused coverage lives in `src/components/CommitmentEarlyExitModal/GraceCountdown.test.tsx` and covers:

- in-grace penalty-free copy;
- pre-grace countdown updates;
- no-grace penalty-now copy;
- reduced-motion countdown formatting.
