# Release Process

This document describes how frontend releases are prepared, versioned, and
recorded. It complements the top-level [`CHANGELOG.md`](../CHANGELOG.md) and
the backend API breaking-change log in
[`backend-changelog.md`](./backend-changelog.md).

## Versioning

Use Semantic Versioning for public frontend releases:

- `MAJOR` for incompatible app behavior, deployment, or API-consumption changes.
- `MINOR` for backward-compatible features and user-visible improvements.
- `PATCH` for backward-compatible fixes, documentation, and maintenance work.

The package version in [`package.json`](../package.json) should match the
release tag when a versioned frontend release is cut.

## Changelog Entries

Every user-facing, operator-facing, or contributor-facing change should update
the `Unreleased` section of [`CHANGELOG.md`](../CHANGELOG.md) in the same PR.

Use these categories:

- `Added` for new features, docs, or workflows.
- `Changed` for behavior or process changes.
- `Deprecated` for supported but discouraged functionality.
- `Removed` for deleted functionality.
- `Fixed` for bug fixes.
- `Security` for vulnerability fixes or hardening work.

Keep entries concise, written for users and contributors, and link issues or
PRs when the rationale is not obvious from the entry.

## Backend API Coordination

If a release depends on a backend API breaking change, add or update an entry in
[`backend-changelog.md`](./backend-changelog.md). The frontend changelog should
summarize the user-visible impact, while the backend changelog should capture
the contract change, rollout status, and required migration steps.

## Cutting A Release

1. Confirm the default branch has the intended changes and no release-blocking
   PRs.
2. Move completed `Unreleased` entries in `CHANGELOG.md` under the new
   version heading, for example `## [0.2.0] - YYYY-MM-DD`.
3. Update `package.json` if the release changes the public frontend version.
4. Add or update compare links at the bottom of `CHANGELOG.md` when release
   tags exist.
5. Run the available validation commands and record any known baseline failures
   in the release PR.
6. Open a release PR titled `chore: release vX.Y.Z`.
7. After merge, create a `vX.Y.Z` tag from the merge commit and publish GitHub
   release notes using the changelog section as the starting point.

## Pull Request Checklist

- [ ] `CHANGELOG.md` has an `Unreleased` entry or the PR explains why no entry
      is needed.
- [ ] Backend API contract changes are reflected in
      `docs/backend-changelog.md`.
- [ ] The release type is clear: major, minor, patch, or no release impact.
- [ ] Validation output is included in the PR description.
