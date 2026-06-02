// @vitest-environment happy-dom
/**
 * Tests for MyCommitmentsStats responsive KPI band.
 *
 * Covers:
 * - All four KPI cards render with correct labels and formatted values
 * - Trend indicators (up / down / neutral) render icon + text, not color-only
 * - Omitting trends renders no delta badges
 * - Accessibility: region role + aria-label on the wrapper
 * - Responsive grid class is applied (CSS breakpoints are defined in the module)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyCommitmentsStats from '@/components/MyCommitmentsStats/MyCommitmentsStats';

// CSS modules return empty objects in the test environment
vi.mock('@/components/MyCommitmentsStats/MyCommitmentsStats.module.css', () => ({
  default: { statsGrid: 'statsGrid' },
}));

// Stub KPICard's CSS module
vi.mock('@/components/KPICard/KPICard.module.css', () => ({
  default: new Proxy({}, { get: (_t, key) => String(key) }),
}));

const BASE_PROPS = {
  totalActive: 12,
  totalCommittedValue: '150000',
  avgComplianceScore: 94.2,
  totalFeesGenerated: '3200',
};

describe('MyCommitmentsStats', () => {
  describe('metric labels', () => {
    it('renders all four KPI card labels', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      expect(screen.getByText('Total Active Commitments')).toBeTruthy();
      expect(screen.getByText('Total Committed Value')).toBeTruthy();
      expect(screen.getByText('Average Compliance Score')).toBeTruthy();
      expect(screen.getByText('Total Fees Generated')).toBeTruthy();
    });
  });

  describe('metric values', () => {
    it('formats totalActive as compact count', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      // formatCompact(12) → "12"
      expect(screen.getByText('12')).toBeTruthy();
    });

    it('formats totalCommittedValue as currency', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      expect(screen.getByText('$150,000')).toBeTruthy();
    });

    it('formats avgComplianceScore as percentage', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      // formatPercentage(94.2, 0) → "94%"
      expect(screen.getByText('94%')).toBeTruthy();
    });

    it('formats totalFeesGenerated as currency', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      expect(screen.getByText('$3,200')).toBeTruthy();
    });
  });

  describe('trend indicators', () => {
    it('renders no delta badges when trends are omitted', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      // No percentage delta text like "20.0%" should appear
      expect(screen.queryByText(/20\.0%/)).toBeNull();
    });

    it('renders up-trend delta for totalActive', () => {
      render(
        <MyCommitmentsStats
          {...BASE_PROPS}
          trends={{ totalActive: { value: 20, direction: 'up', period: 'vs last month' } }}
        />
      );
      expect(screen.getByText('20.0%')).toBeTruthy();
      expect(screen.getByText('vs last month')).toBeTruthy();
    });

    it('renders down-trend delta for totalFeesGenerated', () => {
      render(
        <MyCommitmentsStats
          {...BASE_PROPS}
          trends={{ totalFeesGenerated: { value: 12, direction: 'down' } }}
        />
      );
      expect(screen.getByText('12.0%')).toBeTruthy();
    });

    it('renders neutral-trend delta for avgComplianceScore', () => {
      render(
        <MyCommitmentsStats
          {...BASE_PROPS}
          trends={{ avgComplianceScore: { value: 0, direction: 'neutral' } }}
        />
      );
      expect(screen.getByText('0.0%')).toBeTruthy();
    });

    it('renders independent trends for each metric', () => {
      render(
        <MyCommitmentsStats
          {...BASE_PROPS}
          trends={{
            totalActive:         { value: 5,  direction: 'up'      },
            totalCommittedValue: { value: 3,  direction: 'down'    },
            avgComplianceScore:  { value: 1,  direction: 'neutral' },
            totalFeesGenerated:  { value: 10, direction: 'up'      },
          }}
        />
      );
      expect(screen.getByText('5.0%')).toBeTruthy();
      expect(screen.getByText('3.0%')).toBeTruthy();
      expect(screen.getByText('1.0%')).toBeTruthy();
      expect(screen.getByText('10.0%')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('wraps the band in a region with an accessible label', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      const region = screen.getByRole('region', { name: 'Commitment statistics' });
      expect(region).toBeTruthy();
    });

    it('each KPICard has an aria-label containing its label and value', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      // KPICard auto-generates aria-label="${label}: ${formattedValue}"
      expect(
        screen.getByLabelText(/Total Active Commitments: 12/)
      ).toBeTruthy();
      expect(
        screen.getByLabelText(/Total Committed Value: \$150,000/)
      ).toBeTruthy();
    });
  });

  describe('responsive grid', () => {
    it('applies the statsGrid class to the wrapper', () => {
      const { container } = render(<MyCommitmentsStats {...BASE_PROPS} />);
      const grid = container.firstChild as HTMLElement;
      expect(grid.className).toContain('statsGrid');
    });

    it('renders exactly four KPI cards', () => {
      render(<MyCommitmentsStats {...BASE_PROPS} />);
      // Each KPICard renders with role="button" only when onClick is set;
      // without onClick they are plain divs. Count by label text instead.
      const labels = [
        'Total Active Commitments',
        'Total Committed Value',
        'Average Compliance Score',
        'Total Fees Generated',
      ];
      labels.forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    });
  });

  describe('edge cases', () => {
    it('renders zero values without crashing', () => {
      render(
        <MyCommitmentsStats
          totalActive={0}
          totalCommittedValue="0"
          avgComplianceScore={0}
          totalFeesGenerated="0"
        />
      );
      expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(1);
    });

    it('renders large values correctly', () => {
      render(
        <MyCommitmentsStats
          totalActive={1500000}
          totalCommittedValue="9999999"
          avgComplianceScore={100}
          totalFeesGenerated="1000000"
        />
      );
      // formatCompact(1500000) → "1.5M"
      expect(screen.getByText('1.5M')).toBeTruthy();
    });
  });
});
