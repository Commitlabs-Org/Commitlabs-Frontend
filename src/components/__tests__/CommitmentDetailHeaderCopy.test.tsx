/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommitmentDetailHeader from '@/components/Commitmentdetailheader';

const validContractId = `C${'B'.repeat(55)}`;

const defaultProps = {
  commitmentId: validContractId,
  statusLabel: 'Active',
  statusVariant: 'active',
  onBack: vi.fn(),
  onShare: vi.fn(),
} satisfies React.ComponentProps<typeof CommitmentDetailHeader>;

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof CommitmentDetailHeader>> = {},
) {
  const props = {
    ...defaultProps,
    onBack: vi.fn(),
    onShare: vi.fn(),
    ...overrides,
  };

  const view = render(<CommitmentDetailHeader {...props} />);
  return { props, ...view };
}

describe('CommitmentDetailHeader copy and explorer actions', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('copies the full commitment id instead of the rendered or truncated text', async () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Copy commitment ID' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(validContractId);
    });
  });

  it('shows a copied confirmation after a successful copy', async () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Copy commitment ID' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
    expect(screen.getByRole('button', { name: 'Copy commitment ID' })).toHaveTextContent(
      'Copied',
    );
  });

  it('renders a sanitized explorer link with anti-tabnabbing attributes', () => {
    renderHeader({ explorerNetwork: 'testnet' });

    const link = screen.getByRole('link', {
      name: 'Open commitment in Stellar explorer',
    }) as HTMLAnchorElement;

    expect(link.href).toBe(
      `https://stellar.expert/explorer/testnet/contract/${validContractId}`,
    );
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
  });

  it('does not render an explorer link for an invalid commitment id', () => {
    renderHeader({ commitmentId: 'CMT-001' });

    expect(
      screen.queryByRole('link', { name: 'Open commitment in Stellar explorer' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Explorer link unavailable for this commitment' }),
    ).toBeDisabled();
  });

  it('shows a graceful status when the clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Copy commitment ID' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Clipboard unavailable',
    );
  });

  it('keeps the existing back and share controls working', () => {
    const { props } = renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Go back to My Commitments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share commitment' }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });
});
