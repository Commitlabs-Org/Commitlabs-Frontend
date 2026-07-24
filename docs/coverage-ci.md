# Coverage CI Workflow

## Overview

The `coverage.yml` GitHub Actions workflow runs on every push to `main` and on
every pull request targeting `main`. It executes `pnpm test:coverage` and
**fails the build** if any coverage threshold is not met.

## Coverage Scope

Coverage is collected for a curated set of well-tested source files. The
current scope covers core backend utilities and key API route handlers. Excluded
from coverage:

- Generated/config files (`.next/`, `dist/`, `node_modules/`)
- Test infrastructure (`tests/`, `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`)
- CSS modules (`*.module.css`) and type declarations (`*.d.ts`)

As more areas of the codebase reach the threshold, add their paths to the
`include` list in `vitest.config.ts`.

## Thresholds

Configured in `vitest.config.ts`:

| Metric     | Threshold |
|------------|-----------|
| Statements | 95%       |
| Branches   | 95%       |
| Functions  | 95%       |
| Lines      | 95%       |

If any metric falls below its threshold, Vitest exits with a non-zero code and
the CI job fails, blocking the PR from merging.

## Artifacts

The full HTML coverage report is uploaded as a GitHub Actions artifact named
`coverage-report` and retained for **7 days**. To view it:

1. Open the Actions tab in GitHub
2. Click the relevant workflow run
3. Download the `coverage-report` artifact
4. Open `index.html` in your browser

## Running locally

```bash
pnpm test:coverage
```

## Adding new thresholds

Edit the `thresholds` block in `vitest.config.ts`:

```typescript
thresholds: {
  statements: 95,
  branches: 95,
  functions: 95,
  lines: 95,
},
```

Raise the values or expand the `include` patterns as test coverage improves over
time.