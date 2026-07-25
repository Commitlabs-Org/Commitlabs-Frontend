'use client'

import React from 'react'
import { GLOSSARY } from '@/lib/glossary'

interface GlossaryTermProps {
  /** The case-insensitive key used to look up the glossary entry (e.g. "max loss threshold") */
  termKey: string
  /** The content to render — typically the term label itself */
  children: React.ReactNode
}

/**
 * Renders a term decorated with an info icon and a tooltip containing its
 * glossary definition.  Falls back to rendering the children unadorned when
 * no matching entry is found, logging a console warning in development mode.
 */
export default function GlossaryTerm({ termKey, children }: GlossaryTermProps) {
  const entry = GLOSSARY[termKey.toLowerCase()]

  if (!entry) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[GlossaryTerm] No glossary entry found for termKey "${termKey}". ` +
          'Add the missing key to src/lib/glossary.ts.',
      )
    }
    return <>{children}</>
  }

  return (
    <span
      className="glossary-term"
      title={entry.definition}
      aria-label={`${entry.term}: ${entry.definition}`}
    >
      {children}
      <span
        className="glossary-icon"
        role="img"
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          marginLeft: '4px',
          borderRadius: '50%',
          backgroundColor: 'rgba(14, 241, 252, 0.15)',
          color: '#0ef1fc',
          fontSize: '10px',
          fontWeight: 700,
          cursor: 'help',
          flexShrink: 0,
        }}
      >
        ⓘ
      </span>
    </span>
  )
}
