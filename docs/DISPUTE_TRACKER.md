# Dispute Status Tracker

A read-only stepper rendered on the commitment detail page that makes the dispute lifecycle visible to the affected user.

## Where it lives

| File | Purpose |
|------|---------|
| `src/components/dispute/DisputeStatusTracker.tsx` | Component + exported types |
| `src/components/dispute/DisputeStatusTracker.test.tsx` | RTL unit tests |
| `src/app/commitments/[id]/page.tsx` | Mount point |

## Data sources

In production the component is fed from two existing routes:

- `GET /api/commitments/[id]` — commitment `status` field (`DISPUTED` triggers the tracker)
- `GET /api/commitments/[id]/history` — lifecycle events supply timestamps and reason context

The detail page currently uses mock data (`MOCK_DISPUTES`). Replace those entries with real API responses when the backend dispute indexer is wired up.

## Props

```ts
interface DisputeStatusTrackerProps {
  dispute: DisputeInfo | null; // null → component renders nothing
}

interface DisputeInfo {
  stage: 'filed' | 'under_review' | 'resolved';
  filedAt?: string;          // ISO-8601
  reasonCategory?: string;   // free-text label shown under Filed step
  reviewStartedAt?: string;  // ISO-8601
  resolvedAt?: string;       // ISO-8601
  resolution?:
    | 'resolved_in_favor_of_owner'
    | 'resolved_in_favor_of_counterparty'
    | 'dismissed';
}
```

## Stepper stages

| Stage | Step highlighted | Notes |
|-------|-----------------|-------|
| `filed` | Filed | Dispute submitted, awaiting triage |
| `under_review` | Under Review | Under active investigation |
| `resolved` | Resolved | Shows outcome label |

## Accessibility

- The outer `<section>` is labelled via `aria-labelledby` pointing at the heading.
- The step list is an `<ol>` with `aria-label="Dispute lifecycle steps"`.
- Each `<li>` receives `aria-current="step"` only on the active step.
- Decorative SVG indicators carry `aria-hidden="true"`.

## Rendering rules

- The component returns `null` when `dispute` is `null` — safe to place unconditionally.
- All date fields are optional; the step simply omits the timestamp when absent.
- `reasonCategory` is shown beneath the Filed step label.
- The resolution outcome label is shown beneath the Resolved step label only when `resolution` is provided.
