# Attestation CSV Export

## Overview

`RecentAttestationsPanel` includes a **Export CSV** button that downloads the currently displayed (and potentially filtered) attestations as a comma-separated values file.

## Feature Behaviour

- The **Export CSV** button appears in the panel header alongside **View All**.
- It is **disabled** (and `aria-disabled`) when there are no attestations to export.
- Clicking it generates a CSV from the `attestations` prop and triggers a browser download.
- The filename format is `attestations-<commitmentId>-<YYYY-MM-DD>.csv`, where both `<commitmentId>` and the date stamp are sanitized.
- CSV fields are safely escaped using the shared `escapeCsvField` helper from `src/lib/backend/csv.ts`, which guards against CSV formula-injection attacks.

## Props / API

`RecentAttestationsPanel` accepts one new optional prop:

| Prop           | Type     | Default | Description                                              |
|----------------|----------|---------|----------------------------------------------------------|
| `commitmentId` | `string` | `''`    | Used to build the download filename. Sanitized automatically. |

All other existing props are unchanged.

## Utility Functions (src/utils/chartExport.ts)

| Export                           | Signature                                                    | Description                                             |
|----------------------------------|--------------------------------------------------------------|---------------------------------------------------------|
| `ATTESTATION_CSV_HEADERS`        | `readonly string[]`                                          | Column headers: ID, Title, Description, TX Hash, Timestamp, Severity |
| `buildAttestationCsvRows`        | `(attestations: Attestation[]) => CsvRow[]`                  | Maps attestations to raw CSV rows.                      |
| `buildAttestationCsvContent`     | `(attestations: Attestation[]) => string`                    | Produces a complete CSV string (headers + rows).        |
| `buildAttestationExportFilename` | `(commitmentId: string) => string`                           | Builds a sanitized filename with today's date.          |

## Usage Example

```tsx
import RecentAttestationsPanel from '@/components/RecentAttestationsPanel/RecentAttestationsPanel'

<RecentAttestationsPanel
  attestations={filteredAttestations}
  commitmentId="cmt-42"
  summary={{ complianceCount: 3, warningCount: 1, violationCount: 0 }}
  onSelectAttestation={(id) => router.push(`/attestations/${id}`)}
  onViewAll={() => router.push('/attestations')}
/>
```

## Accessibility

- The export button has a descriptive `aria-label`:
  - When enabled: `"Export attestations as CSV"`
  - When disabled: `"Export attestations as CSV (no attestations to export)"`
- `aria-disabled` is set alongside the native `disabled` attribute.
- The button is keyboard-focusable; focus ring is visible via `:focus-visible`.
- The download icon is `aria-hidden` so screen readers only announce the button label.

## Edge Cases

| Scenario                       | Behaviour                                                            |
|--------------------------------|----------------------------------------------------------------------|
| Empty attestations list        | Button is disabled; no download triggered.                           |
| Filtered / partial list        | Only the passed `attestations` appear in the CSV — not the full set. |
| Fields containing commas       | Wrapped in double-quotes per RFC 4180.                               |
| Formula-injection (`=`, `+`, `-`, `@`) | Prepended with `'` to neutralize spreadsheet formula execution. |
| Special chars in `commitmentId`| Replaced with `-` via `sanitizeExportFilename`.                      |
