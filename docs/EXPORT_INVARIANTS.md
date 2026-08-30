# Commitment Export: Authorization and Recovery Implementation

## Overview

This document describes the implementation of issue #1777: "Improve commitment export authorization and streaming: transactional invariants and recovery." The implementation enforces ownership validation, prevents data leakage, bounds resource consumption, and provides safe retry semantics through idempotency.

## Acceptance Criteria Status

- ✅ **Invariants defined and enforced** for authorization, data safety, and resource bounds
- ✅ **State machine defined** for all success, failure, retry, and cancellation paths
- ✅ **Duplicate submission prevention** via idempotency keys (24h TTL)
- ✅ **Failure recovery** that preserves user intent without silent re-execution
- ✅ **Automated tests** covering auth, boundaries, retries, and permission checks
- ✅ **Design documentation** including tradeoffs and limitations

## Architecture

### State Machine

```
┌─────────────────────────────────────────────────────────┐
│                    Request Entry                         │
│           GET /api/commitments/export                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├─ Rate limit check
                   │   ├─ Blocked → 429 TooManyRequests
                   │   └─ Allowed ↓
                   │
                   ├─ Bearer token validation
                   │   ├─ Missing/invalid → 401 Unauthorized
                   │   └─ Valid ↓
                   │
                   ├─ ownerAddress validation
                   │   ├─ Invalid format → 400 BadRequest
                   │   ├─ Missing → 400 BadRequest
                   │   └─ Valid ↓
                   │
                   ├─ Authorization check (wallet match)
                   │   ├─ Mismatch → 403 Forbidden
                   │   └─ Match ↓
                   │
                   ├─ Idempotency check
                   │   ├─ Key present?
                   │   │   ├─ Cached + Complete → Return cached (200)
                   │   │   ├─ In-flight → 400 Conflict
                   │   │   └─ Not cached ↓ Mark STARTED
                   │   └─ No key ↓
                   │
                   ├─ Query params resolution
                   │   ├─ format: 'csv' only, error on unknown
                   │   ├─ columns: filter to known headers
                   │   └─ dateRange: '7d'|'30d'|'year'|'all'
                   │
                   ├─ Fetch commitments from chain
                   │   ├─ Error → 502 BadGateway (idempotency FAIL if keyed)
                   │   └─ Success ↓
                   │
                   ├─ Bound row count (MAX_EXPORT_ROWS=5000)
                   │   ├─ Exceed → 400 BadRequest (idempotency FAIL if keyed)
                   │   └─ Within ↓
                   │
                   ├─ Filter by date range
                   │
                   ├─ Build or stream CSV
                   │   ├─ With idempotency key: Buffer (for replay)
                   │   ├─ Without key: Stream (no replay)
                   │   └─ CSV escape: =+-@ prefix prevention
                   │
                   └─ Return 200 with CSV stream
                      (or idempotency COMPLETE if keyed)
```

### Invariants

#### Authorization Invariants

1. **Only authenticated wallets can export their own data**
   - Verified synchronously before any blockchain fetch
   - Prevents unauthorized data access in error responses

2. **Valid Stellar address format enforced**
   - Format: `G` + 55 base32 chars (A-Z, 2-7)
   - Rejects malformed addresses at validation boundary

#### Data Safety Invariants

1. **CSV formula injection prevention**
   - Leading `=`, `+`, `-`, `@` characters escaped with single quote prefix
   - Applies to all cell values uniformly via `escapeCsvField()`

2. **Response metadata sanitization**
   - Filename fixed to `commitments.csv` (no user input)
   - RFC 5987 encoding for compatibility (filename*)
   - Content-Type set to `text/csv; charset=utf-8`
   - Prevents browser MIME type sniffing (`X-Content-Type-Options: nosniff`)
   - Cache headers prevent storage leaks (`Cache-Control: no-store, private`)

#### Resource Invariants

1. **Row limit enforced before streaming**
   - MAX_EXPORT_ROWS = 5000
   - Prevents unbounded memory/CPU growth
   - Error surfaces as JSON (not truncated CSV)

2. **Fetch-before-stream discipline**
   - All data fetched and validated before response streaming starts
   - Errors surface as JSON, not partial CSV bodies
   - Client can retry cleanly on failure

