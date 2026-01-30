'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MarketplaceHeader } from '@/components/MarketplaceHeader/MarketplaceHeader'
import { MarketplaceGrid } from '@/components/MarketplaceGrid'
import { MarketplaceResultsLayout } from '@/components/MarketplaceResultsLayout'
import MarketplaceFilters from '@/components/MarketplaceFilter/MarketplaceFilters'

// Interfaces matching the components
interface Filters {
  sortBy: string
  commitmentType: ('balanced' | 'aggressive' | 'conservative')[]
  priceRange: [number, number]
  durationRange: [number, number]
  minCompliance: number
  maxLoss: number
}


// Listing type for marketplace items
interface Listing {
  id: string
  type: 'Safe' | 'Balanced' | 'Aggressive'
  score: number
  amount: string
  duration: string
  yield: string
  maxLoss: string
  owner: string
  price: string
  forSale: boolean
}


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
    type: 'Balanced' as const,
    score: 82,
    amount: '$120,000',
    duration: '40 days',
    yield: '10.5%',
    maxLoss: '5%',
    owner: '0x123...456',
    price: '$125,000',
    forSale: true,
  },
  {
    id: '010',
    type: 'Balanced' as const,
    score: 88,
    amount: '$180,000',
    duration: '50 days',
    yield: '11.8%',
    maxLoss: '7%',
    owner: '0xABC...DEF',
    price: '$188,000',
    forSale: true,
  },
  {
    id: '011',
    type: 'Balanced' as const,
    score: 84,
    amount: '$140,000',
    duration: '35 days',
    yield: '12.2%',
    maxLoss: '6%',
    owner: '0x789...012',
    price: '$145,000',
    forSale: true,
  },
  {
    id: '012',
    type: 'Balanced' as const,
    score: 91,
    amount: '$220,000',
    duration: '65 days',
    yield: '13.5%',
    maxLoss: '8%',
    owner: '0xDDD...EEE',
    price: '$230,000',
    forSale: true,
  },
  {
    id: '013',
    type: 'Balanced' as const,
    score: 86,
    amount: '$95,000',
    duration: '30 days',
    yield: '10.1%',
    maxLoss: '4%',
    owner: '0x555...666',
    price: '$98,000',
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

const filterTypeToCardType: Record<string, 'Safe' | 'Balanced' | 'Aggressive'> = {
  conservative: 'Safe',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
}

// Helper Components for List View
function ListTypeIcon({ type }: { type: 'Safe' | 'Balanced' | 'Aggressive' }) {
  if (type === 'Safe') {
    return (
      <svg width="20" height="20" viewBox="0 0 28 28" fill="none" className="text-[#05DF72]">
        <path d="M23.3292 15.164C23.3292 20.9962 19.2466 23.9124 14.3942 25.6037C14.1401 25.6898 13.8641 25.6857 13.6127 25.5921C8.74859 23.9124 4.66602 20.9962 4.66602 15.164V6.99884C4.66602 6.68948 4.78891 6.39279 5.00766 6.17404C5.22641 5.95529 5.5231 5.83239 5.83247 5.83239C8.16536 5.83239 11.0815 4.43265 13.1111 2.65965C13.3582 2.44852 13.6726 2.33252 13.9976 2.33252C14.3226 2.33252 14.637 2.44852 14.8841 2.65965C16.9254 4.44432 19.8299 5.83239 22.1628 5.83239C22.4721 5.83239 22.7688 5.95529 22.9876 6.17404C23.2063 6.39279 23.3292 6.68948 23.3292 6.99884V15.164Z" stroke="currentColor" strokeWidth="2.3329" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (type === 'Balanced') {
    return (
      <svg width="20" height="20" viewBox="0 0 28 28" fill="none" className="text-[#51A2FF]">
        <path d="M25.662 8.16504L15.7472 18.0799L9.91493 12.2476L2.33301 19.8295" stroke="currentColor" strokeWidth="2.3329" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.6631 8.16504H25.6618V15.1637" stroke="currentColor" strokeWidth="2.3329" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none" className="text-[#FF8904]">
      <path d="M9.91461 16.9137C10.688 16.9137 11.4297 16.6064 11.9766 16.0596C12.5235 15.5127 12.8307 14.771 12.8307 13.9976C12.8307 12.3879 12.2475 11.6647 11.6643 10.4982C10.4138 7.99851 11.403 5.76942 13.9972 3.49951C14.5804 6.41564 16.3301 9.21512 18.663 11.0814C20.9959 12.9478 22.1623 15.164 22.1623 17.4969C22.1623 18.5692 21.9511 19.6309 21.5408 20.6216C21.1305 21.6122 20.529 22.5123 19.7708 23.2705C19.0126 24.0287 18.1125 24.6302 17.1218 25.0405C16.1312 25.4509 15.0694 25.6621 13.9972 25.6621C12.9249 25.6621 11.8632 25.4509 10.8725 25.0405C9.88187 24.6302 8.98175 24.0287 8.22355 23.2705C7.46534 22.5123 6.8639 21.6122 6.45357 20.6216C6.04323 19.6309 5.83203 18.5692 5.83203 17.4969C5.83203 16.152 6.3371 14.8211 6.99848 13.9976C6.99848 14.771 7.30571 15.5127 7.85259 16.0596C8.39947 16.6064 9.1412 16.9137 9.91461 16.9137Z" stroke="currentColor" strokeWidth="2.3329" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MarketplaceRow({ item }: { item: Listing }) {
  const badgeClass =
    item.type === "Safe"
      ? "bg-[#0f2a1d] text-[#00C950]"
      : item.type === "Balanced"
        ? "bg-[#122238] text-[#51A2FF]"
        : "bg-[#2b1c10] text-[#FF8904]"

  const scoreColorClass =
    item.type === "Safe"
      ? "text-[#00C950]"
      : item.type === "Balanced"
        ? "text-[#51A2FF]"
        : "text-[#FF8904]"

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-2xl border border-white/10 bg-[#0A0A0A]/90 p-6 sm:p-5 transition-all hover:border-white/20 hover:bg-white/5">
      {/* Icon & ID */}
      <div className="flex items-center gap-4 min-w-[150px]">
        <div className="grid h-12 w-12 sm:h-10 sm:w-10 place-items-center rounded-lg border border-white/20 bg-white/5">
          <ListTypeIcon type={item.type} />
        </div>
        <div>
          <div className={`inline-flex rounded-full px-2.5 py-1 sm:py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
            {item.type}
          </div>
          <div className="font-mono text-sm text-white/50 mt-1 sm:mt-0">#CMT-{item.id.padStart(3, '0')}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:items-center gap-6 sm:gap-4 flex-1">
        {/* Compliance */}
        <div className="flex flex-col min-w-[80px]">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Compliance</span>
          <span className={`text-lg font-bold ${scoreColorClass}`}>{item.score}%</span>
        </div>

        {/* Amount */}
        <div className="flex flex-col min-w-[100px]">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Amount</span>
          <span className="text-lg font-semibold">{item.amount}</span>
        </div>

        {/* Duration */}
        <div className="flex flex-col min-w-[80px]">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Duration</span>
          <span className="text-lg font-semibold">{item.duration}</span>
        </div>

        {/* Yield */}
        <div className="flex flex-col min-w-[60px]">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Yield</span>
          <span className="text-lg font-bold text-[#0FF0FC]">{item.yield}</span>
        </div>

        {/* Price */}
        <div className="flex flex-col min-w-[120px] col-span-2 sm:col-span-1">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Price</span>
          <span className="text-lg font-bold">
            {item.forSale ? item.price : <span className="text-white/30 text-base font-normal">Not for sale</span>}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 sm:pt-0 border-t border-white/5 sm:border-0">
        <Link
          href={`/commitments?id=${item.id}`}
          className="flex-1 sm:flex-none text-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 sm:px-4 sm:py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
        >
          Details
        </Link>
        {item.forSale && (
          <Link
            href={`/marketplace/trade?id=${item.id}`}
            className="flex-1 sm:flex-none text-center rounded-xl border border-[#0FF0FC]/40 bg-[#0FF0FC]/10 px-6 py-3.5 sm:px-4 sm:py-2.5 text-sm font-bold text-[#0FF0FC] transition-colors hover:bg-[#0FF0FC]/20"
          >
            Trade
          </Link>
        )}
      </div>
    </div>
  )
}

function MarketplaceListView({ items }: { items: Listing[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-4 mt-6">
      {items.map((item) => (
        <MarketplaceRow key={item.id} item={item} />
      ))}
    </div>
  )
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    sortBy: 'price',
    commitmentType: ['balanced'],
    priceRange: [0, 1000000],
    durationRange: [0, 90],
    minCompliance: 0,
    maxLoss: 100,
  })

  // ... rest of the logic
  const itemsPerPage = 9

  const filteredListings = useMemo(() => {
    return mockListings.filter((item) => {
      if (searchQuery && !item.id.includes(searchQuery) && !item.owner.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      const allowedCardTypes = filters.commitmentType.map(t => filterTypeToCardType[t]);
      if (allowedCardTypes.length > 0 && !allowedCardTypes.includes(item.type)) {
        return false
      }

      const numericPrice = parseInt(item.price.replace(/[$,—]/g, '')) || 0
      if (item.forSale && (numericPrice < filters.priceRange[0] || numericPrice > filters.priceRange[1])) {
        return false
      }

      const numericDuration = parseInt(item.duration) || 0
      if (numericDuration < filters.durationRange[0] || numericDuration > filters.durationRange[1]) {
        return false
      }

      if (item.score < filters.minCompliance) {
        return false
      }

      const numericMaxLoss = parseInt(item.maxLoss) || 0
      if (numericMaxLoss > filters.maxLoss) {
        return false
      }

      return true
    }).sort((a, b) => {
      const priceA = parseInt(a.price.replace(/[$,—]/g, '')) || 0
      const priceB = parseInt(b.price.replace(/[$,—]/g, '')) || 0

      switch (filters.sortBy) {
        case 'price': return priceA - priceB
        case 'price-desc': return priceB - priceA
        case 'compliance': return b.score - a.score
        case 'duration': return parseInt(a.duration) - parseInt(b.duration)
        case 'newest': return parseInt(b.id) - parseInt(a.id)
        default: return 0
      }
    })
  }, [filters, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / itemsPerPage))
  const pagedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredListings.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredListings, currentPage])

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)))
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white overflow-x-hidden">
      <main id="main-content" className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-24 md:pt-32 pb-10 relative">
        <MarketplaceHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Mobile Filter Toggle */}
        <div className="md:hidden mb-6">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors active:scale-[0.98]"
          >
            <span className="text-base font-semibold">{showMobileFilters ? 'Hide Filters' : 'Show Filters'}</span>
          </button>
        </div>

        {/* Main Content: Two Columns */}
        <div className="flex flex-col gap-6 md:flex-row items-start">
          {/* Sidebar Filters */}
          <aside className={`
            md:w-[280px] lg:w-[320px] md:shrink-0 md:sticky md:top-[120px] 
            md:max-h-[calc(100vh-140px)] md:overflow-y-auto custom-scrollbar
            ${showMobileFilters ? 'block' : 'hidden md:block'}
            w-full
          `}>
            <MarketplaceFilters
              filters={filters}
              onFilterChange={(f) => handleFilterChange(f as Filters)}
            />
          </aside>

          {/* Results Area */}
          <div className="flex-1 min-w-0 w-full">
            <MarketplaceResultsLayout
              totalCount={filteredListings.length}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            >
              {viewMode === 'grid' ? (
                <MarketplaceGrid items={pagedListings} />
              ) : (
                <MarketplaceListView items={pagedListings} />
              )}
            </MarketplaceResultsLayout>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}