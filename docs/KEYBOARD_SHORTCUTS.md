# Keyboard Shortcuts Help Overlay

A discoverable reference for the app's global keyboard shortcuts, opened
with `?` (Shift+/) from anywhere -- except while a form field is focused.

## Architecture

- **`GLOBAL_SHORTCUTS`** (`src/lib/shortcuts.ts`) -- a single typed registry
  of `{ keys, description, group }` entries. This is the source of truth: add
  an entry here whenever a new global shortcut is introduced elsewhere in the
  app (e.g. the command palette's `Cmd/Ctrl+K`), so the overlay can never
  drift out of sync with real bindings.
- **`KeyboardShortcutsOverlay`** (`src/components/shell/KeyboardShortcutsOverlay.tsx`)
  -- listens globally for `?`, and renders the registry (grouped by
  `group`) in the shared `Dialog` primitive. Mount it once per page (or
  once in a shell component that's always mounted); it listens on `window`
  regardless of where it's rendered in the tree.

## Usage

```tsx
import { KeyboardShortcutsOverlay } from '@/components/shell/KeyboardShortcutsOverlay';

export default function SomePage() {
  return (
    <main>
      <KeyboardShortcutsOverlay />
      {/* ... */}
    </main>
  );
}
```

## Behavior

- `?` is ignored while an `<input>`, `<textarea>`, `<select>`, or any
  `contenteditable` element is focused, so typing a literal `?` in a form
  field never triggers it.
- Rendered in the shared `Dialog` primitive: full focus trap, `Escape` to
  close, background made `inert`, focus restored to whatever was focused
  before opening.
- Respects `prefers-reduced-motion` -- inherited from `Dialog`, which
  disables its open/close transition classes when the user has that
  preference set.

## Testing

See `src/components/shell/KeyboardShortcutsOverlay.test.tsx`: renders
nothing initially, opens on `?` when nothing is focused, ignores `?` while
an input/textarea/contenteditable is focused, closes on `Escape` and via the
Close button, restores focus on close, and renders the registry grouped by
section. See `src/lib/shortcuts.test.ts` for the grouping helper.
