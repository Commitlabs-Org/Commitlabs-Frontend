# Backend Threat Model — Authentication, Sessions, Rate Limiting & API Abuse

This document describes **primary assets**, **trust boundaries**, **realistic adversaries**, and **threats/mitigations** for the CommitLabs Next.js backend (`src/app/api/**`, `src/lib/backend/**`). It is meant to complement the operational checklist in [`backend-security-checklist.md`](./backend-security-checklist.md) and the session/CSRF design notes in [`backend-session-csrf.md`](./backend-session-csrf.md).

Implementation reality changes over time; mitigations marked **Future** align with documented TODOs in source.

---

## 1. Scope & assets

| Asset | Why it matters |
|-------|----------------|
| Stellar wallet identity (`G…` address) | Authorizes who is acting; binds signatures and (eventually) sessions to an on-chain identity. |
| Auth nonces | Short-lived secrets proving freshness of wallet login; must not be reusable across sessions or addresses. |
| Session representation | Whatever replaces the current placeholder session token (`createSessionToken` / `verifySessionToken` in `src/lib/backend/auth.ts`) — controls access to authenticated HTTP routes. |
| HTTP APIs (`/api/auth/*`, `/api/commitments/*`, `/api/attestations/*`, `/api/marketplace/*`) | Abuse surface for brute force, scraping, DoS, and confused-deputy patterns if trust boundaries blur. |
| Soroban RPC / Horizon upstream | Availability and integrity of reads and simulations; failures must not corrupt auth or business logic decisions. |

Out of scope here: smart-contract formal verification (see contract-focused docs if added later).

---

## 2. Trust boundaries

1. **Browser / wallet** ↔ **CommitLabs Next.js routes** — User-controlled inputs, headers, and timing; origin may be hostile or compromised extensions.
2. **Next.js server** ↔ **Shared nonce/session store** — Today in-memory (`Map`) for nonces; production needs a shared store for multi-instance correctness.
3. **API route handlers** ↔ **Stellar/Soroban network** — RPC latency, partition, malicious or stale responses; handled via timeouts, retries policy, and safe fallbacks (see §7).

---

## 3. Adversary profiles

| Profile | Capability | Typical goal |
|---------|------------|--------------|
| A — Network attacker | Records/replays HTTP; cannot break Stellar signatures without keys | Replay login or exhaust resources. |
| B — Bot / scraper | High-volume automated requests | Nonce exhaustion, scraping, brute-force signatures. |
| C — Malicious site | Tricks a logged-in user into submitting forged requests | CSRF against cookie-authenticated mutations (when implemented). |
| D — Insider / compromised dependency | Reads logs, env, or misconfigured buckets | Credential leakage, session theft. |

---

## 4. Wallet signature login & nonce handling

**Mechanism (current code):**  
`POST /api/auth/nonce` issues a random nonce and stores it keyed by nonce value with TTL and bound address (`storeNonce`).  
`POST /api/auth/verify` parses the signed challenge `Sign in to CommitLabs: {nonce}`, verifies the Stellar signature, ensures nonce matches stored record and address, then **consumes** the nonce (`consumeNonce`).

| Threat | Description | Mitigation (current / planned) |
|--------|-------------|-------------------------------|
| **Nonce replay** | Re-submitting a captured successful verify payload | Nonce **single-use** after valid signature (`consumeNonce`). Expired nonces rejected (`getNonceRecord`). |
| **Cross-address nonce binding** | Using nonce minted for `GAlice` with `GBob`’s signature | `nonceRecord.address` must equal submitted `address` (`verifySignatureWithNonce`). |
| **Message tampering** | Signing a different message format | Strict message regex and SDK signature verification (`verifyStellarSignature`). |
| **Nonce flooding / storage exhaustion** | Minting unlimited nonces per IP or address | **Partial:** `checkRateLimit` on `api/auth/nonce` and `api/auth/verify` — **production rate limits still TODO** in `rateLimit.ts`. Add per-address throttle when minting nonces (`auth.ts` TODO). |
| **Multi-instance inconsistency** | Nonces only in process memory | **Risk:** nonce valid on instance A but verify hits instance B → flaky auth. **Mitigation:** Redis/DB-backed nonce store with TTL (documented TODO in `auth.ts`). |

