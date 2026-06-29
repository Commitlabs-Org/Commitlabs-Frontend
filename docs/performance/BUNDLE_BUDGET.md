# Bundle Size Budget (size-limit)

Bundle growth was previously only observable via the optional analyzer. This adds
an enforced per-entry **bundle-size budget** with
[size-limit](https://github.com/ai/size-limit) so heavy dependencies
(`framer-motion`, `recharts`, `@stellar/stellar-sdk`) cannot silently inflate the
client bundle.

> Complements the runtime [performance budget](../PERFORMANCE_BUDGET.md) (Core
> Web Vitals) and the lab [Lighthouse](LIGHTHOUSE.md) checks. This file is about
> **shipped bytes**.

## Running it

```bash
npm run build     # size-limit measures the production build output
npm run size      # check .next chunks against .size-limit.json (gzip)
npm run analyze   # run build with @next/bundle-analyzer to inspect bundle composition
```

## Budgets

Configured in [`.size-limit.json`](../../.size-limit.json) (sizes are **gzipped**):

| Entry | Glob | Budget |
| ----- | ---- | ------ |
| All client JS chunks | `.next/static/chunks/**/*.js` | 1500 kB |
| Framework + main + webpack runtime | `framework-*`, `main-*`, `webpack-*` | 120 kB |
| Heavy shared vendor | numbered shared chunks | 600 kB |

> **These are initial ceilings, not measured baselines.** They must be
> **calibrated** against the first successful production build (set each limit a
> little above the real number so genuine regressions trip it). See
> [Calibrating](#calibrating-the-budgets).

## CI

[`size-limit.yml`](../../.github/workflows/size-limit.yml) builds the app and runs
`npm run size` on PRs/pushes, failing when a budget is exceeded. For a per-PR
size **delta** comment, the [`andresz1/size-limit-action`](https://github.com/andresz1/size-limit-action)
can be added later; this PR keeps the dependency surface minimal with a plain
build + check.

> **Prerequisite — a green build.** size-limit measures build output, so this job
> needs `next build` to succeed. At the time of writing the production build is
> **broken** by pre-existing parse/export errors (e.g.
> `src/app/commitments/overview/page.tsx`, `src/lib/backend/validation.ts`,
> `src/components/MarketplaceHeader/MarketplaceHeader.tsx`) — note that
> `next.config.js` `ignoreBuildErrors` suppresses *type* errors but **not** these
> syntax/parse errors. The budget gate becomes effective once the build is fixed;
> the budgets should be calibrated at that point.

## Calibrating the budgets

1. Once `npm run build` succeeds, run `npm run size` and note the actual gzipped
   sizes per entry.
2. Set each `limit` in `.size-limit.json` slightly above its current size (e.g.
   +5–10%) so normal noise passes but real growth fails.
3. Commit the calibrated `.size-limit.json`.

## Investigating a regression

1. `npm run size` shows which entry exceeded its budget and by how much.
2. Identify the culprit import — heavy libs (`recharts`, `framer-motion`,
   `@stellar/stellar-sdk`) are the usual cause.
3. Prefer **dynamic `import()`** / `next/dynamic` for components that use them so
   they land in a route-level chunk instead of the shared bundle. See
   [GRID_RENDER.md](GRID_RENDER.md) and [LAZY_HEALTH_CHARTS.md](LAZY_HEALTH_CHARTS.md).
4. Re-run `npm run size` to confirm you're back under budget.

## Top Offenders & Split Candidates

The following heavy dependencies are currently impacting the bundle and are prime candidates for dynamic imports (`next/dynamic`) or code splitting in follow-up PRs:
- `recharts` (Charts and graphs)
- `framer-motion` (Animations)
- `@stellar/stellar-sdk` (Heavy cryptography/blockchain utilities)
- `lucide-react` (Icons)
- `react-icons` (Icons)
