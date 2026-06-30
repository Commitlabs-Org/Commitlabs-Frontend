"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import CreateCommitmentStepSelectType from "@/components/CreateCommitmentStepSelectType";
import CreateCommitmentStepConfigure from "@/components/CreateCommitmentStepConfigure";
import CreateCommitmentStepReview from "@/components/CreateCommitmentStepReview";
import CommitmentCreatedModal from "@/components/modals/CommitmentCreatedModal";
import { buildExplorerUrl, openExplorerUrl } from "@/utils/explorerLinks";
import { useWallet } from "@/hooks/useWallet";
import { AppShellLayout } from "@/components/shell/AppShellLayout";
import { useDraftPersistence, type DraftState } from "@/hooks/useDraftPersistence";
import ResumeDraftPrompt from "@/components/create/ResumeDraftPrompt";
import { useGuidedTour } from "@/hooks/useGuidedTour";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { HelpCircle } from "lucide-react";

type CommitmentType = "safe" | "balanced" | "aggressive";

// Generate a random commitment ID (in production, this comes from the blockchain)
function generateCommitmentId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "CMT-";
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default function CreateCommitment() {
  const router = useRouter();
  const { address: ownerAddress } = useWallet();
  const { draft, saveDraft, clearDraft } = useDraftPersistence();
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
        handleSelectType("balanced");
      }
    },
  });
  const [selectedType, setSelectedType] = useState<CommitmentType | null>(null);
  const [commitmentType, setCommitmentType] =
    useState<CommitmentType>("balanced");
  const [amount, setAmount] = useState<string>("");
  const [asset, setAsset] = useState<string>("XLM");
  const [durationDays, setDurationDays] = useState<number>(90);
  const [maxLossPercent, setMaxLossPercent] = useState<number>(100);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [commitmentId, setCommitmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In production this would come from the connected wallet hook.
  // Passed as undefined while wallet integration is pending; the fund
  // API accepts an optional callerAddress and validates it on-chain.
  const callerAddress: string | undefined = undefined;

  useEffect(() => {
    if (draft) {
      setShowResumePrompt(true);
    }
  }, [draft]);

  const handleResumeDraft = () => {
    if (draft) {
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
    clearDraft();
    setShowResumePrompt(false);
  };

  useEffect(() => {
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
  }, [step, selectedType, commitmentType, amount, asset, durationDays, maxLossPercent, saveDraft]);

  // Build review data from actual configured values
  const getReviewData = () => {
    const typeLabelMap: Record<string, string> = {
      safe: "Safe Commitment",
      balanced: "Balanced Commitment",
      aggressive: "Aggressive Commitment",
    };
    const yieldMap: Record<string, string> = {
      safe: "5.2% APY",
      balanced: "12.5% APY",
      aggressive: "45.0% APY",
    };
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + durationDays);
    return {
      typeLabel: typeLabelMap[selectedType ?? "balanced"] ?? "Commitment",
      amount: amount || "0",
      asset,
      durationDays,
      maxLossPercent,
      earlyExitPenalty,
      estimatedFees,
      estimatedYield: yieldMap[selectedType ?? "balanced"] ?? "—",
      commitmentStart: "Immediately",
      commitmentEnd: end.toLocaleDateString(),
    };
  };

  // Mock available balance - in real app, this would come from wallet/API
  const availableBalance = 10000;

  // Derived values
  const earlyExitPenalty = useMemo(() => {
    const penalty =
      commitmentType === "aggressive"
        ? 5
        : commitmentType === "balanced"
          ? 3
          : 2;
    return `${((Number(amount) || 0) * penalty) / 100} ${asset}`;
  }, [amount, asset, commitmentType]);

  const estimatedFees = useMemo(() => `0.00 ${asset}`, [asset]);

  const amountError = useMemo(() => {
    const numAmount = Number(amount);
    if (amount && numAmount <= 0) return "Amount must be greater than 0";
    if (numAmount > availableBalance) return "Amount exceeds available balance";
    return undefined;
  }, [amount, availableBalance]);

  const isStep2Valid = useMemo(() => {
    const numAmount = Number(amount);
    return (
      numAmount > 0 &&
      numAmount <= availableBalance &&
      durationDays >= 1 &&
      durationDays <= 365 &&
      maxLossPercent >= 0 &&
      maxLossPercent <= 100
    );
  }, [amount, availableBalance, durationDays, maxLossPercent]);

  const maxLossWarning = maxLossPercent > 80;

  // Step Handlers
  const handleSelectType = (type: CommitmentType) => {
    setSelectedType(type);
    setCommitmentType(type);
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
      router.push("/");
    }
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const newCommitmentId = generateCommitmentId();
      setCommitmentId(newCommitmentId);
      setShowSuccessModal(true);
      clearDraft();
    }, 2000);
  };

  const handleViewCommitment = () => {
    const numericId = commitmentId.split("-")[1] || "1";
    router.push(`/commitments/${numericId}`);
  };

  const handleCreateAnother = () => {
    setShowSuccessModal(false);
    setSelectedType(null);
    setStep(1);
    setCommitmentId("");
    setCommitmentType("balanced");
    setAmount("");
    setAsset("XLM");
    setDurationDays(90);
    setMaxLossPercent(100);
    clearDraft();
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    router.push("/commitments");
  };

  // Fund-later: close the success modal and go to the detail page so the
  // user can fund the escrow from there at any time.
  const handleFundLater = () => {
    setShowSuccessModal(false);
    const numericId = commitmentId.split("-")[1] || "1";
    router.push(`/commitments/${numericId}`);
  };

  const handleViewOnExplorer = () => {
    openExplorerUrl("tx", commitmentId, "testnet");
  };

  const commitmentExplorerUrl = buildExplorerUrl("tx", commitmentId, "testnet");

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
