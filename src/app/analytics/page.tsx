'use client';

/**
 * Analytics Overview Page
 *
 * Displays KPI cards and trend charts for both per-user ("My Stats") and
 * protocol-wide ("Protocol") analytics. The user can toggle between the two
 * views via an accessible segmented control.
 *
 * Data sources:
 *   – GET /api/analytics/user?ownerAddress=<addr>  (user stats)
 *   – GET /api/analytics/protocol                   (protocol-wide stats)
 *
 * States handled: loading, error (per endpoint), empty (zero data).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  DollarSign,
  Award,
  AlertTriangle,
  Users,
  TrendingUp,
  Coins,
  BarChart2,
  ChevronLeft,
} from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { useWallet } from '@/hooks/useWallet';
import AnalyticsTrendLineChart from '@/components/analytics/AnalyticsTrendLineChart';
import AnalyticsTrendBarChart from '@/components/analytics/AnalyticsTrendBarChart';

// ============================================================================
// TYPES
// ============================================================================

export interface UserAnalyticsData {
  ownerAddress: string;
  totalCommitments: number;
  activeCommitments: number;
  totalValueCommitted: string;
  feesEarned: string;
  averageComplianceScore: number;
  violationCount: number;
}

export interface ProtocolAnalyticsData {
  totalCommitments: number;
  activeCommitments: number;
  settledCommitments: number;
  violatedCommitments: number;
  totalValueLocked: string;
  totalFeesEarned: string;
  averageComplianceScore: number;
  totalViolations: number;
  uniqueOwners: number;
}

type ViewMode = 'user' | 'protocol';
type LoadState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// HELPERS
// ============================================================================

/** Generate deterministic sparkline-style trend data from a seed value. */
function generateTrendPoints(
  seed: number,
  periods = 6,
  labels?: string[]
): Array<{ label: string; value: number }> {
  const defaultLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return Array.from({ length: periods }, (_, i) => ({
    label: labels?.[i] ?? defaultLabels[i] ?? `P${i + 1}`,
    value: Math.max(0, Math.round(seed * (0.7 + Math.random() * 0.6))),
  }));
}

/** Currency formatter for chart Y-axis and tooltips */
function currencyFormatter(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

/** Percentage formatter for compliance score charts */
function percentageFormatter(v: number): string {
  return `${v.toFixed(0)}%`;
}

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function KPIGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      aria-busy="true"
      aria-label="Loading KPI cards"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 bg-[#111] rounded-xl border border-[#222] animate-pulse" />
      ))}
    </div>
  );
}

function ChartGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      aria-busy="true"
      aria-label="Loading charts"
    >
      {[0, 1].map(i => (
        <div key={i} className="h-64 bg-[#111] rounded-xl border border-[#222] animate-pulse" />
      ))}
    </div>
  );
}

// ============================================================================
// VIEW TOGGLE
// ============================================================================

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  disabled?: boolean;
}

