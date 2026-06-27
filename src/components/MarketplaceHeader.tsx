'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Search, Plus, ArrowLeft, Menu, X } from 'lucide-react'

interface MarketplaceHeaderProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  createHref?: string
  backHref?: string
}

export function MarketplaceHeader({
  searchQuery,
  onSearchChange,
  createHref = '/create',
  backHref = '/',
}: MarketplaceHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Lock scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-[70] px-6 sm:px-12 lg:px-28 py-4 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between border-b border-white/5 transition-all duration-300">
        <div className="flex flex-col gap-1 sm:gap-2">
          <Link 
            href={backHref} 
            className="inline-flex items-center gap-2 text-[10px] sm:text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Marketplace</h1>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              placeholder="Search commitments..."
              className="h-11 w-full rounded-xl border border-white/10 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#0FF0FC]/50 sm:w-64"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="relative before:absolute before:inset-0 before:rounded-[14px]
            before:bg-gradient-to-b before:from-[#0FF0FC] before:to-[#0A7A82]
            before:blur-sm before:opacity-60">

            <Link
              href={createHref}
              className="group relative flex items-center gap-3
               rounded-2xl
               bg-[#0A0A0A]
               border border-[rgba(15,240,252,0.3)]
               px-6 py-3
               shadow-[0_0_30px_rgba(15,240,252,0.2)]
               transition-shadow
               hover:shadow-[0_0_40px_rgba(15,240,252,0.4)]"
            >
              <Plus size={18} className='text-[#0FF0FC]'/>
              <span className="font-semibold">Create</span>
            </Link>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 text-white/80 hover:text-white transition-colors relative"
          aria-label="Toggle Menu"
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      <button
        type="button"
        className={`fixed inset-0 top-[80px] z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMenuOpen(false)}
        aria-label="Close mobile menu"
      />

      {/* Mobile Drawer Content */}
      <div 
        className={`fixed inset-x-0 top-[80px] z-[60] pt-6 pb-10 px-6 bg-[#0a0a0a] border-b border-white/10 transform transition-transform duration-300 ease-in-out md:hidden ${
          isMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex flex-col gap-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input
              type="text"
              placeholder="Search commitments..."
              className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 text-base outline-none transition-colors focus:border-[#0FF0FC]/50"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setIsMenuOpen(false)}
            />
          </div>

          <div className="relative before:absolute before:inset-0 before:rounded-[20px]
            before:bg-gradient-to-b before:from-[#0FF0FC] before:to-[#0A7A82]
            before:blur-md before:opacity-40">
            <Link
              href={createHref}
              onClick={() => setIsMenuOpen(false)}
              className="group relative flex items-center justify-center gap-4
               rounded-[18px]
               bg-[#0A0A0A]
               border border-[rgba(15,240,252,0.3)]
               py-5
               shadow-[0_10px_40px_rgba(15,240,252,0.15)]
               active:scale-[0.98] transition-all"
            >
              <Plus size={24} className='text-[#0FF0FC]'/>
              <span className="text-xl font-bold">Create Commitment</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
