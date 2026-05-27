# Backend Performance Guidelines

This document establishes clear technical standards for backend performance, including acceptable endpoint latency, payload sizes, and optimal polling frequencies. These guidelines apply to all REST and GraphQL endpoints within the CommitLabs ecosystem.

## 1. Latency Standards

| Operation Type       | Threshold | Rationale                                                                                                                                             |
| :------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRUD Operations**  | < 200ms   | Standard user interactions (Create, Read, Update, Delete) must feel instantaneous to ensure a smooth user experience and reduce perceived wait times. |
| **Complex Queries**  | < 500ms   | Aggregations, joins across multiple tables, or heavy filtering may take longer but should remain sub-second to maintain application responsiveness.   |
| **Batch Operations** | < 2s      | Processing multiple records or generating reports is expected to be slower. If an operation exceeds 2s, it should be offloaded to a background job.   |

_Note: Latency is measured as Time to First Byte (TTFB) + Content Download Time from the server's perspective._

## 2. Payload Size Limits

| Payload Type                        | Maximum Size | Rationale                                                                                                                                          |
| :---------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Standard API Requests/Responses** | 1 MB         | Large JSON payloads increase parsing time, memory usage, and network transfer time on both client and server.                                      |
| **File Uploads**                    | 10 MB        | Direct uploads should be limited to prevent server blocking. For larger files, use presigned URLs to upload directly to object storage (e.g., S3). |

### Best Practices for Payloads

- **Pagination**: Always implement pagination for list endpoints. Default page size should be 20-50 items.
- **Field Selection**: Allow clients to request only necessary fields (e.g., GraphQL or sparse fieldsets in REST) to reduce payload size.
- **Compression**: Ensure GZIP/Brotli compression is enabled for all text-based responses.

## 3. Polling Frequency Recommendations

| Use Case                | Recommended Frequency | Rationale                                                                                                                                          |
| :---------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real-time Updates**   | 1-5 seconds           | Critical status changes (e.g., payment processing, live tracking) require near real-time feedback. Prefer WebSockets/SSE over polling if possible. |
| **Dashboard Refreshes** | 30-60 seconds         | General analytics and overview data do not change rapidly enough to warrant frequent polling, reducing unnecessary server load.                    |
| **Bulk Data Sync**      | 5-15 minutes          | Background synchronization processes should be spaced out to avoid server congestion and database contention.                                      |

### Optimization Strategy

- **Exponential Backoff**: Implement exponential backoff for polling when the state hasn't changed or errors occur.
- **E-Tags / Last-Modified**: Use conditional requests (If-None-Match, If-Modified-Since) to avoid downloading data that hasn't changed.

## 4.1 ETag Implementation for List Endpoints

CommitLabs implements ETag-based caching for read-heavy list endpoints to reduce bandwidth and re-render costs. This applies to:
- `/api/commitments` (GET)
- `/api/marketplace/listings` (GET)
- `/api/attestations` (GET)

### How It Works

1. **ETag Generation**: A stable SHA-256 hash is computed from the serialized JSON response payload
2. **Conditional Requests**: Clients send `If-None-Match` header with the cached ETag
3. **304 Not Modified**: Server returns 304 status when ETag matches, avoiding full payload transmission
4. **Cache Headers**: Responses include `Cache-Control: public, max-age=0, must-revalidate` and `ETag` headers

### Implementation Details

- **Location**: `src/lib/backend/withApiHandler.ts` (shared handler)
- **ETag Utilities**: `src/lib/backend/etag.ts` (generateETag, etagMatches)
- **Envelope Stability**: ETags are computed on the success envelope shape to ensure consistency across requests
- **Automatic**: Enable with `enableETag: true` option in withApiHandler

### Example Client Usage

```javascript
// First request
const response = await fetch('/api/commitments?ownerAddress=G...');
const etag = response.headers.get('etag');
const data = await response.json();

// Subsequent request with cached ETag
const cachedResponse = await fetch('/api/commitments?ownerAddress=G...', {
  headers: { 'If-None-Match': etag }
});

if (cachedResponse.status === 304) {
  // Use cached data, no re-render needed
  console.log('Data unchanged, using cache');
} else {
  // Data changed, update UI
  const newData = await cachedResponse.json();
}
```

### Performance Impact

- **Bandwidth Reduction**: 304 responses eliminate payload transmission for unchanged data
- **Re-render Prevention**: Clients can skip UI updates when data hasn't changed
- **Polling Optimization**: Enables efficient polling at recommended frequencies (30-60s for dashboards)
- **Typical Savings**: 95%+ bandwidth reduction for unchanged data (304 response ~200 bytes vs full payload)

