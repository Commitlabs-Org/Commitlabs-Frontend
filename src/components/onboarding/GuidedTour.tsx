'use client';

import React from 'react';
import { TourStep } from './TourStep';
import { TourStepConfig } from '@/hooks/useGuidedTour';

interface GuidedTourProps {
  isActive: boolean;
  currentStepIndex: number;
  currentStepConfig: TourStepConfig | undefined;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function GuidedTour({
  isActive,
  currentStepIndex,
  currentStepConfig,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: GuidedTourProps) {
  if (!isActive || !currentStepConfig) return null;

  return (
    <TourStep
      targetSelector={currentStepConfig.targetSelector}
      title={currentStepConfig.title}
      content={currentStepConfig.content}
      position={currentStepConfig.position}
      currentStepIndex={currentStepIndex}
      totalSteps={totalSteps}
      onNext={onNext}
      onBack={onBack}
      onSkip={onSkip}
    />
  );
}
