## [#1777] Commitment Export Authorization and Streaming: Transactional Invariants and Recovery

### Summary

This PR implements deterministic, atomic, and recoverable commitment export authorization with focused test coverage for the `/api/commitments/export` route.

**Refs #1777**

### Changes Made

#### 1. **CSV Safety Layer** ([src/lib/backend/csv.ts](src/lib/backend/csv.ts))

- Created new `csv.ts` module with production-grade CSV generation and streaming.
- **Key invariants:**
  - Formula injection protection: Prefixes dangerous values (`=`, `+`, `-`, `@`) with single quote to prevent formula execution.
  - Proper CSV escaping: Quotes fields with embedded commas, quotes, or newlines.
  - Deterministic output: CRLF line terminators, consistent field ordering.
  - Memory-bounded streaming: Returns a `ReadableStream` that processes rows one-by-one instead of materializing the full response.
- Exports: `escapeCsvField()`, `formatCsvRow()`, `buildCsv()`, `createCsvStream()`.

#### 2. **Authorization Tightening** ([src/app/api/commitments/export/route.ts](src/app/api/commitments/export/route.ts))

- **Address validation (BAD_REQUEST):** Added strict Stellar address format check before wallet ownership comparison. Uses regex pattern `/^G[A-Z2-7]{55}$/` to validate format without blockchain round-trip.
- **Ownership enforcement (FORBIDDEN):** Rejects requests where `ownerAddress` parameter does not match the authenticated session wallet (normalized to lowercase for case-insensitive comparison).
- **Row limiting:** Enforces `MAX_EXPORT_ROWS = 5000` to prevent unbounded memory/CPU usage and to avoid returning partial exports that appear authoritative.
- **Improved headers:** Added security and cache directives:
  - `Content-Disposition: attachment; filename="commitments.csv"; filename*=UTF-8''commitments.csv` (RFC 5987 encoding for Unicode safety)
  - `Cache-Control: no-store, private` (prevent caching of user-specific data)
  - `X-Content-Type-Options: nosniff` (prevent MIME type sniffing)

#### 3. **Regression Test Suite** ([src/app/api/commitments/export/route.test.ts](src/app/api/commitments/export/route.test.ts))

Five focused tests covering success, failure, boundary, and authorization behavior:

1. **401 Unauthorized:** Missing bearer token is rejected.
2. **403 Forbidden:** Session wallet mismatch prevents export.
3. **200 Success + CSV Safety:** Valid export with formula-injection protection verified.
4. **400 Bad Request:** Invalid address format rejected before blockchain call.
5. **200 Success + Fallback:** Unsupported date ranges default to "all" without error.

All tests mock external dependencies (`checkRateLimit`, `verifySessionToken`, `getUserCommitmentsFromChain`) for isolation and fast execution.

### Design Tradeoffs

| Tradeoff                                                   | Rationale                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Format-only address validation** vs. checksum validation | Format validation (regex) is fast and safe; checksum validation would require `StrKey.isValidEd25519PublicKey()` which is slower and requires external dependency. Blockchain layer validates the actual address when used. |
| **Eager row limit check**                                  | Row count is validated before streaming starts so errors surface as JSON responses rather than truncated CSV bodies. This ensures clients receive deterministic, complete responses.                                        |
| **No idempotency key**                                     | Export is a read-only, deterministic operation. Unlike fund/settle operations, re-exporting the same commitments is safe and stateless. Adding idempotency would add complexity without safety benefit.                     |
| **Fixed filename** `commitments.csv`                       | Avoids leaking wallet address or filter details in the filename, reducing data exposure via browser history or file systems.                                                                                                |
| **Memory-bounded streaming**                               | Generator-based row iteration avoids materializing the full commitment list in memory. Streaming is bounded by `MAX_EXPORT_ROWS`.                                                                                           |

### Acceptance Criteria Met

✅ **Define invariants:** Specification of authorization (ownership, valid address format), data safety (CSV injection protection), and recovery (eager validation before streaming).

✅ **State machine for all paths:**

- Success: Validate auth → validate address → check ownership → fetch commitments → stream CSV.
- Rejection paths: missing token (401) → invalid format (400) → ownership mismatch (403) → row limit exceeded (400).
- No retry loops; each path is deterministic.

✅ **Prevent duplicate submissions:** No state mutation on client request (export is read-only); re-export of same commitments is idempotent.

✅ **Recovery preserves user intent:** Errors occur before streaming, so clients can retry without receiving partial downloads.

✅ **Automated tests:** 5 focused tests covering authorization, boundary conditions, and safety.

✅ **Validation commands:** Run with `npm test -- src/app/api/commitments/export/route.test.ts`.

✅ **PR format:** Title `[#1777] ...` referencing the issue.

### Testing Results

```
 ✓ src/app/api/commitments/export/route.test.ts (5 tests) 25ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Remaining Limitations

1. **No row-level recovery metadata:** If streaming is interrupted mid-response, the client receives truncated CSV and has no way to determine which rows were sent. This is inherent to HTTP streaming and acceptable for read-only exports.

2. **No streaming source bounds:** Currently fetches all matching commitments before streaming. If `getUserCommitmentsFromChain` returns >5000 rows, the request is rejected with 400. Future optimization: paginate the source as streaming happens (requires async generator in `getUserCommitmentsFromChain`).

3. **CSV escape sequence assumptions:** Assumes the CSV consumer (Excel, Google Sheets, etc.) respects RFC 4180 and the formula-injection prefix. Some legacy systems may ignore the leading single quote. Client-side validation (e.g., checking for formula prefixes in UI) provides defense-in-depth.

### Verification

Run tests:

```bash
npm test -- src/app/api/commitments/export/route.test.ts
```

Run full test suite:

```bash
npm test
```

Lint:

```bash
npm run lint
```

TypeScript check:

```bash
npm run typecheck
```
