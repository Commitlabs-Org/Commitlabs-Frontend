'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateCommitmentStepSelectType from '@/components/CreateCommitmentStepSelectType';
import CreateCommitmentStepConfigure from '@/components/CreateCommitmentStepConfigure';
import CreateCommitmentStepReview from '@/components/CreateCommitmentStepReview';
import CommitmentCreatedModal from '@/components/modals/CommitmentCreatedModal';
import {
  buildExplorerUrl,
  openExplorerUrl,
  getExplorerNetworkFromPassphrase,
} from '@/utils/explorerLinks';
import { useWallet } from '@/hooks/useWallet';
import { AppShellLayout } from '@/components/shell/AppShellLayout';
import { useDraftPersistence, type DraftState } from '@/hooks/useDraftPersistence';
import ResumeDraftPrompt from '@/components/create/ResumeDraftPrompt';
import { useGuidedTour } from '@/hooks/useGuidedTour';
import { GuidedTour } from '@/components/onboarding/GuidedTour';
import { HelpCircle } from 'lucide-react';
import { usePrefillFromCommitment } from '@/hooks/usePrefillFromCommitment';
import { type CommitmentPreset } from '@/components/create/commitmentPresets';
import { checkWalletBoundary } from '@/lib/validation/walletBoundary';
import { parseAmountStrict, AssetSchema } from '@/lib/validation/createCommitment';
import { z } from 'zod';

type CommitmentType = 'safe' | 'balanced' | 'aggressive';

const SUPPORTED_ASSETS = new Set(['XLM', 'USDC']);

function generateIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `create-${Date.now()}-${rand}`;
}

