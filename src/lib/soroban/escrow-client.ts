import { Client, Errors, type RiskProfile, type Commitment } from 'escrow-client';
import { config } from '../config';

/**
 * Typed error thrown when the escrow contract configuration is missing or invalid.
 */
export class EscrowConfigurationError extends Error {
  constructor(message = 'Escrow contract ID is not configured') {
    super(message);
    this.name = 'EscrowConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type EscrowSignTransactionFn = (
  xdr: string,
  opts?: {
    network?: string;
    networkPassphrase?: string;
    accountToSign?: string;
    address?: string;
    submit?: boolean;
    submitUrl?: string;
  }
) => Promise<string | { signedTxXdr: string; signerAddress?: string; error?: unknown }>;

export interface GetEscrowClientOptions {
  publicKey?: string;
  signTransaction?: EscrowSignTransactionFn;
  contractId?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  allowHttp?: boolean;
}

export const RISK_PROFILES: Record<'safe' | 'balanced' | 'aggressive', RiskProfile> = {
  safe: { tag: 'Safe', values: undefined },
  balanced: { tag: 'Balanced', values: undefined },
  aggressive: { tag: 'Aggressive', values: undefined },
};

/**
 * Factory that instantiates the generated typed Escrow contract Client.
 *
 * Configures default contractId, networkPassphrase, and sorobanRpcUrl from app config,
 * and seamlessly adapts Freighter's signTransaction to the Client's expected signing interface.
 */
export function getEscrowClient(options: GetEscrowClientOptions = {}): Client {
  const contractId = options.contractId ?? config.escrowContractId;
  if (!contractId || !contractId.trim()) {
    throw new EscrowConfigurationError('Escrow contract ID is not configured');
  }

  const networkPassphrase = options.networkPassphrase ?? config.passphrase;
  const rpcUrl = options.rpcUrl ?? config.sorobanRpcUrl;

  const wrappedSignTransaction = options.signTransaction
    ? async (
        xdr: string,
        opts?: {
          networkPassphrase?: string;
          address?: string;
          submit?: boolean;
          submitUrl?: string;
        }
      ) => {
        const res = await options.signTransaction!(xdr, {
          networkPassphrase: opts?.networkPassphrase ?? networkPassphrase,
          accountToSign: opts?.address ?? options.publicKey,
          address: opts?.address ?? options.publicKey,
          ...opts,
        });

        // Freighter's signTransaction returns string (the signed transaction envelope XDR)
        if (typeof res === 'string') {
          return {
            signedTxXdr: res,
            signerAddress: opts?.address ?? options.publicKey,
          };
        }

        return res;
      }
    : undefined;

  return new Client({
    contractId,
    networkPassphrase,
    rpcUrl,
    publicKey: options.publicKey,
    signTransaction: wrappedSignTransaction as any,
    allowHttp: options.allowHttp ?? false,
  });
}

/**
 * Convenient read-only helper to fetch the default penalty basis points for a risk profile
 * using the configured factory client.
 */
export async function getDefaultPenalty(
  risk: 'safe' | 'balanced' | 'aggressive' | RiskProfile,
  options?: GetEscrowClientOptions
): Promise<number> {
  const client = getEscrowClient(options);
  const riskProfile: RiskProfile =
    typeof risk === 'string' ? RISK_PROFILES[risk] : risk;
  const tx = await client.get_default_penalty({ risk: riskProfile });
  return Number(tx.result);
}

// Re-export generated types and error mapping
export { Errors, Client };
export type { RiskProfile, Commitment };
