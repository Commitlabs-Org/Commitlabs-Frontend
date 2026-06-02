'use client';

import React from 'react';
import { TrendingUp, DollarSign, Award, Coins } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import type { CommitmentStats, StatTrend } from '@/types/commitment';
import type { KPIDelta } from '@/components/KPICard';
import styles from './MyCommitmentsStats.module.css';

function toDelta(trend?: StatTrend): KPIDelta | undefined {
  if (!trend) return undefined;
  return { value: trend.value, direction: trend.direction, period: trend.period };
}

interface MyCommitmentsStatsProps extends CommitmentStats {}

const MyCommitmentsStats: React.FC<MyCommitmentsStatsProps> = ({
  totalActive,
  totalCommittedValue,
  avgComplianceScore,
  totalFeesGenerated,
  trends,
}) => (
  <div className={styles.statsGrid} role="region" aria-label="Commitment statistics">
    <KPICard
      label="Total Active Commitments"
      value={totalActive}
      format="count"
      variant="teal"
      icon={TrendingUp}
      delta={toDelta(trends?.totalActive)}
    />
    <KPICard
      label="Total Committed Value"
      value={totalCommittedValue}
      format="currency"
      variant="green"
      icon={DollarSign}
      delta={toDelta(trends?.totalCommittedValue)}
    />
    <KPICard
      label="Average Compliance Score"
      value={avgComplianceScore}
      format="percentage"
      variant="blue"
      icon={Award}
      delta={toDelta(trends?.avgComplianceScore)}
    />
    <KPICard
      label="Total Fees Generated"
      value={totalFeesGenerated}
      format="currency"
      variant="purple"
      icon={Coins}
      delta={toDelta(trends?.totalFeesGenerated)}
    />
  </div>
);

export default MyCommitmentsStats;
