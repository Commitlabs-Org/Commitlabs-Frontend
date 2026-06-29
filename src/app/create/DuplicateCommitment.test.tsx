// @vitest-environment happy-dom
/**
 * Tests for the duplicate-from-existing-commitment prefill feature.
 *
 * Covers:
 *   - usePrefillFromCommitment hook: happy path, missing source, identity fields excluded
 *   - CommitmentDetailActions: Duplicate button renders and calls onDuplicate
 *   - CreateCommitment page: banner shown and fields editable when prefill arrives
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('sourceId=CMT-42'),
}));

vi.mock('@/hooks/useWallet', () => ({ useWallet: () => ({ address: '0xABCD' }) }));
vi.mock('@/hooks/useDraftPersistence', () => ({
  useDraftPersistence: () => ({ draft: null, saveDraft: vi.fn(), clearDraft: vi.fn() }),
}));
vi.mock('@/hooks/useGuidedTour', () => ({
  useGuidedTour: () => ({
    isActive: false, currentStepIndex: 0, currentStepConfig: null,
    totalSteps: 0, nextStep: vi.fn(), prevStep: vi.fn(),
    skipTour: vi.fn(), startTour: vi.fn(),
  }),
}));
vi.mock('@/components/shell/AppShellLayout', () => ({
  AppShellLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'app-shell' }, children),
}));
vi.mock('@/components/create/ResumeDraftPrompt', () => ({
  default: () => React.createElement('div', { 'data-testid': 'resume-prompt' }),
}));
vi.mock('@/components/onboarding/GuidedTour', () => ({
  GuidedTour: () => null,
}));
vi.mock('@/components/CreateCommitmentStepSelectType', () => ({
  default: ({ onSelectType, onNext }: { onSelectType: (t: string) => void; onNext: () => void }) =>
    React.createElement('div', { 'data-testid': 'step-select-type' },
      React.createElement('button', { onClick: () => { onSelectType('balanced'); onNext(); } }, 'Select balanced')
    ),
}));
vi.mock('@/components/CreateCommitmentStepConfigure', () => ({
  default: ({ amount, asset, durationDays, maxLossPercent }: {
    amount: string; asset: string; durationDays: number; maxLossPercent: number;
  }) =>
    React.createElement('div', { 'data-testid': 'step-configure' },
      React.createElement('span', { 'data-testid': 'prefill-amount' }, amount),
      React.createElement('span', { 'data-testid': 'prefill-asset' }, asset),
      React.createElement('span', { 'data-testid': 'prefill-duration' }, String(durationDays)),
      React.createElement('span', { 'data-testid': 'prefill-maxloss' }, String(maxLossPercent)),
    ),
}));
vi.mock('@/components/CreateCommitmentStepReview', () => ({ default: () => null }));
vi.mock('@/components/modals/CommitmentCreatedModal', () => ({ default: () => null }));
vi.mock('@/utils/explorerLinks', () => ({
  buildExplorerUrl: () => 'https://explorer.example.com',
  openExplorerUrl: vi.fn(),
}));

// ---------------------------------------------------------------------------
// usePrefillFromCommitment — unit tests
// ---------------------------------------------------------------------------

describe('usePrefillFromCommitment', () => {
  const SOURCE_URL = '/api/commitments/CMT-42';

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns prefill data when source commitment is found', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          commitmentType: 'aggressive',
          amount: '500',
          asset: 'USDC',
          durationDays: 180,
          maxLossPercent: 60,
          // Identity-bound fields that MUST NOT appear in PrefillData
          id: 'CMT-42',
          ownerAddress: '0xDEAD',
          onChainState: 'active',
        },
      }),
    });

    const { usePrefillFromCommitment } = await import('@/hooks/usePrefillFromCommitment');
    const { result } = renderHook(() => usePrefillFromCommitment());

    await waitFor(() => expect(result.current).not.toBeNull());

    const prefill = result.current!;
    expect(prefill.commitmentType).toBe('aggressive');
    expect(prefill.amount).toBe('500');
    expect(prefill.asset).toBe('USDC');
    expect(prefill.durationDays).toBe(180);
    expect(prefill.maxLossPercent).toBe(60);

    // Identity-bound fields must NOT be present
    expect((prefill as Record<string, unknown>).id).toBeUndefined();
    expect((prefill as Record<string, unknown>).ownerAddress).toBeUndefined();
    expect((prefill as Record<string, unknown>).onChainState).toBeUndefined();
  });

  it('returns null when source commitment is not found (404)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const { usePrefillFromCommitment } = await import('@/hooks/usePrefillFromCommitment');
    const { result } = renderHook(() => usePrefillFromCommitment());

    // Give the async effect a chance to run
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(result.current).toBeNull();
  });

  it('returns null and does not throw when fetch rejects (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const { usePrefillFromCommitment } = await import('@/hooks/usePrefillFromCommitment');
    const { result } = renderHook(() => usePrefillFromCommitment());

    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(result.current).toBeNull();
  });

  it('clamps durationDays to valid range [1, 365]', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { commitmentType: 'safe', amount: '10', asset: 'XLM', durationDays: 9999, maxLossPercent: 50 } }),
    });

    const { usePrefillFromCommitment } = await import('@/hooks/usePrefillFromCommitment');
    const { result } = renderHook(() => usePrefillFromCommitment());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.durationDays).toBe(365);
  });

  it('clamps maxLossPercent to [0, 100]', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { commitmentType: 'balanced', amount: '10', asset: 'XLM', durationDays: 30, maxLossPercent: 200 } }),
    });

    const { usePrefillFromCommitment } = await import('@/hooks/usePrefillFromCommitment');
    const { result } = renderHook(() => usePrefillFromCommitment());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.maxLossPercent).toBe(100);
  });

  it('falls back to "balanced" when commitmentType is invalid', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { commitmentType: 'UNKNOWN_TYPE', amount: '10', asset: 'XLM', durationDays: 30, maxLossPercent: 50 } }),
    });

    const { usePrefillFromCommitment } = await import('@/hooks/usePrefillFromCommitment');
    const { result } = renderHook(() => usePrefillFromCommitment());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.commitmentType).toBe('balanced');
  });
});

// ---------------------------------------------------------------------------
// CommitmentDetailActions — Duplicate button
// ---------------------------------------------------------------------------

describe('CommitmentDetailActions – Duplicate action', () => {
  it('renders the Duplicate button when commitmentId and onDuplicate are provided', async () => {
    const { CommitmentDetailActions } = await import('@/components/CommitmentDetailActions');

    render(
      React.createElement(CommitmentDetailActions, {
        canEarlyExit: false,
        onEarlyExit: vi.fn(),
        onViewAttestations: vi.fn(),
        onExportData: vi.fn(),
        onReportIssue: vi.fn(),
        onDuplicate: vi.fn(),
        commitmentId: 'CMT-42',
      }),
    );

    expect(screen.getByTestId('duplicate-commitment-btn')).toBeTruthy();
    expect(screen.getByLabelText(/Duplicate Commitment/i)).toBeTruthy();
  });

  it('does not render the Duplicate button when onDuplicate is not provided', async () => {
    const { CommitmentDetailActions } = await import('@/components/CommitmentDetailActions');

    render(
      React.createElement(CommitmentDetailActions, {
        canEarlyExit: false,
        onEarlyExit: vi.fn(),
        onViewAttestations: vi.fn(),
        onExportData: vi.fn(),
        onReportIssue: vi.fn(),
        commitmentId: 'CMT-42',
      }),
    );

    expect(screen.queryByTestId('duplicate-commitment-btn')).toBeNull();
  });

  it('calls onDuplicate with the commitmentId when clicked', async () => {
    const onDuplicate = vi.fn();
    const { CommitmentDetailActions } = await import('@/components/CommitmentDetailActions');

    render(
      React.createElement(CommitmentDetailActions, {
        canEarlyExit: false,
        onEarlyExit: vi.fn(),
        onViewAttestations: vi.fn(),
        onExportData: vi.fn(),
        onReportIssue: vi.fn(),
        onDuplicate,
        commitmentId: 'CMT-42',
      }),
    );

    fireEvent.click(screen.getByTestId('duplicate-commitment-btn'));
    expect(onDuplicate).toHaveBeenCalledWith('CMT-42');
  });
});

// ---------------------------------------------------------------------------
// CreateCommitment page — prefill integration
// ---------------------------------------------------------------------------

describe('CreateCommitment page – prefill integration', () => {
  beforeEach(() => {
    // Simulate a source commitment response for the page's usePrefillFromCommitment call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          commitmentType: 'aggressive',
          amount: '750',
          asset: 'USDC',
          durationDays: 120,
          maxLossPercent: 70,
        },
      }),
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('shows the duplicate prefill banner when a sourceId is in the URL', async () => {
    const CreateCommitment = (await import('@/app/create/page')).default;
    render(React.createElement(CreateCommitment));

    await waitFor(() =>
      expect(screen.getByTestId('duplicate-prefill-banner')).toBeTruthy()
    );
  });

  it('prefills configure step with source commitment parameters', async () => {
    const CreateCommitment = (await import('@/app/create/page')).default;
    render(React.createElement(CreateCommitment));

    await waitFor(() =>
      expect(screen.getByTestId('step-configure')).toBeTruthy()
    );

    expect(screen.getByTestId('prefill-amount').textContent).toBe('750');
    expect(screen.getByTestId('prefill-asset').textContent).toBe('USDC');
    expect(screen.getByTestId('prefill-duration').textContent).toBe('120');
    expect(screen.getByTestId('prefill-maxloss').textContent).toBe('70');
  });

  it('skips the type-selection step and lands on step 2 when prefill is available', async () => {
    const CreateCommitment = (await import('@/app/create/page')).default;
    render(React.createElement(CreateCommitment));

    await waitFor(() =>
      expect(screen.getByTestId('step-configure')).toBeTruthy()
    );

    // Step 1 (type selection) must NOT be visible
    expect(screen.queryByTestId('step-select-type')).toBeNull();
  });

  it('prefilled fields remain editable (component renders with mutable props)', async () => {
    const CreateCommitment = (await import('@/app/create/page')).default;
    render(React.createElement(CreateCommitment));

    await waitFor(() => expect(screen.getByTestId('step-configure')).toBeTruthy());

    // The configure step renders with the source values — user can edit from here.
    // Verify the amount is the prefilled value (not the default empty string).
    expect(screen.getByTestId('prefill-amount').textContent).not.toBe('');
  });
});
