import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: { isContractConfigured: false, escrowContractId: '' },
}));

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ status: 'idle', address: null, message: null }),
}));

import ProtocolPage from '../page';

describe('ProtocolPage', () => {
  it('renders the contract-not-configured state when no escrow contract is set', async () => {
    render(<ProtocolPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Protocol health' })).toBeTruthy();
    expect(await screen.findByText('Contract not configured')).toBeTruthy();
    expect(screen.queryByText('Yield pool')).toBeNull();
  });
});
