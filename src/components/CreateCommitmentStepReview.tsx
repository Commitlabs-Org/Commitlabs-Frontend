'use client';

import { useState } from 'react';
import { Shield, TrendingUp, Flame, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import WizardStepper from './WizardStepper';
import styles from './CreateCommitmentStepReview.module.css';

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
}: CreateCommitmentStepReviewProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);

  const canSubmit = acceptedTerms && acknowledgedRisks && !isSubmitting;

  const getIconAndStyle = () => {
    const l = typeLabel.toLowerCase();
    if (l.includes('safe')) return { Icon: Shield, styleClass: styles.iconSafe };
    if (l.includes('aggressive')) return { Icon: Flame, styleClass: styles.iconAggressive };
    return { Icon: TrendingUp, styleClass: styles.iconBalanced };
  };

  const { Icon, styleClass } = getIconAndStyle();

  const maxLossDisplay = maxLossPercent >= 100 ? 'No protection (100%)' : `${maxLossPercent}%`;

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
            Please review your commitment details carefully — these parameters are enforced on-chain and cannot be changed after creation.
          </p>
        </div>

        {/* Summary Card */}
        <div className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <div className={styles.typeIconContainer}>
              <Icon size={28} className={styleClass} />
            </div>
            <div className={styles.typeInfo}>
              <h3>{typeLabel}</h3>
              <p>Your commitment summary</p>
            </div>
          </div>

          <div className={styles.dataGrid}>
            <div className={styles.dataItem}>
              <span className={styles.dataLabel}>Amount</span>
              <div className={styles.dataValue}>
                {amount} <span className={styles.assetTag}>{asset}</span>
              </div>
            </div>
            <div className={styles.dataItem}>
              <span className={styles.dataLabel}>Duration</span>
              <div className={styles.dataValue}>{durationDays} days</div>
            </div>
            <div className={styles.dataItem}>
              <span className={styles.dataLabel}>Max Loss</span>
              <div className={`${styles.dataValue} ${maxLossPercent >= 100 ? styles.dataValueRisk : ''}`}>
                {maxLossDisplay}
              </div>
            </div>
            <div className={styles.dataItem}>
              <span className={styles.dataLabel}>Early Exit Penalty</span>
              <div className={styles.dataValue}>{earlyExitPenalty}</div>
            </div>
          </div>

          <div className={styles.secondaryDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Estimated Transaction Fees</span>
              <span className={styles.detailValue}>{estimatedFees}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Estimated Yield (APY)</span>
              <span className={`${styles.detailValue} ${styles.highlightValue}`}>{estimatedYield}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Commitment Start</span>
              <span className={styles.detailValue}>{commitmentStart}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Commitment End</span>
              <span className={styles.detailValue}>{commitmentEnd}</span>
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className={styles.checkboxSection}>
          <div className={styles.checkboxRow} onClick={() => setAcceptedTerms(!acceptedTerms)}>
            <CheckCircle2
              className={`${styles.checkIcon} ${acceptedTerms ? styles.checkIconActive : ''}`}
              size={18}
              aria-hidden="true"
            />
            <div className={styles.checkboxContent}>
              <label>
                <h4>I agree to the terms and conditions</h4>
              </label>
              <p>
                I have read and understand the{' '}
                <a href="#" className={styles.link}>terms of service</a> and smart contract exit conditions.
              </p>
            </div>
          </div>

          <div className={styles.checkboxRow} onClick={() => setAcknowledgedRisks(!acknowledgedRisks)}>
            <CheckCircle2
              className={`${styles.checkIcon} ${acknowledgedRisks ? styles.checkIconActive : ''}`}
              size={18}
              aria-hidden="true"
            />
            <div className={styles.checkboxContent}>
              <label>
                <h4>I acknowledge the risks</h4>
              </label>
              <p>
                I understand that DeFi protocols carry inherent risks including smart contract vulnerabilities,
                market volatility, and potential loss of funds up to the max loss threshold I configured.
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
              Once created, this commitment cannot be modified. Early exits before {durationDays} days will
              incur the penalty of {earlyExitPenalty}. Make sure all details are correct before proceeding.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {submitError && (
            <p className={styles.submitError}>{submitError}</p>
          )}
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
