'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import CreateCommitmentStepSelectType from '@/components/CreateCommitmentStepSelectType'
import CreateCommitmentStepConfigure from '@/components/CreateCommitmentStepConfigure'
import CreateCommitmentStepReview from '@/components/CreateCommitmentStepReview'
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
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<CommitmentType | null>(null)
  const [commitmentType, setCommitmentType] = useState<CommitmentType>('balanced')
  const [amount, setAmount] = useState<string>('')
  const [asset, setAsset] = useState<string>('XLM')
  const [durationDays, setDurationDays] = useState<number>(90)
  const [maxLossPercent, setMaxLossPercent] = useState<number>(100)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [commitmentId, setCommitmentId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
  const availableBalance = 10000

  // Derived values
  const earlyExitPenalty = useMemo(() => {
    const penalty = commitmentType === 'aggressive' ? 5 : commitmentType === 'balanced' ? 3 : 2
    return `${((Number(amount) || 0) * penalty) / 100} ${asset}`
  }, [amount, asset, commitmentType])

  const estimatedFees = useMemo(() => `0.00 ${asset}`, [asset])

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

  // Step Handlers
  const handleSelectType = (type: CommitmentType) => {
    setSelectedType(type)
    setCommitmentType(type)
  }

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1)
    }
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

  const handleSubmit = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      const newCommitmentId = generateCommitmentId()
      setCommitmentId(newCommitmentId)
      setShowSuccessModal(true)
    }, 2000)
  }

  const handleViewCommitment = () => {
    const numericId = commitmentId.split('-')[1] || '1'
    router.push(`/commitments/${numericId}`)
  }

  const handleCreateAnother = () => {
    setShowSuccessModal(false)
    setSelectedType(null)
    setStep(1)
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


  return (
    <>
      {step === 1 && (
        <CreateCommitmentStepSelectType
          selectedType={selectedType}
          onSelectType={handleSelectType}
          onNext={handleNextStep}
          onBack={handleBack}
        />
      )}

      {step === 2 && (
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
          onNext={handleNextStep}
          amountError={amountError}
          maxLossWarning={maxLossWarning}
        />
      )}

      {step === 3 && selectedType && (
        <>
          <CreateCommitmentStepReview
            {...getReviewData()}
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
