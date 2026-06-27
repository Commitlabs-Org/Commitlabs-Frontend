/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommitmentDetailActions } from '@/components/CommitmentDetailActions';

function renderActions(
  overrides: Partial<{
    canEarlyExit: boolean;
    onEarlyExit: () => void;
    onViewAttestations: () => void;
    onExportData: () => void;
    onReportIssue: () => void;
    earlyExitDisabledReason: string;
  }> = {},
) {
  const props = {
    canEarlyExit: true,
    onEarlyExit: vi.fn(),
    onViewAttestations: vi.fn(),
    onExportData: vi.fn(),
    onReportIssue: vi.fn(),
    earlyExitDisabledReason: 'Early exit is unavailable',
    ...overrides,
  };

  const view = render(<CommitmentDetailActions {...props} />);
  return { props, ...view };
}

describe('CommitmentDetailActions', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all action buttons', () => {
    renderActions();

    expect(screen.getByRole('heading', { name: 'Actions' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Primary Actions' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Additional Actions' }),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: 'Early Exit - Exit before expiry (penalty applies)',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'View Full Attestation History' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Export Commitment Data' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Report an Issue' }),
    ).toBeTruthy();
  });

  it('invokes onEarlyExit when Early Exit is clicked and canEarlyExit is true', () => {
    const { props } = renderActions({ canEarlyExit: true });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Early Exit - Exit before expiry (penalty applies)',
      }),
    );

    expect(props.onEarlyExit).toHaveBeenCalledTimes(1);
  });

  it('invokes onViewAttestations when View Full Attestation History is clicked', () => {
    const { props } = renderActions();

    fireEvent.click(
      screen.getByRole('button', { name: 'View Full Attestation History' }),
    );

    expect(props.onViewAttestations).toHaveBeenCalledTimes(1);
  });

  it('invokes onExportData when Export Commitment Data is clicked', () => {
    const { props } = renderActions();

    fireEvent.click(
      screen.getByRole('button', { name: 'Export Commitment Data' }),
    );

    expect(props.onExportData).toHaveBeenCalledTimes(1);
  });

  it('invokes onReportIssue when Report an Issue is clicked', () => {
    const { props } = renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Report an Issue' }));

    expect(props.onReportIssue).toHaveBeenCalledTimes(1);
  });

  it('disables Early Exit button when canEarlyExit is false', () => {
    renderActions({ canEarlyExit: false });

    const earlyExitButton = screen.getByRole('button', {
      name: 'Early Exit - Exit before expiry (penalty applies)',
    });

    expect(earlyExitButton).toBeDisabled();
    expect(earlyExitButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables Early Exit button when canEarlyExit is true', () => {
    renderActions({ canEarlyExit: true });

    const earlyExitButton = screen.getByRole('button', {
      name: 'Early Exit - Exit before expiry (penalty applies)',
    });

    expect(earlyExitButton).not.toBeDisabled();
  });

  it('does not invoke onEarlyExit when Early Exit is disabled', () => {
    const { props } = renderActions({ canEarlyExit: false });

    const earlyExitButton = screen.getByRole('button', {
      name: 'Early Exit - Exit before expiry (penalty applies)',
    });

    fireEvent.click(earlyExitButton);

    expect(props.onEarlyExit).not.toHaveBeenCalled();
  });

  it('shows tooltip on disabled Early Exit button', () => {
    renderActions({
      canEarlyExit: false,
      earlyExitDisabledReason: 'Commitment has already matured',
    });

    const earlyExitButton = screen.getByRole('button', {
      name: 'Early Exit - Exit before expiry (penalty applies)',
    });

    expect(earlyExitButton).toHaveAttribute(
      'title',
      'Commitment has already matured',
    );
  });

  it('has no tooltip on enabled Early Exit button', () => {
    renderActions({ canEarlyExit: true });

    const earlyExitButton = screen.getByRole('button', {
      name: 'Early Exit - Exit before expiry (penalty applies)',
    });

    expect(earlyExitButton).not.toHaveAttribute('title');
  });

  it('does not fire callbacks for unrelated buttons when one is clicked', () => {
    const { props } = renderActions();

    fireEvent.click(
      screen.getByRole('button', { name: 'Export Commitment Data' }),
    );

    expect(props.onExportData).toHaveBeenCalledTimes(1);
    expect(props.onViewAttestations).not.toHaveBeenCalled();
    expect(props.onReportIssue).not.toHaveBeenCalled();
    expect(props.onEarlyExit).not.toHaveBeenCalled();
  });

  it('renders all buttons with visible focus ring classes', () => {
    renderActions();

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('focus-visible:ring-[#0FF0FC]');
    });
  });
});
