// @vitest-environment happy-dom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CommitmentCreatedModal from '@/components/modals/CommitmentCreatedModal';

describe('CommitmentCreatedModal', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('renders the canonical success modal content and actions', () => {
    const onViewCommitment = vi.fn();
    const onCreateAnother = vi.fn();
    const onClose = vi.fn();
    const onViewOnExplorer = vi.fn();

    render(
      <CommitmentCreatedModal
        isOpen
        commitmentId="CMT-ABC1234"
        onViewCommitment={onViewCommitment}
        onCreateAnother={onCreateAnother}
        onClose={onClose}
        onViewOnExplorer={onViewOnExplorer}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Commitment Created' })).toBeTruthy();
    expect(screen.getByText('Your liquidity commitment is active and available in your dashboard.')).toBeTruthy();
    expect(screen.getByText('CMT-ABC1234')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Commitment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Another' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View on Stellar Explorer' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View Commitment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Another' }));
    fireEvent.click(screen.getByRole('button', { name: 'View on Stellar Explorer' }));

    expect(onViewCommitment).toHaveBeenCalledTimes(1);
    expect(onCreateAnother).toHaveBeenCalledTimes(1);
    expect(onViewOnExplorer).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('hidden');
  });
});
