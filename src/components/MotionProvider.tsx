'use client'

import React from 'react'
import { MotionConfig } from 'framer-motion'

interface MotionProviderProps {
  children: React.ReactNode
}

export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}