## 4. Implementation Examples

### REST API Example (Node.js/Express)

```javascript
// Good: Pagination, Field Selection, and Timeout Handling
app.get("/api/users", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Enforce max limit
  const fields = req.query.fields ? req.query.fields.split(",") : null;

  try {
    const users = await db.users
      .find(
        {},
        {
          skip: (page - 1) * limit,
          limit: limit,
          projection: fields, // Only select requested fields
        },
      )
      .maxTimeMS(500); // Set query timeout

    res.json({
      data: users,
      meta: { page, limit },
    });
  } catch (error) {
    res.status(500).json({ error: "Query timeout or database error" });
  }
});
```

### GraphQL Example

```graphql
# Good: Complexity Limits and Pagination
type Query {
  users(first: Int = 20, after: String): UserConnection!
}

# Avoid deeply nested queries that can cause N+1 problems.
# Use DataLoader to batch and cache database requests.
```

## 5. Monitoring Requirements

All services must emit metrics to be monitored by the observability platform (e.g., Prometheus, Datadog).

- **Key Metrics**:
  - `http_request_duration_seconds`: Histogram of response times (P50, P90, P95, P99).
  - `http_requests_total`: Counter of requests by status code and endpoint.
  - `http_response_size_bytes`: Histogram of response sizes.
- **Alerting**:
  - **P95 Latency**: Alert if P95 latency exceeds the defined threshold for > 5 minutes.
  - **Error Rate**: Alert if 5xx error rate > 1% for > 5 minutes.

## 6. Performance Testing Methodologies

- **Load Testing**: Use tools like k6 or JMeter to simulate expected peak traffic.
- **Stress Testing**: Determine the breaking point of the system by increasing load until failure.
- **Automated Checks**: Integrate performance tests into the CI/CD pipeline. Fails build if latency thresholds are exceeded.

## 7. Soroban RPC Timeout Policy

All Soroban RPC interactions in `src/lib/backend/services/contracts.ts` are
wrapped with an `AbortController`-backed per-call timeout.

### Configuring the timeout

Set `SOROBAN_RPC_TIMEOUT_MS` in your environment (see `.env.example`).
If unset the default is **30 000 ms (30 s)**.

```env
# Increase for slow testnets, decrease for strict latency budgets
SOROBAN_RPC_TIMEOUT_MS=30000
```

### Timeout behaviour

| Scenario | HTTP status | `retryable` | Notes |
| :--- | :--- | :--- | :--- |
| `getAccount` / `simulateTransaction` hang | `504 GATEWAY_TIMEOUT` | `true` | Safe to retry — no state was mutated. |
| `prepareTransaction` hang | `504 GATEWAY_TIMEOUT` | `true` | Safe to retry — tx was not broadcast. |
| `sendTransaction` hang | `504 GATEWAY_TIMEOUT` | `true` | **Outcome unknown** — the tx may have been broadcast. Surface the error details to the user. |
| `waitForTransactionResult` hang | `504 GATEWAY_TIMEOUT` | `true` | Tx was broadcast; include `txHash` from error details so users can verify on-chain. |

### Write-call semantics

When a timeout fires after `sendTransaction` has already submitted the
transaction, the `GATEWAY_TIMEOUT` error details will include the `txHash`.
API routes must propagate this hash to the client so the user can verify the
final outcome on-chain independently.

### Implementation detail

A single `AbortController` is created per `invokeContractMethod` invocation.
`setTimeout(controller.abort, timeoutMs)` schedules the abort, and every
awaited RPC promise is wrapped in `abortableRpc()` which races the real call
against the abort signal.  The timer is always cleared in a `finally` block so
no leaks occur on the success path.

## 8. Escalation Procedures

If a service consistently violates performance guidelines:

1.  **Incident Creation**: Automated alert triggers an incident ticket (Severity determined by impact).
2.  **Investigation**: The owning team must investigate within 2 business days.
3.  **Remediation Plan**: A plan to fix the issue (e.g., caching, database indexing, code refactoring) must be proposed within 1 week.
4.  **Critical Violations**: If P99 latency exceeds 3x the threshold, it may block future deployments until resolved.

## 8. Review Process for Exceptions

Exceptions to these guidelines must be approved by the Architecture Review Board.

- **Request Process**: Submit a "Performance Exception Request" document detailing:
  - Reason for exception (e.g., legacy system limitation, extremely complex computation).
  - Impact analysis on system resources and user experience.
  - Proposed mitigation (e.g., aggressive caching, async processing).
  - Timeline for compliance or permanent waiver justification.

