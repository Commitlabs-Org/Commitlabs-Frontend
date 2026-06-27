/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CommitmentDetailHeader from '@/components/Commitmentdetailheader';

const CONTRACT_ID = `C${'A'.repeat(55)}`;

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof CommitmentDetailHeader>> = {},
) {
  return render(
    <CommitmentDetailHeader
      commitmentId="internal-commitment-id-that-is-long-enough-to-truncate"
      statusLabel="Active"
      statusVariant="active"
      onBack={vi.fn()}
      onShare={vi.fn()}
      explorerId={CONTRACT_ID}
      {...overrides}
    />,
  );
}

describe('CommitmentDetailHeader copy and explorer actions', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('copies the full commitment id', async () => {
    const commitmentId = 'commitment-id-with-full-value';

    renderHeader({ commitmentId });
    fireEvent.click(screen.getByRole('button', { name: 'Copy full commitment id' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(commitmentId);
    });
  });

  it('shows a transient copied confirmation', async () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Copy full commitment id' }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Commitment id copied');
  });

  it('builds a sanitized Stellar Explorer link', () => {
    renderHeader({ explorerNetwork: 'testnet' });

    const link = screen.getByRole('link', { name: 'Open commitment on Stellar Explorer' });
    expect(link).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('does not render an explorer link for invalid identifiers', () => {
    renderHeader({ explorerId: 'not-a-contract-id' });

    expect(screen.queryByRole('link', { name: 'Open commitment on Stellar Explorer' })).toBeNull();
  });

  it('disables copy gracefully when clipboard is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    renderHeader();

    expect(screen.getByRole('button', { name: 'Copy full commitment id' })).toBeDisabled();
  });
});
