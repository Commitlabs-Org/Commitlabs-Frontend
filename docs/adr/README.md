# Architecture Decision Records

This directory captures cross-cutting architecture decisions that affect more
than one feature, route, or contributor workflow. ADRs explain why a decision
was made, what tradeoffs were accepted, and what future changes should revisit.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](./0001-cookie-session-auth.md) | Use opaque cookie-backed browser sessions with synchronizer CSRF protection | Accepted |

## When To Add An ADR

Add or update an ADR when a change introduces or revises a project-level
decision, including:

- authentication, authorization, or session models;
- persistent storage, cache, or queue choices;
- rate limiting, API compatibility, observability, or security boundaries;
- contributor workflows that affect releases, testing, or deployment.

Small component-level implementation details usually do not need an ADR unless
they create a reusable pattern or constraint for future work.

## Process

1. Copy [template.md](./template.md) to the next numeric filename, for example
   `0002-short-title.md`.
2. Start with `Status: Proposed` while the decision is under discussion.
3. Change the status to `Accepted` when the decision is merged and expected to
   guide future work.
4. If a later ADR replaces it, keep the old file and mark it `Superseded`,
   linking both records in their `Supersedes` or `Superseded by` fields.
5. Link the ADR from related docs, PRs, or issues so contributors can find the
   rationale near the implementation details.

## Status Values

- `Proposed` - under discussion or included in an unmerged PR.
- `Accepted` - current guidance for the codebase.
- `Deprecated` - still historically useful, but no longer recommended.
- `Superseded` - replaced by a newer ADR.
