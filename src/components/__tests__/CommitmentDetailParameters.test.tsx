/**
 * @vitest-environment happy-dom
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CommitmentDetailParameters } from '@/components/CommitmentDetailParameters/CommitmentDetailParameters';

const DEFAULT_DURATION_DESCRIPTION = 'Commitment lock period';
const DEFAULT_MAX_LOSS_DESCRIPTION = 'Maximum acceptable loss before violation';
const DEFAULT_COMMITMENT_TYPE_DESCRIPTION = 'Risk profile and strategy type';
const DEFAULT_EARLY_EXIT_PENALTY_DESCRIPTION = 'Penalty for exiting before expiry';

const defaultProps = {
  durationLabel: '30 days',
  maxLossLabel: '10%',
  commitmentTypeLabel: 'Balanced',
  earlyExitPenaltyLabel: '2% fee',
};

describe('CommitmentDetailParameters', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the section heading', () => {
    render(<CommitmentDetailParameters {...defaultProps} />);
    const heading = screen.getByRole('heading', { name: 'Commitment Parameters' });
    expect(heading).toBeInTheDocument();
  });

  it('renders all four static labels', () => {
    render(<CommitmentDetailParameters {...defaultProps} />);
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Max Loss Threshold')).toBeInTheDocument();
    expect(screen.getByText('Commitment Type')).toBeInTheDocument();
    expect(screen.getByText('Early Exit Penalty')).toBeInTheDocument();
  });

  it('renders all four dynamic value labels from props', () => {
    render(<CommitmentDetailParameters {...defaultProps} />);
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('2% fee')).toBeInTheDocument();
  });

  it('renders provided descriptions instead of defaults', () => {
    render(
      <CommitmentDetailParameters
        {...defaultProps}
        durationDescription="How long funds are locked"
        maxLossDescription="Max drawdown allowed before breach"
        commitmentTypeDescription="Your chosen risk strategy"
        earlyExitPenaltyDescription="Cost to exit the commitment early"
      />,
    );
    expect(screen.getByText('How long funds are locked')).toBeInTheDocument();
    expect(screen.getByText('Max drawdown allowed before breach')).toBeInTheDocument();
    expect(screen.getByText('Your chosen risk strategy')).toBeInTheDocument();
    expect(screen.getByText('Cost to exit the commitment early')).toBeInTheDocument();
  });

  it('falls back to default descriptions when description props are omitted', () => {
    render(<CommitmentDetailParameters {...defaultProps} />);
    expect(screen.getByText(DEFAULT_DURATION_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_MAX_LOSS_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_COMMITMENT_TYPE_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_EARLY_EXIT_PENALTY_DESCRIPTION)).toBeInTheDocument();
  });

  it('falls back to default descriptions when all description props are explicitly omitted', () => {
    render(
      <CommitmentDetailParameters
        durationLabel="30 days"
        maxLossLabel="10%"
        commitmentTypeLabel="Balanced"
        earlyExitPenaltyLabel="2% fee"
      />,
    );
    expect(screen.getByText(DEFAULT_DURATION_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_MAX_LOSS_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_COMMITMENT_TYPE_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_EARLY_EXIT_PENALTY_DESCRIPTION)).toBeInTheDocument();
  });

  it('uses empty-string description when explicitly provided', () => {
    render(
      <CommitmentDetailParameters
        {...defaultProps}
        durationDescription=""
        maxLossDescription=""
        commitmentTypeDescription=""
        earlyExitPenaltyDescription=""
      />,
    );
    expect(screen.queryByText(DEFAULT_DURATION_DESCRIPTION)).not.toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_MAX_LOSS_DESCRIPTION)).not.toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_COMMITMENT_TYPE_DESCRIPTION)).not.toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_EARLY_EXIT_PENALTY_DESCRIPTION)).not.toBeInTheDocument();
  });

  it('renders icons without breaking text queries', () => {
    const { container } = render(<CommitmentDetailParameters {...defaultProps} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(5);
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Max Loss Threshold')).toBeInTheDocument();
    expect(screen.getByText('Commitment Type')).toBeInTheDocument();
    expect(screen.getByText('Early Exit Penalty')).toBeInTheDocument();
  });

  it('renders section with correct aria-labelledby attribute', () => {
    render(<CommitmentDetailParameters {...defaultProps} />);
    const section = document.querySelector('section');
    expect(section).toHaveAttribute('aria-labelledby', 'commitment-parameters-heading');
  });
});
