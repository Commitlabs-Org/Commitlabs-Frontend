'use client'

import React, { useId, useRef } from 'react'
import { Keyboard, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { getShortcutGroups } from '@/lib/shortcuts'

export interface KeyboardShortcutsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsOverlay({ isOpen, onClose }: KeyboardShortcutsOverlayProps) {
  const titleId = useId()
  const descriptionId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const groups = getShortcutGroups()

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      labelledById={titleId}
      describedById={descriptionId}
      initialFocusRef={closeButtonRef}
      backdropClassName="bg-black/75 p-4 backdrop-blur-md"
      className="w-full max-w-2xl"
    >
      <section className="rounded-2xl border border-[rgba(0,212,255,0.2)] bg-[#0d1117] text-white shadow-[0_0_60px_rgba(0,212,255,0.15)]">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.08)] text-[#00d4ff]"
              aria-hidden="true"
            >
              <Keyboard size={18} />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold leading-tight">
                Keyboard shortcuts
              </h2>
              <p id={descriptionId} className="mt-1 text-sm text-white/50">
                Global app-shell shortcuts and dialog controls.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#00d4ff]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-3">
          {Object.entries(groups).map(([area, shortcuts]) => (
            <section key={area} aria-labelledby={`shortcuts-${area.toLowerCase()}`}>
              <h3
                id={`shortcuts-${area.toLowerCase()}`}
                className="text-xs font-semibold uppercase tracking-widest text-white/40"
              >
                {area}
              </h3>
              <ul className="mt-3 space-y-3">
                {shortcuts.map((shortcut) => (
                  <li key={shortcut.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-1.5" aria-label={`${shortcut.label}: ${shortcut.keys.join(' plus ')}`}>
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={`${shortcut.id}-${key}`}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <p className="mt-2 text-sm font-medium text-white/85">{shortcut.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/45">{shortcut.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </Dialog>
  )
}
