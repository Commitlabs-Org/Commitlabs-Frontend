# Git Hooks

This repository uses [Husky](https://typicode.github.io/husky/) and
[lint-staged](https://github.com/lint-staged/lint-staged) to catch issues
before they reach CI, keeping the feedback loop short for contributors.

## How it works

Hooks are installed automatically after `npm install` (or `pnpm install`) via
the `prepare` script, which runs `husky`.

### pre-commit

The [`.husky/pre-commit`](../.husky/pre-commit) hook runs `lint-staged`, which
operates **only on staged files** so commits stay fast. For staged
`*.{ts,tsx,js,jsx}` files it:

1. Runs `eslint --fix` to auto-fix and report lint errors.
2. Runs `tsc --noEmit` for a typecheck.

If lint or the typecheck fails, the commit is aborted so the problem is fixed
locally rather than in CI.

## Bypassing the hook

In an emergency you can skip the hook with:

```bash
git commit --no-verify -m "wip: ..."
```

Use this sparingly — CI still runs the full lint, typecheck, and test suite, so
bypassing locally only defers the feedback.

## Notes

- The hook is intentionally lightweight and never runs the full test suite.
- CI does not re-run these hooks; it runs the equivalent checks directly, so
  there is no redundant work.
