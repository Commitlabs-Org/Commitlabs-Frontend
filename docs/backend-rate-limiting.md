# Backend Rate Limiting

Commitlabs uses a **fixed-window** rate limiter backed by KV (Redis / Upstash).
Because the API runs as serverless functions, the counter lives in KV rather
than in-process, so limits are enforced consistently across all instances.

The implementation lives in [`src/lib/backend/rateLimit.ts`](../src/lib/backend/rateLimit.ts).

---

## How it works

1. Every inbound request is keyed on `ratelimit:<routeId>:<clientKey>` in KV.
2. An `INCR` increments the counter; the first increment also sets the key's TTL
   to the configured window.
3. If `count > maxRequests` the route handler returns **HTTP 429** with a
   `Retry-After` header whose value comes from `getRateLimitWindowSeconds()`.
4. On KV errors the limiter **fails open** — it returns `true` (allowed) and
   logs the error, so a Redis outage does not block legitimate traffic.

---

## Route buckets

Each named bucket below maps to one or more API routes.  Every bucket has its
own env var pair so operators can tune each one independently.

### Auth routes

These carry the tightest defaults because they guard the wallet-signature
authentication flow.  Loosening them reduces friction for load tests but
increases exposure to credential-farming and brute-force attacks; restore
production values before disabling the override.

| Route | Default limit | Env vars |
|---|---|---|
| `api/auth/nonce` | 5 req / 60 s | `RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS` / `RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS` |
| `api/auth/verify` | 5 req / 60 s | `RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS` / `RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS` |

**Why tight?**  Nonce generation is the prerequisite step for wallet-signature
auth.  An attacker who can farm nonces at will can probe signing behaviour or
attempt replay attacks.  `api/auth/verify` is the credential-check endpoint;
limiting it slows down automated signature-guessing.

### Per-address nonce bucket

| Route / key | Default limit | Env vars |
|---|---|---|
| `auth:nonce:address` | 3 req / 300 s | `RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS` / `RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS` |

This is a **secondary bucket** applied per wallet address on top of the
per-IP bucket for `api/auth/nonce`.  It prevents a single wallet address from
farming nonces even when multiple requests come from the same shared IP (e.g.
a corporate NAT or a proxy farm).

### Write-heavy commitment routes

| Route | Default limit | Env vars |
|---|---|---|
| `api/commitments/create` | 10 req / 60 s | `RATE_LIMIT_WRITE_MAX_REQUESTS` / `RATE_LIMIT_WRITE_WINDOW_SECONDS` |
| `api/commitments/settle` | 10 req / 60 s | (same pair) |
| `api/commitments/early-exit` | 10 req / 60 s | (same pair) |

On-chain write operations are irreversible and gas-intensive.  The shared write
bucket protects both the Soroban network and the operator's signing budget.

### Default bucket (all other routes)

| Route | Default limit | Env vars |
|---|---|---|
| everything else | 20 req / 60 s | `RATE_LIMIT_DEFAULT_MAX_REQUESTS` / `RATE_LIMIT_DEFAULT_WINDOW_SECONDS` |

General read/query routes are cheaper to serve, so the ceiling is higher, but
still bounded to deter scraping and denial-of-service.

---

## Environment variable reference

All variables are optional.  When absent or set to an invalid value
(non-numeric, zero, or negative) the default shown below is used silently,
ensuring rate limiting is never accidentally disabled by a misconfiguration.

| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS` | `5` | |
| `RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS` | `60` | |
| `RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS` | `5` | |
| `RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS` | `60` | |
| `RATE_LIMIT_NONCE_ADDRESS_MAX_REQUESTS` | `3` | |
| `RATE_LIMIT_NONCE_ADDRESS_WINDOW_SECONDS` | `300` | 5-minute window |
| `RATE_LIMIT_WRITE_MAX_REQUESTS` | `10` | Shared by all three write routes |
| `RATE_LIMIT_WRITE_WINDOW_SECONDS` | `60` | |
| `RATE_LIMIT_DEFAULT_MAX_REQUESTS` | `20` | |
| `RATE_LIMIT_DEFAULT_WINDOW_SECONDS` | `60` | |

See [`.env.example`](../.env.example) for commented-out examples of all ten
variables.

---

## Operator runbook

### Temporarily raising limits for a load test

```bash
# In .env.local (or your deployment's secret store):
RATE_LIMIT_AUTH_NONCE_MAX_REQUESTS=50
RATE_LIMIT_AUTH_NONCE_WINDOW_SECONDS=60
RATE_LIMIT_AUTH_VERIFY_MAX_REQUESTS=50
RATE_LIMIT_AUTH_VERIFY_WINDOW_SECONDS=60
```

Restart the server for the change to take effect.  **Remove or revert** these
overrides before the deployment goes back to handling real user traffic.

### Confirming active limits at runtime

`buildLimits()` is called on every request — there is no cached copy.  The
currently effective limits can be observed by adding a temporary `console.log`
inside `buildLimits()` in a development environment, or by instrumenting the
KV calls in staging.

### KV outage behaviour

The limiter calls `kv.incr()` and `kv.expire()`.  If either throws, the catch
block in `checkRateLimit` logs the error and returns `true` (allow), so users
are never blocked because Redis is down.  Monitor KV errors via the application
logs or your observability stack.

---

## Related documents

- [Backend Security Checklist](./backend-security-checklist.md) — section 12 covers the rate-limiting PR review items.
- [Backend API Reference](./backend-api-reference.md) — 429 response format and `Retry-After` semantics.
- [Backend Storage](./backend-storage.md) — KV adapter configuration (Redis / Upstash / in-memory).
