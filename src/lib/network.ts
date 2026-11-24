export type NetworkId = 'testnet' | 'futurenet' | 'mainnet';

export const NETWORK_IDS: readonly NetworkId[] = ['testnet', 'futurenet', 'mainnet'];

/** Type guard for network identifiers coming from storage, cookies or the URL. */
export function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === 'string' && NETWORK_IDS.includes(value as NetworkId);
}

/** localStorage key for the user's runtime network choice. */
export const NETWORK_STORAGE_KEY = 'commitlabs.network.v1';

/**
 * Cookie mirror of the network choice. The server cannot read localStorage, so
 * middleware reads this cookie to scope the CSP `connect-src` to the active
 * network's Horizon and Soroban RPC hosts.
 */
export const NETWORK_COOKIE = 'commitlabs.network';

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  badgeLabel: string;
  passphrase: string;
  defaultHorizonUrl: string;
  defaultSorobanRpcUrl: string;
  explorerBaseUrl: string;
  friendbotUrl?: string;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  testnet: {
    id: 'testnet',
    label: 'Testnet',
    badgeLabel: 'Live on Stellar testnet',
    passphrase: 'Test SDF Network ; September 2015',
    defaultHorizonUrl: 'https://horizon-testnet.stellar.org',
    defaultSorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  futurenet: {
    id: 'futurenet',
    label: 'Futurenet',
    badgeLabel: 'Live on Stellar futurenet',
    passphrase: 'Test SDF Future Network ; October 2022',
    defaultHorizonUrl: 'https://horizon-futurenet.stellar.org',
    defaultSorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
    explorerBaseUrl: 'https://stellar.expert/explorer/futurenet',
    friendbotUrl: 'https://friendbot-futurenet.stellar.org',
  },
  mainnet: {
    id: 'mainnet',
    label: 'Mainnet',
    badgeLabel: 'Live on Stellar mainnet',
    passphrase: 'Public Global Stellar Network ; July 2015',
    defaultHorizonUrl: 'https://horizon.stellar.org',
    defaultSorobanRpcUrl: 'https://mainnet.stellar.org',
    explorerBaseUrl: 'https://stellar.expert/explorer/public',
  },
};
