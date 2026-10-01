import { getContractAddress } from '../lib/backend/config';

/**
 * Soroban RPC endpoint URL.
 * Falls back to Stellar testnet if NEXT_PUBLIC_SOROBAN_RPC_URL is unset.
 */
export const rpcUrl: string =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org:443';

/**
 * Stellar network passphrase.
 * Falls back to Test SDF Network if NEXT_PUBLIC_NETWORK_PASSPHRASE is unset.
 */
export const networkPassphrase: string =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

/**
 * Lazily-loaded contract addresses to avoid build-time errors when environment variables are unset.
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
