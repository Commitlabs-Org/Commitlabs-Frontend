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