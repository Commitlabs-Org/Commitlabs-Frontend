import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DocsPage from './page';
import { CONTRACT_ERRORS } from '@/lib/soroban/errors';
import { ACTION_POLICIES } from '@/lib/soroban/protocol-policy';

vi.mock('./DocsTypesTable', () => ({
  DocsTypesTable: () => <table><tbody /></table>,
}));

describe('Documentation tables', () => {
  it('renders one error row for every CONTRACT_ERRORS entry', () => {
    const { container } = render(<DocsPage />);
    const errorsHeading = container.querySelector('#errors');
    const errorsWrap = errorsHeading?.nextElementSibling;
    const rows = errorsWrap?.querySelectorAll('tbody tr');

    expect(rows).toHaveLength(Object.keys(CONTRACT_ERRORS).length);
  });

  it('shows the BelowMinimum hint', () => {
    render(<DocsPage />);
    const belowMinimum = screen.getByText('BelowMinimum');
    const row = belowMinimum.closest('tr');

    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText(CONTRACT_ERRORS[22].hint)).toBeTruthy();
  });

  it('marks release and settle as not blocked when paused', () => {
    render(<DocsPage />);

    for (const action of ['release', 'settle'] as const) {
      const actionCell = screen.getByText(action);
      const row = actionCell.closest('tr');
      expect(row).not.toBeNull();
      expect(within(row as HTMLTableRowElement).getByText('No')).toBeTruthy();
      expect(ACTION_POLICIES[action].pausedBlocked).toBe(false);
    }
  });

  it('provides error and pause anchors in the docs navigation', () => {
    render(<DocsPage />);

    expect(document.querySelector('aside.toc a[href="#errors"]')).not.toBeNull();
    expect(document.querySelector('aside.toc a[href="#pause"]')).not.toBeNull();
    expect(document.querySelector('#errors')).not.toBeNull();
    expect(document.querySelector('#pause')).not.toBeNull();
  });
});
