/**
 * Typed access to the per-network deployment registry.
 *
 * Each `deployments/<network>.json` file lists the contracts deployed on that
 * network. A missing or empty `commitlabs-escrow` entry means the app has no
 * escrow contract there and must run in read-only/demo mode.
 */
import type { NetworkId } from './network';
import testnet from '../../deployments/testnet.json';
import futurenet from '../../deployments/futurenet.json';
import mainnet from '../../deployments/mainnet.json';

export interface DeploymentContract {
  id: string;
  explorer?: string;
  token?: string;
  admin?: string;
  deployTx?: string;
}

export interface NetworkDeployment {
  network: NetworkId;
  contracts: {
    'commitlabs-escrow'?: DeploymentContract;
  };
}

const DEPLOYMENTS: Record<NetworkId, NetworkDeployment> = {
  testnet: testnet as NetworkDeployment,
  futurenet: futurenet as NetworkDeployment,
  mainnet: mainnet as NetworkDeployment,
};

/** Returns the deployment record for a network (always present, possibly empty). */
export function getDeployment(network: NetworkId): NetworkDeployment {
  return DEPLOYMENTS[network];
}

/** Returns the escrow contract ID deployed on a network, or '' when there is none. */
export function getDeploymentContractId(network: NetworkId): string {
  return getDeployment(network).contracts['commitlabs-escrow']?.id?.trim() ?? '';
}
