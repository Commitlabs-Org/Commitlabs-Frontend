# Developer Guide

This guide covers local development setup, repository layout, testing conventions, Soroban contract bindings, environment variables, and bundle-size constraints for CommitLabs Frontend.

## Prerequisites

- **Node.js**: `>=20` (see `engines.node` in [`package.json`](./package.json))
- **npm**: bundled with Node.js 20+
- **Rust & Stellar CLI** *(only required when modifying contracts or regenerating bindings)*:
  - Rust `stable` toolchain with `wasm32-unknown-unknown` and `wasm32v1-none` targets
  - Stellar CLI (`stellar`, e.g. `v27.1.0` as pinned in [`.github/workflows/contracts.yml`](./.github/workflows/contracts.yml))

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file from the example template:

   ```bash
   cp .env.example .env.local
   ```

3. Start the Next.js development server:

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:3000`.

## Available Commands

Every script below is defined in [`package.json`](./package.json):

| Command | Underlying Script | Purpose |
| --- | --- | --- |
| `npm run dev` | `next dev` | Start the local Next.js development server |
| `npm run build` | `next build` | Validate env (`prebuild`) and build for production |
| `npm run start` | `next start` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` | Run strict TypeScript type checking |
| `npm run test` | `vitest run` | Run the Vitest unit and component test suite once |
| `npm run test:watch` | `vitest` | Run Vitest in interactive watch mode |
| `npm run test:size` | `node --test scripts/check-bundle-budget.test.mjs` | Run tests for the bundle-budget checker script |
| `npm run circular` | `madge --circular --extensions ts,tsx src` | Verify zero circular dependencies under `src/` (see [`docs/CIRCULAR_DEPS.md`](./docs/CIRCULAR_DEPS.md)) |
| `npm run size` | `node scripts/check-bundle-budget.mjs` | Check production build first-load JS against [`performance-budgets.json`](./performance-budgets.json) |
| `npm run analyze` | `cross-env ANALYZE=true next build` | Build with `@next/bundle-analyzer` enabled |
| `npm run bindings` | `bash scripts/gen-escrow-bindings.sh` | Compile the Soroban escrow contract and regenerate TypeScript bindings |

## Repository Layout

- **`src/lib/`** — Core frontend domain logic and utilities: formatting (`amount.ts`, `format.ts`), commitment/protocol/yield helpers (`commitments.ts`, `protocol.ts`, `yield.ts`), network & runtime config (`config.ts`, `deployments.ts`, `network.ts`), HTTP/storage/wallet integrations (`http.ts`, `storage.ts`, `wallet.ts`), and security helpers (`security/`).
- **`src/lib/soroban/`** — Soroban RPC and smart-contract integration layer: read/write transaction helpers (`read.ts`, `tx.ts`, `events.ts`), escrow contract wrappers (`escrow.ts`, `escrow-client.ts`), admin & protocol policy/status (`admin.ts`, `protocol-policy.ts`, `protocol-status.ts`), error normalization (`errors.ts`), and SDK-free dispute metadata (`dispute.ts`).
- **`contracts/`** — Rust Soroban smart-contract Cargo workspace (including `commitlabs-escrow`), contract tests, and testnet deployment metadata.
- **`packages/escrow-client/`** — Auto-generated TypeScript client bindings for `commitlabs-escrow`, linked into the frontend via `"escrow-client": "file:packages/escrow-client"` in `package.json`.

## Environment Variables

Public configuration is documented in [`.env.example`](./.env.example) and validated before every production build by [`scripts/validate-env.mjs`](./scripts/validate-env.mjs) (via the `prebuild` hook). Because `NEXT_PUBLIC_*` variables are inlined by Next.js at build time, changing them requires a rebuild.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | No | `testnet` | Must be `testnet`, `futurenet`, or `mainnet` |
| `NEXT_PUBLIC_HORIZON_URL` | No | Network default | Optional override; must use `https:` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | No | Network default | Optional override; must use `https:` |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | No | *(unset)* | Optional 56-character Soroban contract ID starting with `C`; demo mode is used when unset |

