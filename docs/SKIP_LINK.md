# Skip Link

CommitLabs app-shell routes include a `Skip to main content` link before the
sidebar navigation. Keyboard and screen-reader users can use it to bypass the
persistent `AppSidebar` and move directly to the page content.

## Usage

`AppShellLayout` renders the skip link automatically for every route wrapped by
the shell:

```tsx
import { AppShellLayout } from '@/components/shell/AppShellLayout'

export default function CommitmentsPage() {
  return (
    <AppShellLayout>
      <h1>My Commitments</h1>
    </AppShellLayout>
  )
}
```

The layout assigns `id="main-content"` and `tabIndex={-1}` to the `<main>`
landmark so the link has a stable target and scripts or assistive technology can
move focus there.

## Accessibility Behavior

- The skip link is the first focusable control in `AppShellLayout`.
- It stays visually hidden for pointer users and becomes visible when focused.
- It links to the main landmark without changing the page layout.
- It respects `prefers-reduced-motion: reduce` by disabling its focus
  transition.

## Validation

Use keyboard navigation on any app-shell route:

1. Press `Tab` once after page load.
2. Confirm `Skip to main content` is visible.
3. Press `Enter`.
4. Confirm focus moves to the main content region before the sidebar links.
