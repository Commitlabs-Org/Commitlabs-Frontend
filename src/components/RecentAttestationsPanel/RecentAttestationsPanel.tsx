'use client';

import React from 'react';

interface Attestation {
  id: string;
  title: string;
  description: string;
  txHash: string;
  timestamp: Date;
  severity: 'ok' | 'warning' | 'violation';
}

interface AttestationSummary {
  complianceCount: number;
  warningCount: number;
  violationCount: number;
}

interface RecentAttestationsPanelProps {
  attestations: Attestation[];
  summary: AttestationSummary;
  onSelectAttestation: (id: string) => void;
  onViewAll: () => void;
}

export default function RecentAttestationsPanel({
  attestations,
  summary,
  onSelectAttestation,
  onViewAll,
}: RecentAttestationsPanelProps) {
  return (
    <section aria-label="Recent attestations">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-xl font-bold">Attestations</h2>
        <div className="flex gap-3 text-sm text-white/50">
          <span>{summary.complianceCount} compliance</span>
          <span>{summary.warningCount} warnings</span>
          <span>{summary.violationCount} violations</span>
        </div>
      </div>
      <div className="space-y-2">
        {attestations.map((att) => (
          <button
            key={att.id}
            onClick={() => onSelectAttestation(att.id)}
            className="w-full text-left bg-[#0a0a0a] rounded-xl p-4 border border-[#222] hover:border-[#333] transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  att.severity === 'ok'
                    ? 'bg-green-500'
                    : att.severity === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              />
              <span className="text-white text-sm font-medium">{att.title}</span>
            </div>
            <p className="text-white/50 text-xs">{att.description}</p>
          </button>
        ))}
      </div>
      <button
        onClick={onViewAll}
        className="mt-3 text-[#0FF0FC] text-sm hover:underline"
      >
        View all attestations
      </button>
    </section>
  );
}
