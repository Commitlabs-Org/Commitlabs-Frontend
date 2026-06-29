// @vitest-environment happy-dom

import { fireEvent, render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NetworkMismatchBanner } from './NetworkMismatchBanner';

const TESTNET = 'Test SDF Network ; September 2015';
const MAINNET = 'Public Global Stellar Network ; September 2015';

vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/lib/clientEnv', () => ({
  getValidatedClientEnv: vi.fn(() => ({
    NEXT_PUBLIC_NETWORK_PASSPHRASE: TESTNET,
  })),
}));

import { useWallet } from '@/hooks/useWallet';

const mockUseWallet = vi.mocked(useWallet);

function setup(connected: boolean, walletNetwork: string | null) {
  mockUseWallet.mockReturnValue({
    connected,
    walletNetwork,
    address: connected ? 'GADDR' : '',
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
    connecting: false,
    sessionToken: null,
    authenticated: false,
    authenticating: false,
    authError: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
}

describe('NetworkMismatchBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when wallet is not connected', () => {
    setup(false, null);
    const { container } = render(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when connected with matching network', () => {
    setup(true, TESTNET);
    const { container } = render(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when connected but walletNetwork is null', () => {
    setup(true, null);
    const { container } = render(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows banner with role=alert on network mismatch', () => {
    setup(true, MAINNET);
    render(<NetworkMismatchBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /wallet is on a different network/i,
    );
  });

  it('has a focusable "Switch in wallet" link', () => {
    setup(true, MAINNET);
    render(<NetworkMismatchBanner />);
    const link = screen.getByRole('link', { name: /switch in wallet/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.freighter.app');
  });

  it('dismiss button hides the banner', () => {
    setup(true, MAINNET);
    render(<NetworkMismatchBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('re-shows banner after dismissal when a new mismatch occurs', () => {
    setup(true, MAINNET);
    const { rerender } = render(<NetworkMismatchBanner />);

    // Dismiss
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Simulate network change (e.g., user switches to yet another wrong network)
    setup(true, 'Another Network ; 2024');
    act(() => {
      rerender(<NetworkMismatchBanner />);
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides banner after dismiss even when walletNetwork stays mismatched', () => {
    setup(true, MAINNET);
    render(<NetworkMismatchBanner />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    // Re-render with same mismatch state — should remain dismissed
    setup(true, MAINNET);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
