// src/components/CommitmentDetailActions.test.tsx
//
// Regression tests for issue #1754: the Report Issue (dispute) action must
// be gated the same way Early Exit and Settle already are, via a disabled
// reason surfaced from an authoritative ownership check in the parent page,
// not left permanently clickable regardless of who is viewing the page.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommitmentDetailActions } from './CommitmentDetailActions';

// SettlementEligibilityChecklist pulls in its own data-fetching concerns
// that are unrelated to what this file tests; mock it so this test suite
// stays isolated to CommitmentDetailActions' own rendering/gating logic.
vi.mock('@/components/settlement/SettlementEligibilityChecklist', () => ({
  SettlementEligibilityChecklist: () => <div data-testid="settlement-checklist" />,
}));

function noop() {}

describe('CommitmentDetailActions — Report Issue authorization gating', () => {
  it('renders Report Issue as enabled when no disabled reason is given (backward compatible default)', () => {
    render(
      <CommitmentDetailActions
        canEarlyExit={false}
        onEarlyExit={noop}
        onViewAttestations={noop}
        onExportData={noop}
        onReportIssue={noop}
      />,
    );
    const button = screen.getByRole('button', { name: 'Report an Issue' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'false');
  });

  it('disables Report Issue and exposes the reason when reportIssueDisabledReason is set', () => {
    render(
      <CommitmentDetailActions
        canEarlyExit={false}
        onEarlyExit={noop}
        onViewAttestations={noop}
        onExportData={noop}
        onReportIssue={noop}
        reportIssueDisabledReason="Connect your wallet to manage this commitment."
      />,
    );
    const button = screen.getByRole('button', { name: 'Report an Issue' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('title', 'Connect your wallet to manage this commitment.');
  });

  it('does not call onReportIssue when the button is disabled and clicked', async () => {
    const user = userEvent.setup();
    const onReportIssue = vi.fn();
    render(
      <CommitmentDetailActions
        canEarlyExit={false}
        onEarlyExit={noop}
        onViewAttestations={noop}
        onExportData={noop}
        onReportIssue={onReportIssue}
        reportIssueDisabledReason="Only the commitment owner can perform this action."
      />,
    );
    const button = screen.getByRole('button', { name: 'Report an Issue' });
    await user.click(button);
    expect(onReportIssue).not.toHaveBeenCalled();
  });

  it('calls onReportIssue when enabled and clicked', async () => {
    const user = userEvent.setup();
    const onReportIssue = vi.fn();
    render(
      <CommitmentDetailActions
        canEarlyExit={false}
        onEarlyExit={noop}
        onViewAttestations={noop}
        onExportData={noop}
        onReportIssue={onReportIssue}
      />,
    );
    const button = screen.getByRole('button', { name: 'Report an Issue' });
    await user.click(button);
    expect(onReportIssue).toHaveBeenCalledTimes(1);
  });
});

describe('CommitmentDetailActions — existing disabled-reason behavior (regression)', () => {
  it('disables Early Exit with the default reason when canEarlyExit is false', () => {
    render(
      <CommitmentDetailActions
        canEarlyExit={false}
        onEarlyExit={noop}
        onViewAttestations={noop}
        onExportData={noop}
        onReportIssue={noop}
      />,
    );
    const button = screen.getByRole('button', { name: /early exit/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Early exit is only available before maturity');
  });

  it('enables Early Exit when canEarlyExit is true', () => {
    render(
      <CommitmentDetailActions
        canEarlyExit={true}
        onEarlyExit={noop}
        onViewAttestations={noop}
        onExportData={noop}
        onReportIssue={noop}
      />,
    );
    const button = screen.getByRole('button', { name: /early exit/i });
    expect(button).not.toBeDisabled();
  });

  it('surfaces a custom earlyExitDisabledReason when provided', () => {
    render(
      <CommitmentDetailActions
        canEarlyExit={false}
        onEarlyExit={noop}
        onViewAttestations={noop}
        onExportData={noop}
        onReportIssue={noop}
        earlyExitDisabledReason="Only the commitment owner can perform this action."
      />,
    );
    const button = screen.getByRole('button', { name: /early exit/i });
    expect(button).toHaveAttribute('title', 'Only the commitment owner can perform this action.');
  });
});
