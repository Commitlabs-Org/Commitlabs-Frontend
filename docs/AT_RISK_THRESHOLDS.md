# Configurable At-Risk Thresholds

The `AtRiskCommitments` component supports user-tunable thresholds that control how sensitive the at-risk detection is. Users can adjust these through the **Configure Thresholds** panel in the widget, and developers can pass them as props.

## Feature overview

- Expose two numeric thresholds: `complianceScoreThreshold` and `daysRemainingThreshold`.
- Default values preserve the original behavior when no override is provided.
- A warning toast fires once when a commitment newly crosses into at-risk status (deduped — no duplicate alerts for already-known items).
- All controls are fully accessible: labelled inputs, `aria-expanded`, `role="group"`, and an `aria-live` alert for validation errors.

## Props / API

```tsx
interface AtRiskThresholds {
  /** Compliance score below which a commitment is flagged. Default: 70 */
  complianceScoreThreshold: number;
  /** Days remaining at or below which a commitment is flagged. Default: 7 */
  daysRemainingThreshold: number;
}

interface AtRiskCommitmentsProps {
  commitments?: Commitment[];
  /** Partial override of default thresholds. */
  thresholds?: Partial<AtRiskThresholds>;
  /** Called with the new thresholds after the user applies changes. */
  onThresholdsChange?: (thresholds: AtRiskThresholds) => void;
}
```

The exported constant `DEFAULT_AT_RISK_THRESHOLDS` reflects the baseline values:

```ts
export const DEFAULT_AT_RISK_THRESHOLDS: AtRiskThresholds = {
  complianceScoreThreshold: 70,
  daysRemainingThreshold: 7,
};
```

## Classification utility

`classifyAtRiskCommitments` in `src/utils/classification.ts` now accepts an optional third argument:

```ts
classifyAtRiskCommitments(commitments, constants, thresholds?)
```

When `thresholds` is omitted or `undefined`, the function falls back to the original hard-coded defaults, so existing call sites continue to work without changes.

## Usage example

```tsx
import { AtRiskCommitments } from '@/components/dashboard/AtRiskCommitments';

// Default behavior — unchanged from before this feature:
<AtRiskCommitments commitments={myCommitments} />

// Custom thresholds — flag when compliance < 85 or <= 14 days remain:
<AtRiskCommitments
  commitments={myCommitments}
  thresholds={{ complianceScoreThreshold: 85, daysRemainingThreshold: 14 }}
  onThresholdsChange={(t) => savePreferences(t)}
/>
```

## Validation rules

| Field | Min | Max | Error message |
|---|---|---|---|
| `complianceScoreThreshold` | 0 | 100 | "Compliance score must be between 0 and 100." |
| `daysRemainingThreshold` | 0 | 365 | "Days remaining must be between 0 and 365." |

Invalid values are rejected with an inline `role="alert"` message; the thresholds are not updated until valid values are applied.

## Accessibility

- Threshold inputs have explicit `<label>` elements linked via `htmlFor` / `id`.
- The settings panel uses `role="group"` with `aria-label`.
- The toggle button exposes `aria-expanded` and `aria-controls`.
- Validation errors appear in a `role="alert"` element for immediate screen-reader announcement.
- The spinner indicator uses `aria-hidden="true"` to suppress decorative animation from assistive technology.

## Related files

- `src/components/dashboard/AtRiskCommitments.tsx` — main component
- `src/utils/classification.ts` — classification logic with threshold support
- `src/components/dashboard/AtRiskCommitments.test.tsx` — component tests
- `src/components/dashboard/AtRiskThresholds.test.tsx` — threshold-focused unit tests
- `docs/AT_RISK_WIDGET.md` — original widget documentation
