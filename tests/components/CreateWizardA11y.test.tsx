/**
 * @vitest-environment happy-dom
 *
 * Accessibility-focused test suite for the create-commitment wizard steps.
 * Covers: label associations, aria-describedby error linkage, aria-invalid
 * toggling, focus management on mount, and keyboard accessibility of
 * interactive widgets (radio cards, sliders, custom checkboxes).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateCommitmentStepSelectType from '../../src/components/CreateCommitmentStepSelectType';
import CreateCommitmentStepConfigure from '../../src/components/CreateCommitmentStepConfigure';
import CreateCommitmentStepReview from '../../src/components/CreateCommitmentStepReview';

// ---------------------------------------------------------------------------
// Shared default props
// ---------------------------------------------------------------------------

const selectTypeDefaults = {
  selectedType: null as 'safe' | 'balanced' | 'aggressive' | null,
  onSelectType: vi.fn(),
  onNext: vi.fn(),
  onBack: vi.fn(),
};

const configureDefaults = {
  amount: '1000',
  asset: 'XLM',
  availableBalance: '5000',
  durationDays: 60,
  maxLossPercent: 8,
  earlyExitPenalty: '30 XLM',
  estimatedFees: '0.5 XLM',
  isValid: true,
  onChangeAmount: vi.fn(),
  onChangeAsset: vi.fn(),
  onChangeDuration: vi.fn(),
  onChangeMaxLoss: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
};

const reviewDefaults = {
  typeLabel: 'Balanced Commitment',
  amount: '1000',
  asset: 'XLM',
  durationDays: 60,
  maxLossPercent: 8,
  earlyExitPenalty: '30 XLM',
  estimatedFees: '0.5 XLM',
  estimatedYield: '12.5% APY',
  commitmentStart: 'Immediately',
  commitmentEnd: '2024-08-10',
  isSubmitting: false,
  submitError: undefined as string | undefined,
  onBack: vi.fn(),
  onSubmit: vi.fn(),
  onEditStep: vi.fn() as ((step: 1 | 2) => void) | undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Step 1 – Select Type
// ---------------------------------------------------------------------------

describe('CreateCommitmentStepSelectType – accessibility', () => {
  it('step heading receives focus on mount for screen-reader announcement', () => {
    render(<CreateCommitmentStepSelectType {...selectTypeDefaults} />);

    const heading = screen.getByRole('heading', {
      name: 'Choose Your Commitment Type',
    });
    expect(heading).toHaveFocus();
  });

  it('step heading has tabIndex -1 so it is programmatically focusable but not in tab order', () => {
    render(<CreateCommitmentStepSelectType {...selectTypeDefaults} />);

    const heading = screen.getByRole('heading', {
      name: 'Choose Your Commitment Type',
    });
    expect(heading).toHaveAttribute('tabIndex', '-1');
  });

  it('radiogroup has an accessible name', () => {
    render(<CreateCommitmentStepSelectType {...selectTypeDefaults} />);

    expect(
      screen.getByRole('radiogroup', { name: /commitment type/i }),
    ).toBeInTheDocument();
  });

  it('each radio card exposes aria-checked=false when nothing is selected', () => {
    render(<CreateCommitmentStepSelectType {...selectTypeDefaults} />);

    const cards = screen.getAllByRole('radio');
    cards.forEach((card) => {
      expect(card).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('selected card flips aria-checked to true', () => {
    render(
      <CreateCommitmentStepSelectType
        {...selectTypeDefaults}
        selectedType="safe"
      />,
    );

    expect(
      screen.getByRole('radio', { name: /Safe Commitment/ }),
    ).toHaveAttribute('aria-checked', 'true');

    expect(
      screen.getByRole('radio', { name: /Balanced Commitment/ }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('all radio cards have tabIndex 0 so they are keyboard reachable', () => {
    render(<CreateCommitmentStepSelectType {...selectTypeDefaults} />);

    screen.getAllByRole('radio').forEach((card) => {
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  it('Space key selects a card', () => {
    render(<CreateCommitmentStepSelectType {...selectTypeDefaults} />);

    fireEvent.keyDown(screen.getByRole('radio', { name: /Balanced Commitment/ }), {
      key: ' ',
    });

    expect(selectTypeDefaults.onSelectType).toHaveBeenCalledWith('balanced');
  });

  it('Enter key selects a card', () => {
    render(<CreateCommitmentStepSelectType {...selectTypeDefaults} />);

    fireEvent.keyDown(screen.getByRole('radio', { name: /Aggressive Commitment/ }), {
      key: 'Enter',
    });

    expect(selectTypeDefaults.onSelectType).toHaveBeenCalledWith('aggressive');
  });
});

// ---------------------------------------------------------------------------
// Step 2 – Configure
// ---------------------------------------------------------------------------

describe('CreateCommitmentStepConfigure – accessibility', () => {
  it('step heading receives focus on mount', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    expect(
      screen.getByRole('heading', { name: 'Configure Parameters' }),
    ).toHaveFocus();
  });

  it('step heading has tabIndex -1', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    expect(
      screen.getByRole('heading', { name: 'Configure Parameters' }),
    ).toHaveAttribute('tabIndex', '-1');
  });

  // -- Amount input ----------------------------------------------------------

  it('amount input is associated with its label via htmlFor/id', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    const amountInput = screen.getByLabelText(/Commitment Amount/);
    expect(amountInput).toHaveAttribute('id', 'amount');
  });

  it('amount input references helper text via aria-describedby', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    const amountInput = screen.getByLabelText(/Commitment Amount/);
    const describedBy = amountInput.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('amount-helper');
  });

  it('amount input has aria-invalid=false when no error', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    expect(screen.getByLabelText(/Commitment Amount/)).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  });

  it('amount input sets aria-invalid=true and aria-describedby includes error id when amountError is provided', () => {
    render(
      <CreateCommitmentStepConfigure
        {...configureDefaults}
        amountError="Amount exceeds available balance."
      />,
    );

    const input = screen.getByLabelText(/Commitment Amount/);
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('amount-error');

    const errorEl = document.getElementById('amount-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveAttribute('role', 'alert');
  });

  // -- Duration input --------------------------------------------------------

  it('duration number input is associated with its label via htmlFor/id', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    const durationInput = screen.getByLabelText(/Duration \(days\)/);
    expect(durationInput).toHaveAttribute('id', 'duration');
  });

  it('duration input references hint text via aria-describedby', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    const durationInput = screen.getByLabelText(/Duration \(days\)/);
    const describedBy = durationInput.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('duration-hint');
  });

  it('duration input has aria-invalid=false when value is in range', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    expect(screen.getByLabelText(/Duration \(days\)/)).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  });

  it('duration input sets aria-invalid=true and shows role=alert error when out of range', () => {
    render(
      <CreateCommitmentStepConfigure {...configureDefaults} durationDays={0} />,
    );

    const durationInput = screen.getByLabelText(/Duration \(days\)/);
    expect(durationInput).toHaveAttribute('aria-invalid', 'true');

    const describedBy = durationInput.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('duration-error');

    expect(screen.getByText('Minimum duration is 1 day.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  // -- Max loss input --------------------------------------------------------

  it('max loss input is associated with its label via htmlFor/id', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    const maxLossInput = screen.getByRole('spinbutton', {
      name: /Maximum Acceptable Loss/,
    });
    expect(maxLossInput).toHaveAttribute('id', 'maxLoss');
  });

  it('max loss input references hint text via aria-describedby when no error and no warning', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    const maxLossInput = screen.getByRole('spinbutton', {
      name: /Maximum Acceptable Loss/,
    });
    const describedBy = maxLossInput.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('maxloss-hint');
  });

  it('max loss input has aria-invalid=false when value is in range', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    expect(
      screen.getByRole('spinbutton', { name: /Maximum Acceptable Loss/ }),
    ).toHaveAttribute('aria-invalid', 'false');
  });

  it('max loss input sets aria-invalid=true and shows role=alert error when out of range', () => {
    render(
      <CreateCommitmentStepConfigure
        {...configureDefaults}
        maxLossPercent={101}
      />,
    );

    const maxLossInput = screen.getByRole('spinbutton', {
      name: /Maximum Acceptable Loss/,
    });
    expect(maxLossInput).toHaveAttribute('aria-invalid', 'true');

    const describedBy = maxLossInput.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('maxloss-error');

    expect(screen.getByText('Cannot exceed 100%.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('max loss input aria-describedby references warning element when maxLossWarning is true', () => {
    render(
      <CreateCommitmentStepConfigure
        {...configureDefaults}
        maxLossPercent={85}
        maxLossWarning
      />,
    );

    const maxLossInput = screen.getByRole('spinbutton', {
      name: /Maximum Acceptable Loss/,
    });
    const describedBy = maxLossInput.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('maxloss-warning');

    const warningEl = document.getElementById('maxloss-warning');
    expect(warningEl).toBeInTheDocument();
    expect(warningEl).toHaveTextContent(/Setting max loss above 80%/);
  });

  // -- Advanced section toggle -----------------------------------------------

  it('advanced section toggle button has aria-expanded=false by default', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    expect(
      screen.getByRole('button', { name: /Advanced Risk Parameters/ }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('advanced section toggle button sets aria-expanded=true when opened', () => {
    render(<CreateCommitmentStepConfigure {...configureDefaults} />);

    fireEvent.click(
      screen.getByRole('button', { name: /Advanced Risk Parameters/ }),
    );

    expect(
      screen.getByRole('button', { name: /Advanced Risk Parameters/ }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});

// ---------------------------------------------------------------------------
// Step 3 – Review
// ---------------------------------------------------------------------------

describe('CreateCommitmentStepReview – accessibility', () => {
  it('step heading receives focus on mount', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    expect(
      screen.getByRole('heading', { name: 'Review & Confirm' }),
    ).toHaveFocus();
  });

  it('step heading has tabIndex -1', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    expect(
      screen.getByRole('heading', { name: 'Review & Confirm' }),
    ).toHaveAttribute('tabIndex', '-1');
  });

  // -- Section structure -----------------------------------------------------

  it('each review section is a semantic <section> element with aria-labelledby', () => {
    const { container } = render(
      <CreateCommitmentStepReview {...reviewDefaults} />,
    );

    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(4);
    sections.forEach((section) => {
      expect(section).toHaveAttribute('aria-labelledby');
      const id = section.getAttribute('aria-labelledby')!;
      expect(document.getElementById(id)).toBeInTheDocument();
    });
  });

  // -- Custom checkboxes -----------------------------------------------------

  it('terms checkbox has role=checkbox', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('terms checkbox has aria-checked=false initially', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const [termsCheckbox] = screen.getAllByRole('checkbox');
    expect(termsCheckbox).toHaveAttribute('aria-checked', 'false');
  });

  it('risks checkbox has aria-checked=false initially', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('terms checkbox has tabIndex 0 so it is keyboard reachable', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const [termsCheckbox] = screen.getAllByRole('checkbox');
    expect(termsCheckbox).toHaveAttribute('tabIndex', '0');
  });

  it('risks checkbox has tabIndex 0 so it is keyboard reachable', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1]).toHaveAttribute('tabIndex', '0');
  });

  it('clicking terms checkbox toggles aria-checked to true', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const [termsCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking risks checkbox toggles aria-checked to true', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('pressing Enter on terms checkbox toggles it', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const [termsCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.keyDown(termsCheckbox, { key: 'Enter' });
    expect(termsCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  it('pressing Space on terms checkbox toggles it', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const [termsCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.keyDown(termsCheckbox, { key: ' ' });
    expect(termsCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  it('pressing Enter on risks checkbox toggles it', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.keyDown(checkboxes[1], { key: 'Enter' });
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('pressing Space on risks checkbox toggles it', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.keyDown(checkboxes[1], { key: ' ' });
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('aria-checked returns to false when toggled twice', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const [termsCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.click(termsCheckbox);
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).toHaveAttribute('aria-checked', 'false');
  });

  it('checkboxes have aria-labelledby pointing to existing label elements', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      const labelId = checkbox.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      expect(document.getElementById(labelId!)).toBeInTheDocument();
    });
  });

  it('submit button remains disabled until both checkboxes are checked', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const createButton = screen.getByRole('button', {
      name: /Create Commitment/i,
    });

    expect(createButton).toBeDisabled();

    const [termsCheckbox, risksCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.click(termsCheckbox);
    expect(createButton).toBeDisabled();

    fireEvent.click(risksCheckbox);
    expect(createButton).not.toBeDisabled();
  });

  it('submit error is announced via role=alert', () => {
    render(
      <CreateCommitmentStepReview
        {...reviewDefaults}
        submitError="Transaction failed. Please try again."
      />,
    );

    const errorEl = screen.getByText('Transaction failed. Please try again.');
    expect(errorEl).toHaveAttribute('role', 'alert');
  });

  // -- Edit buttons accessibility -------------------------------------------

  it('edit buttons for all sections have descriptive aria-labels', () => {
    render(<CreateCommitmentStepReview {...reviewDefaults} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit/ });
    const labels = editButtons.map((b) => b.getAttribute('aria-label'));

    expect(labels).toContain('Edit commitment type');
    expect(labels).toContain('Edit commitment amount and asset');
    expect(labels).toContain('Edit commitment duration');
    expect(labels).toContain('Edit max loss and early exit settings');
  });
});
