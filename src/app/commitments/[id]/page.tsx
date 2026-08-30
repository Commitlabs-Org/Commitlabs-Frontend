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

// Mock dispute state — populated from /api/commitments/[id] status + history in production
const MOCK_DISPUTES: Record<string, DisputeInfo | null> = {
  '1': {
    stage: 'under_review',
    filedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reasonCategory: 'Compliance violation',
    reviewStartedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  '2': null,
};

// Mock data for health metrics
const MOCK_COMPLIANCE_DATA = [
  { date: 'Jan 1', complianceScore: 98 },
  { date: 'Jan 5', complianceScore: 97 },
  { date: 'Jan 10', complianceScore: 99 },
  { date: 'Jan 15', complianceScore: 95 },
  { date: 'Jan 20', complianceScore: 98 },
  { date: 'Jan 25', complianceScore: 100 },
  { date: 'Jan 30', complianceScore: 99 },
];

const MOCK_DRAWDOWN_DATA = [
  { date: 'Jan 10', drawdownPercent: 0 },
  { date: 'Jan 15', drawdownPercent: 0.35 },
  { date: 'Jan 20', drawdownPercent: 0.58 },
  { date: 'Jan 25', drawdownPercent: 0.52 },
  { date: 'Jan 28', drawdownPercent: 0.78 },
];

const MOCK_VALUE_HISTORY_DATA = [
  { date: 'Jan 10', currentValue: 50000, initialAmount: 50000 },
  { date: 'Jan 15', currentValue: 52000, initialAmount: 50000 },
  { date: 'Jan 20', currentValue: 51500, initialAmount: 50000 },
  { date: 'Jan 25', currentValue: 53000, initialAmount: 50000 },
  { date: 'Jan 28', currentValue: 54000, initialAmount: 50000 },
];

const MOCK_FEE_GENERATION_DATA = [
  { date: 'Jan 10', feeAmount: 25 },
  { date: 'Jan 15', feeAmount: 45 },
  { date: 'Jan 20', feeAmount: 78 },
  { date: 'Jan 25', feeAmount: 92 },
  { date: 'Jan 28', feeAmount: 125 },
];

const MOCK_ATTESTATIONS = [
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
];

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

// ─── Route parameter boundary ──────────────────────────────────────────────
//
// `params.id` comes straight from the URL and is untrusted. It's used as a
// lookup key, echoed into share links/explorer URLs, and passed to child
// components — validate its shape before any of that happens rather than
// implicitly trusting whatever the route segment contained.
export const COMMITMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidCommitmentId(id: unknown): id is string {
  return typeof id === 'string' && COMMITMENT_ID_PATTERN.test(id);
}

// ─── Ownership / authorization boundary ────────────────────────────────────
//
// Fund/dispute/early-exit/settle actions must only be available when the
// *connected wallet* matches the commitment's owner — this must never be
// inferred from client-only state (e.g. "the button is visible so the user
// must be allowed"). `useWallet` reports whether Freighter is connected, the
// active address, and whether the wallet is on the expected network; all
// three are checked here before an action is considered authorized.
export type OwnershipState =
  | { kind: 'wallet_disconnected' }
  | { kind: 'wrong_network'; reason: string }
  | { kind: 'not_owner' }
  | { kind: 'authorized' };

export function deriveOwnership(
  wallet: Pick<ReturnType<typeof useWallet>, 'connected' | 'address' | 'error'>,
  ownerAddress: string,
): OwnershipState {
  if (!wallet.connected || !wallet.address) {
    return { kind: 'wallet_disconnected' };
  }
  if (wallet.error) {
    // useWallet already normalizes wrong-network / locked-wallet errors
    // into a human-readable message; surface it as-is rather than
    // re-deriving network state independently.
    return { kind: 'wrong_network', reason: wallet.error };
  }
  if (wallet.address !== ownerAddress) {
    return { kind: 'not_owner' };
  }
  return { kind: 'authorized' };
}

export function ownershipDisabledReason(ownership: OwnershipState): string | undefined {
  switch (ownership.kind) {
    case 'wallet_disconnected':
      return 'Connect your wallet to manage this commitment.';
    case 'wrong_network':
      return ownership.reason;
    case 'not_owner':
      return 'Only the commitment owner can perform this action.';
    case 'authorized':
      return undefined;
  }
}

export function isAuthorized(ownership: OwnershipState): boolean {
  return ownership.kind === 'authorized';
}

// ─── Defensive status parsing ──────────────────────────────────────────────
//
// `useCommitmentStatus()` can be loading, absent, or (in principle) return a
// malformed/unexpected shape from its backing fetch. Treat its value as
// untrusted rather than assuming `status.status`/`status.daysRemaining` are
// always well-formed — an empty or unrecognized status string must not
// silently read as "eligible" or default to displaying "Active".
const KNOWN_COMMITMENT_STATUSES = new Set([
  'active',
  'settled',
  'violated',
  'early_exit',
  'disputed',
]);

export function isKnownStatusValue(value: unknown): value is string {
  return typeof value === 'string' && KNOWN_COMMITMENT_STATUSES.has(value.toLowerCase());
}

export function isEligibleForEarlyExit(status: unknown): boolean {
  if (!status || typeof status !== 'object') return false;
  const s = status as { status?: unknown; daysRemaining?: unknown };
  if (!isKnownStatusValue(s.status)) return false;
  if (typeof s.daysRemaining !== 'number' || !Number.isFinite(s.daysRemaining)) return false;
  return (s.status as string).toLowerCase() === 'active' && s.daysRemaining > 0;
}

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
    // Re-check authorization at submit time, not just at the moment the
    // modal was opened — the wallet could have disconnected or switched
    // accounts while the modal was open.
    if (!authorized) {
      showError({
        title: 'Not authorized',
        description: ownershipDisabledReason(ownership) ?? 'You are not authorized to do this.',
      });
      setDisputeModalOpen(false);
      return;
    }
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      setDispute({
        stage: 'under_review',
        filedAt: new Date().toISOString(),
        reasonCategory: 'Pending review',
        reviewStartedAt: new Date().toISOString(),
      });
      setCommitmentStatusOverride('Disputed');
      setDisputeModalOpen(false);
    } finally {
      actionInFlightRef.current = false;
    }
  }, [authorized, ownership, showError]);

  const handleEarlyExit = useCallback(() => {
    if (!canEarlyExit) {
      showError({
        title: 'Unable to start early exit',
        description:
          earlyExitDisabledReason ?? 'Early exit is not currently available for this commitment.',
      });
      return;
    }
    setEarlyExitModalOpen(true);
  }, [canEarlyExit, earlyExitDisabledReason, showError]);

  const handleConfirmEarlyExit = useCallback(() => {
    // Re-validate ownership and status eligibility right before the action
    // actually fires, since time has passed since the modal opened (the
    // status shown in `status` may have changed, e.g. maturity reached, or
    // the wallet may have disconnected/switched accounts).
    const freshOwnership = deriveOwnership(wallet, commitment.ownerAddress);
    const stillEligible = isAuthorized(freshOwnership) && isEligibleForEarlyExit(status);

    if (!stillEligible) {
      showError({
        title: 'Unable to complete early exit',
        description:
          ownershipDisabledReason(freshOwnership) ??
          'This commitment is no longer eligible for early exit.',
      });
      setEarlyExitModalOpen(false);
      return;
    }
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      setEarlyExitModalOpen(false);
    } finally {
      actionInFlightRef.current = false;
    }
  }, [wallet, commitment.ownerAddress, status, showError]);

  const handleSettle = useCallback(() => {
    if (!canSettle) {
      showError({
        title: 'Unable to settle',
        description: settleDisabledReason ?? 'Settlement is not currently available.',
      });
      return;
    }
    showSuccess({ title: 'Coming Soon', description: 'Settlement is not yet available.' });
  }, [canSettle, settleDisabledReason, showSuccess, showError]);

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

          <DisputeStatusTracker dispute={dispute} />

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
                  onSelectAttestation={(id) => console.log('Selected attestation:', id)}
                  onViewAll={() => console.log('View all attestations')}
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
                onCopyContract={() => handleCopy(MOCK_NFT_DATA.contractAddress, 'Contract Address')}
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

function CommitmentDetailHeaderWithStatus({
  commitmentId,
  commitmentType,
  statusOverride,
}: {
  commitmentId: string;
  commitmentType: string;
  statusOverride?: string;
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
  onSettle?: () => void;
  commitmentId?: string;
  canEarlyExit: boolean;
  earlyExitDisabledReason?: string;
  settleDisabledReason?: string;
  reportIssueDisabledReason?: string;
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
      onSettle={onSettle}
      commitmentId={commitmentId}
      earlyExitDisabledReason={earlyExitDisabledReason}
      settleDisabledReason={settleDisabledReason}
      reportIssueDisabledReason={reportIssueDisabledReason}
      previewRefreshTrigger={previewRefreshTrigger}
    />
  );
}
