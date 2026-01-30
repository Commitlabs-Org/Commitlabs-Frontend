'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CreateCommitmentStepSelectType from '@/components/CreateCommitmentStepSelectType'
import CommitmentCreatedModal from '@/components/modals/Commitmentcreatedmodal';

// Generate a random commitment ID (in production, this comes from the blockchain)
function generateCommitmentId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'CMT-';
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default function CreateCommitment() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<'safe' | 'balanced' | 'aggressive' | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [commitmentId, setCommitmentId] = useState('');

  const handleSelectType = (type: 'safe' | 'balanced' | 'aggressive') => {
    setSelectedType(type);
  };

  const handleNext = (type: 'safe' | 'balanced' | 'aggressive') => {
    // For now, simulate successful commitment creation
    // In production, this would go through steps 2 & 3, then create on blockchain
    console.log('Selected commitment type:', type);

    // Simulate transaction success
    setTimeout(() => {
      const newCommitmentId = generateCommitmentId();
      setCommitmentId(newCommitmentId);
      setShowSuccessModal(true);
    }, 500);

    // In a real implementation:
    // setStep(2) → Configure
    // setStep(3) → Review
    // Then create commitment → Show modal on success
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.push('/');
    }
  };

  const handleViewCommitment = () => {
    // Extract numeric ID from CMT-XXX format
    // In production, use the actual commitment ID from blockchain
    const numericId = commitmentId.split('-')[1] || '1';
    router.push(`/commitments/${numericId}`);
  };

  const handleCreateAnother = () => {
    setShowSuccessModal(false);
    setSelectedType(null);
    setStep(1);
    setCommitmentId('');
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    router.push('/commitments');
  };

  const handleViewOnExplorer = () => {
    // In production, use actual transaction hash
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${commitmentId}`;
    window.open(explorerUrl, '_blank');
  };

  // Render Step 1 - Select Type
  if (step === 1) {
    return (
      <>
        <CreateCommitmentStepSelectType
          selectedType={selectedType}
          onSelectType={handleSelectType}
          onNext={handleNext}
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
    );
  }

  // Future steps would be rendered here
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Step {step}</h1>
        <p className="text-gray-400 mb-8">Future steps will be implemented here</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}