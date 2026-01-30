'use client';

import React from 'react';
import styles from './MyCommitmentsStats.module.css';
import { CommitmentStats } from '@/types/commitment';
import { ActivityIcon, DollarIcon, TargetIcon, FeesIcon } from './icons/StatsIcons';

interface MyCommitmentsStatsProps {
  stats: CommitmentStats;
}

const MyCommitmentsStats: React.FC<MyCommitmentsStatsProps> = ({ stats }) => {
  const statItems = [
    {
      label: 'Total Active Commitments',
      value: stats.totalActive,
      icon: ActivityIcon,
      colorClass: styles.statTeal,
    },
    {
      label: 'Total Committed Value',
      value: stats.totalCommittedValue,
      icon: DollarIcon,
      colorClass: styles.statGreen,
    },
    {
      label: 'Average Compliance Score',
      value: `${stats.avgComplianceScore}%`,
      icon: TargetIcon,
      colorClass: styles.statBlue,
    },
    {
      label: 'Total Fees Generated',
      value: stats.totalFeesGenerated,
      icon: FeesIcon,
      colorClass: styles.statPurple,
    },
  ];

  return (
    <div className={styles.statsGrid}>
      {statItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className={`${styles.statCard} ${item.colorClass}`}>
            <div className={styles.iconWrapper}>
              <Icon size={32} />
            </div>
            <div className={styles.statValue}>{item.value}</div>
            <div className={styles.statLabel}>{item.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default MyCommitmentsStats;
