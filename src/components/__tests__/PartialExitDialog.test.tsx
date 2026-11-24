import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Commitment } from '@/lib/commitments';
import { MIN_PARTIAL_WITHDRAWAL } from '@/lib/amount';
import { PartialExitDialog } from '../PartialExitDialog';
import { refundPartial } from '@/lib/soroban/escrow';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ status: 'connected', address: 'GCALLER' }),
}));

vi.mock('@/lib/soroban/escrow', () => ({
  refundPartial: vi.fn(),
}));

const commitment: Commitment = {
  id: '42',
  type: 'balanced',
  asset: 'XLM',
  amount: '30000000',
  durationDays: 30,
  maxLoss: 8,
  penalty: 5,
  apy: 9,
  createdAt: Date.now(),
  status: 'active',
  owner: 'GCALLER',
  txHash: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refundPartial).mockResolvedValue({
    transactionHash: 'tx-partial',
    refundAmount: 9_500_000n,
  });
});

describe('PartialExitDialog', () => {
  it('shows the principal breakdown and enables a minimum valid withdrawal', async () => {
    const user = userEvent.setup();
    render(<PartialExitDialog open commitment={commitment} paused={false} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Partial exit' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount to withdraw' }), '1');

    expect(within(dialog).getByText('0.05 XLM')).toBeDefined();
    expect(within(dialog).getByText('0.95 XLM')).toBeDefined();
    expect(within(dialog).getByText('2 XLM')).toBeDefined();
    expect((within(dialog).getByRole('button', { name: 'Withdraw amount' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('rejects below-minimum withdrawals and dust remainders', async () => {
    const user = userEvent.setup();
    render(<PartialExitDialog open commitment={commitment} paused={false} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Partial exit' });
    const input = within(dialog).getByRole('textbox', { name: 'Amount to withdraw' });

    await user.type(input, '0.9999999');
    expect(within(dialog).getByRole('alert').textContent).toMatch(/at least 1/);
    expect((within(dialog).getByRole('button', { name: 'Withdraw amount' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.change(input, { target: { value: '2.9999999' } });
    expect(within(dialog).getByRole('alert').textContent).toMatch(/Leave at least 1/);
  });

  it('disables submission while refund_partial is paused', async () => {
    const user = userEvent.setup();
    render(<PartialExitDialog open commitment={commitment} paused onClose={vi.fn()} onSuccess={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Partial exit' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount to withdraw' }), '1');

    expect(within(dialog).getByText('Partial refunds are temporarily paused.')).toBeDefined();
    expect((within(dialog).getByRole('button', { name: 'Withdraw amount' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(refundPartial).not.toHaveBeenCalled();
  });

  it('calls refund_partial with the commitment id and stroops, then returns the refreshed amount', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<PartialExitDialog open commitment={commitment} paused={false} onClose={vi.fn()} onSuccess={onSuccess} />);
    const dialog = screen.getByRole('dialog', { name: 'Partial exit' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount to withdraw' }), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw amount' }));

    await waitFor(() => expect(refundPartial).toHaveBeenCalledWith({
      commitmentId: '42',
      caller: 'GCALLER',
      amount: MIN_PARTIAL_WITHDRAWAL,
    }));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ amount: '20000000' }));
  });

  it('shows a transaction error and allows recovery without duplicate submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(refundPartial).mockRejectedValueOnce(new Error('Wallet rejected the transaction'));
    render(<PartialExitDialog open commitment={commitment} paused={false} onClose={vi.fn()} onSuccess={onSuccess} />);
    const dialog = screen.getByRole('dialog', { name: 'Partial exit' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount to withdraw' }), '1');
    const submit = within(dialog).getByRole('button', { name: 'Withdraw amount' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toMatch(/Wallet rejected/));
    expect(refundPartial).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole('button', { name: 'Withdraw amount' }));
    await waitFor(() => expect(refundPartial).toHaveBeenCalledTimes(2));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('has no serious or critical accessibility violations', async () => {
    const { container } = render(
      <PartialExitDialog open commitment={commitment} paused={false} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
});