## Testing Conventions

- **Frontend tests (Vitest)**: Configured in [`vitest.config.ts`](./vitest.config.ts) with `jsdom`, React Testing Library, and `vitest-axe` (setup in `src/test/setup.ts`). Test files match `src/**/*.{test,spec}.{ts,tsx}` and are co-located alongside source files or in `__tests__/` directories. Run with `npm run test` or `npm run test:watch`.
- **Bundle-budget script tests**: Run with `npm run test:size`.
- **Smart-contract tests**: Run inside `contracts/` with `cargo test -p commitlabs-escrow`.
- **Static checks**: Run `npm run typecheck` and `npm run circular` before opening a pull request.

## Keeping Soroban SDK Out of First-Load Bundles

Production builds are gated against gzip-compressed first-load JavaScript budgets defined in [`performance-budgets.json`](./performance-budgets.json) for `/`, `/create`, and `/dashboard` (checked via `npm run size` after `npm run build`).

`@stellar/stellar-sdk` is large enough to push route bundles over budget if statically imported into components that render on initial page load. To prevent this:

- Keep shared UI types, enums, labels, and validation constants in SDK-free modules. For example, [`src/lib/soroban/dispute.ts`](./src/lib/soroban/dispute.ts) intentionally avoids importing `@stellar/stellar-sdk` so dashboard components can render dispute state without pulling the Soroban SDK into their first-load bundle, while the on-chain contract calls live in `src/lib/soroban/escrow.ts`.
- Avoid importing `@stellar/freighter-api` or `@stellar/stellar-sdk` at the top level of landing-page (`/`) or initial-render components; load wallet and Soroban transaction modules dynamically when the user triggers an action.
- Use `npm run analyze` to inspect bundle composition if `npm run size` fails.

## Regenerating Escrow Contract Bindings

Whenever the Rust ABI in `contracts/` changes, regenerate the TypeScript client in `packages/escrow-client/`:

```bash
npm run bindings
```

This runs [`scripts/gen-escrow-bindings.sh`](./scripts/gen-escrow-bindings.sh), which:

1. Builds the Soroban WASM contract in `contracts/` via `stellar contract build`.
2. Locates `commitlabs_escrow.wasm` under `contracts/target/`.
3. Runs `stellar contract bindings typescript --wasm <wasm> --output-dir packages/escrow-client --overwrite`.

Commit the updated files in `packages/escrow-client/` alongside your contract changes. CI ([`.github/workflows/contracts.yml`](./.github/workflows/contracts.yml)) verifies that `packages/escrow-client/` has no ABI drift (`git diff --exit-code packages/escrow-client`) and that `npm run typecheck` passes.

## Troubleshooting

- **`npm run bindings` fails with `stellar: command not found`**:
  Install the Stellar CLI (matching the version in [`.github/workflows/contracts.yml`](./.github/workflows/contracts.yml)) and ensure `stellar` is on your `PATH`. If the binary is installed under a different path or name, override it with `STELLAR_CMD=/path/to/stellar npm run bindings`.
- **`stellar contract build` fails due to missing WASM target**:
  Install the required Rust targets:
  ```bash
  rustup target add wasm32-unknown-unknown wasm32v1-none
  ```
- **`npm run build` fails in `prebuild` (`validate-env.mjs`)**:
  Check your `.env.local` values: `NEXT_PUBLIC_STELLAR_NETWORK` must be `testnet`, `futurenet`, or `mainnet`; custom Horizon/RPC URLs must use `https:`; and `NEXT_PUBLIC_ESCROW_CONTRACT_ID` (if set) must be a 56-character address starting with `C`.
- **`npm run size` fails after adding an import**:
  Run `npm run analyze` to see which chunk grew, and ensure `@stellar/stellar-sdk` or `@stellar/freighter-api` was not pulled into a first-load route bundle.
