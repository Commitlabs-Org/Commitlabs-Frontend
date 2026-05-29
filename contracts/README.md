### Admin and Fee Recipient Rotation

The contract supports secure rotation of the admin and fee recipient addresses after initialization:

| Function | Description |
| --- | --- |
| `set_admin(new_admin)` | Admin-only. Rotates the contract admin to `new_admin`. Emits an event. |
| `set_fee_recipient(new_fee_recipient)` | Admin-only. Rotates the protocol fee recipient. Emits an event. |

Both functions require the current admin to authorize the call. Rotation is rejected if the contract is not initialized. Events are emitted for auditability.
# CommitLabs Soroban Contracts

Soroban (Rust) smart-contract workspace backing the CommitLabs liquidity
commitment protocol. The frontend and Next.js backend service layer
(`src/lib/backend/services/contracts.ts`) interact with these contracts via the
Stellar Soroban RPC.

## Workspace layout

```
contracts/
├── Cargo.toml          # Cargo workspace (members = ["escrow"])
└── escrow/
    ├── Cargo.toml      # commitlabs-escrow crate (cdylib + rlib)
    └── src/
        ├── lib.rs      # EscrowContract implementation
        └── test.rs     # Unit tests (cfg(test))
```

## `escrow` contract

The escrow contract manages the on-chain lifecycle of a liquidity commitment.
Assets are deposited under a chosen risk profile and held in escrow until the
commitment matures, is exited early, or is disputed.

### Security: Checks-Effects-Interactions

To prevent reentrancy and similar vulnerabilities when interacting with external tokens, the escrow contract enforces the **Checks-Effects-Interactions** pattern. Specifically, within operations that transfer tokens (`release`, `refund`, and `resolve_dispute`):
1. **Checks**: Validate caller authorization, commitment status, and ledger time.
2. **Effects**: Update the commitment state (e.g., transition `Funded` -> `Released` or `Refunded`) and persist it to storage.
3. **Interactions**: Perform cross-contract calls to the asset's token contract.

This strict ordering guarantees the contract's internal state is fully resolved before execution control is temporarily handed over to external logic.

### Lifecycle

```
create_commitment ──► fund_escrow ──► release            (matured: principal back to owner)
                                  └──► refund             (early exit: principal − penalty)
                                  └──► dispute ──► resolve_dispute   (admin adjudication)
```

### Marketplace transfer flow (secondary trading)

`transfer_ownership(commitment_id, new_owner)` updates ownership for a **funded** commitment.

**Flow**
1. Marketplace buyer proposes `new_owner`.
2. The current commitment owner calls `transfer_ownership` and must authorize via `require_auth()`.
3. The contract verifies the commitment is `Funded` (transfers are blocked for non-funded states).
4. The contract updates:
   - `Commitment.owner`
   - `OwnerIndex` for both `old_owner` and `new_owner`
5. The commitment is now eligible for subsequent `release` / `refund` / dispute handling under the new owner.


### Public functions

| Function | Description |
| --- | --- |
| `initialize(admin, token, fee_recipient, safe_default_penalty_bps, balanced_default_penalty_bps, aggressive_default_penalty_bps)` | One-time setup of admin, escrow token (SAC), fee recipient, and default penalties for each risk profile. |
| `create_commitment(owner, asset, amount, risk, duration_days, penalty_bps)` | Create an unfunded commitment with explicit penalty; returns its `id`. |
| `create_commitment_with_default_penalty(owner, asset, amount, risk, duration_days)` | Create an unfunded commitment using the default penalty for the risk profile; returns its `id`. |
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
| `get_owner_commitments(owner)` | List commitment ids owned by an address. |
| `get_attestations(commitment_id)` | Retrieve the timeline of `AttestationRecord`s for a commitment. |
| `refund_partial(commitment_id, amount)` | Partial early-exit: withdraw `amount` from the principal, apply the proportional penalty to that portion, keep the remainder escrowed. |
| `set_violation_threshold(threshold)` | Admin-only. Set the compliance score threshold (0–100) below which a funded commitment is auto-violated. 0 disables auto-violation. |
| `get_violation_threshold()` | Read the current violation threshold. |

