# Duplicate Commitment — Prefill Create Flow

This document describes the **Duplicate** action that lets users open the commitment
create wizard pre-filled with the configurable parameters of an existing commitment.

---

## Overview

When a user wants a new commitment similar to one they already own, they no longer
need to re-enter every field from scratch. A **Duplicate Commitment** button on the
commitment detail page routes them to `/create?sourceId=<id>`, where the wizard
loads the source commitment's parameters and pre-populates step 2 (Configure).

Identity-bound fields — `id`, `ownerAddress`, on-chain state — are intentionally
**not** copied. Only the configurable parameters listed below are prefilled.

### Prefilled fields

| Field | Type | Notes |
|---|---|---|
| `commitmentType` | `"safe" \| "balanced" \| "aggressive"` | Falls back to `"balanced"` if invalid |
| `amount` | `string` | Converted to string; user may edit freely |
| `asset` | `string` | e.g. `"XLM"`, `"USDC"` |
| `durationDays` | `number` | Clamped to `[1, 365]` |
| `maxLossPercent` | `number` | Clamped to `[0, 100]` |

---

## Component / hook API

### `usePrefillFromCommitment(): PrefillData | null`

**File:** `src/hooks/usePrefillFromCommitment.ts`

Reads the `sourceId` query parameter from the current URL, fetches
`/api/commitments/<sourceId>`, and returns a `PrefillData` object.

Returns `null` while loading, when no `sourceId` is present, or when the source
commitment cannot be loaded (network error, 404, etc.).

```ts
interface PrefillData {
  commitmentType: "safe" | "balanced" | "aggressive";
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
}
```

### `CommitmentDetailActions` — `onDuplicate` prop

**File:** `src/components/CommitmentDetailActions.tsx`

The existing `CommitmentDetailActions` component accepts an optional
`onDuplicate?: (commitmentId: string) => void` prop. When provided alongside a
`commitmentId`, a **Duplicate Commitment** button is rendered in the
"Additional Actions" section.

```tsx
<CommitmentDetailActions
  // ...existing props...
  commitmentId="CMT-42"
  onDuplicate={(id) => router.push(`/create?sourceId=${id}`)}
/>
```

### `CreateCommitment` page — prefill banner

**File:** `src/app/create/page.tsx`

When the `?sourceId` query parameter is present and a source commitment is loaded
successfully, the page:

1. Skips step 1 (type selection) and opens directly on step 2 (configure).
2. Pre-fills all configurable fields from the source commitment.
3. Shows a status banner informing the user they are in duplicate mode.

All pre-filled fields are fully editable. Submitting creates a **new** commitment;
the source is unaffected.

---

## Accessibility

- The Duplicate button has an explicit `aria-label` describing the action and its
  effect: `"Duplicate Commitment - create a new commitment prefilled with these parameters"`.
- The prefill banner uses `role="status"` and `aria-live="polite"` so screen
  readers announce it without interrupting the current focus.
- Keyboard focus lands on the configure-step heading (existing behaviour via
  `headingRef`) when the wizard opens at step 2.

---

## Usage example

```tsx
// On a commitment detail page:
import { useRouter } from "next/navigation";
import { CommitmentDetailActions } from "@/components/CommitmentDetailActions";

function CommitmentDetailPage({ commitmentId }: { commitmentId: string }) {
  const router = useRouter();

  return (
    <CommitmentDetailActions
      canEarlyExit={false}
      onEarlyExit={() => {}}
      onViewAttestations={() => {}}
      onExportData={() => {}}
      onReportIssue={() => {}}
      commitmentId={commitmentId}
      onDuplicate={(id) => router.push(`/create?sourceId=${encodeURIComponent(id)}`)}
    />
  );
}
```

---

## Edge cases

| Scenario | Behaviour |
|---|---|
| `sourceId` not in URL | `usePrefillFromCommitment` returns `null`; wizard starts normally |
| Source commitment returns 404 | Returns `null`; wizard starts normally; no error thrown |
| Network failure during fetch | Returns `null`; wizard starts normally |
| `commitmentType` value unknown | Falls back to `"balanced"` |
| `durationDays` out of range | Clamped to `[1, 365]` |
| `maxLossPercent` out of range | Clamped to `[0, 100]` |
| Draft exists + sourceId present | Prefill wins; resume prompt is dismissed |

---

## Related files

- `src/hooks/usePrefillFromCommitment.ts` — hook (new)
- `src/components/CommitmentDetailActions.tsx` — Duplicate button (updated)
- `src/app/create/page.tsx` — prefill integration + banner (updated)
- `src/app/create/DuplicateCommitment.test.tsx` — tests (new)
