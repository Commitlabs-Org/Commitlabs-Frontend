'use client';

import React, { useMemo } from 'react';
import type { DisputeInfo } from '@/types/dispute';
import { useDisputeSSE } from '@/hooks/useDisputeSSE';

// ---------------------------------------------------------------------------
// Re-export the type so consumers can import it from the component module
// ---------------------------------------------------------------------------
export type { DisputeInfo };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DisputeStatusTrackerProps {
  /**
   * The current dispute information.
   * Pass `null` when no dispute is active — the stepper will show an idle state.
   */
  dispute: DisputeInfo | null;

  /**
   * Optional commitment ID. When provided, the component subscribes to live
   * SSE events for this commitment and overlays live dispute-stage updates
   * on top of the `dispute` prop, plus renders a connection-status badge.
   */
  commitmentId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGES: readonly DisputeInfo['stage'][] = [
  'filed',
  'under_review',
  'escalated',
  'resolved',
  'dismissed',
] as const;

const STAGE_LABELS: Record<DisputeInfo['stage'], string> = {
  filed: 'Filed',
  under_review: 'Under Review',
  escalated: 'Escalated',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const STAGE_ORDER: Record<DisputeInfo['stage'], number> = {
  filed: 0,
  under_review: 1,
  escalated: 2,
  resolved: 3,
  dismissed: 3,
};

/** Returns the index of the current active stage (0-based). */
function activeStageIndex(stage: DisputeInfo['stage']): number {
  return STAGE_ORDER[stage] ?? 0;
}

const BADGE_STYLES: Record<string, { bg: string; dot: string; label: string }> = {
  live: {
    bg: 'rgba(34,197,94,0.12)',
    dot: '#22c55e',
    label: 'Live',
  },
  connecting: {
    bg: 'rgba(250,204,21,0.12)',
    dot: '#facc15',
    label: 'Connecting…',
  },
  reconnecting: {
    bg: 'rgba(251,146,60,0.12)',
    dot: '#fb923c',
    label: 'Reconnecting…',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DisputeStatusTracker({
  dispute: initialDispute,
  commitmentId,
}: DisputeStatusTrackerProps) {
  // --- SSE live updates (only when commitmentId is provided) ---------------
  const { liveDispute, connectionState } = useDisputeSSE(commitmentId ?? '');

  // Merge initial/mock dispute with any live SSE data.
  // Live data takes precedence when available.
  const dispute = useMemo<DisputeInfo | null>(() => {
    if (commitmentId && liveDispute) {
      return liveDispute;
    }
    return initialDispute;
  }, [commitmentId, liveDispute, initialDispute]);

  const currentStage = dispute?.stage ?? null;
  const activeIdx = currentStage ? activeStageIndex(currentStage) : -1;

  // --- Badge for SSE status -------------------------------------------------
  const badge = commitmentId ? BADGE_STYLES[connectionState] : null;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <section
      className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]"
      aria-label="Dispute status tracker"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[#f5f5f7]">Dispute Tracker</h2>

        {badge && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: badge.bg, color: badge.dot }}
            role="status"
            aria-live="polite"
            aria-label={`SSE connection: ${badge.label}`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: badge.dot,
                animation:
                  connectionState === 'live' ? 'pulse-dot 2s ease-in-out infinite' : undefined,
              }}
            />
            {badge.label}
          </span>
        )}
      </div>

      {/* Stepper */}
      {dispute ? (
        <div className="space-y-4">
          {/* Step indicators */}
          <ol className="flex items-center w-full" aria-label="Dispute stages">
            {STAGES.map((stage, idx) => {
              const isCompleted = idx < activeIdx;
              const isCurrent = idx === activeIdx;
              const isFuture = idx > activeIdx;

              return (
                <li
                  key={stage}
                  className={`flex items-center ${idx < STAGES.length - 1 ? 'flex-1' : ''}`}
                >
                  {/* Step circle + label */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        relative flex h-8 w-8 items-center justify-center rounded-full
                        text-xs font-bold transition-colors duration-300
                        ${isCompleted ? 'bg-[#22c55e] text-[#050505]' : ''}
                        ${isCurrent ? 'bg-[#3b82f6] text-white' : ''}
                        ${isFuture ? 'bg-[#222] text-[#888]' : ''}
                      `}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {isCompleted ? (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`
                        mt-1.5 text-[11px] leading-tight text-center max-w-[64px]
                        ${isCurrent ? 'text-[#f5f5f7] font-medium' : 'text-[#666]'}
                      `}
                    >
                      {STAGE_LABELS[stage]}
                    </span>
                  </div>

                  {/* Connector line */}
                  {idx < STAGES.length - 1 && (
                    <div
                      className={`
                        flex-1 h-0.5 mx-1 mb-6 rounded-full transition-colors duration-300
                        ${isCompleted ? 'bg-[#22c55e]' : 'bg-[#222]'}
                      `}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Dispute details card */}
          <div className="bg-[#111] rounded-xl p-4 border border-[#1a1a1a] text-sm space-y-1.5">
            <div className="flex justify-between text-[#888]">
              <span>Filed</span>
              <span className="text-[#f5f5f7]">
                {new Date(dispute.filedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between text-[#888]">
              <span>Category</span>
              <span className="text-[#f5f5f7]">{dispute.reasonCategory}</span>
            </div>
            {dispute.reviewStartedAt && (
              <div className="flex justify-between text-[#888]">
                <span>Review started</span>
                <span className="text-[#f5f5f7]">
                  {new Date(dispute.reviewStartedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {dispute.resolvedAt && (
              <div className="flex justify-between text-[#888]">
                <span>Resolved</span>
                <span className="text-[#f5f5f7]">
                  {new Date(dispute.resolvedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {dispute.resolution && (
              <div className="pt-2 mt-2 border-t border-[#1a1a1a] text-[#a3a3a3]">
                {dispute.resolution}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No active dispute */
        <div className="text-center py-10 text-[#666] text-sm">
          <svg
            className="mx-auto h-10 w-10 mb-3 text-[#333]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <p className="font-medium text-[#888]">No active dispute</p>
          <p className="mt-1 text-[#555]">
            This commitment is in good standing with no disputes on file.
          </p>
        </div>
      )}

      {/* Inline keyframes for the pulse animation */}
      <style jsx>{`
        @keyframes pulse-dot {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </section>
  );
}
