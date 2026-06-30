export type ExplorerNetwork = 'mainnet' | 'testnet' | 'futurenet';

const BASE_URLS: Record<ExplorerNetwork, string> = {
  mainnet: 'https://stellar.expert/explorer/public',
  testnet: 'https://stellar.expert/explorer/testnet',
  futurenet: 'https://stellar.expert/explorer/futurenet',
};

export function explorerLinks(network: ExplorerNetwork = 'mainnet') {
  const base = BASE_URLS[network];
  return {
    network,
    transaction: (hash: string) => `${base}/tx/${hash}`,
    account: (address: string) => `${base}/account/${address}`,
    contract: (contractId: string) => `${base}/contract/${contractId}`,
    ledger: (sequence: number) => `${base}/ledger/${sequence}`,
  };
}

export type ExplorerLinksReturnType = ReturnType<typeof explorerLinks>;
