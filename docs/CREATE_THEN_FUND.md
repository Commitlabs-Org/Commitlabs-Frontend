# CREATE_THEN_FUND — Two-Step Commitment Lifecycle

This document describes the two-step lifecycle for creating and funding a
Commitlabs escrow commitment, and the UX flow that guides users through it.

---

## Overview

The backend enforces a two-phase lifecycle for every commitment:

| Phase | Status | Description |
|-------|--------|-------------|
| **1 — Created** | `CREATED` | Commitment record exists on-chain; escrow is empty. Yield does not accrue yet. |
| **2 — Funded** | `ACTIVE` | Escrow has been funded; yield accrual and compliance monitoring begin. |

Without completing Phase 2, a commitment is permanently in the `CREATED` state
and never earns yield or becomes tradeable on the marketplace.

---

## API Contract

### Fund endpoint

```
POST /api/commitments/:id/fund
Content-Type: application/json

{
  "callerAddress": "<optional stellar address of connected wallet>"
}
```

**Success (200)**

```json
{
  "data": {
    "commitmentId": "CMT-ABC1234",
    "txHash": "0x...",
    "reference": "...",
    "fundedAt": "2026-06-27T08:00:00.000Z"
  }
}
```

**Error codes handled by the UI**

| Status | Meaning | UI behaviour |
|--------|---------|--------------|
| 200 | Funded | Transition to `success` state, show `txHash` |
| 409 | Already funded | Treated as success (idempotent) |
| 403 | Caller is not the owner | Error panel with ownership message |
| 429 | Rate-limited | Error panel with retry guidance |
| 4xx / 5xx | Validation / server error | Error panel with server message |
| network | Fetch threw | Error panel with JS error message |

**Idempotency:** The route supports an optional `Idempotency-Key` header. The
frontend does not currently set this header, but it can be added in the
`handleFund` function inside `CommitmentCreatedModal.tsx` if needed.

---

## UX Flow

```
┌─────────────────────────────┐
│      Create Wizard          │
│  Step 1 → Step 2 → Step 3  │
│         (Review)            │
└─────────────┬───────────────┘
              │  handleSubmit → POST /api/commitments
              ▼
┌─────────────────────────────┐
│  CommitmentCreatedModal     │
│  fundStep = "idle"          │◄──── modal opens automatically
│                             │
│  [Fund Now]  [Fund Later]   │
└──────┬──────────┬───────────┘
       │          │
  Fund Now    Fund Later
       │          │
       ▼          ▼
  "funding"   "skipped" ──────────────► /commitments/:id
       │                                (detail page allows
       │                                 retry any time)
  ┌────┴────┐
  │  fetch  │  POST /api/commitments/:id/fund
  └────┬────┘
       │
   ┌───┴────────────┐
 ok/409           error
   │                │
   ▼                ▼
"success"        "error"
   │                │
[View]        [Retry] [Fund Later]
   │
   ▼
/commitments/:id
```

### State machine

```
idle ──► funding ──► success
  ▲          │
  │        error
  └──────────┘  (retry resets to idle)

idle ──► skipped  (Fund Later clicked)
error ──► skipped (Fund Later clicked from error panel)
```

---

## Component API

### `CommitmentCreatedModal` — new props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `callerAddress` | `string \| undefined` | `undefined` | Connected wallet address forwarded to the fund API for ownership validation. |
| `onFundLater` | `() => void \| undefined` | `undefined` | If provided, shows the "Fund Later" button. Called when the user skips. |

All pre-existing props (`isOpen`, `commitmentId`, `onViewCommitment`,
`onCreateAnother`, `onClose`, `onViewOnExplorer`) are unchanged.

### `create/page.tsx` — additions

- `callerAddress` constant — currently `undefined`; replace with the value
  from your wallet hook (e.g. `useWallet().address`) once wallet integration
  is complete.
- `handleFundLater` — closes the modal and navigates to
  `/commitments/:numericId` so the user can fund from the detail page.

---

## Skip and Resume

Skipping funding is always reversible. When the user skips:

1. The modal transitions to the `skipped` state showing a reminder banner.
2. `onFundLater()` is called — in `create/page.tsx` this navigates to the
   commitment detail page (`/commitments/:id`).
3. On the detail page the user can initiate funding separately (that
   integration is outside the scope of this feature but follows the same
   `POST /api/commitments/:id/fund` call).

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Network unreachable | Error panel with `err.message`; retry available |
| 403 Forbidden | Specific ownership message; user may still skip |
| 409 Conflict (already funded) | Silently treated as success; no user interruption |
| 429 Too Many Requests | Message asks user to wait; retry available |
| JSON parse failure on response | Gracefully ignored; falls back to status-code message |

---

## Accessibility

- The modal is mounted via `createPortal` to `document.body`, ensuring it sits
  at the top of the stacking context.
- Focus is set to the primary action button 100 ms after open.
- A focus trap cycles focus within the modal using `Tab` / `Shift+Tab`.
- `Escape` closes the modal in all states.
- `aria-live="polite"` on the loading and success panels announces transitions
  to screen readers without interrupting current speech.
- `aria-live="assertive"` on the error panel announces failures immediately.
- All interactive elements have descriptive `aria-label` attributes.
- Buttons are `disabled` during the `funding` state to prevent duplicate submissions.

---

## Testing

Tests live in `src/components/modals/CommitmentCreatedModal.test.tsx` and cover:

- Initial idle state rendering
- Loading / spinner state
- Successful fund (200)
- Already-funded (409) treated as success
- Network error → error panel
- 403 ownership error message
- Skip / Fund Later → skipped state + `onFundLater` callback
- `onFundLater` button hidden when prop absent
- Retry flow (error → retry → success)
- `onViewCommitment` triggered after success
- `onCreateAnother` trigger
- Keyboard: Escape closes modal
- Backdrop click closes modal
- `aria-live` region present after fund action
- Body scroll locked while modal is open
- Not rendered when `isOpen` is false
- Stellar Explorer link conditional
- Fund state resets when `commitmentId` changes

Run with:

```bash
npx vitest run src/components/modals/CommitmentCreatedModal.test.tsx
```

Or as part of the full suite:

```bash
npx vitest run
```
