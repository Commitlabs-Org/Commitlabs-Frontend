'use client';

import React from 'react';
import { useDisputeSSE } from '@/hooks/useDisputeSSE';

export type DisputeStage = 'filed' | 'under_review' | 'resolved';
export type DisputeResolution =
  | 'resolved_in_favor_of_owner'
  | 'resolved_in_favor_of_counterparty'
  | 'dismissed';

export interface DisputeInfo {
  stage: DisputeStage;
  filedAt?: string;
  reasonCategory?: string;
  reviewStartedAt?: string;
  resolvedAt?: string;
  resolution?: DisputeResolution;
}

interface DisputeStatusTrackerProps {
  dispute: DisputeInfo | null;
  /**
   * When provided, the component subscribes to /api/events?commitmentId=<id>
   * via SSE and live-updates the displayed dispute status.
   */
  commitmentId?: string;
}

const STAGE_INDEX: Record<DisputeStage, number> = {
  filed: 0,
  under_review: 1,
  resolved: 2,
};

const RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  resolved_in_favor_of_owner: 'Resolved in your favor',
  resolved_in_favor_of_counterparty: 'Resolved against you',
  dismissed: 'Dismissed',
};

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type StepState = 'completed' | 'current' | 'pending';

function getStepState(stepIndex: number, currentIndex: number): StepState {
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'pending';
}

interface StepIndicatorProps {
  state: StepState;
}

function StepIndicator({ state }: StepIndicatorProps) {
  if (state === 'completed') {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0ff0fc]/20 border border-[#0ff0fc]"
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 7l4 4 6-7"
            stroke="#0ff0fc"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (state === 'current') {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF8A04]/20 border-2 border-[#FF8A04]"
        aria-hidden="true"
      >
        <span className="h-3 w-3 rounded-full bg-[#FF8A04]" />
      </span>
    );
  }

  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#333] bg-[#111]"
      aria-hidden="true"
    >
      <span className="h-2 w-2 rounded-full bg-[#444]" />
    </span>
  );
}

export default function DisputeStatusTracker({ dispute: initialDispute, commitmentId }: DisputeStatusTrackerProps) {
  const { dispute, connected, error } = useDisputeSSE({
    commitmentId: commitmentId ?? '',
    initialDispute,
  });

  if (!dispute) return null;

  const currentIndex = STAGE_INDEX[dispute.stage];

  const steps = [
    {
      key: 'filed' as const,
      label: 'Filed',
      timestamp: formatTimestamp(dispute.filedAt),
      detail: dispute.reasonCategory,
    },
    {
      key: 'under_review' as const,
      label: 'Under Review',
      timestamp: formatTimestamp(dispute.reviewStartedAt),
    },
    {
      key: 'resolved' as const,
      label: 'Resolved',
      timestamp: formatTimestamp(dispute.resolvedAt),
      detail: dispute.resolution ? RESOLUTION_LABELS[dispute.resolution] : undefined,
    },
  ];

  return (
    <section
      aria-labelledby="dispute-tracker-heading"
      className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#FF8A04]/20"
    >
      <div className="flex items-center justify-between mb-6">
        <h2
          id="dispute-tracker-heading"
          className="text-sm font-semibold uppercase tracking-[0.18em] text-[#FF8A04]"
        >
          Dispute Status
        </h2>
        {commitmentId && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              error
                ? 'border-red-500/30 text-red-400'
                : connected
                  ? 'border-green-500/30 text-green-400'
                  : 'border-[#333] text-[#99a1af]'
            }`}
            aria-live="polite"
          >
            {error ? 'Reconnecting…' : connected ? 'Live' : 'Connecting…'}
          </span>
        )}
      </div>

      <ol className="flex items-start" aria-label="Dispute lifecycle steps">
        {steps.map((step, index) => {
          const state = getStepState(index, currentIndex);
          const isCurrent = state === 'current';
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.key}>
              <li
                className="flex flex-col items-center"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <StepIndicator state={state} />
                <div className="mt-2 flex flex-col items-center text-center w-24">
                  <span
                    className={`text-xs font-semibold ${
                      state === 'pending'
                        ? 'text-[#555]'
                        : state === 'current'
                          ? 'text-[#FF8A04]'
                          : 'text-[#0ff0fc]'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.timestamp && (
                    <span className="mt-1 text-[10px] leading-tight text-[#666]">
                      {step.timestamp}
                    </span>
                  )}
                  {step.detail && (
                    <span className="mt-1 text-[10px] leading-tight text-[#888] italic">
                      {step.detail}
                    </span>
                  )}
                </div>
              </li>
              {!isLast && (
                <div
                  className={`mt-4 flex-1 h-px min-w-[32px] ${
                    index < currentIndex ? 'bg-[#0ff0fc]/40' : 'bg-[#2a2a2a]'
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </section>
  );
}
