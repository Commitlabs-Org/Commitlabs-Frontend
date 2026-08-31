# Notification API & Preference Consistency: Bounded Performance & Operational Visibility

## Overview

This implementation improves the notification API and preference consistency with:

1. **Explicit performance bounds** - Pagination, polling, mutations, and memory limits
2. **Operational visibility** - Structured diagnostics and observable degradation signals
3. **Consistency guarantees** - Multi-tab/session coordination with ETag and idempotency
4. **Failure resilience** - Circuit breakers, rate limiting, and timeout enforcement

## Key Improvements

### 1. Performance Bounds

All limits are explicitly defined in [src/lib/backend/notificationBounds.ts](src/lib/backend/notificationBounds.ts):

#### Notification Bounds

| Bound | Value | Purpose |
|-------|-------|---------|
| `MAX_PAGE_SIZE` | 100 | Prevent large response payloads |
| `MAX_PAGE_NUMBER` | 1000 | Prevent offset-based DoS |
| `MAX_GET_RPS` | 2 req/s | Per-wallet rate limit on polling |
| `MAX_CONCURRENT_MUTATIONS` | 5 | Per-wallet mutation queue depth |
| `MUTATION_TIMEOUT_MS` | 5000 ms | Prevent hanging mutations |
| `MAX_IDEMPOTENCY_KEY_LENGTH` | 512 chars | DoS mitigation |
| `MAX_NOTIFICATIONS_PER_WALLET` | 10,000 | Store capacity |
| `ERROR_RATE_THRESHOLD` | 10% | Circuit breaker threshold |
| `CIRCUIT_BREAK_DURATION_MS` | 30,000 ms | Circuit recovery time |

#### Preference Bounds

| Bound | Value | Purpose |
|-------|-------|---------|
| `MAX_GET_RPS` | 2 req/s | Per-wallet rate limit |
| `MAX_CONCURRENT_MUTATIONS` | 3 | Per-wallet mutation queue |
| `MAX_BODY_SIZE_BYTES` | 64 KiB | Request payload limit |
| `MUTATION_TIMEOUT_MS` | 5000 ms | Timeout enforcement |
| `MAX_IDEMPOTENCY_KEY_LENGTH` | 512 chars | Header validation |
| `ERROR_RATE_THRESHOLD` | 10% | Circuit breaker trigger |

### 2. Rate Limiting & Queuing

**Per-wallet rate limiting:**
- GET requests: max 2/s using sliding-window rate limiter
- PATCH/PUT requests: max 5/3 concurrent, others queued
- Requests return `429 Too Many Requests` when limits exceeded

**Idempotency:** All mutations are safe to retry using idempotency keys
- Keys scoped to (wallet, operation) to prevent collisions
- 24-hour TTL prevents cache bloat
- Replayed requests return cached result without re-execution

### 3. Circuit Breaker

**Automatic circuit breaking:**
- Tracks error rate per wallet over 60-second windows
- Opens circuit when error rate ≥ 10% for 30 seconds
- Prevents cascading failures to degraded wallets
- Returns `503 Service Unavailable` when open

**Configuration:**
- Error rate computed as `(errors / total_requests) * 100`
- Window: 60,000 ms
- Duration: 30,000 ms
- Threshold: 10%

### 4. Timeout Enforcement

**Request timeouts:**
- GET notifications: handled by upstream `withApiHandler`
- PATCH notifications: 5 seconds (strict)
- GET preferences: handled by upstream
- PUT preferences: 5 seconds (strict)

Timeouts prevent resource exhaustion from hanging operations.

### 5. Structured Diagnostics

All operations generate structured diagnostic events [src/lib/backend/notificationDiagnostics.ts](src/lib/backend/notificationDiagnostics.ts):

**Event structure:**
```typescript
{
  kind: 'GET' | 'PATCH' | 'PUT',
  walletHash: 'wallet_<hash>',        // Hashed for privacy
  timestamp: '2026-08-31T...',
  level: 'debug' | 'info' | 'warn' | 'error',
  message: 'Operation completed...',
  durationMs: 145,
  statusCode: 200,
  requestSizeBytes: 256,
  responseSizeBytes: 1024,
  cacheHit: false,                     // GET operations
  idempotencyHit: true,                // Mutations
  errorCode: 'RATE_LIMITED',
  traceId: 'traceId_abc123_def456'    // Correlation ID
}
```

