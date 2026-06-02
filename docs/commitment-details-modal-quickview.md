# CommitmentDetailsModal Quick-View Design

This design note documents the new quick-view layout for `src/components/modals/CommitmentDetailsModal.tsx`.

## Purpose

The quick-view is intended for compact access from marketplace cards and commitment grids. It emphasizes scannability by prioritizing:

- Risk profile and commitment type
- Current status and market value
- Committed amount, remaining term, yield, and maximum loss
- Compliance and attestation summaries

## Layout

- Sticky modal header with commitment type badge and live status indicator
- Highlighted current market value panel
- Two-column summary cards for key metrics
- Compliance items grouped as actionable attestations
- Visible action path to the full commitment page

## Action

- `View full details` links to `/commitments/[id]`
- `Done` closes the quick-view

## Accessibility

- `role="dialog"` and `aria-modal="true"` are supported
- Focus is trapped inside the modal while open
- Focus is restored to the previously focused element after close
- Escape closes the modal cleanly
