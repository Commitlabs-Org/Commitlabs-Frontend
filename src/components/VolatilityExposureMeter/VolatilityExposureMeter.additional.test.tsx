// @vitest-environment happy-dom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/a11y/useReducedMotion', () => ({ useReducedMotion: () => false }));

import VolatilityExposureMeter from './VolatilityExposureMeter';

describe('VolatilityExposureMeter — clamping', () => {
  it('clamps NaN to 0%', () => {
    render(<VolatilityExposureMeter valuePercent={NaN} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps negative values to 0%', () => {
    render(<VolatilityExposureMeter valuePercent={-50} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps values above 100 to 100%', () => {
    render(<VolatilityExposureMeter valuePercent={150} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders the clamped percent label', () => {
    render(<VolatilityExposureMeter valuePercent={-10} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders a percent label of 100% for values over 100', () => {
    render(<VolatilityExposureMeter valuePercent={200} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});

describe('VolatilityExposureMeter — threshold zones', () => {
  it('aria-valuetext indicates "low" for values ≤ 33', () => {
    render(<VolatilityExposureMeter valuePercent={20} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuetext')).toMatch(/low/i);
  });

  it('aria-valuetext indicates "medium" for values 34–66', () => {
    render(<VolatilityExposureMeter valuePercent={50} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuetext')).toMatch(/medium/i);
  });

  it('aria-valuetext indicates "high" for values > 66', () => {
    render(<VolatilityExposureMeter valuePercent={80} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuetext')).toMatch(/high/i);
  });

  it('renders Low, Medium, High zone labels', () => {
    render(<VolatilityExposureMeter valuePercent={50} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('boundary value 33 is "low"', () => {
    render(<VolatilityExposureMeter valuePercent={33} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toMatch(/low/i);
  });

  it('boundary value 34 is "medium"', () => {
    render(<VolatilityExposureMeter valuePercent={34} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toMatch(/medium/i);
  });

  it('boundary value 66 is "medium"', () => {
    render(<VolatilityExposureMeter valuePercent={66} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toMatch(/medium/i);
  });

  it('boundary value 67 is "high"', () => {
    render(<VolatilityExposureMeter valuePercent={67} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toMatch(/high/i);
  });

  it('renders the optional description', () => {
    render(
      <VolatilityExposureMeter valuePercent={50} description="High exposure to volatile assets." />,
    );
    expect(screen.getByText('High exposure to volatile assets.')).toBeInTheDocument();
  });

  it('does not render a description element when description is omitted', () => {
    const { container } = render(<VolatilityExposureMeter valuePercent={50} />);
    expect(container.querySelector('#volatility-exposure-desc')).not.toBeInTheDocument();
  });
});
