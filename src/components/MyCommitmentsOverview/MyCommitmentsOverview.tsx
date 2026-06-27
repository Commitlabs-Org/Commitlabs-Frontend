'use client';

import React from 'react';
import MyCommitmentsStats from '../MyCommitmentsStats/MyCommitmentsStats';
import MyCommitmentsFilters from '../MyCommitmentsFilters/MyCommitmentsFilters';
import { SortOption } from '@/utils/sortCommitments';

interface MyCommitmentsOverviewProps {
  stats: {
    totalActive: number;
    totalCommittedValue: string;
    averageComplianceScore: string;
    totalFeesGenerated: string;
  };
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
      <MyCommitmentsStats
        totalActive={stats.totalActive}
        totalCommittedValue={stats.totalCommittedValue}
        averageComplianceScore={stats.averageComplianceScore}
        totalFeesGenerated={stats.totalFeesGenerated}
      />
      <MyCommitmentsFilters
        searchQuery={search.searchQuery}
        onSearchChange={search.onSearchChange}
        status={filters.status}
        type={filters.type}
        sortBy={filters.sortBy}
        onStatusChange={filters.onStatusChange}
        onTypeChange={filters.onTypeChange}
        onSortByChange={filters.onSortByChange}
      />
    </div>
  );
};

export default MyCommitmentsOverview;
