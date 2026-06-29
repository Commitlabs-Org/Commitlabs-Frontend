// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TOUR_STEPS, useGuidedTour } from '../useGuidedTour';

const STORAGE_KEY = 'commitlabs:seen-wizard-tour';

function makeProps(overrides: Partial<Parameters<typeof useGuidedTour>[0]> = {}) {
  return {
    activeWizardStep: 1 as const,
    setWizardStep: vi.fn(),
    walletAddress: undefined,
    onSelectDefaultType: vi.fn(),
    ...overrides,
  };
}

describe('useGuidedTour', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ── Persistence ──────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('auto-starts the tour when localStorage has no seen flag', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStepIndex).toBe(0);
    });

    it('does NOT auto-start when tour is already marked seen in localStorage', async () => {
      localStorage.setItem(STORAGE_KEY, 'true');

      const { result } = renderHook(() => useGuidedTour(makeProps()));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isActive).toBe(false);
    });

    it('persists the seen flag to localStorage after skipTour', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.skipTour());

      expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
      expect(result.current.isActive).toBe(false);
    });

    it('persists the seen flag to localStorage after advancing past the last step', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Advance to the final step
      for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
        act(() => result.current.nextStep());
      }
      // One more click finishes the tour
      act(() => result.current.nextStep());

      expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
      expect(result.current.isActive).toBe(false);
    });

    it('handles a corrupted (non-"true") persisted value and starts the tour', async () => {
      localStorage.setItem(STORAGE_KEY, 'corrupted-value');

      const { result } = renderHook(() => useGuidedTour(makeProps()));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Corrupted value is not equal to "true" so tour should start
      expect(result.current.isActive).toBe(true);
    });
  });

  // ── Step progression ─────────────────────────────────────────────────────

  describe('step progression', () => {
    it('nextStep advances the step index', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.currentStepIndex).toBe(0);

      act(() => result.current.nextStep());

      expect(result.current.currentStepIndex).toBe(1);
    });

    it('prevStep goes back one step', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.nextStep());
      expect(result.current.currentStepIndex).toBe(1);

      act(() => result.current.prevStep());
      expect(result.current.currentStepIndex).toBe(0);
    });

    it('prevStep does not go below index 0', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.prevStep());

      expect(result.current.currentStepIndex).toBe(0);
    });

    it('nextStep past the last step ends the tour', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      for (let i = 0; i < TOUR_STEPS.length; i++) {
        act(() => result.current.nextStep());
      }

      expect(result.current.isActive).toBe(false);
    });

    it('nextStep triggers setWizardStep when crossing a wizard-step boundary', async () => {
      const setWizardStep = vi.fn();
      const { result } = renderHook(() =>
        useGuidedTour(makeProps({ setWizardStep }))
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Find the tour step just before the first wizard-step boundary
      const boundaryIndex = TOUR_STEPS.findIndex(
        (step, idx) => idx > 0 && step.wizardStep !== TOUR_STEPS[idx - 1].wizardStep
      ) - 1;

      // Advance to that boundary step
      for (let i = 0; i < boundaryIndex; i++) {
        act(() => result.current.nextStep());
      }
      setWizardStep.mockClear();
      act(() => result.current.nextStep());

      expect(setWizardStep).toHaveBeenCalled();
    });

    it('prevStep triggers setWizardStep when crossing a wizard-step boundary backwards', async () => {
      const setWizardStep = vi.fn();
      const { result } = renderHook(() =>
        useGuidedTour(makeProps({ setWizardStep, activeWizardStep: 1 }))
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Advance to the first cross-boundary index
      const boundaryIndex = TOUR_STEPS.findIndex(
        (step, idx) => idx > 0 && step.wizardStep !== TOUR_STEPS[idx - 1].wizardStep
      );

      for (let i = 0; i < boundaryIndex; i++) {
        act(() => result.current.nextStep());
      }
      setWizardStep.mockClear();
      act(() => result.current.prevStep());

      expect(setWizardStep).toHaveBeenCalled();
    });

    it('startTour resets to step 0 and sets wizard step to 1', async () => {
      const setWizardStep = vi.fn();
      const { result } = renderHook(() =>
        useGuidedTour(makeProps({ setWizardStep }))
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.nextStep());
      act(() => result.current.startTour());

      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.isActive).toBe(true);
      expect(setWizardStep).toHaveBeenCalledWith(1);
    });

    it('skipTour from mid-tour ends the tour immediately', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.nextStep());
      act(() => result.current.nextStep());
      act(() => result.current.skipTour());

      expect(result.current.isActive).toBe(false);
    });

    it('exposes the correct currentStepConfig', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.currentStepConfig).toEqual(TOUR_STEPS[0]);

      act(() => result.current.nextStep());

      expect(result.current.currentStepConfig).toEqual(TOUR_STEPS[1]);
    });

    it('totalSteps matches the TOUR_STEPS array length', async () => {
      const { result } = renderHook(() => useGuidedTour(makeProps()));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.totalSteps).toBe(TOUR_STEPS.length);
    });
  });
});
