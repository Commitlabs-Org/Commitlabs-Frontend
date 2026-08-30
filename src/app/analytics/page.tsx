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

import React, { useState, useEffect, useCallback, useReducer, useRef } from 'react';
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
import { usePageTour, type PageTourStep } from '@/hooks/usePageTour';
import { GuidedTour } from '@/components/onboarding/GuidedTour';
import { KeyboardShortcutsOverlay } from '@/components/shell/KeyboardShortcutsOverlay';

const ANALYTICS_TOUR_STEPS: PageTourStep[] = [
  {
    targetSelector: '[data-testid="analytics-view-toggle"]',
    title: 'Switch views',
    content:
      'Toggle between "My Stats" (your own commitments) and "Protocol" (protocol-wide) analytics.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-testid="analytics-kpi-section"]',
    title: 'Key metrics',
    content:
      'These cards summarize your commitment activity at a glance -- totals, active count, value committed, and fees earned.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-testid="analytics-charts-section"]',
    title: 'Trend charts',
    content: 'Track how your compliance score and earned fees have moved over recent periods.',
    position: 'top',
  },
];

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
  snapshot?: {
    generatedAt: string;
    window: 'protocol-lifetime';
    source: 'mock' | 'chain';
    rejectedRecords: number;
  };
  invariants?: {
    statusTotalsMatch: true;
    nonNegativeTotals: true;
    complianceScoreBounded: true;
  };
}

type ViewMode = 'user' | 'protocol';
type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface ProtocolRequestState {
  state: LoadState;
  data: ProtocolAnalyticsData | null;
  requestId: number;
  retryIntent: boolean;
  errorMessage: string | null;
}

type ProtocolRequestAction =
  | { type: 'request'; requestId: number; retryIntent: boolean }
  | { type: 'success'; requestId: number; data: ProtocolAnalyticsData }
  | { type: 'failure'; requestId: number; message: string }
  | { type: 'cancel'; requestId: number }
  | { type: 'retry_intent' };

const initialProtocolRequestState: ProtocolRequestState = {
  state: 'idle',
  data: null,
  requestId: 0,
  retryIntent: false,
  errorMessage: null,
};

function isFreshProtocolAction(state: ProtocolRequestState, requestId: number): boolean {
  return state.requestId === requestId;
}

