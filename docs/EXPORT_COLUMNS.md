# Export Columns & Schedule Reminder

This document describes the column-selection and export-reminder features added to `ExportCommitmentsModal`.

## Overview

Users can now choose exactly which columns appear in the downloaded CSV and optionally configure a client-side reminder to repeat the export on a regular cadence.

## Column Selection

### Available columns

| Column | Description |
|---|---|
| Commitment ID | On-chain commitment identifier |
| Owner | Wallet address of the commitment owner |
| Asset | Asset symbol (e.g. XLM) |
| Amount | Committed amount |
| Status | Current commitment status |
| Compliance Score | Computed compliance score |
| Current Value | Present market value |
| Fee Earned | Accumulated protocol fee |
| Violation Count | Number of rule violations |
| Created At | ISO timestamp of creation |
| Expires At | ISO timestamp of expiry |

### Behavior

- All columns are selected by default.
- At least one column must remain selected — the **Export CSV** button is disabled and an inline alert is shown when the selection is empty.
- **Select all / Deselect all** toggles the entire set at once.
- The user's selection is persisted to `localStorage` under `commitlabs.exportPreferences` and restored the next time the modal opens.

### API integration

The frontend appends a `columns` query parameter to the export request:

```
GET /api/commitments/export?ownerAddress=0x…&columns=Commitment%20ID,Asset,Status
```

The route (`src/app/api/commitments/export/route.ts`) parses this parameter and streams only the requested columns. Unknown column names are silently ignored; an absent or empty parameter returns all columns.

## Export Reminder (Schedule)

The schedule section lets users request a browser notification reminder to export again after a chosen interval.

| Option | Delay |
|---|---|
| No reminder | — |
| Daily | 24 hours |
| Weekly | 7 days |
| Monthly | 30 days |

> **Important:** This is a client-side `setTimeout` that fires a single `Notification` in the current browser session. It is **not** server-side automation — no data is sent or scheduled on the server. Users must grant browser notification permission for the reminder to appear.

The chosen interval is persisted alongside the column selection in `commitlabs.exportPreferences`.

## Props

`ExportCommitmentsModal` accepts the same props as before — no new required props were introduced.

```tsx
<ExportCommitmentsModal
  isOpen={isOpen}
  onClose={handleClose}
  ownerAddress={walletAddress}      // optional
  sessionToken={token}              // optional; falls back to localStorage
  endpoint="/api/commitments/export" // optional; default shown
/>
```

## Accessibility

- The **Columns** section is wrapped in a `<section aria-labelledby>` heading.
- Each column checkbox has an explicit `aria-label`.
- The zero-column warning uses `role="alert"` for live-region announcement.
- Schedule buttons use `aria-pressed` to expose the current selection to assistive technology.
- The **Export reminder** group uses `role="group"` with `aria-labelledby`.
- All interactive elements have `focus-visible` ring styles matching the existing design tokens.

## Usage Example

```tsx
import ExportCommitmentsModal from '@/components/export/ExportCommitmentsModal';

function Portfolio() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Export</button>
      <ExportCommitmentsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        ownerAddress={address}
        sessionToken={token}
      />
    </>
  );
}
```

## Related files

- `src/components/export/ExportCommitmentsModal.tsx` — component implementation
- `src/components/export/ExportColumnsSchedule.test.tsx` — unit tests
- `src/app/api/commitments/export/route.ts` — streaming CSV route with column filtering
