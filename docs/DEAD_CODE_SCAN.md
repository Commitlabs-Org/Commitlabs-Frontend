# Dead Code Scan (knip)

The project uses [knip](https://knip.dev) to find **unused files, exports, and
dependencies**. The tree has accumulated orphaned and duplicated modules (e.g. a
stray `src/components/MarketplaceHeader.tsx` alongside the used
`src/components/MarketplaceHeader/MarketplaceHeader.tsx`, and a duplicate
`MyCommitments` variant); this scan makes that visible so it can be removed
deliberately.

## Running it

```bash
npm run deadcode        # knip, using knip.json
npx knip --reporter json   # machine-readable output
```

## Configuration

[`knip.json`](../knip.json) is tuned for this Next.js App Router + Vitest layout:

- **`entry`** — App Router special files (`page`/`layout`/`route`/`sitemap`/
  `manifest`/… ) plus `next.config.js`, `vitest.config.ts`,
  `playwright.config.ts`. These are framework entry points and must not be
  reported as unused.
- **`project`** — `src/**` and `scripts/**` are the files considered for usage.
- **`vitest.entry`** — test files under `tests/**` and colocated `src/**` tests
  are treated as entry points so test-only helpers aren't flagged.
- **`ignore` / `ignoreDependencies`** — `contracts/**`, `e2e/**`, and
  config-driven deps (`tailwindcss` via PostCSS, `@vitejs/plugin-react` via
  Vitest) that knip cannot statically see.

## Report-only for now

The CI job [`deadcode.yml`](../../.github/workflows/deadcode.yml) runs
`npm run deadcode` with `continue-on-error: true`. It **reports** on every PR/push
but does not block merges, because there is an existing backlog (≈14 unused
files and ≈100 unused exports at introduction).

## How to read and act on the report

knip groups findings; triage each group differently:

- **Unused files** — usually safe to delete, but first confirm the file is not a
  dynamic import, a documented example, or a not-yet-wired feature. The known
  duplicates (`MarketplaceHeader.tsx`, `MyCommitmentsOverview`) are good first
  removals.
- **Unused exports** — either delete the export, or stop exporting it (make it
  module-private) if it's only used internally. Watch for exports kept
  intentionally as a public API surface.
- **Unused dependencies / devDependencies** — remove from `package.json` after
  confirming they aren't used by config/tooling that knip can't see (if they
  are, add them to `ignoreDependencies` instead).
- **Unlisted / unresolved imports** — a real bug or a stale path (e.g. tests
  importing `@/src/lib/...` which doesn't resolve). Fix the import or add the
  dependency.

### False positives

Config-driven usage (PostCSS plugins, Vitest plugins, CLI-only binaries) is
invisible to static analysis. Prefer narrowing via `knip.json`
(`ignoreDependencies`, `ignoreBinaries`, `entry`) over deleting something that is
actually used.

## Making it a gate

1. Triage the backlog to zero (delete dead code; refine `knip.json` for genuine
   false positives).
2. Remove `continue-on-error: true` from `deadcode.yml` so new dead code fails CI.
