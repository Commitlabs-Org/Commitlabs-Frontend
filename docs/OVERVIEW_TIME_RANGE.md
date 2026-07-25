# Commitments Overview — Time-Range Filter

The commitments overview page (`src/app/commitments/overview/page.tsx`) now includes
a time-range filter that scopes the KPI display and the at-risk commitments widget
to a chosen time window.

## Supported Ranges

| Key   | Label | Days looked back |
|-------|-------|-----------------|
| `7d`  | 7 D   | 7               |
| `30d` | 30 D  | 30 *(default)*  |
| `90d` | 90 D  | 90              |
| `all` | All   | unlimited       |

## Behavior

- **Default range** is `30d`.
- The chosen range is **persisted** in `sessionStorage` (`overview.selectedRange`) for the
  duration of the browser session; it resets when the tab or window is closed.
- **Loading state**: a skeleton placeholder is shown while commitments are fetched; there
  is no flicker when switching ranges after data is loaded.
- **Empty range state**: when no commitments fall within the selected window a contextual
  message is shown, prompting the user to widen the range.
- **Range change announced**: a visually-hidden `role="status" aria-live="polite"` region
  announces the new range label to screen readers whenever the selection changes.

## Props / API

### `<OverviewTimeRangeSelector>`

```tsx
import OverviewTimeRangeSelector from "@/components/overview/OverviewTimeRangeSelector";

<OverviewTimeRangeSelector
  selected={selectedRange}   // OverviewRangeKey
  onChange={setRange}        // (range: OverviewRangeKey) => void
  className="..."            // optional extra classes
/>
```

| Prop        | Type                                  | Required | Description                          |
|-------------|---------------------------------------|----------|--------------------------------------|
| `selected`  | `OverviewRangeKey`                    | yes      | Currently active range key           |
| `onChange`  | `(range: OverviewRangeKey) => void`   | yes      | Callback fired on selection change   |
| `className` | `string`                              | no       | Extra Tailwind classes for the group |

### `useOverviewTimeRange()`

```ts
import { useOverviewTimeRange } from "@/hooks/useOverviewTimeRange";

const { selectedRange, setRange, filterByRange, rangeStart } = useOverviewTimeRange();
```

| Return value      | Type                                                    | Description                                        |
|-------------------|---------------------------------------------------------|----------------------------------------------------|
| `selectedRange`   | `OverviewRangeKey`                                      | Currently selected range                           |
| `setRange`        | `(range: OverviewRangeKey) => void`                     | Update the range and persist it                    |
| `filterByRange`   | `<T>(data: T[], getDate: (item: T) => string\|Date) => T[]` | Filter an array to the active range            |
| `rangeStart`      | `Date \| null`                                          | Start-of-day boundary for the range, null for All  |

### `overviewRangeStartDate(days: number | null): Date | null`

Utility that returns a `Date` set to midnight `days` calendar days ago, or `null` when
`days` is `null` (the "All" range).

## Accessibility

- The selector is wrapped in `<div role="group" aria-label="Commitments overview date range">`.
- Each button has `aria-pressed` reflecting its active state.
- Arrow keys (←/→) cycle focus through the options and activate the newly focused range.
- All buttons have `type="button"` to prevent accidental form submission.
- A `role="status" aria-live="polite"` region announces the range label after each change
  without interrupting the user.

## Usage Example

```tsx
"use client";

import OverviewTimeRangeSelector from "@/components/overview/OverviewTimeRangeSelector";
import { useOverviewTimeRange } from "@/hooks/useOverviewTimeRange";

export default function CommitmentOverviewPage() {
  const { selectedRange, setRange, filterByRange } = useOverviewTimeRange();

  const filteredCommitments = filterByRange(commitments, (c) => c.createdAt);

  return (
    <main>
      <OverviewTimeRangeSelector selected={selectedRange} onChange={setRange} />
      {/* render filteredCommitments … */}
    </main>
  );
}
```

## Files

| Path | Role |
|------|------|
| `src/app/commitments/overview/page.tsx` | Overview page — wires the selector |
| `src/components/overview/OverviewTimeRangeSelector.tsx` | Accessible segmented-control component |
| `src/hooks/useOverviewTimeRange.ts` | State management + sessionStorage persistence |
| `src/components/dashboard/AtRiskCommitments.tsx` | Accepts `rangeLabel` prop for contextual empty state |
| `src/app/commitments/OverviewTimeRange.test.tsx` | Jest/Vitest + RTL test suite |

## Tests

Run the suite with:

```bash
pnpm test
```

Test file: `src/app/commitments/OverviewTimeRange.test.tsx`

Covers:

- Rendering all four range options
- `aria-pressed` state tracking
- Click and keyboard (ArrowLeft / ArrowRight) interaction
- Group role and aria-label
- Live-region announcement on range change
- Hook default range (`30d`)
- sessionStorage persistence
- Invalid stored value falls back to default
- `filterByRange` for all four range keys
- Empty range state
- `Date` objects and ISO strings both accepted
- `overviewRangeStartDate` utility: null for All, correct date, midnight reset

## Related

- [`docs/HEALTH_METRICS_RANGE.md`](./HEALTH_METRICS_RANGE.md) — time-range filter on
  the commitment detail health-metrics panel (the pattern this feature is based on).
