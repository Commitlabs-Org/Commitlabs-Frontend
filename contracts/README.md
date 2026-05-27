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

### Lifecycle

```
create_commitment ──► fund_escrow ──► release            (matured: principal back to owner)
                                  └──► refund             (early exit: principal − penalty)
                                  └──► dispute ──► resolve_dispute   (admin adjudication)
```

### Public functions

| Function | Description |
| --- | --- |
| `initialize(admin, token, fee_recipient, safe_default_penalty_bps, balanced_default_penalty_bps, aggressive_default_penalty_bps)` | One-time setup of admin, escrow token (SAC), fee recipient, and default penalties for each risk profile. |
| `create_commitment(owner, asset, amount, risk, duration_days, penalty_bps)` | Create an unfunded commitment with explicit penalty; returns its `id`. |
| `create_commitment_with_default_penalty(owner, asset, amount, risk, duration_days)` | Create an unfunded commitment using the default penalty for the risk profile; returns its `id`. |
| `fund_escrow(commitment_id)` | Transfer `amount` from owner into the contract (`Created → Funded`). |
| `release(commitment_id, caller)` | Return principal to owner once matured (`Funded → Released`). |
| `refund(commitment_id)` | Early-exit refund of principal minus `penalty_bps` (`Funded → Refunded`). |
| `dispute(commitment_id, caller, reason)` | Freeze a funded commitment pending admin resolution. The reason is automatically categorized. |
| `resolve_dispute(commitment_id, release_to_owner)` | Admin-only settlement of a disputed commitment. |
| `get_dispute(commitment_id)` | Read the dispute record for a commitment (category, reason, timestamp, initiator). |
| `get_default_penalty(risk)` | Read the default penalty for a specific risk profile. |
| `record_attestation(commitment_id, attestor, compliance_score)` | Record a 0–100 compliance score. |
| `get_commitment(commitment_id)` | Read a single commitment record. |
| `get_owner_commitments(owner)` | List commitment ids owned by an address. |

### Risk profiles & penalties

`RiskProfile` is `Safe | Balanced | Aggressive`, matching the frontend
`CommitmentType`. The early-exit penalty is supplied at creation time in basis
points (`penalty_bps`, max `10_000`) and is paid to the configured fee
recipient on `refund` / adverse `resolve_dispute`.

### Default penalties per risk profile

Default penalties are configured once at initialization and automatically applied
to commitments created via `create_commitment_with_default_penalty()`. This
simplifies commitment creation when consistent penalty tiers are desired.

#### Backend-aligned defaults

The contract defaults match the CommitLabs backend tier structure:

| Risk Profile | Default Penalty | Basis Points | Use Case |
| --- | --- | --- | --- |
| Safe | 2% | 200 | Low-risk commitments with minimal early-exit cost |
| Balanced | 3% | 300 | Medium-risk commitments with moderate early-exit cost |
| Aggressive | 5% | 500 | High-risk commitments with significant early-exit cost |

#### Two API patterns

The contract provides two ways to create commitments:

1. **Explicit penalty** (`create_commitment`): Set a specific penalty per commitment
   - Allows per-commitment customization
   - Overrides default if needed
   - Useful for custom deal terms

2. **Default penalty** (`create_commitment_with_default_penalty`): Use the profile default
   - Simplifies API calls
   - Ensures consistency across commitments
   - No penalty parameter needed

Example:
```rust
// Use default penalty (e.g., 3% for Balanced risk)
let id = contract.create_commitment_with_default_penalty(
    &owner, &asset, &1000, &RiskProfile::Balanced, &30
)?;

// Or override with custom penalty (e.g., 2% instead of default 3%)
let id = contract.create_commitment(
    &owner, &asset, &1000, &RiskProfile::Balanced, &30, &200
)?;
```

#### Querying defaults

Use `get_default_penalty(risk)` to retrieve the current default for a risk profile.
Useful for frontend/backend UI and verification.

### Dispute categorization & reason storage

When a commitment is disputed via `dispute(commitment_id, caller, reason)`, the
contract automatically categorizes the reason string into a `DisputeReason` enum
using keyword matching. This enables efficient on-chain classification and 
off-chain indexing of disputes.

#### DisputeReason categories

| Category | Keywords | Example |
| --- | --- | --- |
| `ValueMismatch` | value, mismatch, amount, delivered | "actual value delivered was less than promised" |
| `NonCompliance` | compliance, attestation, failed, violation | "compliance violation detected" |
| `FraudSuspicion` | fraud, unauthorized, suspicious | "suspected fraudulent activity" |
| `OperationalFailure` | operational, failure, delivery | "operational failure in delivery" |
| `Other` | (default) | "some other unclassified reason" |

#### Dispute record structure

Each disputed commitment stores a `DisputeRecord` containing:
- `reason_category`: The `DisputeReason` enum value (0–4)
- `reason_text`: The free-form reason string provided by the initiator (for audit)
- `disputed_at`: Ledger timestamp when the dispute was opened
- `disputed_by`: Address that initiated the dispute (owner or admin)

The dispute record is persisted on-chain and can be read at any time via
`get_dispute(commitment_id)`, even after the dispute is resolved. This enables
auditing, analytics, and off-chain verification of dispute history.

### Errors

Stable numeric error codes (`#[contracterror]`) are surfaced so the backend
`normalizeContractError` mapper can translate them into HTTP responses:
`AlreadyInitialized`, `NotInitialized`, `NotFound`, `Unauthorized`,
`InvalidAmount`, `InvalidState`, `NotMatured`, `InvalidDuration`,
`PenaltyTooHigh`.

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
