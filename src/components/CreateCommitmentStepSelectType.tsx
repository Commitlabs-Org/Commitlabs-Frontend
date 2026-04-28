'use client';
import { Shield, TrendingUp, Flame, ArrowRight, ChevronLeft, Info } from 'lucide-react';
import WizardStepper from './WizardStepper';
import styles from './CreateCommitmentStepSelectType.module.css';

interface CommitmentType {
  id: 'safe' | 'balanced' | 'aggressive';
  title: string;
  icon: typeof Shield;
  duration: string;
  durationNote: string;
  maxLoss: string;
  maxLossNote: string;
  description: string;
  badge: string | null;
  badgeType: 'recommended' | 'risk' | null;
}

interface CreateCommitmentStepSelectTypeProps {
  selectedType: 'safe' | 'balanced' | 'aggressive' | null;
  onSelectType: (type: 'safe' | 'balanced' | 'aggressive') => void;
  onNext: (type: 'safe' | 'balanced' | 'aggressive') => void;
  onBack: () => void;
}

const commitmentTypes: CommitmentType[] = [
  {
    id: 'safe',
    title: 'Safe Commitment',
    icon: Shield,
    duration: '30 days',
    durationNote: 'Minimum lock-in: 30 days. Early exit incurs a 2% penalty on your committed amount.',
    maxLoss: '2%',
    maxLossNote: 'Your position is automatically closed if losses reach 2% of your committed amount, protecting your principal.',
    description: 'Lower risk, stable yield with minimal exposure.',
    badge: 'Recommended',
    badgeType: 'recommended',
  },
  {
    id: 'balanced',
    title: 'Balanced Commitment',
    icon: TrendingUp,
    duration: '60 days',
    durationNote: 'Minimum lock-in: 60 days. Early exit incurs a 3% penalty on your committed amount.',
    maxLoss: '8%',
    maxLossNote: 'Your position closes automatically at an 8% loss. Suitable for moderate risk tolerance.',
    description: 'Medium yield potential with controlled risk.',
    badge: null,
    badgeType: null,
  },
  {
    id: 'aggressive',
    title: 'Aggressive Commitment',
    icon: Flame,
    duration: '90 days',
    durationNote: 'Minimum lock-in: 90 days. Early exit incurs a 5% penalty on your committed amount.',
    maxLoss: 'No protection',
    maxLossNote: 'No automatic stop-loss. Your full committed amount is at risk. Only suitable for experienced users.',
    description: 'Highest yield potential with no loss protection.',
    badge: '⚠ High Risk',
    badgeType: 'risk',
  },
];

export default function CreateCommitmentStepSelectType({
  selectedType,
  onSelectType,
  onNext,
  onBack,
}: CreateCommitmentStepSelectTypeProps) {
  const handleContinue = () => {
    if (selectedType) {
      onNext(selectedType);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={16} />
          Back to Home
        </button>

        <div className={styles.header}>
          <h1 className={styles.title}>Create Commitment</h1>
          <p className={styles.subtitle}>
            Define your liquidity commitment with explicit rules and guarantees
          </p>
        </div>

        <WizardStepper currentStep={1} />

        <div className={styles.titleSection}>
          <h2 className={styles.sectionTitle}>Choose Your Commitment Type</h2>
          <p className={styles.sectionSubtitle}>
            Select the risk profile that matches your investment strategy
          </p>
        </div>

        <div className={styles.cardsContainer} role="radiogroup" aria-label="Commitment type">
          {commitmentTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;

            return (
              <div
                key={type.id}
                onClick={() => onSelectType(type.id)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectType(type.id);
                  }
                }}
                className={`${styles.card} ${
                  type.id === 'safe'
                    ? styles.cardSafe
                    : type.id === 'aggressive'
                    ? styles.cardAggressive
                    : styles.cardBalanced
                } ${isSelected ? styles.cardSelected : ''}`}
              >
                {type.badge && (
                  <div
                    className={`${styles.badge} ${
                      type.badgeType === 'recommended' ? styles.badgeRecommended : styles.badgeRisk
                    }`}
                  >
                    {type.badge}
                  </div>
                )}

                <div className={styles.iconContainer}>
                  <Icon
                    size={24}
                    className={
                      type.id === 'safe'
                        ? styles.iconEmerald
                        : type.id === 'balanced'
                        ? styles.iconBlue
                        : styles.iconOrange
                    }
                  />
                </div>

                <h3 className={styles.cardTitle}>{type.title}</h3>

                <div className={styles.statsContainer}>
                  <div className={styles.statBlock}>
                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>Duration</span>
                      <span className={styles.statValue}>{type.duration}</span>
                    </div>
                    <p className={styles.constraintNote}>
                      <Info size={11} className={styles.noteIcon} />
                      {type.durationNote}
                    </p>
                  </div>

                  <div className={styles.statBlock}>
                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>Max Loss</span>
                      <span
                        className={`${styles.statValue} ${
                          type.maxLoss === 'No protection' ? styles.statValueRisk : ''
                        }`}
                      >
                        {type.maxLoss}
                      </span>
                    </div>
                    <p className={`${styles.constraintNote} ${type.id === 'aggressive' ? styles.constraintNoteRisk : ''}`}>
                      <Info size={11} className={styles.noteIcon} />
                      {type.maxLossNote}
                    </p>
                  </div>
                </div>

                <p className={styles.description}>{type.description}</p>
              </div>
            );
          })}
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            💡 <span className={styles.infoTextHighlight}>Tip:</span> Your commitment type
            determines the initial parameters. You can fine-tune duration and max loss in the next step.
          </p>
        </div>

        <div className={styles.actionButtons}>
          <button onClick={onBack} className={styles.backBtn}>
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedType}
            className={`${styles.continueBtn} ${
              selectedType ? styles.continueBtnEnabled : styles.continueBtnDisabled
            }`}
          >
            Continue
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
