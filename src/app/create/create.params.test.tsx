import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatePage from './page';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H' }),
}));

vi.mock('@/lib/protocol', () => ({
  useProtocolParams: vi.fn(),
  FALLBACK_PROTOCOL_PARAMS: {
    penalties: { safe: 200, balanced: 500, aggressive: 1000 },
    gracePeriodSeconds: 0,
    isFallback: true,
  },
}));

import { useProtocolParams } from '@/lib/protocol';

describe('Create Wizard Component with Protocol Params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders review step showing on-chain penalty and projected yield from mocked params', async () => {
    vi.mocked(useProtocolParams).mockReturnValue({
      params: {
        penalties: {
          safe: 200, // 2%
          balanced: 500, // 5%
          aggressive: 1000, // 10%
        },
        gracePeriodSeconds: 0,
        isFallback: false,
      },
      loading: false,
      isFallback: false,
      refresh: vi.fn(),
    });

    render(<CreatePage />);

    // Step 0: Type - default is 'balanced'
    expect(screen.getByText('7% APY')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 1: Configure
    expect(screen.getByRole('heading', { name: 'Configure' })).toBeDefined();
    // Default amount: 1000, days: 30
    // Yield for 1000 USDC, 30 days, Balanced (700 bps):
    // 1000 * 10^7 = 10^10 stroops. (10^10 * 700 * 30)/365 / 10000 = 57534246 stroops = 5.7534246 USDC
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    // Step 2: Review
    expect(screen.getByRole('heading', { name: 'Review' })).toBeDefined();

    // Verify displayed APY matches contract constant (7%)
    expect(screen.getByText('7%')).toBeDefined();

    // Verify on-chain penalty and penalty amount
    // 5% of 1000 = 50 USDC
    expect(screen.getByText('5% (50 USDC)')).toBeDefined();

    // Verify projected yield matches integer formula: 5.7534246 USDC
    expect(screen.getByText('5.7534246 USDC')).toBeDefined();
  });

  it('displays fallback notice when params are unverified on-chain', async () => {
    vi.mocked(useProtocolParams).mockReturnValue({
      params: {
        penalties: {
          safe: 200,
          balanced: 500,
          aggressive: 1000,
        },
        gracePeriodSeconds: 0,
        isFallback: true,
      },
      loading: false,
      isFallback: true,
      refresh: vi.fn(),
    });

    render(<CreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByText(/Could not verify on-chain parameters. Displaying default protocol parameters./i)
    ).toBeDefined();
  });
});
