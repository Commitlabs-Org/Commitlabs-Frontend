'use client'

import { useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect } from 'react'
import MyCommitmentsHeader from '@/components/MyCommitmentsHeader'
import MyCommitmentsStats from '@/components/MyCommitmentsStats/MyCommitmentsStats'
import MyCommitmentsFilters from '@/components/MyCommitmentsFilters/MyCommitmentsFilters'
import MyCommitmentsGrid from '@/components/MyCommitmentsGrid'
import MyCommitmentsGridSkeleton from '@/components/MyCommitmentsGridSkeleton'
import CommitmentEarlyExitModal from '@/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal'
import ExportCommitmentsModal from '@/components/export/ExportCommitmentsModal'
import { useToast } from '@/components/toast/ToastProvider'
import { useWallet } from '@/hooks/useWallet'
import { Commitment, CommitmentStats } from '@/types/commitment'
import { listCommitments } from '@/lib/backend/mocks/contracts'
import { fetchProtocolConstants, ProtocolConstants } from '@/utils/protocol'

const mockCommitments: Commitment[] = [
  {
    id: 'CMT-ABC123',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '50,000',
    currentValue: '52,600',
    changePercent: 5.2,
    durationProgress: 75,
    daysRemaining: 15,
    complianceScore: 95,
    maxLoss: '2%',
    currentDrawdown: '0.8%',
    createdDate: 'Jan 10, 2026',
    expiryDate: 'Feb 9, 2026',
  },
  {
    id: 'CMT-XYZ789',
    type: 'Balanced',
    status: 'Active',
    asset: 'USDC',
    amount: '100,000',
    currentValue: '112,500',
    changePercent: 12.5,
    durationProgress: 30,
    daysRemaining: 42,
    complianceScore: 88,
    maxLoss: '8%',
    currentDrawdown: '3.2%',
    createdDate: 'Dec 15, 2025',
    expiryDate: 'Feb 13, 2026',
  },
  {
    id: 'CMT-DEF456',
    type: 'Aggressive',
    status: 'Active',
    asset: 'XLM',
    amount: '250,000',
    currentValue: '296,750',
    changePercent: 18.7,
    durationProgress: 17,
    daysRemaining: 75,
    complianceScore: 76,
    maxLoss: 'No limit',
    currentDrawdown: '12.5%',
    createdDate: 'Nov 20, 2025',
    expiryDate: 'Feb 10, 2026',
  },
  {
    id: 'CMT-GHI012',
    type: 'Safe',
    status: 'Settled',
    asset: 'XLM',
    amount: '75,000',
    currentValue: '78,750',
    changePercent: 5.0,
    durationProgress: 100,
    daysRemaining: 0,
    complianceScore: 97,
    maxLoss: '2%',
    currentDrawdown: '0%',
    createdDate: 'Dec 1, 2025',
    expiryDate: 'Dec 31, 2025',
  },
  {
    id: 'CMT-JKL345',
    type: 'Balanced',
    status: 'Early Exit',
    asset: 'USDC',
    amount: '150,000',
    currentValue: '145,500',
    changePercent: -3.0,
    durationProgress: 100,
    daysRemaining: 0,
    complianceScore: 72,
    maxLoss: '8%',
    currentDrawdown: '3%',
    createdDate: 'Nov 1, 2025',
    expiryDate: 'Dec 30, 2025',
  },
  {
    id: 'CMT-MN0678',
    type: 'Aggressive',
    status: 'Violated',
    asset: 'XLM',
    amount: '200,000',
    currentValue: '160,000',
    changePercent: -20.0,
    durationProgress: 100,
    daysRemaining: 0,
    complianceScore: 45,
    maxLoss: 'No limit',
    currentDrawdown: '20%',
    createdDate: 'Oct 15, 2025',
    expiryDate: 'Jan 13, 2026',
  },
]

const mockStats: CommitmentStats = {
  totalActive: 3,
  totalCommittedValue: '$461,850',
  avgComplianceScore: 86,
  totalFeesGenerated: '$1,250',
}

function getEarlyExitValues(originalAmount: string, asset: string, penaltyPercent: number) {
  const amount = Number(originalAmount.replace(/,/g, ''))
  const penaltyAmount = (amount * (penaltyPercent / 100)).toFixed(0)
  const netReceive = (amount - Number(penaltyAmount)).toFixed(0)
  return {
    penaltyPercent: `${penaltyPercent}%`,
    penaltyAmount: `${Number(penaltyAmount).toLocaleString()} ${asset}`,
    netReceiveAmount: `${Number(netReceive).toLocaleString()} ${asset}`,
  }
}

