# Create Wizard – Draft Validation

`CreateCommitmentStepConfigure` calls `/api/commitments/validate` in real-time
so server-side errors appear next to the relevant fields before the user
advances to the review step.

---

## Endpoint contract

**POST `/api/commitments/validate`**

### Request body

```json
{
  "ownerAddress": "G...",
  "asset": "XLM",
  "amount": 100,
  "durationDays": 90,
  "maxLossBps": 5000
}
```

| Field | Type | Notes |
|---|---|---|
| `ownerAddress` | `string` | Stellar Ed25519 public key (`G…` format) |
| `asset` | `string` | Asset code (e.g. `XLM`, `USDC`) |
| `amount` | `number` | Positive number |
| `durationDays` | `number` | Integer, validated against `PARAMETER_BOUNDS` |
| `maxLossBps` | `number` | Basis points (percent × 100). `50 %` → `5000` |

### Success response – valid draft

```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": [
      {
        "code": "HIGH_RISK_LOSS_TOLERANCE",
        "message": "Max loss tolerance of 8000 bps is high (>5000 bps).",
        "field": "maxLossBps"
      }
    ]
  }
}
```

### Success response – invalid draft

HTTP 200 with `valid: false` and a non-empty `errors` array.

```json
{
  "success": true,
  "data": {
    "valid": false,
    "errors": [
      {
        "code": "VALIDATION_ERROR",
        "message": "Amount must be a positive number",
        "field": "amount"
      }
    ],
    "warnings": []
  }
}
```

Each error object has:

| Property | Type | Description |
|---|---|---|
| `field` | `string` | Dot-path to the offending input (empty = root) |
| `message` | `string` | User-safe message, safe to render in the UI |
| `code` | `string` | Machine-readable error code |

---

## Component behaviour

`CreateCommitmentStepConfigure` debounces every change in the configure form
by **500 ms** before calling the validate endpoint.

```
user edits field
        │
        ▼  500 ms debounce
POST /api/commitments/validate
        │
  ┌─────┴──────┐
  │ valid=true │  → clear server errors, enable Continue
  │ valid=false│  → map errors to fields, disable Continue
  │ network err│  → clear errors (graceful fallback, do not block user)
  └────────────┘
```

### Field mapping

Errors are keyed by the `field` property and rendered directly below the
matching input:

| API `field` | UI input |
|---|---|
| `amount` | Commitment Amount |
| `durationDays` | Duration |
| `maxLossBps` | Maximum Acceptable Loss |
| `ownerAddress` | (no visible input – wallet address) |
| `asset` | Asset selector |

### Advance guard

The **Continue** button is disabled while:

1. Local validation fails (`isValid` prop is `false`), **or**
2. A server validation request is in-flight (`Validating…` label shown), **or**
3. The last server response returned one or more errors.

A network failure clears server errors and re-enables Continue so transient
connectivity issues never permanently block the user.

### Accessibility

- Each error `<span>` has `role="alert"` so screen readers announce it.
- Inputs with errors get `aria-invalid="true"`.
- Error `<span>` IDs are referenced by the input's `aria-describedby`.

---

## Sending `maxLossBps`

The UI stores max loss as a **percentage** (`maxLossPercent`). The component
converts it to basis points before the request:

```ts
maxLossBps: maxLossPercent * 100
```

So `50 %` is sent as `5000 bps`.
