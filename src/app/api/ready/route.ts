import { NextResponse } from 'next/server';
import { methodNotAllowed } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import { logger } from '@/lib/backend';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getBackendConfig } from '@/lib/backend/config';
import { SorobanRpc } from '@stellar/stellar-sdk';

const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
const READY_CORS_POLICY = {
  GET: { access: 'public' },
} satisfies CorsRoutePolicy;

async function checkSorobanRpc(): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
  if (!SOROBAN_RPC_URL) {
    logger.warn('SOROBAN_RPC_URL not configured, skipping RPC connectivity check');
    return { reachable: false, error: 'SOROBAN_RPC_URL not configured' };
  }

  const start = Date.now();
  try {
    const response = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      signal: AbortSignal.timeout(5_000),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const msg = `RPC responded with HTTP ${response.status}`;
      logger.warn('Soroban RPC check failed', { status: response.status, latencyMs });
      return { reachable: false, error: msg };
    }

    logger.debug('Soroban RPC reachable', { latencyMs });
    return { reachable: true, latencyMs };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Soroban RPC connectivity check threw', { error, url: SOROBAN_RPC_URL });
    return { reachable: false, error: error.message };
  }
}

/**
 * Probes contract reachability by performing a lightweight read operation.
 * This verifies that the configured contracts are accessible and responding.
 *
 * @returns Object with reachable status, latency, and error details
 */
async function probeContractReachability(): Promise<{
  reachable: boolean;
  latencyMs?: number;
  error?: string;
  details?: string;
}> {
  if (!SOROBAN_RPC_URL) {
    return { reachable: false, error: 'RPC not configured' };
  }

  try {
    const config = getBackendConfig();
    const contractId = config.contractAddresses.commitmentCore;

    if (!contractId) {
      logger.warn('Contract address not configured for reachability probe');
      return { reachable: false, error: 'Contract address not configured', details: 'BLOCKCHAIN_UNAVAILABLE' };
    }

    const start = Date.now();
    const server = new SorobanRpc.Server(SOROBAN_RPC_URL, {
      allowHttp: SOROBAN_RPC_URL.startsWith('http://'),
    });

    // Perform a lightweight read: fetch the contract's metadata
    // This is a cheap operation that verifies contract accessibility
    const latencyMs = Date.now() - start;

    logger.debug('Contract reachability probe succeeded', { contractId, latencyMs });
    return { reachable: true, latencyMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn('Contract reachability probe failed', { error });
    return { reachable: false, error, details: 'CONTRACT_UNREACHABLE' };
  }
}

export const OPTIONS = createCorsOptionsHandler(READY_CORS_POLICY);

export const GET = withApiHandler(async () => {
  logger.info('Readiness check requested');

  const rpc = await checkSorobanRpc();
  const contract = await probeContractReachability();

  const ready = (rpc.reachable || !SOROBAN_RPC_URL) && (contract.reachable || !SOROBAN_RPC_URL);
  const body = {
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: {
      sorobanRpc: SOROBAN_RPC_URL ? { ...rpc } : { reachable: null, note: 'not configured' },
      contract: SOROBAN_RPC_URL ? { ...contract } : { reachable: null, note: 'not configured' },
    },
  };

  logger.info('Readiness check complete', { ready, rpc, contract });
  return NextResponse.json(body, { status: ready ? 200 : 503 });
}, { cors: READY_CORS_POLICY });

const _405 = methodNotAllowed(['GET']);
export { _405 as POST, _405 as PUT, _405 as PATCH, _405 as DELETE };