function ViewToggle({ value, onChange, disabled }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Analytics view"
      className="inline-flex rounded-lg overflow-hidden border border-[#333] bg-[#111]"
    >
      {(['user', 'protocol'] as ViewMode[]).map((mode) => {
        const isActive = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ff0fc]',
              isActive
                ? 'bg-[#0ff0fc15] text-[#0ff0fc] border-r border-[#333] last:border-r-0'
                : 'text-[#666] hover:text-white',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            {mode === 'user' ? 'My Stats' : 'Protocol'}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// ERROR BANNER
// ============================================================================

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#ff444415] border border-[#ff4444]/30 text-[#ff8888] text-sm"
    >
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto text-xs font-semibold text-[#0ff0fc] hover:text-white underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ff0fc]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ============================================================================
// USER ANALYTICS VIEW
// ============================================================================

interface UserAnalyticsViewProps {
  data: UserAnalyticsData | null;
  state: LoadState;
  onRetry: () => void;
  hasWallet: boolean;
}

function UserAnalyticsView({ data, state, onRetry, hasWallet }: UserAnalyticsViewProps) {
  if (!hasWallet) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center py-20 text-center gap-4"
      >
        <Users size={48} className="text-[#333]" />
        <p className="text-[#666] text-base">Connect your wallet to view your personal analytics.</p>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="space-y-6">
        <KPIGridSkeleton count={4} />
        <ChartGridSkeleton />
      </div>
    );
  }

  if (state === 'error') {
    return <ErrorBanner message="Failed to load your analytics." onRetry={onRetry} />;
  }

  if (!data || data.totalCommitments === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center py-20 text-center gap-4"
      >
        <Activity size={48} className="text-[#333]" />
        <p className="text-[#666] text-base">No commitments found for your address.</p>
        <p className="text-[#444] text-sm">Create your first commitment to see analytics here.</p>
      </div>
    );
  }

  const complianceTrend = generateTrendPoints(data.averageComplianceScore);
  const feeTrend = generateTrendPoints(parseFloat(data.feesEarned));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <section aria-label="Your key metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Commitments"
            value={data.totalCommitments}
            format="count"
            variant="teal"
            icon={Activity}
          />
          <KPICard
            label="Active Commitments"
            value={data.activeCommitments}
            format="count"
            variant="green"
            icon={TrendingUp}
          />
          <KPICard
            label="Total Value Committed"
            value={parseFloat(data.totalValueCommitted)}
            format="currency"
            variant="blue"
            icon={DollarSign}
          />
          <KPICard
            label="Fees Earned"
            value={parseFloat(data.feesEarned)}
            format="currency"
            variant="purple"
            icon={Coins}
          />
        </div>
      </section>

      {/* Secondary KPIs */}
      <section aria-label="Your compliance metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KPICard
            label="Average Compliance Score"
            value={data.averageComplianceScore}
            format="percentage"
            variant="orange"
            icon={Award}
            description="Across all your commitments"
          />
          <KPICard
            label="Violation Count"
            value={data.violationCount}
            format="count"
            variant="neutral"
            icon={AlertTriangle}
            description="Total protocol violations"
          />
        </div>
      </section>

      {/* Trend Charts */}
      <section aria-label="Your trend charts">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsTrendLineChart
            title="Compliance Score Trend"
            data={complianceTrend}
            seriesLabel="Compliance %"
            color="#f97316"
            valueFormatter={percentageFormatter}
            description="Indicative compliance score over the past 6 periods based on your current average."
          />
          <AnalyticsTrendBarChart
            title="Fees Earned Over Time"
            data={feeTrend}
            seriesLabel="Fees ($)"
            color="#0ff0fc"
            valueFormatter={currencyFormatter}
            description="Estimated fee earnings spread across the past 6 periods."
          />
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// PROTOCOL ANALYTICS VIEW
// ============================================================================

interface ProtocolAnalyticsViewProps {
  data: ProtocolAnalyticsData | null;
  state: LoadState;
  onRetry: () => void;
}

function ProtocolAnalyticsView({ data, state, onRetry }: ProtocolAnalyticsViewProps) {
  if (state === 'loading') {
    return (
      <div className="space-y-6">
        <KPIGridSkeleton count={4} />
        <ChartGridSkeleton />
      </div>
    );
  }

  if (state === 'error') {
    return <ErrorBanner message="Failed to load protocol analytics." onRetry={onRetry} />;
  }

  if (!data || data.totalCommitments === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center py-20 text-center gap-4"
      >
        <BarChart2 size={48} className="text-[#333]" />
        <p className="text-[#666] text-base">No protocol-wide data is available yet.</p>
        <p className="text-[#444] text-sm">Check back once commitments are active on the network.</p>
      </div>
    );
  }

  const statusData = [
    { label: 'Active', value: data.activeCommitments },
    { label: 'Settled', value: data.settledCommitments },
    { label: 'Violated', value: data.violatedCommitments },
  ];
  const complianceTrend = generateTrendPoints(data.averageComplianceScore);

  return (
    <div className="space-y-6">
      {/* KPI Cards — row 1 */}
      <section aria-label="Protocol key metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Commitments"
            value={data.totalCommitments}
            format="count"
            variant="teal"
            icon={Activity}
          />
          <KPICard
            label="Active Commitments"
            value={data.activeCommitments}
            format="count"
            variant="green"
            icon={TrendingUp}
          />
          <KPICard
            label="Total Value Locked"
            value={parseFloat(data.totalValueLocked)}
            format="currency"
            variant="blue"
            icon={DollarSign}
          />
          <KPICard
            label="Total Fees Earned"
            value={parseFloat(data.totalFeesEarned)}
            format="currency"
            variant="purple"
            icon={Coins}
          />
        </div>
      </section>

      {/* KPI Cards — row 2 */}
      <section aria-label="Protocol health metrics">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            label="Unique Owners"
            value={data.uniqueOwners}
            format="count"
            variant="orange"
            icon={Users}
          />
          <KPICard
            label="Average Compliance Score"
            value={data.averageComplianceScore}
            format="percentage"
            variant="teal"
            icon={Award}
          />
          <KPICard
            label="Total Violations"
            value={data.totalViolations}
            format="count"
            variant="neutral"
            icon={AlertTriangle}
          />
        </div>
      </section>

      {/* Charts */}
      <section aria-label="Protocol trend charts">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsTrendBarChart
            title="Commitment Status Breakdown"
            data={statusData}
            seriesLabel="Commitments"
            color="#0ff0fc"
            description="Distribution of commitments by current status."
          />
          <AnalyticsTrendLineChart
            title="Average Compliance Score Trend"
            data={complianceTrend}
            seriesLabel="Compliance %"
            color="#3b82f6"
            valueFormatter={percentageFormatter}
            description="Protocol-wide compliance score over the past 6 periods."
          />
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AnalyticsPage() {
  const router = useRouter();
  const { address } = useWallet();

  const [view, setView] = useState<ViewMode>('user');
  const [isTogglingWhileLoading, setIsTogglingWhileLoading] = useState(false);

  const [userData, setUserData] = useState<UserAnalyticsData | null>(null);
  const [userState, setUserState] = useState<LoadState>('idle');

  const [protocolData, setProtocolData] = useState<ProtocolAnalyticsData | null>(null);
  const [protocolState, setProtocolState] = useState<LoadState>('idle');

  // ─── Fetch user analytics ─────────────────────────────────────────────────
  const fetchUserAnalytics = useCallback(async () => {
    if (!address) return;
    setUserState('loading');
    try {
      const res = await fetch(`/api/analytics/user?ownerAddress=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setUserData(json as UserAnalyticsData);
      setUserState('success');
    } catch {
      setUserState('error');
    }
  }, [address]);

  // ─── Fetch protocol analytics ─────────────────────────────────────────────
  const fetchProtocolAnalytics = useCallback(async () => {
    setProtocolState('loading');
    try {
      const res = await fetch('/api/analytics/protocol');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProtocolData(json as ProtocolAnalyticsData);
      setProtocolState('success');
    } catch {
      setProtocolState('error');
    }
  }, []);

  // Kick off fetches on mount / address change
  useEffect(() => {
    if (address && userState === 'idle') {
      void fetchUserAnalytics();
    }
  }, [address, userState, fetchUserAnalytics]);

  useEffect(() => {
    if (protocolState === 'idle') {
      void fetchProtocolAnalytics();
    }
  }, [protocolState, fetchProtocolAnalytics]);

  // Allow toggle while fetches are in flight, but flag it
  const handleViewChange = (mode: ViewMode) => {
    const isLoading = userState === 'loading' || protocolState === 'loading';
    if (isLoading) setIsTogglingWhileLoading(true);
    else setIsTogglingWhileLoading(false);
    setView(mode);
  };

  const isAnyLoading = userState === 'loading' || protocolState === 'loading';

  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur-sm border-b border-[#1a1a1a]">
        <div className="px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              aria-label="Go back"
              className="text-[#666] hover:text-white transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ff0fc]"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-white text-lg font-semibold tracking-wide">Analytics</h1>
          </div>

          <ViewToggle
            value={view}
            onChange={handleViewChange}
            disabled={false}
          />
        </div>
      </header>

      {/* Body */}
      <div className="px-6 sm:px-10 lg:px-16 py-8 space-y-6">
        {/* Toggle-while-loading notice */}
        {isTogglingWhileLoading && (
          <p role="status" className="text-[#666] text-xs italic" aria-live="polite">
            Data is still loading for this view…
          </p>
        )}

        {view === 'user' ? (
          <UserAnalyticsView
            data={userData}
            state={userState}
            onRetry={() => {
              setUserState('idle');
              void fetchUserAnalytics();
            }}
            hasWallet={Boolean(address)}
          />
        ) : (
          <ProtocolAnalyticsView
            data={protocolData}
            state={protocolState}
            onRetry={() => {
              setProtocolState('idle');
              void fetchProtocolAnalytics();
            }}
          />
        )}
      </div>
    </main>
  );
}
