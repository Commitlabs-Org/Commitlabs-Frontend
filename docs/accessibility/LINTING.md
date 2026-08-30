# Accessibility Linting

## Overview

The frontend now enables the recommended `jsx-a11y` ESLint rules to catch common accessibility issues during development and CI.

## Enabled rule set

The repository extends the recommended `jsx-a11y` configuration in `.eslintrc.json`.

This helps enforce:

- meaningful alt text and accessible images
- keyboard-accessible links and buttons
- proper form labels and associations
- safe interactive element patterns for modal and menu UI

## Local validation

Run the accessibility lint check locally with:

```bash
./node_modules/.bin/eslint "src/components/**/*.{ts,tsx}" "src/app/**/*.{ts,tsx}" --ext .ts,.tsx
```

## Notes

- Inline eslint suppressions are only used when a UI pattern genuinely requires a targeted exception and the reason is documented in the code.
- The goal is to keep the app accessible for keyboard, screen-reader, and assistive-technology users while preventing regressions in reusable UI components.

## Enabled `jsx-a11y` rules

This repository extends `plugin:jsx-a11y/recommended` in `.eslintrc.json`, which enables rules such as:

- `jsx-a11y/alt-text`
- `jsx-a11y/anchor-is-valid`
- `jsx-a11y/click-events-have-key-events`
- `jsx-a11y/no-static-element-interactions`
- `jsx-a11y/label-has-associated-control`
- `jsx-a11y/aria-props`
- `jsx-a11y/aria-unsupported-elements`
- `jsx-a11y/no-noninteractive-tabindex`
