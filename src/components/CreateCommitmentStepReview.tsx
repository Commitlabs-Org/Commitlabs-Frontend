"use client";

import { useState } from "react";
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
  onEditStep?: (step: 1 | 2) => void;
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);

  const canSubmit = acceptedTerms && acknowledgedRisks && !isSubmitting;

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

        <div className={styles.reviewHeading}>
          <h2 className={styles.reviewTitle}>Review & Confirm</h2>
          <p className={styles.reviewSubtitle}>
            Please review your commitment details carefully — these parameters
            are enforced on-chain and cannot be changed after creation.
          </p>
        </div>

        {/* Review Sections */}
        <div className={styles.reviewSections}>
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
        <div className={styles.checkboxSection}>
          <div
            className={styles.checkboxRow}
            onClick={() => setAcceptedTerms(!acceptedTerms)}
          >
            <CheckCircle2
              className={`${styles.checkIcon} ${acceptedTerms ? styles.checkIconActive : ""}`}
              size={18}
              aria-hidden="true"
            />
            <div className={styles.checkboxContent}>
              <label>
                <h4>I agree to the terms and conditions</h4>
              </label>
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
            className={styles.checkboxRow}
            onClick={() => setAcknowledgedRisks(!acknowledgedRisks)}
          >
            <CheckCircle2
              className={`${styles.checkIcon} ${acknowledgedRisks ? styles.checkIconActive : ""}`}
              size={18}
              aria-hidden="true"
            />
            <div className={styles.checkboxContent}>
              <label>
                <h4>I acknowledge the risks</h4>
              </label>
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
          {submitError && <p className={styles.submitError}>{submitError}</p>}
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={styles.createButton}
            aria-disabled={!canSubmit}
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
