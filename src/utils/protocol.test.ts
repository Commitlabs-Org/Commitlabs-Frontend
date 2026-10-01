import { describe, expect, it, vi } from 'vitest';

import { fetchProtocolConstants, type ProtocolConstants } from './protocol';

const validConstants = {
  commitmentLimits: {
    minCommitmentAmount: '1000000',
    maxCommitmentAmount: '10000000000',
    earlyExitGracePeriodDays: 7,
  },
  fees: {
    protocolFeeBasisPoints: 10,
    earlyExitFeeBasisPoints: 50,
  },
  supportedAssets: ['USDC', 'EUR'],
  version: '1.0.0',
} satisfies ProtocolConstants;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('fetchProtocolConstants', () => {
  it('returns validated protocol constants on a happy path', async () => {
    const fetchImpl = vi.fn().mockResolved(jsonResponse(validConstants));
    const result = await fetchProtocolConstants('https://api.example.com', fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/api/protocol/constants');
    expect(result).toEqual({
      commitmentLimits: {
        minCommitmentAmount: 1000000n,
        maxCommitmentAmount: 10000000000n,
        earlyExitGracePeriodDays: 7,
      },
      fees: {
        protocolFeeBasisPoints: 10,
        earlyExitFeeBasisPoints: 50,
      },
      supportedAssets: ['USDC', 'EUR'],
      version: '1.0.0',
    });
  });

  it('throws a clear error when the response is missing a required field', async () => {
    const malformed = {
      commitmentLimits: {
        minCommitmentAmount: '1000000',
        maxCommitmentAmount: '10000000000',
      },
      fees: {
        protocolFeeBasisPoints: 10,
        earlyExitFeeBasisPoints: 50,
      },
      supportedAssets: ['USD'],
      version: '1.0.0',
    };
    const fetchImpl = vi.fn().mockResolved(jsonResponse(malformed));
    await expect(
      fetchProtocolConstants('https://api.example.com', fetchImpl as typeof fetch),
    ).rejects.toThrowError(
      /Invalid protocol constants response: /,
    );
  });

  it('throws when the HTTP response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolved(
      new Response('internal error', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(
      fetchProtocolConstants('https://api.example.com', fetchImpl as typeof fetch),
    ).rejects.toThrowError(/Failed to fetch protocol constants: 500/);
  });
});
