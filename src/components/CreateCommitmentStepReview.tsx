"use client";

import { useState, useRef, useEffect } from "react";
import {
  Shield,
  TrendingUp,
  Flame,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Edit2,
} from "lucide-react";
import WizardStepper from "./WizardStepper";
import styles from "./CreateCommitmentStepReview.module.css";
import { useWallet } from "@/hooks/useWallet";
import ValidationSummary, { ValidationErrorItem } from "./create/ValidationSummary";

interface CreateCommitmentStepReviewProps {
  typeLabel: string;
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
  earlyExitPenalty: string;
  estimatedFees: string;
  estimatedYield: string;
  commitmentStart: string;
  commitmentEnd: string;
  isSubmitting?: boolean;
  submitError?: string;
  onBack: () => void;
  onSubmit: () => void;
  onEditStep?: (step: 1 | 2, fieldId?: string) => void;
}

export default function CreateCommitmentStepReview({
  typeLabel,
  amount,
  asset,
  durationDays,
  maxLossPercent,
  earlyExitPenalty,
  estimatedFees,
  estimatedYield,
  commitmentStart,
  commitmentEnd,
  isSubmitting = false,
  submitError,
  onBack,
  onSubmit,
  onEditStep,
}: CreateCommitmentStepReviewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);
  const { connected, address, connect } = useWallet();
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;

    async function validate() {
      setIsValidating(true);
      const errors: ValidationErrorItem[] = [];

      // 1. Client-side checks on review step
      if (!connected || !address) {
        errors.push({
          id: "client-wallet",
          message: "Wallet must be connected to submit transaction.",
          step: 3,
          field: "review-connect-wallet",
        });
      }

      if (!acceptedTerms) {
        errors.push({
          id: "client-terms",
          message: "You must agree to the terms and conditions.",
          step: 3,
          field: "acceptedTerms",
        });
      }

      if (!acknowledgedRisks) {
        errors.push({
          id: "client-risks",
          message: "You must acknowledge the risks.",
          step: 3,
          field: "acknowledgedRisks",
        });
      }

      // 2. Call validate route
      try {
        const response = await fetch("/api/commitments/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ownerAddress: address || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            asset,
            amount: amount || "0",
            durationDays,
            maxLossBps: maxLossPercent * 100,
          }),
        });

        if (response.ok && active) {
          const data = await response.json();
          if (!data.valid && data.errors) {
            data.errors.forEach((err: any, index: number) => {
              if (err.field === "ownerAddress") {
                if (!errors.some((e) => e.field === "review-connect-wallet")) {
                  errors.push({
                    id: "server-ownerAddress",
                    message: err.message || "Invalid Stellar address format.",
                    step: 3,
                    field: "review-connect-wallet",
                  });
                }
              } else if (err.field === "amount") {
                errors.push({
                  id: "server-amount",
                  message: err.message || "Amount must be a positive number.",
                  step: 2,
                  field: "amount",
                });
              } else if (err.field === "durationDays") {
                errors.push({
                  id: "server-duration",
                  message: err.message || "Duration must be a positive integer.",
                  step: 2,
                  field: "duration",
                });
              } else if (err.field === "maxLossBps") {
                errors.push({
                  id: "server-maxloss",
                  message: err.message || "Max loss must be a non-negative number.",
                  step: 2,
                  field: "maxLoss",
                });
              } else {
                errors.push({
                  id: `server-${err.field || "general"}-${index}`,
                  message: err.message || "Validation error.",
                  step: 2,
                  field: err.field || "amount",
                });
              }
            });
          }
        }
      } catch (e) {
        console.error("Validation API error:", e);
      }

      if (active) {
        setValidationErrors(errors);
        setIsValidating(false);
      }
    }

    validate();

    return () => {
      active = false;
    };
  }, [
    connected,
    address,
    acceptedTerms,
    acknowledgedRisks,
    amount,
    asset,
    durationDays,
    maxLossPercent,
  ]);

  const handleJumpToError = (targetStep: 1 | 2 | 3, field: string) => {
    if (targetStep === 3) {
      const element = document.getElementById(field);
      if (element) {
        element.focus();
        element.scrollIntoView({ block: "center" });
      }
    } else if (onEditStep) {
      onEditStep(targetStep as 1 | 2, field);
    }
  };

  const canSubmit = acceptedTerms && acknowledgedRisks && !isSubmitting && validationErrors.length === 0;

  const getIconAndStyle = () => {
    const l = typeLabel.toLowerCase();
    if (l.includes("safe"))
      return { Icon: Shield, styleClass: styles.iconSafe };
    if (l.includes("aggressive"))
      return { Icon: Flame, styleClass: styles.iconAggressive };
    return { Icon: TrendingUp, styleClass: styles.iconBalanced };
  };

  const { Icon, styleClass } = getIconAndStyle();

  const maxLossDisplay =
    maxLossPercent >= 100 ? "No protection (100%)" : `${maxLossPercent}%`;

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <button onClick={onBack} className={styles.backButton}>
          <ArrowLeft size={16} />
          Back
        </button>

        <div className={styles.header}>
          <h1 className={styles.title}>Create Commitment</h1>
          <p className={styles.subtitle}>
            Define your liquidity commitment with explicit rules and guarantees
          </p>
        </div>

        <WizardStepper currentStep={3} />

        <ValidationSummary
          errors={validationErrors}
          onJumpToError={handleJumpToError}
        />

        {!connected && (
          <div className={styles.walletWarningBanner} id="review-connect-wallet-section">
            <AlertCircle size={20} className={styles.walletWarningIcon} />
            <div className={styles.walletWarningContent}>
              <h4>Wallet Disconnected</h4>
              <p>Please connect your Stellar wallet to authorize and sign the creation transaction.</p>
              <button
                type="button"
                id="review-connect-wallet"
                onClick={connect}
                className={styles.connectWalletButton}
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}

        <div className={styles.reviewHeading}>
          <h2 ref={headingRef} tabIndex={-1} className={styles.reviewTitle}>Review & Confirm</h2>
          <p className={styles.reviewSubtitle}>
            Please review your commitment details carefully — these parameters
            are enforced on-chain and cannot be changed after creation.
          </p>
        </div>

        {/* Review Sections */}
        <div className={styles.reviewSections} data-testid="review-sections">
          {/* Type Section */}
          <section
            className={styles.reviewSection}
            aria-labelledby="type-section-heading"
          >
            <div className={styles.sectionHeader}>
              <h3 id="type-section-heading" className={styles.sectionTitle}>
                Commitment Type
              </h3>
              {onEditStep && (
                <button
                  onClick={() => onEditStep(1)}
                  className={styles.editButton}
                  aria-label="Edit commitment type"
                  title="Return to step 1 to edit commitment type"
                >
                  <Edit2 size={16} />
                  <span>Edit</span>
                </button>
              )}
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.typeDisplay}>
                <div className={styles.typeIconSmall}>
                  <Icon size={24} className={styleClass} />
                </div>
                <div className={styles.typeDetails}>
                  <p className={styles.typeValue}>{typeLabel}</p>
                  <p className={styles.typeDescription}>
                    Your selected commitment strategy
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Amount & Asset Section */}
          <section
            className={styles.reviewSection}
            aria-labelledby="amount-section-heading"
          >
            <div className={styles.sectionHeader}>
              <h3 id="amount-section-heading" className={styles.sectionTitle}>
                Amount & Asset
              </h3>
              {onEditStep && (
                <button
                  onClick={() => onEditStep(2)}
                  className={styles.editButton}
                  aria-label="Edit commitment amount and asset"
                  title="Return to step 2 to edit amount and asset"
                >
                  <Edit2 size={16} />
                  <span>Edit</span>
                </button>
              )}
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Amount</label>
                  <p className={styles.fieldValue}>
                    {amount} <span className={styles.assetTag}>{asset}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Duration Section */}
          <section
            className={styles.reviewSection}
            aria-labelledby="duration-section-heading"
          >
            <div className={styles.sectionHeader}>
              <h3 id="duration-section-heading" className={styles.sectionTitle}>
                Duration
              </h3>
              {onEditStep && (
                <button
                  onClick={() => onEditStep(2)}
                  className={styles.editButton}
                  aria-label="Edit commitment duration"
                  title="Return to step 2 to edit duration"
                >
                  <Edit2 size={16} />
                  <span>Edit</span>
                </button>
              )}
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Duration</label>
                  <p className={styles.fieldValue}>{durationDays} days</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Start Date</label>
                  <p className={styles.fieldValue}>{commitmentStart}</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>End Date</label>
                  <p className={styles.fieldValue}>{commitmentEnd}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Risk & Protections Section */}
          <section
            className={styles.reviewSection}
            aria-labelledby="risk-section-heading"
          >
            <div className={styles.sectionHeader}>
              <h3 id="risk-section-heading" className={styles.sectionTitle}>
                Risk & Protections
              </h3>
              {onEditStep && (
                <button
                  onClick={() => onEditStep(2)}
                  className={styles.editButton}
                  aria-label="Edit max loss and early exit settings"
                  title="Return to step 2 to edit risk parameters"
                >
                  <Edit2 size={16} />
                  <span>Edit</span>
                </button>
              )}
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Max Loss Protection
                  </label>
                  <p
                    className={`${styles.fieldValue} ${maxLossPercent >= 100 ? styles.fieldValueRisk : ""}`}
                  >
                    {maxLossDisplay}
                  </p>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Early Exit Penalty
                  </label>
                  <p className={styles.fieldValue}>{earlyExitPenalty}</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Estimated Fees</label>
                  <p className={styles.fieldValue}>{estimatedFees}</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Estimated Yield</label>
                  <p
                    className={`${styles.fieldValue} ${styles.highlightValue}`}
                  >
                    {estimatedYield}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Checkboxes */}
        <div className={styles.checkboxSection} data-testid="review-checkboxes">
          <div
            id="acceptedTerms"
            className={styles.checkboxRow}
            role="checkbox"
            aria-checked={acceptedTerms}
            aria-labelledby="terms-label"
            tabIndex={0}
            onClick={() => setAcceptedTerms(!acceptedTerms)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setAcceptedTerms(!acceptedTerms);
              }
            }}
          >
            <CheckCircle2
              className={`${styles.checkIcon} ${acceptedTerms ? styles.checkIconActive : ""}`}
              size={18}
              aria-hidden="true"
            />
            <div className={styles.checkboxContent}>
              <span id="terms-label">
                <h4>I agree to the terms and conditions</h4>
              </span>
              <p>
                I have read and understand the{" "}
                <a href="#" className={styles.link}>
                  terms of service
                </a>{" "}
                and smart contract exit conditions.
              </p>
            </div>
          </div>

          <div
            id="acknowledgedRisks"
            className={styles.checkboxRow}
            role="checkbox"
            aria-checked={acknowledgedRisks}
            aria-labelledby="risks-label"
            tabIndex={0}
            onClick={() => setAcknowledgedRisks(!acknowledgedRisks)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setAcknowledgedRisks(!acknowledgedRisks);
              }
            }}
          >
            <CheckCircle2
              className={`${styles.checkIcon} ${acknowledgedRisks ? styles.checkIconActive : ""}`}
              size={18}
              aria-hidden="true"
            />
            <div className={styles.checkboxContent}>
              <span id="risks-label">
                <h4>I acknowledge the risks</h4>
              </span>
              <p>
                I understand that DeFi protocols carry inherent risks including
                smart contract vulnerabilities, market volatility, and potential
                loss of funds up to the max loss threshold I configured.
              </p>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className={styles.noticeBanner}>
          <AlertCircle size={20} className={styles.noticeIcon} />
          <div className={styles.noticeContent}>
            <h4>Important Notice</h4>
            <p>
              Once created, this commitment cannot be modified. Early exits
              before {durationDays} days will incur the penalty of{" "}
              {earlyExitPenalty}. Make sure all details are correct before
              proceeding.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {submitError && <p className={styles.submitError} role="alert">{submitError}</p>}
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={styles.createButton}
            aria-disabled={!canSubmit}
            data-testid="create-commitment-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className={styles.spinner} />
                Processing Transaction...
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                Create Commitment
              </>
            )}
          </button>
          <div className={styles.disclaimer}>
            <AlertCircle size={14} />
            <span>This will initiate a blockchain transaction</span>
          </div>
        </div>
      </div>
    </div>
  );
}
