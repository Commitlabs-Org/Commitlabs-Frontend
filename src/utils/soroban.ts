/**
 * Soroban Utility Functions
 *
 * This module provides shared constants and address lookups for the Stellar network.
 *
 * NOTE: For actual contract interactions (read/write), use the backend services
 * defined in src/lib/backend/services/contracts.ts. The client-side stubs
 * for wallet connection and contract calls have been removed to ensure
 * consistency through the backend integration layer.
 */

import { getContractAddress } from "../lib/backend/config";

export const rpcUrl =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org:443";

export const networkPassphrase =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
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

