"use client";

import React, { useMemo, useState } from "react";

export type DisputeReasonCategory =
  | "ValueMismatch"
  | "NonCompliance"
  | "FraudSuspicion"
  | "OperationalFailure"
  | "Other";

export interface DisputeFormValues {
  category: DisputeReasonCategory;
  reasonText: string;
}

interface DisputeModalProps {
  commitmentId: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onCancel: () => void;
  onSubmit: (values: DisputeFormValues) => void | Promise<void>;
}

const REASON_OPTIONS: Array<{
  value: DisputeReasonCategory;
  label: string;
  description: string;
}> = [
  {
    value: "ValueMismatch",
    label: "Value mismatch",
    description:
      "Reported value, amount, or payout terms do not match the commitment.",
  },
  {
    value: "NonCompliance",
    label: "Non-compliance",
    description:
      "The commitment appears to violate its stated compliance rules.",
  },
  {
    value: "FraudSuspicion",
    label: "Fraud suspicion",
    description: "There are signs of misrepresentation or suspicious activity.",
  },
  {
    value: "OperationalFailure",
    label: "Operational failure",
    description:
      "An operational or execution issue prevents normal settlement.",
  },
  {
    value: "Other",
    label: "Other",
    description: "Use when none of the listed categories fit the dispute.",
  },
];

const MAX_REASON_LENGTH = 500;

export function DisputeModal({
  commitmentId,
  isOpen,
  isSubmitting = false,
  errorMessage,
  successMessage,
  onCancel,
  onSubmit,
}: DisputeModalProps) {
  const [category, setCategory] =
    useState<DisputeReasonCategory>("ValueMismatch");
  const [reasonText, setReasonText] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const trimmedReason = reasonText.trim();
  const reasonTooLong = reasonText.length > MAX_REASON_LENGTH;
  const reasonMissing = hasSubmitted && trimmedReason.length === 0;
  const canSubmit = trimmedReason.length > 0 && !reasonTooLong && !isSubmitting;
  const submitDisabled = isSubmitting || reasonTooLong;

  const selectedReason = useMemo(
    () => REASON_OPTIONS.find((option) => option.value === category),
    [category],
  );

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);

    if (!canSubmit) {
      return;
    }

    await onSubmit({ category, reasonText: trimmedReason });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-[#253335] bg-[#0a0a0a] p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-modal-title"
        aria-describedby="dispute-modal-description"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0ff0fc]">
              Frozen state request
            </p>
            <h2
              id="dispute-modal-title"
              className="text-2xl font-semibold text-white"
            >
              Open dispute
            </h2>
            <p
              id="dispute-modal-description"
              className="mt-2 text-sm leading-6 text-white/60"
            >
              Categorize the issue and add details for commitment {commitmentId}
              .
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            aria-label="Close dispute modal"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white">
              Reason category
            </span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as DisputeReasonCategory)
              }
              className="w-full rounded-2xl border border-[#1f3436] bg-[#101314] px-4 py-3 text-white outline-none transition focus:border-[#0ff0fc]"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {selectedReason ? (
            <p className="rounded-2xl border border-[#0a282a] bg-[#0a1516] px-4 py-3 text-sm leading-6 text-white/60">
              {selectedReason.description}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white">
              Detail text
            </span>
            <textarea
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              maxLength={MAX_REASON_LENGTH + 1}
              rows={5}
              className="w-full resize-none rounded-2xl border border-[#1f3436] bg-[#101314] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#0ff0fc]"
              placeholder="Describe the mismatch, violation, or failure."
              aria-invalid={reasonMissing || reasonTooLong}
              aria-describedby="dispute-reason-help"
            />
          </label>

          <div
            id="dispute-reason-help"
            className="flex items-center justify-between gap-4 text-xs text-white/50"
          >
            <span>Required. Maximum 500 characters.</span>
            <span>{reasonText.length}/500</span>
          </div>

          {reasonMissing ? (
            <p role="alert" className="text-sm text-[#ff8a04]">
              Add detail text before opening the dispute.
            </p>
          ) : null}

          {reasonTooLong ? (
            <p role="alert" className="text-sm text-[#ff8a04]">
              Reason text must be 500 characters or less.
            </p>
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-100"
            >
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p
              role="status"
              className="rounded-2xl border border-emerald-400/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
            >
              {successMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/10 px-5 py-3 font-medium text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="rounded-2xl border border-[#0b5d61] bg-[#0a2122] px-5 py-3 font-semibold text-white transition hover:bg-[#0d2a2c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Opening dispute..." : "Open dispute"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { REASON_OPTIONS };
