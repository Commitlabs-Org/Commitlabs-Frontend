# Dependency Updates

Dependency updates are automated with [Dependabot](../.github/dependabot.yml).

## What is covered

| Ecosystem        | Directory | Schedule        |
| ---------------- | --------- | --------------- |
| `npm`            | `/`       | Weekly (Monday) |
| `github-actions` | `/`       | Weekly (Monday) |

## Cadence and grouping

- Dependabot runs **weekly** on Monday morning.
- **Minor and patch** updates are **grouped** into a single PR per ecosystem to
  reduce review noise.
- **Major** version bumps for npm are **ignored** by automation and must be
  performed deliberately, since they may include breaking changes.
- Pinned GitHub Actions are still updated (Dependabot rewrites the pinned ref).

## Triage policy

1. **Grouped minor/patch PRs**: review the changelog summary, confirm CI is
   green (lint, tests, audit), then merge.
2. **Security updates**: prioritize over routine updates; merge as soon as CI
   passes.
3. **Major updates**: open a tracking issue, read the upgrade/migration guide,
   and schedule the work separately from routine maintenance.
4. If a PR breaks CI, comment `@dependabot rebase` after a fix lands, or close it
   with a note if the bump is intentionally deferred.
