'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface NotificationSectionProps {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
}

export const NotificationSection: React.FC<NotificationSectionProps> = ({
  title,
  description,
  icon,
  children,
}) => {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-10"
    >
      <div className="flex items-center gap-3 mb-6">
        {icon && (
          <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-[#0FF0FC]">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {description && (
            <p className="text-sm text-white/40 mt-1">{description}</p>
          )}
        </div>
      </div>
      
      <div className="grid gap-4">
        {children}
      </div>
    </motion.section>
  )
}
