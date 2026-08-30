'use client';

import type { NamedDraft } from '@/hooks/useDraftPersistence';
import { Shield, TrendingUp, Flame, RefreshCcw, X, Clock } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ElementType } from 'react';

interface ResumeDraftPromptProps {
  drafts: NamedDraft[];
  onResume: (draftId: string) => void | Promise<void>;
  onStartFresh: () => void | Promise<void>;
  onDeleteDraft?: (draftId: string) => void | Promise<void>;
}

type PendingAction = {
  type: 'resume' | 'delete' | 'startFresh';
  id?: string;
};

const typeLabelMap: Record<string, string> = {
  safe: 'Safe Commitment',
  balanced: 'Balanced Commitment',
  aggressive: 'Aggressive Commitment',
};

const typeIconMap: Record<string, ElementType> = {
  safe: Shield,
  balanced: TrendingUp,
  aggressive: Flame,
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function ResumeDraftPrompt({
  drafts,
  onResume,
  onStartFresh,
  onDeleteDraft,
}: ResumeDraftPromptProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingAction | null>(null);

  const execute = useCallback(
    async (action: PendingAction) => {
      if (pendingRef.current) return;
      pendingRef.current = action;
      setPendingAction(action);
      setError(null);
      try {
        switch (action.type) {
          case 'resume':
            if (!action.id) throw new Error('Draft id is missing');
            await onResume(action.id);
            break;
          case 'delete':
            if (!action.id) throw new Error('Draft id is missing');
            if (!onDeleteDraft) throw new Error('Delete is not available');
            await onDeleteDraft(action.id);
            break;
          case 'startFresh':
            await onStartFresh();
            break;
          default:
            throw new Error(`Unhandled action type: ${(action as PendingAction).type}`);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      } finally {
        pendingRef.current = null;
        setPendingAction(null);
      }
    },
    [onResume, onDeleteDraft, onStartFresh]
  );

  const handleResume = useCallback((id: string) => execute({ type: 'resume', id }), [execute]);
  const handleDelete = useCallback((id: string) => execute({ type: 'delete', id }), [execute]);
  const handleStartFresh = useCallback(() => execute({ type: 'startFresh' }), [execute]);

  if (drafts.length === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Resume draft"
      aria-busy={!!pendingAction}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-full">
                <RefreshCcw size={20} className="text-blue-600" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Resume a Draft</h2>
            </div>
            <button
              onClick={handleStartFresh}
              disabled={!!pendingAction}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Dismiss and start fresh"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-70 text-sm">
              {error
            </div>
          )}

          <p className="text-gray-600 mb-4">
            You have {drafts.length} in-progress draft{drafts.length > 1 ? 's' : ''}. Pick one to continue, or start fresh.
          </p>

          <ul className="space-y-3 mb-6 max-h-64 overflow-y-auto" aria-label="Saved drafts">
            {drafts.map((named) => {
              const { id, data, updatedAt } = named;
              const Icon = data.selectedType ? typeIconMap[data.selectedType] : TrendingUp;
              return (
                <li key={id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className="text-gray-700 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {typeLabelMap[data.selectedType ?? 'balanced']}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 grid grid-cols-2 text-right">
                      <span>Amount:</span>
                      <span className="text-gray-700">
                        {data.amount || 'Not set'} {data.asset}
                      </span>
                      <span>Duration:</span>
                      <span className="text-gray-700">{data.durationDays}d|/span>
                      <span>Step:</span>
                      <span className="text-gray-700">{data.step} of 3</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Clock size={11} aria-hidden="true" />
                      <span>{formatRelativeTime(updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleResume(id)}
                      disabled={!!pendingAction}
                      className="px-3 py-1.5 bg-blue-600 rounded-lg text-white text-xs font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Resume
                    </button>
                    {onDeleteDraft && (
                      <button
                        onClick={() => handleDelete(id)}
                        disabled={!!pendingAction}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label=`Delete draft ${id}`
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            onClick={handleStartFresh}
            disabled={!!pendingAction}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
}