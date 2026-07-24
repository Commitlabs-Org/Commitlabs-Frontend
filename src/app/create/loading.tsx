import { Skeleton } from '@/components/Skeleton';

/**
 * Route-level loading boundary for the create-commitment segment.
 * Streams a lightweight form skeleton while the page is being rendered.
 */
export default function Loading() {
  return (
    <div
      className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-6"
      role="status"
      aria-label="Loading create commitment"
    >
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
