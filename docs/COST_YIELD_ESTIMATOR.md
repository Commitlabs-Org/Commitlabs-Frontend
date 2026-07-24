# Cost and Yield Estimator

Live estimator panel in `CreateCommitmentStepConfigure` that shows projected yield range and worst-case penalty as the user adjusts commitment parameters.

## Overview

The `CostYieldEstimator` component reacts to changes in `amount`, `durationDays`, `maxLossPercent`, and `asset`, debounces updates (300 ms), and displays three key figures:

- **Projected Yield (est.)** — low-to-high range based on protocol APY heuristics and duration.
- **Worst-case Penalty (est.)** — maximum early-exit penalty derived from protocol constants.
- **Platform Fee (est.)** — platform fee percentage applied to the committed amount.

All figures are labeled as estimates and sourced from `/api/protocol/constants` (see `src/utils/protocol.ts`) rather than hardcoded values.

## Props / API

```ts
interface CostYieldEstimatorProps {
  amount: string | number   // commitment amount
  durationDays: number      // commitment duration in days (1–365)
  maxLossPercent: number    // maximum acceptable loss percent (0–100)
  asset: string             // asset ticker shown in labels (e.g. "XLM", "USDC")
}
```

## Usage

```tsx
import CostYieldEstimator from '@/components/create/CostYieldEstimator'

<CostYieldEstimator
  amount={amount}
  durationDays={durationDays}
  maxLossPercent={maxLossPercent}
  asset={asset}
/>
```

The component is already integrated into `CreateCommitmentStepConfigure.tsx` between the `AllocationConstraintsEditor` and the Advanced Risk Parameters section.

## Accessibility

- The section has `aria-label="Cost and yield estimator"` and `aria-live="polite"` so screen readers announce value changes without interrupting the user.
- All estimate rows use `<dl>/<dt>/<dd>` semantics for term/value pairing.
- A placeholder paragraph is shown (and announced) when inputs are invalid or constants are loading.

## Edge Cases

| Scenario | Behaviour |
|---|---|
| `amount` is empty or zero | Placeholder shown |
| `durationDays < 1` | Placeholder shown |
| Protocol constants fetch fails | Placeholder shown; no error thrown |
| `penalties` array is empty | Falls back to `maxLossPercent` for worst-case |

## Related

- `src/components/create/CostYieldEstimator.tsx` — component implementation
- `src/components/create/CostYieldEstimator.test.tsx` — tests
- `src/utils/protocol.ts` — `fetchProtocolConstants` helper
- `src/app/api/protocol/constants/route.ts` — constants API endpoint
- `docs/ALLOCATION_CONSTRAINTS_EDITOR.md` — sibling panel
