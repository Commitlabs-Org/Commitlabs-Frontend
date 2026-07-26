'use client';
import { DraftState } from '@/hooks/useDraftPersistence';
import { Shield, TrendingUp, Flame, RefreshCcw, X, LucideIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

interface ResumeDraftPromptProps {
  draft: DraftState;
  onResume: () => void;
  onStartFresh: () => void;
}

export default function ResumeDraftPrompt({ draft, onResume, onStartFresh }: ResumeDraftPromptProps) {
  const typeLabelMap: Record<string, string> = {
    safe: 'Safe Commitment',
    balanced: 'Balanced Commitment',
    aggressive: 'Aggressive Commitment',
  };

  const typeIconMap: Record<string, LucideIcon> = {
    safe: Shield,
    balanced: TrendingUp,
    aggressive: Flame,
  };

  const Icon = draft.selectedType ? typeIconMap[draft.selectedType] : TrendingUp;

  return (
    <Dialog
      isOpen={true}
      onClose={onStartFresh}
      labelledById="resume-draft-title"
      describedById="resume-draft-description"
      className="w-full max-w-md rounded-[18px] border border-[#FFFFFF1A] bg-[#0A0A0A] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] focus:outline-none flex flex-col relative"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-full">
            <RefreshCcw size={20} className="text-blue-400" />
          </div>
          <h2 id="resume-draft-title" className="text-xl font-semibold text-white">
            Resume Your Draft
          </h2>
        </div>
        <button
          onClick={onStartFresh}
          className="text-white/40 hover:text-white/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      <p id="resume-draft-description" className="text-white/60 mb-6 text-sm">
        You have an in-progress commitment draft. Would you like to continue where you left off?
      </p>

      <div className="bg-white/[0.03] rounded-xl p-4 mb-6 border border-white/[0.08]">
        <div className="flex items-center gap-3 mb-3">
          <Icon size={20} className="text-white/70" />
          <span className="font-medium text-white">
            {typeLabelMap[draft.selectedType ?? 'balanced']}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-white/40">Amount</div>
          <div className="text-white/90 font-medium">
            {draft.amount || 'Not set'} {draft.asset}
          </div>
          <div className="text-white/40">Duration</div>
          <div className="text-white/90 font-medium">{draft.durationDays} days</div>
          <div className="text-white/40">Max Loss</div>
          <div className="text-white/90 font-medium">{draft.maxLossPercent}%</div>
          <div className="text-white/40">Step</div>
          <div className="text-white/90 font-medium">{draft.step} of 3</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onStartFresh}
          className="flex-1 px-4 py-3 border border-white/10 rounded-xl text-white/90 font-medium hover:bg-white/[0.06] bg-white/[0.02] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Start Fresh
        </button>
        <button
          onClick={onResume}
          className="flex-1 px-4 py-3 bg-blue-600 rounded-xl text-white font-medium hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Resume Draft
        </button>
      </div>
    </Dialog>
  );
}
