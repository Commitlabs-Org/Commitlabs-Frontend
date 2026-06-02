# CommitLabs Soroban Contracts

Soroban smart contracts backing the CommitLabs liquidity commitment lifecycle.
The `escrow` contract is the primary on-chain component used by the frontend
and backend services to create, fund, release, refund, and dispute
commitments.

## Workspace layout

```text
contracts/
|-- Cargo.toml
`-- escrow/
    |-- Cargo.toml
    `-- src/
        |-- lib.rs
        `-- test.rs
```

## Escrow lifecycle

The escrow contract manages the on-chain lifecycle of a liquidity commitment.
Assets are deposited under a chosen risk profile and held in escrow until the
commitment matures, is exited early, or is disputed.

### Security: Checks-Effects-Interactions

To prevent reentrancy and similar vulnerabilities when interacting with external tokens, the escrow contract enforces the **Checks-Effects-Interactions** pattern. Specifically, within operations that transfer tokens (`release`, `refund`, and `resolve_dispute`):
1. **Checks**: Validate caller authorization, commitment status, and ledger time.
2. **Effects**: Update the commitment state (e.g., transition `Funded` -> `Released` or `Refunded`) and persist it to storage.
3. **Interactions**: Perform cross-contract calls to the asset's token contract.

This strict ordering guarantees the contract's internal state is fully resolved before execution control is temporarily handed over to external logic.

## EscrowStatus State Machine

### States

| State | Description |
|-------|-------------|
| `Created` | Commitment created but not yet funded. Awaiting owner to deposit assets. |
| `Funded` | Assets locked in escrow. Commitment is actively held and can be released, refunded, or disputed. |
| `Released` | Matured and released to the owner. Principal plus accrued yield returned. Terminal state. |
| `Refunded` | Exited early or resolved via dispute. Principal minus penalty returned. Terminal state. |
| `Disputed` | Under dispute; all transfers frozen pending admin resolution. Intermediate state. |
| `Violated` | Compliance score dropped below violation threshold. Transfers frozen until resolved. Intermediate state. |

### Transition Diagram (ASCII)

```
                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │ fund_escrow()
                           ▼
                    ┌─────────────┐
                    │   FUNDED    │◄─────────────────────────────┐
                    └──┬──┬──┬────┘                              │
                       │  │  │                                   │
        ┌──────────────┘  │  └──────────────┐                   │
        │                 │                 │                   │
        │ release()       │ refund()        │ dispute()         │
        │ (matured)       │ (early exit)    │ (frozen)          │
        │                 │                 │                   │
        ▼                 ▼                 ▼                   │
    ┌─────────┐      ┌─────────┐      ┌──────────┐             │
    │RELEASED │      │REFUNDED │      │ DISPUTED │             │
    └─────────┘      └─────────┘      └────┬─────┘             │
                                            │                   │
                                            │ resolve_dispute() │
                                            │                   │
                                            └───────────────────┘
                                                (release or refund)

    record_attestation() with low score:
    FUNDED ──────────────────────► VIOLATED ──► resolve_dispute() ──► FUNDED or RELEASED/REFUNDED
```

### Transition Table

| From State | To State | Triggered By | Authorized | Preconditions |
|------------|----------|--------------|-----------|---------------|
| `Created` | `Funded` | `fund_escrow()` | Owner | Owner has sufficient balance; asset matches configured token |
| `Funded` | `Released` | `release()` | Any | Ledger time ≥ maturity; yield pool has sufficient balance |
| `Funded` | `Refunded` | `refund()` | Owner | Before maturity (or within grace period); not violated |
| `Funded` | `Refunded` | `refund_partial()` | Owner | Partial withdrawal; remainder stays funded or becomes refunded |
| `Funded` | `Disputed` | `dispute()` | Owner or Admin | Commitment is funded |
| `Funded` | `Violated` | `record_attestation()` | Attestor | Compliance score < violation threshold |
| `Disputed` | `Released` | `resolve_dispute(release_to_owner=true)` | Admin | Dispute exists; yield pool sufficient if matured |
| `Disputed` | `Refunded` | `resolve_dispute(release_to_owner=false)` | Admin | Dispute exists |
| `Violated` | `Released` | `resolve_dispute(release_to_owner=true)` | Admin | Violation exists; yield pool sufficient if matured |
| `Violated` | `Refunded` | `resolve_dispute(release_to_owner=false)` | Admin | Violation exists |

### Lifecycle

```
create_commitment ──► fund_escrow ──► release            (matured: principal back to owner)
                                  └──► refund             (early exit: principal − penalty)
                                  └──► dispute ──► resolve_dispute   (admin adjudication)
