import React from 'react';
import styles from './MyCommitmentCard.module.css';
import { Commitment } from '@/types/commitment';
import Link from 'next/link';
import { 
  SafeIcon, 
  BalancedIcon, 
  AggressiveIcon, 
  EyeIcon, 
  FileTextIcon, 
  AlertIcon 
} from './icons/CommitmentIcons';
import { TrendingUp as Increase, TrendingDown as Decrease } from 'lucide-react';

interface MyCommitmentCardProps {
  commitment: Commitment;
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
}

const MyCommitmentCard: React.FC<MyCommitmentCardProps> = ({
  commitment,
  onDetails,
  onAttestations,
  onEarlyExit,
}) => {
  const {
    id,
    type,
    status,
    asset,
    amount,
    currentValue,
    changePercent,
    durationProgress,
    daysRemaining,
    complianceScore,
    maxLoss,
    currentDrawdown,
    createdDate,
    expiryDate,
  } = commitment;

  const TypeIcon = type === 'Safe' ? SafeIcon : type === 'Balanced' ? BalancedIcon : AggressiveIcon;
  const typeClass = styles[`type${type}`];
  const statusClass = styles[`status${status.replace(' ', '')}`];
  const isPositive = changePercent >= 0;

  // Dynamic colors
  const durationColorClass = styles[`duration${type}`];
  
  let complianceColorClass = styles.complianceHigh;
  if (status === 'Violated') {
    complianceColorClass = styles.complianceViolated;
  } else if (complianceScore < 70) {
    complianceColorClass = styles.complianceLow;
  } else if (complianceScore < 85) {
    complianceColorClass = styles.complianceMedium;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={`${styles.typeBadge} ${typeClass}`}>
          <TypeIcon size={14} />
          <span>{type}</span>
        </div>
        <div className={`${styles.statusBadge} ${statusClass}`}>
          {status}
        </div>
      </div>

      <div className={styles.idArea}>
        <Link href={`/commitments/${id}`} className={styles.commitmentId}>
          {id}
        </Link>
      </div>

      <div className={styles.amountArea}>
        <div className={styles.amountValue}>
          {amount} <span className={styles.asset}>{asset}</span>
        </div>
        <div className={styles.currentValueRow}>
          <span className={styles.label}>Current Value:</span>
          <span style={{ fontWeight: 600 }}>{currentValue} {asset}</span>
          <span className={isPositive ? styles.changePositive : styles.changeNegative} style={{ fontWeight: 600 }}>
            {isPositive ? <Increase size={12} style={{ display: 'inline', marginRight: 4 }} /> : <Decrease size={12} style={{ display: 'inline', marginRight: 4 }} />}
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressBarGroup}>
          <div className={styles.progressHeader}>
            <span className={styles.label} style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration Progress</span>
            <span className={styles.label} style={{ color: '#fff', fontWeight: 500 }}>{daysRemaining} days left</span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={`${styles.progressFill} ${styles.durationFill} ${durationColorClass}`} 
              style={{ width: `${durationProgress}%` }}
            />
          </div>
          <span className={styles.label} style={{ fontSize: '10px', marginTop: '-4px' }}>{durationProgress}%</span>
        </div>

        <div className={styles.progressBarGroup}>
          <div className={styles.progressHeader}>
            <span className={styles.label} style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compliance Score</span>
            <span className={styles.label} style={{ color: '#fff', fontWeight: 600 }}>{complianceScore}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={`${styles.progressFill} ${styles.complianceFill} ${complianceColorClass}`} 
              style={{ width: `${complianceScore}%` }}
            />
          </div>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricMiniCard}>
          <span className={styles.miniLabel}>Max Loss</span>
          <span className={styles.miniValue}>{maxLoss}</span>
        </div>
        <div className={styles.metricMiniCard}>
          <span className={styles.miniLabel}>Current Drawdown</span>
          <span className={styles.miniValue}>{currentDrawdown}</span>
        </div>
      </div>

      <div className={styles.datesRow}>
        <div className={styles.dateItem}>
          <span className={styles.miniLabel}>Created</span>
          <span className={styles.label}>{createdDate}</span>
        </div>
        <div className={styles.dateItem} style={{ alignItems: 'flex-end' }}>
          <span className={styles.miniLabel}>Expires</span>
          <span className={styles.label}>{expiryDate}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.buttonRow}>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => onDetails?.(id)}
          >
            <EyeIcon size={16} /> Details
          </button>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => onAttestations?.(id)}
          >
            <FileTextIcon size={16} /> Attestations
          </button>
        </div>
        {status === 'Active' && (
          <button 
            className={`${styles.btn} ${styles.btnWarning}`}
            onClick={() => onEarlyExit?.(id)}
          >
            <AlertIcon size={16} /> Early Exit (Penalty Applies)
          </button>
        )}
      </div>
    </div>
  );
};

export default MyCommitmentCard;
