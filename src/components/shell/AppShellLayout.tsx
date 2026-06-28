'use client'

import React from 'react'
import { AppSidebar } from './AppSidebar'
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay'

export interface AppShellLayoutProps {
  children: React.ReactNode
}

export const AppShellLayout: React.FC<AppShellLayoutProps> = ({ children }) => {
  const [isShortcutsOpen, setIsShortcutsOpen] = React.useState(false)

  React.useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName.toLowerCase()
      return (
        target.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?' || isEditableTarget(event.target)) return

      event.preventDefault()
      setIsShortcutsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AppSidebar />
      <main className="flex-1 md:ml-[240px] transition-[margin] duration-300">
        {children}
      </main>
      <KeyboardShortcutsOverlay
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  )
}
