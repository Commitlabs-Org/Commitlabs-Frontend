import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletState } from '@/lib/wallet';
import { useWallet, WalletProvider } from '../WalletProvider';

const { connectFreighterMock } = vi.hoisted(() => ({
  connectFreighterMock: vi.fn(),
}));

vi.mock('@/lib/wallet', () => ({ connectFreighter: connectFreighterMock }));

function WalletConsumer() {
  const { status, address, connect } = useWallet();
  return (
    <>
      <p role="status" aria-label="Wallet status">
        {status}
      </p>
      {address && <p aria-label="Wallet address">{address}</p>}
      <button type="button" onClick={() => void connect()}>
        Connect wallet
      </button>
    </>
  );
}

describe('WalletProvider', () => {
  beforeEach(() => {
    connectFreighterMock.mockReset();
  });

  it('transitions from idle to connecting to connected', async () => {
    let resolveConnection!: (state: WalletState) => void;
    connectFreighterMock.mockReturnValue(
      new Promise<WalletState>((resolve) => {
        resolveConnection = resolve;
      }),
    );
    render(
      <WalletProvider>
        <WalletConsumer />
      </WalletProvider>,
    );

    expect(screen.getByRole('status', { name: 'Wallet status' }).textContent).toBe('idle');
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    expect(screen.getByRole('status', { name: 'Wallet status' }).textContent).toBe('connecting');

    await act(async () => {
      resolveConnection({ status: 'connected', address: 'GABC1234XYZW5678', message: null });
    });

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Wallet status' }).textContent).toBe('connected');
    });
    expect(screen.getByLabelText('Wallet address').textContent).toBe('GABC1234XYZW5678');
    expect(connectFreighterMock).toHaveBeenCalledTimes(1);
  });

  it('throws when useWallet is used outside the provider', () => {
    function OutsideProvider() {
      useWallet();
      return null;
    }

    expect(() => render(<OutsideProvider />)).toThrow(
      'useWallet must be used inside WalletProvider',
    );
  });
});
