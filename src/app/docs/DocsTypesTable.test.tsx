import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TYPES } from '@/lib/commitments';
import { DISPLAY_APY } from '@/lib/yield';
import { DocsTypesTable } from './DocsTypesTable';

const { mockPenalties } = vi.hoisted(() => ({
  mockPenalties: { safe: 200, balanced: 500, aggressive: 1000 },
}));

vi.mock('@/lib/protocol', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/protocol')>()),
  useProtocolParams: () => ({
    params: {
      penalties: mockPenalties,
      gracePeriodSeconds: 0,
      isFallback: false,
    },
    loading: false,
    isFallback: false,
    refresh: vi.fn(),
  }),
}));

describe('DocsTypesTable', () => {
  it('renders a row per TYPES entry with APY, penalty and min days', () => {
    render(<DocsTypesTable />);

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Type',
      'Target APY',
      'Max loss',
      'Early exit penalty',
      'Min lock',
    ]);

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(TYPES.length + 1);

    for (const type of TYPES) {
      const row = rows.find((candidate) =>
        within(candidate).queryByRole('cell', { name: type.name }),
      );
      expect(row).toBeDefined();

      const cells = within(row as HTMLTableRowElement).getAllByRole('cell');
      expect(cells.map((cell) => cell.textContent)).toEqual([
        type.name,
        `${DISPLAY_APY[type.id]}%`,
        `${type.maxLoss}%`,
        `${mockPenalties[type.id] / 100}%`,
        `${type.minDays} days`,
      ]);
      expect(mockPenalties[type.id] / 100).toBe(type.penalty);
    }
  });
});
