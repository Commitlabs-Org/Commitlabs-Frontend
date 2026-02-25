# Contract Configuration (versioned)

This project supports multiple smart contract versions and addresses via a centralized configuration accessor.

Config sources
- `NEXT_PUBLIC_CONTRACTS_JSON` (preferred): JSON string mapping versions to contract entries.
- Legacy env vars: `NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT`, `NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT`, `NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT` — mapped to `v1` automatically for backward compatibility.

Structure

The JSON should be an object where keys are versions and values map contract keys to entries. Each entry may contain:
- `address` (required)
- `network` (optional)
- `abi` (optional)

Example:

```
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

How to add a new contract version
1. Add a new key to the JSON (e.g., `v2`) and include the contract entries and addresses.
2. Optionally set `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION` to the new version.

How to switch versions safely
1. Add and validate the new version in `NEXT_PUBLIC_CONTRACTS_JSON` (or set equivalent env vars for that version).
2. Set `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION` to the desired version (e.g., `v2`).
3. Restart the application to pick up new environment variables.

Example `.env` entries

```
NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION=v2
NEXT_PUBLIC_CONTRACTS_JSON={"v1":{"commitmentCore":{"address":"0xold"}},"v2":{"commitmentCore":{"address":"0xnew"}}}
```

Common misconfiguration errors and fixes
- "Active contract version \"X\" not found": the `NEXT_PUBLIC_CONTRACTS_JSON` does not contain that version.
- "Contract entry for key \"Y\" in version \"X\" is missing or has no address": the selected version lacks a required contract address.
- "Failed to parse NEXT_PUBLIC_CONTRACTS_JSON": the JSON in the environment variable is invalid; check quoting and escaping.

Notes
- The runtime accessor lives at `src/lib/backend/config.ts` and provides `getActiveContracts()` and `getContractAddress(key)`.
- Legacy single-variable env configuration is still supported and automatically mapped to `v1` to avoid breaking changes.
