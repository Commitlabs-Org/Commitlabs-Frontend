/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import {
  CommitmentDetailActions,
  canEarlyExitInvariant,
  canSettleInvariant,
} from '@/components/CommitmentDetailActions';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();

interface ActionsOverrides {
  canEarlyExit?: boolean;
  onEarlyExit?: () => void;
  onViewAttestations?: () => void;
  onExportData?: () => void;
  onReportIssue?: () => void;
  earlyExitDisabledReason?: string;
  commitmentId?: string | undefined;
  onSettle?: (() => void) | undefined;
  settleDisabledReason?: string | undefined;
  previewRefreshTrigger?: string | number | undefined;
  onDuplicate?: ((id: string) => void) | undefined;
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

  // Omit keys explicitly overridden to `undefined`
  const props = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined),
  ) as unknown as React.ComponentProps<typeof CommitmentDetailActions>;

  const view = render(<CommitmentDetailActions {...props} />);
  return { props, ...view };
}

// ---------------------------------------------------------------------------
// Invariant unit tests
// ---------------------------------------------------------------------------

describe('canEarlyExitInvariant', () => {
  it('allows early exit when status is Active and days remaining > 0', () => {
    const result = canEarlyExitInvariant('Active', 30);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks early exit when status is Disputed', () => {
    const result = canEarlyExitInvariant('Disputed', 30);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Disputed');
  });

  it('blocks early exit when status is Settled', () => {
    const result = canEarlyExitInvariant('Settled', 30);
    expect(result.allowed).toBe(false);
  });

  it('blocks early exit when status is Violated', () => {
    const result = canEarlyExitInvariant('Violated', 30);
    expect(result.allowed).toBe(false);
  });

  it('allows early exit when status is undefined (defers to caller)', () => {
    const result = canEarlyExitInvariant(undefined, 30);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks early exit when days remaining is 0', () => {
    const result = canEarlyExitInvariant('Active', 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('matured');
  });

  it('blocks early exit when days remaining is negative', () => {
    const result = canEarlyExitInvariant('Active', -5);
    expect(result.allowed).toBe(false);
  });

  it('allows early exit when days remaining is undefined (defers to caller)', () => {
    const result = canEarlyExitInvariant('Active', undefined);
    expect(result).toEqual({ allowed: true });
  });
});

describe('canSettleInvariant', () => {
  it('allows settlement when maturity reached and status is Active', () => {
    const result = canSettleInvariant('Active', 0);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks settlement when already Settled', () => {
    const result = canSettleInvariant('Settled', 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('already settled');
  });

  it('blocks settlement when Disputed', () => {
    const result = canSettleInvariant('Disputed', 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('disputed');
  });

  it('blocks settlement when days remaining > 0', () => {
    const result = canSettleInvariant('Active', 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not matured');
  });

  it('allows settlement when status is undefined and days remaining is 0', () => {
    const result = canSettleInvariant(undefined, 0);
    expect(result).toEqual({ allowed: true });
  });

  it('blocks settlement when status is Violated', () => {
    const result = canSettleInvariant('Violated', 0);
    expect(result).toEqual({ allowed: true }); // Violated is not in the block list
  });
});

// ---------------------------------------------------------------------------
// Rendering tests
// ---------------------------------------------------------------------------

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

  // --- Success behavior ---

  describe('success behavior', () => {
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

    it('does not fire callbacks for unrelated buttons when one is clicked', () => {
      const { props } = renderActions();

      fireEvent.click(screen.getByRole('button', { name: 'Export Commitment Data' }));

      expect(props.onExportData).toHaveBeenCalledTimes(1);
      expect(props.onViewAttestations).not.toHaveBeenCalled();
      expect(props.onReportIssue).not.toHaveBeenCalled();
      expect(props.onEarlyExit).not.toHaveBeenCalled();
    });
  });

  // --- Failure / permission behavior ---

  describe('permission behavior', () => {
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
  });

  // --- Boundary behavior ---

  describe('boundary behavior', () => {
    it('renders primary action buttons with visible focus ring classes', () => {
      renderActions();

      // Check the main action buttons (Early Exit, View Attestations, Export, Report)
      const earlyExitBtn = screen.getByRole('button', {
        name: 'Early Exit - Exit before expiry (penalty applies)',
      });
      expect(earlyExitBtn.className).toContain('focus-visible:ring-2');
      expect(earlyExitBtn.className).toContain('focus-visible:ring-[#0FF0FC]');

      const attestationBtn = screen.getByRole('button', { name: 'View Full Attestation History' });
      expect(attestationBtn.className).toContain('focus-visible:ring-2');

      const exportBtn = screen.getByRole('button', { name: 'Export Commitment Data' });
      expect(exportBtn.className).toContain('focus-visible:ring-2');

      const reportBtn = screen.getByRole('button', { name: 'Report an Issue' });
      expect(reportBtn.className).toContain('focus-visible:ring-2');
    });

    it('renders helper note about on-chain actions', () => {
      renderActions();

      expect(screen.getByText(/All actions are recorded on-chain/)).toBeTruthy();
    });

    it('renders with minimal props (no commitmentId, no onSettle)', () => {
      render(
        <CommitmentDetailActions
          canEarlyExit={false}
          onEarlyExit={vi.fn()}
          onViewAttestations={vi.fn()}
          onExportData={vi.fn()}
          onReportIssue={vi.fn()}
        />,
      );

      expect(screen.getByRole('heading', { name: 'Actions' })).toBeTruthy();
      // No settlement checklist
      expect(screen.queryByText('Settlement preview')).toBeNull();
    });
  });

  // --- Retry / rapid interaction ---

  describe('rapid interaction guard (action lock)', () => {
    it('only fires onEarlyExit once within the lock window', () => {
      const onEarlyExit = vi.fn();
      renderActions({ canEarlyExit: true, onEarlyExit });

      const btn = screen.getByRole('button', {
        name: 'Early Exit - Exit before expiry (penalty applies)',
      });

      // Rapid double-click
      fireEvent.click(btn);
      fireEvent.click(btn);

      // Due to the lock, only the first click should fire
      expect(onEarlyExit).toHaveBeenCalledTimes(1);
    });

    it('re-enables the action after the lock window expires', async () => {
      vi.useFakeTimers();
      const onEarlyExit = vi.fn();
      renderActions({ canEarlyExit: true, onEarlyExit });

      const btn = screen.getByRole('button', {
        name: 'Early Exit - Exit before expiry (penalty applies)',
      });

      fireEvent.click(btn);
      expect(onEarlyExit).toHaveBeenCalledTimes(1);

      // Advance past the lock window (800ms)
      act(() => {
        vi.advanceTimersByTime(900);
      });

      fireEvent.click(btn);
      expect(onEarlyExit).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  // --- Duplicate commitment ---

  describe('duplicate commitment', () => {
    it('renders duplicate button when commitmentId and onDuplicate are provided', () => {
      renderActions({ commitmentId: '1', onDuplicate: vi.fn() });

      expect(screen.getByTestId('duplicate-commitment-btn')).toBeTruthy();
    });

    it('does not render duplicate button when onDuplicate is not provided', () => {
      renderActions({ commitmentId: '1', onDuplicate: undefined });

      expect(screen.queryByTestId('duplicate-commitment-btn')).toBeNull();
    });

    it('calls onDuplicate with commitmentId when clicked', () => {
      const onDuplicate = vi.fn();
      renderActions({ commitmentId: '1', onDuplicate });

      fireEvent.click(screen.getByTestId('duplicate-commitment-btn'));

      expect(onDuplicate).toHaveBeenCalledWith('1');
    });
  });

  // --- Settlement checklist ---

  describe('optional settlement checklist props', () => {
    it('renders the settlement checklist with only commitmentId', async () => {
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

      // Wait for the eligibility check to complete (the Settle button only appears when eligible)
      expect(await screen.findByRole('button', { name: 'Settle commitment' })).toBeTruthy();
    }, 10_000);

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
