# Transaction State Persistence

**File:** `src/hooks/useTransactionPersistence.ts`  
**Consumer:** `src/app/TransactionProgressModal.tsx`

## Overview

`TransactionProgressModal` persists its in-flight state to `localStorage` so that a page reload re-opens the modal at the correct step. When the user returns after an accidental reload they see exactly where the transaction was (e.g. "Confirming Transaction") and retain the copy-hash / retry affordances.

## How It Works

| Phase | Behavior |
|---|---|
| Non-IDLE state received | Hook writes state, timelinePhase, txHash, errorCode, actionName, and a `savedAt` timestamp to `localStorage`. |
| Page reloads | On mount the hook reads storage. If the entry is valid (schema version matches, not older than 30 min) it is exposed as `rehydrated`. |
| Modal renders with `state="IDLE"` | Falls back to `rehydrated.state` and shows the modal in the persisted step. |
| User closes from SUCCESS / ERROR | `handleClose` calls `clearPersisted()` which removes the key before invoking `onClose`. |
| Storage unavailable | All reads/writes are wrapped in try/catch — the component degrades gracefully with no error thrown. |

## API

### `useTransactionPersistence()`

```ts
import { useTransactionPersistence } from '@/hooks/useTransactionPersistence';

const { rehydrated, persist, clearPersisted } = useTransactionPersistence();
```

| Return | Type | Description |
|---|---|---|
| `rehydrated` | `PersistedTransactionState \| null` | Loaded from storage on mount; `null` when absent or expired. |
| `persist(data)` | `(data: Omit<PersistedTransactionState, 'savedAt'>) => void` | Writes current state. Clears storage automatically for terminal states (`SUCCESS`, `IDLE`). |
| `clearPersisted()` | `() => void` | Removes the storage key and resets `rehydrated` to `null`. |

### `PersistedTransactionState`

```ts
interface PersistedTransactionState {
  state: TransactionState;
  timelinePhase: TransactionTimelinePhase;
  actionName: string;
  txHash?: string;
  errorCode?: string;
  successMessage?: string;
  savedAt: number; // Unix ms
}
```

## Storage Details

- **Key:** `commitlabs-tx-progress`
- **Schema version:** `1` (bump and clear on breaking changes)
- **Max age:** 30 minutes — stale entries are removed on read

## Accessibility

The modal already uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`. The rehydrated modal appears with the same markup so screen-reader announcements are unchanged. The existing `aria-live="polite"` region in `TransactionStepTimeline` announces the restored step automatically.

When `prefers-reduced-motion` is active the elapsed-time ticker in `TransactionStepTimeline` is suppressed — this behaviour is preserved for rehydrated sessions.

## Usage Example

```tsx
// In any page/route — no changes needed. TransactionProgressModal handles
// persistence internally. Simply pass the live props as before.

<TransactionProgressModal
  isOpen={txModalOpen}
  state={txState}         // 'IDLE' after reload → falls back to storage
  actionName="Settling Funds"
  txHash={hash}
  errorCode={errCode}
  onClose={handleClose}
  onRetry={handleRetry}
/>
```

On reload, if `txState` is `'IDLE'` but storage has a non-terminal entry, the modal reopens automatically. Once the user closes it (via the close button, "Close" action, or "View Details") storage is cleared and the modal will not reopen on subsequent reloads.

## Related

- [`docs/TRANSACTION_TIMELINE.md`](./TRANSACTION_TIMELINE.md) — step timeline component
- [`docs/MODAL_SYSTEM.md`](./MODAL_SYSTEM.md) — modal system overview
- [`docs/CREATE_DRAFT_AUTOSAVE.md`](./CREATE_DRAFT_AUTOSAVE.md) — similar localStorage pattern used in commitment drafts
