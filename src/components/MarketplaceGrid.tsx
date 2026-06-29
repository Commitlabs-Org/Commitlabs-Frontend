import type { MarketplaceCardProps } from './MarketplaceCard'
import { MarketplaceCard } from './MarketplaceCard'
import { EmptyState } from '@/components/ui/EmptyState'

export interface MarketplaceGridProps {
  items: MarketplaceCardProps[]
  isComparePinned?: (id: string) => boolean
  isCompareFull?: boolean
  onCompareToggle?: (listing: MarketplaceCardProps) => void
}

export function MarketplaceGrid({
  items,
  isComparePinned,
  isCompareFull = false,
  onCompareToggle,
}: MarketplaceGridProps) {
  if (!items || items.length === 0) {
    return (
      <section className="mt-10" aria-label="Marketplace listings">
        <EmptyState
          title="No commitments available"
          description="New offers will appear here once they are listed."
          className="rounded-[20px] px-6 border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_65%),rgba(0,0,0,0.45)] shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        />
      </section>
    )
  }

  return (
    <section className="mt-6" aria-label="Marketplace listings">
      <ul className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1">
        {items.map((item) => {
          const compareSelected = isComparePinned?.(item.id) ?? false
          return (
            <li key={item.id} className="min-h-[280px]">
              <MarketplaceCard
                {...item}
                compareSelected={compareSelected}
                compareDisabled={isCompareFull && !compareSelected}
                onCompareToggle={
                  onCompareToggle ? () => onCompareToggle(item) : undefined
                }
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

