'use client';

import React, { useCallback, useState } from 'react';

interface DisputeModalProps {
  isOpen: boolean;
  commitmentId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function DisputeModal({
  isOpen,
  commitmentId,
  onClose,
  onSubmitted,
}: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/commitments/${encodeURIComponent(commitmentId)}/dispute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      onSubmitted();
    } catch {
      // Error handled silently — modal stays open for retry
    } finally {
      setSubmitting(false);
    }
  }, [commitmentId, reason, onSubmitted]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report an issue"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] rounded-2xl p-8 border border-[#222] max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-lg font-bold mb-4">Report an Issue</h2>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the issue…"
          rows={4}
          className="w-full rounded-lg bg-[#161616] border border-[#232323] text-white p-3 text-sm resize-none mb-4"
          aria-label="Issue description"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-[#161616] border border-[#232323] text-white text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="flex-1 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
