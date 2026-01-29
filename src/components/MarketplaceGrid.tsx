import type { MarketplaceCardProps } from './MarketplaceCard'
import { MarketplaceCard } from './MarketplaceCard'

export interface MarketplaceGridProps {
  items: MarketplaceCardProps[]
}

export function MarketplaceGrid({ items }: MarketplaceGridProps) {
  if (!items || items.length === 0) {
    return (
      <section className="mt-10" aria-label="Marketplace listings">
        <div className="rounded-[20px] px-6 py-8 text-center border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_65%),rgba(0,0,0,0.45)] shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <p className="text-[1.1rem] font-semibold mb-2">
            No commitments available
          </p>
          <p className="text-[0.95rem] text-white/70">
            New offers will appear here once they are listed.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-6" aria-label="Marketplace listings">
      <ul className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1">
        {items.map((item) => (
          <li key={item.id} className="min-h-[280px]">
            <MarketplaceCard {...item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

