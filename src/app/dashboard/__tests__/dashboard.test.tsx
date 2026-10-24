import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Commitment } from '@/lib/commitments';
import DashboardPage from '../page';
import { getDispute, openDispute } from '@/lib/soroban/escrow';

vi.mock('@/lib/commitments', async (orig) => ({
  ...(await orig<typeof import('@/lib/commitments')>()),
  loadCommitments: () => ({ items: seed, dropped: 0, corrupt: false, storageUnavailable: false }),
  saveCommitments: vi.fn(),
}));
vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ status: 'connected', address: 'GCALLER', message: null }),
}));
vi.mock('@/lib/wallet', () => ({
  fetchXlmBalance: vi.fn().mockResolvedValue(null),
  shortAddress: vi.fn((a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`),
}));
vi.mock('@/lib/soroban/escrow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/soroban/escrow')>();
  return {
    ...actual,
    getDispute: vi.fn(),
    openDispute: vi.fn(),
    MAX_DISPUTE_REASON: 1000,
  };
});

const DAY = 86_400_000;
const now = Date.now();
const base = {
  type: 'balanced' as const,
  asset: 'USDC',
  maxLoss: 8,
  penalty: 5,
  apy: 9,
  owner: 'GCALLER',
  txHash: null,
};

let seed: Commitment[] = [];

beforeEach(() => {
  seed = [
    { ...base, id: 'CMT-DISPUTED', amount: 500, durationDays: 30, createdAt: now - 10 * DAY, status: 'disputed' } as Commitment,
    { ...base, id: 'CMT-ACTIVE', amount: 1000, durationDays: 100, createdAt: now - 40 * DAY, status: 'active' } as Commitment,
  ];
  vi.mocked(getDispute).mockResolvedValue(null);
  vi.mocked(openDispute).mockResolvedValue({ transactionHash: 'abc' });
});

describe('dashboard dispute state', () => {
  it('renders a disputed commitment as frozen with no settle/exit actions', async () => {
    render(<DashboardPage />);
    await screen.findByText('CMT-DISPUTED');
    const card = screen.getByText('CMT-DISPUTED').closest('.commit')!;
    expect(card).toBeDefined();
    const buttons = Array.from(card.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).not.toContain('Settle');
    expect(buttons).not.toContain('Early exit');
    expect(buttons).toContain('Frozen');
    await waitFor(() =>
      expect(
        screen.getByText(
          'Frozen. Only the operator can release or refund the funds after resolving the dispute.',
        ),
      ).toBeDefined(),
    );
  });

  it('shows a Report a problem button for active commitments owned by the connected wallet', async () => {
    render(<DashboardPage />);
    await screen.findByText('CMT-ACTIVE');
    const btn = screen.getByRole('button', { name: 'Report a problem' });
    expect(btn).toBeDefined();
  });

  it('submits a dispute when the owner reports a problem', async () => {
    const user = userEvent.setup();
    vi.mocked(getDispute).mockResolvedValue({
      reasonCategory: 2,
      reasonText: 'payout mismatch',
      disputedAt: new Date(),
      disputedBy: 'GCALLER',
    });

    render(<DashboardPage />);
    await screen.findByText('CMT-ACTIVE');
    await user.click(screen.getByRole('button', { name: 'Report a problem' }));
    const dialog = screen.getByRole('dialog', { name: 'Report a problem' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason' }), 'payout mismatch');
    await user.click(within(dialog).getByRole('button', { name: 'Report problem' }));
    await waitFor(() => expect(openDispute).toHaveBeenCalled());
    expect(openDispute).toHaveBeenCalledWith({
      commitmentId: 'CMT-ACTIVE',
      caller: expect.any(String),
      reason: 'payout mismatch',
    });
    await waitFor(() =>
      expect(
        screen.getByText('Commitment CMT-ACTIVE is now disputed — funds are frozen until resolved.'),
      ).toBeDefined(),
    );
  });
});
