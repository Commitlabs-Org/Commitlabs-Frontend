/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccountWalletSection } from './AccountWalletSection';

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(() => ({
    connected: false,
    address: '',
    connect: mockConnect,
    disconnect: mockDisconnect,
  })),
}));

vi.mock('@/utils/explorerLinks', () => ({
  buildExplorerUrl: vi.fn((_kind: string, address: string | undefined, _network: string) =>
    address ? `https://stellar.expert/explorer/public/account/${address}` : null,
  ),
}));

vi.mock('../WalletConnectButton', () => ({
  WalletConnectButton: () => <button>Connect Wallet</button>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <section {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</section>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import { useWallet } from '@/hooks/useWallet';

const mockedUseWallet = vi.mocked(useWallet);

const MOCK_ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV';

const setConnectedWallet = (overrides: Partial<ReturnType<typeof useWallet>> = {}) => {
  mockedUseWallet.mockReturnValue({
    connected: true,
    address: MOCK_ADDRESS,
    connect: mockConnect,
    disconnect: mockDisconnect,
    error: null,
    connecting: false,
    sessionToken: null,
    authenticated: false,
    authenticating: false,
    authError: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    walletNetwork: null,
    ...overrides,
  });
};

const setDisconnectedWallet = () => {
  mockedUseWallet.mockReturnValue({
    connected: false,
    address: '',
    connect: mockConnect,
    disconnect: mockDisconnect,
    error: null,
    connecting: false,
    sessionToken: null,
    authenticated: false,
    authenticating: false,
    authError: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    walletNetwork: null,
  });
};

describe('AccountWalletSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders section title and description', () => {
    setDisconnectedWallet();
    render(<AccountWalletSection />);
    expect(screen.getByText('Account & Wallet')).toBeInTheDocument();
    expect(screen.getByText(/manage your wallet connection/i)).toBeInTheDocument();
  });

  describe('disconnected state', () => {
    beforeEach(() => setDisconnectedWallet());

    it('shows connect prompt when wallet is not connected', () => {
      render(<AccountWalletSection />);
      expect(screen.getByText(/connect your wallet to manage/i)).toBeInTheDocument();
    });

    it('renders the WalletConnectButton', () => {
      render(<AccountWalletSection />);
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });

    it('does not render the sign-out button', () => {
      render(<AccountWalletSection />);
      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    });
  });

  describe('connected-wallet display', () => {
    beforeEach(() => setConnectedWallet());

    it('renders the truncated wallet address', () => {
      render(<AccountWalletSection />);
      const truncated = `${MOCK_ADDRESS.slice(0, 4)}…${MOCK_ADDRESS.slice(-4)}`;
      expect(screen.getByText(truncated)).toBeInTheDocument();
    });

    it('shows the "Connected Address" label', () => {
      render(<AccountWalletSection />);
      expect(screen.getByText('Connected Address')).toBeInTheDocument();
    });

    it('renders a link to the Stellar Explorer', () => {
      render(<AccountWalletSection />);
      const explorerLink = screen.getByTitle('View on Stellar Explorer');
      expect(explorerLink).toBeInTheDocument();
      expect(explorerLink).toHaveAttribute(
        'href',
        `https://stellar.expert/explorer/public/account/${MOCK_ADDRESS}`,
      );
      expect(explorerLink).toHaveAttribute('target', '_blank');
    });

    it('renders the copy and sign-out buttons', () => {
      render(<AccountWalletSection />);
      expect(screen.getByTitle('Copy Address')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });

  describe('copy-address action', () => {
    beforeEach(() => setConnectedWallet());

    it('copies address to clipboard on success', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(<AccountWalletSection />);
      fireEvent.click(screen.getByTitle('Copy Address'));

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(MOCK_ADDRESS);
      });

      await waitFor(() => {
        expect(screen.getByTitle('Copied!')).toBeInTheDocument();
      });
    });

    it('logs error on clipboard failure', async () => {
      const clipboardError = new Error('Clipboard blocked');
      const writeTextMock = vi.fn().mockRejectedValue(clipboardError);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<AccountWalletSection />);
      fireEvent.click(screen.getByTitle('Copy Address'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy address:', clipboardError);
      });
    });

    it('does not attempt copy when address is empty', () => {
      setConnectedWallet({ address: '' });
      const writeTextMock = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(<AccountWalletSection />);
      const copyBtn = screen.getByTitle('Copy Address');
      fireEvent.click(copyBtn);

      expect(writeTextMock).not.toHaveBeenCalled();
    });
  });

  describe('sign-out action', () => {
    beforeEach(() => setConnectedWallet());

    it('calls logout API and disconnects on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      render(<AccountWalletSection />);
      fireEvent.click(screen.getByText('Sign Out'));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      });

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledOnce();
      });
    });

    it('logs error on sign-out failure and still resets state', async () => {
      const signOutError = new Error('Network error');
      const fetchMock = vi.fn().mockRejectedValue(signOutError);
      vi.stubGlobal('fetch', fetchMock);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<AccountWalletSection />);
      fireEvent.click(screen.getByText('Sign Out'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to sign out:', signOutError);
      });
    });

    it('disables sign-out button while signing out', async () => {
      const fetchMock = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100)),
      );
      vi.stubGlobal('fetch', fetchMock);

      render(<AccountWalletSection />);
      const btn = screen.getByText('Sign Out').closest('button')!;
      fireEvent.click(btn);

      await waitFor(() => {
        expect(btn).toBeDisabled();
      });
    });
  });
});
