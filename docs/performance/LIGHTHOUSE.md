# Lighthouse CI – Performance, Accessibility & SEO Budgets

Lighthouse CI audits three key routes on every PR to catch regressions in
performance, accessibility, best-practices, and SEO before they reach `main`.

## Audited Routes

| Route | Purpose |
|---|---|
| `/` | Landing page (heavy animations, hero assets) |
| `/marketplace` | Commitment listing (recharts, data tables) |
| `/commitments` | Dashboard (live SSE stream, health charts) |

## Score Budgets

| Category | Threshold | Failure Mode |
|---|---|---|
| Performance | ≥ 70 | warn |
| Accessibility | ≥ 90 | error (blocks merge) |
| Best Practices | ≥ 90 | error (blocks merge) |
| SEO | ≥ 90 | error (blocks merge) |

### Core Web Vitals Budgets

| Metric | Budget | Failure Mode |
|---|---|---|
| First Contentful Paint (FCP) | ≤ 3 000 ms | warn |
| Largest Contentful Paint (LCP) | ≤ 4 000 ms | warn |
| Total Blocking Time (TBT) | ≤ 500 ms | warn |
| Cumulative Layout Shift (CLS) | ≤ 0.15 | warn |
| Time to Interactive (TTI) | ≤ 5 000 ms | warn |

`error` thresholds block the PR. `warn` thresholds surface in the CI report
but do not block merge, allowing iterative improvement.

## Running Locally

### Prerequisites

```bash
npm install -g @lhci/cli
```

### Build then audit

```bash
# 1. Build the production app
npm run build

# 2. Start the production server in one terminal
npm start

# 3. In a second terminal, run the audit
lhci autorun
```

Reports are written to `.lighthouseci/`. Open any `.html` file in a browser
for a full visual report.

### One-liner (CI-style)

```bash
npm run build && lhci autorun
```

### Auditing a single URL

```bash
lhci collect --url=http://localhost:3000/ --numberOfRuns=1
lhci assert
```

## Adjusting Budgets

Edit `lighthouserc.json` at the repo root. The `assert.assertions` block maps
Lighthouse audit keys to `[severity, { threshold }]` pairs.

```json
"categories:performance": ["warn", { "minScore": 0.7 }]
```

Raise the threshold to tighten the budget; switch `"warn"` to `"error"` to
make it a blocking failure.

## GitHub App Token (optional)

Setting the `LHCI_GITHUB_APP_TOKEN` repository secret enables inline PR
comments with score deltas. Without it, results are uploaded to Lighthouse
CI's temporary public storage and linked from the workflow summary.

See the [Lighthouse CI docs](https://github.com/GoogleChrome/lighthouse-ci)
for instructions on installing the GitHub App.
