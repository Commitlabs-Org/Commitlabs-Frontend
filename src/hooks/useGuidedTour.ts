'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TourStepConfig {
  targetSelector: string;
  title: string;
  content: string;
  wizardStep: 1 | 2 | 3;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStepConfig[] = [
  {
    targetSelector: '[data-testid="wizard-stepper"]',
    title: "Wizard Steps",
    content: "This stepper guides you through the three phases of creating a commitment: choosing a type, configuring parameters, and final review.",
    wizardStep: 1,
    position: 'bottom',
  },
  {
    targetSelector: '[role="radiogroup"]',
    title: "Choose Commitment Type",
    content: "Select a risk profile that fits your strategy. 'Safe' offers loss protection and shorter lock-in, while 'Aggressive' offers high yields with no protection.",
    wizardStep: 1,
    position: 'top',
  },
  {
    targetSelector: '[data-testid="select-type-continue"]',
    title: "Continue to Parameters",
    content: "Once you have selected a commitment type, click here to move on and customize your parameters.",
    wizardStep: 1,
    position: 'top',
  },
  {
    targetSelector: '#amount',
    title: "Commitment Amount",
    content: "Specify the amount you want to commit and select the asset. Make sure you don't exceed your available wallet balance.",
    wizardStep: 2,
    position: 'bottom',
  },
  {
    targetSelector: '#duration',
    title: "Lock-in Duration",
    content: "Define the duration in days. Shorter durations lower your yield potential, and early exits before the end date will incur a penalty.",
    wizardStep: 2,
    position: 'bottom',
  },
  {
    targetSelector: '#maxLoss',
    title: "Automatic Stop-Loss",
    content: "Configure your maximum acceptable loss percentage. If your position reaches this threshold, it is automatically closed on-chain to protect your principal.",
    wizardStep: 2,
    position: 'top',
  },
  {
    targetSelector: '[data-testid="advanced-toggle"]',
    title: "Advanced Risk Settings",
    content: "Optional: Expand this to configure your slippage tolerance and liquidation buffers for fine-grained risk control.",
    wizardStep: 2,
    position: 'top',
  },
  {
    targetSelector: '[data-testid="derived-section"]',
    title: "Derived Values",
    content: "Review your calculated early exit penalty and estimated network fees before proceeding.",
    wizardStep: 2,
    position: 'top',
  },
  {
    targetSelector: '[data-testid="configure-continue"]',
    title: "Proceed to Review",
    content: "Click continue to review your final configuration details.",
    wizardStep: 2,
    position: 'top',
  },
  {
    targetSelector: '[data-testid="review-sections"]',
    title: "Review Parameters",
    content: "Double-check your parameters. All settings are enforced on-chain via smart contracts and cannot be modified after creation.",
    wizardStep: 3,
    position: 'bottom',
  },
  {
    targetSelector: '[data-testid="review-checkboxes"]',
    title: "Accept Terms & Risks",
    content: "You must check these boxes to agree to the smart contract terms and acknowledge the risks before creating your commitment.",
    wizardStep: 3,
    position: 'top',
  },
  {
    targetSelector: '[data-testid="create-commitment-submit"]',
    title: "Create Commitment",
    content: "Ready? Click here to submit your transaction and deploy your on-chain liquidity commitment.",
    wizardStep: 3,
    position: 'top',
  },
];

interface UseGuidedTourProps {
  activeWizardStep: 1 | 2 | 3;
  setWizardStep: (step: 1 | 2 | 3) => void;
  walletAddress?: string;
  onSelectDefaultType?: () => void;
}

export function useGuidedTour({
  activeWizardStep,
  setWizardStep,
  walletAddress,
  onSelectDefaultType,
}: UseGuidedTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to persist "seen" state to API / LocalStorage
  const persistSeenState = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('commitlabs:seen-wizard-tour', 'true');
    }

    if (walletAddress) {
      const token = localStorage.getItem('sessionToken') || `session_${walletAddress}_${Date.now()}`;
      try {
        await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ seenWizardTour: true }),
        });
      } catch (err) {
        console.error('Failed to save tour preferences:', err);
      }
    }
  }, [walletAddress]);

  // Load preferences on mount or wallet address change
  useEffect(() => {
    let active = true;

    async function checkPreferences() {
      setIsLoading(true);
      let seen = false;

      // Check local storage fallback first
      if (typeof window !== 'undefined') {
        seen = localStorage.getItem('commitlabs:seen-wizard-tour') === 'true';
      }

      if (walletAddress) {
        const token = localStorage.getItem('sessionToken') || `session_${walletAddress}_${Date.now()}`;
        try {
          const res = await fetch('/api/user/preferences', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.data?.preferences?.seenWizardTour) {
              seen = true;
            }
          }
        } catch (err) {
          console.error('Failed to fetch preferences:', err);
        }
      }

      if (active) {
        setIsLoading(false);
        if (!seen) {
          setIsActive(true);
          setCurrentStepIndex(0);
        }
      }
    }

    checkPreferences();

    return () => {
      active = false;
    };
  }, [walletAddress]);

  // Sync active step if wizard step changes externally
  useEffect(() => {
    if (!isActive) return;

    const currentStepConfig = TOUR_STEPS[currentStepIndex];
    if (currentStepConfig && currentStepConfig.wizardStep !== activeWizardStep) {
      // Find the first tour step index matching the active wizard step
      const firstMatchingIndex = TOUR_STEPS.findIndex(
        (step) => step.wizardStep === activeWizardStep
      );
      if (firstMatchingIndex !== -1) {
        setCurrentStepIndex(firstMatchingIndex);
      }
    }
  }, [activeWizardStep, currentStepIndex, isActive]);

  const startTour = useCallback(() => {
    setIsActive(true);
    setCurrentStepIndex(0);
    setWizardStep(1);
  }, [setWizardStep]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    persistSeenState();
  }, [persistSeenState]);

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= TOUR_STEPS.length) {
      setIsActive(false);
      persistSeenState();
      return;
    }

    const currentStepConfig = TOUR_STEPS[currentStepIndex];
    const nextStepConfig = TOUR_STEPS[nextIndex];

    // If next tour step belongs to a different wizard step, transition wizard step
    if (currentStepConfig && nextStepConfig && currentStepConfig.wizardStep !== nextStepConfig.wizardStep) {
      // Auto-fill a type selection in step 1 if proceeding to step 2 without selection
      if (currentStepConfig.wizardStep === 1 && onSelectDefaultType) {
        onSelectDefaultType();
      }
      setWizardStep(nextStepConfig.wizardStep);
    }

    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex, setWizardStep, persistSeenState, onSelectDefaultType]);

  const prevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex < 0) return;

    const currentStepConfig = TOUR_STEPS[currentStepIndex];
    const prevStepConfig = TOUR_STEPS[prevIndex];

    // If previous tour step belongs to a different wizard step, transition wizard step
    if (currentStepConfig && prevStepConfig && currentStepConfig.wizardStep !== prevStepConfig.wizardStep) {
      setWizardStep(prevStepConfig.wizardStep);
    }

    setCurrentStepIndex(prevIndex);
  }, [currentStepIndex, setWizardStep]);

  const currentStepConfig = TOUR_STEPS[currentStepIndex];

  return {
    isActive,
    currentStepIndex,
    currentStepConfig,
    totalSteps: TOUR_STEPS.length,
    isLoading,
    startTour,
    skipTour,
    nextStep,
    prevStep,
  };
}
