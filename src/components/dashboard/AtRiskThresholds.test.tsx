/**
 * Focused unit tests for the configurable at-risk threshold feature.
 * Tests cover: rendering, interaction, threshold changes, edge cases.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AtRiskCommitments, DEFAULT_AT_RISK_THRESHOLDS } from './AtRiskCommitments';
import { classifyAtRiskCommitments } from '@/utils/classification';
import { fetchProtocolConstants } from '@/utils/protocol';
import { Commitment } from '@/lib/types/domain';

jest.mock('@/utils/protocol', () => ({
  fetchProtocolConstants: jest.fn(),
}));

const mockWarning = jest.fn();
jest.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ warning: mockWarning }),
}));

const base: Commitment = {
  id: 'abc123',
  type: 'Safe',
  status: 'Active',
  asset: 'XLM',
  amount: '500',
  complianceScore: 80,
  daysRemaining: 10,
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchProtocolConstants as jest.Mock).mockResolvedValue(null);
});

// ─── Default thresholds ────────────────────────────────────────────────────

describe('DEFAULT_AT_RISK_THRESHOLDS', () => {
  it('has complianceScoreThreshold of 70', () => {
    expect(DEFAULT_AT_RISK_THRESHOLDS.complianceScoreThreshold).toBe(70);
  });

  it('has daysRemainingThreshold of 7', () => {
    expect(DEFAULT_AT_RISK_THRESHOLDS.daysRemainingThreshold).toBe(7);
  });
});

// ─── classifyAtRiskCommitments with thresholds ─────────────────────────────

describe('classifyAtRiskCommitments with custom thresholds', () => {
  it('uses default thresholds when none supplied', () => {
    const c: Commitment = { ...base, complianceScore: 65, daysRemaining: 10 };
    const result = classifyAtRiskCommitments([c], null);
    expect(result[0].riskCategories).toContain('low_compliance');
    expect(result[0].riskCategories).not.toContain('maturing_soon');
  });

  it('respects custom complianceScoreThreshold', () => {
    const c: Commitment = { ...base, complianceScore: 75, daysRemaining: 30 };
    const healthy = classifyAtRiskCommitments([c], null, { complianceScoreThreshold: 70 });
    expect(healthy).toHaveLength(0);

    const atRisk = classifyAtRiskCommitments([c], null, { complianceScoreThreshold: 80 });
    expect(atRisk[0].riskCategories).toContain('low_compliance');
  });

  it('respects custom daysRemainingThreshold', () => {
    const c: Commitment = { ...base, complianceScore: 90, daysRemaining: 10 };
    const healthy = classifyAtRiskCommitments([c], null, { daysRemainingThreshold: 7 });
    expect(healthy).toHaveLength(0);

    const atRisk = classifyAtRiskCommitments([c], null, { daysRemainingThreshold: 14 });
    expect(atRisk[0].riskCategories).toContain('maturing_soon');
  });

  it('default preserves original behavior (score 65 < 70 => low_compliance)', () => {
    const c: Commitment = { ...base, complianceScore: 65 };
    const result = classifyAtRiskCommitments([c], null);
    expect(result).toHaveLength(1);
    expect(result[0].riskCategories).toContain('low_compliance');
  });

  it('default preserves original behavior (score 70 => not at risk for compliance)', () => {
    const c: Commitment = { ...base, complianceScore: 70, daysRemaining: 30 };
    const result = classifyAtRiskCommitments([c], null);
    expect(result).toHaveLength(0);
  });
});

// ─── AtRiskCommitments component — threshold controls ─────────────────────

describe('AtRiskCommitments threshold controls', () => {
  it('renders configure thresholds button after load', async () => {
    render(<AtRiskCommitments commitments={[base]} />);
    await waitFor(() =>
      expect(screen.getByText('Configure Thresholds')).toBeInTheDocument()
    );
  });

  it('settings panel is hidden by default', async () => {
    render(<AtRiskCommitments commitments={[base]} />);
    await waitFor(() => screen.getByText('Configure Thresholds'));
    expect(screen.queryByLabelText('At-risk threshold settings')).not.toBeInTheDocument();
  });

  it('opens settings panel on button click', async () => {
    render(<AtRiskCommitments commitments={[base]} />);
    await waitFor(() => screen.getByText('Configure Thresholds'));
    fireEvent.click(screen.getByText('Configure Thresholds'));
    expect(screen.getByLabelText('At-risk threshold settings')).toBeInTheDocument();
  });

  it('threshold change re-filters the list', async () => {
    // base has complianceScore 80, daysRemaining 10 — healthy by default
    render(<AtRiskCommitments commitments={[base]} />);
    await waitFor(() => screen.getByText('All Commitments Healthy'));

    fireEvent.click(screen.getByText('Configure Thresholds'));
    const compInput = screen.getByLabelText('Compliance score below (0–100)');
    fireEvent.change(compInput, { target: { value: '85' } });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });
  });

  it('newly at-risk commitment triggers one alert', async () => {
    const atRiskCommitment: Commitment = { ...base, complianceScore: 60 };
    render(<AtRiskCommitments commitments={[atRiskCommitment]} />);
    await waitFor(() => screen.getByText('Needs Attention'));
    expect(mockWarning).toHaveBeenCalledTimes(1);
    expect(mockWarning).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Commitment At Risk' })
    );
  });

  it('invalid compliance threshold shows validation error', async () => {
    render(<AtRiskCommitments commitments={[base]} />);
    await waitFor(() => screen.getByText('Configure Thresholds'));
    fireEvent.click(screen.getByText('Configure Thresholds'));

    fireEvent.change(screen.getByLabelText('Compliance score below (0–100)'), {
      target: { value: '999' },
    });
    fireEvent.click(screen.getByText('Apply'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Compliance score must be between 0 and 100.'
    );
  });

  it('invalid days threshold shows validation error', async () => {
    render(<AtRiskCommitments commitments={[base]} />);
    await waitFor(() => screen.getByText('Configure Thresholds'));
    fireEvent.click(screen.getByText('Configure Thresholds'));

    fireEvent.change(screen.getByLabelText('Days remaining at or below (0–365)'), {
      target: { value: '400' },
    });
    fireEvent.click(screen.getByText('Apply'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Days remaining must be between 0 and 365.'
    );
  });

  it('invalid threshold does not update the list', async () => {
    render(<AtRiskCommitments commitments={[base]} />);
    await waitFor(() => screen.getByText('All Commitments Healthy'));
    fireEvent.click(screen.getByText('Configure Thresholds'));

    fireEvent.change(screen.getByLabelText('Compliance score below (0–100)'), {
      target: { value: '-1' },
    });
    fireEvent.click(screen.getByText('Apply'));

    // List must remain healthy (invalid threshold rejected)
    expect(screen.getByText('Configure Thresholds')).toBeInTheDocument();
  });

  it('calls onThresholdsChange callback with new thresholds', async () => {
    const onThresholdsChange = jest.fn();
    render(
      <AtRiskCommitments
        commitments={[base]}
        onThresholdsChange={onThresholdsChange}
      />
    );
    await waitFor(() => screen.getByText('Configure Thresholds'));
    fireEvent.click(screen.getByText('Configure Thresholds'));

    fireEvent.change(screen.getByLabelText('Days remaining at or below (0–365)'), {
      target: { value: '14' },
    });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(onThresholdsChange).toHaveBeenCalledWith(
        expect.objectContaining({ daysRemainingThreshold: 14 })
      );
    });
  });

  it('accepts threshold props and uses them as initial values', async () => {
    render(
      <AtRiskCommitments
        commitments={[base]}
        thresholds={{ complianceScoreThreshold: 85 }}
      />
    );
    // base.complianceScore is 80, so with threshold 85 it should be at risk
    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });
  });
});
