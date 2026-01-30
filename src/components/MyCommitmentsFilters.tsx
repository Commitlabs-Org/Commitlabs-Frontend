'use client';

import React from 'react';
import styles from './MyCommitmentsFilters.module.css';
import { SearchIcon, ChevronDownIcon } from './icons/FilterIcons';

interface MyCommitmentsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  typeFilter: string;
  onTypeChange: (type: string) => void;
}

const MyCommitmentsFilters: React.FC<MyCommitmentsFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
}) => {
  return (
    <div className={styles.filterContainer}>
      <div className={styles.searchWrapper}>
        <SearchIcon className={styles.searchIcon} size={20} />
        <input
          type="text"
          placeholder="Search by commitment ID..."
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className={styles.filtersRow}>
        <div className={styles.selectWrapper}>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="All"></option>
            <option value="Active">Active</option>
            <option value="Settled">Settled</option>
            <option value="Violated">Violated</option>
            <option value="Early Exit">Early Exit</option>
          </select>
          <ChevronDownIcon className={styles.chevronIcon} size={16} />
        </div>

        <div className={styles.selectWrapper}>
          <select
            className={styles.select}
            value={typeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="All"></option>
            <option value="Safe">Safe</option>
            <option value="Balanced">Balanced</option>
            <option value="Aggressive">Aggressive</option>
          </select>
          <ChevronDownIcon className={styles.chevronIcon} size={16} />
        </div>

        <div className={`${styles.selectWrapper} ${styles.selectWrapperExpand}`}>
          <select className={styles.select}>
            <option value="Any"></option>
            <option value="Short">Short Term (&lt; 30 days)</option>
            <option value="Medium">Medium Term (30-90 days)</option>
            <option value="Long">Long Term (&gt; 90 days)</option>
          </select>
          <ChevronDownIcon className={styles.chevronIcon} size={16} />
        </div>
      </div>
    </div>
  );
};

export default MyCommitmentsFilters;
