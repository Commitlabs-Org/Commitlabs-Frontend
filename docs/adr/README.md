# Architecture Decision Records (ADRs)

This directory captures **Architecture Decision Records** — short documents that
record significant, cross-cutting technical decisions and, most importantly, the
context and reasoning behind them.

The rest of `docs/` explains *how* a given feature works today. ADRs explain
*why* the project arrived at a particular approach, what alternatives were
weighed, and what trade-offs were accepted. That history is easy to lose once
the original contributors move on, which is exactly what ADRs are meant to
prevent.

## What belongs in an ADR

Write an ADR when a decision:

- affects more than one feature or module (auth, caching, rate limiting, state
  management, the wallet/contract boundary, build/deploy tooling);
- is expensive or disruptive to reverse later;
- a future contributor would reasonably ask "why was it done this way?" about; or
- was contested, i.e. there were credible alternatives.

You do **not** need an ADR for routine, localized changes (a new component, a
copy tweak, a bug fix). Those are adequately covered by the code and the
feature docs.

## Index

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-wallet-signature-authentication.md) | Wallet-signature authentication with cookie-backed sessions | Accepted |

## Statuses

An ADR moves through a small lifecycle. Set the status in the front of each
record:

- **Proposed** — under discussion, not yet agreed.
- **Accepted** — agreed and in effect.
- **Deprecated** — no longer recommended, but still present in parts of the code.
- **Superseded by [ADR-XXXX](xxxx-title.md)** — replaced by a later decision.

Records are immutable once **Accepted**: rather than rewriting history, add a new
ADR that supersedes the old one and update the old record's status to point at
it.

## How to add a new ADR

1. Copy [`template.md`](template.md) to `NNNN-short-title.md`, where `NNNN` is the
   next free zero-padded number (the next one is `0002`).
2. Use a short, lower-case, hyphenated title that matches the filename.
3. Fill in **Context**, **Decision**, and **Consequences**. Keep it concise —
   one page is usually enough. Link to relevant feature docs in `docs/` and to
   the code paths the decision governs.
4. Add a row to the [Index](#index) above.
5. Open a pull request. Treat the ADR as part of the change it describes, or as a
   standalone PR when documenting an existing decision retroactively.

## Further reading

ADRs here follow the lightweight format popularized by Michael Nygard in
["Documenting Architecture Decisions"](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).
