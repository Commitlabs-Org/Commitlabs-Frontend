# Toast History

## Overview

`ToastHistory` is a companion component to the existing `ToastProvider` that records every dismissed (or auto-expired) client toast into a bounded in-memory store and surfaces those entries as a reviewable notification-history panel.

This bridges the gap between ephemeral toasts and the notifications center: users who miss a transient toast can open the history panel to review what happened.

Server-derived notifications are deliberately kept separate — history entries carry `source: "toast"` so consuming UIs can filter them without ambiguity.

---

## Architecture

```
ToastProvider (context)
├── active toasts (visible queue, max 5)
└── history store (dismissed toasts, max 50 entries)
    └── ToastHistoryEntry { id, severity, title, description,
                           createdAt, dismissedAt, read, source }
```

`ToastHistory` reads from the same context and renders the history list. `useToastHistoryUnreadCount` is a lightweight hook for badge counts in nav bars or notification-center icons.

---

## Usage

### Basic — drop into the notifications center

```tsx
import { ToastHistory } from '@/components/toast/ToastHistory';

// Inside any component rendered within ToastProvider:
export function NotificationsPanel() {
  return (
    <aside aria-label="Notifications panel">
      <ToastHistory />
    </aside>
  );
}
```

### Limit rendered entries

```tsx
<ToastHistory maxEntries={10} />
```

### Show an unread badge in a nav icon

```tsx
import { useToastHistoryUnreadCount } from '@/components/toast/ToastHistory';

function NotificationsIcon() {
  const unread = useToastHistoryUnreadCount();
  return (
    <button type="button" aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}>
      <BellIcon />
      {unread > 0 && <span aria-hidden="true">{unread}</span>}
    </button>
  );
}
```

### Programmatic history access via `useToast`

```tsx
const { history, clearHistory, markHistoryRead, markAllHistoryRead } = useToast();
```

---

## API

### `<ToastHistory>` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxEntries` | `number` | all entries | Maximum number of history items rendered. |

### `useToastHistoryUnreadCount(): number`

Returns the count of unread toast-history entries from context.

### Context additions (`ToastContextValue`)

| Property | Type | Description |
|----------|------|-------------|
| `history` | `ToastHistoryEntry[]` | Ordered (newest first) array of dismissed toasts. |
| `clearHistory` | `() => void` | Remove all history entries. |
| `markHistoryRead` | `(id: string) => void` | Mark a single entry as read. |
| `markAllHistoryRead` | `() => void` | Mark all entries as read. |

### `ToastHistoryEntry` shape

```ts
interface ToastHistoryEntry {
  id: string;
  severity: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  createdAt: number;   // ms since epoch — when the toast first appeared
  dismissedAt: number; // ms since epoch — when it left the visible queue
  read: boolean;
  source: 'toast';     // always "toast" — never mixed with server notifications
}
```

---

## Behavior

- **Bounded store** — the history is capped at 50 entries (oldest are discarded first).
- **No duplicates** — dismissing the same toast ID twice is a no-op in the store.
- **Auto-expire recording** — toasts that auto-dismiss via their timer are recorded exactly as manual dismissals are.
- **`dismissAll` recording** — all currently visible toasts are archived when `dismissAll` is called.
- **Privacy-safe** — only `title`, `description`, `severity`, and timestamps are stored. No user-supplied action callbacks or sensitive payloads are retained.

---

## Accessibility

- The history panel is wrapped in a `<section aria-label="Notification history">` so keyboard users can jump to it with a landmarks shortcut.
- The list uses `role="list"` with an `aria-label`.
- Each list item has an `aria-label` describing severity, title, description, and dismissal time.
- The unread badge uses `aria-label="N unread"` and is hidden from AT when count is zero.
- "Mark read" and "Clear all" buttons have descriptive accessible labels.
- No `prefers-reduced-motion` concerns — the panel is static (no animation).

---

## Related docs

- [Toast System](./TOAST_SYSTEM.md) — the base toast provider, its API, and aria-live announcer details.
- [Toast Actions](./TOAST_ACTIONS.md) — how to add interactive action buttons to toasts.
