/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommitmentDetailActions } from '@/components/CommitmentDetailActions';

const fetchMock = vi.fn();

interface ActionsOverrides {
  canEarlyExit?: boolean;
  onEarlyExit?: () => void;
  onViewAttestations?: () => void;
  onExportData?: () => void;
  onReportIssue?: () => void;
  earlyExitDisabledReason?: string;
  // Explicit `| undefined` lets tests opt a key out of the merged props entirely
  // (see the filtering below), exercising the same "omit rather than pass
  // undefined" pattern CommitmentDetailActions itself uses under
  // exactOptionalPropertyTypes.
  commitmentId?: string | undefined;
  onSettle?: (() => void) | undefined;
  settleDisabledReason?: string | undefined;
  previewRefreshTrigger?: string | number | undefined;
}

function renderActions(overrides: ActionsOverrides = {}) {
  const merged = {
    canEarlyExit: true,
    onEarlyExit: vi.fn(),
    onViewAttestations: vi.fn(),
    onExportData: vi.fn(),
    onReportIssue: vi.fn(),
    earlyExitDisabledReason: 'Early exit is unavailable',
    commitmentId: '1',
    onSettle: vi.fn(),
    settleDisabledReason: 'Settlement is unavailable until maturity',
    ...overrides,
  };

  // Omit keys explicitly overridden to `undefined` instead of passing them
  // through, matching how a real caller would build props.
  const props = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined),
  ) as unknown as React.ComponentProps<typeof CommitmentDetailActions>;

  const view = render(<CommitmentDetailActions {...props} />);
  return { props, ...view };
}

describe('CommitmentDetailActions', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { eligible: true, reason: null, estimatedSettlement: '1200' },
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders all action buttons', () => {
    renderActions();

    expect(screen.getByRole('heading', { name: 'Actions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Primary Actions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Additional Actions' })).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: 'Early Exit - Exit before expiry (penalty applies)',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Full Attestation History' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export Commitment Data' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report an Issue' })).toBeTruthy();
    expect(screen.getByText('Settlement preview')).toBeTruthy();
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

    fireEvent.click(screen.getByRole('button', { name: 'View Full Attestation History' }));

    expect(props.onViewAttestations).toHaveBeenCalledTimes(1);
  });

  it('invokes onExportData when Export Commitment Data is clicked', () => {
    const { props } = renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Export Commitment Data' }));

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

    expect(earlyExitButton).toHaveAttribute('title', 'Commitment has already matured');
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

    fireEvent.click(screen.getByRole('button', { name: 'Export Commitment Data' }));

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

  describe('optional settlement checklist props', () => {
    it('renders the settlement checklist with only commitmentId, omitting onSettle/settleDisabledReason/previewRefreshTrigger entirely', async () => {
      render(
        <CommitmentDetailActions
          canEarlyExit={true}
          onEarlyExit={vi.fn()}
          onViewAttestations={vi.fn()}
          onExportData={vi.fn()}
          onReportIssue={vi.fn()}
          commitmentId="1"
        />,
      );

      expect(await screen.findByText('Settlement preview')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Settle' })).toBeNull();
    });

    it('does not render a Settle button when onSettle is not provided', async () => {
      renderActions({ onSettle: undefined });

      expect(await screen.findByText('Settlement preview')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Settle' })).toBeNull();
    });

    it('renders a Settle button when onSettle is provided', async () => {
      renderActions({ onSettle: vi.fn() });

      expect(await screen.findByRole('button', { name: 'Settle' })).toBeTruthy();
    });

    it('does not render a disabled-reason note when settleDisabledReason is not provided', async () => {
      renderActions({ settleDisabledReason: undefined });

      expect(await screen.findByText('Settlement preview')).toBeTruthy();
      expect(screen.queryByRole('note')).toBeNull();
    });

    it('renders the disabled-reason note when settleDisabledReason is provided', async () => {
      renderActions({ settleDisabledReason: 'Settlement is unavailable until maturity' });

      expect(await screen.findByRole('note')).toHaveTextContent(
        'Settlement is unavailable until maturity',
      );
    });

    it('does not render the settlement checklist section when commitmentId is not provided', () => {
      renderActions({ commitmentId: undefined });

      expect(screen.queryByText('Settlement preview')).toBeNull();
    });
  });
});
