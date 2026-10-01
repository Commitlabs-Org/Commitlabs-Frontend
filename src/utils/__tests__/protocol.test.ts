import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchProtocolConstants,
  getEarlyExitGracePeriodDays,
  type ProtocolConstants,
} from '../protocol';

const protocolConstantsFixture: ProtocolConstants = {
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
};

describe('fetchProtocolConstants', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('requests protocol constants and resolves enveloped response payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        success: true,
        data: protocolConstantsFixture,
      }),
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

  it('requests protocol constants and resolves direct un-enveloped response payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(protocolConstantsFixture),
    });

    const constants: ProtocolConstants = await fetchProtocolConstants();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/protocol/constants');
    expect(constants).toEqual(protocolConstantsFixture);
  });

  it('requests protocol constants with custom endpoint when provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        success: true,
        data: protocolConstantsFixture,
      }),
    });

    const constants: ProtocolConstants = await fetchProtocolConstants('/api/custom/constants');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/custom/constants');
    expect(constants).toEqual(protocolConstantsFixture);
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

  it('throws a validation error when commitmentLimits.earlyExitGracePeriodDays is missing in direct payload', async () => {
    const malformedFixture = {
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
      ],
      commitmentLimits: {
        minAmountXlm: 10,
        maxAmountXlm: 100_000,
        minDurationDays: 7,
        maxDurationDays: 365,
        maxLossPercentCeiling: 50,
      },
      cachedAt: '2026-06-27T08:00:00.000Z',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(malformedFixture),
    });

    await expect(fetchProtocolConstants()).rejects.toThrow(
      /Failed to validate protocol constants response payload.*earlyExitGracePeriodDays/i,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/protocol/constants');
  });

  it('throws a validation error when commitmentLimits.earlyExitGracePeriodDays is missing in enveloped payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        success: true,
        data: {
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
          ],
          commitmentLimits: {
            minAmountXlm: 10,
            maxAmountXlm: 100_000,
            minDurationDays: 7,
            maxDurationDays: 365,
            maxLossPercentCeiling: 50,
          },
          cachedAt: '2026-06-27T08:00:00.000Z',
        },
      }),
    });

    await expect(fetchProtocolConstants()).rejects.toThrow(
      /Failed to validate protocol constants response payload.*earlyExitGracePeriodDays/i,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/protocol/constants');
  });

  it('throws a validation error when fee fields have invalid types', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        ...protocolConstantsFixture,
        fees: {
          networkBaseFeeStroops: -10,
          platformFeePercent: 'invalid-fee',
        },
      }),
    });

    await expect(fetchProtocolConstants()).rejects.toThrow(
      /Failed to validate protocol constants response payload.*fees/i,
    );
  });

  it('throws a validation error when cachedAt is not a valid datetime string', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        ...protocolConstantsFixture,
        cachedAt: 'not-a-datetime',
      }),
    });

    await expect(fetchProtocolConstants()).rejects.toThrow(
      /Failed to validate protocol constants response payload.*cachedAt/i,
    );
  });

  it('throws a validation error when payload is not an object', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce('unexpected-string-body'),
    });

    await expect(fetchProtocolConstants()).rejects.toThrow(
      /Failed to validate protocol constants response payload/i,
    );
  });
});

describe('getEarlyExitGracePeriodDays', () => {
  it('returns the normalized grace-period constant', () => {
    expect(getEarlyExitGracePeriodDays(protocolConstantsFixture)).toBe(7);
  });

  it('floors positive fractional grace-period days', () => {
    const fractionalFixture: ProtocolConstants = {
      ...protocolConstantsFixture,
      commitmentLimits: {
        ...protocolConstantsFixture.commitmentLimits,
        earlyExitGracePeriodDays: 5.8,
      },
    };
    expect(getEarlyExitGracePeriodDays(fractionalFixture)).toBe(5);
  });

  it('falls back to 0 when constants are null or undefined', () => {
    expect(getEarlyExitGracePeriodDays(null)).toBe(0);
    expect(getEarlyExitGracePeriodDays(undefined)).toBe(0);
  });

  it('falls back to 0 when commitmentLimits is missing or earlyExitGracePeriodDays is not finite', () => {
    const invalidValues = [
      {
        ...protocolConstantsFixture,
        commitmentLimits: undefined as unknown as ProtocolConstants['commitmentLimits'],
      },
      {
        ...protocolConstantsFixture,
        commitmentLimits: {
          ...protocolConstantsFixture.commitmentLimits,
          earlyExitGracePeriodDays: NaN,
        },
      },
      {
        ...protocolConstantsFixture,
        commitmentLimits: {
          ...protocolConstantsFixture.commitmentLimits,
          earlyExitGracePeriodDays: -5,
        },
      },
      {
        ...protocolConstantsFixture,
        commitmentLimits: {
          ...protocolConstantsFixture.commitmentLimits,
          earlyExitGracePeriodDays: '7' as unknown as number,
        },
      },
    ];

    for (const invalid of invalidValues) {
      expect(getEarlyExitGracePeriodDays(invalid)).toBe(0);
    }
  });
});