**Residual risk:** Until Redis (or equivalent) backs nonces and sessions, horizontal scaling and restart safety remain weak.

---

## 5. Session cookies & CSRF (browser flows)

**Current state:** `createSessionToken` / `verifySessionToken` are placeholders; durable HttpOnly cookies are **not** the active trust anchor yet. Design options live in [`backend-session-csrf.md`](./backend-session-csrf.md).

| Threat | When it applies | Mitigation |
|--------|-----------------|------------|
| **Session fixation / theft** | Predictable or leaked session IDs | Use opaque random IDs; `HttpOnly` + `Secure` + `SameSite` cookies; rotation on privilege change. |
| **CSRF on mutations** | Cookie-auth `POST` from evil.com | Synchronizer token + `Origin`/`Referer` checks (see session doc); prefer `SameSite=Strict` for session cookies where compatible. |
| **XSS stealing session** | If any script injection exists | CSP, sanitize outputs, avoid inline scripts; sessions in `HttpOnly` cookies reduce exfil vs `localStorage`. |

**Residual risk:** Until real session verification is wired into each protected route, relying on API keys in clients or unsigned calls is unsafe — treat as **development-only** posture.

---

## 6. Rate limiting & API abuse

**Mechanism:** `checkRateLimit(ip, routeId)` in `src/lib/backend/rateLimit.ts` is invoked from auth, commitments, attestations, and marketplace routes.

| State | Behaviour |
|-------|-----------|
| `NODE_ENV === 'development'` | Requests always allowed (logged). |
| Non-development | Currently **allows all** with a warning log — production limiter **not implemented** (TODO block in file). |

| Abuse pattern | Impact | Target mitigation |
|---------------|--------|-------------------|
| Credential-stuffing style **signature attempts** | CPU + log noise | Per-IP and per-address limits on `verify`; exponential backoff after failures. |
| **Nonce spam** | Memory growth (mitigated partially by TTL cleanup) | Per-address limits; shared store with hard caps. |
| **Bulk read/scrape** of public listings | Bandwidth & DB cost | Per-route quotas; caching; `429` + `Retry-After`. |
| **Coordinated DoS** | Availability | Edge platform limits, WAF, autoscaling; rate limits as one layer only. |

**Operational guidance:** When enabling production limits, define **per-route budgets** (e.g. auth stricter than idempotent GETs), use a **distributed** counter (Upstash/Vercel KV/custom Redis), and log only aggregated counters — not raw secrets.

---

## 7. Chain / Soroban upstream failures

Configuration uses `NEXT_PUBLIC_SOROBAN_RPC_URL` and passphrase from env (`src/utils/soroban.ts`, `src/lib/backend/config.ts`).

| Failure mode | User/API impact | Safe behaviour |
|--------------|-----------------|----------------|
| RPC timeout / 5xx | Reads or simulations fail | Bounded retries with backoff; surface **generic** errors to clients; never leak RPC URLs or stack traces (`withApiHandler` pattern). |
| Ledger fork / stale responses | Incorrect contract state shown | Prefer strongly consistent reads where required; document staleness tolerance per feature. |
| Wrong network passphrase | Silent wrong-network bugs | Fail fast at startup or first contract call when env mismatches expected network (contract tests / CI). |
| Rate limits from public RPC | Intermittent failures | Retry-after headers from provider; optional dedicated RPC endpoint for production. |

---

## 8. Cross-reference & review cadence

- PR reviewers should use [`backend-security-checklist.md`](./backend-security-checklist.md) for concrete checks.
- When changing **auth**, **cookies**, or **rate limiting**, update **this document** if trust boundaries or residual risks shift.
- Major releases: re-evaluate nonce storage, session implementation, and production rate-limit rollout.

---

## Document history

| Date (UTC) | Change |
|------------|--------|
| 2026-04-23 | Initial threat model covering auth/nonces, sessions/CSRF, rate limits, upstream chain behaviour, and residual risks aligned with current `src/lib/backend` code. |
