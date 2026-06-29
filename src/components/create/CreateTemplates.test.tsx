/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateCommitmentStepSelectType from '../CreateCommitmentStepSelectType';
import { COMMITMENT_PRESETS } from './commitmentPresets';

// Mock WizardStepper to avoid complex rendering
vi.mock('../WizardStepper', () => ({
  default: () => <div data-testid="wizard-stepper" />,
}));

const defaultProps = {
  selectedType: null as 'safe' | 'balanced' | 'aggressive' | null,
  onSelectType: vi.fn(),
  onNext: vi.fn(),
  onBack: vi.fn(),
  onApplyPreset: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Commitment Templates / Presets', () => {
  it('renders all preset buttons', () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);
    for (const preset of COMMITMENT_PRESETS) {
      expect(screen.getByTestId(`preset-${preset.id}`)).toBeInTheDocument();
    }
  });

  it('renders the Start from scratch option', () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);
    expect(screen.getByTestId('preset-scratch')).toBeInTheDocument();
  });

  it('presets container has radiogroup role and accessible label', () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);
    expect(screen.getByTestId('presets-container')).toHaveAttribute('role', 'radiogroup');
    expect(screen.getByTestId('presets-container')).toHaveAttribute('aria-label', 'Commitment templates');
  });

  it('each preset button has role radio and aria-checked false when none selected', () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);
    const firstPreset = screen.getByTestId(`preset-${COMMITMENT_PRESETS[0].id}`);
    expect(firstPreset).toHaveAttribute('role', 'radio');
    expect(firstPreset).toHaveAttribute('aria-checked', 'false');
  });

  it('preset prefills configure step — calls onApplyPreset with correct preset', () => {
    const onApplyPreset = vi.fn();
    render(<CreateCommitmentStepSelectType {...defaultProps} onApplyPreset={onApplyPreset} />);
    const conservativeBtn = screen.getByTestId('preset-conservative-90');
    fireEvent.click(conservativeBtn);
    expect(onApplyPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conservative-90',
        type: 'safe',
        durationDays: 90,
        maxLossPercent: 2,
      })
    );
  });

  it('preset selection also calls onSelectType with the correct type', () => {
    const onSelectType = vi.fn();
    render(<CreateCommitmentStepSelectType {...defaultProps} onSelectType={onSelectType} />);
    fireEvent.click(screen.getByTestId('preset-balanced-60'));
    expect(onSelectType).toHaveBeenCalledWith('balanced');
  });

  it('selected preset has aria-checked true', () => {
    render(
      <CreateCommitmentStepSelectType
        {...defaultProps}
        selectedType="safe"
      />
    );
    expect(screen.getByTestId('preset-conservative-90')).toHaveAttribute('aria-checked', 'true');
  });

  it('unrelated presets keep aria-checked false when one is selected', () => {
    render(
      <CreateCommitmentStepSelectType
        {...defaultProps}
        selectedType="safe"
      />
    );
    expect(screen.getByTestId('preset-balanced-60')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('preset-aggressive-30')).toHaveAttribute('aria-checked', 'false');
  });

  it('scratch option does not call onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    render(<CreateCommitmentStepSelectType {...defaultProps} onApplyPreset={onApplyPreset} />);
    fireEvent.click(screen.getByTestId('preset-scratch'));
    expect(onApplyPreset).not.toHaveBeenCalled();
  });

  it('fields remain editable — Continue button is enabled after preset selects a type', () => {
    render(
      <CreateCommitmentStepSelectType
        {...defaultProps}
        selectedType="balanced"
      />
    );
    const continueBtn = screen.getByTestId('select-type-continue');
    expect(continueBtn).not.toBeDisabled();
  });

  it('Continue is disabled when no type is selected (scratch without type)', () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} selectedType={null} />);
    expect(screen.getByTestId('select-type-continue')).toBeDisabled();
  });

  it('preset selection via keyboard Enter calls onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    render(<CreateCommitmentStepSelectType {...defaultProps} onApplyPreset={onApplyPreset} />);
    const btn = screen.getByTestId('preset-conservative-90');
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onApplyPreset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conservative-90' })
    );
  });

  it('preset selection via keyboard Space calls onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    render(<CreateCommitmentStepSelectType {...defaultProps} onApplyPreset={onApplyPreset} />);
    const btn = screen.getByTestId('preset-aggressive-30');
    fireEvent.keyDown(btn, { key: ' ' });
    expect(onApplyPreset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aggressive-30' })
    );
  });

  it('prefill respects validation — onApplyPreset not called without handler', () => {
    // When onApplyPreset is undefined, clicking preset should not throw
    const props = { ...defaultProps, onApplyPreset: undefined };
    expect(() => {
      render(<CreateCommitmentStepSelectType {...props} />);
      fireEvent.click(screen.getByTestId('preset-conservative-90'));
    }).not.toThrow();
  });
});

describe('commitmentPresets data', () => {
  it('all presets have valid types', () => {
    const validTypes = ['safe', 'balanced', 'aggressive'];
    for (const preset of COMMITMENT_PRESETS) {
      expect(validTypes).toContain(preset.type);
    }
  });

  it('all presets have positive durationDays', () => {
    for (const preset of COMMITMENT_PRESETS) {
      expect(preset.durationDays).toBeGreaterThan(0);
    }
  });

  it('all presets have maxLossPercent in valid range 0-100', () => {
    for (const preset of COMMITMENT_PRESETS) {
      expect(preset.maxLossPercent).toBeGreaterThanOrEqual(0);
      expect(preset.maxLossPercent).toBeLessThanOrEqual(100);
    }
  });

  it('preset ids are unique', () => {
    const ids = COMMITMENT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
