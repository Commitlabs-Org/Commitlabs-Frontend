'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './MyCommitmentsFilters.module.css';
import { clsx } from 'clsx';
import { SortOption } from '@/utils/sortCommitments';

interface SortMenuProps {
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
}

const SortMenu: React.FC<SortMenuProps> = ({ sortBy, onSortByChange }) => {
  const options: { value: SortOption; label: string }[] = [
    { value: 'Newest', label: 'Sort: Newest' },
    { value: 'Oldest', label: 'Oldest' },
    { value: 'ValueHighLow', label: 'Value: High to Low' },
    { value: 'ValueLowHigh', label: 'Value: Low to High' },
    { value: 'MaturitySoonest', label: 'Maturity: Soonest' },
    { value: 'MaturityLatest', label: 'Maturity: Latest' },
    { value: 'ComplianceHighLow', label: 'Compliance: High to Low' },
    { value: 'ComplianceLowHigh', label: 'Compliance: Low to High' },
    { value: 'YieldHighLow', label: 'Yield: High to Low' },
    { value: 'YieldLowHigh', label: 'Yield: Low to High' },
  ];

  return (
    <div className={styles.selectWrapper}>
      <select
        className={clsx(styles.select, sortBy && styles.selectActive)}
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SortOption)}
        aria-label="Sort commitments"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.chevronIcon} size={16} />
    </div>
  );
};

export default SortMenu;
