'use client';

import { Dialog } from '@/components/ui/Dialog';

export interface GuidedTourStepLike {
  targetSelector: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface GuidedTourProps {
  isActive: boolean;
  currentStepIndex: number;
  currentStepConfig: GuidedTourStepLike | null | undefined;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * Step-by-step tour dialog, shared by the create-wizard tour
 * (`useGuidedTour`) and any page using the generic `usePageTour` hook.
 *
 * Renders as an accessible modal dialog (via the shared `Dialog` primitive:
 * focus trap, Escape-to-close, background `inert`) rather than a tooltip
 * anchored to `targetSelector` -- `targetSelector` is used only to scroll
 * the referenced element into view so it's visible behind/around the
 * dialog, not for precise pixel positioning.
 */
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

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex >= totalSteps - 1;

  const handleScrollToTarget = () => {
    if (typeof document === 'undefined') return;
    const target = document.querySelector(currentStepConfig.targetSelector);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <Dialog
      isOpen={isActive}
      onClose={onSkip}
      labelledById="guided-tour-title"
      describedById="guided-tour-content"
      className="w-full max-w-sm rounded-2xl border border-[rgba(0,212,255,0.3)] bg-[#0a0a0b] p-6 text-white shadow-[0_0_30px_rgba(0,212,255,0.15)]"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[#0ff0fc]" aria-live="polite">
        Step {currentStepIndex + 1} of {totalSteps}
      </p>
      <h2 id="guided-tour-title" className="mt-2 text-lg font-semibold">
        {currentStepConfig.title}
      </h2>
      <p id="guided-tour-content" className="mt-2 text-sm text-white/70">
        {currentStepConfig.content}
      </p>

      <button
        type="button"
        onClick={handleScrollToTarget}
        className="mt-3 text-xs font-medium text-[#0ff0fc] underline underline-offset-2 hover:text-white"
      >
        Show me on the page
      </button>

      <div className="mt-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-white/50 hover:text-white"
          data-testid="tour-skip"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium hover:border-white/40"
              data-testid="tour-back"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-[#0ff0fc] px-3 py-1.5 text-sm font-semibold text-black hover:brightness-110"
            data-testid="tour-next"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
