# CommitLabs Soroban Contracts

Soroban (Rust) smart-contract workspace backing the CommitLabs liquidity commitment protocol. The frontend and backend service layer interact with the escrow contract through Stellar Soroban RPC, so this document treats `contracts/escrow/src/lib.rs` as the source of truth and cross-checks behavior against `contracts/escrow/src/test.rs`.

## Workspace Layout

```text
contracts/
|-- Cargo.toml                    # Cargo workspace; member: escrow
|-- escrow/
|   |-- Cargo.toml                # commitlabs-escrow crate
|   `-- src/
|       |-- lib.rs                # EscrowContract implementation, types, errors
|       `-- test.rs               # Contract unit tests and lifecycle examples
`-- scripts/
    |-- deploy-testnet.sh         # Build, deploy, initialize helper
    `-- deploy-testnet.smoke.mjs  # Dry-run smoke validation
```

## Escrow Lifecycle

The escrow contract manages a liquidity commitment from creation through funding, settlement, early exit, dispute handling, ownership transfer, or compliance violation freeze.

```text
create_commitment/create_commitment_default
  -> fund_escrow
    -> release OR settle_commitment
    -> refund OR early_exit_commitment OR refund_partial
    -> dispute -> resolve_dispute
    -> transfer_ownership -> later release/refund/dispute by the new owner
    -> record_attestation below threshold -> Violated -> resolve_dispute
```

### State Machine

| State | Meaning | Allowed next actions |
| --- | --- | --- |
| `Created` | Commitment exists but funds have not been transferred into escrow. | `fund_escrow` |
| `Funded` | Principal is locked and the commitment is active. | `release`, `settle_commitment`, `refund`, `early_exit_commitment`, `refund_partial`, `dispute`, `record_attestation`, `transfer_ownership` |
| `Released` | Matured commitment paid principal plus accrued yield to the owner. Terminal. | None |
| `Refunded` | Early exit/refund paid principal minus penalty, unless grace period waived it. Terminal. | None |
| `Disputed` | Owner or admin froze the funded commitment pending admin resolution. | `resolve_dispute` |
| `Violated` | `record_attestation` observed a score below `ViolationThreshold`; transfers are frozen pending admin resolution. | `resolve_dispute` |

### Entrypoints

| Entrypoint | Authorization | State requirements and effects |
| --- | --- | --- |
| `initialize(admin, token, fee_recipient, safe_default_penalty_bps, balanced_default_penalty_bps, aggressive_default_penalty_bps)` | `admin` auth | One-time setup. Stores admin, escrow token, fee recipient, default risk-profile penalties, `NextId`, and zero-second grace period. |
| `create_commitment(owner, asset, amount, risk, duration_days, penalty_bps, metadata)` | `owner` auth | Creates `Created` commitment after validating `amount`, `duration_days`, and `penalty_bps`; indexes it under the owner. |
| `create_commitment_default` / `create_commitment_with_default` | `owner` auth | Same as `create_commitment`, but reads the default penalty for `risk`. |
| `fund_escrow(commitment_id)` | Commitment owner auth | Requires `Created`; transfers `amount` from owner to contract; moves to `Funded`. |
| `release(commitment_id)` | No owner auth required | Requires `Funded` and ledger timestamp at or after maturity; pays principal plus accrued yield to owner; moves to `Released`. |
| `settle_commitment(commitment_id, caller)` | `caller` auth | ABI alias for matured release used by the backend. Returns `SettlementResult { settlementAmount, finalStatus }`. |
| `refund(commitment_id)` | Commitment owner auth | Requires `Funded`; applies early-exit penalty unless inside `GracePeriodSeconds`; moves to `Refunded`. |
| `early_exit_commitment(commitment_id, caller)` | `caller` auth | Backend-facing early-exit alias around refund semantics. Returns `EarlyExitResult { exitAmount, penaltyAmount, finalStatus }`. |
| `refund_partial(commitment_id, amount)` | Commitment owner auth | Partial early exit on a funded commitment; remaining principal stays funded unless fully withdrawn. |
| `dispute(commitment_id, caller, reason)` | Owner or admin auth | Requires `Funded`; stores a `DisputeRecord`, categorizes the reason, and moves to `Disputed`. |
| `resolve_dispute(commitment_id, release_to_owner)` | Admin auth | Resolves `Disputed` or `Violated` commitments. If `release_to_owner` is true, pays owner; otherwise refunds/penalizes according to the dispute path. |
| `transfer_ownership(commitment_id, new_owner)` | Current owner auth | Requires `Funded`; updates `Commitment.owner`, removes the id from the old `OwnerIndex`, adds it to the new owner index, and keeps status `Funded`. |
| `record_attestation(commitment_id, attestor, score)` | `attestor` auth | Records score history. If `score < ViolationThreshold` while funded, moves status to `Violated` and emits a violation event. |
| `deposit_yield_pool(admin, amount)` | Admin auth | Transfers tokens from admin into the contract yield pool for matured release payouts. |
| `pause` / `unpause` | Admin auth | Toggles write-operation pause flag. Mature `release` remains available while paused. |
| Read methods | None | `get_commitment`, `get_user_commitments`, `get_user_commitment_ids`, `get_user_commitment_ids_page`, `get_owner_commitments`, `get_attestations`, `get_dispute`, `get_default_penalty`, `get_yield_pool_balance`, `get_grace_period`, `get_violation_threshold`, `is_paused`. |

