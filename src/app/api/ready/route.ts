import { NextResponse } from 'next/server';
import { logger } from '@/lib/backend';

const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;

async function checkSorobanRpc(): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
  if (!SOROBAN_RPC_URL) {
    logger.warn('SOROBAN_RPC_URL not configured, skipping RPC connectivity check');
    return { reachable: false, error: 'SOROBAN_RPC_URL not configured' };
  }

  const start = Date.now();
  try {
    // Lightweight JSON-RPC ping — getHealth is the canonical no-op probe
    const response = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      signal: AbortSignal.timeout(5_000), // 5 s hard timeout
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
    logger.error('Soroban RPC connectivity check threw', error, { url: SOROBAN_RPC_URL });
    return { reachable: false, error: error.message };
  }
}

export async function GET() {
  logger.info('Readiness check requested');

  const rpc = await checkSorobanRpc();
  const ready = rpc.reachable || !SOROBAN_RPC_URL; // still ready if RPC is simply not configured

  const body = {
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: {
      sorobanRpc: SOROBAN_RPC_URL
        ? { ...rpc }
        : { reachable: null, note: 'not configured' },
    },
  };

  logger.info('Readiness check complete', { ready, rpc });

  return NextResponse.json(body, { status: ready ? 200 : 503 });
}