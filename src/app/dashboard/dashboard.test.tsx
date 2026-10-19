import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DashboardPage from './page';

type WalletState = { address: string | null; connected: boolean };

const mockWallet = vi.fn<() => WalletState>();

vi.mock('@/lib/wallet', () => ({
  useWallet: () => mockWallet(),
}));

const now = Date.now();
const DAY = 86_400_000;

const seed = [
  {
    id: 'CMT-A',
    type: 'balanced' as const,
    asset: 'USDC',
    amount: 2500,
    durationDays: 30,
    maxLoss: 8,
    penalty: 5,
    apy: 9,
    createdAt: now - 2 * DAY,
    status: 'active' as const,
    owner: 'GAOAGENTA',
    txHash: null,
  },
  {
    id: 'CMT-B',
    type: 'safe' as const,
    asset: 'XLM',
    amount: 10000,
    durationDays: 14,
    maxLoss: 2,
    penalty: 3,
    apy: 4.5,
    createdAt: now - 1 * DAY,
    status: 'active' as const,
    owner: 'GBOAGENTB',
    txHash: null,
  },
  {
    id: 'CMT-C',
    type: 'safe' as const,
    asset: 'EURC',
    amount: 500,
    durationDays: 7,
    maxLoss: 2,
    penalty: 3,
    apy: 4.5,
    createdAt: now - 1 * DAY,
    status: 'active' as const,
    owner: null,
    txHash: null,
    demo: true,
  },
];

vi.mock('@/lib/commitments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/commitments')>();
  return {
    ...actual,
    loadCommitments: () => ({ items: seed, dropped: 0, corrupt: false, storageUnavailable: false }),
    subscribeCommitments: () => () => {},
  };
});

beforeEach(() => {
  cleanup();
  mockWallet.mockReturnValue({ address: null, connected: false });
});

describe('Dashboard owner scoping', () => {
  it('shows only demo items when disconnected', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.queryByText('GBOAGENTB')).toBeNull();
  });

  it('shows wallet A owned items plus demo', () => {
    mockWallet.mockReturnValue({ address: 'GAOAGENTA', connected: true });
    render(<DashboardPage />);
    expect(screen.getByText('Your commitments')).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();
  });

  it('switches list when wallet changes', () => {
    mockWallet.mockReturnValue({ address: 'GBOAGENTB', connected: true });
    render(<DashboardPage />);
    expect(screen.getByText('Your commitments')).toBeInTheDocument();
  });
});
