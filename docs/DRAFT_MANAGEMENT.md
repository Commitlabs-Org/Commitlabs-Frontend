# Draft Management

## Overview

`useDraftPersistence` manages multiple named commitment wizard drafts in `localStorage` with automatic
TTL-based expiry. Users can keep several drafts in progress simultaneously; stale drafts are pruned
automatically on load so they never accumulate forever.

## API

### `useDraftPersistence(draftId?: string)`

```typescript
import { useDraftPersistence } from '@/hooks/useDraftPersistence';

const {
  draft,         // DraftState | null — the draft for the bound draftId (or null)
  drafts,        // DraftMap — Record<string, NamedDraft> of all live drafts
  allDrafts,     // NamedDraft[] — sorted newest-updated first
  saveDraft,     // (data: DraftState, id?: string) => void — debounced 500 ms
  clearDraft,    // (id?: string) => void — remove one draft
  clearAllDrafts,// () => void — remove all drafts
  resumeDraft,   // (id?: string) => DraftState | null
} = useDraftPersistence('my-draft-id');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `draftId` | `string \| undefined` | Optional. Binds the hook to a specific draft so that `draft` and `resumeDraft()` operate on it by default. |

### Types

```typescript
interface DraftState {
  step: number;
  selectedType: 'safe' | 'balanced' | 'aggressive' | null;
  commitmentType: 'safe' | 'balanced' | 'aggressive';
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
}

interface NamedDraft {
  id: string;
  data: DraftState;
  createdAt: number;  // Unix ms
  updatedAt: number;  // Unix ms
}

type DraftMap = Record<string, NamedDraft>;
```

### Storage keys

| Key | Purpose |
|-----|---------|
| `commitlabs-create-drafts` | Multi-draft map (current) |
| `commitlabs-create-draft` | Legacy single-draft key (migrated on first load, then removed) |

## Features

### Multiple named drafts

Each draft is stored under a unique `id`. Pass the same `id` to `saveDraft` to update an existing
draft; use a new `id` (or let the hook generate one) to start an additional draft.

```typescript
// Create / update two independent drafts
saveDraft(wizardStateA, 'project-alpha');
saveDraft(wizardStateB, 'project-beta');
```

### TTL expiry (7 days)

Drafts whose `updatedAt` is older than `DRAFT_TTL_MS` (7 days) are pruned silently on every load.
The exported constant is available for tests and custom logic:

```typescript
import { DRAFT_TTL_MS } from '@/hooks/useDraftPersistence';
```

### Backwards-compatible migration

On the first load after upgrading from the single-draft version, the hook reads the legacy key
`commitlabs-create-draft`, wraps it as a `NamedDraft`, writes it to the new multi-draft store, and
removes the old key. No user action or data loss occurs.

### Schema validation

Drafts are validated with [Zod](https://zod.dev). Any draft that fails validation is discarded and
removed from storage so invalid data never surfaces in the UI.

## `ResumeDraftPrompt` component

```tsx
import ResumeDraftPrompt from '@/components/create/ResumeDraftPrompt';

<ResumeDraftPrompt
  drafts={allDrafts}          // NamedDraft[] — pass allDrafts from the hook
  onResume={(id) => ...}      // called with the chosen draft id
  onStartFresh={() => ...}    // called when user dismisses / starts fresh
  onDeleteDraft={(id) => ...} // optional — renders a Delete button per draft
/>
```

The component renders nothing when `drafts` is empty. It is fully keyboard-navigable and uses
`role="dialog"` / `aria-modal="true"` for screen-reader compatibility.

## Accessibility

- The modal has `role="dialog"` and `aria-modal="true"`.
- The draft list has `aria-label="Saved drafts"`.
- All interactive controls have visible focus rings (`focus:ring-2`).
- No motion-specific animations are used, so `prefers-reduced-motion` is not a concern.

## Usage example

```tsx
'use client';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import ResumeDraftPrompt from '@/components/create/ResumeDraftPrompt';

export default function CreatePage() {
  const { allDrafts, saveDraft, clearDraft, resumeDraft } = useDraftPersistence();
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null);

  if (allDrafts.length > 0 && activeDraftId === null) {
    return (
      <ResumeDraftPrompt
        drafts={allDrafts}
        onResume={(id) => setActiveDraftId(id)}
        onStartFresh={() => setActiveDraftId('new')}
        onDeleteDraft={(id) => clearDraft(id)}
      />
    );
  }

  // ... rest of create wizard
}
```

## Related docs

- [Create Draft Autosave](./CREATE_DRAFT_AUTOSAVE.md) — original single-draft implementation
- [Create Draft Validation](./CREATE_DRAFT_VALIDATION.md)
