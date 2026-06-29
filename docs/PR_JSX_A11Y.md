# PR Documentation: JSX Accessibility Linting

## Summary

This PR enables the recommended `jsx-a11y` ESLint rules across the frontend and fixes the accessibility issues they surface.
The goal is to make accessibility checks part of the normal development workflow and reduce regressions in interactive UI components.

## What changed

- Enabled the recommended `jsx-a11y` rules in `.eslintrc.json`.
- Fixed accessibility violations in affected components and route views, including:
  - keyboard-accessible interactive controls
  - proper label associations for form-like controls
  - valid link semantics and navigable anchors
  - safer interactive patterns in dialogs and menus
- Added documentation for the linting setup and local validation steps in `docs/accessibility/LINTING.md`.

## Why this matters

- Helps prevent common accessibility regressions in buttons, links, forms, and dialogs.
- Improves support for keyboard and assistive-technology users.
- Makes accessibility enforcement part of the regular frontend workflow rather than a one-off review task.

## Testing

1. Run the targeted lint check for updated UI files:
   - `./node_modules/.bin/eslint "src/components/**/*.{ts,tsx}" "src/app/**/*.{ts,tsx}" --ext .ts,.tsx`
2. Confirm the updated `jsx-a11y` issues are resolved.
3. Optionally run the broader repo lint command:
   - `corepack pnpm lint`

## Notes

- This PR focuses on enabling and remediating the accessibility issues surfaced by `jsx-a11y`.
- Some unrelated repository-wide lint issues remain outside the scope of this change.
- The new documentation provides a repeatable local validation path for future contributors.
