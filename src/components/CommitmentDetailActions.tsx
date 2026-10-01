import React, { useCallback, useRef, useState } from 'react';
import { FiLogOut, FiFileText, FiDownload, FiAlertCircle, FiCopy } from 'react-icons/fi';
import { SettlementEligibilityChecklist } from '@/components/settlement/SettlementEligibilityChecklist';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical commitment statuses that gate which actions are available. */
export type CommitmentStatusType =
  | 'Active'
  | 'Disputed'
  | 'Early Exit'
  | 'Settled'
  | 'Violated'
  | 'Created'
  | 'Funded';

interface ActionTelemetryEvent {
  action: string;
  commitmentId?: string | undefined;
  allowed: boolean;
  reason?: string | undefined;
  latencyMs?: number | undefined;
}

/** Lightweight telemetry emitter — never leaks secrets. */
function emitActionTelemetry(event: ActionTelemetryEvent) {
  if (typeof window === 'undefined') return;
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[CommitmentDetailActions]', event);
    }
  } catch {
    // Diagnostics must never break rendering.
  }
}

// ---------------------------------------------------------------------------
// Invariant helpers
// ---------------------------------------------------------------------------

/**
 * Early exit is only permitted when the commitment is Active and has
 * days remaining > 0. Disputed or terminal statuses block early exit.
 */
export function canEarlyExitInvariant(
  status: CommitmentStatusType | undefined,
  daysRemaining: number | undefined,
): { allowed: boolean; reason?: string } {
  if (status !== undefined && status !== 'Active') {
    return { allowed: false, reason: `Early exit unavailable: status is "${status}"` };
  }
  if (daysRemaining !== undefined && daysRemaining <= 0) {
    return { allowed: false, reason: 'Early exit unavailable: commitment has matured' };
  }
  return { allowed: true };
}

/**
 * Settle is only permitted when the commitment has matured (daysRemaining <= 0)
 * and is not already settled or in a disputed state that blocks settlement.
 */
