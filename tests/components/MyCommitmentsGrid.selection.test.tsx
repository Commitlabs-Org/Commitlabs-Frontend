// @vitest-environment happy-dom
/**
 * Selection (bulk-select) integration tests for MyCommitmentsGrid.
 *
 * These tests verify the end-to-end selection flow:
 *   - Each MyCommitmentCard receives isSelected / onSelect props from the grid.
 *   - Checking a card's checkbox toggles its selected state in the grid.
 *   - Unchecking a selected card removes it from the selection.
 *   - Multiple cards can be independently selected/deselected.
 *   - The "Select all" checkbox in the grid header selects/deselects all cards.
 *   - The selected count indicator reflects the current selection size.
 */

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import MyCommitmentsGrid from '../../src/components/MyCommitmentsGrid';
import { makeCommitment } from '../fixtures';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildCommitments(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeCommitment({
      id: `CMT-${String(i + 1).padStart(3, '0')}`,
      type: i % 2 === 0 ? 'Safe' : 'Balanced',
    }),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the selection checkbox for a specific card by its commitment id. */
function getCardCheckbox(id: string): HTMLInputElement {
  return screen.getByRole('checkbox', {
    name: new RegExp(`select commitment ${id}`, 'i'),
  }) as HTMLInputElement;
}

/** Returns the "Select all" header checkbox. */
function getSelectAllCheckbox(): HTMLInputElement {
  return screen.getByRole('checkbox', {
    name: /select all commitments/i,
  }) as HTMLInputElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyCommitmentsGrid — selection (bulk-select)', () => {
  // ── isSelected prop wired to card checkbox ────────────────────────────────

  it('renders each card with an unchecked selection checkbox by default', () => {
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    expect(getCardCheckbox('CMT-001')).not.toBeChecked();
    expect(getCardCheckbox('CMT-002')).not.toBeChecked();
    expect(getCardCheckbox('CMT-003')).not.toBeChecked();
  });

  // ── Checking a card toggles it into the selected set ─────────────────────

  it('marks a card as selected when its checkbox is checked', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    const checkbox = getCardCheckbox('CMT-001');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('shows the selected-count indicator after selecting a card', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    // No "selected" indicator visible yet.
    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();

    await user.click(getCardCheckbox('CMT-001'));

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  });

  // ── Unchecking a selected card removes it from the selection ──────────────

  it('unmarks a card as selected when its checked checkbox is clicked again', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    const checkbox = getCardCheckbox('CMT-002');

    // Select then deselect.
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('removes the selected-count indicator when the only selected card is deselected', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    await user.click(getCardCheckbox('CMT-001'));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();

    await user.click(getCardCheckbox('CMT-001'));
    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
  });

  // ── Multiple independent selections ──────────────────────────────────────

  it('allows multiple cards to be independently selected', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    await user.click(getCardCheckbox('CMT-001'));
    await user.click(getCardCheckbox('CMT-003'));

    expect(getCardCheckbox('CMT-001')).toBeChecked();
    expect(getCardCheckbox('CMT-002')).not.toBeChecked();
    expect(getCardCheckbox('CMT-003')).toBeChecked();
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });

  it('selecting one card does not affect the others', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    await user.click(getCardCheckbox('CMT-002'));

    // Only CMT-002 is checked; CMT-001 and CMT-003 remain unchecked.
    expect(getCardCheckbox('CMT-001')).not.toBeChecked();
    expect(getCardCheckbox('CMT-002')).toBeChecked();
    expect(getCardCheckbox('CMT-003')).not.toBeChecked();
  });

  // ── Select-all header checkbox ────────────────────────────────────────────

  it('selects all cards when the header "Select all" checkbox is checked', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    await user.click(getSelectAllCheckbox());

    expect(getCardCheckbox('CMT-001')).toBeChecked();
    expect(getCardCheckbox('CMT-002')).toBeChecked();
    expect(getCardCheckbox('CMT-003')).toBeChecked();
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
  });

  it('deselects all cards when the header "Select all" checkbox is unchecked', async () => {
    const user = userEvent.setup();
    render(<MyCommitmentsGrid commitments={buildCommitments(3)} />);

    // Select all, then deselect all.
    await user.click(getSelectAllCheckbox());
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();

    await user.click(getSelectAllCheckbox());
    expect(getCardCheckbox('CMT-001')).not.toBeChecked();
    expect(getCardCheckbox('CMT-002')).not.toBeChecked();
    expect(getCardCheckbox('CMT-003')).not.toBeChecked();
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });

  // ── Card border styling reflects isSelected ───────────────────────────────

  it('applies the selected border/ring style when a card is checked', async () => {
    const user = userEvent.setup();
    const { container } = render(<MyCommitmentsGrid commitments={buildCommitments(1)} />);

    const cardRoot = container.querySelector('[class*="rounded-\\[16px\\]"]') as HTMLElement;
    expect(cardRoot.className).not.toMatch(/ring-/);

    await user.click(getCardCheckbox('CMT-001'));

    // After selection the card should carry the ring/border-teal class.
    expect(cardRoot.className).toMatch(/ring-/);
  });
});
