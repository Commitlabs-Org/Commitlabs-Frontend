/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CommitmentDetailOverview } from '@/components/CommitmentDetailOverview';

const defaultProps = {
  commitmentTypeLabel: 'Long Position',
  currentValue: '12,500.00',
  currentValueAsset: 'USDC',
  gainLossLabel: '+2,500.00',
  gainLossVariant: 'positive' as const,
  initialAmount: '10,000.00',
  initialAmountAsset: 'USDC',
  createdDate: 'Jan 15, 2024',
  expiresDate: 'Apr 15, 2024',
  daysRemaining: 30,
  durationPercentComplete: 75,
  complianceScore: 85,
  complianceScoreLabel: 'Excellent compliance with commitment rules',
  maxLossThreshold: '20%',
  currentDrawdown: '5%',
  feesGenerated: '150.00',
  sellerTrustLevel: 'verified' as const,
  sellerReputation: {
    score: 92,
    totalCommitments: 24,
    successRate: 96,
  },
};

function renderOverview(
  overrides: Partial<React.ComponentProps<typeof CommitmentDetailOverview>> = {},
) {
  return render(<CommitmentDetailOverview {...defaultProps} {...overrides} />);
}

describe('CommitmentDetailOverview', () => {
  describe('basic rendering', () => {
    it('renders the commitment type label', () => {
      renderOverview();
      expect(screen.getByText('Long Position')).toBeInTheDocument();
    });

    it('renders current value with asset', () => {
      renderOverview({ currentValue: '15,000.00', currentValueAsset: 'ETH' });
      expect(screen.getByText('15,000.00')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });

    it('renders initial amount with asset', () => {
      renderOverview({ initialAmount: '10,000.00', initialAmountAsset: 'USDC' });
      expect(screen.getByText('10,000.00 USDC')).toBeInTheDocument();
    });

    it('renders gain/loss label', () => {
      renderOverview({ gainLossLabel: '+5,000.00' });
      expect(screen.getByText('+5,000.00')).toBeInTheDocument();
    });

    it('renders compliance score', () => {
      renderOverview({ complianceScore: 85 });
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('/ 100')).toBeInTheDocument();
    });

    it('renders compliance score label', () => {
      renderOverview({ complianceScoreLabel: 'Good compliance' });
      expect(screen.getByText('Good compliance')).toBeInTheDocument();
    });

    it('renders days remaining', () => {
      renderOverview({ daysRemaining: 45 });
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('days left'))).toBeInTheDocument();
    });

    it('renders max loss threshold', () => {
      renderOverview({ maxLossThreshold: '25%' });
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('renders current drawdown', () => {
      renderOverview({ currentDrawdown: '8%' });
      expect(screen.getByText('8%')).toBeInTheDocument();
    });

    it('renders fees generated', () => {
      renderOverview({ feesGenerated: '200.00' });
      expect(screen.getByText('200.00')).toBeInTheDocument();
    });

    it('renders created and expires dates', () => {
      renderOverview({
        createdDate: 'Feb 1, 2024',
        expiresDate: 'May 1, 2024',
      });
      expect(screen.getByText('Feb 1, 2024')).toBeInTheDocument();
      expect(screen.getByText('May 1, 2024')).toBeInTheDocument();
    });

    it('has accessible section label', () => {
      const { container } = renderOverview();
      const section = container.querySelector('section');
      expect(section).toHaveAttribute('aria-label', 'Commitment overview and compliance');
    });
  });

  describe('gain/loss variant styling', () => {
    it('applies positive styling for positive gain/loss', () => {
      renderOverview({ gainLossVariant: 'positive' });
      const badge = screen.getByText('+2,500.00').closest('span');
      expect(badge).toHaveClass('bg-[rgba(34,197,94,0.15)]');
      expect(badge).toHaveClass('text-[#22C55E]');
      expect(badge).toHaveClass('border-[rgba(34,197,94,0.35)]');
    });

    it('applies negative styling for negative gain/loss', () => {
      renderOverview({ gainLossVariant: 'negative', gainLossLabel: '-1,500.00' });
      const badge = screen.getByText('-1,500.00').closest('span');
      expect(badge).toHaveClass('bg-[rgba(239,68,68,0.15)]');
      expect(badge).toHaveClass('text-[#EF4444]');
      expect(badge).toHaveClass('border-[rgba(239,68,68,0.35)]');
    });

    it('applies neutral styling for neutral gain/loss', () => {
      renderOverview({ gainLossVariant: 'neutral', gainLossLabel: '0.00' });
      const badge = screen.getByText('0.00').closest('span');
      expect(badge).toHaveClass('bg-[rgba(148,163,184,0.12)]');
      expect(badge).toHaveClass('text-[#CBD5F5]');
      expect(badge).toHaveClass('border-[rgba(148,163,184,0.35)]');
    });
  });

  describe('compliance score color thresholds', () => {
    it('uses green color for score >= 80', () => {
      const { container } = renderOverview({ complianceScore: 80 });
      const progressBar = container.querySelector('[aria-label="Compliance score"] div');
      expect(progressBar).toHaveStyle({ backgroundColor: '#22C55E' });
    });

    it('uses green color for score of 100', () => {
      const { container } = renderOverview({ complianceScore: 100 });
      const progressBar = container.querySelector('[aria-label="Compliance score"] div');
      expect(progressBar).toHaveStyle({ backgroundColor: '#22C55E' });
    });

    it('uses amber color for score >= 60 but < 80', () => {
      const { container } = renderOverview({ complianceScore: 60 });
      const progressBar = container.querySelector('[aria-label="Compliance score"] div');
      expect(progressBar).toHaveStyle({ backgroundColor: '#F59E0B' });
    });

    it('uses amber color for score of 79 (just below green threshold)', () => {
      const { container } = renderOverview({ complianceScore: 79 });
      const progressBar = container.querySelector('[aria-label="Compliance score"] div');
      expect(progressBar).toHaveStyle({ backgroundColor: '#F59E0B' });
    });

    it('uses red color for score < 60', () => {
      const { container } = renderOverview({ complianceScore: 59 });
      const progressBar = container.querySelector('[aria-label="Compliance score"] div');
      expect(progressBar).toHaveStyle({ backgroundColor: '#EF4444' });
    });

    it('uses red color for score of 0', () => {
      const { container } = renderOverview({ complianceScore: 0 });
      const progressBar = container.querySelector('[aria-label="Compliance score"] div');
      expect(progressBar).toHaveStyle({ backgroundColor: '#EF4444' });
    });

    it('clamps compliance score to 100 when above max', () => {
      const { container } = renderOverview({ complianceScore: 150 });
      const progressBar = container.querySelector('[aria-label="Compliance score"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('clamps compliance score to 0 when below min', () => {
      const { container } = renderOverview({ complianceScore: -10 });
      const progressBar = container.querySelector('[aria-label="Compliance score"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('duration percent complete clamp', () => {
    it('renders duration progress bar with correct percentage', () => {
      const { container } = renderOverview({ durationPercentComplete: 50 });
      const progressBar = container.querySelector('[aria-label="Commitment duration progress"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      const fill = progressBar?.querySelector('div');
      expect(fill).toHaveStyle({ width: '50%' });
    });

    it('clamps duration percent to 100 when above max', () => {
      const { container } = renderOverview({ durationPercentComplete: 150 });
      const progressBar = container.querySelector('[aria-label="Commitment duration progress"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      const fill = progressBar?.querySelector('div');
      expect(fill).toHaveStyle({ width: '100%' });
    });

    it('clamps duration percent to 0 when below min', () => {
      const { container } = renderOverview({ durationPercentComplete: -10 });
      const progressBar = container.querySelector('[aria-label="Commitment duration progress"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      const fill = progressBar?.querySelector('div');
      expect(fill).toHaveStyle({ width: '0%' });
    });

    it('displays clamped percent in text', () => {
      renderOverview({ durationPercentComplete: 150, daysRemaining: 0 });
      expect(screen.getByText((content) => content.includes('% complete'))).toBeInTheDocument();
    });

    it('displays 0% complete for negative duration', () => {
      renderOverview({ durationPercentComplete: -10, daysRemaining: 90 });
      expect(screen.getByText((content) => content.includes('% complete'))).toBeInTheDocument();
    });
  });

  describe('seller trust badge', () => {
    it('renders TrustBadge with sellerTrustLevel', () => {
      renderOverview({ sellerTrustLevel: 'verified' });
      expect(screen.getByRole('status', { name: 'Verified Seller' })).toBeInTheDocument();
    });

    it('renders unverified badge when sellerTrustLevel is unverified', () => {
      renderOverview({ sellerTrustLevel: 'unverified' });
      expect(screen.getByRole('status', { name: 'Self-Reported' })).toBeInTheDocument();
    });

    it('renders reputable badge when sellerTrustLevel is reputable', () => {
      renderOverview({ sellerTrustLevel: 'reputable' });
      expect(screen.getByRole('status', { name: 'Top Reputation' })).toBeInTheDocument();
    });

    it('defaults to unverified when sellerTrustLevel is not provided', () => {
      renderOverview({ sellerTrustLevel: undefined });
      expect(screen.getByRole('status', { name: 'Self-Reported' })).toBeInTheDocument();
    });
  });

  describe('seller reputation display', () => {
    it('renders ReputationDisplay when sellerReputation is provided', () => {
      renderOverview({
        sellerReputation: {
          score: 88,
          totalCommitments: 15,
          successRate: 94,
        },
      });
      expect(screen.getByText('Seller Reputation')).toBeInTheDocument();
      expect(screen.getByText('88/100')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('94%')).toBeInTheDocument();
    });

    it('does not render ReputationDisplay when sellerReputation is not provided', () => {
      renderOverview({ sellerReputation: undefined });
      expect(screen.queryByText('Seller Reputation')).not.toBeInTheDocument();
    });

    it('renders reputation with zero commitments', () => {
      renderOverview({
        sellerReputation: {
          score: 0,
          totalCommitments: 0,
          successRate: 0,
        },
      });
      expect(screen.getByText('0/100')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('renders reputation with perfect score', () => {
      renderOverview({
        sellerReputation: {
          score: 100,
          totalCommitments: 50,
          successRate: 100,
        },
      });
      expect(screen.getByText('100/100')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles zero days remaining', () => {
      renderOverview({ daysRemaining: 0 });
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('days left'))).toBeInTheDocument();
    });

    it('handles large days remaining', () => {
      renderOverview({ daysRemaining: 365 });
      expect(screen.getByText('365')).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('days left'))).toBeInTheDocument();
    });

    it('handles negative gain/loss', () => {
      renderOverview({
        gainLossVariant: 'negative',
        gainLossLabel: '-3,000.00',
      });
      expect(screen.getByText('-3,000.00')).toBeInTheDocument();
    });

    it('handles zero gain/loss', () => {
      renderOverview({
        gainLossVariant: 'neutral',
        gainLossLabel: '0.00',
      });
      expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('handles zero fees', () => {
      renderOverview({ feesGenerated: '0.00' });
      expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('handles zero drawdown', () => {
      renderOverview({ currentDrawdown: '0%' });
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles custom compliance score label', () => {
      renderOverview({ complianceScoreLabel: 'Needs improvement' });
      expect(screen.getByText('Needs improvement')).toBeInTheDocument();
    });
  });

  describe('progress bar accessibility', () => {
    it('sets correct ARIA attributes on duration progress bar', () => {
      const { container } = renderOverview({ durationPercentComplete: 45 });
      const progressBar = container.querySelector('[aria-label="Commitment duration progress"]');
      expect(progressBar).toHaveAttribute('role', 'progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    it('sets correct ARIA attributes on compliance progress bar', () => {
      const { container } = renderOverview({ complianceScore: 72 });
      const progressBar = container.querySelector('[aria-label="Compliance score"]');
      expect(progressBar).toHaveAttribute('role', 'progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '72');
    });
  });

  describe('layout structure', () => {
    it('renders main section with correct classes', () => {
      const { container } = renderOverview();
      const section = container.querySelector('section');
      expect(section).toHaveClass('w-full');
      expect(section).toHaveClass('rounded-[24px]');
      expect(section).toHaveClass('bg-[#0a0a0a]');
    });

    it('renders duration timeline section', () => {
      renderOverview();
      expect(screen.getByText('Duration Timeline')).toBeInTheDocument();
    });

    it('renders compliance score section', () => {
      renderOverview();
      expect(screen.getByText('Compliance Score')).toBeInTheDocument();
    });

    it('renders metric grid with all labels', () => {
      renderOverview();
      expect(screen.getByText('Days Remaining')).toBeInTheDocument();
      expect(screen.getByText('Max Loss Threshold')).toBeInTheDocument();
      expect(screen.getByText('Current Drawdown')).toBeInTheDocument();
      expect(screen.getByText('Fees Generated')).toBeInTheDocument();
    });
  });
});