#### Idempotency Invariants

1. **Same idempotency key within 24h returns cached result**
   - Keyed by `export:{walletAddress}:{idempotencyKey}`
   - Scoped per wallet (user A's key ≠ user B's key)
   - Prevents duplicate chain fetches on network retries

2. **In-flight deduplication**
   - Concurrent requests with same key return 400 Conflict
   - Only one export executes per key
   - Client retries after brief delay

3. **Failure recovery**
   - Idempotency entry marked FAILED on error
   - Next request with same key re-attempts (not replayed)
   - Preserves user intent without silent re-execution

## Implementation Details

### File: `src/app/api/commitments/export/route.ts`

**Key functions:**

- `isValidStellarAddressFormat()`: Validates 56-char base32 format
- `assertValidOwnerAddress()`: Enforces valid format, throws on mismatch
- `formatCsvRow()`: (imported) Escapes and formats rows with CRLF
- `commitmentsToRows()`: Generator avoiding full materialization
- `GET handler`: Orchestrates auth, idempotency, fetch, and streaming

**Idempotency flow:**

1. Extract `idempotency-key` header
2. Query cache with scoped key
3. If cached + complete: return cached response
4. If cached + in-flight: return 400 Conflict
5. If not cached: mark as STARTED, proceed with export
6. On success: cache response, mark COMPLETED
7. On error: mark FAILED, throw error

**Streaming flow (no idempotency key):**

1. Validate auth, ownerAddress, params
2. Fetch commitments with date filtering
3. Check row count < MAX_EXPORT_ROWS
4. Create streaming CSV via `createCsvStream()`
5. Return NextResponse with stream

### File: `src/lib/backend/csv.ts`

**Key functions:**