**No secrets leak:**
- Wallet addresses hashed with SHA-256
- Error messages sanitized
- Response bodies not logged
- Trace IDs allow correlation without secrets

**Observable degradation:**
- Circuit breaker status tracked per wallet
- Error rates published in responses (429, 503 status codes)
- Performance metrics (latency p95/p99) computed per operation
- Idempotency cache hit ratio visible for tuning

### 6. Multi-Tab/Session Consistency

[src/lib/backend/notificationConsistency.ts](src/lib/backend/notificationConsistency.ts) provides client-side consistency:

**ETag-based version tracking:**
- GET endpoints include `ETag` header
- PUT endpoints validate `If-Match` header
- Prevents stale overwrites across tabs

**Cross-tab sync via BroadcastChannel:**
- `CrossTabSyncChannel` broadcasts updates to other tabs
- Events: `notification_updated`, `preference_updated`, `invalidate_cache`, `conflict_detected`
- Reduces need for polling

**Idempotency for safe retries:**
- `IdempotencyKeyManager` generates unique keys per operation
- Clients submit same key on retry
- Server returns cached result without re-executing

**Request deduplication:**
- `RequestDeduplicator` prevents duplicate API calls within time windows
- Useful when rapidly toggling notification states

### 7. State & Invariants

#### Notification State Machine
```
UNREAD ──(mark_read)──> READ ──(acknowledge)──> ACKNOWLEDGED (terminal)
```

**Invariants:**
- Only notification owner may mutate
- Transitions are idempotent (replay-safe)
- Forward-only (no backward transitions)
- ACKNOWLEDGED is terminal (no further mutations)
- Idempotency key prevents double-application

**Consistency:**
- State computed from stored `(read, acknowledgedAt)` fields
- ETag tracks version for conflict detection
- Transitions atomic per notification

#### Preference State Machine
```
DEFAULT ──(PUT with updates)──> PERSONALISED
```

**Invariants:**
- Idempotent PUTs (same key returns cached result)
- Optimistic concurrency with ETag/If-Match
- Deep-merge semantics (unspecified fields retained)
- Supports cross-tab sync

**Consistency:**
- ETag derived from content hash
- If-Match prevents lost updates
- Idempotency key scoped to wallet

## API Changes

### GET /api/notifications

**New behavior:**
- Rate limited to 2 req/s per wallet
- Returns `429` if exceeded
- Returns `503` if circuit breaker open
- Includes `ETag` header for conditional polling
- Diagnostic events tracked (no secrets)

**Bounds:**
- `pageSize`: 1-100 (default 10)
- `page`: 1-1000

### PATCH /api/notifications

**New behavior:**
- Max 5 concurrent mutations per wallet (queued if exceeded)
- 5-second timeout enforcement
- Returns `503` if circuit breaker open
- Idempotency key length validated (max 512 chars)
- Diagnostic events tracked

**Mutation queueing:**
- Prevents thundering herd on recovery
- Clients don't need to know about queueing

### GET /api/user/preferences

**New behavior:**
- Rate limited to 2 req/s per wallet
- Returns `429` if exceeded
- Returns `503` if circuit breaker open
- Includes `ETag` header for conditional polling

### PUT /api/user/preferences

**New behavior:**
- Max 3 concurrent mutations per wallet
- 5-second timeout enforcement
- Returns `503` if circuit breaker open
- Body size limited to 64 KiB (returns `413`)
- Idempotency key validated
- ETag-based optimistic concurrency

## Implementation Details

### Rate Limiting

[RateLimitTracker](src/lib/backend/notificationBounds.ts):
- Sliding-window rate limiter per wallet
- Tracks request timestamps within window
- O(n) cleanup on each request (n = max RPS)
- Reset for tests

**Usage:**
```typescript
getRequestLimiter.recordRequest(address, windowMs);
const isLimited = getRequestLimiter.isRateLimited(address, maxRps, windowMs);
```

### Error Rate Tracking

[ErrorRateTracker](src/lib/backend/notificationBounds.ts):
- Per-wallet error counts and totals
- Auto-resets when window expires
- Computes error rate as percentage
- Circuit breaker state management

**Usage:**
```typescript
errorRateTracker.recordSuccess(address, windowMs);
errorRateTracker.recordError(address, windowMs);
const rate = errorRateTracker.getErrorRate(address, windowMs);
const opened = errorRateTracker.checkAndOpenCircuit(address, threshold, windowMs);
```

