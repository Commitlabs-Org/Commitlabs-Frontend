# CommitLabs Soroban Contracts

Soroban (Rust) smart-contract workspace backing the CommitLabs liquidity commitment protocol. The frontend and Next.js backend service layer (`src/lib/backend/services/contracts.ts`) interact with these contracts via the Stellar Soroban RPC.

## Workspace layout

```text
contracts/
├── Cargo.toml                    # Cargo workspace (members = ["escrow"])
├── escrow/
│   ├── Cargo.toml                # commitlabs-escrow crate (cdylib + rlib)
│   └── src/
│       ├── lib.rs                # EscrowContract implementation
│       └── test.rs               # Unit tests (cfg(test))
└── scripts/
    ├── deploy-testnet.sh         # Build + deploy + initialize helper
    └── deploy-testnet.smoke.mjs  # Dry-run smoke validation
```

## Escrow lifecycle

The escrow contract manages the on-chain lifecycle of a liquidity commitment. Assets are deposited under a chosen risk profile and held in escrow until the commitment matures, is exited early, or is disputed.

### Security: Checks-Effects-Interactions

To prevent reentrancy and similar vulnerabilities when interacting with external tokens, the escrow contract enforces the **Checks-Effects-Interactions** pattern. Specifically, within operations that transfer tokens (`release`, `refund`, and `resolve_dispute`):

1. **Checks**: Validate caller authorization, commitment status, and ledger time.
2. **Effects**: Update the commitment state and persist it to storage.
3. **Interactions**: Perform cross-contract calls to the asset's token contract.

This ordering guarantees contract state is fully resolved before control is handed to external logic.

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

```text
create_commitment ──► fund_escrow ──► release
                   └──► refund
                   └──► dispute ──► resolve_dispute
```

### Marketplace transfer flow

`transfer_ownership(commitment_id, new_owner)` updates ownership for a **funded** commitment.

1. Marketplace buyer proposes `new_owner`.
2. The current commitment owner calls `transfer_ownership` and authorizes it.
3. The contract verifies the commitment is `Funded`.
4. The contract updates ownership and owner indexes.
5. The commitment remains eligible for later lifecycle actions under the new owner.

### Public functions

| Function | Description |
| --- | --- |
| `initialize(admin, token, fee_recipient, safe_default_penalty_bps, balanced_default_penalty_bps, aggressive_default_penalty_bps)` | One-time setup of admin, escrow token, fee recipient, and default penalties. |
| `create_commitment(owner, asset, amount, risk, duration_days, penalty_bps)` | Create an unfunded commitment with explicit penalty. |
| `create_commitment_with_default_penalty(owner, asset, amount, risk, duration_days)` | Create an unfunded commitment using the risk profile default penalty. |
| `fund_escrow(commitment_id)` | Move a commitment from `Created` to `Funded`. |
| `transfer_ownership(commitment_id, new_owner)` | Transfer marketplace ownership for a funded commitment. |
| `release(commitment_id, caller)` | Return principal plus accrued yield once matured. |
| `refund(commitment_id)` | Early-exit refund of principal minus penalty. |
| `refund_partial(commitment_id, amount)` | Partial early-exit while keeping the remainder escrowed. |
| `dispute(commitment_id, caller, reason)` | Freeze a funded commitment pending admin resolution. |
| `resolve_dispute(commitment_id, release_to_owner)` | Admin-only disputed settlement. |
| `record_attestation(commitment_id, attestor, compliance_score)` | Record a 0-100 compliance score. |
| `deposit_yield_pool(admin, amount)` | Admin-only yield funding. |
| `get_yield_pool_balance()` | Read available yield pool balance. |
| `set_grace_period(admin, grace_period_seconds)` | Admin-only grace window configuration. |
| `get_grace_period()` | Read the grace period in seconds. |
| `set_violation_threshold(threshold)` | Admin-only automatic violation threshold. |
| `get_violation_threshold()` | Read the current violation threshold. |
| `pause()` | Admin-only emergency pause. |
| `unpause()` | Admin-only resume writes. |
| `is_paused()` | Read pause state. |
| `get_commitment(commitment_id)` | Read a single commitment. |
| `get_owner_commitments(owner)` | List commitment ids for an owner. |
| `get_attestations(commitment_id)` | Read historical attestation records. |
| `get_default_penalty(risk)` | Read the default penalty for a risk profile. |
| `set_admin(new_admin)` | Rotate the admin address. |
| `set_fee_recipient(new_fee_recipient)` | Rotate the fee recipient address. |

