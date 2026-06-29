'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

const themes = ['light', 'dark', 'system'] as const

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

const labels: Record<string, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode',
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-lg text-white/40"
        aria-label="Loading theme toggle"
        disabled
      >
        <Sun size={16} aria-hidden="true" />
      </button>
    )
  }

  const current = theme ?? 'system'
  const nextIndex = (themes.indexOf(current as typeof themes[number]) + 1) % themes.length
  const nextTheme = themes[nextIndex]
  const Icon = icons[current as keyof typeof icons] ?? Monitor

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={clsx(
        'grid h-9 w-9 place-items-center rounded-lg transition-colors duration-200',
        'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
        resolvedTheme === 'light' ? 'text-[#0a0a0a]' : 'text-white/70 hover:text-white'
      )}
      aria-label={labels[current] ?? 'Toggle theme'}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  )
}
