import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TxErrorNotice } from './TxErrorNotice';

afterEach(cleanup);

describe('TxErrorNotice', () => {
  it('renders the friendly message, recovery hint, and explorer link', () => {
    render(
      <TxErrorNotice
        error={{
          status: 'FAILED',
          message: 'Transaction failed',
          hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          resultMeta: { diagnosticEvents: ['Error(Contract, #13)'] },
        }}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'Your wallet does not hold enough XLM to fund this commitment.',
    );
    expect(
      screen.getByText('Add XLM to your wallet to cover the commitment and network fees.'),
    ).not.toBeNull();
    expect(screen.getByRole('link', { name: 'View transaction on stellar.expert' }).getAttribute('href')).toBe(
      'https://stellar.expert/explorer/testnet/tx/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  });

  it('keeps RPC-provided details as escaped text behind a disclosure', () => {
    render(<TxErrorNotice error={{ message: '<img src=x onerror=alert(1)>' }} />);

    expect(screen.getByRole('alert').querySelector('pre')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
    expect(screen.getByText('Show technical details').closest('details')).not.toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
