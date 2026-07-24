'use client'

import React from 'react'
import { AppSidebar } from './AppSidebar'

export interface AppShellLayoutProps {
  children: React.ReactNode
}

export const AppShellLayout: React.FC<AppShellLayoutProps> = ({ children }) => {
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
    </div>
  )
}
