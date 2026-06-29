# Release & Versioning Process

This document describes how the CommitLabs frontend is versioned, how changelog
entries are recorded, and how a release is cut. It is intentionally lightweight
and meant to grow with the project.

## Versioning

The frontend follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html),
`MAJOR.MINOR.PATCH`, tracked in the `version` field of [`package.json`](../package.json):

- **MAJOR** — incompatible, user-visible changes (e.g. a removed route, a
  breaking change to a persisted local format, or a required wallet/API change
  that invalidates existing sessions).
- **MINOR** — new functionality added in a backward-compatible way.
- **PATCH** — backward-compatible bug fixes and internal changes.

The project is currently pre-1.0 (`0.x`). While in `0.x`, the public surface is
still stabilizing: minor bumps may include breaking changes, and patch bumps are
used for fixes. The first stable line is `1.0.0`.

## The changelog

All notable changes are recorded in the root [`CHANGELOG.md`](../CHANGELOG.md),
using the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

### Adding an entry

- Add a bullet to the **`[Unreleased]`** section **in the same PR** as the change.
- Put it under the right group: `Added`, `Changed`, `Deprecated`, `Removed`,
  `Fixed`, or `Security`.
- Write for a reader of the app, not the diff: describe the user-facing or
  contributor-facing effect, and link the PR or issue where useful.
- Skip purely internal noise (formatting, comment-only changes) unless it affects
  contributors.

A breaking change to a **backend** API that this frontend depends on is tracked
separately in [`docs/backend-changelog.md`](backend-changelog.md); link to that
entry from the `CHANGELOG.md` line when the two are related.

## Cutting a release

1. Decide the next version from the nature of the `[Unreleased]` entries (see
   [Versioning](#versioning)).
2. In `CHANGELOG.md`, rename `[Unreleased]` to the new version with today's date,
   e.g. `## [0.2.0] - 2026-07-01`, and add a fresh empty `[Unreleased]` section
   above it.
3. Update the comparison links at the bottom of `CHANGELOG.md` so `[Unreleased]`
   compares the new tag to `HEAD` and the new version compares to the previous tag.
4. Bump `version` in `package.json` to match.
5. Merge the release PR, then tag the merge commit:
   ```bash
   git tag -a v0.2.0 -m "v0.2.0"
   git push origin v0.2.0
   ```
6. Create a GitHub Release from the tag, pasting that version's changelog section
   as the release notes.

## Checklist

- [ ] `[Unreleased]` entry added in the same PR as the change.
- [ ] Entry filed under the correct Keep-a-Changelog group.
- [ ] Related backend breaking change linked to `docs/backend-changelog.md` if any.
- [ ] On release: version moved out of `[Unreleased]`, `package.json` bumped, tag
      pushed, GitHub Release created.