### Concurrent Mutation Tracking

[ConcurrentMutationTracker](src/lib/backend/notificationBounds.ts):
- Per-wallet in-flight counter
- Queue for waiting requests
- Promise-based queueing mechanism
- Release slot after completion

**Usage:**
```typescript
const release = await tracker.acquire(address, maxConcurrent);
try {
  // perform mutation
} finally {
  release();
}
```

### Diagnostics

[OperationDiagnostics](src/lib/backend/notificationDiagnostics.ts):
- Per-request diagnostic context
- Records debug/info/warn/error events
- Tracks request/response sizes
- Generates summary event

**Usage:**
```typescript
const diag = new OperationDiagnostics('GET', address, traceId);
diag.info('Rate limit check passed');
diag.setResponseSize(bytes);
globalDiagnosticsCollector.addEvent(diag.summarize(200));
```

## Testing

Integration tests cover:
- Pagination bounds enforcement
- Rate limiting on GET/PUT
- Concurrent mutation queueing
- Circuit breaker activation
- Idempotency key validation
- Timeout enforcement
- Diagnostic event tracking
- No secret leakage in diagnostics

**Run tests:**
```bash
npm run test -- __tests__/api/notificationBounds.test.ts
```

## Migration Guide

### For clients

**Before:**
```typescript
// Could rate limit or hang indefinitely
const res = await fetch('/api/notifications');
```

**After:**
```typescript
// Handle new status codes
const res = await fetch('/api/notifications');
if (res.status === 429) {
  // Rate limited — wait and retry
}
if (res.status === 503) {
  // Service degraded — show user message
}

// Use ETag for efficient polling
const prev = localStorage.getItem('notif-etag');
const res = await fetch('/api/notifications', {
  headers: prev ? { 'If-None-Match': prev } : {},
});
if (res.status === 304) {
  // Not modified — use cached data
}

// Store ETag for next request
localStorage.setItem('notif-etag', res.headers.get('etag'));
```

**Preferences updates with idempotency:**
```typescript
const idempotencyKey = `pref_${wallet}_${Date.now()}`;
const res = await fetch('/api/user/preferences', {
  method: 'PUT',
  headers: {
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({ theme: 'dark' }),
});
// Safe to retry with same idempotencyKey
```

### For operators

**Monitor diagnostics:**
```typescript
import { globalDiagnosticsCollector } from '@/lib/backend/notificationDiagnostics';

// Get performance stats
const stats = globalDiagnosticsCollector.getPerformanceStats('GET', 60000);
console.log(`GET p95: ${stats.p95Latency}ms, error rate: ${stats.errorRate}%`);

// Get all errors
const errors = globalDiagnosticsCollector.getErrors();
```

**Set custom bounds (if needed):**
```typescript
import { NOTIFICATION_BOUNDS } from '@/lib/backend/notificationBounds';

// Bounds are constants; to change, edit the file directly
// No runtime override (prevents misconfiguration)
```

## Failure Modes & Recovery

| Scenario | Signal | Recovery |
|----------|--------|----------|
| Wallet rate limited | 429 status | Wait 1+ second, retry |
| Service degraded | 503 status | Wait 30s, retry (circuit opens) |
| Stale update attempt | 412 status | Refresh data with GET, retry PUT |
| Invalid state transition | 409 status | Fetch latest, check state |
| Request timeout | 500/timeout | Retry with idempotency key |
| Large preference update | 413 status | Reduce payload size (<64 KiB) |

## Future Improvements

1. **Persistent circuit breaker state** - Store in Redis/KV to survive restarts
2. **Distributed rate limiting** - Coordinate across multiple server instances
3. **Adaptive timeout** - Adjust based on p95 latency trends
4. **Metrics export** - Prometheus/Datadog integration
5. **Client telemetry** - Browser-side diagnostic collection
6. **Dynamic bounds** - Adjust limits based on load without redeployment

## See Also

- [notificationStateMachine.ts](src/lib/backend/notificationStateMachine.ts) - State machine implementation
- [preferences.ts](src/lib/backend/preferences.ts) - Preference storage
- [idempotency.ts](src/lib/backend/idempotency.ts) - Idempotency cache
- [etag.ts](src/lib/backend/etag.ts) - ETag generation
- [withApiHandler.ts](src/lib/backend/withApiHandler.ts) - Request wrapper
