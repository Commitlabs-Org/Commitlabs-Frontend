# Allocation Constraints Editor

## Overview

`AllocationConstraintsEditor` is a live visualization and editing component for
allocation constraints during commitment creation (Step 2 of the wizard). It
reuses the visual language of `CommitmentDetailAllocationConstraints` (cyan dot
items, dark cards, on-chain enforcement banner) while adding interactive max-loss
controls and a real-time headroom gauge.

## Location

| Artifact | Path |
|----------|------|
| Component | `src/components/create/AllocationConstraintsEditor.tsx` |
| Styles | `src/components/create/AllocationConstraintsEditor.module.css` |
| Tests | `src/components/create/AllocationConstraintsEditor.test.tsx` |
| Integration | `src/components/CreateCommitmentStepConfigure.tsx` (line ~341) |

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxLossPercent` | `number` | — | Current max loss setting (0–100) |
| `commitmentType` | `'safe' \| 'balanced' \| 'aggressive'` | — | Selected risk profile |
| `amount` | `string \| number` | — | Commitment amount |
| `asset` | `string` | — | Asset symbol (XLM, USDC, ETH) |
| `onChangeMaxLoss` | `(value: number) => void` | — | Called when the user adjusts max loss via the editor |

## Features

### Headroom Gauge
- Rendered as `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- Displays the stop-loss threshold as a filled bar against the protocol ceiling
- Color-coded: green (≤30%), yellow (30–70%), red (>70%)
- Updates live as the user adjusts the max-loss value

### Constraint Items
- Maximum acceptable loss (absolute value in asset terms)
- Commitment type label
- Protocol ceiling (fetched from `/api/protocol/constants`)
- Risk-level description (Conservative / Low / Moderate / High / Aggressive)
- Same cyan-dot visual pattern as `CommitmentDetailAllocationConstraints`

### Inline Max-Loss Controls
- Slider + number input duplicate controls inside the editor panel
- Bound to the same `onChangeMaxLoss` callback as the main form controls
- Clamped to protocol ceiling (falls back to 100% if constants fetch fails)

### On-Chain Enforcement Banner
- Same wording and styling as the detail-page component

## Data Flow

```
Wizard Page (page.tsx)
  └─ commitmentType, maxLossPercent, amount, asset
       └─ CreateCommitmentStepConfigure
            ├─ Max Loss form control (original)
            └─ AllocationConstraintsEditor
                 ├─ Headroom gauge (read-only visualization)
                 ├─ Constraint items (read-only)
                 ├─ Inline slider + input → onChangeMaxLoss → parent state
                 └─ Fetches /api/protocol/constants for ceiling
```

Both the original form control and the editor's inline control call the same
`onChangeMaxLoss` prop, keeping all UIs in sync.

## Protocol Constants

The editor fetches `/api/protocol/constants` on mount via
`fetchProtocolConstants()` from `@/utils/protocol`. If the fetch fails, the
component silently defaults to a ceiling of 100%. The gauge and slider respect
the fetched `maxLossPercentCeiling`.

## Testing

```bash
npx vitest run --reporter=verbose src/components/create/AllocationConstraintsEditor.test.tsx
```

The test suite:
- Mocks the protocol constants API with `global.fetch`
- Verifies ARIA attributes on the headroom gauge
- Verifies constraint text is rendered for each commitment type
- Verifies slider and number input callbacks
- Verifies clamping to protocol bounds (ceiling and floor)
- Verifies color-coded gauge at different max-loss thresholds
- Verifies fetched ceiling is reflected in the UI
