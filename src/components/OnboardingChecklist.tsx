'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@/hooks/useWallet';
import { CheckCircle2, Circle, ArrowRight, X } from 'lucide-react';

export interface ChecklistMilestone {
  id: string;
  label: string;
  completed: boolean;
}

const STORAGE_KEY = 'commitlabs:onboarding-checklist';

const DEFAULT_MILESTONES: ChecklistMilestone[] = [
  { id: 'connect-wallet', label: 'Connect your wallet', completed: false },
  { id: 'explore-marketplace', label: 'Explore the marketplace', completed: false },
  { id: 'create-commitment', label: 'Create your first commitment', completed: false },
  { id: 'complete-tour', label: 'Complete the guided tour', completed: false },
];

interface OnboardingChecklistProps {
  className?: string;
  onAllComplete?: () => void;
  hasCommitments?: boolean;
}

/**
 * OnboardingChecklist Component
 * 
 * This component acts as a high-level getting started wizard/checklist for first-time users.
 * 
 * Decision Details:
 * Retained alongside the GuidedTour component because they serve complementary purposes:
 * - GuidedTour offers an interactive, step-by-step walkthrough of the multi-step "Create Commitment" wizard.
 * - OnboardingChecklist serves as a persistent dashboard-level onboarding status checker tracking broader
 *   milestones (e.g., wallet connection, marketplace exploration, and first commitment creation),
 *   of which the guided tour itself is a sub-milestone.
 */
export function OnboardingChecklist({ className, onAllComplete, hasCommitments }: OnboardingChecklistProps) {
  const { connected, connect } = useWallet();
  const [milestones, setMilestones] = useState<ChecklistMilestone[]>(DEFAULT_MILESTONES);
  const [dismissed, setDismissed] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const isWalletConnected = connected;
    const isMarketplaceVisited = typeof window !== 'undefined' && localStorage.getItem('commitlabs:visited-marketplace') === 'true';
    const isCommitmentCreated = !!hasCommitments || (typeof window !== 'undefined' && localStorage.getItem('commitlabs:created-commitment') === 'true');
    const isTourCompleted = typeof window !== 'undefined' && localStorage.getItem('commitlabs:seen-wizard-tour') === 'true';

    const updatedMilestones = [
      { id: 'connect-wallet', label: 'Connect your wallet', completed: isWalletConnected },
      { id: 'explore-marketplace', label: 'Explore the marketplace', completed: isMarketplaceVisited },
      { id: 'create-commitment', label: 'Create your first commitment', completed: isCommitmentCreated },
      { id: 'complete-tour', label: 'Complete the guided tour', completed: isTourCompleted },
    ];

    setMilestones(updatedMilestones);
    setIsLoaded(true);

    const isDismissed = typeof window !== 'undefined' && localStorage.getItem('commitlabs:onboarding-checklist-dismissed') === 'true';
    setDismissed(isDismissed);

    if (updatedMilestones.every(m => m.completed)) {
      onAllComplete?.();
    }
  }, [connected, hasCommitments, onAllComplete]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('commitlabs:onboarding-checklist-dismissed', 'true');
    }
  };

  if (dismissed || !isLoaded) return null;

  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length;
  const allDone = completedCount === totalCount;

  return (
    <section
      aria-labelledby="onboarding-checklist-title"
      className={`relative w-full rounded-2xl border border-white/10 bg-[#0D121F]/90 p-6 md:p-8 backdrop-blur-md shadow-[0_0_25px_rgba(15,240,252,0.05)] border-t-2 border-t-[#0FF0FC] mb-8 ${className || ''}`}
      data-testid="onboarding-checklist"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 id="onboarding-checklist-title" className="text-xl font-bold text-white mb-1">
            Getting Started
          </h2>
          <p className="text-sm text-[#99A1AF]">
            Complete these setup tasks to customize, review, and deploy your commitments on-chain.
          </p>
        </div>
        <button
          aria-label="Dismiss onboarding checklist"
          onClick={handleDismiss}
          className="text-[#99A1AF] hover:text-white transition-colors duration-200 p-1 rounded-lg hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-2 mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex-1">
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#0FF0FC] to-[#51A2FF] h-full transition-all duration-500 ease-out"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
        <span aria-live="polite" className="text-sm font-semibold text-[#0FF0FC] whitespace-nowrap">
          {allDone ? 'All steps complete!' : `${completedCount} of ${totalCount} completed`}
        </span>
      </div>

      {/* Milestones list */}
      <ul className="divide-y divide-white/5">
        {milestones.map((m) => {
          let actionElement = null;

          if (!m.completed) {
            if (m.id === 'connect-wallet') {
              actionElement = (
                <button
                  onClick={connect}
                  className="flex items-center gap-1 text-xs font-semibold text-[#0FF0FC] hover:text-white transition-colors py-1 px-3.5 rounded-lg border border-[#0FF0FC]/30 hover:border-[#0FF0FC] bg-transparent hover:bg-[#0FF0FC]/10"
                >
                  <span>Connect Wallet</span>
                  <ArrowRight size={12} />
                </button>
              );
            } else if (m.id === 'explore-marketplace') {
              actionElement = (
                <Link
                  href="/marketplace"
                  className="flex items-center gap-1 text-xs font-semibold text-[#0FF0FC] hover:text-white transition-colors py-1 px-3.5 rounded-lg border border-[#0FF0FC]/30 hover:border-[#0FF0FC] bg-transparent hover:bg-[#0FF0FC]/10"
                >
                  <span>Browse Marketplace</span>
                  <ArrowRight size={12} />
                </Link>
              );
            } else if (m.id === 'create-commitment') {
              actionElement = (
                <Link
                  href="/create"
                  className="flex items-center gap-1 text-xs font-semibold text-[#0FF0FC] hover:text-white transition-colors py-1 px-3.5 rounded-lg border border-[#0FF0FC]/30 hover:border-[#0FF0FC] bg-transparent hover:bg-[#0FF0FC]/10"
                >
                  <span>Create Commitment</span>
                  <ArrowRight size={12} />
                </Link>
              );
            } else if (m.id === 'complete-tour') {
              actionElement = (
                <Link
                  href="/create?startTour=true"
                  className="flex items-center gap-1 text-xs font-semibold text-[#0FF0FC] hover:text-white transition-colors py-1 px-3.5 rounded-lg border border-[#0FF0FC]/30 hover:border-[#0FF0FC] bg-transparent hover:bg-[#0FF0FC]/10"
                >
                  <span>Launch Tour</span>
                  <ArrowRight size={12} />
                </Link>
              );
            }
          }

          return (
            <li
              key={m.id}
              className="flex items-center justify-between py-3.5 gap-4 group transition-colors duration-150"
            >
              <div className="flex items-center gap-3">
                {m.completed ? (
                  <CheckCircle2 size={18} className="text-[#0FF0FC] shrink-0" />
                ) : (
                  <Circle size={18} className="text-white/20 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    m.completed ? 'text-[#99A1AF] line-through decoration-white/20' : 'text-white'
                  }`}
                >
                  {m.label}
                </span>
              </div>
              {actionElement}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