### Attestation History

Compliance scores recorded via `record_attestation` are appended to an on-chain historical log. This allows clients to query the timeline of scores for a given commitment rather than just reading the latest value. Use `get_attestations` to retrieve a list of `AttestationRecord` structures, each containing the attestor address, the compliance score, and the timestamp.

### `early_exit_commitment` entrypoint details

#### ABI Signature
```rust
pub fn early_exit_commitment(
    env: Env,
    commitment_id: u64,
    caller: Address,
) -> Result<EarlyExitResult, Error>
```

#### Response Struct Format (`EarlyExitResult`)
When returned from the contract, the result is serialized as a map/object containing:
* **`exitAmount`** (`i128`): The final amount returned to the commitment owner (principal minus penalty).
* **`penaltyAmount`** (`i128`): The penalty fee amount deducted and paid to the fee recipient.
* **`finalStatus`** (`EscrowStatus`): The final status of the commitment (always `Refunded`).

#### Field Descriptions
| Field | Type | Description |
| --- | --- | --- |
| `exitAmount` | `i128` | The absolute quantity of tokens transferred back to the commitment owner. |
| `penaltyAmount` | `i128` | The absolute quantity of tokens transferred to the fee recipient as an early-exit penalty. |
| `finalStatus` | `EscrowStatus` | The post-exit state of the escrow commitment, represented as `Refunded`. |

#### Example Usage
An invocator (e.g., the backend service layer) calls this entrypoint and retrieves the structured receipt:
```typescript
const result = await invokeContractMethod(
  contractId,
  "early_exit_commitment",
  [commitmentId, ownerAddress],
  "write"
);
console.log(`Exit Amount: ${result.exitAmount}, Penalty: ${result.penaltyAmount}`);
```

#### Grace period behavior
The contract supports a configurable penalty-free window before commitment maturity. If a funded commitment is refunded while the ledger time is within the configured grace period before maturity, the early-exit penalty is waived and the full principal is returned.

### Yield model

Matured `release` payouts now return the locked principal plus the commitment's accrued yield. Yield is calculated at commitment creation using a simple annualized model based on the selected `RiskProfile` and the commitment duration.

- `Safe`: 5.00% annualized
- `Balanced`: 7.00% annualized
- `Aggressive`: 10.00% annualized

Yield is funded by the admin through `deposit_yield_pool(admin, amount)`. The contract maintains a dedicated yield pool balance, and a matured release will fail if the pool has insufficient funds to pay the accrued yield.

### Risk profiles & penalties

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
`normalizeContractError` mapper can translate them into HTTP responses:
`AlreadyInitialized`, `NotInitialized`, `NotFound`, `Unauthorized`,
`InvalidAmount`, `InvalidState`, `NotMatured`, `InvalidDuration`,
`PenaltyTooHigh`, `Paused`, `AssetMismatch`, `InsufficientYieldPool`,
`InvalidWasmHash`, `CommitmentViolated`.

## Build & test

Requires the `stellar` CLI (v23) and the `wasm32v1-none` / `wasm32-unknown-unknown`
target.

```bash
# from contracts/
cargo test            # run unit tests in escrow/src/test.rs
stellar contract build
```

> Note: this workspace is scaffolded to ground the contract issue backlog.
> Verify a local toolchain before deploying to testnet/mainnet.

## Continuous Integration

A GitHub Actions CI workflow is configured in `.github/workflows/contracts.yml`.
On every push and pull request touching the `contracts/` directory or the workflow file, the CI will:
1. Set up the stable Rust toolchain with the `wasm32-unknown-unknown` target.
2. Cache Cargo registries and dependency builds via `Swatinem/rust-cache` to ensure fast execution.
3. Install the required version of the `stellar-cli` (v23.0.0).
4. Run `cargo test --locked` to execute the escrow contract unit tests.
5. Execute `stellar contract build` to verify smart contract compilation to WebAssembly.
