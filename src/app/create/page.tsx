'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import CreateCommitmentStepSelectType from '@/components/CreateCommitmentStepSelectType'
import CreateCommitmentStepConfigure from '@/components/CreateCommitmentStepConfigure'
import CreateCommitmentStepReview from '@/components/CreateCommitmentStepReview';        
import CommitmentCreatedModal from '@/components/modals/Commitmentcreatedmodal'

type CommitmentType = 'safe' | 'balanced' | 'aggressive'

// Generate a random commitment ID (in production, this comes from the blockchain)
function generateCommitmentId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = 'CMT-'
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

export default function CreateCommitment() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<'safe' | 'balanced' | 'aggressive' | null>(null);
  const [commitmentType, setCommitmentType] = useState<CommitmentType>('balanced')
  const [amount, setAmount] = useState<string>('')
  const [asset, setAsset] = useState<string>('XLM')
  const [durationDays, setDurationDays] = useState<number>(90)
  const [maxLossPercent, setMaxLossPercent] = useState<number>(100)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [commitmentId, setCommitmentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock data based on selected type
  // TODO: This should be replaced with real-time data fetching from the blockchain
  // or a backend service that calculates these values based on current market conditions.
  const getMockData = () => {
    switch (selectedType) {
      case 'safe':
        return {
          typeLabel: 'Safe Commitment',
          amount: '500 XLM',
          asset: 'XLM',
          durationDays: 30,
          maxLossPercent: 2,
          earlyExitPenalty: '5.00 XLM',
          estimatedFees: '0.10 XLM',
          estimatedYield: '5.2% APY',
          commitmentStart: 'Immediately',
          commitmentEnd: '2/28/2026'
        };
      case 'balanced':
        return {
          typeLabel: 'Balanced Commitment',
          amount: '1000 XLM',
          asset: 'XLM',
          durationDays: 60,
          maxLossPercent: 8,
          earlyExitPenalty: '20.00 XLM',
          estimatedFees: '0.50 XLM',
          estimatedYield: '12.5% APY',
          commitmentStart: 'Immediately',
          commitmentEnd: '3/30/2026'
        };
      case 'aggressive':
        return {
          typeLabel: 'Aggressive Commitment',
          amount: '2000 XLM',
          asset: 'XLM',
          durationDays: 90,
          maxLossPercent: 100, // Should probably handle "No protection" or similar logic in presentation if needed, but number is simpler
          earlyExitPenalty: '100.00 XLM',
          estimatedFees: '1.20 XLM',
          estimatedYield: '45.0% APY',
          commitmentStart: 'Immediately',
          commitmentEnd: '4/30/2026'
        };
      default:
        return {
          typeLabel: 'Unknown',
          amount: '0 XLM',
          asset: 'XLM',
          durationDays: 0,
          maxLossPercent: 0,
          earlyExitPenalty: '0 XLM',
          estimatedFees: '0 XLM',
          estimatedYield: '0%',
          commitmentStart: '-',
          commitmentEnd: '-'
        };
    }
  };

  // Mock available balance - in real app, this would come from wallet/API
  const availableBalance = 10000

  // Derived values based on commitment parameters
  const earlyExitPenalty = useMemo(() => {
    const penalty = commitmentType === 'aggressive' ? 5 : commitmentType === 'balanced' ? 3 : 2
    return `${(Number(amount) || 0) * penalty / 100} ${asset}`
  }, [amount, asset, commitmentType])

  const estimatedFees = useMemo(() => {
    // Simple fee calculation - in real app, this would be more complex
    return `0.00 ${asset}`
  }, [asset])

  // Validation
  const amountError = useMemo(() => {
    const numAmount = Number(amount)
    if (amount && numAmount <= 0) return 'Amount must be greater than 0'
    if (numAmount > availableBalance) return 'Amount exceeds available balance'
    return undefined
  }, [amount, availableBalance])

  const isStep2Valid = useMemo(() => {
    const numAmount = Number(amount)
    return (
      numAmount > 0 &&
      numAmount <= availableBalance &&
      durationDays >= 1 &&
      durationDays <= 365 &&
      maxLossPercent >= 0 &&
      maxLossPercent <= 100
    )
  }, [amount, availableBalance, durationDays, maxLossPercent])

  const maxLossWarning = maxLossPercent > 80

  const handleSelectType = (type: 'safe' | 'balanced' | 'aggressive') => {
    setSelectedType(type)
    setCommitmentType(type)
  }

  // Navigation handlers
  // Note: These control the wizard step flow
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else {
      router.push('/')
    }
  }

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1)
    }
  }

  /**
   * Submission Handler
   * Currently mocks a blockchain transaction with a timeout.
   * TODO: Integrate with wallet provider (Freighter) and Soroban contract.
   */
  const handleSubmit = () => {
    setIsSubmitting(true);

    // Simulate transaction delay
    setTimeout(() => {
      setIsSubmitting(false);
      const newCommitmentId = generateCommitmentId();
      setCommitmentId(newCommitmentId);
      setShowSuccessModal(true);
    }, 2000);
  };

  const handleViewCommitment = () => {
    const numericId = commitmentId.split('-')[1] || '1';
    router.push(`/commitments/${numericId}`);
  };

  const handleCreateAnother = () => {
    setShowSuccessModal(false)
    setSelectedType(null)
    setCurrentStep(1)
    setCommitmentId('')
    setCommitmentType('balanced')
    setAmount('')
    setAsset('XLM')
    setDurationDays(90)
    setMaxLossPercent(100)
  }

  const handleCloseModal = () => {
    setShowSuccessModal(false)
    router.push('/commitments')
  }

  const handleViewOnExplorer = () => {
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${commitmentId}`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <>
      {step === 1 && (
        <CreateCommitmentStepSelectType
          selectedType={selectedType}
          onSelectType={handleSelectType}
          onNext={handleStepNext}
          onBack={handleBack}
        />
      )}

      {step === 2 && (
        <main id="main-content" className={styles.container}>
          {/* Header */}
          <header className={styles.header}>
            <Link href="/" className={styles.backLink} aria-label="Back to Home">
              ← Back
            </Link>
            <h1 className={styles.pageTitle}>Create Commitment</h1>
            <p className={styles.pageSubtitle}>
              Define your liquidity commitment with explicit rules and guarantees
            </p>
          </header>

          {/* Stepper */}
          <nav className={styles.stepper} aria-label="Progress">
            <div className={styles.stepperTrack}>
              {/* Step 1 */}
              <div className={`${styles.step} ${styles.completed}`}>
                <div className={styles.stepCircle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className={styles.stepLabel}>Select Type</span>
              </div>

              {/* Connector */}
              <div className={`${styles.stepConnector} ${currentStep > 1 ? styles.completedConnector : ''}`} />

              {/* Step 2 */}
              <div className={`${styles.step} ${styles.active}`}>
                <div className={styles.stepCircle}>2</div>
                <span className={styles.stepLabel}>Configure</span>
              </div>

              {/* Connector */}
              <div className={`${styles.stepConnector}`} />

              {/* Step 3 */}
              <div className={`${styles.step}`}>
                <div className={styles.stepCircle}>3</div>
                <span className={styles.stepLabel}>Review</span>
              </div>
            </div>
          </nav>

          <CreateCommitmentStepConfigure
            amount={amount}
            asset={asset}
            availableBalance={availableBalance}
            durationDays={durationDays}
            maxLossPercent={maxLossPercent}
            earlyExitPenalty={earlyExitPenalty}
            estimatedFees={estimatedFees}
            isValid={isStep2Valid}
            onChangeAmount={setAmount}
            onChangeAsset={setAsset}
            onChangeDuration={setDurationDays}
            onChangeMaxLoss={setMaxLossPercent}
            onBack={handleBack}
            onNext={handleNext}
            amountError={amountError}
            maxLossWarning={maxLossWarning}
          />
        </main>
      )}

      {step === 3 && selectedType && (
        <>
          <CreateCommitmentStepReview
            {...getMockData()}
            isSubmitting={isSubmitting}
            onBack={handleBack}
            onSubmit={handleSubmit}
          />
          
          <CommitmentCreatedModal
            isOpen={showSuccessModal}
            commitmentId={commitmentId}
            onViewCommitment={handleViewCommitment}
            onCreateAnother={handleCreateAnother}
            onClose={handleCloseModal}
            onViewOnExplorer={handleViewOnExplorer}
          />
        </>
      )}
    </>
  )
}
