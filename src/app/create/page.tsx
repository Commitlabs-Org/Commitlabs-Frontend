'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import CreateCommitmentStepSelectType from '@/components/CreateCommitmentStepSelectType'
import CreateCommitmentStepConfigure from '@/components/CreateCommitmentStepConfigure'
import CommitmentCreatedModal from '@/components/modals/Commitmentcreatedmodal'

type CommitmentType = 'safe' | 'balanced' | 'aggressive'
type Step = 1 | 2 | 3

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
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [commitmentType, setCommitmentType] = useState<CommitmentType>('balanced')
  const [selectedType, setSelectedType] = useState<'safe' | 'balanced' | 'aggressive' | null>(null)
  const [amount, setAmount] = useState<string>('')
  const [asset, setAsset] = useState<string>('XLM')
  const [durationDays, setDurationDays] = useState<number>(90)
  const [maxLossPercent, setMaxLossPercent] = useState<number>(100)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [commitmentId, setCommitmentId] = useState('')

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

  const handleStepNext = (type: 'safe' | 'balanced' | 'aggressive') => {
    console.log('Selected commitment type:', type)
    setCurrentStep(2)
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    } else {
      router.push('/')
    }
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as Step)
    }
  }

  const handleSubmit = () => {
    console.log('Creating commitment:', {
      type: commitmentType,
      amount,
      asset,
      durationDays,
      maxLossPercent,
    })

    // Simulate transaction success
    setTimeout(() => {
      const newCommitmentId = generateCommitmentId()
      setCommitmentId(newCommitmentId)
      setShowSuccessModal(true)
    }, 500)
  }

  const handleViewCommitment = () => {
    const numericId = commitmentId.split('-')[1] || '1'
    router.push(`/commitments/${numericId}`)
  }

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
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${commitmentId}`
    window.open(explorerUrl, '_blank')
  }

  // Render Step 1 - Select Type using upstream component
  if (currentStep === 1) {
    return (
      <>
        <CreateCommitmentStepSelectType
          selectedType={selectedType}
          onSelectType={handleSelectType}
          onNext={handleStepNext}
          onBack={handleBack}
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
    )
  }

  // Render Step 2 - Configure
  if (currentStep === 2) {
    return (
      <>
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

        <CommitmentCreatedModal
          isOpen={showSuccessModal}
          commitmentId={commitmentId}
          onViewCommitment={handleViewCommitment}
          onCreateAnother={handleCreateAnother}
          onClose={handleCloseModal}
          onViewOnExplorer={handleViewOnExplorer}
        />
      </>
    )
  }

  // Render Step 3 - Review & Confirm
  if (currentStep === 3) {
    return (
      <>
        <main id="main-content" className={styles.container}>
          <div className={styles.step3Content}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Review & Confirm</h2>
              <p className={styles.sectionSubtitle}>Review your commitment details before submitting</p>
            </div>
            <div className={styles.reviewSummary}>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Commitment Type</span>
                <span className={styles.reviewValue}>{commitmentType}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Amount</span>
                <span className={styles.reviewValue}>{amount} {asset}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Duration</span>
                <span className={styles.reviewValue}>{durationDays} days</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Maximum Loss</span>
                <span className={styles.reviewValue}>{maxLossPercent}%</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Early Exit Penalty</span>
                <span className={styles.reviewValue}>{earlyExitPenalty}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Estimated Fees</span>
                <span className={styles.reviewValue}>{estimatedFees}</span>
              </div>
            </div>
            <div className={styles.step3Actions}>
              <button
                type="button"
                className={styles.backButton}
                onClick={handleBack}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleSubmit}
              >
                Create Commitment
              </button>
            </div>
          </div>
        </main>

        <CommitmentCreatedModal
          isOpen={showSuccessModal}
          commitmentId={commitmentId}
          onViewCommitment={handleViewCommitment}
          onCreateAnother={handleCreateAnother}
          onClose={handleCloseModal}
          onViewOnExplorer={handleViewOnExplorer}
        />
      </>
    )
  }
}