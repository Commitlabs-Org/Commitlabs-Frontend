'use client';

import React from 'react';
import MyCommitmentsStats from '../MyCommitmentsStats/MyCommitmentsStats';
import MyCommitmentsFilters from '../MyCommitmentsFilters/MyCommitmentsFilters';
import { SortOption } from '@/utils/sortCommitments';
import type { CommitmentStats } from '@/types/commitment';

interface MyCommitmentsOverviewProps {
  stats: CommitmentStats;
  search: {
    searchQuery: string;
    onSearchChange: (value: string) => void;
  };
  filters: {
    status: string;
    type: string;
    sortBy?: SortOption;
    onStatusChange: (value: string) => void;
    onTypeChange: (value: string) => void;
    onSortByChange?: (value: SortOption) => void;
  };
}

const MyCommitmentsOverview: React.FC<MyCommitmentsOverviewProps> = ({
  stats,
  search,
  filters,
}) => {
  return (
    <div style={{ width: '100%' }}>
      <MyCommitmentsStats {...stats} />
      <MyCommitmentsFilters
        searchQuery={search.searchQuery}
        onSearchChange={search.onSearchChange}
        status={filters.status}
        type={filters.type}
        onStatusChange={filters.onStatusChange}
        onTypeChange={filters.onTypeChange}
        {...(filters.sortBy !== undefined ? { sortBy: filters.sortBy } : {})}
        {...(filters.onSortByChange !== undefined ? { onSortByChange: filters.onSortByChange } : {})}
      />
    </div>
  );
};

export default MyCommitmentsOverview;
