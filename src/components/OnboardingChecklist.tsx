'use client';

import { useState, useEffect } from 'react';

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

function loadMilestones(): ChecklistMilestone[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as ChecklistMilestone[];
  } catch {}
  return DEFAULT_MILESTONES;
}

function saveMilestones(milestones: ChecklistMilestone[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones));
  } catch {}
}

interface OnboardingChecklistProps {
  className?: string;
  onAllComplete?: () => void;
}

export function OnboardingChecklist({ className, onAllComplete }: OnboardingChecklistProps) {
  const [milestones, setMilestones] = useState<ChecklistMilestone[]>(DEFAULT_MILESTONES);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMilestones(loadMilestones());
  }, []);

  function toggle(id: string) {
    setMilestones((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m));
      saveMilestones(next);
      if (next.every((m) => m.completed)) onAllComplete?.();
      return next;
    });
  }

  const completed = milestones.filter((m) => m.completed).length;
  const total = milestones.length;
  const allDone = completed === total;

  if (dismissed) return null;

  return (
    <section
      aria-labelledby="onboarding-checklist-title"
      className={className}
      data-testid="onboarding-checklist"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="onboarding-checklist-title" style={{ margin: 0 }}>
          Getting started
        </h2>
        <button
          aria-label="Dismiss onboarding checklist"
          onClick={() => setDismissed(true)}
          type="button"
        >
          ✕
        </button>
      </div>

      <p aria-live="polite" style={{ margin: '0.5rem 0' }}>
        {allDone ? 'All done!' : `${completed} of ${total} completed`}
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {milestones.map((m) => (
          <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
            <input
              aria-label={m.label}
              checked={m.completed}
              id={`milestone-${m.id}`}
              onChange={() => toggle(m.id)}
              type="checkbox"
            />
            <label htmlFor={`milestone-${m.id}`}>{m.label}</label>
          </li>
        ))}
      </ul>
    </section>
  );
}
