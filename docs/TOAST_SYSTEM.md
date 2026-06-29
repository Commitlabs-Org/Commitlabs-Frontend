# Toast System

## Overview

A global, accessible toast notification system for consistent success, error, info, and warning feedback across the app.

## Usage

Wrap the app with `ToastProvider` in `src/app/layout.tsx`:

```tsx
import { ToastProvider } from '@/components/toast/ToastProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
```

Use `useToast` in client components:

```tsx
'use client';
import { useToast } from '@/components/toast/ToastProvider';

function Example() {
  const toast = useToast();

  return (
    <button
      onClick={() =>
        toast.success({
          title: 'Saved',
          description: 'Your changes were saved successfully.',
        })
      }
    >
      Save
    </button>
  );
}
```

## API

- `success(options)`
- `error(options)`
- `info(options)`
- `warning(options)`
- `dismiss(id)`
- `dismissAll()`

Options:
- `title: string`
- `description?: string`
- `duration?: number` (ms; `0` disables auto-dismiss)

## Behavior

- Auto-dismiss after `duration` (default `5000` ms).
- Pause on hover/focus; resume on leave/blur.
- Max visible toasts: `5`; extra toasts are dropped from the visible queue.
- Accessible live regions for screen readers.
- Respects `prefers-reduced-motion`.

## Aria-live Announcer

`ToastProvider` renders two visually-hidden `aria-live` regions that announce toast text to screen readers as toasts are added.

| Severity | Region | `aria-live` |
|----------|--------|-------------|
| `error` | `[data-toast-announcer="assertive"]` | `assertive` |
| `success`, `info`, `warning` | `[data-toast-announcer="polite"]` | `polite` |

The announced text is the toast `title` (and `description`, if present, joined with ` — `). When a new toast fires, the opposing region is cleared to avoid stale announcements. The regions use `aria-atomic="true"` so assistive tech reads the full updated text.

The regions are hidden from view using inline clip/overflow styles (equivalent to a `.sr-only` class) and are never interactive.

### Custom transport hook

To forward error records to an observability sink alongside announcements, see `src/lib/observability/reportError.ts` (wired into `src/app/error.tsx`).