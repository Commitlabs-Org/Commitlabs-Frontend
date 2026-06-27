'use client';
import { DraftState } from '@/hooks/useDraftPersistence';
import { Shield, TrendingUp, Flame, RefreshCcw, X } from 'lucide-react';

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

  const typeIconMap: Record<string, any> = {
    safe: Shield,
    balanced: TrendingUp,
    aggressive: Flame,
  };

  const Icon = draft.selectedType ? typeIconMap[draft.selectedType] : TrendingUp;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-full">
                <RefreshCcw size={20} className="text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Resume Your Draft</h2>
            </div>
            <button
              onClick={onStartFresh}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            You have an in-progress commitment draft. Would you like to continue where you left off?
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <Icon size={20} className="text-gray-700" />
              <span className="font-medium text-gray-900">
                {typeLabelMap[draft.selectedType ?? 'balanced']}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500">Amount</div>
              <div className="text-gray-900">{draft.amount || 'Not set'} {draft.asset}</div>
              <div className="text-gray-500">Duration</div>
              <div className="text-gray-900">{draft.durationDays} days</div>
              <div className="text-gray-500">Max Loss</div>
              <div className="text-gray-900">{draft.maxLossPercent}%</div>
              <div className="text-gray-500">Step</div>
              <div className="text-gray-900">{draft.step} of 3</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onStartFresh}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Start Fresh
            </button>
            <button
              onClick={onResume}
              className="flex-1 px-4 py-3 bg-blue-600 rounded-xl text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Resume Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
