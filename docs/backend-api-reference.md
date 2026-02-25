# Backend API Reference

This document describes the HTTP API surface exposed by the frontend backend
(`src/app/api`).  The routes are intentionally thin stubs in the current code
base; they exist primarily for analytics hooks and development/testing.

Each entry includes the HTTP method, path, expected request body (if any), and
an example response.  All endpoints return JSON.

---

## `POST /api/commitments`

Creates a new commitment.  In the stub implementation, no persistence occurs;
this route is mainly used to log `CommitmentCreated` analytics events.

- **Request body**: arbitrary JSON with commitment parameters (amount, term,
etc.)
- **Response**: stub message with the requester IP.

### Example

```bash
curl -X POST http://localhost:3000/api/commitments \
     -H 'Content-Type: application/json' \
     -d '{"asset":"XLM","amount":100}'
```

```json
{
  "message": "Commitments creation endpoint stub - rate limiting applied",
  "ip": "::1"
}
```

---

## `POST /api/commitments/[id]/settle`

Marks the commitment identified by `id` as settled.  Currently a stub that emits
`CommitmentSettled` events.

- **Path parameter**: `id` (string)
- **Request body**: optional JSON payload with additional details.
- **Response**: stub confirmation message.

### Example

```bash
curl -X POST http://localhost:3000/api/commitments/abc123/settle \
     -H 'Content-Type: application/json' \
     -d '{"finalValue":105}'
```

```json
{
  "message": "Stub settlement endpoint for commitment abc123",
  "commitmentId": "abc123"
}
```

---

## `POST /api/commitments/[id]/early-exit`

Triggers an early exit (with penalty) for the named commitment.  Emits
`CommitmentEarlyExit` events.

- **Path parameter**: `id` (string)
- **Request body**: optional JSON with penalty or reason.
- **Response**: stub message.

### Example

```bash
curl -X POST http://localhost:3000/api/commitments/abc123/early-exit \
     -H 'Content-Type: application/json' \
     -d '{"reason":"user-request"}'
```

```json
{
  "message": "Stub early-exit endpoint for commitment abc123",
  "commitmentId": "abc123"
}
```

---

## `POST /api/attestations`

Records an attestation event.  Stub implementation logs
`AttestationReceived`.

- **Request body**: JSON describing the attestation (e.g. signature,
commitmentId).
- **Response**: stub message with requester IP.

### Example

```bash
curl -X POST http://localhost:3000/api/attestations \
     -H 'Content-Type: application/json' \
     -d '{"commitmentId":"abc123","status":"valid"}'
```

```json
{
  "message": "Attestations recording endpoint stub - rate limiting applied",
  "ip": "::1"
}
```

---

## `GET /api/metrics`

Simple health/metrics endpoint used by monitoring tools.

- **Response**: JSON object containing uptime, mock request/error counts, and
current timestamp.

### Example

```bash
curl http://localhost:3000/api/metrics
```

```json
{
  "status": "up",
  "uptime": 123.456,
  "mock_requests_total": 789,
  "mock_errors_total": 2,
  "timestamp": "2026-02-25T00:00:00.000Z"
}
```

---

> 🔧 _This reference will grow as the backend implements real business logic._

```