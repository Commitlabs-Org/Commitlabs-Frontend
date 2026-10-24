import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisputeDialog } from '../DisputeDialog';
import { openDispute } from '@/lib/soroban/escrow';
import type { Commitment } from '@/lib/commitments';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ status: 'connected', address: 'GCALLER', message: null }),
}));

vi.mock('@/lib/soroban/escrow', () => ({
  openDispute: vi.fn(),
  MAX_DISPUTE_REASON: 1000,
}));

const commitment: Commitment = {
  id: 'CMT-1',
  type: 'balanced',
  asset: 'USDC',
  amount: 1000,
  durationDays: 30,
  maxLoss: 8,
  penalty: 5,
  apy: 9,
  createdAt: Date.now(),
  status: 'active',
  owner: 'GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP',
  txHash: null,
};

beforeEach(() => {
  vi.mocked(openDispute).mockResolvedValue({ transactionHash: 'abc' });
});

describe('DisputeDialog', () => {
  it('is hidden when closed', () => {
    render(<DisputeDialog open={false} commitment={commitment} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByRole('dialog', { name: 'Report a problem' })).toBeNull();
  });

  it('shows the reason field and a disabled submit button when open', () => {
    render(<DisputeDialog open commitment={commitment} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Report a problem' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Reason' })).toBeDefined();
    const btn = screen.getByRole('button', { name: 'Report problem' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit once a reason is entered', async () => {
    const user = userEvent.setup();
    render(<DisputeDialog open commitment={commitment} onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'the payout did not match' },
    });
    const btn = screen.getByRole('button', { name: 'Report problem' });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls openDispute with the reason and commits via onSuccess', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<DisputeDialog open commitment={commitment} onClose={vi.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'the payout did not match' },
    });
    await user.click(screen.getByRole('button', { name: 'Report problem' }));
    await waitFor(() => expect(openDispute).toHaveBeenCalled());
    expect(openDispute).toHaveBeenCalledWith({
      commitmentId: 'CMT-1',
      caller: expect.any(String),
      reason: 'the payout did not match',
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(commitment));
  });
});
