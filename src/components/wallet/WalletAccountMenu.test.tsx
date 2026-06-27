// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { WalletAccountMenu } from './WalletAccountMenu';
import { getAddress } from '@stellar/freighter-api';

vi.mock('@stellar/freighter-api', () => ({
  getAddress: vi.fn(),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

const mockedGetAddress = vi.mocked(getAddress);
const mockedFetch = vi.mocked(global.fetch);

describe('WalletAccountMenu', () => {
  beforeEach(() => {
    mockedGetAddress.mockReset();
    mockedFetch.mockReset();
    // Default mock for protocol constants
    mockedFetch.mockImplementation((url) => {
      if (url === '/api/protocol/constants') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ network: 'testnet' }),
        } as Response);
      }
      if (url === '/api/auth/logout') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Logged out successfully' }),
        } as Response);
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  it('shows a connect button and Freighter error when Freighter is not installed', async () => {
    mockedGetAddress.mockResolvedValueOnce({
      error: 'Freighter not installed',
    });

    render(<WalletAccountMenu />);

    const connectButton = await screen.findByRole('button', {
      name: /connect wallet/i,
    });
    expect(connectButton).toBeEnabled();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Freighter is not available/i,
    );
  });

  it('shows connecting state while the connection request is pending', async () => {
    let resolvePromise: (value: unknown) => void = () => undefined;
    mockedGetAddress
      .mockResolvedValueOnce({ error: 'Freighter not installed' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

    render(<WalletAccountMenu />);

    const connectButton = await screen.findByRole('button', {
      name: /connect wallet/i,
    });
    fireEvent.click(connectButton);

    expect(connectButton).toBeDisabled();
    expect(connectButton).toHaveTextContent(/connecting/i);

    resolvePromise({ address: 'GABCD1234EFGH5678IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOP' });
    await waitFor(() =>
      expect(screen.getByText(/GABC…MNOP/)).toBeInTheDocument(),
    );
  });

  it('renders connected address, network, explorer link, and allows disconnecting', async () => {
    mockedGetAddress.mockResolvedValueOnce({
      address: 'GABCD1234EFGH5678IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOP',
    });

    render(<WalletAccountMenu />);

    await waitFor(() =>
      expect(screen.getByText(/GABC…MNOP/)).toBeInTheDocument(),
    );

    const accountButton = screen.getByRole('button', {
      name: /connected wallet/i,
    });
    fireEvent.click(accountButton);

    // Check network is shown
    expect(await screen.findByText(/Testnet/i)).toBeInTheDocument();

    // Check explorer link is present
    expect(
      screen.getByRole('menuitem', { name: /View on Stellar.Expert/i }),
    ).toBeInTheDocument();

    // Check disconnect button
    const disconnectButton = screen.getByRole('menuitem', {
      name: /Disconnect/i,
    });
    fireEvent.click(disconnectButton);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /connect wallet/i }),
      ).toBeInTheDocument(),
    );

    // Check that logout API was called
    expect(mockedFetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    });
  });

  it('copies address to clipboard when copy button is clicked', async () => {
    mockedGetAddress.mockResolvedValueOnce({
      address: 'GABCD1234EFGH5678IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOP',
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<WalletAccountMenu />);

    await waitFor(() =>
      expect(screen.getByText(/GABC…MNOP/)).toBeInTheDocument(),
    );

    const accountButton = screen.getByRole('button', {
      name: /connected wallet/i,
    });
    fireEvent.click(accountButton);

    const copyButton = screen.getByRole('button', { name: /Copy address/i });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'GABCD1234EFGH5678IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOP',
    );

    // Check "Copied!" message appears
    await waitFor(() => expect(screen.getByText(/Copied!/i)).toBeInTheDocument());
  });

  it('closes menu when Escape key is pressed', async () => {
    mockedGetAddress.mockResolvedValueOnce({
      address: 'GABCD1234EFGH5678IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOP',
    });

    render(<WalletAccountMenu />);

    await waitFor(() =>
      expect(screen.getByText(/GABC…MNOP/)).toBeInTheDocument(),
    );

    const accountButton = screen.getByRole('button', {
      name: /connected wallet/i,
    });
    fireEvent.click(accountButton);

    // Check menu is open
    expect(screen.getByText(/Testnet/i)).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    // Check menu is closed
    await waitFor(() =>
      expect(screen.queryByText(/Testnet/i)).not.toBeInTheDocument(),
    );
  });

  it('shows a recovery message when the user rejects the connection in Freighter', async () => {
    mockedGetAddress.mockResolvedValueOnce({ error: 'User rejected request' });

    render(<WalletAccountMenu />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Connection canceled in Freighter/i,
      ),
    );
  });
});
