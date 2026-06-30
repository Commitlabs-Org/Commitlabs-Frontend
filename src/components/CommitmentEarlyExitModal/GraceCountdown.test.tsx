import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProtocolConstants } from '@/utils/protocol';
import CommitmentEarlyExitModal from './CommitmentEarlyExitModal';
import { GraceCountdownBanner } from './GraceCountdownBanner';

const FIXED_NOW = new Date('2026-06-29T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const mockExitTimingPreview = vi.hoisted(() => vi.fn());

vi.mock('@/utils/protocol', async () => {
  const actual = await vi.importActual<typeof import('@/utils/protocol')>(
    '@/utils/protocol',
  );

  return {
    ...actual,
    fetchProtocolConstants: vi.fn(),
  };
});

vi.mock('./ExitTimingPreview', () => ({
  ExitTimingPreview: (props: Record<string, unknown>) => {
    mockExitTimingPreview(props);
    return null;
  },
}));

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('GraceCountdownBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    setReducedMotion(false);
    mockExitTimingPreview.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows penalty-free copy when the commitment is inside the grace period', () => {
    render(
      <GraceCountdownBanner
        maturityDate={new Date(FIXED_NOW.getTime() + 3 * DAY_MS)}
        gracePeriodDays={7}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Penalty-free grace period');
    expect(screen.getByRole('status')).toHaveTextContent(
      'You are inside the 7-day grace period.',
    );
  });

  it('shows a ticking countdown before the grace period opens', () => {
    render(
      <GraceCountdownBanner
        maturityDate={new Date(FIXED_NOW.getTime() + 10 * DAY_MS)}
        gracePeriodDays={7}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Grace window opens in');
    expect(screen.getByRole('status')).toHaveTextContent('Wait 3d 0h 0m 0s');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('status')).toHaveTextContent('Wait 2d 23h 59m 59s');
  });

  it('shows penalty-now copy when no grace period is configured', () => {
    render(
      <GraceCountdownBanner
        maturityDate={new Date(FIXED_NOW.getTime() + 10 * DAY_MS)}
        gracePeriodDays={0}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Penalty applies now');
    expect(screen.getByRole('status')).toHaveTextContent(
      'no penalty-free grace period',
    );
  });

  it('honors reduced motion by omitting seconds from the live countdown', async () => {
    setReducedMotion(true);

    render(
      <GraceCountdownBanner
        maturityDate={new Date(FIXED_NOW.getTime() + 10 * DAY_MS)}
        gracePeriodDays={7}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('status')).toHaveTextContent('Wait 3d 0h 0m');
    expect(screen.getByRole('status')).not.toHaveTextContent('0s');
  });

  it('loads the protocol grace period when the early-exit modal opens', async () => {
    vi.mocked(fetchProtocolConstants).mockResolvedValueOnce({
      protocolVersion: '1.0.0',
      network: 'testnet',
      fees: {
        networkBaseFeeStroops: 100,
        platformFeePercent: 0,
      },
      penalties: [],
      commitmentLimits: {
        minAmountXlm: 10,
        maxAmountXlm: 1_000_000,
        minDurationDays: 1,
        maxDurationDays: 365,
        maxLossPercentCeiling: 100,
        earlyExitGracePeriodDays: 5,
      },
      cachedAt: FIXED_NOW.toISOString(),
    });

    render(
      <CommitmentEarlyExitModal
        isOpen
        commitmentId="cm_123456"
        originalAmount="50,000 XLM"
        penaltyPercent="3%"
        penaltyAmount="1,500 XLM"
        netReceiveAmount="48,500 XLM"
        hasAcknowledged={false}
        onChangeAcknowledged={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        maturityDate={new Date(FIXED_NOW.getTime() + 10 * DAY_MS)}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      '5-day penalty-free grace period',
    );
    expect(mockExitTimingPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ gracePeriodDays: 5 }),
    );
  });
});
