/**
 * Soroban Utility Functions
 *
 * This module provides contract address configuration and network constants.
 * All actual blockchain interactions are handled by the contracts service.
 *
 * SINGLE SOURCE OF TRUTH:
 * - Contract addresses: This module (via contractAddresses getters)
 * - Chain interactions: src/lib/backend/services/contracts.ts
 * - Client environment variables: src/lib/clientEnv.ts
 *
 * For wallet connection, contract calls, and contract reads, use:
 * @see src/lib/backend/services/contracts.ts
 */

import { getContractAddress } from "../lib/backend/config";
import { getValidatedClientEnv } from "../lib/clientEnv";

const clientEnv = getValidatedClientEnv();

export const rpcUrl =
  clientEnv.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org:443";
export const networkPassphrase =
  clientEnv.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

/**
 * Lazily-loaded contract addresses to avoid build-time errors when env vars aren't set.
 * Access these through the getter functions or the contractAddresses object.
 */
export const contractAddresses = {
  get commitmentNFT() {
    try {
      return getContractAddress("commitmentNFT");
    } catch {
      return "";
    }
  },
  get commitmentCore() {
    try {
      return getContractAddress("commitmentCore");
    } catch {
      return "";
    }
  },
  get attestationEngine() {
    try {
      return getContractAddress("attestationEngine");
    } catch {
      return "";
    }
  },
};
