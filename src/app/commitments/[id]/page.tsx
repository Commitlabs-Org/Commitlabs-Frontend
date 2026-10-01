'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import CommitmentDetailHeader from '@/components/Commitmentdetailheader';
import CommitmentHealthMetrics from '@/components/dashboard/CommitmentHealthMetrics';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import CommitmentDetailAllocationConstraints from '@/components/CommitmentDetailAllocationConstraints';
import { CommitmentDetailNftSection } from '@/components/dashboard/CommitmentDetailNftSection';
import { CommitmentDetailParameters } from '@/components/CommitmentDetailParameters/CommitmentDetailParameters';
import { CommitmentDetailActions } from '@/components/CommitmentDetailActions';
import RecentAttestationsPanel from '@/components/RecentAttestationsPanel/RecentAttestationsPanel';
import ExportCommitmentsModal from '@/components/export/ExportCommitmentsModal';
import CommitmentEarlyExitModal from '@/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal';
import DisputeModal from '@/components/modals/DisputeModal';
import DisputeStatusTracker, { type DisputeInfo } from '@/components/dispute/DisputeStatusTracker';
import { openExplorerUrl } from '@/utils/explorerLinks';
import { computeCommitmentExposure } from '@/utils/exposure';
import { CommitmentStatusProvider, useCommitmentStatus } from '@/context/CommitmentStatusContext';
import { useShareLink } from '@/hooks/useShareLink';
import { useToast } from '@/components/toast/ToastProvider';
import { getAppExplorerNetwork } from './explorerNetwork';
import { useRecentlyViewed, RECENTLY_VIEWED_COMMITMENTS_KEY } from '@/hooks/useRecentlyViewed';
import { RecentlyViewedCommitmentsRail } from '@/components/RecentlyViewedCommitmentsRail';
import { useRegisterCommands } from '@/components/CommandPalette';
import { buildCommitmentScopedCommands } from '@/components/CommandPalette/scopedActions';
import { useWallet } from '@/hooks/useWallet';

// ---------------------------------------------------------------------------
// Bounds & constants
// ---------------------------------------------------------------------------

/** Maximum number of chart data points to render (bounds memory & rendering). */
const MAX_CHART_POINTS = 500;

/** Maximum number of attestations shown in the panel (bounds DOM nodes). */
const MAX_VISIBLE_ATTESTATIONS = 50;

/** Minimum ms between status-override transitions (prevents rapid toggling). */
const STATUS_TRANSITION_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Structured diagnostics (never leaks secrets)
// ---------------------------------------------------------------------------

