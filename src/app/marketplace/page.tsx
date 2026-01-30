'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MarketplaceHeader } from '@/components/MarketplaceHeader/MarketplaceHeader'
import { MarketplaceGrid } from '@/components/MarketplaceGrid'
import { MarketplaceResultsLayout } from '@/components/MarketplaceResultsLayout'
import styles from './page.module.css'

const mockListings = [
  {
    id: '001',
    type: 'Safe' as const,
    score: 95,
    amount: '$50,000',
    duration: '25 days',
    yield: '5.2%',
    maxLoss: '2%',
    owner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    price: '$52,000',
    forSale: true,
  },
  {
    id: '002',
    type: 'Balanced' as const,
    score: 88,
    amount: '$100,000',
    duration: '45 days',
    yield: '12.5%',
    maxLoss: '8%',
    owner: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    price: '$105,000',
    forSale: true,
  },
  {
    id: '003',
    type: 'Aggressive' as const,
    score: 76,
    amount: '$250,000',
    duration: '80 days',
    yield: '18.7%',
    maxLoss: '100%',
    owner: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
    price: '$—',
    forSale: false,
  },
  {
    id: '004',
    type: 'Safe' as const,
    score: 92,
    amount: '$75,000',
    duration: '15 days',
    yield: '4.8%',
    maxLoss: '2%',
    owner: '0x8Db0A5a6C1b1e7c0E1f9c6bB1F2c4d9A1cB1974E',
    price: '$76,500',
    forSale: true,
  },
  {
    id: '005',
    type: 'Balanced' as const,
    score: 85,
    amount: '$150,000',
    duration: '55 days',
    yield: '11.3%',
    maxLoss: '8%',
    owner: '0x2546Bcd3bA7A84D2a0E1aE0e65E3cC88aE3c9f18',
    price: '$155,000',
    forSale: true,
  },
  {
    id: '006',
    type: 'Aggressive' as const,
    score: 72,
    amount: '$500,000',
    duration: '85 days',
    yield: '22.1%',
    maxLoss: '100%',
    owner: '0x5a4e5cE8F0bB6E67c48b6B6246b4a6b9D0a8eAEd',
    price: '$525,000',
    forSale: true,
  },
  {
    id: '007',
    type: 'Safe' as const,
    score: 97,
    amount: '$30,000',
    duration: '20 days',
    yield: '5.5%',
    maxLoss: '2%',
    owner: '0xfB69B7c7A6b9C4d859E1f1b29A8b8c5C9d359b0A',
    price: '$—',
    forSale: false,
  },
  {
    id: '008',
    type: 'Balanced' as const,
    score: 90,
    amount: '$200,000',
    duration: '60 days',
    yield: '13.2%',
    maxLoss: '8%',
    owner: '0x71C79eD4a5F1b17e3c2d9a9c0A8bE2a3a97f6F2A',
    price: '$210,000',
    forSale: true,
  },
  {
    id: '009',
    type: 'Safe' as const,
    score: 88,
    amount: '$45,000',
    duration: '30 days',
    yield: '6.1%',
    maxLoss: '3%',
    owner: '0xC4b7a4B6c5d6e7F8a9B0c1D2e3f4A5b6C7D8e9F0',
    price: '$47,000',
    forSale: true,
  },
  {
    id: '010',
    type: 'Balanced' as const,
    score: 84,
    amount: '$120,000',
    duration: '35 days',
    yield: '10.4%',
    maxLoss: '7%',
    owner: '0x2f1bA9C6d4e8F7b5C3a1D9e0F1a2b3C4d5E6F7A8',
    price: '$124,500',
    forSale: true,
  },
  {
    id: '011',
    type: 'Aggressive' as const,
    score: 70,
    amount: '$320,000',
    duration: '90 days',
    yield: '24.5%',
    maxLoss: '100%',
    owner: '0xA7b6c5D4e3F2a1B0c9D8e7F6a5B4c3D2e1F0a9B8',
    price: '$339,000',
    forSale: true,
  },
  {
    id: '012',
    type: 'Safe' as const,
    score: 94,
    amount: '$60,000',
    duration: '28 days',
    yield: '5.9%',
    maxLoss: '2%',
    owner: '0x9B8a7C6d5E4f3A2b1C0d9E8f7A6b5C4d3E2f1A0B',
    price: '$61,200',
    forSale: true,
  },
  {
    id: '013',
    type: 'Balanced' as const,
    score: 81,
    amount: '$180,000',
    duration: '50 days',
    yield: '12.1%',
    maxLoss: '9%',
    owner: '0x4E3d2C1b0A9f8E7d6C5b4A3f2E1d0C9b8A7f6E5D',
    price: '$186,500',
    forSale: true,
  },
  {
    id: '014',
    type: 'Aggressive' as const,
    score: 78,
    amount: '$410,000',
    duration: '100 days',
    yield: '26.7%',
    maxLoss: '100%',
    owner: '0xF1e2D3c4B5a6C7d8E9f0A1b2C3d4E5f6A7b8C9d0',
    price: '$430,000',
    forSale: true,
  },
  {
    id: '015',
    type: 'Safe' as const,
    score: 91,
    amount: '$90,000',
    duration: '40 days',
    yield: '6.3%',
    maxLoss: '3%',
    owner: '0xB2c3D4e5F6a7B8c9D0e1F2a3B4c5D6e7F8a9B0c1',
    price: '$92,500',
    forSale: true,
  },
  {
    id: '016',
    type: 'Balanced' as const,
    score: 87,
    amount: '$140,000',
    duration: '48 days',
    yield: '11.8%',
    maxLoss: '8%',
    owner: '0xC1b0A9f8E7d6C5b4A3f2E1d0C9b8A7f6E5D4c3B2',
    price: '$144,900',
    forSale: true,
  },
  {
    id: '017',
    type: 'Aggressive' as const,
    score: 73,
    amount: '$520,000',
    duration: '110 days',
    yield: '28.4%',
    maxLoss: '100%',
    owner: '0xD3c4B5a6C7d8E9f0A1b2C3d4E5f6A7b8C9d0E1f2',
    price: '$548,000',
    forSale: true,
  },
  {
    id: '018',
    type: 'Safe' as const,
    score: 89,
    amount: '$55,000',
    duration: '22 days',
    yield: '5.4%',
    maxLoss: '2%',
    owner: '0xE5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2E3f4',
    price: '$56,100',
    forSale: true,
  },
]

function filterBySearch(
  items: typeof mockListings,
  query: string
): typeof mockListings {
  if (!query.trim()) return items
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    const searchable = [
      item.type,
      item.amount,
      item.duration,
      item.yield,
      item.price,
      item.owner,
    ].join(' ')
    return searchable.toLowerCase().includes(q)
  })
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9

  const filteredListings = useMemo(
    () => filterBySearch(mockListings, searchQuery),
    [searchQuery]
  )

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / itemsPerPage))
  const pagedListings = filteredListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handlePageChange = (page: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, page))
    setCurrentPage(nextPage)
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a]">
      <main id="main-content" className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backLink} aria-label="Back to Home">
            ← Back to Home
          </Link>
          <h1>Commitment Marketplace</h1>
          <p>Browse and trade Commitment NFTs</p>
        </header>

        <MarketplaceHeader onSearchChange={setSearchQuery} />

        <section className={styles.gridShell} aria-label="Marketplace listings">
          <MarketplaceResultsLayout
            totalCount={filteredListings.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          >
            <MarketplaceGrid items={pagedListings} />
          </MarketplaceResultsLayout>
        </section>
      </main>
    </div>
  )
}