export default function MyCommitments() {
  const router = useRouter()
  const toast = useToast()
  const { address } = useWallet()

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Newest')

  const [earlyExitCommitmentId, setEarlyExitCommitmentId] = useState<string | null>(null)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [hasAcknowledged, setHasAcknowledged] = useState(false)
  const [commitmentsList, setCommitmentsList] = useState<Commitment[]>(mockCommitments)
  const [isLoading, setIsLoading] = useState(true)
  const [protocolConstants, setProtocolConstants] = useState<ProtocolConstants | null>(null)
  const [, setIsLoadingConstants] = useState(true)

  useEffect(() => {
    fetchProtocolConstants()
      .then(setProtocolConstants)
      .catch((err) => console.error('Failed to fetch protocol constants:', err))
      .finally(() => setIsLoadingConstants(false))
  }, [])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
      setIsLoading(true)
      listCommitments()
        .then(setCommitmentsList)
        .finally(() => setIsLoading(false))
    } else {
      // Simulate loading for demo purposes
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  // Derived State
  const filteredCommitments = useMemo(() => {
    const filtered = commitmentsList.filter((c) => {
      const matchesSearch = c.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'All' || c.status.toLowerCase() === statusFilter.toLowerCase()
      const matchesType = typeFilter === 'All' || c.type.toLowerCase() === typeFilter.toLowerCase()
      return matchesSearch && matchesStatus && matchesType
    })

    // Basic Sorting Logic
    if (sortBy === 'ValueHighLow') {
      filtered.sort((a, b) => Number(b.amount.replace(/,/g, '')) - Number(a.amount.replace(/,/g, '')))
    } else if (sortBy === 'ValueLowHigh') {
      filtered.sort((a, b) => Number(a.amount.replace(/,/g, '')) - Number(b.amount.replace(/,/g, '')))
    } else if (sortBy === 'Newest') {
      filtered.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
    } else if (sortBy === 'Oldest') {
      filtered.sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime())
    }

    return filtered
  }, [commitmentsList, searchQuery, statusFilter, typeFilter, sortBy])

  const commitmentForEarlyExit = commitmentsList.find((c) => c.id === earlyExitCommitmentId)
  const earlyExitSummary = useMemo(() => {
    if (!commitmentForEarlyExit) return null

    let penaltyPercent = 10
    if (protocolConstants?.penalties) {
      const tier = protocolConstants.penalties.find(
        (p) => p.type.toLowerCase() === commitmentForEarlyExit.type.toLowerCase()
      )
      if (tier) {
        penaltyPercent = tier.earlyExitPenaltyPercent
      }
    } else {
      // Fallback local calculations in case loading or error
      const lowerType = commitmentForEarlyExit.type.toLowerCase()
      if (lowerType === 'safe') penaltyPercent = 2
      else if (lowerType === 'balanced') penaltyPercent = 3
      else if (lowerType === 'aggressive') penaltyPercent = 5
    }

    return getEarlyExitValues(
      commitmentForEarlyExit.amount,
      commitmentForEarlyExit.asset,
      penaltyPercent
    )
  }, [commitmentForEarlyExit, protocolConstants])

  // Callbacks
  const openEarlyExitModal = useCallback((id: string) => {
    setEarlyExitCommitmentId(id)
    setHasAcknowledged(false)
  }, [])

  // Stable callbacks so the memoized MyCommitmentCard only re-renders when its
  // own commitment changes, not on every filter/sort that re-runs this page.
  const handleViewDetails = useCallback(
    (id: string) => router.push(`/commitments/${id}`),
    [router]
  )

  const handleViewAttestations = useCallback(
    (id: string) => console.log('Attestations for', id),
    []
  )

  const closeEarlyExitModal = useCallback(() => {
    setEarlyExitCommitmentId(null)
    setHasAcknowledged(false)
  }, [])

  const handleConfirmEarlyExit = useCallback(() => {
    if (!earlyExitCommitmentId || !earlyExitSummary) return

    const committed = commitmentsList.find((c) => c.id === earlyExitCommitmentId)
    if (!committed) return

    setCommitmentsList((current) =>
      current.map((commitment) =>
        commitment.id === earlyExitCommitmentId
          ? { ...commitment, status: 'Early Exit' }
          : commitment
      )
    )

    toast.success({
      title: 'Early exit confirmed',
      description: `${committed.id} was moved to Early Exit. ${earlyExitSummary.penaltyPercent} penalty applied; you will receive ${earlyExitSummary.netReceiveAmount}.`,
      action: {
        label: 'Undo',
        onClick: () => {
          setCommitmentsList((current) =>
            current.map((commitment) =>
              commitment.id === committed.id
                ? { ...commitment, status: committed.status }
                : commitment
            )
          )
        },
      },
    })

    closeEarlyExitModal()
  }, [earlyExitCommitmentId, earlyExitSummary, commitmentsList, closeEarlyExitModal, toast])

  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <MyCommitmentsHeader
        onBack={() => router.push('/')}
        onCreateNew={() => router.push('/create')}
        onExport={() => setIsExportOpen(true)}
      />

      <div className="w-full flex-1 px-22 py-8 max-[1024px]:px-8 max-[640px]:px-4">
        {isLoading ? (
          <MyCommitmentsGridSkeleton
            showStats={true}
            showFilters={true}
            cardCount={6}
          />
        ) : (
          <>
            <MyCommitmentsStats
              totalActive={mockStats.totalActive}
              totalCommittedValue={mockStats.totalCommittedValue}
              avgComplianceScore={mockStats.avgComplianceScore}
              totalFeesGenerated={mockStats.totalFeesGenerated}
            />

            <MyCommitmentsFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              status={statusFilter}
              onStatusChange={setStatusFilter}
              type={typeFilter}
              onTypeChange={setTypeFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
            />

            <MyCommitmentsGrid
              commitments={filteredCommitments}
              onDetails={handleViewDetails}
              onAttestations={handleViewAttestations}
              onEarlyExit={openEarlyExitModal}
            />
          </>
        )}
      </div>

      {commitmentForEarlyExit && earlyExitSummary && (
        <CommitmentEarlyExitModal
          isOpen={true}
          commitmentId={commitmentForEarlyExit.id}
          originalAmount={`${commitmentForEarlyExit.amount} ${commitmentForEarlyExit.asset}`}
          penaltyPercent={earlyExitSummary.penaltyPercent}
          penaltyAmount={earlyExitSummary.penaltyAmount}
          netReceiveAmount={earlyExitSummary.netReceiveAmount}
          hasAcknowledged={hasAcknowledged}
          onChangeAcknowledged={setHasAcknowledged}
          onCancel={closeEarlyExitModal}
          onConfirm={handleConfirmEarlyExit}
          onClose={closeEarlyExitModal}
        />
      )}

      <ExportCommitmentsModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        ownerAddress={address}
      />
    </main>
  )
}
