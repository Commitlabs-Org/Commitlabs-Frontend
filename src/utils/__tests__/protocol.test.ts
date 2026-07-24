import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchProtocolConstants,
  getEarlyExitGracePeriodDays,
  type ProtocolConstants,
} from '../protocol';

const protocolConstantsFixture = {
  protocolVersion: '1.0.0',
  network: 'testnet',
  fees: {
    networkBaseFeeStroops: 100,
    platformFeePercent: 2.5,
  },
  penalties: [
    {
      type: 'early_exit',
      earlyExitPenaltyPercent: 15,
      description: 'Penalty charged when a commitment exits before maturity.',
    },
    {
      type: 'default',
      earlyExitPenaltyPercent: 30,
      description: 'Penalty charged when commitment terms are not met.',
    },
  ],
  commitmentLimits: {
    minAmountXlm: 10,
    maxAmountXlm: 100_000,
    minDurationDays: 7,
    maxDurationDays: 365,
    maxLossPercentCeiling: 50,
    earlyExitGracePeriodDays: 7,
  },
  cachedAt: '2026-06-27T08:00:00.000Z',
} satisfies ProtocolConstants;

describe('fetchProtocolConstants', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('requests protocol constants and resolves the typed constants shape', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(protocolConstantsFixture),
    });

    const constants: ProtocolConstants = await fetchProtocolConstants();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/protocol/constants');
    expect(constants).toEqual(protocolConstantsFixture);
    expect(constants.fees).toEqual({
      networkBaseFeeStroops: 100,
      platformFeePercent: 2.5,
    });
    expect(constants.penalties).toEqual(protocolConstantsFixture.penalties);
    expect(constants.commitmentLimits).toEqual({
      minAmountXlm: 10,
      maxAmountXlm: 100_000,
      minDurationDays: 7,
      maxDurationDays: 365,
      maxLossPercentCeiling: 50,
      earlyExitGracePeriodDays: 7,
    });
  });

  it('throws an error containing statusText when the constants request is not OK', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn(),
    });

    await expect(fetchProtocolConstants()).rejects.toThrow(
      'Failed to fetch protocol constants: Internal Server Error',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/protocol/constants');
  });
});

describe('getEarlyExitGracePeriodDays', () => {
  it('returns the normalized grace-period constant', () => {
    expect(getEarlyExitGracePeriodDays(protocolConstantsFixture)).toBe(7);
  });

  it('falls back to 0 when constants are unavailable', () => {
    expect(getEarlyExitGracePeriodDays(null)).toBe(0);
    expect(getEarlyExitGracePeriodDays(undefined)).toBe(0);
  });
});
