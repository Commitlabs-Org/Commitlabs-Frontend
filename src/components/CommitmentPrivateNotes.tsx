'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CommitmentPrivateNotesProps {
  commitmentId: string;
}

const STORAGE_KEY = (id: string) => `commitment-notes-${id}`;
const MAX_CHARS = 2000;

export function CommitmentPrivateNotes({ commitmentId }: CommitmentPrivateNotesProps) {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY(commitmentId));
      if (stored !== null) setNotes(stored);
    } catch {
      // localStorage unavailable (e.g. SSR or private browsing)
    }
  }, [commitmentId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, MAX_CHARS);
    setNotes(value);
    setSaved(false);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY(commitmentId), value);
        setSaved(true);
      } catch {
        // ignore write errors
      }
    }, 800);
  };

  const handleClear = () => {
    setNotes('');
    setSaved(false);
    try {
      localStorage.removeItem(STORAGE_KEY(commitmentId));
    } catch {
      // ignore
    }
  };

  const remaining = MAX_CHARS - notes.length;

  return (
    <section
      aria-labelledby="private-notes-heading"
      className="rounded-2xl bg-[#111] border border-[#222] p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 id="private-notes-heading" className="text-white text-base font-semibold">
          Private Notes
        </h2>
        <span className="text-xs text-[#99a1af]">
          {saved ? 'Saved locally ✓' : 'Unsaved'}
        </span>
      </div>

      <textarea
        id={`notes-${commitmentId}`}
        value={notes}
        onChange={handleChange}
        placeholder="Add private notes for this commitment — stored only in your browser."
        rows={5}
        aria-describedby={`notes-hint-${commitmentId}`}
        className="w-full resize-y rounded-lg bg-[#0a0a0a] border border-[#333] text-white text-sm p-3 focus:outline-none focus:ring-1 focus:ring-[#51A2FF] placeholder-[#444]"
      />

      <div
        id={`notes-hint-${commitmentId}`}
        className="mt-2 flex items-center justify-between text-xs text-[#99a1af]"
      >
        <span>Stored in your browser only — never sent to any server.</span>
        <span className={remaining < 100 ? 'text-amber-400' : ''}>
          {remaining} characters remaining
        </span>
      </div>

      {notes.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 text-xs text-red-400 hover:text-red-300 focus:outline-none focus:underline"
        >
          Clear notes
        </button>
      )}
    </section>
  );
}