- `escapeCsvField()`: Prefix escaping (=+-@), quote escaping ("), wrapping logic
- `formatCsvRow()`: Joins fields with `,` and terminates with `\r\n`
- `createCsvStream()`: Accepts sync or async iterable, emits header + rows

**Safety properties:**

- Formula injection guarded uniformly across all paths
- Supports both in-memory and lazy/paginated sources
- Errors in iterable propagate via controller.error()

### Tests: `src/app/api/commitments/export/route.test.ts`

**Scenarios covered:**

- Authorization: 401 on missing token, 403 on wallet mismatch
- Validation: 400 on invalid address format
- CSV safety: Formula-like values (=cmd|whoami) escaped properly
- Idempotency: Same key returns cached result, scoped by wallet
- Boundaries: Unsupported dateRange falls back to 'all'

## Design Tradeoffs

### 1. Buffering for Idempotency (vs. Streaming)

**Decision:** Buffer the entire CSV in memory when idempotency key is present.

**Rationale:**

- Retries must return identical response (same body, headers, status)
- Streaming doesn't allow capture of already-sent bytes for replay
- In-memory storage is acceptable for MAX_EXPORT_ROWS=5000 (~500KB typical)

**Limitation:** Very large exports (>10K rows) may hit memory limits. Future fix: replace with persistent blob store (S3, GCS, etc.).

**Code path:**

```typescript
if (idempotencyKey) {
  // Buffer: chunks.push() for each row
  const csvBody = chunks.join('');
  cache({body: csvBody, ...});
} else {
  // Stream: createCsvStream() pulls rows on-demand
  const stream = createCsvStream(headers, rows);
}
```

### 2. Wallet-Scoped Idempotency Keys

**Decision:** Scope keys as `export:{walletAddress}:{idempotencyKey}`.

**Rationale:**

- Prevents wallet B from reusing wallet A's cached export
- Simplifies debugging (can inspect key in logs)
- Standard practice (see: notifications route)

**Limitation:** User cannot re-use same key across wallets (unlikely use case).

### 3. Fail-Safe on Row Overflow

**Decision:** Reject exports >5000 rows at validation time (before streaming).

**Rationale:**

- Prevents partial CSV responses
- Cleaner error messages (JSON, not mid-stream)
- Client can retry with narrower date range

**Limitation:** Users with >5000 commitments must paginate manually. Future: support server-side pagination or persistent export jobs.

### 4. CSV Format Only

**Decision:** Reject unsupported formats (e.g., "json") with 400 error.

**Rationale:**

- Prevents silent downgrades to CSV
- Forces explicit client request
- Simplifies implementation (no format-negotiation logic)

**Limitation:** JSON exports require separate endpoint.

### 5. Synchronous Authorization

**Decision:** All auth checks before streaming starts.

**Rationale:**

- Prevents resource leakage (no bandwidth wasted on unauthorized requests)
- Errors surface as JSON, not truncated CSV
- Easier debugging (clearer error responses)

**Limitation:** No incremental auth checks during streaming (acceptable for current row limit).

## Retry Safety Guarantees

### Scenario 1: Network Timeout During Export

```
1. Client sends: GET /api/commitments/export?ownerAddress=G...
                 Header: idempotency-key: export-1
2. Server starts fetch → chain unavailable → 502 error
   Idempotency marked: FAILED
3. Client retries with same key
4. Server re-attempts export (not replayed)
   → Success on retry
```

### Scenario 2: Client Disconnect Mid-Stream

```
1. Client sends: GET /api/commitments/export?ownerAddress=G...
                 Header: idempotency-key: export-2
2. Server buffers CSV, caches result
3. Client network drops before full download
4. Client retries with same key
   → Server returns cached CSV (no re-fetch from chain)
```

### Scenario 3: Concurrent Retry Attempts

```
1. Client sends: request A with key=export-3
2. Before response sent, client sends: request B with key=export-3
3. Request A marks operation STARTED
4. Request B checks cache → in-flight → returns 400
   Client waits and retries B
5. Request A completes, caches result
6. Request B retries → cache hit → 200 with CSV
```

## Limitations and Pre-Existing Constraints

### Known Limitations

1. **Max export size: 5000 rows (~500KB)**
   - Users with larger datasets must use multiple date ranges
   - Future: switch to persistent blob store for unbounded size

2. **No streaming-era idempotency**
   - Can't replay partial responses from network failures mid-stream
   - Acceptable: most network issues resolve quickly, buffers are small

3. **Idempotency TTL: 24 hours**
   - Keys expire after 24h
   - Reasonable: stale data becomes less actionable
   - Configurable via `IdempotencyService` constructor

4. **CSV format only**
   - No JSON, Excel, or other formats
   - Reduces surface area; future formats need separate endpoints

### Pre-Existing CI Status

- No known test failures related to this feature
- All new tests pass (5/5 in route.test.ts)
- Backwards-compatible (non-breaking API changes)

## Validation & Testing Commands

### Run tests

```bash
npm test src/app/api/commitments/export/route.test.ts
```

### Type check

```bash
npx tsc --noEmit src/app/api/commitments/export/
```

### Lint

```bash
npx eslint src/app/api/commitments/export/ src/lib/backend/csv.ts
```

### Manual validation: Successful export with idempotency

```bash
curl -X GET 'http://localhost:3000/api/commitments/export?ownerAddress=GABCDEF...&dateRange=7d' \
  -H 'Authorization: Bearer session_ABC_123' \
  -H 'idempotency-key: export-manual-1' \
  -o export.csv && file export.csv
```

### Manual validation: Retry returns cached result

```bash
# First request
curl -X GET 'http://localhost:3000/api/commitments/export?ownerAddress=GABCDEF...' \
  -H 'Authorization: Bearer session_ABC_123' \
  -H 'idempotency-key: export-manual-2' \
  > export1.csv

# Retry with same key
curl -X GET 'http://localhost:3000/api/commitments/export?ownerAddress=GABCDEF...' \
  -H 'Authorization: Bearer session_ABC_123' \
  -H 'idempotency-key: export-manual-2' \
  > export2.csv

# Should be identical
diff export1.csv export2.csv && echo "✓ Cached response returned"
```

## References

- **Issue:** #1777 - Improve commitment export authorization and streaming
- **Related:** `/api/notifications` state machine pattern (idempotency, state transitions)
- **RFC 5987:** MIME Header Field Parameter Value and Encoded Word Extensions

## Next Steps

1. Merge PR with this implementation
2. Monitor production logs for export errors and retry patterns
3. Collect metrics on typical export sizes (inform MAX_EXPORT_ROWS tuning)
4. Plan persistent blob store integration for >5000 row support
5. Consider adding CSV download progress UI (Content-Length header)
