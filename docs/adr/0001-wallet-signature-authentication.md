# ADR-0001: Wallet-signature authentication with cookie-backed sessions

- **Status:** Accepted
- **Date:** 2026-06-28
- **Deciders:** CommitLabs frontend maintainers
- **Related:** [`docs/WALLET_AUTH.md`](../WALLET_AUTH.md),
  [`docs/ROUTE_AUTH_GUARD.md`](../ROUTE_AUTH_GUARD.md),
  [`docs/FRONTEND_ARCHITECTURE.md`](../FRONTEND_ARCHITECTURE.md),
  `src/hooks/useWallet.ts`

## Context

CommitLabs is a Stellar/Soroban dApp: a user's identity *is* their Stellar
account, and every state-changing action ultimately maps to an on-chain
transaction signed by that account. The product therefore has no separate
username/password concept and no first-party credential store to protect.

We still need a server-side notion of "who is calling" so that backend route
handlers can authorize requests, and we need that identity to be:

- proven by control of the Stellar secret key, not merely asserted;
- resistant to replay across sessions and across domains; and
- safe to persist in the browser without ever exposing key material.

The wallet (Freighter) holds the secret key and never reveals it; it will only
return a *signature* over a message. Any auth design has to be built on that
primitive.

## Decision

We will authenticate users with a **nonce-based wallet-signature handshake** and
persist the resulting session in a **cookie**, implemented in
`src/hooks/useWallet.ts`:

1. **Nonce** — the client sends the public address to `POST /api/auth/nonce`.
   The server returns a single-use, time-boxed challenge string built from the
   `[CommitLabs Auth V2]` template, which embeds the domain, nonce, issued-at,
   and expiry.
2. **Sign** — the client asks Freighter to `signMessage(message, { address })`.
   The user reviews the domain and nonce in the extension and approves.
3. **Verify** — the client posts `{ address, signature, message }` to
   `POST /api/auth/verify`. The server validates the template and domain, checks
   expiry, verifies the Ed25519 signature against the address, consumes the nonce
   (delete-on-use), and returns a `sessionToken`.

The `sessionToken` is then written to a `session` cookie
(`path=/; SameSite=Lax; Secure`) so backend route handlers can enforce
cookie-based session verification on subsequent requests. Route-level access
control is layered on top of this on the client by `RequireWallet`
(see [`ROUTE_AUTH_GUARD.md`](../ROUTE_AUTH_GUARD.md)), which gates `/create`,
`/settings`, and `/commitments` while leaving public routes open.

Two invariants are part of this decision:

- **No key material at rest.** Raw signatures and nonces are kept in memory only
  and are never written to storage or logs.
- **Address binding.** The authenticated address is recorded
  (`commitlabs.authAddress`); if Freighter switches accounts or disconnects, the
  session token, storage keys, and cookie are cleared immediately so a stale
  session cannot authorize actions for a different account.

## Alternatives considered

- **Email/password or OAuth.** Rejected: it introduces a credential store and an
  identity that is divorced from the on-chain account that actually authorizes
  transactions, adding attack surface for no product benefit.
- **Pure client-side "is a wallet connected?" check, no server session.**
  Rejected: connection state is trivially spoofable and gives the backend no
  verifiable caller identity, so it cannot protect server route handlers. We keep
  a client guard (`RequireWallet`) for UX, but it is explicitly *not* the
  security boundary.
- **Signature without a server nonce** (e.g. signing a static or client-chosen
  message). Rejected: a server-issued, single-use, expiring nonce is what makes
  the handshake replay-resistant and domain-bound.
- **Store the session token only in `localStorage`.** Rejected as the sole
  mechanism: backend route handlers read a cookie, so a `Secure`, `SameSite=Lax`
  cookie is required. (Tokens are additionally mirrored to `localStorage`/
  `sessionStorage` for backward compatibility with older page exports.)

## Consequences

- **Positive:** identity is cryptographically proven by the same key that signs
  transactions; there is no first-party password to leak; sessions are
  replay-resistant (single-use, expiring, domain-bound nonce) and
  account-switch-safe.
- **Negative / trade-offs:** authentication depends on the Freighter extension
  being installed and available, and on `@stellar/freighter-api`; the session
  token now lives in several places (cookie, `localStorage`, `sessionStorage`),
  so any change to the session model must update all of them and the
  account-switch teardown path. `SameSite=Lax` is a deliberate balance between
  CSRF resistance and normal navigation, not the strictest possible setting.
- **Neutral:** the auth message template is explicitly versioned
  (`[CommitLabs Auth V2]`), so a future format change is expected to bump the
  version rather than mutate the existing template.