function emitPageTelemetry(
  event: string,
  meta: Record<string, string | number | boolean> = {},
) {
  if (typeof window === 'undefined') return;
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[CommitmentPage] ${event}`, meta);
    }
  } catch {
    // Diagnostics must never break rendering.
  }
}

// ---------------------------------------------------------------------------
// Bounded mock data helpers
// ---------------------------------------------------------------------------

function boundArray<T>(arr: T[], max: number): T[] {
  return arr.length > max ? arr.slice(arr.length - max) : arr;
}

// Mock Commitments
const MOCK_COMMITMENTS: Record<
  string,
  {
    id: string;
    type: string;
    duration: number;
    maxLoss: number;
    earlyExitPenaltyPercent?: number;
    canEarlyExit: boolean;
    /**
     * The Stellar address of the commitment's owner. Actions that mutate
     * or exit a commitment (early exit, settle, dispute) must only be
     * available when the connected wallet matches this address — this is
     * the authoritative source for the ownership boundary, not client
     * component state.
     */
    ownerAddress: string;
  }
> = {
  '1': {
    id: '1',
    type: 'Balanced',
    duration: 60,
    maxLoss: 8,
    earlyExitPenaltyPercent: 3,
    canEarlyExit: true,
    ownerAddress: `G${'A'.repeat(55)}`,
  },
  '2': {
    id: '2',
    type: 'Safe',
    duration: 30,
    maxLoss: 2,
    earlyExitPenaltyPercent: 3,
    canEarlyExit: false,
    ownerAddress: `G${'B'.repeat(55)}`,
  },
};

// Mock dispute state
const MOCK_DISPUTES: Record<string, DisputeInfo | null> = {
  '1': {
    stage: 'under_review',
    filedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reasonCategory: 'Compliance violation',
    reviewStartedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  '2': null,
};

// Bounded mock data for health metrics
const MOCK_COMPLIANCE_DATA = boundArray(
  [
    { date: 'Jan 1', complianceScore: 98 },
    { date: 'Jan 5', complianceScore: 97 },
    { date: 'Jan 10', complianceScore: 99 },
    { date: 'Jan 15', complianceScore: 95 },
    { date: 'Jan 20', complianceScore: 98 },
    { date: 'Jan 25', complianceScore: 100 },
    { date: 'Jan 30', complianceScore: 99 },
  ],
  MAX_CHART_POINTS,
);

const MOCK_DRAWDOWN_DATA = boundArray(
  [
    { date: 'Jan 10', drawdownPercent: 0 },
    { date: 'Jan 15', drawdownPercent: 0.35 },
    { date: 'Jan 20', drawdownPercent: 0.58 },
    { date: 'Jan 25', drawdownPercent: 0.52 },
    { date: 'Jan 28', drawdownPercent: 0.78 },
  ],
  MAX_CHART_POINTS,
);

const MOCK_VALUE_HISTORY_DATA = boundArray(
  [
    { date: 'Jan 10', currentValue: 50000, initialAmount: 50000 },
    { date: 'Jan 15', currentValue: 52000, initialAmount: 50000 },
    { date: 'Jan 20', currentValue: 51500, initialAmount: 50000 },
    { date: 'Jan 25', currentValue: 53000, initialAmount: 50000 },
    { date: 'Jan 28', currentValue: 54000, initialAmount: 50000 },
  ],
  MAX_CHART_POINTS,
);

const MOCK_FEE_GENERATION_DATA = boundArray(
  [
    { date: 'Jan 10', feeAmount: 25 },
    { date: 'Jan 15', feeAmount: 45 },
    { date: 'Jan 20', feeAmount: 78 },
    { date: 'Jan 25', feeAmount: 92 },
    { date: 'Jan 28', feeAmount: 125 },
  ],
  MAX_CHART_POINTS,
);

const MOCK_ATTESTATIONS = boundArray(
  [
    {
      id: '1',
      title: 'Daily Compliance Check',
      description: 'All parameters within acceptable ranges. No violations detected.',
      txHash: '0xabcdef1234567890abcdef1234567890',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      severity: 'ok' as const,
    },
    {
      id: '2',
      title: 'Allocation Verified',
      description: 'Portfolio allocation meets all constraints. Safe protocol usage confirmed.',
      txHash: '0x123456789abcdef123456789abcdef',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      severity: 'ok' as const,
    },
    {
      id: '3',
      title: 'Increased Volatility',
      description: 'Market volatility increased. Monitoring drawdown levels closely.',
      txHash: '0x567890abcdef1234567890abcdef1234',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      severity: 'warning' as const,
    },
    {
      id: '4',
      title: 'Weekly Review',
      description: 'Commitment performing well. All rules followed consistently.',
      txHash: '0x90abcd1234567890abcd345678',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      severity: 'ok' as const,
    },
    {
      id: '5',
      title: 'Commitment Created',
      description: 'Initial commitment parameters set and validated on-chain.',
      txHash: '0xdef1234567890abcdef890abc',
      timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      severity: 'ok' as const,
    },
  ],
  MAX_VISIBLE_ATTESTATIONS,
);

const MOCK_ATTESTATION_SUMMARY = {
  complianceCount: 4,
  warningCount: 1,
  violationCount: 0,
};

// Mock data for the NFT section
const MOCK_NFT_DATA = {
  tokenId: '123456789',
  ownerAddress: `G${'A'.repeat(55)}`,
  contractAddress: `C${'B'.repeat(55)}`,
  mintDate: 'Jan 10, 2026',
};

const MOCK_OWNER_ADDRESS = `G${'A'.repeat(55)}`;

function getCommitmentById(id: string) {
  return MOCK_COMMITMENTS[id] ?? null;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CommitmentDetailPage({ params }: { params: { id: string } }) {
  if (!isValidCommitmentId(params.id)) {
    notFound();
  }

  const commitment = getCommitmentById(params.id);
  if (!commitment) notFound();

  return (
    <CommitmentStatusProvider commitmentId={commitment.id}>
      <CommitmentDetailPageContent commitment={commitment} routeParamId={params.id} />
    </CommitmentStatusProvider>
  );
}

function CommitmentDetailPageContent({
  commitment,
  routeParamId,
}: {
  commitment: NonNullable<ReturnType<typeof getCommitmentById>>;
  routeParamId: string;
}) {
  const wallet = useWallet();
  const { status } = useCommitmentStatus();

  const [dispute, setDispute] = useState<DisputeInfo | null>(
    () => MOCK_DISPUTES[routeParamId] ?? null,
  );
  const [commitmentStatusOverride, setCommitmentStatusOverride] = useState<string | null>(null);

  // Debounced status override transition to prevent rapid toggling
  const statusTransitionRef = useRef(0);

  const durationLabel = `${commitment.duration} days`;
  const maxLossLabel = `${commitment.maxLoss}%`;
  const commitmentTypeLabel = commitment.type;
  const earlyExitPenaltyLabel = `${commitment.earlyExitPenaltyPercent ?? 3}%`;

  const exposure = computeCommitmentExposure({
    valueHistory: MOCK_VALUE_HISTORY_DATA,
    drawdownHistory: MOCK_DRAWDOWN_DATA,
    maxLossPercent: commitment.maxLoss,
  });

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [earlyExitModalOpen, setEarlyExitModalOpen] = useState(false);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);

  // Reentrancy guard: prevents a double-click / rapid repeat confirm from
  // firing the same sensitive action twice while the first is still being
  // processed. A ref (not state) is used deliberately so the check inside
  // the handler always reads the latest value synchronously, rather than a
  // value captured in a stale render closure.
  const actionInFlightRef = useRef(false);

  const attestationsRef = useRef<HTMLDivElement>(null);
  const { success: showSuccess, error: showError } = useToast();

  // Ownership is re-derived on every render from the live wallet state, so
  // a wallet disconnect/account switch/network change is reflected
  // immediately rather than only at the moment the page first loaded.
  const ownership = useMemo(
    () => deriveOwnership(wallet, commitment.ownerAddress),
    [wallet, commitment.ownerAddress],
  );
  const authorized = isAuthorized(ownership);

  const statusEligibleForEarlyExit = isEligibleForEarlyExit(status);
  const canEarlyExit = authorized && statusEligibleForEarlyExit;
  const earlyExitDisabledReason =
    ownershipDisabledReason(ownership) ??
    (!statusEligibleForEarlyExit ? 'Early exit is only available before maturity' : undefined);

  const canSettle = authorized && commitmentStatusOverride !== 'Disputed';
  const settleDisabledReason =
    ownershipDisabledReason(ownership) ??
    (commitmentStatusOverride === 'Disputed'
      ? 'Settlement is unavailable while a dispute is under review'
      : undefined);

  const reportIssueDisabledReason = ownershipDisabledReason(ownership);

  const handleCopy = async (text: string, label: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        showSuccess({
          title: `${label} Copied`,
          description: `${label} has been copied to your clipboard.`,
        });
      } catch (_err) {
        showError({
          title: 'Copy Failed',
          description: 'Unable to copy to clipboard. Please try again.',
        });
      }
    }
  };

  const handleViewDetails = () =>
    showSuccess({ title: 'Coming Soon', description: 'NFT detail view is not yet available.' });
  const handleViewExplorer = () =>
    openExplorerUrl('contract', MOCK_NFT_DATA.contractAddress, 'testnet');
  const handleTransfer = () =>
    showSuccess({ title: 'Coming Soon', description: 'NFT transfer is not yet available.' });

  const handleViewAttestations = useCallback(() => {
    attestationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleExportData = useCallback(() => {
    setExportModalOpen(true);
  }, []);

  const handleReportIssue = useCallback(() => {
    if (!authorized) {
      showError({
        title: 'Not authorized',
        description:
          reportIssueDisabledReason ?? 'You are not authorized to file a dispute on this commitment.',
      });
      return;
    }
    setDisputeModalOpen(true);
  }, [authorized, reportIssueDisabledReason, showError]);

  const handleDisputeSubmitted = useCallback(() => {
    const now = Date.now();

    // Debounce: prevent rapid successive dispute submissions
    if (now - statusTransitionRef.current < STATUS_TRANSITION_DEBOUNCE_MS) {
      emitPageTelemetry('dispute_submit_debounced', { commitmentId: params.id });
      return;
    }
    statusTransitionRef.current = now;

    setDispute({
      stage: 'under_review',
      filedAt: new Date().toISOString(),
      reasonCategory: 'Pending review',
      reviewStartedAt: new Date().toISOString(),
    });
    setCommitmentStatusOverride('Disputed');
    setDisputeModalOpen(false);

    emitPageTelemetry('dispute_submitted', {
      commitmentId: params.id,
      newStatus: 'Disputed',
    });
  }, [params.id]);

  const handleEarlyExit = useCallback(() => {
    emitPageTelemetry('early_exit_modal_open', { commitmentId: params.id });
    setEarlyExitModalOpen(true);
  }, [params.id]);

  const handleSettle = useCallback(() => {
    emitPageTelemetry('settle_attempt', { commitmentId: params.id, available: false });
    showSuccess({ title: 'Coming Soon', description: 'Settlement is not yet available.' });
  }, [showSuccess, params.id]);

  const scopedCommands = useMemo(
    () =>
      buildCommitmentScopedCommands({
        commitmentId: commitment.id,
        canSettle,
        canEarlyExit,
        onSettle: handleSettle,
        onEarlyExit: handleEarlyExit,
      }),
    [commitment.id, canSettle, canEarlyExit, handleSettle, handleEarlyExit],
  );
  useRegisterCommands(scopedCommands);

  return (
    <>
      <main
        id="main-content"
        className="min-h-screen bg-[#050505] text-[#f5f5f7] p-4 sm:p-8 lg:p-12"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <CommitmentDetailHeaderWithStatus
            commitmentId={commitment.id}
            commitmentType={commitment.type}
            statusOverride={commitmentStatusOverride ?? undefined}
          />

          <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]">
            <CommitmentDetailParameters
              durationLabel={durationLabel}
              maxLossLabel={maxLossLabel}
              commitmentTypeLabel={commitmentTypeLabel}
              earlyExitPenaltyLabel={earlyExitPenaltyLabel}
            />
          </div>

          <DisputeStatusTracker dispute={dispute} commitmentId={commitment.id} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
              <ErrorBoundary>
                <CommitmentHealthMetrics
                  commitmentId={routeParamId}
                  complianceData={MOCK_COMPLIANCE_DATA}
                  drawdownData={MOCK_DRAWDOWN_DATA}
                  valueHistoryData={MOCK_VALUE_HISTORY_DATA}
                  feeGenerationData={MOCK_FEE_GENERATION_DATA}
                  exposure={exposure}
                />
              </ErrorBoundary>

              <div ref={attestationsRef} id="attestations-section">
                <RecentAttestationsPanel
                  attestations={MOCK_ATTESTATIONS}
                  summary={MOCK_ATTESTATION_SUMMARY}
                  onSelectAttestation={(id) =>
                    emitPageTelemetry('attestation_selected', { attestationId: id })
                  }
                  onViewAll={() =>
                    emitPageTelemetry('view_all_attestations', { commitmentId: params.id })
                  }
                />
              </div>

              <CommitmentDetailAllocationConstraints
                constraints={[
                  { id: '1', text: 'Max 50% allocation to any single protocol' },
                  { id: '2', text: 'Only whitelisted DeFi protocols allowed' },
                  { id: '3', text: 'Minimum 20% must remain in stablecoins' },
                ]}
              />
            </div>

            <div className="lg:col-span-1 w-full space-y-8">
              <CommitmentDetailNftSection
                tokenId={MOCK_NFT_DATA.tokenId}
                ownerAddress={MOCK_NFT_DATA.ownerAddress}
                contractAddress={MOCK_NFT_DATA.contractAddress}
                mintDate={MOCK_NFT_DATA.mintDate}
                onCopyTokenId={() => handleCopy(MOCK_NFT_DATA.tokenId, 'Token ID')}
                onCopyOwner={() => handleCopy(MOCK_NFT_DATA.ownerAddress, 'Owner Address')}
                onCopyContract={() =>
                  handleCopy(MOCK_NFT_DATA.contractAddress, 'Contract Address')
                }
                onViewDetails={handleViewDetails}
                onViewOnExplorer={handleViewExplorer}
                onTransfer={handleTransfer}
              />

              <CommitmentDetailActionsUsingContext
                onEarlyExit={handleEarlyExit}
                onViewAttestations={handleViewAttestations}
                onExportData={handleExportData}
                onReportIssue={handleReportIssue}
                onSettle={handleSettle}
                commitmentId={commitment.id}
                earlyExitDisabledReason={earlyExitDisabledReason}
                canEarlyExit={canEarlyExit}
                settleDisabledReason={settleDisabledReason}
                reportIssueDisabledReason={reportIssueDisabledReason}
              />
            </div>
          </div>
        </div>

        <ExportCommitmentsModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          ownerAddress={MOCK_OWNER_ADDRESS}
        />

        {earlyExitModalOpen && (
          <CommitmentEarlyExitModal
            isOpen={earlyExitModalOpen}
            commitmentId={commitment.id}
            originalAmount="50,000 XLM"
            penaltyPercent={earlyExitPenaltyLabel}
            penaltyAmount="1,500 XLM"
            netReceiveAmount="48,500 XLM"
            hasAcknowledged={false}
            onChangeAcknowledged={() => {}}
            onCancel={() => setEarlyExitModalOpen(false)}
            onConfirm={handleConfirmEarlyExit}
          />
        )}

        <DisputeModal
          isOpen={disputeModalOpen}
          commitmentId={commitment.id}
          onClose={() => setDisputeModalOpen(false)}
          onSubmitted={handleDisputeSubmitted}
        />
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CommitmentDetailHeaderWithStatus({
  commitmentId,
  commitmentType,
  statusOverride,
}: {
  commitmentId: string;
  commitmentType: string;
  statusOverride?: string | undefined;
}) {
  const router = useRouter();
  const { status, isLoading } = useCommitmentStatus();
  const title = `${commitmentType} Commitment #${commitmentId}`;
  // A malformed/unrecognized status value must not silently read as
  // "Active" — that would misrepresent the commitment's real state.
  const rawStatus = isKnownStatusValue(status?.status) ? status?.status : undefined;
  const visibleStatus = statusOverride ?? rawStatus ?? (isLoading ? 'Loading' : 'Unknown');
  const { shareLink } = useShareLink({
    commitmentId,
    title,
    text: `${commitmentType} commitment details on Commitlabs.`,
  });

  const statusVariant = visibleStatus.toLowerCase().replace(/\s+/g, '_');

  return (
    <CommitmentDetailHeader
      commitmentId={title}
      statusLabel={visibleStatus}
      statusVariant={statusVariant}
      onBack={() => router.push('/commitments')}
      onShare={shareLink}
      explorerNetwork={getAppExplorerNetwork()}
    />
  );
}

function CommitmentDetailActionsUsingContext({
  onEarlyExit,
  onViewAttestations,
  onExportData,
  onReportIssue,
  onSettle,
  commitmentId,
  canEarlyExit,
  earlyExitDisabledReason,
  settleDisabledReason,
  reportIssueDisabledReason,
}: {
  onEarlyExit: () => void;
  onViewAttestations: () => void;
  onExportData: () => void;
  onReportIssue: () => void;
  onSettle?: (() => void) | undefined;
  commitmentId?: string | undefined;
}) {
  const { status } = useCommitmentStatus();
  const previewRefreshTrigger = status
    ? `${status.status}:${status.expiresAt ?? 'none'}`
    : 'loading';

  return (
    <CommitmentDetailActions
      canEarlyExit={canEarlyExit}
      onEarlyExit={onEarlyExit}
      onViewAttestations={onViewAttestations}
      onExportData={onExportData}
      onReportIssue={onReportIssue}
      {...(onSettle !== undefined ? { onSettle } : {})}
      {...(commitmentId !== undefined ? { commitmentId } : {})}
      previewRefreshTrigger={previewRefreshTrigger}
    />
  );
}
