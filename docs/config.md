# Contract Configuration (versioned)

This project supports multiple smart contract versions and addresses via a centralized configuration accessor.

## Client-Side Environment Variable Validation

Client-side environment variables (those prefixed with `NEXT_PUBLIC_*`) are validated at startup by `src/lib/clientEnv.ts` using Zod. This ensures that:

- Misconfigured or missing public env vars fail fast with clear error messages
- Invalid URLs are caught before runtime
- Accidental exposure of non-public secrets as `NEXT_PUBLIC_*` is prevented
- All client config is type-safe through TypeScript

### Validated Client Environment Variables

The following `NEXT_PUBLIC_*` variables are validated by the client env module:

- `NEXT_PUBLIC_SOROBAN_RPC_URL` - Soroban RPC endpoint (URL format validated)
- `NEXT_PUBLIC_NETWORK_PASSPHRASE` - Stellar network passphrase
- `NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT` - NFT contract address
- `NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT` - Core contract address
- `NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT` - Attestation contract address
- `NEXT_PUBLIC_CONTRACTS_JSON` - JSON blob for contract configuration
- `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION` - Active contract version
- `NEXT_PUBLIC_USE_MOCKS` - Mock mode flag
- `NEXT_PUBLIC_APP_URL` - Application URL (for CORS)
- `NEXT_PUBLIC_SITE_URL` - Site URL (for CORS)

### Usage in Client Code

Import and use the validated client env in client-side code:

```typescript
import { getValidatedClientEnv } from '@/lib/clientEnv';

const clientEnv = getValidatedClientEnv();
const rpcUrl = clientEnv.NEXT_PUBLIC_SOROBAN_RPC_URL;
```

### Error Handling

If validation fails, a `ClientEnvValidationError` is thrown with a clear message indicating which variables are invalid or missing. In development and production, validation happens eagerly at module load time to catch issues early.

### Security Note

Never include secrets in `NEXT_PUBLIC_*` variables. These are exposed to the browser and should only contain non-sensitive configuration data.

## Config sources

- `NEXT_PUBLIC_CONTRACTS_JSON` (preferred): JSON string mapping versions to contract entries.
- Legacy env vars: `NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT`, `NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT`, `NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT` mapped to `v1` automatically for backward compatibility.

## Structure

The JSON should be an object where keys are versions and values map contract keys to entries. Each entry may contain:

- `address` (required)
- `network` (optional)
- `abi` (optional)

Example:

```json
{
  "v1": {
    "commitmentNFT": { "address": "0xabc..." },
    "commitmentCore": { "address": "0xdef..." }
  },
  "staging": {
    "commitmentCore": { "address": "0x123...", "network": "testnet" }
  }
}
```

## How to add a new contract version

1. Add a new key to the JSON (for example `v2`) and include the contract entries and addresses.
2. Optionally set `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION` to the new version.

## How to switch versions safely

1. Add and validate the new version in `NEXT_PUBLIC_CONTRACTS_JSON` or set equivalent env vars for that version.
2. Set `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION` to the desired version.
3. Restart the application to pick up the new environment variables.

## Fallback behavior

- If `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION` is not set, the application defaults to `v1`.
- If `NEXT_PUBLIC_CONTRACTS_JSON` is not set, the application falls back to parsing legacy environment variables and treating them as `v1` contracts.
- If a requested contract entry or key is missing in a version, the application throws during contract resolution.

## Invalid version handling

- If `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION` points to a version not defined in `NEXT_PUBLIC_CONTRACTS_JSON`, startup throws `Active contract version 'X' not found`.
- Invalid JSON in `NEXT_PUBLIC_CONTRACTS_JSON` causes a parse error at startup.
- Incomplete contract entries without an `address` field throw when that contract is accessed.

## Example `.env` entries

```bash
NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION=v2
NEXT_PUBLIC_CONTRACTS_JSON={"v1":{"commitmentCore":{"address":"0xv1core"}},"v2":{"commitmentCore":{"address":"0xv2core"}}}
```

## Common misconfiguration errors and fixes

- `Active contract version "X" not found`: the configured JSON does not contain that version.
- `Contract entry for key "Y" in version "X" is missing or has no address`: the selected version lacks a required contract address.
- `Failed to parse NEXT_PUBLIC_CONTRACTS_JSON`: the JSON in the environment variable is invalid.

## Notes

- The runtime accessor lives at `src/lib/backend/config.ts` and provides `getActiveContracts()` and `getContractAddress(key)`.
- Legacy single-variable env configuration is still supported and automatically mapped to `v1` to avoid breaking changes.
- For testnet escrow deployments, `contracts/scripts/deploy-testnet.sh` upserts `NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT`, `COMMITMENT_CORE_CONTRACT`, and `SOROBAN_COMMITMENT_CORE_CONTRACT` into the chosen env file, which defaults to `.env.local`.

# Backend CORS Configuration

Browser-facing API routes use an explicit CORS policy helper.

## Environment variables

- `COMMITLABS_FIRST_PARTY_ORIGINS`: comma-separated allowlist for trusted app origins that can call first-party routes with credentials.
- `COMMITLABS_PUBLIC_API_ORIGINS`: comma-separated allowlist for public browser routes, or `*`. Default: `*`.

## Notes

- `COMMITLABS_FIRST_PARTY_ORIGINS` must never be `*`.
- Development always allows `http://localhost:3000` and `http://127.0.0.1:3000`.
- If present, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_URL` are folded into the first-party allowlist.

See `docs/backend-cors-policy.md` for the route classification and allowed methods.
