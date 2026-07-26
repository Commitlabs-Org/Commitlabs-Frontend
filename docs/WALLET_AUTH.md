# Wallet Signature Authentication Handshake

This document describes the cryptographic authentication flow implemented in `src/hooks/useWallet.ts` using the Freighter browser extension to establish a secure session.

## Handshake Flow

The signature-based authentication protocol uses a three-step cryptographic handshake:

```mermaid
sequenceDiagram
    participant User
    participant Frontend (useWallet)
    participant Backend (Auth API)
    participant Freighter Wallet

    User->>Frontend (useWallet): Clicks Connect & Sign In
    Frontend (useWallet)->>Freighter Wallet: Request public address
    Freighter Wallet-->>Frontend (useWallet): Return G...address
    Frontend (useWallet)->>Backend (Auth API): POST /api/auth/nonce { address }
    Backend (Auth API)-->>Frontend (useWallet): Return { nonce, message, expiresAt }
    Frontend (useWallet)->>Freighter Wallet: signMessage(message, { address })
    Freighter Wallet->>User: Prompts user to sign message
    User->>Freighter Wallet: Approves signature
    Freighter Wallet-->>Frontend (useWallet): Return signature
    Frontend (useWallet)->>Backend (Auth API): POST /api/auth/verify { address, signature, message }
    Backend (Auth API)-->>Frontend (useWallet): Set-Cookie: cl_auth_session (HttpOnly); body { verified: true, address }
    Frontend (useWallet)->>Frontend (useWallet): Mark authenticated (no token held client-side)
```

### 1. Request Nonce
The frontend makes a POST request to `/api/auth/nonce` with the user's public address:
```json
POST /api/auth/nonce
{
  "address": "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDE"
}
```
The server generates a secure cryptographically random nonce, registers it in the temporary key-value store, and returns a formatted challenge message:
```json
{
  "success": true,
  "data": {
    "nonce": "c6204c3e800b4624",
    "message": "[CommitLabs Auth V2]\nDomain: commitlabs.org\nNonce: c6204c3e800b4624\nIssuedAt: 2026-06-26T20:00:00.000Z\nExpiresAt: 2026-06-26T20:05:00.000Z",
    "expiresAt": "2026-06-26T20:05:00.000Z"
  }
}
```

### 2. Sign Message
The frontend requests the user to sign the returned challenge message using Freighter:
```typescript
import { signMessage } from "@stellar/freighter-api";

const { signedMessage, error } = await signMessage(message, { address });
```
This opens the Freighter extension prompt. The user reviews the domain name and nonce, then signs the data.

### 3. Verify Signature
The frontend submits the signature back to the server:
```json
POST /api/auth/verify
{
  "address": "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDE",
  "signature": "a5e8f4...",
  "message": "[CommitLabs Auth V2]\nDomain: commitlabs.org\nNonce: c6204c3e800b4624\nIssuedAt: 2026-06-26T20:00:00.000Z\nExpiresAt: 2026-06-26T20:05:00.000Z"
}
```
The backend:
- Validates that the message adheres to the `[CommitLabs Auth V2]` template and matches the server-configured domain.
- Validates that the challenge has not expired.
- Verifies the signature against the public key (`address`) using Ed25519 verification.
- Checks that the nonce matches the registered session challenge for the specified address, then deletes (consumes) the nonce.
- Creates a session token and sets it as an HttpOnly cookie (`cl_auth_session`) on the response. The token is never included in the JSON body.

### 4. Check Session
To learn whether an existing HttpOnly cookie is still valid (e.g. on page load), the frontend calls:
```
GET /api/auth/session
```
which returns `{ authenticated: boolean, address?: string }`, derived entirely server-side from the cookie. This is the only way the client can observe authentication state, since it cannot read the cookie's value directly.

---

## Security Considerations

### 1. Account-Switching Protection
If a user switches accounts within Freighter, or disconnects their wallet:
- The hook re-checks `/api/auth/session` and compares the server-reported authenticated address against the current connected wallet address.
- Upon mismatch or disconnection, the hook calls `/api/auth/logout`, which revokes the session and clears the cookie server-side.

### 2. Plaintext Secrets Handling
To prevent leaks:
- The raw signature and nonces are handled in-memory and are never written to `localStorage`, `sessionStorage`, or logs.
- Disconnected wallets clean up all references.

### 3. Session Token Storage
The session token exists **only** as an HttpOnly cookie (`cl_auth_session`), set directly by `/api/auth/verify` via `response.cookies.set(...)` with `httpOnly: true`. It is:
- Never included in any JSON response body.
- Never written to `localStorage`, `sessionStorage`, or a JS-readable cookie.
- Sent automatically by the browser on same-origin requests; the frontend does not need to (and cannot) read or attach it manually.

This closes the XSS-to-token-theft vector that existed when the token was readable from client-side JavaScript.

### 4. Idempotency & Race Conditions
- Multiple simultaneous calls to `signIn()` are ignored if a sign-in process is already in progress (`authenticating === true`).
- In-flight fetch and signing errors are safely caught, clearing any partial credentials and populating `authError`.