## Configuration Surface

| Setting | Storage / source | Behavior |
| --- | --- | --- |
| `GracePeriodSeconds` | `set_grace_period(admin, seconds)`; default `0` after `initialize` | When non-zero, a refund at `maturity - GracePeriodSeconds <= now < maturity` waives the early-exit penalty. |
| `ViolationThreshold` | `set_violation_threshold(admin, threshold)` and `get_violation_threshold()` | Attestation scores below this value auto-freeze funded commitments as `EscrowStatus::Violated`. |
| Safe default penalty | `initialize(..., safe_default_penalty_bps, ...)` | Used by default-penalty creation for `RiskProfile::Safe`; tests initialize it to `200` bps. |
| Balanced default penalty | `initialize(..., balanced_default_penalty_bps, ...)` | Used by default-penalty creation for `RiskProfile::Balanced`; tests initialize it to `300` bps. |
| Aggressive default penalty | `initialize(..., aggressive_default_penalty_bps)` | Used by default-penalty creation for `RiskProfile::Aggressive`; tests initialize it to `500` bps. |
| `MAX_AMOUNT` | `1_000_000_000_000` | Maximum commitment principal accepted by `create_commitment`. |
| `MAX_DURATION_DAYS` | `365` | Maximum duration accepted by `create_commitment`. |
| `MAX_PENALTY_BPS` | `10_000` | Maximum penalty basis points, where `10_000` is 100%. |
| Yield rates | `yield_rate_bps` / `calculate_accrued_yield` | Safe: 500 bps annualized, Balanced: 700 bps, Aggressive: 1000 bps. |
| Yield pool | `deposit_yield_pool` / `get_yield_pool_balance` | Matured `release`/`settle_commitment` payouts require enough pool balance for accrued yield, otherwise they return `InsufficientYieldPool`. |

## Worked Refund and Grace-Period Example

The test suite's `refund_within_grace_period_is_penalty_free` covers the intended grace-window behavior:

1. Admin calls `set_grace_period(admin, SECONDS_PER_DAY)`, configuring a one-day window.
2. Owner creates a 30-day aggressive commitment for `1_000` units with a `500` bps penalty.
3. Owner funds the escrow, moving it to `Funded`.
4. Ledger time advances to day 29, exactly one day before maturity.
5. Owner calls `refund(commitment_id)`.
6. Because the current time is inside the configured grace window, the penalty is `0`, owner receives the full `1_000`, fee recipient receives `0`, and commitment becomes `Refunded`.

Outside the grace window, the same 500 bps early exit returns `950` to the owner and sends `50` to the fee recipient, as covered by `refund_outside_grace_period_still_applies_penalty` and the default-penalty refund tests.

## Violation Path

`record_attestation(commitment_id, attestor, score)` appends an `AttestationRecord` with the attestor, score, and ledger timestamp. If a funded commitment receives a score below `ViolationThreshold`, the contract sets `EscrowStatus::Violated` and emits a violation event. A violated commitment is frozen until an admin calls `resolve_dispute` to release or refund it. Integrators should read the commitment status before presenting settlement or early-exit actions.

