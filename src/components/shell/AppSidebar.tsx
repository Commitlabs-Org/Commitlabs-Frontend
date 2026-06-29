'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Store, 
  PlusCircle, 
  Shield, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  X,
  Menu
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { motion, AnimatePresence } from 'framer-motion'
import { SidebarSearch } from './SidebarSearch'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  matchPaths?: string[]
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: <Home size={20} />,
    matchPaths: ['/']
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
    icon: <Store size={20} />,
    matchPaths: ['/marketplace']
  },
  {
    href: '/create',
    label: 'Create',
    icon: <PlusCircle size={20} />,
    matchPaths: ['/create']
  },
  {
    href: '/commitments',
    label: 'Commitments',
    icon: <Shield size={20} />,
    matchPaths: ['/commitments']
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: <Settings size={20} />,
    matchPaths: ['/settings']
  }
]

export interface AppSidebarProps {
  className?: string
  /** Wallet/owner address used to scope the commitment search. */
  ownerAddress?: string
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ className = '', ownerAddress }) => {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Load collapsed state from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('sidebar-collapsed')
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
  }, [])

  // Save collapsed state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Focus trap for mobile drawer
  useEffect(() => {
    if (!isMobileOpen) return

    const sidebar = sidebarRef.current
    if (!sidebar) return

    const focusableElements = sidebar.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement | undefined
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement | undefined

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false)
        return
      }

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileOpen])

  const isActive = (item: NavItem): boolean => {
    if (!item.matchPaths) return pathname === item.href
    return item.matchPaths.some(path => {
      if (path === '/') return pathname === '/'
      return pathname.startsWith(path)
    })
  }

  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev)
  }

  const toggleMobileMenu = () => {
    setIsMobileOpen(prev => !prev)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      setIsMobileOpen(false)
    }
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="fixed top-4 left-4 z-50 md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
        aria-label="Toggle navigation menu"
        aria-expanded={isMobileOpen}
      >
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {(isMobileOpen || true) && (
          <motion.aside
            ref={sidebarRef}
            initial={false}
            animate={{
              x: isMobileOpen ? 0 : undefined,
              width: isCollapsed ? 80 : 240
            }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`
              fixed top-0 left-0 h-full z-50 bg-[#0a0a0a] border-r border-white/10
              flex flex-col
              max-md:shadow-xl
              ${isMobileOpen ? 'translate-x-0' : 'max-md:-translate-x-full'}
              md:translate-x-0
              ${className}
            `}
            aria-label="Main navigation"
          >
            {/* Header */}
            <div className="flex items-center px-4 py-5 border-b border-white/10">
              <div className="flex-1 flex items-center">
                {!isCollapsed && (
                  <Link
                    href="/"
                    className="flex items-center gap-3 font-medium text-white"
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(0,212,255,0.85)] bg-[rgba(8,12,16,0.95)] shadow-[0_0_14px_rgba(0,212,255,0.35)] text-base">
                      C
                    </span>
                    <span className="text-lg">CommitLabs</span>
                  </Link>
                )}
                
                {isCollapsed && (
                  <div className="w-full flex justify-center">
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(0,212,255,0.85)] bg-[rgba(8,12,16,0.95)] shadow-[0_0_14px_rgba(0,212,255,0.35)] text-base text-white">
                      C
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isCollapsed && <ThemeToggle />}
                {/* Close button for mobile */}
                <button
                  onClick={toggleMobileMenu}
                  className="md:hidden text-white/70 hover:text-white"
                  aria-label="Close navigation menu"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Global Search */}
            <div className="border-b border-white/10">
              <SidebarSearch
                ownerAddress={ownerAddress}
                isCollapsed={isCollapsed}
                onResultSelect={() => setIsMobileOpen(false)}
              />
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 py-4 overflow-y-auto">
              <ul className="space-y-1 px-2">
                {navItems.map((item) => {
                  const active = isActive(item)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                          ${active
                            ? 'bg-[#0FF0FC]/10 text-[#0FF0FC] border border-[#0FF0FC]/20'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                          }
                          ${isCollapsed ? 'justify-center' : ''}
                        `}
                        aria-current={active ? 'page' : undefined}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {!isCollapsed && (
                          <span className="font-medium">{item.label}</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Collapse Toggle (Desktop Only) */}
            <div className="hidden md:block border-t border-white/10 p-2">
              <button
                onClick={toggleCollapsed}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? (
                  <ChevronRight size={20} />
                ) : (
                  <>
                    <ChevronLeft size={20} />
                    <span className="font-medium text-sm">Collapse</span>
                  </>
                )}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
