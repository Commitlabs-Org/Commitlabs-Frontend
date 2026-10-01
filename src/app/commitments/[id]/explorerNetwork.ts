import { getExplorerNetworkFromPassphrase, type ExplorerNetwork } from '@/utils/explorerLinks';
import { getValidatedClientEnv } from '@/lib/clientEnv';

const FALLBACK_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

/**
 * Resolves the Stellar network the app is configured for into the network
 * segment used by stellar.expert explorer links. Falls back to raw
 * process.env, then a hard-coded testnet passphrase, if client env
 * validation throws (e.g. in a misconfigured or test environment).
 */
export function getAppExplorerNetwork(): ExplorerNetwork {
  try {
    return getExplorerNetworkFromPassphrase(
      getValidatedClientEnv().NEXT_PUBLIC_NETWORK_PASSPHRASE ??
        process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
        FALLBACK_NETWORK_PASSPHRASE,
    );
  } catch {
    return getExplorerNetworkFromPassphrase(
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? FALLBACK_NETWORK_PASSPHRASE,
    );
  }
}