export function canSettleInvariant(
  status: CommitmentStatusType | undefined,
  daysRemaining: number | undefined,
): { allowed: boolean; reason?: string } {
  if (status === 'Settled') {
    return { allowed: false, reason: 'Settlement unavailable: already settled' };
  }
  if (status === 'Disputed') {
    return { allowed: false, reason: 'Settlement unavailable: commitment is disputed' };
  }
  if (daysRemaining !== undefined && daysRemaining > 0) {
    return { allowed: false, reason: 'Settlement unavailable: commitment has not matured yet' };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Debounced action lock (prevents rapid-fire double-clicks)
// ---------------------------------------------------------------------------

const ACTION_LOCK_MS = 800;

function useActionLock() {
  const lockRef = useRef(false);

  const withLock = useCallback(
    <T extends (...args: unknown[]) => unknown>(fn: T): T => {
      return ((...args: unknown[]) => {
        if (lockRef.current) return;
        lockRef.current = true;
        setTimeout(() => {
          lockRef.current = false;
        }, ACTION_LOCK_MS);
        return fn(...args);
      }) as T;
    },
    [],
  );

  return withLock;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CommitmentDetailActionsProps {
  canEarlyExit: boolean;
  onEarlyExit: () => void;
  onViewAttestations: () => void;
  onExportData: () => void;
  onReportIssue: () => void;
  /** Called when the user clicks Duplicate; receives the source commitment id. */
  onDuplicate?: (commitmentId: string) => void;
  earlyExitDisabledReason?: string;
  commitmentId?: string;
  onSettle?: () => void;
  settleDisabledReason?: string;
  /**
   * When set, disables the Report Issue button and surfaces this reason
   * (e.g. wallet not connected, wrong network, or not the commitment
   * owner). Filing a dispute is an authorization-sensitive action, so the
   * caller is expected to derive this from an authoritative ownership
   * check rather than only from client-visible commitment state.
   */
  reportIssueDisabledReason?: string;
  previewRefreshTrigger?: string | number;
}

export function CommitmentDetailActions({
  canEarlyExit,
  onEarlyExit,
  onViewAttestations,
  onExportData,
  onReportIssue,
  onDuplicate,
  earlyExitDisabledReason = 'Early exit is only available before maturity',
  commitmentId,
  onSettle,
  settleDisabledReason,
  reportIssueDisabledReason,
  previewRefreshTrigger,
}: CommitmentDetailActionsProps) {
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]';

  const withLock = useActionLock();
  const [duplicateStatus, setDuplicateStatus] = useState<'idle' | 'duplicating'>('idle');

  const handleEarlyExit = useCallback(() => {
    if (!canEarlyExit) {
      emitActionTelemetry({
        action: 'early_exit',
        ...(commitmentId !== undefined ? { commitmentId } : {}),
        allowed: false,
        reason: 'canEarlyExit is false',
      });
      return;
    }
    emitActionTelemetry({
      action: 'early_exit',
      ...(commitmentId !== undefined ? { commitmentId } : {}),
      allowed: true,
    });
    onEarlyExit();
  }, [canEarlyExit, commitmentId, onEarlyExit]);

  const handleViewAttestations = useCallback(() => {
    emitActionTelemetry({ action: 'view_attestations', ...(commitmentId !== undefined ? { commitmentId } : {}), allowed: true });
    onViewAttestations();
  }, [commitmentId, onViewAttestations]);

  const handleExportData = useCallback(() => {
    emitActionTelemetry({ action: 'export_data', ...(commitmentId !== undefined ? { commitmentId } : {}), allowed: true });
    onExportData();
  }, [commitmentId, onExportData]);

  const handleReportIssue = useCallback(() => {
    emitActionTelemetry({ action: 'report_issue', ...(commitmentId !== undefined ? { commitmentId } : {}), allowed: true });
    onReportIssue();
  }, [commitmentId, onReportIssue]);

  const handleDuplicate = useCallback(() => {
    if (!commitmentId || !onDuplicate) return;
    setDuplicateStatus('duplicating');
    const t0 = performance.now();
    try {
      onDuplicate(commitmentId);
      emitActionTelemetry({
        action: 'duplicate',
        ...(commitmentId !== undefined ? { commitmentId } : {}),
        allowed: true,
        latencyMs: Math.round(performance.now() - t0),
      });
    } catch (err) {
      emitActionTelemetry({
        action: 'duplicate',
        ...(commitmentId !== undefined ? { commitmentId } : {}),
        allowed: false,
        reason: err instanceof Error ? err.message : 'unknown',
      });
    } finally {
      setDuplicateStatus('idle');
    }
  }, [commitmentId, onDuplicate]);

  const settlementChecklistProps = {
    ...(onSettle !== undefined ? { onSettle } : {}),
    ...(settleDisabledReason !== undefined ? { disabledReason: settleDisabledReason } : {}),
    ...(previewRefreshTrigger !== undefined ? { refreshTrigger: previewRefreshTrigger } : {}),
  };

  return (
    <div className="w-full">
      {/* Section Heading */}
      <h2 className="text-white text-3xl font-bold mb-8">Actions</h2>

      {/* Primary Actions */}
      <div className="mb-8">
        <h3 className="text-white text-base font-semibold mb-4">Primary Actions</h3>

        {/* Early Exit Button */}
        <button
          onClick={canEarlyExit ? withLock(handleEarlyExit) : undefined}
          disabled={!canEarlyExit}
          title={!canEarlyExit ? earlyExitDisabledReason : undefined}
          className={`
            w-full rounded-3xl px-8 py-6
            border-2 transition-all duration-300
            flex items-center gap-6 justify-center
            ${
              canEarlyExit
                ? 'bg-[#0A0A0A] border-[#F97316] shadow-[0_4px_24px_rgba(249,115,22,0.2),inset_0_1px_0_rgba(249,115,22,0.1)] hover:shadow-[0_8px_32px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(249,115,22,0.2)] cursor-pointer hover:bg-[#161616]'
                : 'bg-[#161616] border-[#F97316]/30 opacity-50 cursor-not-allowed'
            }
            ${focusRing}
          `}
          aria-label="Early Exit - Exit before expiry (penalty applies)"
          aria-disabled={!canEarlyExit}
        >
          <FiLogOut className="text-[#F97316]" size={28} />

          <div className="text-left">
            <div className="text-[#F97316] text-xl font-semibold mb-1">Early Exit</div>
            <div className="text-white/50 text-sm">Exit before expiry (penalty applies)</div>
          </div>
        </button>
      </div>

      {commitmentId ? (
        <div className="mb-8">
          <SettlementEligibilityChecklist
            commitmentId={commitmentId}
            {...settlementChecklistProps}
          />
        </div>
      ) : null}

      {/* Additional Actions */}
      <div className="mb-8">
        <h3 className="text-white text-base font-semibold mb-4">Additional Actions</h3>

        <div className="space-y-3">
          {/* View Full Attestation History */}
          <button
            onClick={handleViewAttestations}
            className={`
              w-full rounded-2xl px-6 py-4
              bg-[#0a2122] border border-[#0b5d61]
              hover:bg-[#0d1d1e] hover:border-[#0f2324]
              transition-all duration-200
              flex items-center gap-4
              cursor-pointer
              ${focusRing}
            `}
            aria-label="View Full Attestation History"
          >
            <FiFileText className="text-white/70" size={22} />

            <span className="text-white text-base flex-1 text-left font-medium">
              View Full Attestation History
            </span>
          </button>

          {/* Export Commitment Data */}
          <button
            onClick={handleExportData}
            className={`
              w-full rounded-2xl px-6 py-4
              bg-[#161616] border border-[#232323]
              hover:bg-[#1a1a1a] hover:border-[#1f1f1f]
              transition-all duration-200
              flex items-center gap-4
              cursor-pointer
              ${focusRing}
            `}
            aria-label="Export Commitment Data"
          >
            <FiDownload className="text-white/70" size={22} />

            <span className="text-white text-base flex-1 text-left font-medium">
              Export Commitment Data
            </span>
          </button>

          {/* Duplicate Commitment */}
          {commitmentId && onDuplicate && (
            <button
              onClick={handleDuplicate}
              disabled={duplicateStatus === 'duplicating'}
              className={`
                w-full rounded-2xl px-6 py-4
                bg-[#0a1a2a] border border-[#0b3d61]
                hover:bg-[#0d1d2e] hover:border-[#0f4a72]
                transition-all duration-200
                flex items-center gap-4
                cursor-pointer disabled:opacity-50
                ${focusRing}
              `}
              aria-label="Duplicate Commitment - create a new commitment prefilled with these parameters"
              data-testid="duplicate-commitment-btn"
            >
              <FiCopy className="text-[#0FF0FC]/70" size={22} />

              <div className="text-left">
                <span className="text-white text-base font-medium block">
                  {duplicateStatus === 'duplicating' ? 'Duplicating…' : 'Duplicate Commitment'}
                </span>
                <span className="text-white/50 text-xs">
                  Open create flow prefilled with these parameters
                </span>
              </div>
            </button>
          )}

          {/* Print / Save PDF */}
          {commitmentId && (
            <a
              href={`/commitments/${commitmentId}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                w-full rounded-2xl px-6 py-4
                bg-[#161616] border border-[#232323]
                hover:bg-[#1a1a1a] hover:border-[#1f1f1f]
                transition-all duration-200
                flex items-center gap-4
                cursor-pointer no-underline
                ${focusRing}
              `}
              aria-label="Print or save as PDF"
            >
              <FiFileText className="text-white/70" size={22} />
              <span className="text-white text-base flex-1 text-left font-medium">
                Print / Save PDF
              </span>
            </a>
          )}

          {/* Report an Issue */}
          <button
            onClick={handleReportIssue}
            className={`
              w-full rounded-2xl px-6 py-4
              bg-[#161616] border border-[#232323]
              transition-all duration-200
              flex items-center gap-4
              ${focusRing}
              ${
                reportIssueDisabledReason
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-[#1a1a1a] hover:border-[#1f1f1f] cursor-pointer'
              }
            `}
            aria-label="Report an Issue"
            aria-disabled={!!reportIssueDisabledReason}
          >
            <FiAlertCircle className="text-white/70" size={22} />

            <span className="text-white text-base flex-1 text-left font-medium">
              Report an Issue
            </span>
          </button>
        </div>
      </div>

      {/* Helper Note */}
      <div
        className="
        rounded-3xl px-6 py-5
        bg-[#0a1516] border border-[#0a282a]
        flex items-start gap-4 
      "
      >
        <p className="text-white/50 text-sm leading-relaxed">
          All actions are recorded on-chain and can be verified through attestations. Contact
          support if you encounter any issues.
        </p>
      </div>
    </div>
  );
}