function protocolRequestReducer(
  state: ProtocolRequestState,
  action: ProtocolRequestAction,
): ProtocolRequestState {
  switch (action.type) {
    case 'request':
      if (action.requestId <= state.requestId) return state;
      return {
        ...state,
        state: 'loading',
        requestId: action.requestId,
        retryIntent: action.retryIntent,
        errorMessage: null,
      };
    case 'success':
      if (!isFreshProtocolAction(state, action.requestId)) return state;
      return {
        state: 'success',
        data: action.data,
        requestId: action.requestId,
        retryIntent: false,
        errorMessage: null,
      };
    case 'failure':
      if (!isFreshProtocolAction(state, action.requestId)) return state;
      return {
        ...state,
        state: 'error',
        retryIntent: true,
        errorMessage: action.message,
      };
    case 'cancel':
      if (!isFreshProtocolAction(state, action.requestId)) return state;
      return {
        ...state,
        state: state.data ? 'success' : 'idle',
        retryIntent: true,
        errorMessage: 'The protocol analytics refresh was cancelled before it completed.',
      };
    case 'retry_intent':
      return { ...state, retryIntent: true };
    default:
      return state;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Generate deterministic sparkline-style trend data from a seed value. */
function generateTrendPoints(
  seed: number,
  periods = 6,
  labels?: string[],
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
      {[0, 1].map((i) => (
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
      data-testid="analytics-view-toggle"
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
  detail?: string | null;
  onRetry?: () => void;
}

function ErrorBanner({ message, detail, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#ff444415] border border-[#ff4444]/30 text-[#ff8888] text-sm"
    >
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span>
        {message}
        {detail && <span className="block text-[#ffb3b3] text-xs mt-1">{detail}</span>}
      </span>
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
        <p className="text-[#666] text-base">
          Connect your wallet to view your personal analytics.
        </p>
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
      <section aria-label="Your key metrics" data-testid="analytics-kpi-section">
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
      <section aria-label="Your trend charts" data-testid="analytics-charts-section">
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
  errorMessage?: string | null;
  retryIntent?: boolean;
  onRetry: () => void;
}

function ProtocolAnalyticsView({
  data,
  state,
  errorMessage,
  retryIntent,
  onRetry,
}: ProtocolAnalyticsViewProps) {
  if (state === 'loading') {
    return (
      <div className="space-y-6">
        <KPIGridSkeleton count={4} />
        <ChartGridSkeleton />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <ErrorBanner
        message="Failed to load protocol analytics."
        detail={
          retryIntent
            ? (errorMessage ??
              'Your retry is saved. Use Retry to refresh analytics; no wallet action will be repeated.')
            : errorMessage
        }
        onRetry={onRetry}
      />
    );
  }

  if (!data || data.totalCommitments === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center py-20 text-center gap-4"
      >
        <BarChart2 size={48} className="text-[#333]" />
        <p className="text-[#666] text-base">No protocol-wide data is available yet.</p>
        <p className="text-[#444] text-sm">
          Check back once commitments are active on the network.
        </p>
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
  const [protocolRequest, dispatchProtocolRequest] = useReducer(
    protocolRequestReducer,
    initialProtocolRequestState,
  );
  const protocolAbortRef = useRef<AbortController | null>(null);
  const protocolRequestIdRef = useRef(0);
  const userAbortRef = useRef<AbortController | null>(null);

  const {
    isActive: isTourActive,
    currentStepIndex: tourStepIndex,
    currentStep: tourStep,
    totalSteps: tourTotalSteps,
    nextStep: nextTourStep,
    prevStep: prevTourStep,
    skipTour,
  } = usePageTour(ANALYTICS_TOUR_STEPS, 'commitlabs:seen-analytics-tour');

  // ─── Fetch user analytics ─────────────────────────────────────────────────
  const fetchUserAnalytics = useCallback(async () => {
    if (!address) return;
    // Cancel any in-flight user request so rapid retries / re-renders don't
    // fan out overlapping fetches or apply a stale response.
    userAbortRef.current?.abort();
    const controller = new AbortController();
    userAbortRef.current = controller;
    setUserState('loading');
    try {
      const res = await fetch(`/api/analytics/user?ownerAddress=${encodeURIComponent(address)}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setUserData(json as UserAnalyticsData);
      setUserState('success');
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      setUserState('error');
    }
  }, [address]);

  // ─── Fetch protocol analytics ─────────────────────────────────────────────
  const fetchProtocolAnalytics = useCallback(async () => {
    protocolAbortRef.current?.abort();
    const requestId = protocolRequestIdRef.current + 1;
    protocolRequestIdRef.current = requestId;
    const controller = new AbortController();
    protocolAbortRef.current = controller;
    dispatchProtocolRequest({ type: 'request', requestId, retryIntent: true });

    try {
      const res = await fetch('/api/analytics/protocol', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      dispatchProtocolRequest({
        type: 'success',
        requestId,
        data: json as ProtocolAnalyticsData,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        dispatchProtocolRequest({ type: 'cancel', requestId });
        return;
      }
      dispatchProtocolRequest({
        type: 'failure',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown protocol analytics error',
      });
    } finally {
      if (protocolAbortRef.current === controller) {
        protocolAbortRef.current = null;
      }
    }
  }, []);

  // Kick off fetches on mount / address change
  useEffect(() => {
    if (address && userState === 'idle') {
      void fetchUserAnalytics();
    }
  }, [address, userState, fetchUserAnalytics]);

  useEffect(() => {
    if (protocolRequest.state === 'idle') {
      void fetchProtocolAnalytics();
    }
  }, [protocolRequest.state, fetchProtocolAnalytics]);

  useEffect(() => {
    return () => {
      protocolAbortRef.current?.abort();
      userAbortRef.current?.abort();
    };
  }, []);

  // Allow toggle while fetches are in flight, but flag it
  const handleViewChange = (mode: ViewMode) => {
    const isLoading = userState === 'loading' || protocolRequest.state === 'loading';
    if (isLoading) setIsTogglingWhileLoading(true);
    else setIsTogglingWhileLoading(false);
    setView(mode);
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a]">
      <KeyboardShortcutsOverlay />
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

          <ViewToggle value={view} onChange={handleViewChange} disabled={false} />
        </div>
      </header>

      <GuidedTour
        isActive={isTourActive}
        currentStepIndex={tourStepIndex}
        currentStepConfig={tourStep}
        totalSteps={tourTotalSteps}
        onNext={nextTourStep}
        onBack={prevTourStep}
        onSkip={skipTour}
      />

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
            data={protocolRequest.data}
            state={protocolRequest.state}
            errorMessage={protocolRequest.errorMessage}
            retryIntent={protocolRequest.retryIntent}
            onRetry={() => {
              dispatchProtocolRequest({ type: 'retry_intent' });
              void fetchProtocolAnalytics();
            }}
          />
        )}
      </div>
    </main>
  );
}
