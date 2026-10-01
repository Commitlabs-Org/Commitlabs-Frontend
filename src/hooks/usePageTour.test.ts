// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePageTour, type PageTourStep } from '@/hooks/usePageTour';

const STEPS: PageTourStep[] = [
  { targetSelector: '#a', title: 'A', content: 'First step' },
  { targetSelector: '#b', title: 'B', content: 'Second step' },
  { targetSelector: '#c', title: 'C', content: 'Third step' },
];

describe('usePageTour', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts inactive with no current step', () => {
    const { result } = renderHook(() => usePageTour(STEPS, 'test-tour'));
    expect(result.current.isActive).toBe(false);
    expect(result.current.currentStep).toBeNull();
    expect(result.current.totalSteps).toBe(3);
  });

  it('reads previously-seen state from localStorage', () => {
    localStorage.setItem('test-tour', 'true');
    const { result } = renderHook(() => usePageTour(STEPS, 'test-tour'));
    expect(result.current.hasSeenTour).toBe(true);
  });

  it('startTour activates the first step', () => {
    const { result } = renderHook(() => usePageTour(STEPS, 'test-tour'));

    act(() => {
      result.current.startTour();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.currentStep).toEqual(STEPS[0]);
  });

  it('nextStep advances through steps and ends the tour after the last one', () => {
    const { result } = renderHook(() => usePageTour(STEPS, 'test-tour'));

    act(() => {
      result.current.startTour();
    });
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.currentStep).toEqual(STEPS[1]);

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(2);

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.isActive).toBe(false);
    expect(result.current.hasSeenTour).toBe(true);
    expect(localStorage.getItem('test-tour')).toBe('true');
  });

  it('prevStep moves backward and clamps at the first step', () => {
    const { result } = renderHook(() => usePageTour(STEPS, 'test-tour'));

    act(() => {
      result.current.startTour();
      result.current.nextStep();
    });
    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStepIndex).toBe(0);

    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStepIndex).toBe(0);
  });

  it('skipTour ends the tour immediately and persists seen state', () => {
    const { result } = renderHook(() => usePageTour(STEPS, 'test-tour'));

    act(() => {
      result.current.startTour();
      result.current.skipTour();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.hasSeenTour).toBe(true);
    expect(localStorage.getItem('test-tour')).toBe('true');
  });

  it('startTour is a no-op when there are no steps', () => {
    const { result } = renderHook(() => usePageTour([], 'empty-tour'));

    act(() => {
      result.current.startTour();
    });

    expect(result.current.isActive).toBe(false);
  });

  it('uses independent storage keys per page', () => {
    localStorage.setItem('tour-a', 'true');
    const { result } = renderHook(() => usePageTour(STEPS, 'tour-b'));
    expect(result.current.hasSeenTour).toBe(false);
  });
});
