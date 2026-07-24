import MyCommitmentsGridSkeleton from '@/components/MyCommitmentsGridSkeleton';

/**
 * Route-level loading boundary for the commitments list segment.
 * Streams a skeleton while the page is being rendered.
 */
export default function Loading() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <MyCommitmentsGridSkeleton />
    </div>
  );
}
