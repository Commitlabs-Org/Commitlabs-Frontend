import { render, screen } from '@testing-library/react';
import { Skeleton, CommitmentCardSkeleton, MarketplaceCardSkeleton, HealthChartSkeleton } from '@/components/Skeleton';
import HealthMetricsSkeleton from '@/components/HealthMetricsSkeleton';
import MarketplaceGridSkeleton from '@/components/MarketplaceGridSkeleton';
import MyCommitmentsGridSkeleton from '@/components/MyCommitmentsGridSkeleton';

describe('Skeleton components shimmer animation', () => {
  test('Base Skeleton includes animate-shimmer when shimmer enabled', () => {
    render(<Skeleton shimmer={true} />);
    const shimmerDiv = screen.getByRole('status').querySelector('.animate-shimmer');
    expect(shimmerDiv).toBeInTheDocument();
  });

  test('CommitmentCardSkeleton contains animate-shimmer', () => {
    render(<CommitmentCardSkeleton />);
    const shimmerDiv = screen.getByRole('status').querySelector('.animate-shimmer');
    expect(shimmerDiv).toBeInTheDocument();
  });

  test('MarketplaceCardSkeleton contains animate-shimmer', () => {
    render(<MarketplaceCardSkeleton />);
    const shimmerDiv = screen.getByRole('status').querySelector('.animate-shimmer');
    expect(shimmerDiv).toBeInTheDocument();
  });

  test('HealthChartSkeleton contains animate-shimmer', () => {
    render(<HealthChartSkeleton />);
    const shimmerDiv = screen.getByRole('status').querySelector('.animate-shimmer');
    expect(shimmerDiv).toBeInTheDocument();
  });

  test('HealthMetricsSkeleton contains shimmer via HealthChartSkeleton', () => {
    render(<HealthMetricsSkeleton />);
    const shimmerDiv = screen.getAllByRole('status')[0].querySelector('.animate-shimmer');
    expect(shimmerDiv).toBeInTheDocument();
  });

  test('MarketplaceGridSkeleton contains shimmer via MarketplaceCardSkeleton', () => {
    render(<MarketplaceGridSkeleton />);
    const shimmerDiv = screen.getAllByRole('status')[0].querySelector('.animate-shimmer');
    expect(shimmerDiv).toBeInTheDocument();
  });

  test('MyCommitmentsGridSkeleton contains shimmer via CommitmentCardSkeleton', () => {
    render(<MyCommitmentsGridSkeleton />);
    const shimmerDiv = screen.getAllByRole('status')[0].querySelector('.animate-shimmer');
    expect(shimmerDiv).toBeInTheDocument();
  });
});
