'use client'

import React, { useRef } from 'react'
import { X } from 'lucide-react'
import { shortcutGroups } from '@/lib/keyboardShortcuts'
import { Dialog } from '@/components/ui/Dialog'

export interface KeyboardShortcutsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

const titleId = 'keyboard-shortcuts-title'
const descriptionId = 'keyboard-shortcuts-description'

export function KeyboardShortcutsOverlay({ isOpen, onClose }: KeyboardShortcutsOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      labelledById={titleId}
      describedById={descriptionId}
      initialFocusRef={closeButtonRef}
      className="w-full max-w-2xl rounded-2xl border border-[#0FF0FC]/20 bg-[#0b0f14] p-0 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0FF0FC]">
            Reference
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold">
            Keyboard shortcuts
          </h2>
          <p id={descriptionId} className="mt-2 text-sm text-white/60">
            Global shortcuts available in the CommitLabs app shell.
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 p-2 text-white/70 transition-colors hover:border-[#0FF0FC]/40 hover:text-white"
          aria-label="Close keyboard shortcuts"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-6 px-6 py-5">
        {Object.entries(shortcutGroups)
          .filter(([, shortcuts]) => shortcuts.length > 0)
          .map(([group, shortcuts]) => (
            <section key={group} aria-labelledby={`shortcut-group-${group.toLowerCase()}`}>
              <h3
                id={`shortcut-group-${group.toLowerCase()}`}
                className="text-sm font-semibold text-white/85"
              >
                {group}
              </h3>
              <dl className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <dt className="font-medium text-white">{shortcut.label}</dt>
                      <dd className="mt-1 text-sm text-white/55">{shortcut.description}</dd>
                    </div>
                    <div className="flex flex-wrap gap-1.5" aria-label={shortcut.keys.join(' plus ')}>
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={`${shortcut.id}-${key}`}
                          className="rounded-md border border-white/15 bg-black/35 px-2 py-1 font-mono text-xs text-white/80 shadow-inner"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          ))}
      </div>
    </Dialog>
  )
}

