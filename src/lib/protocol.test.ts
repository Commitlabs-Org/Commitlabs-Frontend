import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { xdr, rpc, scValToNative } from '@stellar/stellar-sdk';
import {
  getProtocolParams,
  clearProtocolParamsCache,
  FALLBACK_PROTOCOL_PARAMS,
} from './protocol';

describe('protocol.ts - getProtocolParams', () => {
  beforeEach(() => {
    clearProtocolParamsCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearProtocolParamsCache();
    vi.restoreAllMocks();
  });

  it('returns simulated penalties and grace period from Soroban contract', async () => {
    const mockSimulate = vi.fn().mockImplementation(async (tx) => {
      const op = tx.operations[0];
      const fnName = op.func.invokeContract.functionName.toString();
      const args = op.func.invokeContract.args;

      if (fnName === 'get_default_penalty') {
        const riskArg = args[0] ? scValToNative(args[0]) : null;
        const riskName = Array.isArray(riskArg) ? riskArg[0] : riskArg;
        if (riskName === 'Safe') {
          return {
            result: { retval: xdr.ScVal.scvU32(200) },
          };
        }
        if (riskName === 'Balanced') {
          return {
            result: { retval: xdr.ScVal.scvU32(500) },
          };
        }
        if (riskName === 'Aggressive') {
          return {
            result: { retval: xdr.ScVal.scvU32(1000) },
          };
        }
      }
      if (fnName === 'get_grace_period') {
        return {
          result: { retval: xdr.ScVal.scvU64(xdr.Uint64(3600n)) },
        };
      }
      return {
        result: { retval: xdr.ScVal.scvU32(0) },
      };
    });

    const mockServer = {
      simulateTransaction: mockSimulate,
    } as unknown as rpc.Server;

    const params = await getProtocolParams({
      customServer: mockServer,
      contractId: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
      forceRefresh: true,
    });

    expect(params.isFallback).toBe(false);
    expect(params.penalties.safe).toBe(200);
    expect(params.penalties.balanced).toBe(500);
    expect(params.penalties.aggressive).toBe(1000);
    expect(params.gracePeriodSeconds).toBe(3600);
    expect(mockSimulate).toHaveBeenCalledTimes(4);
  });

  it('uses in-memory cache within TTL and does not re-simulate', async () => {
    const mockSimulate = vi.fn().mockResolvedValue({
      result: { retval: xdr.ScVal.scvU32(200) },
    });

    const mockServer = {
      simulateTransaction: mockSimulate,
    } as unknown as rpc.Server;

    const first = await getProtocolParams({
      customServer: mockServer,
      contractId: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
    });
    expect(mockSimulate).toHaveBeenCalledTimes(4);

    // Second call without forceRefresh should hit cache
    const second = await getProtocolParams({
      customServer: mockServer,
      contractId: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
    });
    expect(mockSimulate).toHaveBeenCalledTimes(4);
    expect(second).toEqual(first);
  });

  it('returns FALLBACK_PROTOCOL_PARAMS when simulation throws error or RPC fails', async () => {
    const mockSimulate = vi.fn().mockRejectedValue(new Error('Network error or contract unreachable'));

    const mockServer = {
      simulateTransaction: mockSimulate,
    } as unknown as rpc.Server;

    const params = await getProtocolParams({
      customServer: mockServer,
      contractId: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
      forceRefresh: true,
    });

    expect(params.isFallback).toBe(true);
    expect(params).toEqual(FALLBACK_PROTOCOL_PARAMS);
  });

  it('returns FALLBACK_PROTOCOL_PARAMS if contract returns error (e.g. NotInitialized)', async () => {
    const mockSimulate = vi.fn().mockResolvedValue({
      error: 'HostError: Error(Contract, #2)', // NotInitialized = 2
    });

    const mockServer = {
      simulateTransaction: mockSimulate,
    } as unknown as rpc.Server;

    const params = await getProtocolParams({
      customServer: mockServer,
      contractId: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
      forceRefresh: true,
    });

    expect(params.isFallback).toBe(true);
    expect(params).toEqual(FALLBACK_PROTOCOL_PARAMS);
  });
});
