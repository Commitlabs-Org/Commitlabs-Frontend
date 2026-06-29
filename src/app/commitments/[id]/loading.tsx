import {
  CommitmentCardSkeleton,
  CommitmentStatsSkeleton,
  HealthChartSkeleton,
} from '@/components/Skeleton';

/**
 * Route-level loading boundary for the commitment detail segment.
 * Nested under /commitments, this boundary takes precedence for /commitments/[id].
 */
export default function Loading() {
  return (
    <div
      className="px-6 py-8 max-w-5xl mx-auto flex flex-col gap-8"
      role="status"
      aria-label="Loading commitment"
    >
      <CommitmentStatsSkeleton />
      <HealthChartSkeleton />
      <CommitmentCardSkeleton />
    </div>
  );
}
