# CommitLabs Soroban Contracts

Soroban (Rust) smart-contract workspace backing the CommitLabs liquidity commitment protocol. The frontend and backend service layer interact with the escrow contract through Stellar Soroban RPC, so this document treats `contracts/escrow/src/lib.rs` as the source of truth and cross-checks behavior against the focused tests in `contracts/escrow/src/test_funding_window.rs`, `contracts/escrow/src/test_yield_reserve.rs`, and `contracts/escrow/src/test_penalty_math.rs`.

## Workspace Layout

```text
contracts/
|-- Cargo.toml                    # Cargo workspace; member: escrow
|-- escrow/
|   |-- Cargo.toml                # commitlabs-escrow crate
|   `-- src/
|       |-- lib.rs                # EscrowContract implementation, types, errors
|       |-- test_funding_window.rs # Funding-time maturity, expiry, and cancellation tests
|       |-- test_penalty_math.rs   # Penalty rounding and minimum partial-withdrawal tests
|       `-- test_yield_reserve.rs # Yield-pool reservation accounting tests
`-- scripts/
    |-- deploy-testnet.sh         # Build, deploy, initialize helper
    `-- deploy-testnet.smoke.mjs  # Dry-run smoke validation
```

## Testnet Deployment

The escrow contract is deployed on Stellar **testnet**: [`CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4`](https://stellar.expert/explorer/testnet/contract/CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4) (see [DEPLOYMENTS.md](../DEPLOYMENTS.md)).

Build and invoke:

```bash
cd contracts && stellar contract build
stellar contract invoke --id CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4 --source-account <KEY> --network testnet -- get_default_penalty --risk Balanced
stellar contract invoke --id CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4 --source-account <KEY> --network testnet -- create_commitment --owner <ADDR> --asset CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC --amount 10000000 --risk Balanced --duration_days 30 --penalty_bps 500 --metadata '{"name":"demo"}'
stellar contract invoke --id CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4 --source-account <KEY> --network testnet -- fund_escrow --commitment_id 0
```

Note: commitment ids start at 0. The function reference is the Entrypoints table above, which matches the contract's public functions in `escrow/src/lib.rs`.

## Escrow Lifecycle

The escrow contract manages a liquidity commitment from creation through funding, settlement, early exit, dispute handling, ownership transfer, or compliance violation freeze.

```text
create_commitment/create_commitment_default
  -> fund_escrow (within 7 days; lock and yield period starts at funding)
    -> release OR settle_commitment
    -> refund OR early_exit_commitment OR refund_partial
    -> dispute -> resolve_dispute
    -> transfer_ownership -> later release/refund/dispute by the new owner
    -> record_attestation below threshold -> Violated -> resolve_dispute
  -> cancel_commitment by owner, or permissionlessly after 7 days -> Cancelled
```

### State Machine

| State      | Meaning                                                                                                          | Allowed next actions                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Created`  | Commitment exists but funds have not been transferred into escrow; funding is allowed for 7 days after creation.   | `fund_escrow`, `cancel_commitment`                                                                                                         |
| `Funded`   | Principal is locked and the commitment is active.                                                                | `release`, `settle_commitment`, `refund`, `early_exit_commitment`, `refund_partial`, `dispute`, `record_attestation`, `transfer_ownership` |
| `Released` | Owner or admin settled a matured commitment; principal plus accrued yield paid to the current owner. Terminal.                                     | None                                                                                                                                       |
| `Refunded` | Early exit/refund paid principal minus penalty, unless grace period waived it. Terminal.                         | None                                                                                                                                       |
| `Disputed` | Owner or admin froze the funded commitment pending admin resolution.                                             | `resolve_dispute`                                                                                                                          |
| `Violated` | `record_attestation` observed a score below `ViolationThreshold`; transfers are frozen pending admin resolution. | `resolve_dispute`                                                                                                                          |
| `Cancelled` | Unfunded commitment was cancelled by its owner or after its funding window expired. Terminal.                    | None                                                                                                                                       |

Creation records the selected lock length in the existing `maturity - created_at` fields. Funding must happen no later than `created_at + FUNDING_WINDOW_SECONDS` (7 days); at funding, maturity is reset to funding time plus that same lock length. This keeps the `Commitment` storage layout unchanged, so records written before this upgrade decode normally and retain their configured lock length. The early-exit grace period is measured against this funding-based maturity.

### Entrypoints

| Entrypoint                                                                                                                        | Authorization          | State requirements and effects                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialize(admin, token, fee_recipient, safe_default_penalty_bps, balanced_default_penalty_bps, aggressive_default_penalty_bps)` | `admin` auth           | One-time setup. Stores admin, escrow token, fee recipient, default risk-profile penalties, `NextId`, and zero-second grace period.                                                                                                                                            |
| `create_commitment(owner, asset, amount, risk, duration_days, penalty_bps, metadata)`                                             | `owner` auth           | Creates `Created` commitment after validating `amount`, `duration_days`, and `penalty_bps`; indexes it under the owner.                                                                                                                                                       |
| `create_commitment_default` / `create_commitment_with_default`                                                                    | `owner` auth           | Same as `create_commitment`, but reads the default penalty for `risk`.                                                                                                                                                                                                        |
| `fund_escrow(commitment_id)`                                                                                                      | Commitment owner auth  | Requires `Created` and funding within 7 days of creation; transfers `amount` from owner to contract, resets maturity to funding time plus the configured lock duration, checks the yield pool can cover `accrued_yield` and reserves it; moves to `Funded`.                                                                                 |
| `cancel_commitment(commitment_id, caller)`                                                                                        | Owner before expiry; permissionless after expiry | Requires `Created`; before expiry, `caller` must be the owner and authorize; after expiry, anyone may cancel. Marks `Cancelled` and removes the id from the owner's index without transferring tokens. |
| `release(commitment_id, caller)`                                                                                                  | Owner or admin auth    | Requires `Funded` and ledger timestamp at or after maturity; consumes the commitment's yield reservation and transfers principal plus accrued yield to the current owner; moves to `Released`.                               |
| `settle_commitment(commitment_id, caller)`                                                                                        | Owner or admin auth    | ABI alias for matured release used by the backend. Returns `SettlementResult { settlementAmount, finalStatus }`.                                                                                                                                                              |
| `refund(commitment_id)`                                                                                                           | Commitment owner auth  | Requires `Funded`; applies early-exit penalty unless inside `GracePeriodSeconds`; releases the yield reservation; moves to `Refunded`.                                                                                                                                        |
| `early_exit_commitment(commitment_id, caller)`                                                                                    | `caller` auth          | Backend-facing early-exit alias around refund semantics. Returns `EarlyExitResult { exitAmount, penaltyAmount, finalStatus }`.                                                                                                                                                |
| `refund_partial(commitment_id, amount)`                                                                                           | Commitment owner auth  | Partial early exit on a funded commitment; remaining principal stays funded unless fully withdrawn. Requires `amount >= MIN_PARTIAL_WITHDRAWAL` (`10_000_000` stroops / 1 XLM) and either `remaining == 0` or `remaining >= MIN_REMAINING_PRINCIPAL` (`10_000_000` stroops / 1 XLM), else returns `BelowMinimum`. Computes penalty via ceiling rounding `penalty_for`. The yield reservation is released only when the remaining principal reaches zero. |
| `dispute(commitment_id, caller, reason)`                                                                                          | Owner or admin auth    | Requires `Funded`; stores a `DisputeRecord`, categorizes the reason, and moves to `Disputed`. The yield reservation stays held while frozen.                                                                                                                                   |
| `resolve_dispute(commitment_id, release_to_owner)`                                                                                | Admin auth             | Resolves `Disputed` or `Violated` commitments. If `release_to_owner` is true, pays owner; otherwise refunds/penalizes according to the dispute path. Consumes the reservation on a matured release, and releases it on any yield-forfeiting path.                              |
| `transfer_ownership(commitment_id, new_owner)`                                                                                    | Current owner auth     | Requires `Funded`; updates `Commitment.owner`, removes the id from the old `OwnerIndex`, adds it to the new owner index, and keeps status `Funded`.                                                                                                                           |
| `record_attestation(commitment_id, attestor, score)`                                                                              | `attestor` auth        | Records score history. If `score < ViolationThreshold` while funded, moves status to `Violated` and emits a violation event.                                                                                                                                                  |
| `deposit_yield_pool(admin, amount)`                                                                                               | Admin auth             | Transfers tokens from admin into the contract yield pool for matured release payouts.                                                                                                                                                                                         |
| `withdraw_yield_pool(to, amount)`                                                                                                 | Admin auth             | Transfers only the available (unreserved) yield-pool surplus to `to`; reverts with `InsufficientYieldPool` above it. Emits `withdraw_yield_pool`.                                                                                                                              |
| `pause` / `unpause`                                                                                                               | Admin auth             | Toggles write-operation pause flag. Mature `release` remains available while paused.                                                                                                                                                                                          |
| Read methods                                                                                                                      | None                   | `get_commitment`, `get_user_commitments`, `get_user_commitment_ids`, `get_user_commitment_ids_page`, `get_owner_commitments`, `get_attestations`, `get_dispute`, `get_default_penalty`, `get_yield_pool_balance`, `get_yield_pool_status`, `get_grace_period`, `get_violation_threshold`, `is_paused`. |

## Configuration Surface

| Setting                    | Storage / source                                                            | Behavior                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GracePeriodSeconds`       | `set_grace_period(admin, seconds)`; default `0` after `initialize`          | When non-zero, a refund at `maturity - GracePeriodSeconds <= now < maturity` waives the early-exit penalty.                                 |
| `ViolationThreshold`       | `set_violation_threshold(admin, threshold)` and `get_violation_threshold()` | Attestation scores below this value auto-freeze funded commitments as `EscrowStatus::Violated`.                                             |
| Safe default penalty       | `initialize(..., safe_default_penalty_bps, ...)`                            | Used by default-penalty creation for `RiskProfile::Safe`; tests initialize it to `200` bps.                                                 |
| Balanced default penalty   | `initialize(..., balanced_default_penalty_bps, ...)`                        | Used by default-penalty creation for `RiskProfile::Balanced`; tests initialize it to `300` bps.                                             |
| Aggressive default penalty | `initialize(..., aggressive_default_penalty_bps)`                           | Used by default-penalty creation for `RiskProfile::Aggressive`; tests initialize it to `500` bps.                                           |
| `MAX_AMOUNT`               | `1_000_000_000_000`                                                         | Maximum commitment principal accepted by `create_commitment`.                                                                               |
| `MAX_DURATION_DAYS`        | `365`                                                                       | Maximum duration accepted by `create_commitment`.                                                                                           |
| `MAX_PENALTY_BPS`          | `10_000`                                                                    | Maximum penalty basis points, where `10_000` is 100%.                                                                                       |
| `MIN_PARTIAL_WITHDRAWAL`   | `10_000_000`                                                                | Minimum partial withdrawal amount (1 XLM at 7 decimals); full exits allow amounts below this threshold.                                     |
| `MIN_REMAINING_PRINCIPAL`  | `10_000_000`                                                                | Minimum remaining principal for partial exits (1 XLM at 7 decimals); leaving `0 < remaining < min` returns `BelowMinimum`.                  |
| Yield rates                | `yield_rate_bps` / `calculate_accrued_yield`                                | Safe: 500 bps annualized, Balanced: 700 bps, Aggressive: 1000 bps.                                                                          |
| Yield pool                 | `deposit_yield_pool` / `withdraw_yield_pool` / `get_yield_pool_status`      | `available = balance - reserved`. `fund_escrow` reserves `accrued_yield` from `available`, so matured releases can always be paid.                                                                    |

## Yield-Pool Accounting

The yield pool tracks two numbers in instance storage:

| Storage          | Meaning                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `YieldPool`      | Total tokens held in the contract for yield payouts.                                             |
| `ReservedYield`  | Sum of `accrued_yield` already promised to funded commitments.                                   |
| `available`      | Derived: `YieldPool - ReservedYield`, the portion an admin may withdraw or promise to new commitments. |

Solvency is enforced when the promise is made, not when it is redeemed:

- `fund_escrow` requires `available >= accrued_yield` (else `InsufficientYieldPool`) and then adds `accrued_yield` to `ReservedYield`. Commitments with a zero rounded-down yield reserve nothing and always fund.
- A matured release (`release`, `settle_commitment`, or `resolve_dispute(release_to_owner = true)` after maturity) decreases both `YieldPool` and `ReservedYield` by `accrued_yield`, so it no longer fails because of pool exhaustion. A defensive check returns `ReservedYieldInvariant` if `reserved < accrued_yield`.
- Every exit that forfeits yield (`refund`, `early_exit_commitment`, `refund_partial` on full exit, `resolve_dispute` refund branch, and a pre-maturity `resolve_dispute(release_to_owner = true)`) drops the reservation while leaving `YieldPool` untouched.
- `refund_partial` keeps the whole reservation until the remaining principal reaches zero, since the reservation is recorded per commitment rather than pro-rated. This over-reserves (never under-reserves) during a partial exit.
- `withdraw_yield_pool(to, amount)` is admin-only and may only take from `available`; `reserved` can never be drained. `get_yield_pool_status()` exposes `{ balance, reserved, available }` for admins and UIs.
- `0 <= reserved <= balance` holds after every entrypoint. All arithmetic is checked; overflow returns `InvalidAmount` and a broken invariant returns `ReservedYieldInvariant` instead of panicking.

Commitments funded before reservation accounting existed have no entry under `DataKey::Reserved(id)`. They are never un-reserved, and their matured release falls back to the previous behaviour of paying `accrued_yield` straight out of `YieldPool`, which can still return `InsufficientYieldPool`.

## Penalty Math

Early-exit penalties favor the protocol and are computed consistently across all refund paths (`refund`, `early_exit_commitment`, `refund_partial`, and `resolve_dispute` refund branch) using the shared `penalty_for(amount, penalty_bps)` helper:

- **Ceiling Division**: Penalty is calculated as `(amount * bps + 9_999) / 10_000` (for `bps > 0`), ensuring any non-zero withdrawal fraction rounds up in the protocol's favour (e.g. 1 stroop pays 1 stroop penalty; 49 stroops at 200 bps pays 1 stroop; 1,001 stroops at 500 bps pays 51 stroops penalty). When `bps == 0`, penalty is `0`.
- **Fund Conservation & Clamping**: Penalty is clamped so `0 <= penalty <= amount`, and `refund = amount - penalty`, guaranteeing `penalty + refund == amount` for all inputs.
- **Slicing Invariant**: Because penalties round up, slicing a withdrawal into smaller chunks never incurs a lower total penalty than withdrawing the full amount at once.
- **Minimum Partial Withdrawals and Remainders**: `refund_partial` enforces `amount >= MIN_PARTIAL_WITHDRAWAL` (`10_000_000` stroops / 1 XLM) and requires any non-zero remaining balance to satisfy `remaining >= MIN_REMAINING_PRINCIPAL` (`10_000_000` stroops / 1 XLM). Violations return `Error::BelowMinimum = 18`. Full withdrawals (`remaining == 0`) bypass these minimums to support legacy or small positions.

## Worked Refund and Grace-Period Example

The test suite's `refund_within_grace_period_is_penalty_free` covers the intended grace-window behavior:

1. Admin calls `set_grace_period(admin, SECONDS_PER_DAY)`, configuring a one-day window.
2. Owner creates a 30-day aggressive commitment for `1_000` units with a `500` bps penalty.
3. Owner funds the escrow, moving it to `Funded`.
4. Ledger time advances to day 29, exactly one day before maturity.
5. Owner calls `refund(commitment_id)`.
6. Because the current time is inside the configured grace window, the penalty is `0`, owner receives the full `1_000`, fee recipient receives `0`, and commitment becomes `Refunded`.

Outside the grace window, the same 500 bps early exit returns `950` to the owner and sends `50` to the fee recipient (or 1,001 units returns `950` refund and `51` penalty), as covered by `refund_outside_grace_period_still_applies_penalty` and the penalty math tests.

## Violation Path

`record_attestation(commitment_id, attestor, score)` appends an `AttestationRecord` with the attestor, score, and ledger timestamp. If a funded commitment receives a score below `ViolationThreshold`, the contract sets `EscrowStatus::Violated` and emits a violation event. A violated commitment is frozen until an admin calls `resolve_dispute` to release or refund it. Integrators should read the commitment status before presenting settlement or early-exit actions.

## Ownership Transfer Path

`transfer_ownership(commitment_id, new_owner)` supports secondary-market ownership handoff without settling funds. It is owner-authorized, requires the commitment to be `Funded`, updates `Commitment.owner`, removes the id from the previous owner's index, adds it to `new_owner`'s index, emits `transfer_ownership`, and leaves all economics and maturity terms unchanged.

## Stable Error Codes

The `Error` enum in `contracts/escrow/src/lib.rs` is `#[repr(u32)]`; these numeric codes are stable for backend normalization in `src/lib/backend/services/contracts.ts` and for RPC clients that only receive numeric contract errors.

| Code | Error                   | Meaning                                                                     |
| ---- | ----------------------- | --------------------------------------------------------------------------- |
| 1    | `AlreadyInitialized`    | `initialize` was called after setup already completed.                      |
| 2    | `NotInitialized`        | Required instance storage, such as admin/token/default config, is missing.  |
| 3    | `NotFound`              | Commitment id or required record does not exist.                            |
| 4    | `Unauthorized`          | Caller is not the owner/admin/authorized account for the action.            |
| 5    | `InvalidAmount`         | Amount is zero, negative, above `MAX_AMOUNT`, or arithmetic would overflow. |
| 6    | `InvalidState`          | Action is not valid for the commitment's current status.                    |
| 7    | `NotMatured`            | Release or settlement was requested before maturity.                        |
| 8    | `InvalidDuration`       | Duration is zero or above `MAX_DURATION_DAYS`.                              |
| 9    | `PenaltyTooHigh`        | Penalty exceeds `MAX_PENALTY_BPS`.                                          |
| 10   | `InsufficientYieldPool` | Yield pool cannot cover accrued yield for a mature release.                 |
| 11   | `Paused`                | Write operation was attempted while contract writes are paused.             |
| 16   | `FundingWindowExpired`  | Funding was attempted after the 7-day funding window elapsed.               |
| 17   | `ReservedYieldInvariant`| Yield reservation accounting invariant is broken (e.g. `reserved < accrued_yield`); should be unreachable. |
| 18   | `BelowMinimum`          | Partial withdrawal amount or remaining principal is below the required minimum (`10_000_000` stroops). |

Backend callers should use the normalized `BackendError` response shape and preserve method context in details. Contract errors that cannot be parsed should still be surfaced as `BLOCKCHAIN_CALL_FAILED` with the method name so API consumers can distinguish RPC/configuration failures from business-rule failures.

`FundingWindowExpired` is error code `16`; it is returned without moving tokens when funding is attempted after the 7-day window. Codes 1-15 and their enum positions remain unchanged. `ReservedYieldInvariant` is error code `17`. `BelowMinimum` is error code `18`.

Run the isolated test suites with `cd contracts && cargo test -p commitlabs-escrow`.

## Deployment Flow

`contracts/scripts/deploy-testnet.sh` builds from `contracts/Cargo.toml`, deploys the WASM to Stellar testnet, invokes `initialize`, and upserts the deployed id into the configured frontend env file.

Required environment variables:

| Variable                                    | Purpose                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `STELLAR_ACCOUNT`                           | CLI source account used for build/deploy/invoke signing.                                        |
| `COMMITLABS_ADMIN_ADDRESS`                  | Admin `G...` address passed to `initialize`.                                                    |
| `COMMITLABS_TOKEN_CONTRACT_ID`              | Token `C...` contract id passed to `initialize`.                                                |
| `COMMITLABS_FEE_RECIPIENT_ADDRESS`          | Fee recipient `G...` address passed to `initialize`.                                            |
| `COMMITLABS_SAFE_DEFAULT_PENALTY_BPS`       | Default early-exit penalty (0-10000 bps) for `RiskProfile::Safe`, passed to `initialize`.       |
| `COMMITLABS_BALANCED_DEFAULT_PENALTY_BPS`   | Default early-exit penalty (0-10000 bps) for `RiskProfile::Balanced`, passed to `initialize`.   |
| `COMMITLABS_AGGRESSIVE_DEFAULT_PENALTY_BPS` | Default early-exit penalty (0-10000 bps) for `RiskProfile::Aggressive`, passed to `initialize`. |

Optional overrides include `STELLAR_RPC_URL`, `STELLAR_NETWORK_PASSPHRASE`, `COMMITLABS_ENV_FILE`, `COMMITLABS_CONTRACT_MANIFEST`, `COMMITLABS_CONTRACT_PACKAGE`, `COMMITLABS_WASM_PATH`, `COMMITLABS_CONTRACT_ALIAS`, and `DRY_RUN`.

Dry run:

```bash
DRY_RUN=1 \
STELLAR_ACCOUNT=deployer \
COMMITLABS_ADMIN_ADDRESS=G... \
COMMITLABS_TOKEN_CONTRACT_ID=C... \
COMMITLABS_FEE_RECIPIENT_ADDRESS=G... \
COMMITLABS_SAFE_DEFAULT_PENALTY_BPS=200 \
COMMITLABS_BALANCED_DEFAULT_PENALTY_BPS=300 \
COMMITLABS_AGGRESSIVE_DEFAULT_PENALTY_BPS=500 \
./contracts/scripts/deploy-testnet.sh
```

Real testnet deploy:

```bash
STELLAR_ACCOUNT=deployer \
COMMITLABS_ADMIN_ADDRESS=G... \
COMMITLABS_TOKEN_CONTRACT_ID=C... \
COMMITLABS_FEE_RECIPIENT_ADDRESS=G... \
COMMITLABS_SAFE_DEFAULT_PENALTY_BPS=200 \
COMMITLABS_BALANCED_DEFAULT_PENALTY_BPS=300 \
COMMITLABS_AGGRESSIVE_DEFAULT_PENALTY_BPS=500 \
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
