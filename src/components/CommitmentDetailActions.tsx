import React, { useState } from "react";
import {
  FiLogOut,
  FiFileText,
  FiDownload,
  FiAlertCircle,
} from "react-icons/fi";
import { DisputeFormValues, DisputeModal } from "./dispute/DisputeModal";

interface CommitmentDetailActionsProps {
  canEarlyExit: boolean;
  commitmentId?: string;
  callerAddress?: string;
  onEarlyExit: () => void;
  onViewAttestations: () => void;
  onExportData: () => void;
  onReportIssue: () => void;
}

export function CommitmentDetailActions({
  canEarlyExit,
  commitmentId,
  callerAddress,
  onEarlyExit,
  onViewAttestations,
  onExportData,
  onReportIssue,
}: CommitmentDetailActionsProps) {
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState<string | null>(null);

  const isDisputed = Boolean(disputeSuccess);

  const handleOpenDispute = () => {
    if (!commitmentId) {
      onReportIssue();
      return;
    }

    setDisputeError(null);
    setIsDisputeOpen(true);
  };

  const handleSubmitDispute = async ({
    category,
    reasonText,
  }: DisputeFormValues) => {
    if (!commitmentId) {
      return;
    }

    setIsSubmittingDispute(true);
    setDisputeError(null);

    try {
      const response = await fetch(`/api/commitments/${commitmentId}/dispute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: `[${category}] ${reasonText}`,
          evidence: `category:${category}`,
          callerAddress,
        }),
      });

      if (!response.ok) {
        let message = "Unable to open dispute. Please retry.";

        try {
          const body = await response.json();
          message = body?.error?.message ?? body?.message ?? message;
        } catch {
          // Keep the generic message if the response is not JSON.
        }

        throw new Error(message);
      }

      setDisputeSuccess(
        "Dispute opened. This commitment is now marked as Disputed.",
      );
      setIsDisputeOpen(false);
    } catch (error) {
      setDisputeError(
        error instanceof Error ? error.message : "Unable to open dispute.",
      );
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <div className="w-full ">
      {/* Section Heading */}
      <h2 className="text-white text-3xl font-bold mb-8">Actions</h2>

      {/* Primary Actions */}
      <div className="mb-8">
        <h3 className="text-white text-base font-semibold mb-4">
          Primary Actions
        </h3>

        {/* Early Exit Button */}
        <button
          onClick={canEarlyExit ? onEarlyExit : undefined}
          disabled={!canEarlyExit}
          className={`
            w-full rounded-3xl px-8 py-6
            border-2 transition-all duration-300
            flex items-center gap-6 justify-center
            ${
              canEarlyExit
                ? "bg-[#0A0A0A] border-[#F97316] shadow-[0_4px_24px_rgba(249,115,22,0.2),inset_0_1px_0_rgba(249,115,22,0.1)] hover:shadow-[0_8px_32px_rgba(249,115,22,0.3),inset_0_1px_0_rgba(249,115,22,0.2)] cursor-pointer hover:bg-[#161616]"
                : "bg-[#161616] border-[#F97316]/30 opacity-50 cursor-not-allowed"
            }
          `}
          aria-label="Early Exit - Exit before expiry (penalty applies)"
        >
          {/* Icon */}
          <FiLogOut className="text-[#F97316]" size={28} />

          {/* Text Content */}
          <div className=" text-left">
            <div className="text-[#F97316] text-xl font-semibold mb-1">
              Early Exit
            </div>
            <div className="text-white/50 text-sm">
              Exit before expiry (penalty applies)
            </div>
          </div>
        </button>
      </div>

      {/* Additional Actions */}
      <div className="mb-8">
        <h3 className="text-white text-base font-semibold mb-4">
          Additional Actions
        </h3>

        <div className="space-y-3">
          {/* View Full Attestation History */}
          <button
            onClick={onViewAttestations}
            className="
              w-full rounded-2xl px-6 py-4
              bg-[#0a2122] border border-[#0b5d61]
              hover:bg-[#0d1d1e] hover:border-[#0f2324]
              transition-all duration-200
              flex items-center gap-4
              cursor-pointer
            "
            aria-label="View Full Attestation History"
          >
            {/* Icon */}
            <FiFileText className="text-white/70" size={22} />

            {/* Text */}
            <span className="text-white text-base flex-1 text-left font-medium">
              View Full Attestation History
            </span>
          </button>

          {/* Export Commitment Data */}
          <button
            onClick={onExportData}
            className="
              w-full rounded-2xl px-6 py-4
              bg-[#161616] border border-[#232323]
              hover:bg-[#1a1a1a] hover:border-[#1f1f1f]
              transition-all duration-200
              flex items-center gap-4
              cursor-pointer
            "
            aria-label="Export Commitment Data"
          >
            {/* Icon */}
            <FiDownload className="text-white/70" size={22} />

            {/* Text */}
            <span className="text-white text-base flex-1 text-left font-medium">
              Export Commitment Data
            </span>
          </button>

          {/* Report an Issue */}
          <button
            onClick={handleOpenDispute}
            disabled={isDisputed}
            className="
              w-full rounded-2xl px-6 py-4
              bg-[#161616] border border-[#232323]
              hover:bg-[#1a1a1a] hover:border-[#1f1f1f]
              transition-all duration-200
              flex items-center gap-4
              cursor-pointer
              disabled:cursor-not-allowed disabled:opacity-60
            "
            aria-label={isDisputed ? "Commitment is disputed" : "Open dispute"}
          >
            {/* Icon */}
            <FiAlertCircle className="text-white/70" size={22} />

            {/* Text */}
            <span className="text-white text-base flex-1 text-left font-medium">
              {isDisputed ? "Disputed" : "Open Dispute"}
            </span>
          </button>
        </div>
      </div>

      {disputeSuccess ? (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
        >
          {disputeSuccess}
        </p>
      ) : null}

      {/* Helper Note */}
      <div
        className="
        rounded-3xl px-6 py-5
        bg-[#0a1516] border border-[#0a282a]
        flex items-start gap-4 
      "
      >
        {/* Helper Text */}
        <p className="text-white/50 text-sm leading-relaxed ">
          All actions are recorded on-chain and can be verified through
          attestations. Contact support if you encounter any issues.
        </p>
      </div>

      {commitmentId ? (
        <DisputeModal
          commitmentId={commitmentId}
          isOpen={isDisputeOpen}
          isSubmitting={isSubmittingDispute}
          errorMessage={disputeError}
          successMessage={disputeSuccess}
          onCancel={() => setIsDisputeOpen(false)}
          onSubmit={handleSubmitDispute}
        />
      ) : null}
    </div>
  );
}
