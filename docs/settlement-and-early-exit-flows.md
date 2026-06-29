# Settlement and Early Exit UI Flows

This document describes the user-facing settlement and early-exit flows in the CommitLabs frontend. It ties the visible states to the modal components and API routes so product, frontend, and API changes stay aligned.

## Source Files

- `src/components/modals/SettlementModal.tsx`
- `src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.tsx`
- [test-settle.md](testing/test-settle.md)
- Settlement endpoints: `POST /api/commitments/[id]/settle` and settlement preview/status routes when present in the commitment detail flow
- Early-exit endpoints: `POST /api/commitments/[id]/early-exit` and `POST /api/commitments/[id]/early-exit/preview`

## Settlement Flow

The settlement UI represents two high-level states through `SettlementModalState`:

- `ineligible`: settlement cannot be completed yet or cannot be retried for the current commitment state.
- `settled`: settlement completed and the UI can show the final `settlementAmount`.

The ineligible state is intentionally specific. `getSettlementIneligibleReasonCopy(reason)` maps backend or orchestration copy into a stable reason category, tone, badge, title, message, and CTA label. Keep this mapping synchronized with API error messages so users see actionable guidance instead of a generic failure.

| Category | Tone | User Meaning | Typical Next Action |
| --- | --- | --- | --- |
| `not_matured` | `temporary` | The commitment has not reached maturity yet. | Return later and retry settlement after maturity. |
| `already_settled` | `terminal` | Settlement already completed for this commitment. | Review the settlement details rather than retrying. |
| `disputed` | `terminal` | A dispute or violation state prevents normal settlement. | Review the commitment detail page for dispute handling. |
| `early_exit` | `terminal` | The commitment was already closed by early exit. | Review exit details; do not offer settlement again. |
| `unknown` | `unknown` | The UI could not classify the backend reason. | Show a review-oriented message and avoid destructive action. |

### Settlement API Contract

`POST /api/commitments/[id]/settle` settles a matured commitment and returns final funds to the owner. [test-settle.md](testing/test-settle.md) documents the current response shape:

```json
{
  "ok": true,
  "data": {
    "commitmentId": "test-id",
    "settlementAmount": "1000.50",
    "finalStatus": "SETTLED",
    "txHash": "abc123...",
    "reference": "TODO_CHAIN_CALL_SETTLE_COMMITMENT",
    "settledAt": "2026-02-26T11:30:00.000Z"
  }
}
```

Expected error cases include:

- `400 BAD_REQUEST`: commitment has not matured yet.
- `409 CONFLICT`: commitment has already been settled.
- `404 NOT_FOUND`: commitment id does not exist.

When these messages change, update `getSettlementIneligibleReasonCopy` and this document in the same PR.

## Early Exit Flow

The early-exit modal is intentionally stricter than a normal confirmation dialog because it records an irreversible on-chain action and may deduct a penalty.

The modal displays:

- `originalAmount`: the committed amount before exit.
- `penaltyPercent`: the penalty rate presented to the user.
- `penaltyAmount`: the amount deducted immediately.
- `netReceiveAmount`: the amount returned after the penalty.

The confirmation safeguards are:

1. The user must acknowledge the irreversible effects with the checkbox.
2. The user must type the exact `commitmentId` into the confirmation field.
3. The confirm button remains disabled until both safeguards pass.

The warning copy should continue to communicate that the user loses the penalty amount immediately, the commitment is recorded as an early exit on-chain, the action cannot be reversed, and future yield is forfeited.

### Penalty Preview and Grace Period

Use the preview endpoint before showing final early-exit numbers. The preview response should drive the modal fields above so the user can compare the committed amount, penalty, and net refund before confirming. If the backend reports a penalty-free grace period, surface that as part of the preview state and keep the final confirmation copy consistent with the actual penalty displayed.

### Early-Exit API Contract

Use the preview route for read-only calculations and the execution route for the irreversible action:

- `POST /api/commitments/[id]/early-exit/preview`: returns penalty and refund figures without changing commitment state.
- `POST /api/commitments/[id]/early-exit`: records the early exit and returns the final transaction/result data.

The execution endpoint should not be called until the modal safeguards are satisfied.

## Documentation Maintenance Checklist

Update this document when any of the following change:

- Settlement API response shape or error messages.
- `getSettlementIneligibleReasonCopy` categories, tones, badges, titles, messages, or CTAs.
- Early-exit preview or execution endpoint paths.
- Penalty, grace-period, or net-refund calculations.
- Confirmation safeguards such as acknowledgement text or type-to-confirm behavior.
