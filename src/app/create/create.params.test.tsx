import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCommitments } from '@/lib/commitments';
import CreatePage from './page';

const mockUseWallet = vi.fn<() => { address: string | null }>(() => ({
  address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
}));

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock('@/components/NetworkProvider', () => ({
  useNetwork: () => ({
    config: {
      network: 'testnet',
      networkDetails: {
        label: 'Testnet',
        explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
      },
      escrowContractId: 'CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4',
      escrowTokenId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      isContractConfigured: true,
    },
    isContractConfigured: true,
  }),
}));

const mockCreateAndFund = vi.fn();
const mockFundCommitment = vi.fn();
vi.mock('@/lib/soroban/create', () => ({
  createAndFundCommitment: (...args: unknown[]) => mockCreateAndFund(...args),
  fundCommitment: (...args: unknown[]) => mockFundCommitment(...args),
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
    window.localStorage.clear();
    mockUseWallet.mockReturnValue({
      address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    });
  });

  afterEach(cleanup);

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

  it('saves locally in demo mode when no wallet is connected', () => {
    mockUseWallet.mockReturnValue({ address: null });
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

    render(<CreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create commitment' }));

    expect(mockCreateAndFund).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Commitment created' })).toBeDefined();
    const [saved] = loadCommitments().items;
    expect(saved.txHash).toBeNull();
  });

  it('blocks submit while on-chain transaction is pending and shows explorer link on success', async () => {
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

    let resolveTx!: (val: unknown) => void;
    mockCreateAndFund.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTx = resolve;
        })
    );

    render(<CreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('checkbox'));

    const submitBtn = screen.getByRole('button', { name: 'Create commitment' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const pendingBtn = screen.getByRole('button', { name: 'Creating…' }) as HTMLButtonElement;
      expect(pendingBtn.disabled).toBe(true);
    });

    const txHash = 'c'.repeat(64);
    resolveTx({
      status: 'funded',
      commitmentId: '77',
      createTxHash: txHash,
      fundTxHash: txHash,
      txHash,
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Commitment created' })).toBeDefined();
    });

    const [saved] = loadCommitments().items;
    expect(saved.id).toBe('77');
    expect(saved.txHash).toBe(txHash);
    expect(screen.getByRole('link', { name: /View transaction on Stellar Expert/i })).toBeDefined();
  });
});
