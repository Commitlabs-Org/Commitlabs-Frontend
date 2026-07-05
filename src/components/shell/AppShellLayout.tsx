'use client'

import React, { useEffect, useState } from 'react'
import { AppSidebar } from './AppSidebar'
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay'

export interface AppShellLayoutProps {
  children: React.ReactNode
}

export const AppShellLayout: React.FC<AppShellLayoutProps> = ({ children }) => {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isKeyboardShortcutHelpEvent(event) || isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()
      setIsShortcutsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSkipToMain = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const mainContent = document.getElementById('main-content')

    if (!mainContent) {
      return
    }

    event.preventDefault()
    mainContent.focus()
    mainContent.scrollIntoView()
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <a className="skip-link" href="#main-content" onClick={handleSkipToMain}>
        Skip to main content
      </a>
      <AppSidebar />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 md:ml-[240px] transition-[margin] duration-300 focus:outline-none"
      >
        {children}
      </main>
      <KeyboardShortcutsOverlay
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  )
}

function isKeyboardShortcutHelpEvent(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }

  return event.key === '?' || (event.key === '/' && event.shiftKey)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  )
}
