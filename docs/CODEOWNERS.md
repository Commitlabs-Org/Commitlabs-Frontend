# Code Ownership & Review Routing

This repository uses a [`.github/CODEOWNERS`](../.github/CODEOWNERS) file so that
review requests are automatically routed to the maintainers responsible for the
area a pull request touches.

## How it works

- When a PR changes files matching a pattern in `CODEOWNERS`, GitHub
  automatically requests a review from the listed owner(s).
- The **last matching pattern wins**. A broad fallback (`*`) is declared first,
  and more specific area patterns are declared below it.

## Ownership map

| Area            | Paths                                        | Owner                            |
| --------------- | -------------------------------------------- | -------------------------------- |
| Fallback        | everything                                   | `@Commitlabs-Org/maintainers`    |
| Frontend        | `src/app/`, `src/components/`, `src/styles/` | `@Commitlabs-Org/frontend`       |
| API / backend   | `src/app/api/`, `src/lib/backend/`           | `@Commitlabs-Org/backend`        |
| Contracts       | `contracts/`                                 | `@Commitlabs-Org/contracts`      |
| Documentation   | `docs/`, `*.md`                              | `@Commitlabs-Org/docs`           |

## Review expectations

- At least one code owner approval is expected before merge for the matched area.
- Docs-only changes route to the docs owners and do not require frontend/backend
  sign-off.
- If a change spans multiple areas, all matching owners are requested.
