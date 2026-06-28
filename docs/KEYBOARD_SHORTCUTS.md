# Keyboard Shortcuts

## Overview

The authenticated app shell includes a keyboard shortcuts overlay so users can discover global bindings without leaving their current workflow. Press `?` from anywhere in the app shell to open the reference.

## Component API

`KeyboardShortcutsOverlay` lives at `src/components/shell/KeyboardShortcutsOverlay.tsx`.

```tsx
interface KeyboardShortcutsOverlayProps {
  isOpen: boolean
  onClose: () => void
}
```

`AppShellLayout` owns the global `?` key handler and renders the overlay. Shortcut metadata is defined once in `src/lib/keyboardShortcuts.ts`; the command palette hook also reads from that registry so the visible help stays aligned with the actual `Cmd/Ctrl+K` binding.

## Accessibility

- The overlay reuses the shared `Dialog` primitive for `role="dialog"`, `aria-modal`, focus trapping, scroll lock, and Escape-to-close behavior.
- Pressing `?` is ignored while focus is inside `input`, `textarea`, `select`, or contenteditable elements.
- Focus returns to the previously focused element when the overlay closes.
- Dialog animations inherit the shared reduced-motion handling from `Dialog`.

## Usage Example

```tsx
import { AppShellLayout } from '@/components/shell/AppShellLayout'

export default function CommitmentsPage() {
  return (
    <AppShellLayout>
      <h1>My commitments</h1>
    </AppShellLayout>
  )
}
```

With the page wrapped in `AppShellLayout`, users can press `?` to open the shortcut reference and `Esc` to close it.
