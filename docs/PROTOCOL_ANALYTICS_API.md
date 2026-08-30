# Protocol Analytics API Contract

**Issue Reference**: Refs #1796  
**Endpoint**: `GET /api/analytics/protocol`  
**Version**: 1.0  
**Last Updated**: 2026-08-29

## Table of Contents

- [Overview](#overview)
- [Endpoint Specification](#endpoint-specification)
- [Request Contract](#request-contract)
- [Response Contract](#response-contract)
- [Feature Flag Dependency](#feature-flag-dependency)
- [CORS Policy](#cors-policy)
- [Error Handling](#error-handling)
- [State Invariants](#state-invariants)
- [Known Limitations](#known-limitations)
- [Implementation Details](#implementation-details)
- [Testing Coverage](#testing-coverage)

## Overview

The Protocol Analytics API provides aggregate, protocol-wide metrics computed from all commitments across the system. This endpoint aggregates data from the blockchain (Soroban) or mock database depending on the environment configuration.

**Purpose**: Enable dashboards, reporting, and monitoring of global protocol health metrics.

**Consumers**: 
- Frontend dashboard components (analytics pages, overview widgets)
- Admin reporting tools
- Protocol monitoring systems

## Endpoint Specification

```
GET /api/analytics/protocol
```

**Description**: Returns aggregate protocol analytics without requiring authentication or query parameters.

**HTTP Method**: GET only. POST, PUT, PATCH, DELETE are rejected with 405 Method Not Allowed.

**Base Response Time**: < 500ms (in nominal load conditions)

## Request Contract

### HTTP Headers

| Header | Required | Value | Notes |
|--------|----------|-------|-------|
| `Content-Type` | No | `application/json` | Auto-added by client |
| `Origin` | No | Any | CORS first-party policy enforced |

### Query Parameters

None required or recognized. Unknown query parameters are silently ignored.

**Example Requests**:

```bash
# Minimal request
curl http://localhost:3000/api/analytics/protocol

# With ignored query parameters
curl http://localhost:3000/api/analytics/protocol?foo=bar&limit=10
```

### Request Payload

None. Request body is ignored.

## Response Contract

### Success Response (HTTP 200 OK)

```json
{
  "totalCommitments": 150,
  "activeCommitments": 87,
  "settledCommitments": 45,
  "violatedCommitments": 18,
  "totalValueLocked": "50000.00",
  "totalFeesEarned": "500.50",
  "averageComplianceScore": 87.45,
  "totalViolations": 23,
  "uniqueOwners": 42
}
```

### Response Schema

| Field | Type | Range | Description | Invariants |
|-------|------|-------|-------------|-----------|
| `totalCommitments` | number | [0, ∞) | Total count of all commitments | Sum of status breakdowns ≤ totalCommitments |
| `activeCommitments` | number | [0, ∞) | Count of ACTIVE status commitments | ≤ totalCommitments |
| `settledCommitments` | number | [0, ∞) | Count of SETTLED status commitments | ≤ totalCommitments |
| `violatedCommitments` | number | [0, ∞) | Count of VIOLATED status commitments | ≤ totalCommitments |
| `totalValueLocked` | string (numeric) | "0.00" to "999...999.99" | Sum of all commitment amounts (formatted with 2 decimals) | Always 2 decimal places; skips non-finite values |
| `totalFeesEarned` | string (numeric) | "0.00" to "999...999.99" | Sum of all feeEarned (formatted with 2 decimals) | Always 2 decimal places; skips non-finite values |
| `averageComplianceScore` | number | [0, 100] | Average complianceScore across all commitments | Rounded to 2 decimal places; 0 if no commitments |
| `totalViolations` | number | [0, ∞) | Sum of violationCount across all commitments | Always ≥ 0 |
| `uniqueOwners` | number | [0, ∞) | Count of unique owner addresses (filters out empty strings) | ≤ totalCommitments |

### Error Responses

#### 404 Not Found - Feature Disabled

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Protocol analytics endpoint is disabled.",
    "details": {
      "feature": "analyticsProtocol"
    }
  }
}
```

**Cause**: The `COMMITLABS_FEATURE_ANALYTICS_PROTOCOL` environment variable is not set to `'true'`.

**Action**: Enable the feature flag in your environment configuration.

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to compute protocol analytics.",
    "details": {}
  }
}
```

**Cause**: Unexpected error during commitment fetching or analytics computation.

**Action**: Check server logs for details. Retry with exponential backoff.

#### 400 Bad Request - CORS Policy Violation

```json
{
  "success": false,
  "error": {
    "code": "CORS_POLICY_VIOLATION",
    "message": "CORS policy violation: first-party access required.",
    "details": {}
  }
}
```

**Cause**: Request origin violates CORS first-party policy.

**Action**: Ensure requests originate from first-party context (same domain as frontend).

## Feature Flag Dependency

The endpoint requires the `analyticsProtocol` feature flag to be enabled.

**Environment Variable**: `COMMITLABS_FEATURE_ANALYTICS_PROTOCOL`

| Value | Behavior |
|-------|----------|
| `'true'` | Endpoint returns 200 with analytics data |
| `'false'` or unset | Endpoint returns 404 with NOT_FOUND error |

**Reason**: Allows safe gradual rollout and easy disabling if issues arise.

## CORS Policy

**Policy Type**: `first-party` (same-origin only)

**Details**:
- Only requests from the same origin as the frontend are allowed
- Cross-origin requests are rejected
- Credentials are not included in requests

**Configuration**: Defined in route handler as `ANALYTICS_PROTOCOL_CORS_POLICY`.

## Error Handling

All errors follow the backend error response format:

```typescript
{
  success: false;
  error: {
    code: string;        // e.g., 'NOT_FOUND', 'INTERNAL_ERROR'
    message: string;     // Human-readable message
    details?: Record<string, unknown>; // Additional context
  };
}
```

### Error Codes

| Code | Status | Cause |
|------|--------|-------|
| `NOT_FOUND` | 404 | Feature flag disabled |
| `CORS_POLICY_VIOLATION` | 400 | CORS policy violation |
| `INTERNAL_ERROR` | 500 | Commitment fetch or computation error |

### Retry Strategy

- **Transient errors (5xx)**: Retry with exponential backoff (200ms, 400ms, 800ms)
- **Permanent errors (4xx)**: Do not retry; fix the underlying issue
- **Timeouts**: Treat as 5xx; retry

## State Invariants

The endpoint maintains the following invariants for every response:

### Invariant 1: Status Breakdown Consistency

```
activeCommitments + settledCommitments + violatedCommitments + otherStatuses ≤ totalCommitments
```

**Rationale**: Status categories must sum to or be less than the total (unknown/unhandled statuses may exist).

**Enforcement**: Tests verify this invariant in `tests/api/protocol-analytics.test.ts`.

### Invariant 2: Numeric Value Precision

```
totalValueLocked: string with exactly 2 decimal places
totalFeesEarned: string with exactly 2 decimal places
averageComplianceScore: number with ≤ 2 decimal places
```

**Rationale**: Consistent formatting for UI display and financial accuracy.

**Enforcement**: `buildProtocolAnalytics()` applies `toFixed(2)`.

### Invariant 3: Non-Negative Aggregates

```
All numeric counts ≥ 0
All total/sum values ≥ 0
```

**Rationale**: Counts and aggregates cannot be negative; invalid values are skipped.

**Enforcement**: `sumNumericStringField()` skips non-finite values.

### Invariant 4: Unique Owner Filtering

```
uniqueOwners includes only non-empty ownerAddress values
uniqueOwners ≤ totalCommitments
```

**Rationale**: Empty addresses shouldn't count as unique; avoid false positive counts.

**Enforcement**: `buildProtocolAnalytics()` filters `Boolean` on addresses.

### Invariant 5: Immutability (Within a Request)

```
Multiple identical requests to the endpoint return identical data
```

**Rationale**: No side effects; data is read-only aggregation.

**Enforcement**: Tests verify consistency in `tests/api/protocol-analytics.test.ts`.

## Known Limitations

### 1. Production Chain Data Unavailable

**Issue**: Contract does not expose `get_all_commitment_ids` endpoint.

**Workaround**: In production, the endpoint falls back to returning all zeros (empty state). Frontend gracefully handles empty analytics.

**Timeline**: Depends on contract upgrade to expose protocol-level read methods.

### 2. No Time Window Parameter

**Issue**: Endpoint does not accept time range filters (e.g., last 7 days, current month).

**Scope**: Out of scope for v1; intended for future enhancement.

**Workaround**: Frontend can aggregate per-commitment data if time-based views are needed.

### 3. No Pagination

**Issue**: Endpoint returns all commitments at once.

**Performance**: Acceptable for current protocol size (<100k commitments); monitor as scale grows.

### 4. Mock Mode Data Inconsistency

**Issue**: Mock mode returns fabricated data that may not reflect production behavior.

**Testing**: Use mock data for happy-path testing only; production behavior requires real or integration tests.

## Implementation Details

### Data Sources

| Environment | Source | Fallback |
|-------------|--------|----------|
| `NEXT_PUBLIC_USE_MOCKS='true'` | Mock database (`getMockData()`) | Empty array on fetch error |
| Production | Soroban contract RPC | Empty array (contract doesn't expose method yet) |

### Computation Flow

```
1. Check feature flag → return 404 if disabled
2. Enforce CORS policy → return 400 if violated
3. Fetch commitments from source (mock or chain)
4. buildProtocolAnalytics(commitments) → aggregate
5. Apply CORS headers & return 200 with JSON
```

### Numeric Field Aggregation

The `sumNumericStringField()` function:

```typescript
function sumNumericStringField(
  commitments: ChainCommitment[],
  field: 'amount' | 'feeEarned',
): string {
  const total = commitments.reduce((acc, commitment) => {
    const value = Number(commitment[field]);
    return Number.isFinite(value) ? acc + value : acc;
  }, 0);
  return total.toFixed(2);
}
```

**Behavior**:
- Converts string to number
- Skips non-finite values (NaN, Infinity, -Infinity)
- Accumulates only valid numbers
- Formats result with 2 decimal places

**Why This Approach**: 
- Resilient to malformed data
- Consistent financial formatting
- Transparent about skipped values

## Testing Coverage

### Unit Tests (`tests/api/protocol-analytics.test.ts`)

| Category | Cases |
|----------|-------|
| `buildProtocolAnalytics()` | 40+ tests |
| Success scenarios | Single & multiple commitments, status filtering, aggregation |
| Boundary cases | Empty list, zero values, unknown statuses |
| Null/undefined handling | NaN, Infinity values, invalid strings |
| Precision | Decimal formatting, large/small numbers |
| Response invariants | Type validation, range checks, immutability |
| GET endpoint | Feature flag gating, CORS, method enforcement |
| Error handling | 404, 500, normalization |

### Integration Tests

- Feature flag toggling
- Error response format
- CORS policy enforcement
- Consistent response format

### Manual Validation

```bash
# Test happy path
curl http://localhost:3000/api/analytics/protocol

# Test feature flag disabled
COMMITLABS_FEATURE_ANALYTICS_PROTOCOL=false npm run dev
curl http://localhost:3000/api/analytics/protocol # Should return 404

# Test invalid method
curl -X POST http://localhost:3000/api/analytics/protocol # Should return 405
```

## Related Components

### Frontend Consumers

- `src/components/analytics/AnalyticsTrendBarChart.tsx` - Displays bar charts
- `src/components/analytics/AnalyticsTrendLineChart.tsx` - Displays line charts
- Dashboard overview widgets (TBD - documented separately)

### Backend Dependencies

- `@/lib/backend/services/contracts.ts` - ChainCommitment type
- `@/lib/backend/errors.ts` - Error handling
- `@/lib/backend/config.ts` - Feature flags
- `@/lib/backend/cors.ts` - CORS enforcement
- `@/lib/backend/mockDb.ts` - Mock data source

## Design Tradeoffs

### Choice 1: Fallback to Empty Array vs. Error

**Decision**: Fallback to empty array (return zeros) on production data fetch errors.

**Tradeoff**:
- ✅ **Pro**: Frontend never breaks; graceful degradation
- ❌ **Con**: Silent failures; production data issues not immediately obvious

**Rationale**: Analytics is secondary feature; data unavailability shouldn't break primary flows.

### Choice 2: String vs. Number for Monetary Values

**Decision**: Return `totalValueLocked` and `totalFeesEarned` as strings.

**Tradeoff**:
- ✅ **Pro**: Avoids floating-point precision errors; explicit decimal formatting
- ❌ **Con**: Requires client-side parsing

**Rationale**: Financial data integrity is critical; string format makes precision explicit.

### Choice 3: Aggregated Data vs. Paginated Breakdown

**Decision**: Single aggregated response; no pagination or breakdown.

**Tradeoff**:
- ✅ **Pro**: Simple API; fast response for current scale
- ❌ **Con**: Doesn't scale for millions of commitments

**Rationale**: Acceptable for current protocol size; future enhancement to add time-windowed breakdowns.

## Maintenance Notes

- **Monitoring**: Track endpoint response times and error rates in production.
- **Alerts**: Alert if error rate exceeds 1% or response time > 1s (indicates contract performance issues).
- **Deprecation**: No current plans to deprecate this endpoint; maintain backward compatibility.
- **Versioning**: API is v1; breaking changes should be versioned as `/api/analytics/protocol/v2`.

---

**Status**: ✅ Ratified  
**Contributors**: [Issue #1796 Assignee]  
**Last Review**: 2026-08-29
