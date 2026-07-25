import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProtocolConstants } from '@/utils/protocol';
import CommitmentEarlyExitModal from './CommitmentEarlyExitModal';

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
  ExitTimingPreview: () => null,
}));

vi.mock('./GraceCountdownBanner', () => ({
  GraceCountdownBanner: () => null,
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

const defaultProps = {
  isOpen: true,
  commitmentId: 'cm_123456',
  originalAmount: '50,000 XLM',
  penaltyPercent: '3%',
  penaltyAmount: '1,500 XLM',
  netReceiveAmount: '48,500 XLM',
};

describe('CommitmentEarlyExitModal', () => {
  beforeEach(() => {
    setReducedMotion(false);
    vi.mocked(fetchProtocolConstants).mockResolvedValue({
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
      cachedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderModal(overrides: Partial<React.ComponentProps<typeof CommitmentEarlyExitModal>> = {}) {
    const onChangeAcknowledged = vi.fn();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    const utils = render(
      <CommitmentEarlyExitModal
        {...defaultProps}
        hasAcknowledged={false}
        onChangeAcknowledged={onChangeAcknowledged}
        onCancel={onCancel}
        onConfirm={onConfirm}
        {...overrides}
      />,
    );

    return { ...utils, onChangeAcknowledged, onCancel, onConfirm };
  }

  it('renders the penalty breakdown and title when open', async () => {
    renderModal();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Early Exit Warning')).toBeInTheDocument();
    expect(screen.getByText('50,000 XLM')).toBeInTheDocument();
    expect(screen.getByText('48,500 XLM')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', async () => {
    renderModal({ isOpen: false });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the confirm button disabled until the checkbox is checked and the commitment id is typed', async () => {
    renderModal({ hasAcknowledged: false });

    await act(async () => {
      await Promise.resolve();
    });

    const confirmButton = screen.getByRole('button', { name: 'Confirm Early Exit' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText('Type the commitment ID to confirm'),
      { target: { value: defaultProps.commitmentId } },
    );

    expect(confirmButton).toBeDisabled();
  });

  it('keeps the confirm button disabled when acknowledged but the typed commitment id does not match', async () => {
    renderModal({ hasAcknowledged: true });

    await act(async () => {
      await Promise.resolve();
    });

    const confirmButton = screen.getByRole('button', { name: 'Confirm Early Exit' });

    fireEvent.change(
      screen.getByLabelText('Type the commitment ID to confirm'),
      { target: { value: 'not-the-right-id' } },
    );

    expect(confirmButton).toBeDisabled();
  });

  it('enables the confirm button once acknowledged and the exact commitment id is typed', async () => {
    renderModal({ hasAcknowledged: true });

    await act(async () => {
      await Promise.resolve();
    });

    const confirmButton = screen.getByRole('button', { name: 'Confirm Early Exit' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText('Type the commitment ID to confirm'),
      { target: { value: defaultProps.commitmentId } },
    );

    expect(confirmButton).toBeEnabled();
  });

  it('calls onChangeAcknowledged when the acknowledgement checkbox is toggled', async () => {
    const { onChangeAcknowledged } = renderModal({ hasAcknowledged: false });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChangeAcknowledged).toHaveBeenCalledWith(true);
  });

  it('fires onConfirm only when the confirm button is enabled and clicked', async () => {
    const { onConfirm } = renderModal({ hasAcknowledged: true });

    await act(async () => {
      await Promise.resolve();
    });

    const confirmButton = screen.getByRole('button', { name: 'Confirm Early Exit' });

    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByLabelText('Type the commitment ID to confirm'),
      { target: { value: defaultProps.commitmentId } },
    );

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when the cancel button is clicked', async () => {
    const { onCancel } = renderModal();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('falls back to onCancel for the close button when onClose is not provided', async () => {
    const { onCancel } = renderModal();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onClose instead of onCancel when onClose is provided', async () => {
    const onClose = vi.fn();
    const { onCancel } = renderModal({ onClose });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
