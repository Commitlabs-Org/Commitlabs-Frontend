# PR Documentation: Enable jsx-a11y ESLint Rules

## Summary

This PR enables the recommended `jsx-a11y` rules in `.eslintrc.json` and fixes all violations reported across the frontend component tree.
The goal is to enforce accessibility best practices automatically in CI and prevent common issues such as missing `alt` text, clickable non-interactive elements, and improper label/control associations.

## What changed

- Updated `.eslintrc.json` to extend `plugin:jsx-a11y/recommended`.
- Fixed accessibility violations across `src/components/**` and `src/app/**`.
- Added documentation for the enabled accessibility linting rules and enforcement expectations in `docs/accessibility/LINTING.md`.

## Why this matters

- Enables automated enforcement of React accessibility best practices.
- Prevents regressions in alt text, keyboard operability, and form labeling.
- Ensures the codebase is aligned with Next.js and React accessibility standards.
- Makes the app more usable for keyboard, screen reader, and assistive technology users.

## How to verify

1. Run the lint command:
   - `pnpm lint`
2. Confirm the command completes without any `jsx-a11y` or other ESLint errors.
3. Review the new docs in `docs/accessibility/LINTING.md`.

## Notes

- No blanket rule disables were introduced.
- Any targeted disable comments must be inline, justified, and reviewed.
- This PR is focused on lint enforcement and remediation, not on new UI behavior.
