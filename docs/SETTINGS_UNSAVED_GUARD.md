# Settings Unsaved Changes Guard

This feature adds a **dirty‑state indicator** and a **navigation guard** to the Settings page.

## What it does
- Tracks the initial snapshot of the notification preferences.
- Shows an inline **"Unsaved changes"** badge when the current form differs from the snapshot.
- Disables the **Save** button until there are changes.
- Prompts the user if they attempt to leave the page (via back/forward navigation or browser refresh/close) while unsaved changes exist.
- Resets the baseline after a successful save or a manual reset.

## Implementation details
- New hook: `useUnsavedChangesGuard` located at `src/hooks/useUnsavedChangesGuard.ts`.
- Settings page (`src/app/settings/page.tsx`) now imports and uses the hook.
- UI updates include the badge and conditional disabling of the Save button.
- Tests added for the hook and the Settings page UI.

## How to use
The hook can be reused for any form that needs dirty‑state tracking:
```tsx
const { isDirty, resetBaseline } = useUnsavedChangesGuard(formState);
```
Call `resetBaseline()` after persisting the changes.
