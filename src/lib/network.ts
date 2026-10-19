export type NetworkId = 'testnet' | 'futurenet' | 'mainnet';

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
