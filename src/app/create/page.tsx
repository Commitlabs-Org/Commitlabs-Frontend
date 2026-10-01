'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CreateCommitmentStepSelectType from '@/components/CreateCommitmentStepSelectType';
import CreateCommitmentStepConfigure from '@/components/CreateCommitmentStepConfigure';
import CreateCommitmentStepReview from '@/components/CreateCommitmentStepReview';
import CommitmentCreatedModal from '@/components/modals/CommitmentCreatedModal';
import { buildExplorerUrl, openExplorerUrl } from '@/utils/explorerLinks';
import { useWallet } from '@/hooks/useWallet';
import { AppShellLayout } from '@/components/shell/AppShellLayout';
import { useDraftPersistence, type DraftState } from '@/hooks/useDraftPersistence';
import ResumeDraftPrompt from '@/components/create/ResumeDraftPrompt';
import { useGuidedTour } from '@/hooks/useGuidedTour';
import { GuidedTour } from '@/components/onboarding/GuidedTour';
import { HelpCircle } from 'lucide-react';
import { usePrefillFromCommitment } from '@/hooks/usePrefillFromCommitment';
import { type CommitmentPreset } from '@/components/create/commitmentPresets';

type CommitmentType = 'safe' | 'balanced' | 'aggressive';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

// Submission state machine invariants:
// - idle is the resting state; submitting may only be entered from idle or error.
// - success is terminal, clears the draft and prevents duplicate submissions.
// - error is recoverable, preserves the draft, and allows retry from the same state.
// - Any cancellation (back navigation) invalidates in-flight responses by incrementing the epoch.
const SUBMIT_TRANSITIONS: Record<SubmitStatus, ReadonlyArray<SubmitStatus>> = {
  idle: ['submitting', 'error'],
  submitting: ['success', 'error', 'idle'],
  success: ['idle'],
  error: ['submitting', 'idle'],
};

function canTransitionSubmitStatus(from: SubmitStatus, to: SubmitStatus): boolean {
  return SUBMIT_TRANSITIONS[from]?.includes(to) ?? false;
}

const VALIDATION = {
  DURATION_MIN: 1,
  DURATION_MAX: 365,
  MAX_LOSS_MIN: 0,
  MAX_LOSS_MAX: 100,
} as const;

