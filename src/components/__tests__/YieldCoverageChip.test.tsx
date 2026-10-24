import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YieldCoverageChip } from '../YieldCoverageChip';
import { COVERAGE_WARNING_MESSAGE } from '@/lib/soroban/protocol-status';

describe('YieldCoverageChip', () => {
  it('does not render when accrued_yield is below the pool', () => {
    const { container } = render(
      <YieldCoverageChip accruedYield={500n} yieldPool={1000n} />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('yield-coverage-warning')).toBeNull();
  });

  it('does not render when accrued_yield is equal to the pool', () => {
    const { container } = render(
      <YieldCoverageChip accruedYield={1000n} yieldPool={1000n} />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('yield-coverage-warning')).toBeNull();
  });

  it('renders warning chip when accrued_yield is above the pool', () => {
    render(
      <YieldCoverageChip accruedYield={1500n} yieldPool={1000n} />
    );
    const chip = screen.getByTestId('yield-coverage-warning');
    expect(chip).toBeDefined();
    expect(chip.getAttribute('role')).toBe('status');
    expect(chip.textContent).toContain(COVERAGE_WARNING_MESSAGE);
    expect(chip.textContent).toContain(
      'Yield pool currently cannot cover this payout; settlement will fail until it is topped up.'
    );
  });
});
