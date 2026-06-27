'use client'

import React from 'react'
import { AppSidebar } from './AppSidebar'

export interface AppShellLayoutProps {
  children: React.ReactNode
}

export const AppShellLayout: React.FC<AppShellLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AppSidebar />
      <main className="flex-1 md:ml-[240px] transition-[margin] duration-300">
        {children}
      </main>
    </div>
  )
}
