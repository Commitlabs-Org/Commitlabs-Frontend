# Commitment Status Endpoint

## Overview

`GET /api/commitments/[id]/status` returns a lightweight status snapshot
for a commitment. It is designed for **efficient polling** — returning only
the fields needed to track commitment health without the full payload.

## Request
No request body or query parameters required.

## Response — 200 OK

```json
{
  "data": {
    "commitmentId": "commitment-123",
    "status": "ACTIVE",
    "daysRemaining": 14,
    "complianceScore": 92,
    "currentValue": "10500",
    "violationCount": 0,
    "expiresAt": "2026-05-01T00:00:00.000Z"
  }
}
```

| Field           | Type            | Description                              |
|-----------------|-----------------|------------------------------------------|
| commitmentId    | string          | Unique commitment identifier             |
| status          | string          | ACTIVE, SETTLED, VIOLATED, EARLY_EXIT    |
| daysRemaining   | number          | Days until expiry (0 if expired)         |
| complianceScore | number          | Current compliance score (0-100)         |
| currentValue    | string          | Current value of the commitment          |
| violationCount  | number          | Number of violations recorded            |
| expiresAt       | string or null  | ISO 8601 expiry timestamp                |

## Error Responses

| Status | Code          | Description                    |
|--------|---------------|--------------------------------|
| 404    | NOT_FOUND     | Commitment does not exist      |
| 429    | TOO_MANY_REQUESTS | Rate limit exceeded        |

## Polling Recommendation

Poll at most once every **30 seconds** per commitment to stay within
rate limits. Use the `status` field to stop polling once a terminal
state (`SETTLED`, `VIOLATED`, `EARLY_EXIT`) is reached.