import { NETWORKS, NetworkId, NetworkConfig, isNetworkId } from './network';
import { getDeploymentContractId, getDeploymentTokenId } from './deployments';

export interface AppConfig {
  readonly network: NetworkId;
  readonly networkDetails: NetworkConfig;
  readonly passphrase: string;
  readonly horizonUrl: string;
  readonly sorobanRpcUrl: string;
  readonly escrowContractId: string;
  readonly escrowTokenId: string;
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

  const rawTokenId = env.NEXT_PUBLIC_ESCROW_TOKEN_ID?.trim() ?? '';
  if (rawTokenId && !/^C[A-Z2-7]{55}$/.test(rawTokenId)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_ESCROW_TOKEN_ID: "${rawTokenId}". Must be a valid 56-character Soroban contract address starting with 'C'`
    );
  }

  return Object.freeze({
    network,
    networkDetails,
    passphrase: networkDetails.passphrase,
    horizonUrl,
    sorobanRpcUrl,
    escrowContractId: rawContractId,
    escrowTokenId: rawTokenId,
    isContractConfigured: Boolean(rawContractId),
    repoUrl: 'https://github.com/Commitlabs-Org/Commitlabs-Frontend',
    liveUrl: 'https://commitlabs-frontend-pi.vercel.app',
  });
}

export const config: AppConfig = parseConfig(process.env);

/**
 * Builds the config for any network, reusing `parseConfig` for all validation.
 *
 * The contract ID comes from the build-time environment for the configured
 * default network (so existing deployments keep working) and otherwise from
 * the typed `deployments/<network>.json` registry. URL overrides from the
 * environment only apply to the default network; other networks use their
 * canonical endpoints from `NETWORKS`.
 */
export function getConfig(
  network: NetworkId,
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const isDefaultNetwork = network === config.network;
  const deploymentContractId = getDeploymentContractId(network);
  const deploymentTokenId = getDeploymentTokenId(network);

  return parseConfig({
    NEXT_PUBLIC_STELLAR_NETWORK: network,
    NEXT_PUBLIC_HORIZON_URL: isDefaultNetwork ? env.NEXT_PUBLIC_HORIZON_URL : undefined,
    NEXT_PUBLIC_SOROBAN_RPC_URL: isDefaultNetwork ? env.NEXT_PUBLIC_SOROBAN_RPC_URL : undefined,
    NEXT_PUBLIC_ESCROW_CONTRACT_ID:
      (isDefaultNetwork ? env.NEXT_PUBLIC_ESCROW_CONTRACT_ID?.trim() : '') || deploymentContractId,
    NEXT_PUBLIC_ESCROW_TOKEN_ID:
      (isDefaultNetwork ? env.NEXT_PUBLIC_ESCROW_TOKEN_ID?.trim() : '') || deploymentTokenId,
  });
}

/**
 * The config used by modules that perform RPC/Horizon reads at runtime. It is
 * swapped by `NetworkProvider` when the user changes network, so those modules
 * must call `getActiveConfig()` inside their functions instead of capturing a
 * module-level constant.
 */
let activeConfig: AppConfig = config;

export function getActiveConfig(): AppConfig {
  return activeConfig;
}

/** Activates a network and returns its resolved config. */
export function setActiveNetwork(
  network: NetworkId,
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  activeConfig = getConfig(network, env);
  return activeConfig;
}

/** Resolves a network identifier, falling back to the build-time default. */
export function resolveNetwork(value: unknown, fallback: NetworkId = config.network): NetworkId {
  return isNetworkId(value) ? value : fallback;
}

// Backward-compatible build-time exports. Runtime code that must follow the
// header network selector should call getActiveConfig() instead.
export const NETWORK = config.network;
export const HORIZON_URL = config.horizonUrl;
export const SOROBAN_RPC_URL = config.sorobanRpcUrl;
export const ESCROW_CONTRACT_ID = config.escrowContractId;
export const REPO_URL = config.repoUrl;
export const LIVE_URL = config.liveUrl;

export function explorerContractUrl(id: string): string {
  return `${getActiveConfig().networkDetails.explorerBaseUrl}/contract/${id}`;
}

export function explorerContract(id: string): string {
  return explorerContractUrl(id);
}

export function explorerTx(hash: string): string {
  return `${getActiveConfig().networkDetails.explorerBaseUrl}/tx/${hash}`;
}

export function explorerAccount(addr: string): string {
  return `${getActiveConfig().networkDetails.explorerBaseUrl}/account/${addr}`;
}

export const FRIENDBOT_URL =
  process.env.NEXT_PUBLIC_FRIENDBOT_URL ?? 'https://friendbot.stellar.org';

export function friendbotAccountUrl(address: string): string {
  const networkFriendbot = getActiveConfig().networkDetails.friendbotUrl;
  return `${networkFriendbot ?? FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`;
}