### Attestation history

Compliance scores recorded via `record_attestation` are appended to an on-chain historical log. Use `get_attestations` to retrieve the full timeline.

### `early_exit_commitment` entrypoint

ABI signature:

```rust
pub fn early_exit_commitment(env: Env, commitment_id: u64, caller: Address) -> Result
```

Returned `EarlyExitResult` fields:

- `exitAmount` (`i128`)
- `penaltyAmount` (`i128`)
- `finalStatus` (`EscrowStatus`)

### Grace period behavior

If a funded commitment is refunded within the configured grace period before maturity, the early-exit penalty is waived and the full principal is returned.

## Yield model

Matured `release` payouts return locked principal plus accrued yield. Current annualized rates:

- `Safe`: 5.00%
- `Balanced`: 7.00%
- `Aggressive`: 10.00%

Yield is funded via `deposit_yield_pool(admin, amount)`.

### Risk profiles and penalties

`RiskProfile` is `Safe | Balanced | Aggressive`, matching the frontend `CommitmentType`.

### Commitment limits

Upper-bound limits enforced in `create_commitment`:

- `MAX_AMOUNT`: `1_000_000_000_000`
- `MAX_DURATION_DAYS`: `365`
- `MAX_PENALTY_BPS`: `10_000`

### Errors

Stable contract error codes are surfaced for backend mapping, including `AlreadyInitialized`, `NotInitialized`, `NotFound`, `Unauthorized`, `InvalidAmount`, `InvalidState`, `NotMatured`, `InvalidDuration`, `PenaltyTooHigh`, `Paused`, `AssetMismatch`, `InsufficientYieldPool`, `InvalidWasmHash`, and `CommitmentViolated`.

## Testnet deploy flow

This repository now includes a scripted testnet deploy path for the escrow contract.

### What the script does

`contracts/scripts/deploy-testnet.sh`:

1. Builds from `contracts/Cargo.toml` using `stellar contract build`
2. Deploys the compiled WASM to Stellar testnet
3. Invokes `initialize(admin, token, fee_recipient)`
4. Upserts the resulting contract id into the frontend env file

The script updates:

- `NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT`
- `COMMITMENT_CORE_CONTRACT`
- `SOROBAN_COMMITMENT_CORE_CONTRACT`

This keeps the deployed address aligned with `src/lib/backend/config.ts` and `src/lib/backend/services/contracts.ts`.

### Required environment variables

| Variable | Purpose |
| --- | --- |
| `STELLAR_ACCOUNT` | CLI source account used for build/deploy/invoke signing. Prefer an identity alias or secure storage-backed signer. |
| `COMMITLABS_ADMIN_ADDRESS` | Admin `G...` address passed to `initialize` |
| `COMMITLABS_TOKEN_CONTRACT_ID` | Token `C...` contract id passed to `initialize` |
| `COMMITLABS_FEE_RECIPIENT_ADDRESS` | Fee recipient `G...` address passed to `initialize` |

Optional overrides:

- `STELLAR_RPC_URL`
- `STELLAR_NETWORK_PASSPHRASE`
- `COMMITLABS_ENV_FILE`
- `COMMITLABS_CONTRACT_MANIFEST`
- `COMMITLABS_CONTRACT_PACKAGE`
- `COMMITLABS_WASM_PATH`
- `COMMITLABS_CONTRACT_ALIAS`
- `DRY_RUN`

### Usage

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

### Security notes

- Keep secrets out of the script and source control; export them only in your shell session.
- The script never writes secret material into `.env.local`.
- Review the target env file before committing anything.

### Verification

Run:

```bash
npm run test:contracts:deploy
```

This dry-run smoke check validates the env-file upsert behavior and the missing-input guardrails without requiring a live deployer account.

## Build and test

Requires the `stellar` CLI and the `wasm32v1-none` / `wasm32-unknown-unknown` targets.

```bash
# from contracts/
cargo test
stellar contract build
```

## Continuous integration

The contracts CI validates contract tests and WebAssembly build output on pushes and pull requests touching the contract workspace.
