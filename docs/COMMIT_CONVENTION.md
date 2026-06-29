# Commit Convention

This repository follows [Conventional Commits](https://www.conventionalcommits.org/)
and enforces it with [commitlint](https://commitlint.js.org/) via a `commit-msg`
git hook ([`.husky/commit-msg`](../.husky/commit-msg)). A consistent history keeps
the log scannable and enables future changelog automation.

## Format

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

- The **header** (`type(scope): subject`) is limited to 100 characters.
- The **scope** is optional (e.g. `feat(marketplace): ...`).
- The **body** may wrap across multiple lines with no length limit.

## Accepted types

| Type       | Use for                                                        |
| ---------- | ------------------------------------------------------------- |
| `feat`     | A new feature                                                 |
| `fix`      | A bug fix                                                     |
| `docs`     | Documentation-only changes                                    |
| `style`    | Formatting/whitespace, no logic change                       |
| `refactor` | Code change that neither fixes a bug nor adds a feature       |
| `perf`     | A performance improvement                                     |
| `test`     | Adding or correcting tests                                    |
| `build`    | Build system or dependency changes                           |
| `ci`       | CI configuration and scripts                                  |
| `chore`    | Routine maintenance that doesn't fit the above               |
| `revert`   | Reverting a previous commit                                   |

## Examples

```
feat(commitments): add early-exit flow to detail page
fix(api): return 429 with Retry-After on rate limit
docs: document commit convention
```

## Notes

- Merge and revert commits are allowed through the linter automatically.
- If a commit is rejected, the error message names the failing rule; fix the
  message and recommit.
- In an emergency you can bypass the hook with `git commit --no-verify`, but CI
  may still validate commit messages.
