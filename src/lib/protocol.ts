import { useState, useEffect } from 'react';
import type { rpc, xdr } from '@stellar/stellar-sdk';
import { SOROBAN_RPC_URL, ESCROW_CONTRACT_ID } from './config';
import type { RiskProfile } from './yield';

export interface ProtocolParams {
  penalties: Record<RiskProfile, number>; // in basis points (e.g. 200 = 2%)
  gracePeriodSeconds: number; // in seconds
  isFallback: boolean;
}

/**
 * Fallback values used when RPC is unavailable or contract is not initialized.
 * Safe = 200 bps (2%), Balanced = 500 bps (5%), Aggressive = 1000 bps (10%), Grace = 0.
 */
export const FALLBACK_PROTOCOL_PARAMS: ProtocolParams = {
  penalties: {
    safe: 200,
    balanced: 500,
    aggressive: 1000,
  },
  gracePeriodSeconds: 0,
  isFallback: true,
};

const RISK_MAP: Record<RiskProfile, string> = {
  safe: 'Safe',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

// In-memory cache
let cachedParams: ProtocolParams | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export function clearProtocolParamsCache(): void {
  cachedParams = null;
  cacheExpiry = 0;
}

export interface GetProtocolParamsOptions {
  customServer?: rpc.Server;
  contractId?: string;
  forceRefresh?: boolean;
}

/**
 * Simulates get_default_penalty for each risk profile and get_grace_period from the Soroban escrow contract.
 * Uses an in-memory cache with a 60-second TTL.
 * Falls back to typed fallback parameters if the contract is unreachable, uninitialized, or RPC fails.
 */
export async function getProtocolParams(
  options: GetProtocolParamsOptions = {}
): Promise<ProtocolParams> {
  const now = Date.now();
  if (!options.forceRefresh && cachedParams && now < cacheExpiry) {
    return cachedParams;
  }

  const contractId = options.contractId || ESCROW_CONTRACT_ID;
  if (!contractId) {
    return FALLBACK_PROTOCOL_PARAMS;
  }

  try {
    const { rpc, Contract, xdr, scValToNative, Account, TransactionBuilder, Networks } =
      await import('@stellar/stellar-sdk');

    const server = options.customServer || new rpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(contractId);
    // Arbitrary dummy account for simulation (read-only calls require no auth signature)
    const dummyAccount = new Account('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H', '1');

    async function simulateCall(operation: xdr.Operation): Promise<any> {
      const tx = new TransactionBuilder(dummyAccount, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const simRes = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(simRes) || !simRes.result?.retval) {
        throw new Error('Simulation failed or returned no retval');
      }
      return scValToNative(simRes.result.retval);
    }

    const [safePenalty, balancedPenalty, aggressivePenalty, gracePeriod] = await Promise.all([
      simulateCall(
        contract.call('get_default_penalty', xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(RISK_MAP.safe)]))
      ),
      simulateCall(
        contract.call('get_default_penalty', xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(RISK_MAP.balanced)]))
      ),
      simulateCall(
        contract.call('get_default_penalty', xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(RISK_MAP.aggressive)]))
      ),
      simulateCall(contract.call('get_grace_period')),
    ]);

    const result: ProtocolParams = {
      penalties: {
        safe: Number(safePenalty),
        balanced: Number(balancedPenalty),
        aggressive: Number(aggressivePenalty),
      },
      gracePeriodSeconds: Number(gracePeriod),
      isFallback: false,
    };

    cachedParams = result;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return result;
  } catch (_err) {
    return FALLBACK_PROTOCOL_PARAMS;
  }
}

export interface UseProtocolParamsResult {
  params: ProtocolParams;
  loading: boolean;
  isFallback: boolean;
  refresh: () => Promise<void>;
}

/**
 * React hook to fetch protocol parameters with loading and fallback indicators.
 */
export function useProtocolParams(): UseProtocolParamsResult {
  const [params, setParams] = useState<ProtocolParams>(() => cachedParams || FALLBACK_PROTOCOL_PARAMS);
  const [loading, setLoading] = useState<boolean>(() => !cachedParams);

  const fetchParams = async (force = false) => {
    if (!force && cachedParams && Date.now() < cacheExpiry) {
      setParams(cachedParams);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await getProtocolParams({ forceRefresh: force });
      setParams(p);
    } catch {
      setParams(FALLBACK_PROTOCOL_PARAMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    getProtocolParams().then((p) => {
      if (mounted) {
        setParams(p);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return {
    params,
    loading,
    isFallback: params.isFallback,
    refresh: () => fetchParams(true),
  };
}
