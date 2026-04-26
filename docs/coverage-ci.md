# Coverage CI Workflow

## Overview

The `coverage.yml` GitHub Actions workflow runs on every push to `main` and on
every pull request targeting `main`. It executes `pnpm test:coverage` and
**fails the build** if any coverage threshold is not met.

## Thresholds

Configured in `vitest.config.ts`:

| Metric     | Threshold | Notes                              |
|------------|-----------|------------------------------------|
| Lines      | 19%       | Baseline — raise as coverage grows |
| Functions  | 14%       | Baseline — raise as coverage grows |
| Branches   | 14%       | Baseline — raise as coverage grows |
| Statements | 19%       | Baseline — raise as coverage grows |

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
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80,
},
```

Raise the values as test coverage improves over time.