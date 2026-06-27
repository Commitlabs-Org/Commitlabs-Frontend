import React, { useEffect, useMemo, useState } from 'react';

export type TransactionTimelinePhase = 'build' | 'sign' | 'submit' | 'confirm';
export type TransactionTimelineStatus = 'pending' | 'active' | 'done' | 'failed';

export interface TransactionStepTimelineProps {
  currentPhase: TransactionTimelinePhase;
  state: 'in_progress' | 'success' | 'error';
  txHash?: string;
  onCopyHash?: (hash: string) => void;
}

interface TimelineStep {
  key: TransactionTimelinePhase;
  label: string;
  description: string;
}

const STEPS: TimelineStep[] = [
  { key: 'build', label: 'Build', description: 'Preparing the transaction payload' },
  { key: 'sign', label: 'Sign', description: 'Waiting for wallet approval' },
  { key: 'submit', label: 'Submit', description: 'Sending to the network' },
  { key: 'confirm', label: 'Confirm', description: 'Waiting for ledger confirmation' },
];

function getStatus(step: TimelineStep, currentPhase: TransactionTimelinePhase, state: TransactionTimelineStatus): TransactionTimelineStatus {
  if (state === 'error') {
    return step.key === currentPhase ? 'failed' : step.key < currentPhase ? 'done' : 'pending';
  }

  if (step.key === currentPhase) {
    return state === 'success' ? 'done' : 'active';
  }

  return step.key < currentPhase ? 'done' : 'pending';
}

function formatElapsed(seconds: number) {
  return `Elapsed ${seconds}s`;
}

export default function TransactionStepTimeline({
  currentPhase,
  state,
  txHash,
  onCopyHash,
}: TransactionStepTimelineProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const phaseOrder = useMemo(() => ({ build: 0, sign: 1, submit: 2, confirm: 3 }), []);

  const activeStep = STEPS.find((step) => step.key === currentPhase) ?? STEPS[0];

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (state !== 'in_progress' || reducedMotion) {
      setElapsedSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentPhase, state, reducedMotion]);

  const statusForStep = (step: TimelineStep) => {
    const currentIndex = phaseOrder[currentPhase];
    const stepIndex = phaseOrder[step.key];

    if (state === 'error') {
      return step.key === currentPhase ? 'failed' : step.key < currentPhase ? 'done' : 'pending';
    }

    if (state === 'success') {
      return stepIndex <= currentIndex ? 'done' : 'pending';
    }

    return stepIndex < currentIndex ? 'done' : stepIndex === currentIndex ? 'active' : 'pending';
  };

  const visibleSteps = STEPS.map((step) => ({ ...step, status: statusForStep(step) }));

  const activeLabel = state === 'error' ? 'Failed' : state === 'success' ? 'Completed' : 'Active';

  return (
    <section className="mt-6 w-full" aria-label="Transaction progress">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Transaction timeline</p>
            <p className="text-xs text-white/60">{activeStep.label} • {activeLabel}</p>
          </div>
          {state === 'in_progress' && !reducedMotion && (
            <span className="text-xs text-[#00C950]">{formatElapsed(elapsedSeconds)}</span>
          )}
        </div>

        <ol className="mt-4 space-y-3" aria-label="Transaction progress">
          {visibleSteps.map((step) => {
            const isActive = step.status === 'active';
            const isFailed = step.status === 'failed';
            const isDone = step.status === 'done';
            const baseClass = 'flex items-start gap-3 rounded-lg border px-3 py-3';
            const statusClass = isFailed
              ? 'border-[#FF4757]/20 bg-[#FF4757]/10'
              : isActive
                ? 'border-[#00C950]/25 bg-[#00C950]/10'
                : isDone
                  ? 'border-white/10 bg-white/[0.04]'
                  : 'border-white/10 bg-transparent';

            return (
              <li
                key={step.key}
                className={`${baseClass} ${statusClass}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#121212] text-sm font-semibold text-white">
                  {isFailed ? '!' : isDone ? '✓' : isActive ? '•' : '•'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                      {isFailed ? 'Failed' : isDone ? 'Done' : isActive ? 'Active' : 'Pending'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/60">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {state === 'error' && txHash && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="truncate text-xs font-mono text-white/60">{txHash}</span>
            <button
              type="button"
              onClick={() => onCopyHash?.(txHash)}
              className="text-xs font-medium text-[#00C950]"
              aria-label="Copy transaction hash"
            >
              Copy hash
            </button>
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {state === 'error'
            ? `${activeStep.label} failed.`
            : state === 'success'
              ? `${activeStep.label} completed.`
              : `${activeStep.label} is ${activeLabel.toLowerCase()}.`}
        </p>
      </div>
    </section>
  );
}
