// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import CommitmentCreatedModal from '@/components/modals/CommitmentCreatedModal';

// ── Shared default props ─────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  commitmentId: 'CMT-ABC1234',
  onViewCommitment: vi.fn(),
  onCreateAnother: vi.fn(),
  onClose: vi.fn(),
  onFundLater: vi.fn(),
  onViewOnExplorer: vi.fn(),
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(props: Partial<typeof defaultProps> = {}) {
  return render(<CommitmentCreatedModal {...defaultProps} {...props} />);
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

// ── Suite ────────────────────────────────────────────────────────────────────

describe('CommitmentCreatedModal', () => {
  // ── 1. Initial render (idle state) ─────────────────────────────────────────

  it('renders the fund prompt on open (idle state)', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Commitment Created' })).toBeTruthy();
    expect(screen.getByText('CMT-ABC1234')).toBeTruthy();

    // Fund-prompt elements
    expect(screen.getByRole('button', { name: 'Fund escrow now' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /skip funding/i })).toBeTruthy();

    // Success-only elements must NOT be visible yet
    expect(screen.queryByText('Your commitment is now active and available in your dashboard.')).toBeNull();
    expect(screen.queryByText('Escrow Funded')).toBeNull();
  });

  // ── 2. Commitment ID always shown ──────────────────────────────────────────

  it('always shows the commitment ID', () => {
    renderModal({ commitmentId: 'CMT-XYZ9999' });
    expect(screen.getByText('CMT-XYZ9999')).toBeTruthy();
  });

  // ── 3. Loading state while funding ────────────────────────────────────────

  it('shows spinner and disables buttons while funding is in-flight', async () => {
    // Never resolves — keeps the component in funding state
    vi.stubGlobal('fetch', () => new Promise(() => {}));

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));

    expect(await screen.findByRole('status', { name: /funding in progress/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fund escrow now' })).toBeNull();

    // Navigation buttons should be disabled
    expect(screen.getByRole('button', { name: /create another/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  });

  // ── 4. Successful fund ────────────────────────────────────────────────────

  it('transitions to success state after a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { txHash: '0xdeadbeef', fundedAt: '2026-01-01T00:00:00Z' } }),
      })
    );

    renderModal({ callerAddress: 'GABC123' });
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));

    // Wait for success banner
    expect(await screen.findByRole('status', { name: /escrow funded successfully/i })).toBeTruthy();
    expect(screen.getByText(/0xdeadbeef/i)).toBeTruthy();

    // Description switches to "active"
    expect(
      screen.getByText('Your commitment is now active and available in your dashboard.')
    ).toBeTruthy();

    // "Next Steps" list is shown
    expect(screen.getByText('Your commitment is now active and earning yield')).toBeTruthy();

    // Primary CTA is "View Commitment"
    expect(screen.getByRole('button', { name: 'View commitment detail' })).toBeTruthy();

    // Verify correct fetch call
    expect(fetch).toHaveBeenCalledWith(
      '/api/commitments/CMT-ABC1234/fund',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ callerAddress: 'GABC123' }),
      })
    );
  });

  // ── 5. 409 treated as success ─────────────────────────────────────────────

  it('treats a 409 Already-Funded response as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { message: 'Only created commitments can be funded' } }),
      })
    );

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));

    expect(await screen.findByRole('status', { name: /escrow funded successfully/i })).toBeTruthy();
  });

  // ── 6. Network / generic error ────────────────────────────────────────────

  it('shows an error panel and retry button on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unreachable')));

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));

    expect(await screen.findByRole('alert', { name: /funding failed/i })).toBeTruthy();
    expect(screen.getByText('Network unreachable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry funding' })).toBeTruthy();
  });

  // ── 7. 403 error shows ownership message ─────────────────────────────────

  it('shows an ownership error message for 403 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      })
    );

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));

    expect(await screen.findByRole('alert', { name: /funding failed/i })).toBeTruthy();
    expect(
      screen.getByText('Only the commitment owner may fund this escrow.')
    ).toBeTruthy();
  });

  // ── 8. Skip / Fund Later ──────────────────────────────────────────────────

  it('transitions to skipped state and fires onFundLater when user skips', () => {
    const onFundLater = vi.fn();
    renderModal({ onFundLater });

    fireEvent.click(screen.getByRole('button', { name: /skip funding/i }));

    expect(onFundLater).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: /funding skipped/i })).toBeTruthy();
    expect(
      screen.getByText(/fund the escrow anytime from the commitment detail page/i)
    ).toBeTruthy();

    // "View Commitment" CTA appears after skipping
    expect(screen.getByRole('button', { name: 'View commitment detail' })).toBeTruthy();
  });

  // ── 9. Fund Later hidden when prop not provided ───────────────────────────

  it('hides the "Fund Later" button when onFundLater is not provided', () => {
    renderModal({ onFundLater: undefined });

    expect(screen.queryByRole('button', { name: /skip funding/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /fund later/i })).toBeNull();
  });

  // ── 10. Retry flow: error → retry → funding ───────────────────────────────

  it('allows the user to retry after an error', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) return Promise.reject(new Error('Timeout'));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { txHash: '0xretried' } }),
        });
      })
    );

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));

    // First call fails → error panel
    await screen.findByRole('alert', { name: /funding failed/i });

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: 'Retry funding' }));

    // Retry should go back via idle then fund again → success
    expect(await screen.findByRole('status', { name: /escrow funded successfully/i })).toBeTruthy();
    expect(screen.getByText(/0xretried/i)).toBeTruthy();
    expect(callCount).toBe(2);
  });

  // ── 11. View Commitment button fires onViewCommitment ─────────────────────

  it('fires onViewCommitment when the View Commitment button is clicked after success', async () => {
    const onViewCommitment = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      })
    );

    renderModal({ onViewCommitment });
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));
    await screen.findByRole('status', { name: /escrow funded successfully/i });

    fireEvent.click(screen.getByRole('button', { name: 'View commitment detail' }));
    expect(onViewCommitment).toHaveBeenCalledTimes(1);
  });

  // ── 12. Create Another button fires onCreateAnother ──────────────────────

  it('fires onCreateAnother', () => {
    const onCreateAnother = vi.fn();
    renderModal({ onCreateAnother });

    fireEvent.click(screen.getByRole('button', { name: /create another/i }));
    expect(onCreateAnother).toHaveBeenCalledTimes(1);
  });

  // ── 13. Escape closes modal ───────────────────────────────────────────────

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── 14. backdrop click closes modal ──────────────────────────────────────

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // The backdrop is the role="presentation" wrapper
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── 15. Accessibility: aria-live region present ───────────────────────────

  it('contains an aria-live region for status announcements after fund click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    }));

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));

    // The success banner uses role="status" which implies aria-live
    const liveRegion = await screen.findByRole('status', { name: /escrow funded successfully/i });
    expect(liveRegion).toBeTruthy();
  });

  // ── 16. body scroll locked while open ────────────────────────────────────

  it('locks body scroll while the modal is open', () => {
    renderModal();
    expect(document.body.style.overflow).toBe('hidden');
  });

  // ── 17. not rendered when isOpen is false ─────────────────────────────────

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // ── 18. Explorer link shown only when prop provided ───────────────────────

  it('shows the Stellar Explorer button only when onViewOnExplorer is provided', () => {
    const { rerender } = renderModal({ onViewOnExplorer: vi.fn() });
    expect(screen.getByRole('button', { name: 'View on Stellar Explorer' })).toBeTruthy();

    rerender(
      <CommitmentCreatedModal {...defaultProps} onViewOnExplorer={undefined} />
    );
    expect(screen.queryByRole('button', { name: 'View on Stellar Explorer' })).toBeNull();
  });

  // ── 19. Fund state resets for a new commitmentId ──────────────────────────

  it('resets fund state when commitmentId changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      })
    );

    const { rerender } = renderModal({ commitmentId: 'CMT-FIRST' });

    // Fund the first commitment
    fireEvent.click(screen.getByRole('button', { name: 'Fund escrow now' }));
    await screen.findByRole('status', { name: /escrow funded successfully/i });

    // Simulate a new commitment being created (modal re-opens with new id)
    rerender(
      <CommitmentCreatedModal
        {...defaultProps}
        isOpen={true}
        commitmentId="CMT-SECOND"
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /escrow funded successfully/i })).toBeNull();
      expect(screen.getByRole('button', { name: 'Fund escrow now' })).toBeTruthy();
    });
  });
});
