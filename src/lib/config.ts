import { NETWORKS, NetworkId, NetworkConfig } from './network';

export interface AppConfig {
  readonly network: NetworkId;
  readonly networkDetails: NetworkConfig;
  readonly passphrase: string;
  readonly horizonUrl: string;
  readonly sorobanRpcUrl: string;
  readonly escrowContractId: string;
  readonly isContractConfigured: boolean;
  readonly repoUrl: string;
  readonly liveUrl: string;
}

export function validateHttpsUrl(val: string, name: string): string {
  if (!val) {
    throw new Error(`${name} cannot be empty`);
  }
  let parsed: URL;
  try {
    parsed = new URL(val);
  } catch {
    throw new Error(`Invalid URL for ${name}: "${val}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https: protocol, got "${parsed.protocol}"`);
  }
  return val;
}

export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const rawNetwork = env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  if (!(rawNetwork in NETWORKS)) {
    throw new Error(
      `Invalid network: "${rawNetwork}". Must be one of: ${Object.keys(NETWORKS).join(', ')}`
    );
  }
  const network = rawNetwork as NetworkId;
  const networkDetails = NETWORKS[network];

  const horizonUrl = validateHttpsUrl(
    env.NEXT_PUBLIC_HORIZON_URL ?? networkDetails.defaultHorizonUrl,
    'NEXT_PUBLIC_HORIZON_URL'
  );

  const sorobanRpcUrl = validateHttpsUrl(
    env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? networkDetails.defaultSorobanRpcUrl,
    'NEXT_PUBLIC_SOROBAN_RPC_URL'
  );

  const rawContractId = env.NEXT_PUBLIC_ESCROW_CONTRACT_ID?.trim() ?? '';
  if (rawContractId && !/^C[A-Z2-7]{55}$/.test(rawContractId)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_ESCROW_CONTRACT_ID: "${rawContractId}". Must be a valid 56-character Soroban contract address starting with 'C'`
    );
  }

  return Object.freeze({
    network,
    networkDetails,
    passphrase: networkDetails.passphrase,
    horizonUrl,
    sorobanRpcUrl,
    escrowContractId: rawContractId,
    isContractConfigured: Boolean(rawContractId),
    repoUrl: 'https://github.com/Commitlabs-Org/Commitlabs-Frontend',
    liveUrl: 'https://commitlabs-frontend-pi.vercel.app',
  });
}

export const config: AppConfig = parseConfig(process.env);

// Backward-compatible exports
export const NETWORK = config.network;
export const HORIZON_URL = config.horizonUrl;
export const SOROBAN_RPC_URL = config.sorobanRpcUrl;
export const ESCROW_CONTRACT_ID = config.escrowContractId;
export const REPO_URL = config.repoUrl;
export const LIVE_URL = config.liveUrl;

export function explorerContractUrl(id: string): string {
  return `${config.networkDetails.explorerBaseUrl}/contract/${id}`;
}

export function explorerContract(id: string): string {
  return explorerContractUrl(id);
}

export function explorerTx(hash: string): string {
  return `${config.networkDetails.explorerBaseUrl}/tx/${hash}`;
}

export function explorerAccount(addr: string): string {
  return `${config.networkDetails.explorerBaseUrl}/account/${addr}`;
}

export const FRIENDBOT_URL =
  process.env.NEXT_PUBLIC_FRIENDBOT_URL ?? 'https://friendbot.stellar.org';

export function friendbotAccountUrl(address: string): string {
  return `${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`;
}