function getExpectedNetwork(): string | null {
  if (typeof process !== 'undefined') {
    const v = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    if (v?.trim()) return v.trim();
  }
  return null;
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

export default function CreateCommitment() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address: ownerAddress, connected, walletNetwork, authenticated, connect } = useWallet();
  const { drafts, allDrafts, saveDraft, clearDraft, clearAllDrafts } = useDraftPersistence();
  const prefill = usePrefillFromCommitment();
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [step, setStep] = useState(1);
  const [initialFocusField, setInitialFocusField] = useState<string | null>(null);
  const walletAddress = ownerAddress;

  const {
    isActive: tourActive,
    currentStepIndex,
    currentStepConfig,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    startTour,
  } = useGuidedTour({
    activeWizardStep: step as 1 | 2 | 3,
    setWizardStep: (s) => setStep(s),
    walletAddress,
    onSelectDefaultType: () => {
      if (!selectedType) {
        handleSelectType('balanced');
      }
    },
  });
  const [selectedType, setSelectedType] = useState<CommitmentType | null>(null);
  const [commitmentType, setCommitmentType] = useState<CommitmentType>('balanced');
  const [amount, setAmount] = useState<string>('');
  const [asset, setAsset] = useState<string>('XLM');
  const [durationDays, setDurationDays] = useState<number>(90);
  const [maxLossPercent, setMaxLossPercent] = useState<number>(100);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [commitmentId, setCommitmentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Filter drafts visible to current wallet: show only drafts that match current address or have no bound address (legacy)
  const visibleDrafts = useMemo(() => {
    if (!allDrafts.length) return [];
    // If wallet connected, filter to own drafts; if not connected, show all but Resume will be gated
    if (!ownerAddress) return allDrafts;
    return allDrafts.filter((d) => {
      const bound = (d.data as DraftState & { walletAddress?: string }).walletAddress;
      if (!bound) return true; // legacy draft - allow but will be rebound on resume
      return bound === ownerAddress;
    });
  }, [allDrafts, ownerAddress]);

  const explorerNetwork = useMemo(() => {
    return getExplorerNetworkFromPassphrase(walletNetwork ?? getExpectedNetwork());
  }, [walletNetwork]);

  const isWrongNetwork = useMemo(() => {
    const expected = getExpectedNetwork();
    return !!(expected && walletNetwork && walletNetwork !== expected);
  }, [walletNetwork]);

  useEffect(() => {
    if (visibleDrafts.length > 0 && !prefill) {
      setShowResumePrompt(true);
    }
  }, [visibleDrafts.length, prefill]);

  // When a source commitment is loaded via ?sourceId=, prefill the wizard fields
  // and skip straight to step 2 so the user can review / adjust the copied parameters.
  // Identity-bound fields (id, ownership, on-chain state) are NOT copied — only
  // configurable parameters that the user is free to edit.
  useEffect(() => {
    if (!prefill) return;
    setSelectedType(prefill.commitmentType);
    setCommitmentType(prefill.commitmentType);
    setAmount(prefill.amount);
    setAsset(prefill.asset);
    setDurationDays(prefill.durationDays);
    setMaxLossPercent(prefill.maxLossPercent);
    // Skip type-selection step — type is already chosen from the source.
    setStep(2);
    setShowResumePrompt(false);
  }, [prefill]);

  useEffect(() => {
    const params = searchParams;
    if (params?.get('startTour') === 'true') {
      startTour();
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [searchParams, startTour]);

  const handleResumeDraft = useCallback(
    (draftId: string) => {
      const found = drafts[draftId];
      if (!found) return;
      // Re-validate draft invariants before resuming (tampering, boundary)
      const d = found.data;
      if (d.step < 1 || d.step > 3) {
        setFieldError('Draft is corrupted — invalid step. Starting fresh.');
        clearDraft(draftId);
        return;
      }
      if (d.durationDays < 1 || d.durationDays > 365) {
        setFieldError('Draft is corrupted — invalid duration. Discarded.');
        clearDraft(draftId);
        return;
      }
      if (d.maxLossPercent < 0 || d.maxLossPercent > 100) {
        setFieldError('Draft is corrupted — invalid max loss. Discarded.');
        clearDraft(draftId);
        return;
      }
      if (d.asset && !SUPPORTED_ASSETS.has(d.asset)) {
        setFieldError('Draft is corrupted — unsupported asset. Discarded.');
        clearDraft(draftId);
        return;
      }
      if (d.amount && parseAmountStrict(d.amount) === null && d.amount !== '') {
        setFieldError('Draft is corrupted — invalid amount. Discarded.');
        clearDraft(draftId);
        return;
      }
      // Ownership check: draft bound to different wallet -> block
      const bound = (d as DraftState & { walletAddress?: string }).walletAddress;
      if (bound && ownerAddress && bound !== ownerAddress) {
        setFieldError(
          'Draft belongs to a different wallet. Connect with the original wallet or start fresh.',
        );
        return;
      }
      setStep(d.step);
      setSelectedType(d.selectedType);
      setCommitmentType(d.commitmentType);
      setAmount(d.amount);
      setAsset(d.asset);
      setDurationDays(d.durationDays);
      setMaxLossPercent(d.maxLossPercent);
      setShowResumePrompt(false);
      setFieldError(null);
    },
    [drafts, ownerAddress],
  );

  const handleStartFresh = () => {
    clearAllDrafts();
    setShowResumePrompt(false);
    setFieldError(null);
  };

  const handleDeleteDraft = (draftId: string) => {
    clearDraft(draftId);
    if (visibleDrafts.length <= 1) setShowResumePrompt(false);
  };

  useEffect(() => {
    // Save draft with wallet binding for ownership check
    const currentDraft: DraftState = {
      step,
      selectedType,
      commitmentType,
      amount,
      asset,
      durationDays,
      maxLossPercent,
      ...(ownerAddress ? { walletAddress: ownerAddress } : {}),
      ...(walletNetwork || getExpectedNetwork()
        ? { networkPassphrase: (walletNetwork ?? getExpectedNetwork()) as string }
        : {}),
      version: 1,
    };
    // Validate before saving (reuse schema strictness)
    const schema = z.object({
      step: z.number().int().min(1).max(3),
      durationDays: z.number().int().min(1).max(365),
      maxLossPercent: z.number().min(0).max(100),
      asset: z.string().min(1),
      amount: z.string(),
    });
    if (!schema.safeParse(currentDraft).success) return;
    if (amount && amount !== '' && parseAmountStrict(amount) === null) return;
    if (!SUPPORTED_ASSETS.has(asset)) return;
    saveDraft(currentDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    selectedType,
    commitmentType,
    amount,
    asset,
    durationDays,
    maxLossPercent,
    saveDraft,
    ownerAddress,
    walletNetwork,
  ]);

  // Build review data from actual configured values
  const getReviewData = () => {
    const typeLabelMap: Record<string, string> = {
      safe: 'Safe Commitment',
      balanced: 'Balanced Commitment',
      aggressive: 'Aggressive Commitment',
    };
    const yieldMap: Record<string, string> = {
      safe: '5.2% APY',
      balanced: '12.5% APY',
      aggressive: '45.0% APY',
    };
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + durationDays);
    return {
      typeLabel: typeLabelMap[selectedType ?? 'balanced'] ?? 'Commitment',
      amount: amount || '0',
      asset,
      durationDays,
      maxLossPercent,
      earlyExitPenalty,
      estimatedFees,
      estimatedYield: yieldMap[selectedType ?? 'balanced'] ?? '—',
      commitmentStart: 'Immediately',
      commitmentEnd: end.toLocaleDateString(),
    };
  };

  // Mock available balance - in real app, this would come from wallet/API
  const availableBalance = 10000;

  // Derived values
  const earlyExitPenalty = useMemo(() => {
    const penalty = commitmentType === 'aggressive' ? 5 : commitmentType === 'balanced' ? 3 : 2;
    const parsed = parseAmountStrict(amount);
    const base = parsed ?? 0;
    return `${(base * penalty) / 100} ${asset}`;
  }, [amount, asset, commitmentType]);

  const estimatedFees = useMemo(() => `0.00 ${asset}`, [asset]);

  const amountError = useMemo(() => {
    if (!amount) return undefined;
    const parsed = parseAmountStrict(amount);
    if (parsed === null) return 'Invalid amount format';
    if (parsed <= 0) return 'Amount must be greater than 0';
    if (parsed > availableBalance) return 'Amount exceeds available balance';
    return undefined;
  }, [amount, availableBalance]);

  const isStep2Valid = useMemo(() => {
    const parsed = parseAmountStrict(amount);
    if (parsed === null) return false;
    if (AssetSchema.safeParse(asset).success === false) return false;
    return (
      parsed > 0 &&
      parsed <= availableBalance &&
      Number.isInteger(durationDays) &&
      durationDays >= 1 &&
      durationDays <= 365 &&
      maxLossPercent >= 0 &&
      maxLossPercent <= 100
    );
  }, [amount, availableBalance, durationDays, maxLossPercent, asset]);

  const maxLossWarning = maxLossPercent > 80;

  // Step Handlers
  const handleSelectType = (type: CommitmentType) => {
    setSelectedType(type);
    setCommitmentType(type);
  };

  const handleApplyPreset = (preset: CommitmentPreset) => {
    setSelectedType(preset.type);
    setCommitmentType(preset.type);
    setDurationDays(preset.durationDays);
    setMaxLossPercent(preset.maxLossPercent);
  };

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  // Navigation handlers
  // Note: These control the wizard step flow
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.push('/');
    }
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    // Authorization & validation boundary
    if (!connected || !ownerAddress) {
      setSubmitError('Wallet is not connected. Please connect your wallet to continue.');
      return;
    }
    if (isWrongNetwork) {
      setSubmitError(
        'Your wallet is connected to the wrong network. Switch network and try again.',
      );
      return;
    }
    const gate = checkWalletBoundary({
      connected: !!connected,
      address: ownerAddress,
      authenticated: !!authenticated,
      walletNetwork: walletNetwork ?? null,
      expectedNetwork: getExpectedNetwork(),
    });
    if (!gate.ok) {
      setSubmitError(gate.message ?? 'Authorization failed.');
      return;
    }

    const parsedAmount = parseAmountStrict(amount);
    if (parsedAmount === null) {
      setSubmitError('Invalid amount format.');
      return;
    }
    if (!SUPPORTED_ASSETS.has(asset)) {
      setSubmitError('Unsupported asset. Supported: XLM, USDC.');
      return;
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
      setSubmitError('Duration must be between 1 and 365 days.');
      return;
    }
    if (maxLossPercent < 0 || maxLossPercent > 100) {
      setSubmitError('Max loss must be between 0 and 100.');
      return;
    }
    if (!selectedType) {
      setSubmitError('Commitment type is required.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = generateIdempotencyKey();
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      // If bearer token available via localStorage/session, send it for auth (defense-in-depth)
      let bearer: string | null = null;
      try {
        bearer =
          localStorage.getItem('commitlabs.sessionToken') ??
          sessionStorage.getItem('commitlabs.sessionToken');
      } catch {}
      if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

      const res = await fetch('/api/commitments', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ownerAddress,
          asset,
          amount,
          durationDays,
          maxLossBps: Math.round(maxLossPercent * 100),
        }),
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        throw new Error('Malformed server response');
      }

      if (!res.ok) {
        const errMsg =
          (json as { error?: { message?: string }; message?: string })?.error?.message ??
          (json as { message?: string })?.message ??
          `Request failed with ${res.status}`;
        // 401/403/409/429 are handled as submit errors with retry
        if (res.status === 409) {
          throw new Error(
            'A commitment creation is already in progress. Please wait and try again.',
          );
        }
        if (res.status === 429) {
          throw new Error('Too many requests. Please try again later.');
        }
        throw new Error(errMsg);
      }

      // Validate response shape
      const data = (json as { data?: { commitmentId?: string; id?: string } })?.data ?? json;
      const candidateId =
        (data as { commitmentId?: string })?.commitmentId ?? (data as { id?: string })?.id ?? '';
      const commitmentIdStr = String(candidateId || '').trim();
      if (!commitmentIdStr) {
        throw new Error('Malformed server response: missing commitmentId');
      }
      // Accept either CMT- pattern or generic id, but validate non-empty and safe
      if (commitmentIdStr.length > 128 || /[<>]/.test(commitmentIdStr)) {
        throw new Error('Malformed server response: invalid commitmentId');
      }

      setCommitmentId(commitmentIdStr);
      if (typeof window !== 'undefined') {
        localStorage.setItem('commitlabs:created-commitment', 'true');
      }
      setShowSuccessModal(true);
      // Clear drafts only on success to avoid data loss on failure
      clearAllDrafts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create commitment. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    connected,
    ownerAddress,
    isWrongNetwork,
    authenticated,
    walletNetwork,
    amount,
    asset,
    durationDays,
    maxLossPercent,
    selectedType,
    clearAllDrafts,
  ]);

  const handleViewCommitment = () => {
    router.push(`/commitments/${encodeURIComponent(commitmentId)}`);
  };

  const handleCreateAnother = () => {
    setShowSuccessModal(false);
    setSelectedType(null);
    setStep(1);
    setCommitmentId('');
    setCommitmentType('balanced');
    setAmount('');
    setAsset('XLM');
    setDurationDays(90);
    setMaxLossPercent(100);
    setSubmitError(null);
    clearAllDrafts();
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    router.push('/commitments');
  };

  // Fund-later: close the success modal and go to the detail page so the
  // user can fund the escrow from there at any time.
  const handleFundLater = () => {
    setShowSuccessModal(false);
    router.push(`/commitments/${encodeURIComponent(commitmentId || '1')}`);
  };

  const handleViewOnExplorer = () => {
    openExplorerUrl('tx', commitmentId, explorerNetwork);
  };

  const commitmentExplorerUrl = buildExplorerUrl('tx', commitmentId, explorerNetwork);

  const handleEditStep = (targetStep: 1 | 2, fieldId?: string) => {
    if (fieldId) {
      setInitialFocusField(fieldId);
    } else {
      setInitialFocusField(null);
    }
    setStep(targetStep);
  };

  return (
    <AppShellLayout>
      <main id="main-content" className="flex flex-col flex-1 relative">
        {/* Authorization banners */}
        {!connected && (
          <div
            role="alert"
            data-testid="wallet-disconnected-banner"
            className="mx-auto mb-4 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-800"
          >
            Wallet not connected — connect your wallet to create a commitment.
            <button
              type="button"
              onClick={() => connect()}
              className="ml-3 underline font-semibold"
              data-testid="banner-connect-wallet"
            >
              Connect
            </button>
          </div>
        )}
        {isWrongNetwork && (
          <div
            role="alert"
            data-testid="wrong-network-banner"
            className="mx-auto mb-4 max-w-2xl rounded-xl border border-red-300 bg-red-50 px-5 py-3 text-sm text-red-700"
          >
            Wrong network — switch your wallet to the correct network and try again.
          </div>
        )}
        {fieldError && (
          <div
            role="alert"
            data-testid="field-error-banner"
            className="mx-auto mb-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
          >
            {fieldError}
          </div>
        )}
        {submitError && (
          <div
            role="alert"
            data-testid="submit-error-banner"
            className="mx-auto mb-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
          >
            {submitError}
          </div>
        )}
        {/* Duplicate-mode banner: shown when the wizard was opened from an existing commitment */}
        {prefill && (
          <div
            role="status"
            aria-live="polite"
            data-testid="duplicate-prefill-banner"
            className="mx-auto mb-4 max-w-2xl rounded-xl border border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.05)] px-5 py-3 text-sm text-[#0ff0fc]"
          >
            Duplicating from an existing commitment — all fields are pre-filled and fully editable.
          </div>
        )}

        {showResumePrompt && visibleDrafts.length > 0 && (
          <ResumeDraftPrompt
            drafts={visibleDrafts}
            onResume={handleResumeDraft}
            onStartFresh={handleStartFresh}
            onDeleteDraft={handleDeleteDraft}
          />
        )}

        {!showResumePrompt && step === 1 && (
          <CreateCommitmentStepSelectType
            selectedType={selectedType}
            onSelectType={handleSelectType}
            onNext={handleNextStep}
            onBack={handleBack}
            onApplyPreset={handleApplyPreset}
            {...(initialFocusField ? { initialFocusField } : {})}
          />
        )}

        {!showResumePrompt && step === 2 && (
          <CreateCommitmentStepConfigure
            amount={amount}
            asset={asset}
            availableBalance={availableBalance}
            durationDays={durationDays}
            maxLossPercent={maxLossPercent}
            earlyExitPenalty={earlyExitPenalty}
            estimatedFees={estimatedFees}
            isValid={isStep2Valid}
            ownerAddress={ownerAddress}
            commitmentType={commitmentType}
            onChangeAmount={setAmount}
            onChangeAsset={setAsset}
            onChangeDuration={setDurationDays}
            onChangeMaxLoss={setMaxLossPercent}
            onBack={handleBack}
            onNext={handleNextStep}
            amountError={amountError}
            maxLossWarning={maxLossWarning}
            {...(initialFocusField ? { initialFocusField } : {})}
          />
        )}

        {!showResumePrompt && step === 3 && selectedType && (
          <>
            <CreateCommitmentStepReview
              {...getReviewData()}
              isSubmitting={isSubmitting}
              onBack={handleBack}
              onSubmit={handleSubmit}
              onEditStep={handleEditStep}
            />

            <CommitmentCreatedModal
              isOpen={showSuccessModal}
              commitmentId={commitmentId}
              {...(ownerAddress ? { callerAddress: ownerAddress } : {})}
              onViewCommitment={handleViewCommitment}
              onCreateAnother={handleCreateAnother}
              onClose={handleCloseModal}
              onFundLater={handleFundLater}
              {...(commitmentExplorerUrl ? { onViewOnExplorer: handleViewOnExplorer } : {})}
            />
          </>
        )}

        {/* Help button to re-launch tour */}
        <button
          type="button"
          onClick={startTour}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-[rgba(0,212,255,0.4)] bg-[rgba(10,10,11,0.9)] px-4 py-2.5 text-sm font-semibold text-[#0ff0fc] shadow-[0_0_15px_rgba(0,212,255,0.2)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(0,212,255,0.8)] hover:shadow-[0_0_20px_rgba(0,212,255,0.5)] focus:outline-none focus:ring-2 focus:ring-[#0ff0fc]"
          aria-label="Start guided tour"
          title="Start guided tour"
          data-testid="tour-help-button"
        >
          <HelpCircle size={18} />
          <span>Tour Guide</span>
        </button>

        {/* Guided Tour Tooltip Controller */}
        <GuidedTour
          isActive={tourActive}
          currentStepIndex={currentStepIndex}
          currentStepConfig={currentStepConfig}
          totalSteps={totalSteps}
          onNext={nextStep}
          onBack={prevStep}
          onSkip={skipTour}
        />
      </main>
    </AppShellLayout>
  );
}
