// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette } from './CommandPalette';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({ address: null }),
}));

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (
    isOpen ? <div>{children}</div> : null
  ),
}));

describe('CommandPalette command history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('records selected commands and shows them in a recent section', () => {
    const onClose = vi.fn();
    const { unmount } = render(<CommandPalette isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText('Create Commitment'));

    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/create');

    unmount();
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getAllByText('Create Commitment')).toHaveLength(2);
  });

  it('ranks frequent commands ahead of merely recent commands', () => {
    const { unmount } = render(<CommandPalette isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Marketplace'));
    fireEvent.click(screen.getByText('Create Commitment'));
    fireEvent.click(screen.getByText('Create Commitment'));

    unmount();
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');

    expect(options[0]).toHaveTextContent('Create Commitment');
  });
});
