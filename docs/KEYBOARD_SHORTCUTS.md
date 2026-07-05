# Keyboard Shortcuts

The authenticated app shell exposes a keyboard-shortcuts overlay so users can
discover global commands without leaving the current page.

## Usage

`AppShellLayout` mounts `KeyboardShortcutsOverlay` and listens for `?`
(`Shift+/`) on `window`. The shortcut is ignored while focus is inside an
`input`, `textarea`, `select`, or `contenteditable` element.

```tsx
<AppShellLayout>
  <Dashboard />
</AppShellLayout>
```

## Shortcut Registry

Shortcut metadata lives in `src/lib/shortcuts/shortcutRegistry.ts`. Add new
global shortcuts there first, then wire their behavior in the relevant shell,
hook, or dialog code. This keeps the help overlay and real bindings aligned.

Current groups:

- Global: command palette and shortcut help.
- Navigation: skip-link behavior.
- Dialogs: Escape-to-close behavior.

## Accessibility

- The overlay uses the shared `Dialog` primitive for focus trapping, scroll lock,
  Escape-to-close, and focus restoration.
- The close button receives initial focus when the overlay opens.
- `prefers-reduced-motion: reduce` disables dialog animation classes through the
  shared primitive.
- Shortcuts are grouped in labelled sections and rendered as semantic keyboard
  tokens with readable descriptions.