// Generate a random commitment ID (in production, this comes from the blockchain)
function generateCommitmentId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'CMT-';
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default function CreateCommitment() {
  const router = useRouter();
  const { address: ownerAddress } = useWallet();
  const { draft, saveDraft, clearDraft } = useDraftPersistence();
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
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitStatusRef = useRef<SubmitStatus>('idle');
  const submissionEpoch = useRef(0);
  const suppressDraftSave = useRef(false);
  const isMounted = useRef(true);
  const wasSubmittingRef = useRef(false);

  // In production this would come from the connected wallet hook.
  // Passed as undefined while wallet integration is pending; the fund
  // API accepts an optional callerAddress and validates it on-chain.
  const callerAddress: string | undefined = undefined;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      submissionEpoch.current += 1;
    };
  }, []);

  const updateSubmitStatus = (next: SubmitStatus): boolean => {
    if (!canTransitionSubmitStatus(submitStatusRef.current, next)) return false;
    submitStatusRef.current = next;
    setSubmitStatus(next);
    return true;
  };

  useEffect(() => {
    if (submitStatus === 'error' && isSubmitting) {
      setIsSubmitting(false);
    }
    if (wasSubmittingRef.current && submitStatus === 'error') {
      suppressDraftSave.current = false;
    }
    wasSubmittingRef.current = isSubmitting && submitStatus === 'submitting';
  }, [isSubmitting, submitStatus]);

  useEffect(() => {
    if (draft) {
      suppressDraftSave.current = true;
      setShowResumePrompt(true);
    }
  }, [draft]);

  // When a source commitment is loaded via ?sourceId=, prefill the wizard fields
  // and skip straight to step 2 so the user can review / adjust the copied parameters.
  // Identity-bound fields (id, ownership, on-chain state) are NOT copied — only
  // configurable parameters that the user is free to edit.
  useEffect(() => {
    if (!prefill) return;
    suppressDraftSave.current = false;
    updateSubmitStatus('idle');
    setSubmitError(null);
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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('startTour') === 'true') {
        startTour();
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [startTour]);

  const handleResumeDraft = () => {
    if (draft) {
      suppressDraftSave.current = false;
      updateSubmitStatus('idle');
      setSubmitError(null);
      setStep(draft.step);
      setSelectedType(draft.selectedType);
      setCommitmentType(draft.commitmentType);
      setAmount(draft.amount);
      setAsset(draft.asset);
      setDurationDays(draft.durationDays);
      setMaxLossPercent(draft.maxLossPercent);
      setShowResumePrompt(false);
    }
  };

  const handleStartFresh = () => {
    suppressDraftSave.current = false;
    updateSubmitStatus('idle');
    setSubmitError(null);
    clearDraft();
    setShowResumePrompt(false);
    setSelectedType(null);
    setCommitmentType('balanced');
    setAmount('');
    setAsset('XLM');
    setDurationDays(90);
    setMaxLossPercent(100);
    setStep(1);
  };

  useEffect(() => {
    if (suppressDraftSave.current || showSuccessModal || isSubmitting) {
      return;
    }
    if (step === 1 && !selectedType) {
      return;
    }
    const currentDraft: DraftState = {
      step,
      selectedType,
      commitmentType,
      amount,
      asset,
      durationDays,
      maxLossPercent,
    };
    saveDraft(currentDraft);
  }, [step, selectedType, commitmentType, amount, asset, durationDays, maxLossPercent, saveDraft, showSuccessModal, isSubmitting]);

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
    return `${((Number(amount) || 0) * penalty) / 100} ${asset}`;
  }, [amount, asset, commitmentType]);

  const estimatedFees = useMemo(() => `0.00 ${asset}`, [asset]);

  const amountError = useMemo(() => {
    const numAmount = Number(amount);
    if (amount && numAmount <= 0) return 'Amount must be greater than 0';
    if (numAmount > availableBalance) return 'Amount exceeds available balance';
    return undefined;
  }, [amount, availableBalance]);

  const isStep2Valid = useMemo(() => {
    const numAmount = Number(amount);
    return (
      numAmount > 0 &&
      numAmount <= availableBalance &&
      Number.isInteger(durationDays) &&
      durationDays >= VALIDATION.DURATION_MIN &&
      durationDays <= VALIDATION.DURATION_MAX &&
      Number.isInteger(maxLossPercent) &&
      maxLossPercent >= VALIDATION.MAX_LOSS_MIN &&
      maxLossPercent <= VALIDATION.MAX_LOSS_MAX
    );
  }, [amount, availableBalance, durationDays, maxLossPercent]);

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
    if (isSubmitting) return;
    if (step === 1 && !selectedType) return;
    if (step === 2 && !isStep2Valid) return;
    if (step < 3) {
      setStep(step + 1);
    }
  };

  // Navigation handlers
  // Note: These control the wizard step flow
  const handleBack = () => {
    if (submitStatusRef.current === 'submitting' || isSubmitting) {
      // Cancel any in-flight submission to avoid stale completion.
      submissionEpoch.current += 1;
      setIsSubmitting(false);
      suppressDraftSave.current = false;
    }
    setSubmitError(null);
    updateSubmitStatus('idle');
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.push('/');
    }
  };

  const handleSubmit = () => {
    if (isSubmitting || showSuccessModal || submitStatusRef.current === 'submitting' || submitStatusRef.current === 'success') {
      return;
    }
    if (showResumePrompt) {
      setSubmitError('Resume or discard your existing draft before creating a new commitment.');
      updateSubmitStatus('error');
      return;
    }
    if (!selectedType) {
      setSubmitError('Select a commitment type before submitting.');
      updateSubmitStatus('error');
      return;
    }
    if (!isStep2Valid) {
      setSubmitError('Review the configuration and fix invalid fields before submitting.');
      updateSubmitStatus('error');
      return;
    }
    if (!walletAddress) {
      setSubmitError('Connect your wallet to create a commitment.');
      updateSubmitStatus('error');
      return;
    }
    setSubmitError(null);
    if (!updateSubmitStatus('submitting')) return;
    suppressDraftSave.current = true;
    submissionEpoch.current += 1;
    const currentEpoch = submissionEpoch.current;
    setIsSubmitting(true);

    new Promise<string>((resolve) => {
      setTimeout(() => {
        // Simulated on-chain submission. Replace with real contract interaction.
        // If the wallet rejects the transaction, reject with an error.
        resolve(generateCommitmentId());
      }, 2000);
    })
      .then((newCommitmentId) => {
        if (!isMounted.current || submissionEpoch.current !== currentEpoch) return;
        setIsSubmitting(false);
        setCommitmentId(newCommitmentId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('commitlabs:created-commitment', 'true');
        }
        updateSubmitStatus('success');
        setShowSuccessModal(true);
        suppressDraftSave.current = false;
        clearDraft();
      })
      .catch((error: Error) => {
        if (!isMounted.current || submissionEpoch.current !== currentEpoch) return;
        setIsSubmitting(false);
        setSubmitError(error.message);
        updateSubmitStatus('error');
        suppressDraftSave.current = false;
      });
  };

  const handleViewCommitment = () => {
    const numericId = commitmentId.split('-')[1] || '1';
    router.push(`/commitments/${numericId}`);
  };

  const handleCreateAnother = () => {
    suppressDraftSave.current = false;
    setSubmitError(null);
    updateSubmitStatus('idle');
    setShowSuccessModal(false);
    setSelectedType(null);
    setStep(1);
    setCommitmentId('');
    setCommitmentType('balanced');
    setAmount('');
    setAsset('XLM');
    setDurationDays(90);
    setMaxLossPercent(100);
    clearDraft();
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    router.push('/commitments');
  };

  // Fund-later: close the success modal and go to the detail page so the
  // user can fund the escrow from there at any time.
  const handleFundLater = () => {
    setShowSuccessModal(false);
    const numericId = commitmentId.split('-')[1] || '1';
    router.push(`/commitments/${numericId}`);
  };entId.split('-')[1] || '1';
    router.push(`/commitments/${numericId}`);
  };

  const handleViewOnExplorer = () => {
    openExplorerUrl('tx', commitmentId, 'testnet');
  };

  const commitmentExplorerUrl = buildExplorerUrl('tx', commitmentId, 'testnet');

  const handleEditStep = (targetStep: 1 | 2, fieldId?: string) => {
    if (isSubmitting) return;
    setSubmitError(null);
    updateSubmitStatus('idle');
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

        {showResumePrompt && draft && (
          <ResumeDraftPrompt
            draft={draft}
            onResume={handleResumeDraft}
            onStartFresh={handleStartFresh}
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
            {submitError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {submitError}
              </div>
            )}
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
              {...(callerAddress ? { callerAddress } : {})}
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
