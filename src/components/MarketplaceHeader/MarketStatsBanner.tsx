'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { KPICard } from '../KPICard';
import { apiGet } from '@/lib/apiClient';
import { AlertCircle } from 'lucide-react';
import styles from './MarketStatsBanner.module.css';

interface MarketplaceStats {
  activeListings: number;
  averageYield: number;
  medianPrice: number;
}

/**
 * MarketStatsBanner fetches and displays live marketplace context using KPICards.
 * Goal: orient buyers with market-wide context before they filter.
 */
export function MarketStatsBanner() {
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (cancelled: { value: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<MarketplaceStats>('/api/marketplace/stats');
      if (!cancelled.value) {
        setStats(data);
      }
    } catch (e) {
      if (!cancelled.value) {
        setError((e as Error).message || 'Failed to load stats');
      }
    } finally {
      if (!cancelled.value) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const cancelled = { value: false };
    fetchStats(cancelled);
    return () => {
      cancelled.value = true;
    };
  }, [fetchStats]);

  // Graceful error fallback
  if (error) {
    return (
      <div className={styles.root} role="alert" aria-live="polite">
        <div className={styles.errorContainer}>
          <AlertCircle size={16} aria-hidden />
          <span>Market stats unavailable.</span>
          <button 
            type="button"
            onClick={() => fetchStats({ value: false })}
            className={styles.retryButton}
            aria-label="Retry loading market stats"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading state leveraging KPICard skeleton
  if (isLoading) {
    return (
      <div className={styles.root} aria-busy="true" aria-label="Loading market stats">
        <KPICard label="Total Listings" state="loading" size="small" />
        <KPICard label="Average APY" state="loading" size="small" />
        <KPICard label="Median Price" state="loading" size="small" />
      </div>
    );
  }

  // Success state matching actual API fields
  return (
    <div className={styles.root} aria-live="polite" aria-label="Market statistics">
      <KPICard 
        label="Total Listings" 
        value={stats?.activeListings ?? 0} 
        format="count" 
        size="small" 
        variant="teal" 
      />
      <KPICard 
        label="Average APY" 
        value={stats?.averageYield ?? 0} 
        format="percentage" 
        size="small" 
        variant="blue" 
      />
      <KPICard 
        label="Median Price" 
        value={stats?.medianPrice ?? 0} 
        format="currency" 
        size="small" 
        variant="green" 
      />
    </div>
  );
}
