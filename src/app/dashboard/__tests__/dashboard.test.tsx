import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Commitment } from '@/lib/commitments';
import DashboardPage from '../page';
import { getDispute, openDispute, earlyExitCommitment } from '@/lib/soroban/escrow';
import { useProtocolParams } from '@/lib/protocol';
import { useProtocolStatus } from '@/components/ProtocolStatusProvider';
import { TxError } from '@/lib/soroban/errors';
import { penaltyOf, formatAmount } from '@/lib/amount';

vi.mock('@/lib/commitments', async (orig) => ({
  ...(await orig<typeof import('@/lib/commitments')>()),
  loadCommitments: () => ({ items: seed, dropped: 0, corrupt: false, storageUnavailable: false }),
  saveCommitments: vi.fn(),
}));
vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ status: 'connected', address: 'GCALLER', message: null }),
}));
vi.mock('@/components/ProtocolStatusProvider', () => ({
  useProtocolStatus: () => ({
    status: 'ok',
    paused: false,
    yieldPool: 100_000_000n,
    fetchedAt: null,
    refresh: async () => {},
  }),
}));
vi.mock('@/lib/wallet', () => ({
  fetchXlmBalance: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/soroban/escrow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/soroban/escrow')>();
  return {
    ...actual,
    getDispute: vi.fn(),
    openDispute: vi.fn(),
    earlyExitCommitment: vi.fn(),
    MAX_DISPUTE_REASON: 1000,
  };
});
vi.mock('@/lib/protocol', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/protocol')>();
  return {
    ...actual,
    useProtocolParams: vi.fn(),
  };
});
vi.mock('@/components/ProtocolStatusProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ProtocolStatusProvider')>();
  return {
    ...actual,
    useProtocolStatus: vi.fn(),
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
    { ...base, id: 'CMT-DISPUTED', amount: '5000000000', durationDays: 30, createdAt: now - 10 * DAY, status: 'disputed' } as Commitment,
    { ...base, id: 'CMT-ACTIVE', amount: '10000000000', durationDays: 100, createdAt: now - 40 * DAY, status: 'active' } as Commitment,
  ];
  vi.mocked(getDispute).mockResolvedValue(null);
  vi.mocked(openDispute).mockResolvedValue({ transactionHash: 'abc' });
  vi.mocked(earlyExitCommitment).mockResolvedValue({
    transactionHash: 'exit-tx-hash',
    exitAmount: 9_500_000_000n,
    penaltyAmount: 500_000_000n,
    finalStatus: 'Exited',
  });
  vi.mocked(useProtocolParams).mockReturnValue({
    params: {
      penalties: { safe: 200, balanced: 500, aggressive: 1000 },
      gracePeriodSeconds: 0,
      isFallback: false,
    },
    loading: false,
    isFallback: false,
    refresh: vi.fn(),
  });
  vi.mocked(useProtocolStatus).mockReturnValue({
    status: 'ok',
    paused: false,
    yieldPool: 1_000_000_000_000n,
    fetchedAt: Date.now(),
  });
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

  it('uses accrued_yield for the near-maturity coverage warning', async () => {
    seed = [
      {
        ...base,
        id: 'CMT-ACCRUED-YIELD',
        amount: '5000000000',
        durationDays: 30,
        createdAt: now - 25 * DAY,
        status: 'active',
        accrued_yield: '200000000',
      } as Commitment,
    ];

    render(<DashboardPage />);

    expect(await screen.findByTestId('yield-coverage-warning')).toBeDefined();
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

describe('dashboard on-chain early exit', () => {
  it('shows zero penalty preview inside the grace period', async () => {
    const user = userEvent.setup();
    seed = [
      {
        ...base,
        id: '42',
        amount: '10000000000',
        durationDays: 30,
        createdAt: Date.now() - 60_000, // 1 minute ago
        status: 'active',
      } as Commitment,
    ];
    vi.mocked(useProtocolParams).mockReturnValue({
      params: {
        penalties: { safe: 200, balanced: 500, aggressive: 1000 },
        gracePeriodSeconds: 3600, // 1 hour grace window
        isFallback: false,
      },
      loading: false,
      isFallback: false,
      refresh: vi.fn(),
    });

    render(<DashboardPage />);
    await screen.findByText('#42');
    await user.click(screen.getByRole('button', { name: 'Early exit' }));

    const dialog = screen.getByRole('dialog', { name: 'Exit early?' });
    expect(within(dialog).getByText(/waived by grace period/i)).toBeDefined();
    expect(within(dialog).getByText('0 USDC')).toBeDefined();
    expect(within(dialog).getAllByText('1,000 USDC').length).toBeGreaterThanOrEqual(2);
  });

  it('computes preview with penaltyOf(amount, penalty) outside the grace period', async () => {
    const user = userEvent.setup();
    const amount = '10000000000';
    seed = [
      {
        ...base,
        id: '42',
        amount,
        penalty: 5,
        durationDays: 30,
        createdAt: Date.now() - 2 * 3600_000, // 2 hours ago
        status: 'active',
      } as Commitment,
    ];
    vi.mocked(useProtocolParams).mockReturnValue({
      params: {
        penalties: { safe: 200, balanced: 500, aggressive: 1000 },
        gracePeriodSeconds: 3600, // 1 hour grace window
        isFallback: false,
      },
      loading: false,
      isFallback: false,
      refresh: vi.fn(),
    });

    render(<DashboardPage />);
    await screen.findByText('#42');
    await user.click(screen.getByRole('button', { name: 'Early exit' }));

    const expectedPenalty = penaltyOf(BigInt(amount), 5);
    const expectedReturned = BigInt(amount) - expectedPenalty;
    const dialog = screen.getByRole('dialog', { name: 'Exit early?' });
    expect(within(dialog).getByText('5%')).toBeDefined();
    expect(within(dialog).getByText(`${formatAmount(expectedPenalty)} USDC`)).toBeDefined();
    expect(within(dialog).getByText(`${formatAmount(expectedReturned)} USDC`)).toBeDefined();
  });

  it('uses contract-returned penalty_amount and exit_amount (not estimate) and shows explorer link', async () => {
    const user = userEvent.setup();
    seed = [
      {
        ...base,
        id: '42',
        amount: '10000000000', // 1,000 USDC; estimate at 5% would be 50 USDC penalty
        penalty: 5,
        durationDays: 30,
        createdAt: Date.now() - 10 * DAY,
        status: 'active',
      } as Commitment,
    ];
    // Contract returns 12.5 USDC penalty and 987.5 USDC returned (different from 50 USDC estimate)
    vi.mocked(earlyExitCommitment).mockResolvedValue({
      transactionHash: 'abc123exithash',
      exitAmount: 9_875_000_000n,
      penaltyAmount: 125_000_000n,
      finalStatus: 'Exited',
    });

    render(<DashboardPage />);
    await screen.findByText('#42');
    await user.click(screen.getByRole('button', { name: 'Early exit' }));
    const dialog = screen.getByRole('dialog', { name: 'Exit early?' });
    await user.click(within(dialog).getByRole('button', { name: 'Exit early' }));

    await waitFor(() =>
      expect(earlyExitCommitment).toHaveBeenCalledWith({
        commitmentId: '42',
        caller: 'GCALLER',
      }),
    );

    await waitFor(() => {
      const card = screen.getByText('#42').closest('.commit')!;
      expect(card.textContent).toContain('exited');
      expect(card.textContent).toContain('987.5 USDC returned');
      expect(card.textContent).toContain('12.5 USDC penalty paid');
      expect(card.textContent).not.toContain('50 USDC penalty paid');
      const link = within(card as HTMLElement).getByRole('link', { name: 'View transaction' });
      expect(link.getAttribute('href')).toContain('abc123exithash');
    });
  });

  it('disables Early exit button while contract is paused', async () => {
    seed = [
      {
        ...base,
        id: '42',
        amount: '10000000000',
        durationDays: 30,
        createdAt: Date.now() - 10 * DAY,
        status: 'active',
      } as Commitment,
    ];
    vi.mocked(useProtocolStatus).mockReturnValue({
      status: 'ok',
      paused: true,
      yieldPool: 1_000_000_000_000n,
      fetchedAt: Date.now(),
    });

    render(<DashboardPage />);
    await screen.findByText('#42');
    const btn = screen.getByRole('button', { name: 'Early exit' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('keeps card active after a rejected signature', async () => {
    const user = userEvent.setup();
    seed = [
      {
        ...base,
        id: '42',
        amount: '10000000000',
        durationDays: 30,
        createdAt: Date.now() - 10 * DAY,
        status: 'active',
      } as Commitment,
    ];
    vi.mocked(earlyExitCommitment).mockRejectedValue(
      new TxError('rejected', 'User declined signature.'),
    );

    render(<DashboardPage />);
    await screen.findByText('#42');
    await user.click(screen.getByRole('button', { name: 'Early exit' }));
    const dialog = screen.getByRole('dialog', { name: 'Exit early?' });
    await user.click(within(dialog).getByRole('button', { name: 'Exit early' }));

    await waitFor(() => expect(earlyExitCommitment).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());

    const card = screen.getByText('#42').closest('.commit')!;
    expect(card.textContent).toContain('active');
    expect(card.textContent).not.toContain('exited');
  });
});
