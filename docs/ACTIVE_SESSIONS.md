# Active Sessions

The Active Sessions feature lets users see every authenticated session on their account and revoke all other sessions from the Settings page.

## Overview

The feature consists of:

| Layer | Path |
|---|---|
| UI component | `src/components/settings/ActiveSessionsSection.tsx` |
| Settings page integration | `src/app/settings/page.tsx` |
| List sessions API | `src/app/api/auth/sessions/route.ts` |
| Revoke others API | `src/app/api/auth/sessions/revoke-others/route.ts` |
| Auth helpers | `src/lib/backend/auth.ts` — `listOtherSessions`, `revokeOtherSessions` |
| Tests | `src/components/settings/ActiveSessions.test.tsx` |

## Component: `ActiveSessionsSection`

```tsx
import { ActiveSessionsSection } from '@/components/settings/ActiveSessionsSection'
import type { ActiveSession } from '@/components/settings/ActiveSessionsSection'
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `sessions` | `ActiveSession[]` | `[]` | Sessions to display. Current session must have `isCurrent: true`. |
| `onRevokeOthers` | `() => Promise<void>` | Falls back to `POST /api/auth/sessions/revoke-others` | Called when the user confirms revocation. |

### `ActiveSession` type

```ts
interface ActiveSession {
  id: string          // Opaque session identifier
  userAgent: string   // Device/browser hint
  ipAddress: string   // IP at sign-in time
  createdAt: string   // ISO 8601 timestamp
  isCurrent: boolean  // True for the calling session
}
```

### Usage example

```tsx
'use client'
import { useState, useEffect } from 'react'
import { ActiveSessionsSection } from '@/components/settings/ActiveSessionsSection'
import type { ActiveSession } from '@/components/settings/ActiveSessionsSection'

export default function MyPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([])

  useEffect(() => {
    fetch('/api/auth/sessions', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => setSessions(d.sessions ?? []))
  }, [])

  return (
    <ActiveSessionsSection
      sessions={sessions}
      onRevokeOthers={async () => {
        await fetch('/api/auth/sessions/revoke-others', {
          method: 'POST',
          credentials: 'same-origin',
        })
        setSessions(prev => prev.filter(s => s.isCurrent))
      }}
    />
  )
}
```

## API Routes

### `GET /api/auth/sessions`

Returns a JSON object with the `sessions` array. Requires a valid session cookie.

**Response**

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_abc123",
        "userAgent": "Mozilla/5.0 ...",
        "ipAddress": "203.0.113.1",
        "createdAt": "2024-06-01T10:00:00.000Z",
        "isCurrent": true
      }
    ]
  }
}
```

### `POST /api/auth/sessions/revoke-others`

Revokes every session for the authenticated address except the caller's own session.

**Response**

```json
{
  "success": true,
  "data": {
    "message": "Revoked 2 other sessions.",
    "revokedCount": 2
  }
}
```

Both endpoints return `401` if the request has no valid session cookie.

## Accessibility

- The sessions list uses `<ul>` / `<li>` semantics with an `aria-label`.
- A `role="status" aria-live="polite"` region announces success and error messages to screen readers without interrupting the user.
- The confirmation dialog uses `role="alertdialog"` with `aria-labelledby` and `aria-describedby`.
- Destructive buttons are clearly labelled and require explicit confirmation before any irreversible action is taken.
- All interactive elements are keyboard-reachable and support focus management.

## Edge Cases

| Case | Behaviour |
|---|---|
| Current session | Marked with a "Current" badge; never revocable from this UI |
| No other sessions | Revoke button is hidden |
| Revoke success | Status message shown in live region; other sessions removed from list |
| Revoke error | Error shown with `role="alert"`; user can retry |
| Unauthenticated request | API returns `401`; component shows generic error |

## Related docs

- [Backend session & CSRF docs](./backend-session-csrf.md)
- [Settings unsaved guard](./SETTINGS_UNSAVED_GUARD.md)
- [Wallet auth flow](./WALLET_AUTH.md)