## 9. Cache Invalidation Patterns

Caching improves performance but must be managed carefully to prevent stale data. This section documents invalidation patterns used throughout CommitLabs.

### Cache Architecture

The backend uses a layered caching strategy:

- **Memory Adapter**: Default for development/test; TTL enforced on read
- **Redis Adapter**: Production deployment; fast distributed cache
- All cache keys are namespaced under `commitlabs:` prefix to avoid collisions

### Cache Key Structure

```typescript
// Commitment data
commitlabs:commitment:{id}
commitlabs:user-commitments:{ownerAddress}

// Marketplace listings (keyed by stable query hash)
commitlabs:marketplace:listings:{queryHash}

// Marketplace aggregates
commitlabs:marketplace:stats
```

### Marketplace Cache Invalidation Strategy

**When listings are created or cancelled**, the following cache entries must be evicted:

1. **All listing queries** (`commitlabs:marketplace:listings:*`) — invalidated via prefix
2. **Stats cache** (`commitlabs:marketplace:stats`) — invalidated via delete

**Why both?**

- Listing query caches depend on the current set of active listings
- Stats aggregates depend on the current set of active listings
- Both must reflect the same underlying data to maintain consistency

**Implementation in `MarketplaceService`:**

```typescript
// In createListing() and cancelListing() methods:

// Step 1: Perform the mutation (create/cancel listing)
await this.storage.set(getListingStorageKey(listingId), listing);

// Step 2: Invalidate all listing query caches via prefix
await cache.invalidate("commitlabs:marketplace:listings:");
logInfo(undefined, "[cache] invalidated marketplace-listings after mutation", {
  listingId,
});

// Step 3: Invalidate stats cache
await cache.delete(CacheKey.marketplaceStats());
logInfo(undefined, "[cache] invalidated marketplace-stats after mutation", {
  listingId,
});
```

### TTL Configuration

| Cache Key              | TTL | Rationale                                                                  |
| :--------------------- | :-- | :------------------------------------------------------------------------- |
| `MARKETPLACE_LISTINGS` | 15s | Query results change on mutations; short TTL allows rapid propagation      |
| `MARKETPLACE_STATS`    | 30s | Aggregates are more stable; can be slightly longer to reduce recalculation |
| `COMMITMENT_DETAIL`    | 30s | Commitment state changes slowly; can sustain 30s staleness                 |
| `USER_COMMITMENTS`     | 20s | User-specific data; intermediate TTL balances freshness and load           |

### Verification Strategy

**Cache invalidation is verified through two mechanisms:**

1. **Unit Tests** (`tests/api/marketplace-cache-invalidation.test.ts`):
   - Verify prefix-based invalidation removes all matching entries
   - Verify delete removes specific entries
   - Verify TTL expiration naturally evicts entries
   - Verify cache isolation (invalidating one prefix doesn't affect others)

2. **Integration Observability**:
   - Log all invalidation triggers with listing ID and mutation type
   - Monitor cache hit/miss rates via `X-Cache` response headers
   - Alert if cache hit rate drops below expected baseline

### Best Practices

**When adding new cached endpoints:**

1. **Use stable cache keys**: Include query parameters in key hash (not timestamps)
2. **Document invalidation triggers**: Comment where cache entries are cleared
3. **Group related invalidations**: If cached data depends on shared state, invalidate together
4. **Consider prefix strategy**: Use prefixes for cache families that grow (e.g., listing queries)
5. **Validate TTL values**: TTL should be short enough to prevent user-facing staleness but long enough to provide caching benefit

**Invalidation Anti-Patterns to Avoid:**

❌ **Don't**: Clear all caches on any mutation

```typescript
// Bad: Too aggressive, loses all caching benefits
await cache.clear();
```

❌ **Don't**: Forget to invalidate dependent caches

```typescript
// Bad: Listings cache updated but stats still stale
await cache.delete("commitlabs:marketplace:listings:hash123");
// Missing: await cache.delete(CacheKey.marketplaceStats());
```

❌ **Don't**: Use cache expiration alone for correctness

```typescript
// Bad: If TTL > mutation frequency, stale data reaches users
await cache.set(key, value, 300); // 5 min TTL
// User creates listing, cache isn't checked for 5 minutes
```

✅ **Do**: Invalidate specific cache families on targeted mutations

```typescript
// Good: Precise invalidation after marketplace mutation
await cache.invalidate("commitlabs:marketplace:listings:");
await cache.delete(CacheKey.marketplaceStats());
```

## 10. Escalation Procedures

If a service consistently violates performance guidelines:
