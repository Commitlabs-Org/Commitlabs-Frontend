import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGuidedTour, TOUR_STEPS } from '../useGuidedTour';

function makeProps(overrides = {}) {
  const setWizardStep = vi.fn();
  return {
    activeWizardStep: 1 as const,
    setWizardStep,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
});

describe('useGuidedTour — tour-progress store (replayable + dismissible)', () => {
  it('starts with isLoading=true and becomes inactive once preferences load', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('activates automatically when seen flag is absent', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isActive).toBe(true);
  });

  it('does not activate when seen flag is present in localStorage', async () => {
    localStorage.setItem('commitlabs:seen-wizard-tour', 'true');
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isActive).toBe(false);
  });

  it('startTour replays the tour regardless of prior dismissal', async () => {
    localStorage.setItem('commitlabs:seen-wizard-tour', 'true');
    const props = makeProps();
    const { result } = renderHook(() => useGuidedTour(props));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isActive).toBe(false);

    act(() => result.current.startTour());
    expect(result.current.isActive).toBe(true);
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('nextStep advances the index', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isActive).toBe(true));
    expect(result.current.currentStepIndex).toBe(0);
    act(() => result.current.nextStep());
    expect(result.current.currentStepIndex).toBe(1);
  });

  it('prevStep goes back one step', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isActive).toBe(true));
    act(() => result.current.nextStep());
    act(() => result.current.prevStep());
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('prevStep is a no-op at step 0', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isActive).toBe(true));
    act(() => result.current.prevStep());
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('skipTour dismisses the tour and sets localStorage flag', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isActive).toBe(true));
    act(() => result.current.skipTour());
    expect(result.current.isActive).toBe(false);
    expect(localStorage.getItem('commitlabs:seen-wizard-tour')).toBe('true');
  });

  it('advancing past the last step deactivates the tour', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isActive).toBe(true));
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      act(() => result.current.nextStep());
    }
    expect(result.current.isActive).toBe(false);
  });

  it('totalSteps matches TOUR_STEPS length', async () => {
    const { result } = renderHook(() => useGuidedTour(makeProps()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalSteps).toBe(TOUR_STEPS.length);
  });
});
