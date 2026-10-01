import { getContractAddress } from '../lib/backend/config';

/**
 * Soroban RPC endpoint URL.
 * Falls back to the Stellar testnet endpoint when NEXT_PUBLIC_SOROBAN_RPC_URL is unset.
 */
export const rpcUrl: string =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org:443';

/**
 * Stellar network passphrase.
 * Falls back to the Test SDF Network passphrase when NEXT_PUBLIC_NETWORK_PASSPHRASE is unset.
 */
export const networkPassphrase: string =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

/**
 * Lazily-loaded contract addresses.
 *
 * Each getter resolves its address at access time and falls back to an empty
 * string when the underlying configuration is missing or invalid, avoiding
 * build-time errors when the corresponding environment variables are unset.
 */
export const contractAddresses = {
  get commitmentNFT(): string {
    try {
      return getContractAddress('commitmentNFT');
    } catch {
      return '';
    }
  },
  get commitmentCore(): string {
    try {
      return getContractAddress('commitmentCore');
    } catch {
      return '';
    }
  },
  get attestationEngine(): string {
    try {
      return getContractAddress('attestationEngine');
    } catch {
      return '';
    }
  },
};
