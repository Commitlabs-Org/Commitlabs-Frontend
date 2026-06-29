'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Commitment } from '@/lib/types/domain';
import { AtRiskCommitment, classifyAtRiskCommitments } from '@/utils/classification';
import { ProtocolConstants, fetchProtocolConstants } from '@/utils/protocol';
import { useToast } from '@/components/toast/ToastProvider';

export interface AtRiskThresholds {
  /** Compliance score below which a commitment is flagged (default: 70) */
  complianceScoreThreshold: number;
  /** Days remaining at or below which a commitment is flagged (default: 7) */
  daysRemainingThreshold: number;
}

export const DEFAULT_AT_RISK_THRESHOLDS: AtRiskThresholds = {
  complianceScoreThreshold: 70,
  daysRemainingThreshold: 7,
};

interface AtRiskCommitmentsProps {
  commitments?: Commitment[];
  thresholds?: Partial<AtRiskThresholds>;
  onThresholdsChange?: (thresholds: AtRiskThresholds) => void;
}

function validateThreshold(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function AtRiskCommitments({
  commitments = [],
  thresholds: thresholdsProp,
  onThresholdsChange,
}: AtRiskCommitmentsProps) {
  const [atRisk, setAtRisk] = useState<AtRiskCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<AtRiskThresholds>({
    ...DEFAULT_AT_RISK_THRESHOLDS,
    ...thresholdsProp,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [complianceInput, setComplianceInput] = useState(
    String(thresholds.complianceScoreThreshold)
  );
  const [daysInput, setDaysInput] = useState(String(thresholds.daysRemainingThreshold));
  const [validationError, setValidationError] = useState<string | null>(null);
  const prevAtRiskIds = useRef<Set<string>>(new Set());
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const constants: ProtocolConstants = await fetchProtocolConstants();
        setAtRisk(classifyAtRiskCommitments(commitments, constants, thresholds));
      } catch {
        setAtRisk(classifyAtRiskCommitments(commitments, null, thresholds));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [commitments, thresholds]);

  // Alert on newly at-risk commitments (deduped)
  useEffect(() => {
    if (loading) return;
    const currentIds = new Set(atRisk.map((c) => c.id));
    const newlyAtRisk = atRisk.filter((c) => !prevAtRiskIds.current.has(c.id));
    if (newlyAtRisk.length > 0) {
      toast.warning({
        title: 'Commitment At Risk',
        description: `${newlyAtRisk.length} commitment${newlyAtRisk.length > 1 ? 's have' : ' has'} newly entered at-risk status.`,
      });
    }
    prevAtRiskIds.current = currentIds;
  }, [atRisk, loading, toast]);

  function applyThresholds() {
    const compliance = Number(complianceInput);
    const days = Number(daysInput);
    if (!validateThreshold(compliance, 0, 100)) {
      setValidationError('Compliance score must be between 0 and 100.');
      return;
    }
    if (!validateThreshold(days, 0, 365)) {
      setValidationError('Days remaining must be between 0 and 365.');
      return;
    }
    setValidationError(null);
    const next: AtRiskThresholds = {
      complianceScoreThreshold: compliance,
      daysRemainingThreshold: days,
    };
    setThresholds(next);
    onThresholdsChange?.(next);
    setShowSettings(false);
  }

  if (loading) {
    return <div className="animate-pulse h-24 bg-zinc-900 rounded-xl" />;
  }

  return (
    <div className="space-y-3">
      {/* Threshold Controls */}
      <div className="flex justify-end">
        <button
          type="button"
          aria-expanded={showSettings}
          aria-controls="at-risk-settings"
          onClick={() => setShowSettings((v) => !v)}
          className="text-xs text-zinc-400 hover:text-white underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
        >
          {showSettings ? 'Hide Settings' : 'Configure Thresholds'}
        </button>
      </div>

      {showSettings && (
        <div
          id="at-risk-settings"
          role="group"
          aria-label="At-risk threshold settings"
          className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="compliance-threshold" className="text-xs text-zinc-400">
              Compliance score below (0–100)
            </label>
            <input
              id="compliance-threshold"
              type="number"
              min={0}
              max={100}
              value={complianceInput}
              onChange={(e) => setComplianceInput(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 w-32"
              aria-describedby={validationError ? 'threshold-error' : undefined}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="days-threshold" className="text-xs text-zinc-400">
              Days remaining at or below (0–365)
            </label>
            <input
              id="days-threshold"
              type="number"
              min={0}
              max={365}
              value={daysInput}
              onChange={(e) => setDaysInput(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 w-32"
              aria-describedby={validationError ? 'threshold-error' : undefined}
            />
          </div>
          {validationError && (
            <p id="threshold-error" role="alert" className="text-red-400 text-xs">
              {validationError}
            </p>
          )}
          <button
            type="button"
            onClick={applyThresholds}
            className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Apply
          </button>
        </div>
      )}

      {/* At-risk list */}
      {atRisk.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <h3 className="text-lg font-medium text-white mb-2">All Commitments Healthy</h3>
          <p className="text-zinc-400 text-sm">No commitments currently need your attention.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-red-900/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 bg-red-950/20 flex items-center justify-between">
            <h3 className="text-lg font-medium text-red-400 flex items-center gap-2">
              <span className="relative flex h-3 w-3" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              Needs Attention
            </h3>
            <span className="text-xs font-semibold bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full">
              {atRisk.length} at risk
            </span>
          </div>

          <ul className="divide-y divide-zinc-800/50" role="list" aria-label="At-risk commitments">
            {atRisk.map((commitment) => (
              <li key={commitment.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/commitments/${commitment.id}`}
                      className="text-white font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                    >
                      Commitment {commitment.id.substring(0, 8)}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {commitment.riskCategories.map((category) => (
                        <span
                          key={category}
                          className="inline-block text-zinc-400 capitalize bg-zinc-800 px-2 py-0.5 rounded"
                        >
                          {category.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={`/commitments/${commitment.id}`}
                    className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
