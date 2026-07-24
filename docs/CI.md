# Continuous Integration

This document describes the CI workflows in `.github/workflows/` and how to run
their checks locally.

## Workflows

| Workflow | File | Purpose | Blocking? |
| -------- | ---- | ------- | --------- |
| Coverage Check | `coverage.yml` | Vitest with coverage thresholds | Yes |
| Lighthouse | `lighthouse.yml` | Lab performance/a11y/SEO audits | Warn |
| CodeQL | `codeql.yml` | Security static analysis | Yes |
| Contracts | `contracts.yml` | Soroban contract checks | Yes |
| **Typecheck** | `typecheck.yml` | `tsc --noEmit` type feedback | **Reporting (non-blocking) — see below** |

## Typecheck gate

```bash
npm run typecheck   # tsc --noEmit, using the project tsconfig.json
```

The `typecheck` script runs `tsc --noEmit` against the **same `tsconfig.json`
the build uses**, so there is no config drift. It gives fast, isolated type
feedback locally and in CI without producing build output.

### Why it is currently non-blocking

Two things make a hard type gate impossible to turn on today:

1. **The build does not type-check.** `next.config.js` sets
   `typescript.ignoreBuildErrors: true` (and `eslint.ignoreDuringBuilds: true`),
   so `next build` never fails on type errors. Types have therefore been
   effectively unenforced.
2. **There is an existing type-error backlog**, almost entirely in test files
   (missing test-runner globals, drifted helper signatures, stale import paths),
   plus a smaller set in application source.

So `typecheck.yml` runs `npm run typecheck` with `continue-on-error: true`: it
**reports** the current type-error surface on every PR/push but does not block
merges yet.

### Making it blocking

The intended path to a real gate:

1. Burn the backlog down to zero (`npm run typecheck` clean). Tackling the test
   files first removes the bulk of it; consider a dedicated test `tsconfig` that
   pulls in the Vitest globals so test files type-check the way they run.
2. Remove `continue-on-error: true` from the `Typecheck` step in
   `typecheck.yml`.
3. Optionally also set `typescript.ignoreBuildErrors: false` in `next.config.js`
   so the build enforces types too.

Until step 1 is done, please avoid adding **new** type errors — the reporting
job makes them visible in the PR checks.
