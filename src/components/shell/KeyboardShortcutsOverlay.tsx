'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { GLOBAL_SHORTCUTS, groupShortcuts } from '@/lib/shortcuts';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return target.isContentEditable;
}

/**
 * Global keyboard-shortcuts reference, opened with `?` (Shift+/) from
 * anywhere -- except while an input, textarea, select, or contenteditable
 * element is focused, so typing a literal "?" in a form field never
 * triggers it.
 *
 * Mount this once per app (e.g. in the root layout, or on any always-mounted
 * shell component); it listens globally regardless of where it's rendered.
 */
export function KeyboardShortcutsOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== '?') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      setIsOpen(true);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const close = () => setIsOpen(false);
  const grouped = groupShortcuts(GLOBAL_SHORTCUTS);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      labelledById="keyboard-shortcuts-title"
      className="w-full max-w-md rounded-2xl border border-[rgba(0,212,255,0.3)] bg-[#0a0a0b] p-6 text-white shadow-[0_0_30px_rgba(0,212,255,0.15)]"
    >
      <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold">
        Keyboard shortcuts
      </h2>

      <div className="mt-4 space-y-5">
        {Array.from(grouped.entries()).map(([group, entries]) => (
          <section key={group} aria-label={group}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">{group}</h3>
            <dl className="mt-2 space-y-2">
              {entries.map((entry) => (
                <div key={entry.keys} className="flex items-center justify-between text-sm">
                  <dt className="text-white/70">{entry.description}</dt>
                  <dd className="rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-xs text-[#0ff0fc]">
                    {entry.keys}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={close}
        className="mt-6 w-full rounded-lg border border-white/20 py-2 text-sm font-medium hover:border-white/40"
      >
        Close
      </button>
    </Dialog>
  );
}

export default KeyboardShortcutsOverlay;
