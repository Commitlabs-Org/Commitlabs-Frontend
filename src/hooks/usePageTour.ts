'use client';

import { useCallback, useEffect, useState } from 'react';

export interface PageTourStep {
  targetSelector: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Generic, page-agnostic guided-tour hook.
 *
 * Unlike the create-wizard's `useGuidedTour` (which is coupled to the
 * wizard's 3-step model), this hook only tracks a step index over a flat
 * list of `PageTourStep`s and persists "seen" state to `localStorage` under
 * a caller-supplied key, so it can be reused on any page.
 *
 * - Does not auto-start: callers call `startTour()` explicitly (e.g. from a
 *   "Take a tour" button), keeping the tour opt-in rather than an unsolicited
 *   overlay on every visit.
 * - `hasSeenTour` reflects whether the tour was previously completed/skipped
 *   for this `storageKey`, so callers can decide whether to auto-prompt.
 */
export function usePageTour(steps: PageTourStep[], storageKey: string) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setHasSeenTour(localStorage.getItem(storageKey) === 'true');
    } catch {
      // Ignore privacy-mode/storage-disabled errors; default to "not seen".
    }
  }, [storageKey]);

  const persistSeen = useCallback(() => {
    setHasSeenTour(true);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Ignore quota/privacy errors.
    }
  }, [storageKey]);

  const startTour = useCallback(() => {
    if (steps.length === 0) return;
    setCurrentStepIndex(0);
    setIsActive(true);
  }, [steps.length]);

  const endTour = useCallback(() => {
    setIsActive(false);
    persistSeen();
  }, [persistSeen]);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((index) => {
      const next = index + 1;
      if (next >= steps.length) {
        setIsActive(false);
        persistSeen();
        return index;
      }
      return next;
    });
  }, [steps.length, persistSeen]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((index) => Math.max(0, index - 1));
  }, []);

  return {
    isActive,
    currentStepIndex,
    currentStep: isActive ? (steps[currentStepIndex] ?? null) : null,
    totalSteps: steps.length,
    hasSeenTour,
    startTour,
    skipTour: endTour,
    nextStep,
    prevStep,
  };
}
