# Product Requirements Document: Enable jsx-a11y Linting

## Summary

Enable recommended JSX accessibility linting across the CommitLabs frontend to catch common ARIA and interaction issues early in development and prevent regressions in CI.

## Goal

- Turn on `plugin:jsx-a11y/recommended` in `.eslintrc.json`.
- Fix all accessibility violations reported by ESLint in `src/components/**` and `src/app/**`.
- Avoid blanket rule suppressions; only allow narrowly scoped, justified exceptions.
- Document the enabled accessibility linting rules and developer workflow in `docs/accessibility/LINTING.md`.

## Problem Statement

The frontend currently does not enforce accessibility linting for common JSX/ARIA issues. This leaves the project vulnerable to regressions such as:

- missing `alt` text on images
- non-interactive elements used as buttons or controls
- keyboard navigation gaps
- incorrect `aria-*` usage

## Scope

### In scope

- ESLint configuration changes to enable `jsx-a11y` rules.
- Fixing violations in existing components and app page code.
- Adding or improving documentation to reflect the new linting rules.
- Ensuring the frontend linter passes with the new rules.

### Out of scope

- Rewriting large UI modules unless required by accessibility fixes.
- Adding comprehensive automated a11y testing beyond ESLint enforcement.
- Changing the app architecture or tooling beyond lint configuration and documented requirements.

## Requirements

### Functional requirements

1. `.eslintrc.json` must extend `plugin:jsx-a11y/recommended`.
2. All `jsx-a11y` rules must pass during `pnpm lint` for the frontend codebase.
3. No broad `eslint-disable` for `jsx-a11y` rules in `src/`.
4. Accessible keyboard behavior for interactive flows (forms, buttons, modals).
5. All created or modified components must support assistive technology semantics.

### Documentation requirements

1. Update or create `docs/accessibility/LINTING.md` to describe:
   - the enabled `jsx-a11y` rule set
   - how to run the lint check locally
   - when inline suppressions are acceptable
2. Add notes if the CI lint command changes or if special environment setup is required.

## User Stories

- As a frontend developer, I want accessibility issues caught by lint so I can fix them before they reach review.
- As an accessibility reviewer, I want the codebase to enforce `jsx-a11y` rules so regressions are prevented.
- As a user of assistive technology, I want UI controls and forms to behave correctly with keyboard and screen readers.

## Acceptance Criteria

- [ ] `.eslintrc.json` includes `plugin:jsx-a11y/recommended`.
- [ ] `docs/accessibility/LINTING.md` explains the active linting rules and workflow.
- [ ] No `jsx-a11y` suppression comments remain in `src/**/*.{ts,tsx}` except for documented, narrowly scoped exceptions.
- [ ] `pnpm lint` passes in the project environment once dependencies are installed.
- [ ] Any new or changed logic is covered by tests where applicable.

## Success Metrics

- `jsx-a11y` issues no longer appear in the frontend lint pass.
- The repo gains a documented accessibility linting workflow.
- Code review feedback on accessibility regressions decreases.

## Constraints

- The project uses Next.js App Router and TypeScript.
- The repo requires Node `>=20.0.0 <21.0.0` and `pnpm >=9.0.0`.
- External network issues or unavailable package registries may temporarily impact installation.

## Notes

- The current `.eslintrc.json` already extends `plugin:jsx-a11y/recommended` in the repository.
- Ensure that form and button semantics are preserved when refactoring from non-interactive wrappers.
- Keep the linting change limited to accessibility enforcement without introducing unrelated style changes.
