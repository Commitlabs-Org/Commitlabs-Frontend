/**
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import VolatilityExposureMeter from '../VolatilityExposureMeter';

describe('VolatilityExposureMeter', () => {
  it('clamps invalid numeric input to zero for accessible meter values', () => {
    render(<VolatilityExposureMeter valuePercent={Number.NaN} />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    expect(meter).toHaveAttribute('aria-valuetext', '0 percent, low');
  });

  it('renders insufficient data without a numeric fill or valuenow', () => {
    render(<VolatilityExposureMeter insufficientData valuePercent={55} />);

    const meter = screen.getByRole('meter');
    expect(meter).not.toHaveAttribute('aria-valuenow');
    expect(meter).toHaveAttribute('aria-valuetext', 'Insufficient data');
    expect(screen.getByText('—')).toBeTruthy();
  });
});