```

### Persistent storage TTL strategy

Commitment records and owner-index entries live in persistent Soroban storage, so
they need explicit TTL management for long-duration escrows.

- `save` bumps each `Commitment(id)` entry when its remaining TTL no longer covers the commitment maturity horizon.
- `index_owner` recomputes the latest maturity still referenced by an owner's id list and bumps `OwnerIndex(owner)` to that horizon.
- The target TTL is the remaining time to maturity plus a small post-maturity ledger buffer so release/refund can still execute after the unlock point.
- Bumps are thresholded instead of unconditional to avoid paying rent-extension fees when an entry already has enough TTL.

This keeps active commitments readable for their full lifecycle while keeping
Soroban fee overhead under control.

### Marketplace transfer flow (secondary trading)

## Public entrypoints

| Function | Description |
| --- | --- |
| `initialize(admin, token, fee_recipient, safe_default_penalty_bps, balanced_default_penalty_bps, aggressive_default_penalty_bps)` | One-time setup of admin, escrow token (SAC), fee recipient, and default penalties for each risk profile. |
| `create_commitment(owner, asset, amount, risk, duration_days, penalty_bps)` | Create an unfunded commitment with explicit penalty; returns its `id`. |
| `create_default_commitment(owner, asset, amount, risk, duration_days)` | Create an unfunded commitment using the default penalty for the risk profile; returns its `id`. |
| `fund_escrow(commitment_id)` | Transfer `amount` from owner into the contract (`Created → Funded`). |
| `transfer_ownership(commitment_id, new_owner)` | Transfer marketplace ownership for secondary trading (`Funded` only). Current owner must authorize and the contract updates both `Commitment.owner` and `OwnerIndex`. |
| `release(commitment_id, caller)` | Return principal to owner once matured (`Funded → Released`). |
| `refund(commitment_id)` | Early-exit refund of principal minus `penalty_bps` (`Funded → Refunded`). |
| `dispute(commitment_id, caller, reason)` | Freeze a funded commitment pending admin resolution. |

| `deposit_yield_pool(admin, amount)` | Admin-only deposit of yield tokens into the contract yield pool. |
| `get_yield_pool_balance()` | Read the yield pool balance available for matured release payouts. |
| `release(commitment_id, caller)` | Return principal plus accrued yield to owner once matured (`Funded → Released`). |
| `refund(commitment_id)` | Early-exit refund of principal minus `penalty_bps` (`Funded → Refunded`). |
| `set_grace_period(admin, grace_period_seconds)` | Admin-only configuration of the penalty-free grace window before maturity. |
| `get_grace_period()` | Read the currently configured penalty-free grace period in seconds. |
| `dispute(commitment_id, caller, reason)` | Freeze a funded commitment pending admin resolution. The reason is automatically categorized. |
| `resolve_dispute(commitment_id, release_to_owner)` | Admin-only settlement of a disputed commitment. |
| `get_dispute(commitment_id)` | Read the dispute record for a commitment (category, reason, timestamp, initiator). |
| `get_default_penalty(risk)` | Read the default penalty for a specific risk profile. |
| `record_attestation(commitment_id, attestor, compliance_score)` | Record a 0–100 compliance score. |
| `pause()` | Admin-only emergency pause for write operations. |
| `unpause()` | Admin-only resume for paused contract writes. |
| `is_paused()` | Read the current paused state. |
| `get_commitment(commitment_id)` | Read a single commitment record. |
| `get_user_commitments(owner)` | Read up to `MAX_USER_COMMITMENTS_READ` full `Commitment` records for `owner`. This is the primary backend read path and is intentionally bounded to keep Soroban read responses within practical limits. |
| `get_user_commitment_ids(owner)` | Read all commitment ids for `owner`. The backend uses this as its fallback path when it needs to hydrate records one by one. |
| `get_owner_commitments(owner)` | List commitment ids owned by an address. |
| `get_attestations(commitment_id)` | Retrieve the timeline of `AttestationRecord`s for a commitment. |
| `refund_partial(commitment_id, amount)` | Partial early-exit: withdraw `amount` from the principal, apply the proportional penalty to that portion, keep the remainder escrowed. |
| `set_violation_threshold(threshold)` | Admin-only. Set the compliance score threshold (0–100) below which a funded commitment is auto-violated. 0 disables auto-violation. |
| `get_violation_threshold()` | Read the current violation threshold. |

## Lifecycle event schema

The backend indexer depends on the lifecycle event topics staying stable.
`contracts/escrow/src/lib.rs` includes an explicit comment on the shared helper
that should not be changed without coordinating an indexer update.

### User commitment readers

The backend first tries `get_user_commitments(owner)` so it can read a user's commitments in one typed call. That reader now returns full `Commitment` records directly from the owner index and intentionally caps the response size with `MAX_USER_COMMITMENTS_READ` to avoid oversized Soroban read payloads.

For compatibility and fallback hydration, the contract also keeps an id-only reader at `get_user_commitment_ids(owner)`. The older `get_owner_commitments(owner)` name remains available as a legacy alias for the same owner index.

### `early_exit_commitment` entrypoint details

All primary lifecycle events use the same topic order:

```text
(event_name, owner, commitment_id)
```

- `event_name`: `create_commitment`, `fund_escrow`, `release`, `refund`, `dispute`
- `owner`: the stored commitment owner, even when another authorized actor opens
  the dispute
- `commitment_id`: the unique escrow commitment id

### Event payloads

| Event | Payload fields |
| --- | --- |
| `create_commitment` | `asset`, `amount`, `risk`, `maturity`, `penalty_bps` |
| `fund_escrow` | `asset`, `amount`, `risk` |
| `release` | `asset`, `amount`, `accrued_yield`, `payout`, `risk` |
| `refund` | `asset`, `amount`, `refunded_amount`, `penalty`, `risk` |
| `dispute` | `asset`, `amount`, `risk`, `reason_category`, `reason_text`, `disputed_by` |
| `resolve_dispute` | `asset`, `amount`, `payout`, `penalty`, `risk`, `release_to_owner` |

This schema makes it possible to index by owner/id from topics while still
including risk profile and amount in the event data for downstream analytics.

## Yield model

Accrued yield is computed at commitment creation using annualized basis-point
rates:

- `Safe`: `500` bps
- `Balanced`: `700` bps
- `Aggressive`: `1000` bps

The admin must fund the yield pool before matured releases can pay yield.

## Testing

`RiskProfile` is `Safe | Balanced | Aggressive`, matching the frontend
`CommitmentType`. The early-exit penalty is supplied at creation time in basis
points (`penalty_bps`, max `10_000`) and is paid to the configured fee
recipient on `refund` / adverse `resolve_dispute`.

### Commitment limits

To prevent arithmetic overflow (e.g. during maturity timestamp calculations) and ensure input sanity, the following upper-bound limits are enforced in `create_commitment`:
- **Maximum Amount (`MAX_AMOUNT`)**: `1_000_000_000_000` (1T units)
- **Maximum Duration (`MAX_DURATION_DAYS`)**: `365` days (1 year)
- **Maximum Penalty (`MAX_PENALTY_BPS`)**: `10_000` bps (100%)

Attempts to exceed these limits will return `InvalidAmount` or `InvalidDuration` errors, respectively.


### Errors

Stable numeric error codes (`#[contracterror]`) are surfaced so the backend
`normalizeContractError` mapper can translate them into HTTP responses.

