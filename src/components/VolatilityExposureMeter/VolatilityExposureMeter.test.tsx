import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VolatilityExposureMeter from './VolatilityExposureMeter';

// Phase 2 Observations:
// 1. The clamp logic: 
//    if (typeof value !== 'number' || Number.isNaN(value)) return 0
//    return Math.max(0, Math.min(100, value))
// 2. The exposureLevel thresholds: 
//    <= 33 -> 'low'
//    <= 66 -> 'medium'
//    else -> 'high'
// 3. The aria-label format: 
//    `Volatility exposure: ${percent}%, ${level} range.`
// 4. The aria-describedby condition: 
//    Applied to the section element (`aria-describedby={description ? 'volatility-exposure-desc' : undefined}`) 
//    and renders `<p id="volatility-exposure-desc">` when description is provided.

describe('VolatilityExposureMeter', () => {

  describe('clamp behavior', () => {
    it('clamps valuePercent 150 to 100 in the rendered output', () => {
      render(<VolatilityExposureMeter valuePercent={150} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '100');
    });

    it('clamps negative valuePercent to 0 in the rendered output', () => {
      render(<VolatilityExposureMeter valuePercent={-5} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '0');
    });

    it('renders 0 when valuePercent is 0', () => {
      render(<VolatilityExposureMeter valuePercent={0} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '0');
    });

    it('renders 100 when valuePercent is 100', () => {
      render(<VolatilityExposureMeter valuePercent={100} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '100');
    });

    it('renders 0 when valuePercent is NaN', () => {
      render(<VolatilityExposureMeter valuePercent={NaN} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '0');
    });

    it('renders 0 when valuePercent is a non-number', () => {
      // @ts-expect-error Testing invalid prop type
      render(<VolatilityExposureMeter valuePercent={"abc" as any} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('exposureLevel boundaries', () => {
    it('assigns low level when valuePercent is 33', () => {
      render(<VolatilityExposureMeter valuePercent={33} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuetext', '33 percent, low');
    });

    it('assigns medium level when valuePercent is 34', () => {
      render(<VolatilityExposureMeter valuePercent={34} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuetext', '34 percent, medium');
    });

    it('assigns medium level when valuePercent is 66', () => {
      render(<VolatilityExposureMeter valuePercent={66} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuetext', '66 percent, medium');
    });

    it('assigns high level when valuePercent is 67', () => {
      render(<VolatilityExposureMeter valuePercent={67} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuetext', '67 percent, high');
    });
  });

  describe('aria-label content', () => {
    it('formats aria-label correctly for a low exposure level', () => {
      render(<VolatilityExposureMeter valuePercent={20} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-label', 'Volatility exposure: 20%, low range.');
    });

    it('formats aria-label correctly for a high exposure level', () => {
      render(<VolatilityExposureMeter valuePercent={80} />);
      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-label', 'Volatility exposure: 80%, high range.');
    });
  });

  describe('aria-describedby wiring', () => {
    it('renders description and wires aria-describedby to the region when description prop is provided', () => {
      render(<VolatilityExposureMeter valuePercent={50} description="This is a test description" />);
      
      const descElement = screen.getByText('This is a test description');
      expect(descElement).toBeInTheDocument();
      expect(descElement).toHaveAttribute('id', 'volatility-exposure-desc');

      const region = screen.getByRole('region', { name: 'Volatility Exposure' });
      expect(region).toHaveAttribute('aria-describedby', 'volatility-exposure-desc');
    });

    it('does not render description and omits aria-describedby when description prop is absent', () => {
      render(<VolatilityExposureMeter valuePercent={50} />);
      
      const descElement = screen.queryByText(/test description/i);
      expect(descElement).not.toBeInTheDocument();

      const region = screen.getByRole('region', { name: 'Volatility Exposure' });
      expect(region).not.toHaveAttribute('aria-describedby');
    });
  });
});
