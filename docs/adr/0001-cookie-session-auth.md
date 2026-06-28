# ADR 0001: Use Opaque Cookie-Backed Browser Sessions With Synchronizer CSRF Protection

- Status: Accepted
- Date: 2026-06-28
- Supersedes: None
- Superseded by: None

## Context

CommitLabs browser flows need an authenticated session model after wallet
signature verification. The session model has to work with Next.js route
handlers, protect browser-originated mutations from CSRF, and leave room for
non-browser API clients that use bearer tokens instead of cookies.

The existing implementation described in
[`backend-session-csrf.md`](../backend-session-csrf.md) uses an opaque
`cl_session` cookie for browser sessions. The server maps that session id to
session metadata and a CSRF synchronizer token. State-changing browser requests
send `X-CSRF-Token` and must pass same-origin `Origin` or `Referer` checks when
the session cookie is present. Requests with a non-empty bearer token skip CSRF
because they are not using browser cookies as the trust anchor.

## Decision

Use opaque, cookie-backed browser sessions with synchronizer-token CSRF
protection as the documented browser authentication pattern.

The session cookie is the browser credential. The CSRF token is server-generated
and sent back to the client after session creation or via the CSRF endpoint.
Mutating browser requests include both the session cookie and `X-CSRF-Token`.
API clients that authenticate with `Authorization: Bearer <token>` remain a
separate path and do not rely on browser cookie semantics.

## Consequences

- Browser mutation routes can share one CSRF enforcement model instead of
  reimplementing per-route checks.
- The app avoids storing the primary browser session credential in JavaScript
  readable storage.
- Horizontal scaling still requires replacing the in-memory session store with a
  shared Redis, database, or equivalent store.
- Contributors changing auth, cookies, CSRF, or protected mutation behavior
  should update this ADR or add a superseding ADR if the decision changes.

## Alternatives Considered

### JWT Access Token And Refresh Token

JWT access tokens can work well for APIs and edge verification, but they add
revocation and rotation complexity for the browser session path.

### Stateless Wallet Signatures On Every Mutation

Signing every sensitive request avoids server sessions, but it adds repeated
wallet prompts and more complex nonce handling for normal app usage.

## References

- [`backend-session-csrf.md`](../backend-session-csrf.md)
- [`backend-threat-model.md`](../backend-threat-model.md)
- [`session-implementation.md`](../session-implementation.md)
