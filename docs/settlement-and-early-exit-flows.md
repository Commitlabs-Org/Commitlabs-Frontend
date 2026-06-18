# Settlement and Early-Exit Flows

This document describes the current user-facing settlement and early-exit flows, the
API routes each state depends on, and the error reasons the UI should surface.

## Settlement Flow

Settlement closes a matured commitment and returns the final funds to the owner.
The flow is split into a non-mutating preview step and a write step.

| Step | Surface | Route or component | Notes |
| --- | --- | --- | --- |
| Preview eligibility | Commitment details or dashboard action | `GET /api/commitments/[id]/settle/preview` | Returns `eligible`, `reason`, and `estimatedSettlement` without mutating chain state. |
| Explain blocked state | Settlement modal | `src/components/modals/SettlementModal.tsx` | `getSettlementIneligibleReasonCopy` maps backend reasons into temporary, terminal, or review-required UI copy. |
| Execute settlement | First-party mutation route | `POST /api/commitments/[id]/settle` | Requires mutation CSRF protection, rate limiting, optional `callerAddress`, and owner validation when the caller address is present. |
| Record outcome | Backend logging | `logCommitmentSettled` | Logs commitment id, caller address, settlement amount, final status, transaction hash, and request context. |

### Settlement States

| State | Trigger | User copy direction | Retry guidance |
| --- | --- | --- | --- |
| Eligible | Preview returns `eligible: true` | Show estimated settlement and allow the settle action. | User may proceed. |
| Not matured | Reason contains `not matured` or `matured yet` | Temporary blocker: commitment is still active. | Retry after maturity. |
| Already settled | Reason contains `already settled` | Terminal state: commitment is already closed. | Link to settlement details. |
| Disputed or violated | Reason contains `disputed`, `violated`, or a terminal `cannot be settled` response | Terminal state: settlement cannot proceed. | Link to commitment or dispute details. |
| Exited early | Reason contains `early` and `exit` | Terminal state: commitment has already closed through early exit. | Link to exit details. |
| Unknown | Reason does not match a known class | Review-required state. | Ask the user to inspect commitment details before retrying. |

### Settlement API References

- `src/app/api/commitments/[id]/settle/preview/route.ts`
- `src/app/api/commitments/[id]/settle/route.ts`
- `src/lib/backend/services/contracts.ts` (`settleCommitmentOnChain`)
- `docs/backend-api-reference.md`
- `test-settle.md`

## Early-Exit Flow

Early exit lets an owner close an active commitment before maturity, with a
penalty. The flow emphasizes preview, acknowledgement, typed confirmation, and
owner-only mutation.

| Step | Surface | Route or component | Notes |
| --- | --- | --- | --- |
| Preview penalty | Commitment detail action | `GET /api/commitments/[id]/early-exit/preview` | Calculates principal, penalty percent, penalty amount, and net refund from protocol tiers. |
| Warn user | Early-exit modal | `src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.tsx` | Shows committed amount, penalty, net refund, consequences, acknowledgement, and exact commitment-id confirmation. |
| Execute early exit | First-party mutation route | `POST /api/commitments/[id]/early-exit` | Requires authenticated session, caller address match, on-chain ownership, rate limiting, and optional idempotency replay. |
| Record outcome | Backend logging | `logEarlyExit` | Logs commitment id, caller address, reason, exit amount, penalty amount, and request context. |

### Early-Exit States

| State | Trigger | User copy direction | Retry guidance |
| --- | --- | --- | --- |
| Preview available | Commitment exists and is not settled | Show penalty breakdown before allowing confirmation. | User may proceed after acknowledgement and exact id entry. |
| Missing or invalid id | Empty path id or missing commitment | Return a 400 or 404-style error from the API. | User must reopen from a valid commitment. |
| Already settled | Commitment status is `SETTLED` | Terminal state: settlement already closed it. | Do not retry early exit. |
| Already early-exited | Commitment status is `EARLY_EXIT` | Terminal state: early exit already closed it. | Do not retry early exit. |
| Violated | Commitment status is `VIOLATED` | Terminal state: commitment cannot be exited early. | Link to commitment details. |
| Authorization failure | Session address, caller address, or owner address mismatch | Explain that only the owner can exit. | User must connect the owning wallet. |
| Chain failure or timeout | Contract call fails or times out | Show stable backend error envelope and correlation id. | User may retry only after confirming transaction state. |

### Early-Exit Safeguards

- Preview is read-only and rate-limited to protect the RPC layer.
- The mutation route requires a valid session cookie and first-party CORS.
- `callerAddress` must match the authenticated session address.
- The caller must match the on-chain commitment owner.
- The modal requires both an acknowledgement checkbox and exact commitment ID entry.
- Idempotency support prevents duplicate mutation processing for repeated submissions.

### Early-Exit API References

- `src/app/api/commitments/[id]/early-exit/preview/route.ts`
- `src/app/api/commitments/[id]/early-exit/route.ts`
- `src/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal.tsx`
- `src/lib/backend/services/contracts.ts` (`earlyExitCommitmentOnChain`)
- `docs/backend-api-reference.md`

## Error Reason Mapping

Settlement-specific reason text is normalized by
`getSettlementIneligibleReasonCopy` in `src/components/modals/SettlementModal.tsx`.
Keep new backend reason strings compatible with these categories or extend the
mapping in the same PR.

| Backend signal | UI category | Tone |
| --- | --- | --- |
| `not matured`, `matured yet` | `not_matured` | Temporary |
| `already been settled`, `already settled` | `already_settled` | Terminal |
| `violated`, `disputed`, terminal `cannot be settled` | `disputed` | Terminal |
| `early` + `exit` | `early_exit` | Terminal |
| Any other reason | `unknown` | Review required |

## Documentation Maintenance Checklist

When changing settlement or early-exit behavior:

1. Update `docs/backend-api-reference.md` for request and response shape changes.
2. Update this document for state, endpoint, or modal-copy changes.
3. Update `DEVELOPER_GUIDE.md` if contributor workflow or validation commands change.
4. Keep `README.md` feature status aligned with the shipped route and UI surfaces.
5. Include manual verification notes or relevant test output in the pull request.
