import { MarketplaceGridSkeleton } from '@/components/MarketplaceGridSkeleton';

/**
 * Route-level loading boundary for the marketplace segment.
 * Streams a skeleton while the page is being rendered.
 */
export default function Loading() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <MarketplaceGridSkeleton />
    </div>
  );
}