## Ownership Transfer Path

`transfer_ownership(commitment_id, new_owner)` supports secondary-market ownership handoff without settling funds. It is owner-authorized, requires the commitment to be `Funded`, updates `Commitment.owner`, removes the id from the previous owner's index, adds it to `new_owner`'s index, emits `transfer_ownership`, and leaves all economics and maturity terms unchanged.

## Stable Error Codes

The `Error` enum in `contracts/escrow/src/lib.rs` is `#[repr(u32)]`; these numeric codes are stable for backend normalization in `src/lib/backend/services/contracts.ts` and for RPC clients that only receive numeric contract errors.

| Code | Error | Meaning |
| --- | --- | --- |
| 1 | `AlreadyInitialized` | `initialize` was called after setup already completed. |
| 2 | `NotInitialized` | Required instance storage, such as admin/token/default config, is missing. |
| 3 | `NotFound` | Commitment id or required record does not exist. |
| 4 | `Unauthorized` | Caller is not the owner/admin/authorized account for the action. |
| 5 | `InvalidAmount` | Amount is zero, negative, above `MAX_AMOUNT`, or arithmetic would overflow. |
| 6 | `InvalidState` | Action is not valid for the commitment's current status. |
| 7 | `NotMatured` | Release or settlement was requested before maturity. |
| 8 | `InvalidDuration` | Duration is zero or above `MAX_DURATION_DAYS`. |
| 9 | `PenaltyTooHigh` | Penalty exceeds `MAX_PENALTY_BPS`. |
| 10 | `InsufficientYieldPool` | Yield pool cannot cover accrued yield for a mature release. |
| 11 | `Paused` | Write operation was attempted while contract writes are paused. |

Backend callers should use the normalized `BackendError` response shape and preserve method context in details. Contract errors that cannot be parsed should still be surfaced as `BLOCKCHAIN_CALL_FAILED` with the method name so API consumers can distinguish RPC/configuration failures from business-rule failures.

## Deployment Flow

`contracts/scripts/deploy-testnet.sh` builds from `contracts/Cargo.toml`, deploys the WASM to Stellar testnet, invokes `initialize`, and upserts the deployed id into the configured frontend env file.

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `STELLAR_ACCOUNT` | CLI source account used for build/deploy/invoke signing. |
| `COMMITLABS_ADMIN_ADDRESS` | Admin `G...` address passed to `initialize`. |
| `COMMITLABS_TOKEN_CONTRACT_ID` | Token `C...` contract id passed to `initialize`. |
| `COMMITLABS_FEE_RECIPIENT_ADDRESS` | Fee recipient `G...` address passed to `initialize`. |

Optional overrides include `STELLAR_RPC_URL`, `STELLAR_NETWORK_PASSPHRASE`, `COMMITLABS_ENV_FILE`, `COMMITLABS_CONTRACT_MANIFEST`, `COMMITLABS_CONTRACT_PACKAGE`, `COMMITLABS_WASM_PATH`, `COMMITLABS_CONTRACT_ALIAS`, and `DRY_RUN`.

Dry run:

```bash
DRY_RUN=1 \
STELLAR_ACCOUNT=deployer \
COMMITLABS_ADMIN_ADDRESS=G... \
COMMITLABS_TOKEN_CONTRACT_ID=C... \
COMMITLABS_FEE_RECIPIENT_ADDRESS=G... \
./contracts/scripts/deploy-testnet.sh
```

Real testnet deploy:

```bash
STELLAR_ACCOUNT=deployer \
COMMITLABS_ADMIN_ADDRESS=G... \
COMMITLABS_TOKEN_CONTRACT_ID=C... \
COMMITLABS_FEE_RECIPIENT_ADDRESS=G... \
./contracts/scripts/deploy-testnet.sh
```

Security notes:

- Keep secrets out of scripts and source control.
- Export signer secrets only in the active shell session.
- Review generated env changes before committing.

## Build and Test

Requires the Stellar CLI and the `wasm32v1-none` / `wasm32-unknown-unknown` Rust targets.

```bash
cd contracts
cargo test
stellar contract build
```

For deploy-script smoke coverage from the repository root:

```bash
npm run test:contracts:deploy
```