| Code | Variant | Triggered When |
|------|---------|----------------|
| 1 | `AlreadyInitialized` | `initialize()` called more than once |
| 2 | `NotInitialized` | Contract not initialized; admin or token not set |
| 3 | `NotFound` | Commitment id does not exist |
| 4 | `Unauthorized` | Caller not authorized for the operation (e.g., non-owner calling `refund()`) |
| 5 | `InvalidAmount` | Amount is ≤ 0, exceeds `MAX_AMOUNT`, or insufficient balance |
| 6 | `InvalidState` | Commitment in wrong state for the operation (e.g., `refund()` on `Released`) |
| 7 | `NotMatured` | `release()` called before maturity timestamp |
| 8 | `InvalidDuration` | Duration is 0, exceeds `MAX_DURATION_DAYS`, or causes timestamp overflow |
| 9 | `PenaltyTooHigh` | Penalty exceeds `MAX_PENALTY_BPS` (10,000 basis points = 100%) |
| 10 | `Paused` | Contract is paused; write operations blocked |
| 11 | `AssetMismatch` | Commitment asset does not match configured escrow token |
| 12 | `InsufficientYieldPool` | Yield pool balance insufficient to pay matured commitment yield |
| 13 | `InvalidWasmHash` | WASM hash provided for upgrade is zero or invalid |
| 14 | `CommitmentViolated` | Commitment in `Violated` status; release and refund blocked until resolved |

### Error Handling Best Practices

- **InvalidState**: Check commitment status before calling state-transition functions. Use `get_commitment()` to verify current state.
- **NotMatured**: For `release()`, check the commitment's maturity timestamp against the current ledger time.
- **InsufficientYieldPool**: Ensure the admin has deposited sufficient yield via `deposit_yield_pool()` before matured commitments are released.
- **CommitmentViolated**: If a commitment is violated, the admin must call `resolve_dispute()` to transition it back to a usable state.
- **Paused**: If the contract is paused, wait for the admin to call `unpause()` before retrying write operations.

## Keeping This Document in Sync

This README documents the escrow contract's state machine, authorization model, and error codes. It must be updated whenever:

- A new `EscrowStatus` variant is added or removed
- A new public entrypoint is added or removed
- Authorization rules change (e.g., a function becomes admin-only)
- New error codes are added to the `#[contracterror]` enum
- State transitions change (e.g., a function now transitions to a different state)

**Cross-reference**: `contracts/escrow/src/lib.rs` (source of truth for all contract logic)  
**Test coverage**: `contracts/escrow/src/test.rs` (validates state transitions and authorization)

## Build & test

Requires the `stellar` CLI (v23) and the `wasm32v1-none` / `wasm32-unknown-unknown`
target.

```bash
cargo test
```

The lifecycle event tests assert:

- stable topic ordering
- stable event names
- risk/amount fields in payloads
- event emission across create, fund, release, refund, and dispute
