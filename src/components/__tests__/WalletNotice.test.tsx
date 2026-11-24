import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletNotice } from '../WalletNotice';
import { useWallet, WalletProvider } from '../WalletProvider';

const { connectFreighterMock } = vi.hoisted(() => ({
  connectFreighterMock: vi.fn(),
}));

vi.mock('@/lib/wallet', () => ({ connectFreighter: connectFreighterMock }));

function ConnectWalletButton() {
  const { connect } = useWallet();
  return (
    <button type="button" onClick={() => void connect()}>
      Connect wallet
    </button>
  );
}

describe('WalletNotice', () => {
  beforeEach(() => {
    connectFreighterMock.mockReset();
  });

  it('renders the fallback message when the wallet is unavailable', async () => {
    connectFreighterMock.mockResolvedValue({
      status: 'unavailable',
      address: null,
      message: 'Freighter extension not detected. Install it from freighter.app to connect.',
    });
    render(
      <WalletProvider>
        <WalletNotice />
        <ConnectWalletButton />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));

    expect((await screen.findByRole('status')).textContent).toBe(
      'Freighter extension not detected. Install it from freighter.app to connect.',
    );
  });
});
